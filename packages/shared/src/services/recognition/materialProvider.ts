import { supabase } from '../supabase/supabaseClient';
import { storage, UploadResult } from '../storage/s3StorageAdapter';
import { BaseRecognitionProvider } from './baseProvider';
import {
  RecognitionOptions,
  RecognitionResult,
  RecognitionMatch,
  RecognitionError,
  ServiceError,
  isServiceError
} from './types';

export interface MaterialRecognitionOptions extends RecognitionOptions {
  materialType?: string;
  includeMetadata?: boolean;
  similarityThreshold?: number;
}

export interface ExtractedColor {
  color: string;
  percentage: number;
  name?: string;
}

export interface MaterialRecognitionMatch extends RecognitionMatch {
  materialId: string;
  name: string;
  type: string;
  metadata?: Record<string, any>;
  imageUrl?: string;
  extractedColors?: ExtractedColor[];
}

interface MaterialData {
  id: string;
  name: string;
  type: string;
  similarity?: number;
  metadata?: Record<string, any>;
  images?: Array<{ url: string }>;
}

interface MatchMaterialsResponse extends Pick<MaterialData, 'id' | 'name' | 'type' | 'metadata'> {
  similarity: number;
}

export class MaterialRecognitionProvider extends BaseRecognitionProvider<MaterialRecognitionMatch> {
  private static instance: MaterialRecognitionProvider;
  private readonly storageBucket = 'material-recognition';

  private constructor() {
    super();
  }

  public static getInstance(): MaterialRecognitionProvider {
    if (!MaterialRecognitionProvider.instance) {
      MaterialRecognitionProvider.instance = new MaterialRecognitionProvider();
    }
    return MaterialRecognitionProvider.instance;
  }

  private bufferToBlob(buffer: Buffer | Blob): Blob {
    if (buffer instanceof Blob) return buffer;
    return new Blob([buffer], { type: 'application/octet-stream' });
  }

  private async extractColors(imageBuffer: Buffer | Blob): Promise<ExtractedColor[]> {
    let attempt = 0;
    while (attempt < this.maxRetries) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);

        const formData = new FormData();
        formData.append('image', this.bufferToBlob(imageBuffer));

        const response = await fetch(`${process.env.ML_SERVICE_URL}/colors/extract`, {
          method: 'POST',
          body: formData,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Failed to extract colors: ${response.statusText}`);
        }

        const result = await response.json();
        
        if (!Array.isArray(result.colors)) {
          throw new Error('Invalid color extraction response format');
        }

        return result.colors.map((color: any) => ({
          color: color.value,
          percentage: color.percentage,
          name: color.name
        }));
      } catch (error) {
        attempt++;
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            this.logger.warn(`Color extraction timeout (attempt ${attempt}/${this.maxRetries})`);
          } else {
            const errorDetails = isServiceError(error)
              ? { name: error.name, message: error.message, code: error.code }
              : { name: error.name, message: error.message };
            this.logger.error(`Error extracting colors (attempt ${attempt}/${this.maxRetries}):`, errorDetails);
          }
        }
        if (attempt === this.maxRetries) {
          return [];
        }
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
    return [];
  }

  protected async recognizeImpl(
    input: File | Blob | string,
    options: MaterialRecognitionOptions
  ): Promise<RecognitionResult> {
    let contentPath: string | undefined;
    let content = input;

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
      const [colors, embeddings] = await Promise.all([
        input instanceof File || input instanceof Blob ? this.extractColors(input) : [],
        this.generateEmbeddings(content)
      ]);

      const matches = await this.findSimilarMaterials(
        embeddings,
        options.materialType,
        options.similarityThreshold || options.confidenceThreshold
      );

      const filteredMatches = this.filterMatchesByConfidence(matches, options.confidenceThreshold!) as MaterialRecognitionMatch[];
      const sortedMatches = this.sortMatchesByConfidence(filteredMatches) as MaterialRecognitionMatch[];
      const limitedMatches = this.limitMatches(sortedMatches, options.maxResults!) as MaterialRecognitionMatch[];

      if (colors.length > 0) {
        limitedMatches.forEach(match => {
          match.extractedColors = colors;
        });
      }

      const enrichedMatches = options.includeMetadata
        ? await this.enrichMatchesWithMetadata(limitedMatches)
        : limitedMatches;

      return {
        matches: enrichedMatches,
        totalMatches: matches.length,
        metadata: {
          materialType: options.materialType,
          similarityThreshold: options.similarityThreshold
        }
      };
    } finally {
      if (contentPath) {
        await storage.delete([contentPath], { bucket: this.storageBucket }).catch(error => {
          this.logger.warn('Failed to delete temporary content', { error, contentPath });
        });
      }
    }
  }

  protected override async uploadContent(content: File | Blob, bucket: string): Promise<UploadResult> {
    try {
      const filename = content instanceof File ? content.name : `${crypto.randomUUID()}.bin`;
      return await storage.upload(content, {
        bucket: bucket || this.storageBucket,
        path: `temp/${filename}`
      });
    } catch (error) {
      throw new RecognitionError(
        'Failed to upload content',
        error instanceof Error ? error.message : 'UPLOAD_FAILED'
      );
    }
  }

  private readonly requestTimeout = 30000;
  private readonly maxRetries = 3;

  private async generateEmbeddings(content: string | File | Blob): Promise<number[]> {
    let attempt = 0;
    while (attempt < this.maxRetries) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);

        let formData = new FormData();
        if (typeof content === 'string') {
          formData.append('content_url', content);
        } else {
          formData.append('content', content);
        }

        const response = await fetch(`${process.env.ML_SERVICE_URL}/embeddings/generate`, {
          method: 'POST',
          body: formData,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Failed to generate embeddings: ${response.statusText}`);
        }

        const result = await response.json();
        
        if (!Array.isArray(result.embeddings) || result.embeddings.length === 0) {
          throw new Error('Invalid embeddings response format');
        }

        return result.embeddings;
      } catch (error) {
        attempt++;
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            this.logger.warn(`Embeddings generation timeout (attempt ${attempt}/${this.maxRetries})`);
          } else {
            const errorDetails = isServiceError(error)
              ? { name: error.name, message: error.message, code: error.code }
              : { name: error.name, message: error.message };
            this.logger.error(`Error generating embeddings (attempt ${attempt}/${this.maxRetries}):`, errorDetails);
          }
        }
        if (attempt === this.maxRetries) {
          throw new RecognitionError(
            'Failed to generate embeddings after multiple attempts',
            'EMBEDDING_GENERATION_FAILED'
          );
        }
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
    throw new RecognitionError('Unexpected error in embedding generation', 'UNEXPECTED_ERROR');
  }

  private async findSimilarMaterials(
    embeddings: number[],
    materialType?: string,
    similarityThreshold?: number
  ): Promise<MaterialRecognitionMatch[]> {
    let query = supabase.getClient()
      .rpc<MatchMaterialsResponse>('match_materials', {
        query_embedding: embeddings,
        similarity_threshold: similarityThreshold,
        match_count: 100
      });

    if (materialType) {
      query = query.eq('type', materialType);
    }

    const { data, error } = await query;

    if (error) {
      throw new RecognitionError(
        `Failed to search materials: ${error.message}`,
        'SEARCH_FAILED'
      );
    }

    if (!data || !Array.isArray(data)) return [];
    return data.map((match: MatchMaterialsResponse) => ({
      id: match.id,
      materialId: match.id,
      name: match.name,
      type: match.type,
      confidence: match.similarity,
      metadata: match.metadata
    }));
  }

  protected override async enrichMatchesWithMetadata(
    matches: MaterialRecognitionMatch[]
  ): Promise<MaterialRecognitionMatch[]> {
    if (matches.length === 0) return matches;

    const { data, error } = await supabase.getClient()
      .from('materials')
      .select('id, metadata, images')
      .in('id', matches.map(m => m.materialId));

    if (error) {
      this.logger.warn('Failed to enrich matches with metadata', { error });
      return matches;
    }

    const metadataMap = new Map(data.map((m: MaterialData) => [m.id, m]));

    return matches.map(match => {
      const materialData = metadataMap.get(match.materialId) as MaterialData | undefined;
      return {
        ...match,
        metadata: materialData?.metadata ?? {},
        imageUrl: materialData?.images?.[0]?.url ?? undefined
      };
    });
  }
}

export const materialRecognizerProvider = MaterialRecognitionProvider.getInstance();
export default materialRecognizerProvider;