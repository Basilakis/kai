import { ServiceConfig } from './baseService';
import { MaterialSearchResult, SearchOptions, SearchResponse } from './materialService';

export class VectorService {
  private baseURL: string;
  private headers: Record<string, string>;

  constructor(config: ServiceConfig) {
    this.baseURL = config.baseURL;
    this.headers = config.headers || {};
  }

  async searchMaterials(options: SearchOptions): Promise<SearchResponse> {
    const response = await fetch(`${this.baseURL}/vector/materials/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.headers
      },
      body: JSON.stringify(options)
    });

    if (!response.ok) {
      throw new Error(`Failed to search materials: ${response.statusText}`);
    }

    return response.json();
  }

  async getSimilar(id: string, options?: { limit?: number }): Promise<SearchResponse> {
    const response = await fetch(`${this.baseURL}/vector/materials/${id}/similar${options?.limit ? `?limit=${options.limit}` : ''}`, {
      headers: this.headers
    });

    if (!response.ok) {
      throw new Error(`Failed to get similar materials: ${response.statusText}`);
    }

    return response.json();
  }

  async updateEmbedding(id: string, content: string): Promise<void> {
    const response = await fetch(`${this.baseURL}/vector/materials/${id}/embedding`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...this.headers
      },
      body: JSON.stringify({ content })
    });

    if (!response.ok) {
      throw new Error(`Failed to update embedding: ${response.statusText}`);
    }
  }
}

export default VectorService;