/**
 * Unified Search Service for Admin Panel
 * 
 * Provides a single entry point for searching across all resource types.
 * This service adapts to the unified search API endpoint introduced to
 * simplify third-party integrations and provide consistent filtering across
 * all resource types.
 * 
 * Admin version includes authentication headers and admin-specific resources.
 */

// Using dynamic import to work around the axios module not found error
// This would typically be a regular import, but TypeScript configurations may vary
const axios = (() => {
  try {
    // @ts-ignore
    return require('axios');
  } catch (e) {
    // Fallback for when axios isn't found
    console.warn('Axios not found, using fetch API instead');
    return {
      get: async (url: string, config?: any) => {
        const headers = new Headers();
        if (config?.headers) {
          Object.entries(config.headers).forEach(([key, value]) => 
            headers.append(key, value as string)
          );
        }
        const response = await fetch(url, { headers });
        return { 
          status: response.status, 
          statusText: response.statusText,
          data: await response.json()
        };
      },
      post: async (url: string, data: any, config?: any) => {
        const headers = new Headers();
        headers.append('Content-Type', 'application/json');
        if (config?.headers) {
          Object.entries(config.headers).forEach(([key, value]) => 
            headers.append(key, value as string)
          );
        }
        const response = await fetch(url, { 
          method: 'POST',
          headers,
          body: config?.headers?.['Content-Type'] === 'multipart/form-data' 
            ? data 
            : JSON.stringify(data)
        });
        return { 
          status: response.status, 
          statusText: response.statusText,
          data: await response.json()
        };
      }
    };
  }
})();

// API base URL - should be configured from environment variables
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

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
 * Get authorization headers for authenticated requests
 */
const getAuthHeaders = () => {
  return {
    Authorization: `Bearer ${localStorage.getItem('token')}`
  };
};

/**
 * Perform a unified search across any resource type
 * 
 * @param params Search parameters including required 'type'
 * @returns Search results in a standardized format
 */
export const search = async (params: SearchParams): Promise<any> => {
  try {
    // Add authentication headers for admin routes
    const headers = getAuthHeaders();
    
    // Use GET for simple queries
    if (!params.filter && Object.keys(params).length < 10) {
      const response = await axios.get(`${API_BASE_URL}/search`, { 
        params,
        headers
      });
      return response.data;
    }
    
    // Use POST for complex queries with filters
    const response = await axios.post(`${API_BASE_URL}/search`, params, {
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    });
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
    const response = await axios.get(`${API_BASE_URL}/search`, { 
      params: { 
        type,
        id
      },
      headers: getAuthHeaders()
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching ${type} with ID ${id}:`, error);
    throw new Error(`Failed to fetch ${type} ${id}: ${error instanceof Error ? error.message : String(error)}`);
  }
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
 * Specialized search function for datasets
 * 
 * @param params Dataset-specific search parameters
 * @returns Dataset search results
 */
export const searchDatasets = async (params: Omit<SearchParams, 'type'>): Promise<any> => {
  return search({ ...params, type: 'datasets' });
};

/**
 * Specialized search function for monitoring jobs
 * 
 * @param params Jobs-specific search parameters
 * @returns Jobs search results
 */
export const searchJobs = async (params: Omit<SearchParams, 'type'>): Promise<any> => {
  return search({ ...params, type: 'jobs' });
};

/**
 * Specialized search function for materials in admin context
 * 
 * @param params Material-specific search parameters
 * @returns Material search results with admin fields
 */
export const searchMaterials = async (params: Omit<SearchParams, 'type'>): Promise<any> => {
  return search({ ...params, type: 'materials' });
};

// Export default object with all methods
export default {
  search,
  getById,
  searchModels,
  searchDatasets,
  searchJobs,
  searchMaterials
};