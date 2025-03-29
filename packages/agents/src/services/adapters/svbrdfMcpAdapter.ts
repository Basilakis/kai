/**
 * SVBRDF MCP Adapter
 * 
 * Provides Material Control Panel (MCP) integration for the SVBRDF capture functionality.
 * This adapter allows the system to extract material appearance properties from images
 * using the TensorFlow-based SVBRDF capture engine.
 */

import { createLogger } from '../../utils/logger';
import { callMCPEndpoint } from '../../utils/mcpIntegration';

// Create a logger for the adapter
const logger = createLogger('SVBRDFMcpAdapter');

/**
 * Interface for SVBRDF capture request parameters
 */
interface SVBRDFCaptureRequest {
  /** Path to the material image */
  imagePath: string;
  
  /** Optional material ID for metadata integration */
  materialId?: string;
  
  /** Optional configuration overrides */
  config?: {
    /** Engine configuration */
    engine?: {
      /** Whether to use GPU acceleration */
      useGpu?: boolean;
      /** Input size for the model */
      inputSize?: number;
    };
    
    /** Processing options */
    processing?: {
      /** Whether to apply preprocessing */
      applyPreprocessing?: boolean;
      /** Whether to normalize lighting */
      normalizeLighting?: boolean;
      /** Whether to enhance details */
      enhanceDetails?: boolean;
    };
    
    /** Output options */
    output?: {
      /** Whether to save maps to disk */
      saveMaps?: boolean;
      /** Directory to save maps */
      mapsDirectory?: string;
    };
  };
}

/**
 * Response structure for SVBRDF capture results
 */
interface SVBRDFCaptureResponse {
  /** Whether the operation was successful */
  success: boolean;
  
  /** Error message if operation failed */
  error?: string;
  
  /** Extracted material properties */
  properties?: {
    /** Average diffuse color */
    averageColor?: {
      r: number;
      g: number;
      b: number;
    };
    
    /** Average surface roughness (0-1) */
    averageRoughness?: number;
    
    /** Average metallic value (0-1) */
    averageMetallic?: number;
    
    /** Surface smoothness (0-1) */
    surfaceSmoothness?: number;
    
    /** Overall reflectivity (0-1) */
    reflectivity?: number;
  };
  
  /** Paths to saved maps */
  mapPaths?: {
    /** Path to diffuse color map */
    diffuse?: string;
    
    /** Path to normal map */
    normals?: string;
    
    /** Path to roughness map */
    roughness?: string;
    
    /** Path to metallic map */
    metallic?: string;
    
    /** Path to specular map */
    specular?: string;
    
    /** Path to combined preview image */
    preview?: string;
  };
  
  /** Processing statistics */
  stats?: {
    /** Processing time in seconds */
    processingTime: number;
    
    /** Confidence score (0-1) */
    confidence: number;
  };
  
  /** Metadata for integration with material system */
  metadata?: {
    /** Material appearance properties */
    appearance: {
      /** Diffuse color properties */
      diffuseColor: {
        r: number;
        g: number;
        b: number;
      };
      
      /** Roughness value (0-1) */
      roughness: number;
      
      /** Metallic value (0-1) */
      metallic: number;
      
      /** Reflectivity value (0-1) */
      reflectivity: number;
      
      /** Surface smoothness (0-1) */
      surfaceSmoothness: number;
    };
    
    /** Paths to SVBRDF maps */
    svbrdfMaps: {
      diffuse?: string;
      normals?: string;
      roughness?: string;
      metallic?: string;
      specular?: string;
      preview?: string;
    };
    
    /** Analysis metrics */
    svbrdfAnalysis: {
      /** Confidence score (0-1) */
      confidence: number;
      
      /** Processing time in seconds */
      processingTime: number;
    };
  };
}

/**
 * Adapter for SVBRDF Capture functionality
 */
class SVBRDFMcpAdapter {
  /**
   * Capture SVBRDF maps and material properties from an image
   * 
   * @param request SVBRDF capture request parameters
   * @returns SVBRDF capture response
   */
  async captureSVBRDF(request: SVBRDFCaptureRequest): Promise<SVBRDFCaptureResponse> {
    try {
      logger.info(`Processing SVBRDF capture for image: ${request.imagePath}`);
      
      // Call the Python processor through the MCP server
      const response = await callMCPEndpoint<any>(
        'imageAnalysis',
        'material/process',
        {
          imagePath: request.imagePath,
          materialId: request.materialId || null,
          outputDir: null,  // Let the processor decide the output directory
          config: request.config || null
        }
      );
      
      if (!response.success) {
        throw new Error(response.error || 'Unknown error processing SVBRDF');
      }
      
      // Format the result for the client
      return {
        success: true,
        properties: {
          averageColor: response.result.average_color,
          averageRoughness: response.result.average_roughness,
          averageMetallic: response.result.average_metallic,
          surfaceSmoothness: response.result.surface_smoothness,
          reflectivity: response.result.reflectivity
        },
        mapPaths: response.result.map_paths,
        stats: {
          processingTime: response.result.processing_time,
          confidence: response.result.confidence
        },
        metadata: response.result.metadata
      };
      
    } catch (error) {
      logger.error(`Error capturing SVBRDF: ${error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  /**
   * Get material properties from an existing set of SVBRDF maps
   * 
   * @param diffusePath Path to diffuse map
   * @param normalPath Path to normal map
   * @param roughnessPath Path to roughness map
   * @param metallicPath Path to metallic map
   * @returns Material properties
   */
  async getMaterialPropertiesFromMaps(
    diffusePath: string,
    normalPath?: string,
    roughnessPath?: string,
    metallicPath?: string
  ): Promise<SVBRDFCaptureResponse> {
    try {
      logger.info(`Extracting material properties from SVBRDF maps: ${diffusePath}`);
      
      // Call the Python processor through the MCP server
      const response = await callMCPEndpoint<any>(
        'imageAnalysis',
        'material/properties',
        {
          diffusePath,
          normalPath: normalPath || null,
          roughnessPath: roughnessPath || null,
          metallicPath: metallicPath || null
        }
      );
      
      if (!response.success) {
        throw new Error(response.error || 'Unknown error processing SVBRDF maps');
      }
      
      // Format the result for the client
      return {
        success: true,
        properties: {
          averageColor: response.result.average_color,
          averageRoughness: response.result.average_roughness,
          averageMetallic: response.result.average_metallic,
          surfaceSmoothness: response.result.surface_smoothness,
          reflectivity: response.result.reflectivity
        },
        stats: {
          processingTime: response.result.processing_time,
          confidence: response.result.confidence
        }
      };
      
    } catch (error) {
      logger.error(`Error getting properties from SVBRDF maps: ${error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  /**
   * Apply SVBRDF maps to a material in the database
   * 
   * @param materialId Material ID to update
   * @param maps SVBRDF maps information
   * @returns Success status
   */
  async applyMapsToMaterial(
    materialId: string,
    maps: {
      diffusePath?: string;
      normalPath?: string;
      roughnessPath?: string;
      metallicPath?: string;
      specularPath?: string;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      logger.info(`Applying SVBRDF maps to material ${materialId}`);
      
      // Call the Python processor through the MCP server
      const response = await callMCPEndpoint<any>(
        'imageAnalysis',
        'material/apply-maps',
        {
          materialId,
          maps
        }
      );
      
      if (!response.success) {
        throw new Error(response.error || 'Unknown error applying SVBRDF maps');
      }
      
      return {
        success: true
      };
      
    } catch (error) {
      logger.error(`Error applying SVBRDF maps to material: ${error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

// Export singleton instance
export const svbrdfMcpAdapter = new SVBRDFMcpAdapter();
export default svbrdfMcpAdapter;