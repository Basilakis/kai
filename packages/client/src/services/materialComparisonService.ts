/**
 * Material Comparison Service
 * 
 * This service provides client-side functionality for comparing materials.
 */

import { api } from '../utils/api';

/**
 * Property Comparison interface
 */
export interface PropertyComparison {
  propertyName: string;
  propertyDisplayName: string;
  values: Record<string, any>;
  similarity: number;
  weight: number;
  importance: 'high' | 'medium' | 'low';
  unit?: string;
  notes?: string;
}

/**
 * Comparison Result interface
 */
export interface ComparisonResult {
  id: string;
  materials: string[];
  overallSimilarity: number;
  propertyComparisons: PropertyComparison[];
  createdAt: Date;
}

/**
 * Comparison Options interface
 */
export interface ComparisonOptions {
  propertyWeights?: Record<string, number>;
  includeProperties?: string[];
  excludeProperties?: string[];
  normalizeValues?: boolean;
  similarityThreshold?: number;
}

/**
 * Comparison Preset interface
 */
export interface ComparisonPreset {
  id: string;
  name: string;
  description?: string;
  materialType?: string;
  propertyWeights: Record<string, number>;
  includeProperties?: string[];
  excludeProperties?: string[];
  isDefault: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Similar Material Result interface
 */
export interface SimilarMaterialResult {
  material: any;
  similarity: number;
  propertyComparisons: PropertyComparison[];
}

/**
 * Material Comparison Service
 */
class MaterialComparisonService {
  /**
   * Compare materials
   * 
   * @param materialIds Material IDs to compare
   * @param options Comparison options
   * @returns Comparison result(s)
   */
  public async compareMaterials(
    materialIds: string[],
    options?: ComparisonOptions
  ): Promise<ComparisonResult | ComparisonResult[]> {
    try {
      const response = await api.post('/api/materials/compare', {
        materialIds,
        options
      });
      
      if (materialIds.length === 2) {
        return response.data.comparison;
      } else {
        return response.data.comparisons;
      }
    } catch (error) {
      console.error('Error comparing materials:', error);
      throw error;
    }
  }
  
  /**
   * Find similar materials
   * 
   * @param materialId Material ID
   * @param options Options
   * @returns Similar materials
   */
  public async findSimilarMaterials(
    materialId: string,
    options?: {
      limit?: number;
      materialType?: string;
      propertyWeights?: Record<string, number>;
      includeProperties?: string[];
      excludeProperties?: string[];
    }
  ): Promise<SimilarMaterialResult[]> {
    try {
      const queryParams = new URLSearchParams();
      
      if (options?.limit) {
        queryParams.append('limit', options.limit.toString());
      }
      
      if (options?.materialType) {
        queryParams.append('materialType', options.materialType);
      }
      
      const response = await api.get(
        `/api/materials/${materialId}/similar?${queryParams.toString()}`,
        {
          params: {
            propertyWeights: options?.propertyWeights,
            includeProperties: options?.includeProperties,
            excludeProperties: options?.excludeProperties
          }
        }
      );
      
      return response.data.similarMaterials;
    } catch (error) {
      console.error('Error finding similar materials:', error);
      throw error;
    }
  }
  
  /**
   * Get comparison presets
   * 
   * @param materialType Optional material type filter
   * @returns Comparison presets
   */
  public async getComparisonPresets(materialType?: string): Promise<ComparisonPreset[]> {
    try {
      const queryParams = new URLSearchParams();
      
      if (materialType) {
        queryParams.append('materialType', materialType);
      }
      
      const response = await api.get(`/api/materials/comparison-presets?${queryParams.toString()}`);
      
      return response.data.presets;
    } catch (error) {
      console.error('Error getting comparison presets:', error);
      throw error;
    }
  }
  
  /**
   * Get comparison preset by ID
   * 
   * @param presetId Preset ID
   * @returns Comparison preset
   */
  public async getComparisonPreset(presetId: string): Promise<ComparisonPreset> {
    try {
      const response = await api.get(`/api/materials/comparison-presets/${presetId}`);
      
      return response.data.preset;
    } catch (error) {
      console.error('Error getting comparison preset:', error);
      throw error;
    }
  }
  
  /**
   * Create comparison preset
   * 
   * @param preset Preset data
   * @returns Created preset
   */
  public async createComparisonPreset(preset: {
    name: string;
    propertyWeights: Record<string, number>;
    materialType?: string;
    description?: string;
    includeProperties?: string[];
    excludeProperties?: string[];
    isDefault?: boolean;
  }): Promise<ComparisonPreset> {
    try {
      const response = await api.post('/api/materials/comparison-presets', preset);
      
      return response.data.preset;
    } catch (error) {
      console.error('Error creating comparison preset:', error);
      throw error;
    }
  }
  
  /**
   * Update comparison preset
   * 
   * @param presetId Preset ID
   * @param updates Updates
   * @returns Updated preset
   */
  public async updateComparisonPreset(
    presetId: string,
    updates: Partial<{
      name: string;
      propertyWeights: Record<string, number>;
      materialType?: string;
      description?: string;
      includeProperties?: string[];
      excludeProperties?: string[];
      isDefault?: boolean;
    }>
  ): Promise<ComparisonPreset> {
    try {
      const response = await api.put(`/api/materials/comparison-presets/${presetId}`, updates);
      
      return response.data.preset;
    } catch (error) {
      console.error('Error updating comparison preset:', error);
      throw error;
    }
  }
  
  /**
   * Delete comparison preset
   * 
   * @param presetId Preset ID
   */
  public async deleteComparisonPreset(presetId: string): Promise<void> {
    try {
      await api.delete(`/api/materials/comparison-presets/${presetId}`);
    } catch (error) {
      console.error('Error deleting comparison preset:', error);
      throw error;
    }
  }
}

// Create a singleton instance
export const materialComparisonService = new MaterialComparisonService();
