/**
 * Material Service
 * 
 * Provides methods for retrieving material data from the backend API.
 * Handles material listing, searching, and detail retrieval.
 * 
 * Now leverages the unified search API for advanced search operations
 * while maintaining backward compatibility with existing code.
 */
import apiClient from './apiClient'; // Use the configured Axios instance
import unifiedSearchService from './unifiedSearchService';

// Base API URL is now handled by apiClient

// Import the shared types
import { ClientMaterial, MaterialSearchResult } from '../types/material';

// Additional property type not in the shared definitions
export interface MaterialProperty {
  name: string;
  value: string;
}

export interface MaterialFilters {
  categories?: string[];
  manufacturers?: string[];
  properties?: Record<string, string[]>;
  search?: string;
}

export interface MaterialsResponse {
  success: boolean;
  count: number;
  total: number;
  pagination: {
    currentPage: number;
    totalPages: number;
    limit: number;
  };
  data: ClientMaterial[];
}

export interface SimilarMaterialsResponse {
  success: boolean;
  count: number;
  data: ClientMaterial[];
}

/**
 * Get all materials with pagination
 */
export const getMaterials = async (
  page: number = 1,
  limit: number = 10
): Promise<MaterialsResponse> => {
  try {
    // Use apiClient and relative path
    const response = await apiClient.get(`/materials`, {
      params: { page, limit }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching materials:', error);
    throw new Error('Failed to fetch materials');
  }
};

/**
 * Get a specific material by ID
 */
export const getMaterialById = async (id: string): Promise<ClientMaterial> => {
  try {
    // Use apiClient and relative path
    const response = await apiClient.get(`/materials/${id}`);
    return response.data.data;
  } catch (error) {
    console.error(`Error fetching material ${id}:`, error);
    throw new Error(`Failed to fetch material ${id}`);
  }
};

/**
 * Search materials with filters
 */
export const searchMaterials = async (
  filters: MaterialFilters = {},
  page: number = 1,
  limit: number = 10,
  sort: Record<string, 1 | -1> = { updatedAt: -1 }
): Promise<MaterialsResponse> => {
  try {
    // Convert filter format to match unified API expectations
    const searchParams: any = {
      type: 'materials',
      page,
      limit,
      sort
    };

    // Add search term if provided
    if (filters.search) {
      searchParams.query = filters.search;
    }

    // Add category filter
    if (filters.categories && filters.categories.length > 0) {
      searchParams.materialType = filters.categories;
    }

    // Add manufacturer filter
    if (filters.manufacturers && filters.manufacturers.length > 0) {
      searchParams.manufacturer = filters.manufacturers;
    }

    // Add property filters
    if (filters.properties) {
      Object.entries(filters.properties).forEach(([key, values]) => {
        if (values.length > 0) {
          searchParams[key] = values;
        }
      });
    }

    // Use the unified search API instead of the specific materials endpoint
    // This part remains unchanged as it already uses a different service
    return await unifiedSearchService.search(searchParams);
  } catch (error) {
    console.error('Error searching materials:', error);
    throw new Error('Failed to search materials');
  }
};

/**
 * Find similar materials to a given material
 */
export const getSimilarMaterials = async (
  materialId: string,
  limit: number = 5,
  threshold: number = 0.7,
  materialType?: string
): Promise<SimilarMaterialsResponse> => {
  try {
    // Use apiClient and relative path
    const response = await apiClient.post(`/materials/similar/${materialId}`, {
      limit,
      threshold,
      materialType
    });
    return response.data;
  } catch (error) {
    console.error(`Error finding similar materials to ${materialId}:`, error);
    throw new Error(`Failed to find similar materials to ${materialId}`);
  }
};

// Export default object with all methods
export default {
  getMaterials,
  getMaterialById,
  searchMaterials,
  getSimilarMaterials
};