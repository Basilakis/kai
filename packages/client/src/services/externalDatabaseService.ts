/**
 * External Database Service
 * 
 * This service provides methods for interacting with external material databases
 * through the server's REST API endpoints. It replaces mock implementations with
 * real API calls to connect to, search, and import materials from external sources.
 */

import axios, { AxiosRequestConfig } from 'axios';
import { API_BASE_URL } from '../config';

// External database type
export interface ExternalDatabase {
  id: string;
  name: string;
  description: string;
  url: string;
  apiKey?: string;
  logo?: string;
  categories: string[];
  connectedAt?: string;
  lastSyncAt?: string;
  isConnected: boolean;
  isPremium: boolean;
  materialCount: number;
  type: string;
}

// External material interface
export interface ExternalMaterial {
  id: string;
  externalId: string;
  databaseId: string;
  name: string;
  manufacturer: string;
  category: string;
  description?: string;
  imageUrl?: string;
  properties: Record<string, any>;
  dateAdded: string;
  dateUpdated: string;
  isSynced: boolean;
}

// Search results from external database
export interface ExternalSearchResults {
  materials: ExternalMaterial[];
  totalCount: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// External database search params
export interface ExternalSearchParams {
  query: string;
  category?: string;
  manufacturer?: string;
  properties?: Record<string, any>;
  page: number;
  pageSize: number;
}

// Connection result
export interface ConnectionResult {
  success: boolean;
  message?: string;
}

// Sync result
export interface SyncResult {
  success: boolean;
  itemsProcessed: number;
  itemsCreated: number;
  itemsUpdated: number;
  errors: string[];
}

// Create API client with base URL
// @ts-ignore - Suppressing error: axios.create is valid but TypeScript definitions don't recognize it properly
const apiClient = axios.create({
  baseURL: API_BASE_URL || '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add auth token to requests if available
apiClient.interceptors.request.use((config: AxiosRequestConfig) => {
  const token = localStorage.getItem('token');
  if (token) {
    // Initialize headers if it doesn't exist
    if (!config.headers) {
      config.headers = {};
    }
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * External Database Service
 */
class ExternalDatabaseService {
  /**
   * Get available external database sources
   */
  async getAvailableDatabases(): Promise<ExternalDatabase[]> {
    try {
      const response = await apiClient.get('/knowledge-base/external-sources');
      return response.data.map((source: any) => this.mapSourceToDatabase(source));
    } catch (error) {
      console.error('Failed to get available databases:', error);
      return [];
    }
  }

  /**
   * Get connected databases
   */
  async getConnectedDatabases(): Promise<ExternalDatabase[]> {
    try {
      const response = await apiClient.get('/knowledge-base/external-sources', {
        params: { enabled: true, isConnected: true }
      });
      return response.data.map((source: any) => this.mapSourceToDatabase(source));
    } catch (error) {
      console.error('Failed to get connected databases:', error);
      return [];
    }
  }

  /**
   * Connect to a database
   */
  async connectToDatabase(databaseId: string, apiKey?: string): Promise<ConnectionResult> {
    try {
      const response = await apiClient.post(`/knowledge-base/external-sources/${databaseId}/connect`, {
        apiKey
      });
      
      return {
        success: true,
        message: response.data.message || 'Successfully connected to database'
      };
    } catch (error: any) {
      console.error(`Failed to connect to database ${databaseId}:`, error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to connect to database'
      };
    }
  }

  /**
   * Disconnect from a database
   */
  async disconnectFromDatabase(databaseId: string): Promise<ConnectionResult> {
    try {
      const response = await apiClient.post(`/knowledge-base/external-sources/${databaseId}/disconnect`);
      
      return {
        success: true,
        message: response.data.message || 'Successfully disconnected from database'
      };
    } catch (error: any) {
      console.error(`Failed to disconnect from database ${databaseId}:`, error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to disconnect from database'
      };
    }
  }

  /**
   * Refresh database connection
   */
  async refreshDatabaseConnection(databaseId: string): Promise<ConnectionResult> {
    try {
      const response = await apiClient.post(`/knowledge-base/external-sources/${databaseId}/validate`);
      
      return {
        success: response.data.valid,
        message: response.data.message
      };
    } catch (error: any) {
      console.error(`Failed to refresh connection to database ${databaseId}:`, error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to refresh database connection'
      };
    }
  }

  /**
   * Search an external database
   */
  async searchExternalDatabase(
    databaseId: string,
    params: ExternalSearchParams
  ): Promise<ExternalSearchResults> {
    try {
      const response = await apiClient.post(`/knowledge-base/external-sources/${databaseId}/search`, params);
      
      return {
        materials: response.data.materials.map((material: any) => this.mapToExternalMaterial(material, databaseId)),
        totalCount: response.data.totalCount || response.data.materials.length,
        page: params.page || 1,
        pageSize: params.pageSize || 10,
        hasMore: response.data.hasMore || false
      };
    } catch (error) {
      console.error(`Failed to search database ${databaseId}:`, error);
      return {
        materials: [],
        totalCount: 0,
        page: params.page || 1,
        pageSize: params.pageSize || 10,
        hasMore: false
      };
    }
  }

  /**
   * Search all connected databases
   */
  async searchAllDatabases(
    params: ExternalSearchParams
  ): Promise<Record<string, ExternalSearchResults>> {
    try {
      const response = await apiClient.post('/knowledge-base/external-sources/search-all', params);
      
      const results: Record<string, ExternalSearchResults> = {};
      
      for (const [databaseId, result] of Object.entries(response.data)) {
        const searchResult = result as any;
        results[databaseId] = {
          materials: searchResult.materials.map((material: any) => this.mapToExternalMaterial(material, databaseId)),
          totalCount: searchResult.totalCount || searchResult.materials.length,
          page: params.page || 1,
          pageSize: params.pageSize || 10,
          hasMore: searchResult.hasMore || false
        };
      }
      
      return results;
    } catch (error) {
      console.error('Failed to search all databases:', error);
      return {};
    }
  }

  /**
   * Import a material from an external database
   */
  async importMaterial(material: ExternalMaterial): Promise<string> {
    try {
      const response = await apiClient.post('/knowledge-base/bulk/materials/import', {
        materials: [this.mapToImportMaterial(material)],
        options: {
          updateExisting: true,
          detectDuplicates: true
        }
      });
      
      if (response.data.imported > 0 || response.data.updated > 0) {
        return response.data.ids?.[0] || '';
      }
      
      throw new Error('Material import failed');
    } catch (error: any) {
      console.error(`Failed to import material ${material.name}:`, error);
      throw new Error(error.response?.data?.message || 'Failed to import material');
    }
  }

  /**
   * Import multiple materials from an external database
   */
  async importMaterials(materials: ExternalMaterial[]): Promise<string[]> {
    try {
      const response = await apiClient.post('/knowledge-base/bulk/materials/import', {
        materials: materials.map(this.mapToImportMaterial),
        options: {
          updateExisting: true,
          detectDuplicates: true
        }
      });
      
      return response.data.ids || [];
    } catch (error: any) {
      console.error(`Failed to import ${materials.length} materials:`, error);
      throw new Error(error.response?.data?.message || 'Failed to import materials');
    }
  }

  /**
   * Sync a material from an external database
   */
  async syncMaterial(materialId: string): Promise<boolean> {
    try {
      const response = await apiClient.post(`/knowledge-base/materials/${materialId}/sync`);
      return response.data.success;
    } catch (error) {
      console.error(`Failed to sync material ${materialId}:`, error);
      return false;
    }
  }

  /**
   * Sync an external database
   */
  async syncDatabase(databaseId: string, fullSync: boolean = false): Promise<SyncResult> {
    try {
      const response = await apiClient.post(`/knowledge-base/external-sources/${databaseId}/sync`, {
        fullSync
      });
      
      return {
        success: response.data.success,
        itemsProcessed: response.data.itemsProcessed || 0,
        itemsCreated: response.data.itemsCreated || 0,
        itemsUpdated: response.data.itemsUpdated || 0,
        errors: response.data.errors || []
      };
    } catch (error: any) {
      console.error(`Failed to sync database ${databaseId}:`, error);
      return {
        success: false,
        itemsProcessed: 0,
        itemsCreated: 0,
        itemsUpdated: 0,
        errors: [error.response?.data?.message || 'Failed to sync database']
      };
    }
  }

  /**
   * Get a material from an external database by ID
   */
  async getMaterialFromExternal(
    databaseId: string, 
    externalId: string
  ): Promise<ExternalMaterial | null> {
    try {
      const response = await apiClient.get(`/knowledge-base/external-sources/${databaseId}/materials/${externalId}`);
      return this.mapToExternalMaterial(response.data, databaseId);
    } catch (error) {
      console.error(`Failed to get material ${externalId} from database ${databaseId}:`, error);
      return null;
    }
  }

  /**
   * Get database by ID
   */
  async getDatabaseById(databaseId: string): Promise<ExternalDatabase | undefined> {
    try {
      const response = await apiClient.get(`/knowledge-base/external-sources/${databaseId}`);
      return this.mapSourceToDatabase(response.data);
    } catch (error) {
      console.error(`Failed to get database ${databaseId}:`, error);
      return undefined;
    }
  }

  /**
   * Map backend source to frontend database
   */
  private mapSourceToDatabase(source: any): ExternalDatabase {
    return {
      id: source.id,
      name: source.name,
      description: source.description,
      url: source.baseUrl,
      apiKey: source.apiKey,
      logo: source.customConfig?.logo || `https://via.placeholder.com/150?text=${encodeURIComponent(source.name)}`,
      categories: source.customConfig?.categories || [],
      connectedAt: source.lastSyncTimestamp,
      lastSyncAt: source.lastSyncTimestamp,
      isConnected: source.enabled,
      isPremium: source.customConfig?.isPremium || false,
      materialCount: source.stats?.totalMaterials || 0,
      type: source.type
    };
  }

  /**
   * Map backend material to frontend external material
   */
  private mapToExternalMaterial(material: any, databaseId: string): ExternalMaterial {
    return {
      id: material.id || `local-${databaseId}-${Date.now()}`,
      externalId: material.externalId || material.id,
      databaseId,
      name: material.name,
      manufacturer: material.manufacturer || material.properties?.manufacturer || '',
      category: material.category || material.properties?.category || '',
      description: material.description,
      imageUrl: material.imageUrl || material.properties?.imageUrl,
      properties: material.properties || {},
      dateAdded: material.dateAdded || material.createdAt || new Date().toISOString(),
      dateUpdated: material.dateUpdated || material.updatedAt || new Date().toISOString(),
      isSynced: material.isSynced || false
    };
  }

  /**
   * Map frontend external material to backend import format
   */
  private mapToImportMaterial(material: ExternalMaterial): any {
    return {
      externalId: material.externalId,
      externalSourceId: material.databaseId,
      name: material.name,
      description: material.description,
      properties: {
        ...material.properties,
        manufacturer: material.manufacturer,
        category: material.category,
        imageUrl: material.imageUrl
      }
    };
  }
}

export const externalDatabaseService = new ExternalDatabaseService();
export default externalDatabaseService;