import { BaseRecognitionProvider } from './baseProvider';
import {
  RecognitionOptions,
  RecognitionResult,
  RecognitionMatch,
  RecognitionError,
  ServiceError,
  isServiceError
} from './types';

/**
 * Material properties for physically-based rendering (PBR)
 */
export interface MaterialProperties {
  albedo?: string;          // Base color/diffuse map
  roughness?: string;       // Surface roughness map
  metalness?: string;       // Metallic property map
  normal?: string;          // Normal/bump map
  height?: string;          // Height/displacement map
  ao?: string;              // Ambient occlusion map
  emissive?: string;        // Emissive map for glowing effects
}

/**
 * Options for material property extraction
 */
export interface MaterialNetOptions extends RecognitionOptions {
  extractProperties?: string[];  // Which properties to extract
  quality?: 'low' | 'medium' | 'high'; // Quality level for extraction
  outputFormat?: 'png' | 'jpg' | 'webp'; // Output format for generated maps
}

/**
 * Match result from MaterialNet extraction
 */
export interface MaterialNetMatch extends RecognitionMatch {
  properties: MaterialProperties;
  summary?: {
    dominantType: string;
    attributes: string[];
    averageRoughness: number;
    averageMetalness: number;
  };
}

/**
 * Provider for extracting PBR material properties from images
 * using the MaterialNet service
 */
export class MaterialNetProvider extends BaseRecognitionProvider<MaterialNetMatch> {
  private static instance: MaterialNetProvider;
  private readonly storageBucket = 'material-properties';
  private readonly apiUrl: string;

  private constructor() {
    super();
    this.apiUrl = process.env.API_URL || 'http://localhost:3000';
  }

  /**
   * Get singleton instance of MaterialNetProvider
   */
  public static getInstance(): MaterialNetProvider {
    if (!MaterialNetProvider.instance) {
      MaterialNetProvider.instance = new MaterialNetProvider();
    }
    return MaterialNetProvider.instance;
  }

  /**
   * Extract PBR properties from an image
   */
  public async extractProperties(
    input: File | Blob | string,
    options?: MaterialNetOptions
  ): Promise<MaterialProperties> {
    try {
      const result = await this.recognize(input, options);
      if (result.matches.length === 0) {
        throw new RecognitionError(
          'No material properties could be extracted',
          'NO_PROPERTIES_EXTRACTED'
        );
      }
      // Type assertion since we know this is a MaterialNetMatch
      const match = result.matches[0] as MaterialNetMatch;
      return match.properties;
    } catch (error) {
      this.logger.error('Failed to extract material properties', {
        error: isServiceError(error) ? error : String(error)
      });
      throw error;
    }
  }

  /**
   * Get a material property summary (average values and dominant types)
   */
  public async getMaterialSummary(
    input: File | Blob | string,
    options?: MaterialNetOptions
  ): Promise<MaterialNetMatch['summary']> {
    try {
      const result = await this.recognize(input, options);
      // Type assertion since we know this is a MaterialNetMatch
      const match = result.matches[0] as MaterialNetMatch;
      if (result.matches.length === 0 || !match || !match.summary) {
        throw new RecognitionError(
          'No material summary could be generated',
          'NO_SUMMARY_GENERATED'
        );
      }
      return match.summary;
    } catch (error) {
      this.logger.error('Failed to get material summary', {
        error: isServiceError(error) ? error : String(error)
      });
      throw error;
    }
  }

  /**
   * Get supported PBR properties
   */
  public async getSupportedProperties(): Promise<string[]> {
    try {
      const response = await fetch(`${this.apiUrl}/api/material-properties/supported`);
      if (!response.ok) {
        throw new Error(`Failed to get supported properties: ${response.statusText}`);
      }
      const result = await response.json();
      return result.properties.map((prop: any) => prop.id);
    } catch (error) {
      this.logger.error('Failed to get supported properties', {
        error: isServiceError(error) ? error : String(error)
      });
      return ['albedo', 'roughness', 'metalness', 'normal', 'height', 'ao']; // Default fallback
    }
  }

  /**
   * Implementation of the base recognition method
   * Extracts PBR properties from an image
   */
  protected async recognizeImpl(
    input: File | Blob | string,
    options: RecognitionOptions
  ): Promise<RecognitionResult> {
    const materialNetOptions = options as MaterialNetOptions;
    let contentPath: string | undefined;
    let content = input;

    // Upload content if it's a file or blob
    if (input instanceof File || input instanceof Blob) {
      const uploadResult = await this.uploadContent(input, this.storageBucket);
      if (uploadResult.error) {
        throw new RecognitionError(
          `Failed to upload content: ${uploadResult.error.message}`,
          'UPLOAD_FAILED'
        );
      }
      contentPath = uploadResult.path;
      content = contentPath;
    }

    try {
      // Extract properties from the content
      const properties = await this.extractPropertiesFromContent(
        content,
        materialNetOptions
      );

      // Create material match with extracted properties
      const match: MaterialNetMatch = {
        id: crypto.randomUUID(),
        confidence: 1.0, // Confidence is always 1.0 for property extraction
        properties,
        summary: await this.generateMaterialSummary(properties)
      };

      // Return result with the match
      return {
        matches: [match],
        totalMatches: 1,
        metadata: {
          properties: Object.keys(properties),
          quality: materialNetOptions.quality || 'medium'
        }
      };
    } finally {
      // Clean up the uploaded content
      if (contentPath) {
        await this.cleanupContent(contentPath, this.storageBucket);
      }
    }
  }

  /**
   * Extract PBR properties from content (file, blob, or URL)
   */
  private async extractPropertiesFromContent(
    content: File | Blob | string,
    options: MaterialNetOptions
  ): Promise<MaterialProperties> {
    const properties: MaterialProperties = {};
    const extractProperties = options.extractProperties || [
      'albedo',
      'roughness',
      'metalness',
      'normal',
      'height',
      'ao'
    ];
    const quality = options.quality || 'medium';
    const outputFormat = options.outputFormat || 'png';

    try {
      // Prepare API call to extract properties
      const formData = new FormData();
      if (typeof content === 'string') {
        // Content is a URL or path
        formData.append('imageUrl', content);
      } else {
        // Content is a file or blob
        formData.append('image', content);
      }

      // Add extraction options
      formData.append('propertyType', extractProperties.join(','));
      formData.append('quality', quality);
      formData.append('format', outputFormat);

      // Make API request to material-properties endpoint
      const response = await fetch(`${this.apiUrl}/api/material-properties/extract`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new RecognitionError(
          `Failed to extract properties: ${response.statusText}`,
          'EXTRACTION_FAILED'
        );
      }

      const result = await response.json();
      if (!result.success) {
        throw new RecognitionError(
          `API reported failure: ${result.error || 'Unknown error'}`,
          'API_ERROR'
        );
      }

      // Process the extracted properties
      if (result.data?.properties) {
        for (const prop of extractProperties) {
          if (result.data.properties[prop]) {
            properties[prop as keyof MaterialProperties] = result.data.properties[prop].data;
          }
        }
      }

      return properties;
    } catch (error) {
      if (error instanceof RecognitionError) {
        throw error;
      }
      throw new RecognitionError(
        `Failed to extract properties: ${error instanceof Error ? error.message : String(error)}`,
        'EXTRACTION_FAILED'
      );
    }
  }

  /**
   * Generate a material summary from extracted properties
   */
  private async generateMaterialSummary(
    properties: MaterialProperties
  ): Promise<MaterialNetMatch['summary']> {
    // This is a simplified implementation. In a real-world scenario,
    // this would analyze the property maps to extract meaningful data.
    return {
      dominantType: 'generic',
      attributes: ['textured'],
      averageRoughness: 0.5,
      averageMetalness: 0.0
    };
  }

  /**
   * Enrich matches with metadata
   * This method is required by the BaseRecognitionProvider but
   * not used in this implementation
   */
  protected async enrichMatchesWithMetadata(
    matches: MaterialNetMatch[]
  ): Promise<MaterialNetMatch[]> {
    // No enrichment needed for our use case
    return matches;
  }
}

export const materialNetProvider = MaterialNetProvider.getInstance();
export default materialNetProvider;