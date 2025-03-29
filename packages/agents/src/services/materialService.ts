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

export class MaterialService {
  constructor(config: any) {
    // Implementation details...
  }

  async getMaterial(id: string): Promise<MaterialDetails> {
    // Implementation details...
    throw new Error('Not implemented');
  }
}