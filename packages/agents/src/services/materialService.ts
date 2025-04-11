import { RoomLayout } from './3d-designer/threeDService';
import { BaseService, ServiceConfig } from './baseService';

export interface SearchOptions {
  query: string;
  filters?: Record<string, any>;
  limit?: number;
  includeMetadata?: boolean;
}

export interface SearchResponse {
  results: MaterialDetails[];
  totalCount: number;
}

export interface MaterialDetails {
  id: string;
  name: string;
  type: string;
  properties: {
    description?: string;
    [key: string]: any;
  };
  preview?: string;
  textures?: {
    diffuse?: string;
    normal?: string;
    roughness?: string;
    [key: string]: string | undefined;
  };
  applicationAreas?: string[];
}

export interface MaterialSearchResult {
  materials: Array<{
    id: string;
    score: number;
  }>;
}

export interface MaterialSuggestion {
  material: MaterialDetails;
  confidence: number;
  applicationArea: string;
  reason: string;
}

export interface MaterialRecommendation {
  suggestions: MaterialSuggestion[];
  metadata: {
    style: string;
    colorPalette: string[];
    estimatedCost: number;
  };
}

export class MaterialService extends BaseService {
  constructor(config: ServiceConfig) {
    super(config);
  }

  /**
   * Search for materials based on query text and filters
   * @param options Search options including query, filters, and limit
   * @returns Search response with results and total count
   */
  async searchMaterials(options: SearchOptions): Promise<SearchResponse> {
    try {
      const queryParams = new URLSearchParams();
      
      if (options.limit) {
        queryParams.append('limit', options.limit.toString());
      }
      
      if (options.includeMetadata !== undefined) {
        queryParams.append('includeMetadata', options.includeMetadata.toString());
      }

      const url = `/materials/search?${queryParams.toString()}`;
      
      return await this.post<SearchResponse>(url, {
        query: options.query,
        filters: options.filters || {}
      });
    } catch (error) {
      console.error(`Error searching materials:`, error);
      throw error;
    }
  }

  /**
   * Get detailed information about a specific material
   * @param id Material ID
   * @returns Material details
   */
  async getMaterial(id: string): Promise<MaterialDetails> {
    try {
      return await this.get<MaterialDetails>(`/materials/${id}`);
    } catch (error) {
      console.error(`Failed to get material:`, error);
      throw error;
    }
  }

  /**
   * Suggest materials based on room layout and furniture
   * @param layout Room layout information
   * @param furniture Array of furniture items
   * @param requirements Material requirements
   * @returns Material recommendations
   */
  async suggestMaterials(
    layout: RoomLayout,
    furniture: Array<{
      type: string;
      position: { x: number; y: number; z: number };
      rotation: { y: number };
      dimensions: { width: number; length: number; height: number };
    }>,
    requirements: {
      style?: string;
      budget?: 'low' | 'medium' | 'high';
      preferences?: {
        colors?: string[];
        textures?: string[];
        sustainability?: boolean;
      };
    }
  ): Promise<MaterialRecommendation> {
    try {
      return await this.post<MaterialRecommendation>('/materials/suggest', {
        layout,
        furniture,
        requirements
      });
    } catch (error) {
      console.error('Error suggesting materials:', error);
      throw error;
    }
  }
}