/**
 * Unified Search Service
 * 
 * Provides a single entry point for searching across all resource types.
 * This service adapts to the unified search API endpoint introduced to
 * simplify third-party integrations and provide consistent filtering across
 * all resource types.
 */
import axios from 'axios';

// Base API URL from environment
const API_URL = process.env.REACT_APP_API_URL || '/api';

// Common search parameters interface
export interface SearchParams {
  // Resource type is required for all searches
  type: string;
  
  // Common search parameters
  query?: string;
  limit?: number;
  skip?: number;
  page?: number;
  sort?: string | Record<string, number | string>;
  
  // Dynamic filters - can be any field specific to the resource type
  [key: string]: any;
}

/**
 * Perform a unified search across any resource type
 * 
 * @param params Search parameters including required 'type'
 * @returns Search results in a standardized format
 */
export const search = async (params: SearchParams): Promise<any> => {
  try {
    // Use GET for simple queries
    if (!params.filter && Object.keys(params).length < 10) {
      const response = await axios.get(`${API_URL}/search`, { params });
      return response.data;
    }
    
    // Use POST for complex queries with filters
    const response = await axios.post(`${API_URL}/search`, params);
    return response.data;
  } catch (error) {
    console.error(`Error in unified search for ${params.type}:`, error);
    throw new Error(`Search failed for ${params.type}: ${error instanceof Error ? error.message : String(error)}`);
  }
};

/**
 * Get a resource by ID through the unified API
 * 
 * @param type Resource type
 * @param id Resource ID
 * @returns Resource object
 */
export const getById = async (type: string, id: string): Promise<any> => {
  try {
    const response = await axios.get(`${API_URL}/search`, { 
      params: { 
        type,
        id
      }
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching ${type} with ID ${id}:`, error);
    throw new Error(`Failed to fetch ${type} ${id}: ${error instanceof Error ? error.message : String(error)}`);
  }
};

/**
 * Specialized search function for materials
 * 
 * @param params Material-specific search parameters
 * @returns Material search results
 */
export const searchMaterials = async (params: Omit<SearchParams, 'type'>): Promise<any> => {
  return search({ ...params, type: 'materials' });
};

/**
 * Specialized search function for collections
 * 
 * @param params Collection-specific search parameters
 * @returns Collection search results
 */
export const searchCollections = async (params: Omit<SearchParams, 'type'>): Promise<any> => {
  return search({ ...params, type: 'collections' });
};

/**
 * Specialized search function for models
 * 
 * @param params Model-specific search parameters
 * @returns Model search results
 */
export const searchModels = async (params: Omit<SearchParams, 'type'>): Promise<any> => {
  return search({ ...params, type: 'models' });
};

/**
 * Specialized search function for history
 * 
 * @param params History-specific search parameters
 * @returns History search results
 */
export const searchHistory = async (params: Omit<SearchParams, 'type'>): Promise<any> => {
  return search({ ...params, type: 'history' });
};

// Export default object with all methods
export default {
  search,
  getById,
  searchMaterials,
  searchCollections,
  searchModels,
  searchHistory
};