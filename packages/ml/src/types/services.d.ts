export interface Material {
  id: string;
  name: string;
  type: string;
  properties: Record<string, any>;
  preview?: string;
  textures?: Record<string, string>;
  applicationAreas?: string[];
}

export interface SearchResult {
  materials: Array<{
    id: string;
    score: number;
  }>;
  total: number;
}

export interface MaterialService {
  getMaterial(id: string): Promise<Material>;
}

export interface VectorService {
  searchMaterials(params: {
    query: string;
    filters?: Record<string, any>;
  }): Promise<SearchResult>;
}

export interface ThreeDService {
  processArchitecturalDrawing(drawing: any): Promise<any>;
  generateRoomLayout(params: any): Promise<any>;
  refineResult(result: any, feedback: string, options?: any): Promise<any>;
}