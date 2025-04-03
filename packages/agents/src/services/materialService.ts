import { RoomLayout } from './3d-designer/threeDService';
import { ServiceConfig } from './baseService';

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

export class MaterialService {
  private baseURL: string;
  private headers: Record<string, string>;

  constructor(config: ServiceConfig) {
    this.baseURL = config.baseURL;
    this.headers = config.headers || {};
  }

  async getMaterial(id: string): Promise<MaterialDetails> {
    const response = await fetch(`${this.baseURL}/materials/${id}`, {
      headers: this.headers
    });

    if (!response.ok) {
      throw new Error(`Failed to get material: ${response.statusText}`);
    }

    return response.json();
  }

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
      const response = await fetch(`${this.baseURL}/materials/suggest`, {
        method: 'POST',
        headers: {
          ...this.headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          layout,
          furniture,
          requirements
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to suggest materials: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      console.error('Error suggesting materials:', error);
      throw error;
    }
  }
}