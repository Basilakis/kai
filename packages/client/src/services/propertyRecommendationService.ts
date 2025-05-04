/**
 * Property Recommendation Service
 * 
 * This service provides client-side functionality for property-based material recommendations.
 */

import { api } from '../utils/api';

/**
 * Property Recommendation Options interface
 */
export interface PropertyRecommendationOptions {
  propertyRequirements?: Record<string, any>;
  materialType?: string;
  count?: number;
  excludeMaterialIds?: string[];
  projectContext?: ProjectContext;
  includeExplanations?: boolean;
  minRelevance?: number;
}

/**
 * Project Context interface
 */
export interface ProjectContext {
  projectId?: string;
  projectType?: string;
  roomType?: string;
  existingMaterials?: string[];
  style?: string;
  budget?: 'low' | 'medium' | 'high';
  purpose?: string;
}

/**
 * Property Recommendation Result interface
 */
export interface PropertyRecommendationResult {
  materialId: string;
  materialName: string;
  materialType: string;
  relevanceScore: number;
  matchReason: string;
  propertyMatches?: {
    propertyName: string;
    requestedValue: any;
    actualValue: any;
    matchScore: number;
  }[];
  complementaryWith?: string[];
}

/**
 * Property Recommendation Service
 */
class PropertyRecommendationService {
  /**
   * Get property-based recommendations
   * 
   * @param options Recommendation options
   * @returns Recommended materials
   */
  public async getRecommendations(
    options: PropertyRecommendationOptions
  ): Promise<PropertyRecommendationResult[]> {
    try {
      const response = await api.post('/api/materials/recommendations', options);
      
      return response.data.recommendations || [];
    } catch (error) {
      console.error('Error getting property-based recommendations:', error);
      throw error;
    }
  }
  
  /**
   * Save user property preferences
   * 
   * @param materialType Material type
   * @param propertyPreferences Property preferences
   */
  public async savePropertyPreferences(
    materialType: string,
    propertyPreferences: Record<string, any>
  ): Promise<void> {
    try {
      await api.post('/api/materials/preferences', {
        materialType,
        propertyPreferences
      });
    } catch (error) {
      console.error('Error saving property preferences:', error);
      throw error;
    }
  }
  
  /**
   * Get user property preferences
   * 
   * @param materialType Optional material type filter
   * @returns User property preferences
   */
  public async getPropertyPreferences(
    materialType?: string
  ): Promise<Record<string, any>> {
    try {
      const queryParams = new URLSearchParams();
      
      if (materialType) {
        queryParams.append('materialType', materialType);
      }
      
      const response = await api.get(`/api/materials/preferences?${queryParams.toString()}`);
      
      return response.data.preferences || {};
    } catch (error) {
      console.error('Error getting property preferences:', error);
      throw error;
    }
  }
  
  /**
   * Save project context
   * 
   * @param context Project context
   */
  public async saveProjectContext(context: ProjectContext): Promise<void> {
    try {
      if (!context.projectId) {
        throw new Error('Project ID is required');
      }
      
      await api.post('/api/materials/project-context', context);
    } catch (error) {
      console.error('Error saving project context:', error);
      throw error;
    }
  }
  
  /**
   * Get project context
   * 
   * @param projectId Project ID
   * @returns Project context
   */
  public async getProjectContext(projectId: string): Promise<ProjectContext | null> {
    try {
      const response = await api.get(`/api/materials/project-context/${projectId}`);
      
      return response.data.context || null;
    } catch (error) {
      console.error('Error getting project context:', error);
      return null;
    }
  }
}

// Create a singleton instance
export const propertyRecommendationService = new PropertyRecommendationService();
