/**
 * Hugging Face Client Service
 * 
 * This service provides a centralized client for interacting with Hugging Face APIs.
 * It handles authentication, request formatting, and common operations.
 */

import { HfInference } from '@huggingface/inference';
import { HfFolder, whoAmI } from '@huggingface/hub';
import { logger } from '../../utils/logger';
import axios from 'axios';

// Default configuration
const DEFAULT_CONFIG = {
  apiUrl: 'https://huggingface.co/api',
  timeout: 30000, // 30 seconds
  retries: 3
};

// Types for the client
export interface HuggingFaceConfig {
  apiKey?: string;
  apiUrl?: string;
  timeout?: number;
  retries?: number;
  organizationId?: string;
}

export interface HuggingFaceUser {
  id: string;
  name?: string;
  email?: string;
  organizationIds?: string[];
}

export type DatasetVisibility = 'private' | 'organization' | 'public';

export interface DatasetCreationOptions {
  name: string;
  visibility?: DatasetVisibility;
  description?: string;
  tags?: string[];
  license?: string;
  organizationId?: string;
}

export interface DatasetSearchOptions {
  query?: string;
  author?: string;
  tag?: string;
  limit?: number;
  offset?: number;
}

export interface DatasetSearchResult {
  datasets: Array<{
    id: string;
    name: string;
    description?: string;
    author: string;
    tags: string[];
    downloads: number;
    likes: number;
    lastModified: Date;
  }>;
  total: number;
}

/**
 * Hugging Face Client Service
 * 
 * Provides methods for interacting with Hugging Face APIs
 */
class HuggingFaceClient {
  private config: HuggingFaceConfig;
  private inferenceClient: HfInference | null = null;
  private apiKey: string | null = null;
  private initialized: boolean = false;

  constructor() {
    this.config = {
      apiKey: process.env.HF_API_KEY,
      apiUrl: DEFAULT_CONFIG.apiUrl,
      timeout: DEFAULT_CONFIG.timeout,
      retries: DEFAULT_CONFIG.retries,
      organizationId: process.env.HF_ORGANIZATION_ID
    };
    
    if (this.config.apiKey) {
      this.init(this.config);
    }
  }

  /**
   * Initialize the client with configuration
   * @param config Client configuration
   */
  public init(config: HuggingFaceConfig): void {
    if (this.initialized) {
      logger.warn('Hugging Face client already initialized');
      return;
    }

    this.config = {
      ...this.config,
      ...config
    };

    this.apiKey = this.config.apiKey || HfFolder.getToken();
    
    if (!this.apiKey) {
      logger.warn('No Hugging Face API key provided. Some operations will be limited.');
    } else {
      // Initialize the inference client
      this.inferenceClient = new HfInference(this.apiKey);
      logger.info('Hugging Face inference client initialized');
    }

    this.initialized = true;
    logger.info('Hugging Face client initialized');
  }

  /**
   * Check if the client is initialized
   * @returns True if initialized
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get the current user information
   * @returns User information or null if not authenticated
   */
  public async getCurrentUser(): Promise<HuggingFaceUser | null> {
    try {
      if (!this.apiKey) {
        return null;
      }

      const userInfo = await whoAmI({ token: this.apiKey });
      
      if (!userInfo || !userInfo.name) {
        return null;
      }

      return {
        id: userInfo.name,
        name: userInfo.fullname || userInfo.name,
        email: userInfo.email,
        organizationIds: userInfo.orgs
      };
    } catch (err) {
      logger.error(`Failed to get user info: ${err}`);
      return null;
    }
  }

  /**
   * Create a new dataset repository
   * @param options Dataset creation options
   * @returns Repository ID if successful, null otherwise
   */
  public async createDatasetRepository(options: DatasetCreationOptions): Promise<string | null> {
    try {
      if (!this.apiKey) {
        throw new Error('API key required to create dataset repository');
      }

      // Normalize repository name (lowercase, replace spaces with hyphens)
      const repoName = options.name.toLowerCase().replace(/\s+/g, '-');
      
      // Determine the full repo ID (with organization if provided)
      const orgId = options.organizationId || this.config.organizationId;
      const repoId = orgId ? `${orgId}/${repoName}` : repoName;

      // Create repository
      const response = await axios({
        method: 'POST',
        url: `${this.config.apiUrl}/datasets/create`,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        data: {
          name: repoName,
          organization: orgId,
          private: options.visibility !== 'public',
          description: options.description || '',
          tags: options.tags || [],
          license: options.license || 'mit'
        },
        timeout: this.config.timeout
      });

      if (response.status === 200) {
        logger.info(`Created Hugging Face dataset repository: ${repoId}`);
        return repoId;
      } else {
        logger.error(`Failed to create dataset repository: ${response.statusText}`);
        return null;
      }
    } catch (err) {
      logger.error(`Error creating dataset repository: ${err}`);
      return null;
    }
  }

  /**
   * Upload a file to a dataset repository
   * @param repoId Repository ID
   * @param filePath Path within the repository
   * @param content File content (Buffer, string, or object to be JSON stringified)
   * @param commitMessage Commit message
   * @returns True if successful
   */
  public async uploadFile(
    repoId: string,
    filePath: string,
    content: any, // Using any to avoid Buffer type issues
    commitMessage: string = 'Add file'
  ): Promise<boolean> {
    try {
      if (!this.apiKey) {
        throw new Error('API key required to upload files');
      }

      // Prepare content
      let fileContent: any;
      let contentType: string;

      // Check if content is Buffer-like
      if (content && typeof content === 'object' && 'buffer' in content) {
        // Handle Buffer-like content
        fileContent = content;
        contentType = 'application/octet-stream';
      } else if (typeof content === 'string') {
        fileContent = content;
        contentType = 'text/plain';
      } else {
        fileContent = JSON.stringify(content, null, 2);
        contentType = 'application/json';
      }

      // Upload file
      const response = await axios({
        method: 'POST',
        url: `${this.config.apiUrl}/datasets/${repoId}/upload/${filePath}`,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': contentType
        },
        data: fileContent,
        params: {
          commit_message: commitMessage
        },
        timeout: this.config.timeout
      });

      if (response.status === 200) {
        logger.info(`Uploaded file to ${repoId}/${filePath}`);
        return true;
      } else {
        logger.error(`Failed to upload file: ${response.statusText}`);
        return false;
      }
    } catch (err) {
      logger.error(`Error uploading file: ${err}`);
      return false;
    }
  }

  /**
   * Download a file from a dataset repository
   * @param repoId Repository ID
   * @param filePath Path within the repository
   * @param revision Git revision (branch, tag, commit)
   * @returns File content or null if not found
   */
  public async downloadFile(
    repoId: string,
    filePath: string,
    revision: string = 'main'
  ): Promise<any> { // Using any to avoid Buffer type issues
    try {
      // For downloading, we don't require API key for public datasets
      const headers: Record<string, string> = {};
      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const response = await axios({
        method: 'GET',
        url: `${this.config.apiUrl}/datasets/${repoId}/resolve/${revision}/${filePath}`,
        headers,
        responseType: 'arraybuffer',
        timeout: this.config.timeout
      });

      if (response.status === 200) {
        // Return the response data directly
        return response.data;
      } else {
        logger.error(`Failed to download file: ${response.statusText}`);
        return null;
      }
    } catch (err) {
      logger.error(`Error downloading file: ${err}`);
      return null;
    }
  }

  /**
   * Search for datasets on Hugging Face
   * @param options Search options
   * @returns Search results
   */
  public async searchDatasets(options: DatasetSearchOptions = {}): Promise<DatasetSearchResult> {
    try {
      const {
        query = '',
        author = '',
        tag = '',
        limit = 10,
        offset = 0
      } = options;

      // Build query params
      const params: Record<string, string | number> = {
        limit,
        offset
      };

      if (query) params.search = query;
      if (author) params.author = author;
      if (tag) params.tag = tag;

      // Headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      
      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      // Search datasets
      const response = await axios({
        method: 'GET',
        url: `${this.config.apiUrl}/datasets`,
        headers,
        params,
        timeout: this.config.timeout
      });

      if (response.status === 200) {
        // Transform response to our format
        const result: DatasetSearchResult = {
          datasets: (response.data || []).map((item: any) => ({
            id: item.id,
            name: item.name || item.id.split('/').pop(),
            description: item.description || '',
            author: item.author || '',
            tags: item.tags || [],
            downloads: item.downloads || 0,
            likes: item.likes || 0,
            lastModified: new Date(item.lastModified || Date.now())
          })),
          total: response.headers['x-total-count'] ? parseInt(response.headers['x-total-count'], 10) : 0
        };

        return result;
      } else {
        logger.error(`Failed to search datasets: ${response.statusText}`);
        return { datasets: [], total: 0 };
      }
    } catch (err) {
      logger.error(`Error searching datasets: ${err}`);
      return { datasets: [], total: 0 };
    }
  }

  /**
   * Check if a dataset repository exists
   * @param repoId Repository ID
   * @returns True if exists
   */
  public async datasetExists(repoId: string): Promise<boolean> {
    try {
      const headers: Record<string, string> = {};
      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const response = await axios({
        method: 'HEAD',
        url: `${this.config.apiUrl}/datasets/${repoId}`,
        headers,
        timeout: this.config.timeout
      });

      return response.status === 200;
    } catch (err) {
      return false;
    }
  }

  /**
   * Get dataset repository information
   * @param repoId Repository ID
   * @returns Repository information or null if not found
   */
  public async getDatasetInfo(repoId: string): Promise<any | null> {
    try {
      const headers: Record<string, string> = {};
      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const response = await axios({
        method: 'GET',
        url: `${this.config.apiUrl}/datasets/${repoId}`,
        headers,
        timeout: this.config.timeout
      });

      if (response.status === 200) {
        return response.data;
      } else {
        logger.error(`Failed to get dataset info: ${response.statusText}`);
        return null;
      }
    } catch (err) {
      logger.error(`Error getting dataset info: ${err}`);
      return null;
    }
  }

  /**
   * List files in a dataset repository
   * @param repoId Repository ID
   * @param path Path within the repository
   * @param revision Git revision (branch, tag, commit)
   * @returns List of files or null if not found
   */
  public async listFiles(
    repoId: string,
    path: string = '',
    revision: string = 'main'
  ): Promise<any[] | null> {
    try {
      const headers: Record<string, string> = {};
      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const encodedPath = path ? `/${encodeURIComponent(path)}` : '';
      const response = await axios({
        method: 'GET',
        url: `${this.config.apiUrl}/datasets/${repoId}/tree/${revision}${encodedPath}`,
        headers,
        timeout: this.config.timeout
      });

      if (response.status === 200) {
        return response.data;
      } else {
        logger.error(`Failed to list files: ${response.statusText}`);
        return null;
      }
    } catch (err) {
      logger.error(`Error listing files: ${err}`);
      return null;
    }
  }

  /**
   * Get the inference client instance
   * @returns Inference client
   */
  public getInferenceClient(): HfInference {
    if (!this.inferenceClient) {
      if (!this.apiKey) {
        throw new Error('API key required for inference client');
      }
      this.inferenceClient = new HfInference(this.apiKey);
    }
    return this.inferenceClient;
  }
}

// Export a singleton instance
export const huggingFaceClient = new HuggingFaceClient();
export default huggingFaceClient;