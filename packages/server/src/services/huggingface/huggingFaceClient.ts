/**
 * Fully unified huggingFaceClient.ts
 * Combines HuggingFaceClient class and extension-based methods (dataset operations etc.)
 * ensuring we have a single cohesive HuggingFace integration.
 */

import { HfInference } from '@huggingface/inference';
import { HfFolder, whoAmI } from '@huggingface/hub';
import axios, { AxiosResponse, AxiosRequestConfig } from 'axios';
import { logger } from '../../utils/logger';

/**
 * Hugging Face config interface
 */
export interface HuggingFaceConfig {
  apiKey?: string;
  apiUrl?: string;
  timeout?: number;
  retries?: number;
  organizationId?: string;
}

/**
 * Basic user info
 */
export interface HuggingFaceUser {
  id: string;
  name?: string;
  email?: string;
  organizationIds?: string[];
}

/**
 * Dataset repository creation options
 */
export interface DatasetRepositoryOptions {
  name: string;
  visibility?: 'private' | 'public' | 'organization';
  description?: string;
  organization?: string;
}

/**
 * Dataset search options
 */
export interface DatasetSearchOptions {
  query?: string;
  author?: string;
  tag?: string;
  limit?: number;
  offset?: number;
}

/**
 * Dataset search result
 */
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
}

/**
 * File content type
 */
export type FileContent = string | Buffer | ArrayBuffer | { buffer: Buffer | ArrayBuffer };

/**
 * Hugging Face Client Core
 */
class HuggingFaceClientCore {
  private config: HuggingFaceConfig = {
    apiKey: process.env.HF_API_KEY,
    apiUrl: 'https://huggingface.co/api',
    timeout: 30000,
    retries: 3,
    organizationId: process.env.HF_ORGANIZATION_ID
  };

  private inferenceClient: HfInference | null = null;
  private apiKey: string | null = null;
  private initialized: boolean = false;

  constructor() {
    // If there's an API key from environment, initialize automatically
    if (this.config.apiKey) {
      this.init({ apiKey: this.config.apiKey });
    }
  }

  public init(cfg: HuggingFaceConfig): void {
    if (this.initialized) {
      logger.warn('Hugging Face client already initialized');
      return;
    }
    this.config = {
      ...this.config,
      ...cfg
    };
    this.apiKey = this.config.apiKey || HfFolder.getToken();
    if (!this.apiKey) {
      logger.warn('No Hugging Face API key provided; operations may be limited.');
    } else {
      this.inferenceClient = new HfInference(this.apiKey);
      logger.info('Hugging Face inference client initialized');
    }
    this.initialized = true;
    logger.info('Hugging Face client core initialized');
  }

  public isInitialized(): boolean {
    return this.initialized;
  }

  public getInferenceClient(): HfInference {
    if (!this.inferenceClient) {
      if (!this.apiKey) {
        throw new Error('API key required for inference client');
      }
      this.inferenceClient = new HfInference(this.apiKey);
    }
    return this.inferenceClient;
  }

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
   * Create a new dataset repository on Hugging Face
   * @param options Repository creation options
   * @returns Repository ID or null if creation failed
   */
  public async createDatasetRepository(options: DatasetRepositoryOptions): Promise<string | null> {
    try {
      if (!this.apiKey) {
        throw new Error('API key required to create dataset repository');
      }

      const repoName = options.name.toLowerCase().replace(/\s+/g, '-');
      const orgId = options.organization || this.config.organizationId;
      const repoId = orgId ? `${orgId}/${repoName}` : repoName;

      const config: AxiosRequestConfig = {
        method: 'POST',
        url: `${this.config.apiUrl}/datasets/create`,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        data: {
          name: repoName,
          organization: orgId,
          private: options.visibility !== 'public',
          description: options.description || '',
          tags: [],
          license: 'mit'
        },
        timeout: this.config.timeout
      };

      const response: AxiosResponse = await axios(config);

      if (response.status === 200) {
        logger.info(`Created Hugging Face dataset repository: ${repoId}`);
        return repoId;
      } else {
        logger.error(`Failed to create dataset repository: ${response.statusText}`);
        return null;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error(`Error creating dataset repository: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Upload a file to a Hugging Face repository
   * @param repoId Repository ID
   * @param filePath Path where the file should be stored
   * @param content File content (string, Buffer, or object)
   * @param commitMessage Commit message for the upload
   * @returns True if upload was successful
   */
  public async uploadFile(
    repoId: string,
    filePath: string,
    content: FileContent | Record<string, any>,
    commitMessage: string
  ): Promise<boolean> {
    try {
      if (!this.apiKey) {
        throw new Error('API key required to upload files');
      }

      let fileContent: FileContent;
      let contentType: string;

      if (content && typeof content === 'object' && 'buffer' in content) {
        fileContent = content;
        contentType = 'application/octet-stream';
      } else if (typeof content === 'string') {
        fileContent = content;
        contentType = 'text/plain';
      } else if (Buffer.isBuffer(content)) {
        fileContent = content;
        contentType = 'application/octet-stream';
      } else {
        fileContent = JSON.stringify(content, null, 2);
        contentType = 'application/json';
      }

      const config: AxiosRequestConfig = {
        method: 'POST',
        url: `${this.config.apiUrl}/datasets/${repoId}/upload/${filePath}`,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': contentType
        },
        data: fileContent,
        params: {
          commit_message: commitMessage
        },
        timeout: this.config.timeout
      };

      const response: AxiosResponse = await axios(config);

      if (response.status === 200) {
        logger.info(`Uploaded file to ${repoId}/${filePath}`);
        return true;
      } else {
        logger.error(`Failed to upload file: ${response.statusText}`);
        return false;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error(`Error uploading file: ${errorMessage}`);
      return false;
    }
  }

  /**
   * Download a file from a Hugging Face repository
   * @param repoId Repository ID
   * @param filePath Path to the file in the repository
   * @param revision Repository revision (branch, tag, or commit hash)
   * @returns File content as Buffer or null if download failed
   */
  public async downloadFile(
    repoId: string,
    filePath: string,
    revision: string = 'main'
  ): Promise<Buffer | null> {
    try {
      const headers: Record<string, string> = {};
      if (this.apiKey) {
        headers.Authorization = `Bearer ${this.apiKey}`;
      }

      const config: AxiosRequestConfig = {
        method: 'GET',
        url: `${this.config.apiUrl}/datasets/${repoId}/resolve/${revision}/${filePath}`,
        headers,
        responseType: 'arraybuffer',
        timeout: this.config.timeout
      };

      const response: AxiosResponse<Buffer> = await axios(config);

      if (response.status === 200) {
        return Buffer.from(response.data);
      } else {
        logger.error(`Failed to download file: ${response.statusText}`);
        return null;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error(`Error downloading file: ${errorMessage}`);
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

      const params: Record<string, string | number> = { limit, offset };
      if (query) params.search = query;
      if (author) params.author = author;
      if (tag) params.tag = tag;

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (this.apiKey) {
        headers.Authorization = `Bearer ${this.apiKey}`;
      }

      const config: AxiosRequestConfig = {
        method: 'GET',
        url: `${this.config.apiUrl}/datasets`,
        headers,
        params,
        timeout: this.config.timeout
      };

      const response: AxiosResponse = await axios(config);

      if (response.status === 200) {
        // Define the expected shape of the API response items
        interface ApiDatasetItem {
          id: string;
          name?: string;
          description?: string;
          author?: string;
          tags?: string[];
          downloads?: number;
          likes?: number;
          lastModified?: string;
        }

        const results: DatasetSearchResult = {
          datasets: (response.data || []).map((item: ApiDatasetItem) => ({
            id: item.id,
            name: item.name || item.id.split('/').pop() || '',
            description: item.description || '',
            author: item.author || '',
            tags: item.tags || [],
            downloads: item.downloads || 0,
            likes: item.likes || 0,
            lastModified: new Date(item.lastModified || Date.now())
          }))
        };
        return results;
      } else {
        logger.error(`Failed to search datasets: ${response.statusText}`);
        return { datasets: [] };
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error(`Error searching datasets: ${errorMessage}`);
      return { datasets: [] };
    }
  }

  public async datasetExists(repoId: string): Promise<boolean> {
    try {
      const headers: Record<string, string> = {};
      if (this.apiKey) {
        headers.Authorization = `Bearer ${this.apiKey}`;
      }
      const response = await axios({
        method: 'HEAD',
        url: `${this.config.apiUrl}/datasets/${repoId}`,
        headers,
        timeout: this.config.timeout
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  /**
   * Dataset info interface
   */
  export interface DatasetInfo {
    id: string;
    name?: string;
    description?: string;
    author?: string;
    tags?: string[];
    downloads?: number;
    likes?: number;
    lastModified?: string;
    private?: boolean;
    sha?: string;
    lastCommit?: string;
    [key: string]: any; // Allow for additional properties
  }

  /**
   * Get information about a dataset
   * @param repoId Repository ID
   * @returns Dataset information or null if not found
   */
  public async getDatasetInfo(repoId: string): Promise<DatasetInfo | null> {
    try {
      const headers: Record<string, string> = {};
      if (this.apiKey) {
        headers.Authorization = `Bearer ${this.apiKey}`;
      }

      const config: AxiosRequestConfig = {
        method: 'GET',
        url: `${this.config.apiUrl}/datasets/${repoId}`,
        headers,
        timeout: this.config.timeout
      };

      const response: AxiosResponse<DatasetInfo> = await axios(config);

      if (response.status === 200) {
        return response.data;
      } else {
        logger.error(`Failed to get dataset info: ${response.statusText}`);
        return null;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error(`Error getting dataset info: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Repository file information
   */
  export interface RepoFile {
    path: string;
    type: 'file' | 'directory';
    size?: number;
    lastCommit?: string;
    lastModified?: string;
    [key: string]: any; // Allow for additional properties
  }

  /**
   * List files in a repository
   * @param repoId Repository ID
   * @param repoPath Path within the repository
   * @param revision Repository revision (branch, tag, or commit hash)
   * @returns Array of file information or null if listing failed
   */
  public async listFiles(repoId: string, repoPath: string = '', revision = 'main'): Promise<RepoFile[] | null> {
    try {
      const headers: Record<string, string> = {};
      if (this.apiKey) {
        headers.Authorization = `Bearer ${this.apiKey}`;
      }

      const encodedPath = repoPath ? `/${encodeURIComponent(repoPath)}` : '';

      const config: AxiosRequestConfig = {
        method: 'GET',
        url: `${this.config.apiUrl}/datasets/${repoId}/tree/${revision}${encodedPath}`,
        headers,
        timeout: this.config.timeout
      };

      const response: AxiosResponse<RepoFile[]> = await axios(config);

      if (response.status === 200) {
        return response.data;
      } else {
        logger.error(`Failed to list files: ${response.statusText}`);
        return null;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error(`Error listing files: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Extended / Merged methods from huggingFaceClientExtension
   */

  /**
   * Dataset configuration information
   */
  export interface DatasetConfigInfo extends DatasetInfo {
    config: Record<string, any>;
  }

  /**
   * Get dataset configuration information
   * @param datasetId Dataset ID
   * @returns Dataset configuration information or null if not found
   */
  public async getDatasetConfig(datasetId: string): Promise<DatasetConfigInfo | null> {
    try {
      const datasetInfo = await this.getDatasetInfo(datasetId);
      if (!datasetInfo) return null;

      const configFiles = ['config.json', 'dataset_infos.json', 'dataset_info.json', 'metadata.json'];
      let config: Record<string, any> = {};

      for (const configFile of configFiles) {
        try {
          const fileData = await this.downloadFile(datasetId, configFile);
          if (fileData) {
            config = JSON.parse(fileData.toString('utf-8'));
            break;
          }
        } catch {
          // Continue to next config file if this one fails
          continue;
        }
      }

      return {
        ...datasetInfo,
        config: config
      };
    } catch(err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error(`Error getting dataset config: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Dataset structure information
   */
  export interface DatasetStructure {
    id: string;
    name: string;
    description: string;
    directories: string[];
    filesByDirectory: Record<string, string[]>;
    filesByType: {
      image: string[];
      text: string[];
      json: string[];
      csv: string[];
      other: string[];
    };
    config: Record<string, any> | null;
    dataSplits: Record<string, {
      count: number;
      directory: string;
      files: string[];
    }>;
    categoryDirectories: string[];
    totalFiles: number;
  }

  /**
   * Get dataset structure information
   * @param datasetId Dataset ID
   * @returns Dataset structure information or null if not found
   */
  public async getDatasetStructure(datasetId: string): Promise<DatasetStructure | null> {
    try {
      const datasetInfo = await this.getDatasetInfo(datasetId);
      if (!datasetInfo) return null;

      const files = await this.listFiles(datasetId);
      if (!files || !Array.isArray(files)) return null;

      const filesByDirectory: Record<string, string[]> = {};
      const filesByType = {
        image: [] as string[],
        text: [] as string[],
        json: [] as string[],
        csv: [] as string[],
        other: [] as string[]
      };

      const categorizeFile = (filePath: string) => {
        if (/\.(jpg|jpeg|png|gif|bmp|webp|tiff)$/i.test(filePath)) filesByType.image.push(filePath);
        else if(/\.txt$/i.test(filePath)) filesByType.text.push(filePath);
        else if(/\.json$/i.test(filePath)) filesByType.json.push(filePath);
        else if(/\.csv$/i.test(filePath)) filesByType.csv.push(filePath);
        else filesByType.other.push(filePath);
      };

      for(const file of files) {
        if (typeof file !== 'object' || !file.path) continue;
        const filePath = file.path as string;
        const directory = filePath.includes('/')? filePath.substring(0, filePath.lastIndexOf('/')): '';
        if(!filesByDirectory[directory]) filesByDirectory[directory] = [];
        filesByDirectory[directory].push(filePath);
        categorizeFile(filePath);
      }

      const configFiles = ['config.json', 'dataset_infos.json', 'dataset_info.json', 'metadata.json'];
      let config: Record<string, any> | null = null;

      for(const cfile of configFiles) {
        if(filesByType.json.includes(cfile)) {
          try {
            const fdata = await this.downloadFile(datasetId, cfile);
            if (fdata) {
              config = JSON.parse(fdata.toString('utf-8'));
              break;
            }
          } catch {
            // Continue to next config file if this one fails
          }
        }
      }

      const dataSplits: Record<string, { count: number; directory: string; files: string[] }> = {};
      const splitDirectories = ['train', 'validation', 'test', 'val', 'dev'];

      for(const splitDir of splitDirectories) {
        if(filesByDirectory[splitDir]) {
          dataSplits[splitDir] = {
            count: filesByDirectory[splitDir].length,
            directory: splitDir,
            files: filesByDirectory[splitDir]
          };
        }
      }

      const categoryDirectories: string[] = [];

      for(const directory in filesByDirectory) {
        if(splitDirectories.includes(directory) || directory === ''
           || ['config', 'metadata', 'utils', 'scripts'].includes(directory)) continue;

        const directoryFiles = filesByDirectory[directory];
        if(!directoryFiles || directoryFiles.length === 0) continue;

        const imageCount = directoryFiles.filter(f => /\.(jpg|jpeg|png|gif|bmp|webp|tiff)$/i.test(f)).length;
        if(imageCount > 0 && imageCount / directoryFiles.length > 0.5) {
          categoryDirectories.push(directory);
        }
      }

      return {
        id: datasetId,
        name: datasetInfo.name || datasetId.split('/').pop() || datasetId,
        description: datasetInfo.description || '',
        directories: Object.keys(filesByDirectory),
        filesByDirectory,
        filesByType,
        config,
        dataSplits,
        categoryDirectories,
        totalFiles: files.length
      };
    } catch(err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error(`Error getting dataset structure: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Dataset sample information
   */
  export interface DatasetSample {
    path: string;
    image_path: string | null;
    text_path: string | null;
    category: string;
    index: number;
    metadata: {
      source: string;
      directory: string;
      filename: string;
    };
  }

  /**
   * Get dataset samples
   * @param datasetId Dataset ID
   * @param filters Filters to apply (category, type)
   * @param limit Maximum number of samples to return
   * @returns Array of dataset samples or null if not found
   */
  public async getDatasetSamples(
    datasetId: string,
    filters: Record<string, any> = {},
    limit = 100
  ): Promise<DatasetSample[] | null> {
    try {
      const datasetInfo = await this.getDatasetInfo(datasetId);
      if (!datasetInfo) return null;

      const structure = await this.getDatasetStructure(datasetId);
      if (!structure) return null;

      const category = filters.category || '';
      const allFiles: string[] = [];

      if (category && structure.filesByDirectory[category]) {
        allFiles.push(...structure.filesByDirectory[category]);
      } else {
        for (const dir in structure.filesByDirectory) {
          if (category && !dir.includes(category)) continue;
          allFiles.push(...structure.filesByDirectory[dir]);
        }
      }

      let samplesFiles = allFiles;

      if (filters.type === 'image' || !filters.type) {
        samplesFiles = allFiles.filter(f => /\.(jpg|jpeg|png|gif|bmp|webp|tiff)$/i.test(f));
      } else if (filters.type === 'text') {
        samplesFiles = allFiles.filter(f => /\.(txt|json|md|csv)$/i.test(f));
      }

      samplesFiles = samplesFiles.slice(0, limit);

      const samples: DatasetSample[] = samplesFiles.map((fpath, index) => {
        const fileDir = fpath.includes('/') ? fpath.substring(0, fpath.lastIndexOf('/')) : '';
        const fileName = fpath.split('/').pop() || fpath;
        const fileCategory = fileDir !== '' ? fileDir.split('/')[0] : '';

        return {
          path: fpath,
          image_path: /\.(jpg|jpeg|png|gif|bmp|webp|tiff)$/i.test(fpath) ? fpath : null,
          text_path: /\.(txt|json|md|csv)$/i.test(fpath) ? fpath : null,
          category: fileCategory || category || '',
          index,
          metadata: {
            source: datasetId,
            directory: fileDir,
            filename: fileName
          }
        };
      });

      return samples;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error(`Error getting dataset samples: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Get an image from a dataset
   * @param datasetId Dataset ID
   * @param imagePath Path to the image in the dataset
   * @returns Image buffer or null if not found
   */
  public async getDatasetSampleImage(datasetId: string, imagePath: string): Promise<Buffer | null> {
    try {
      // First try to download directly using our API
      try {
        const imageData = await this.downloadFile(datasetId, imagePath);
        if (imageData) return imageData;
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        logger.warn(`Could not download directly, fallback: ${errorMessage}`);
      }

      // Try different branches on Hugging Face
      const branches = ['main', 'master', 'datasets'];
      for (const branch of branches) {
        try {
          const publicUrl = `https://huggingface.co/datasets/${datasetId}/resolve/${branch}/${imagePath}`;

          const config: AxiosRequestConfig = {
            responseType: 'arraybuffer',
            timeout: 10000,
            validateStatus: (s) => s === 200
          };

          const response: AxiosResponse<ArrayBuffer> = await axios.get(publicUrl, config);

          if (response.status === 200 && response.data) {
            return Buffer.from(response.data);
          }
        } catch {
          // Continue to next branch if this one fails
        }
      }

      // Try GitHub as a fallback
      try {
        const repoName = datasetId.includes('/') ? datasetId.split('/')[1] : datasetId;
        const owner = datasetId.includes('/') ? datasetId.split('/')[0] : '';

        if (owner) {
          const githubUrl = `https://raw.githubusercontent.com/${owner}/${repoName}/main/${imagePath}`;

          const config: AxiosRequestConfig = {
            responseType: 'arraybuffer',
            timeout: 10000,
            validateStatus: (s) => s === 200
          };

          const response: AxiosResponse<ArrayBuffer> = await axios.get(githubUrl, config);

          if (response.status === 200 && response.data) {
            return Buffer.from(response.data);
          }
        }
      } catch {
        // Continue to fallback if GitHub fails
      }

      // Return a placeholder image as last resort
      logger.warn(`Placeholder for ${imagePath} in dataset ${datasetId}.`);
      return Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
        'base64'
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error(`Error getting dataset sample image: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Dataset split information
   */
  export interface DatasetSplit {
    name: string;
    directory: string | null;
    num_rows: number;
    features: Record<string, {
      type: string;
      count: number;
    }>;
    files: string[];
    config: Record<string, any> | null;
  }

  /**
   * Get information about a dataset split
   * @param datasetId Dataset ID
   * @param splitName Split name (e.g., 'train', 'validation', 'test')
   * @returns Split information or null if not found
   */
  public async getDatasetSplit(datasetId: string, splitName: string): Promise<DatasetSplit | null> {
    try {
      const structure = await this.getDatasetStructure(datasetId);
      if (!structure) return null;

      // Check if the split is already defined in the dataset structure
      if (structure.dataSplits && structure.dataSplits[splitName]) {
        return structure.dataSplits[splitName];
      }

      // Look for a directory that matches the split name
      const splitDir = structure.directories.find((dir: string) =>
        dir === splitName || dir.endsWith(`/${splitName}`)
      );

      if (splitDir) {
        const filesInSplit = structure.filesByDirectory[splitDir] || [];
        const imageFiles = filesInSplit.filter((f: string) => /\.(jpg|jpeg|png|gif|bmp|webp|tiff)$/i.test(f));
        const textFiles = filesInSplit.filter((f: string) => /\.(txt|json|csv|md)$/i.test(f));

        const features: Record<string, { type: string; count: number }> = {};

        if (imageFiles.length > 0) {
          features.image = { type: 'image', count: imageFiles.length };
        }

        if (textFiles.length > 0) {
          features.text = { type: 'text', count: textFiles.length };
        }

        let splitConfig: Record<string, any> | null = null;
        const configFiles = [`${splitName}_config.json`, `config_${splitName}.json`, `${splitName}.json`];

        for (const configFile of configFiles) {
          try {
            if (filesInSplit.includes(configFile) ||
                (structure.filesByDirectory[''] && structure.filesByDirectory[''].includes(configFile))) {
              const cdata = await this.downloadFile(datasetId, configFile);
              if (cdata) {
                splitConfig = JSON.parse(cdata.toString('utf-8'));
                break;
              }
            }
          } catch {
            // Continue to next config file if this one fails
          }
        }

        return {
          name: splitName,
          directory: splitDir,
          num_rows: Math.max(imageFiles.length, textFiles.length),
          features,
          files: filesInSplit,
          config: splitConfig
        };
      }

      // Look for files that might belong to this split
      const splitFiles = (Object.values(structure.filesByDirectory).flat() as string[])
        .filter((f: string) => f.includes(`/${splitName}/`) || f.includes(`_${splitName}.`));

      if (splitFiles.length > 0) {
        return {
          name: splitName,
          directory: null,
          num_rows: splitFiles.length,
          features: {
            data: { type: 'unknown', count: splitFiles.length }
          },
          files: splitFiles,
          config: null
        };
      }

      return null;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error(`Error getting dataset split ${splitName}: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Dataset row information
   */
  export interface DatasetRow {
    index: number;
    path: string;
    split: string;
    image?: string;
    text?: string;
    data?: Record<string, any>;
    metadata: {
      path: string;
      directory: string;
      filename: string;
    };
  }

  /**
   * Get a row from a dataset split
   * @param datasetId Dataset ID
   * @param splitName Split name
   * @param rowIndex Row index
   * @returns Row information or null if not found
   */
  public async getDatasetRow(datasetId: string, splitName: string, rowIndex: number): Promise<DatasetRow | null> {
    try {
      const splitInfo = await this.getDatasetSplit(datasetId, splitName);
      if (!splitInfo || !splitInfo.files || rowIndex >= splitInfo.num_rows) return null;

      const files = splitInfo.files;
      if (rowIndex >= files.length) return null;

      const filePath = files[rowIndex];
      if (!filePath) return null;

      const isImage = /\.(jpg|jpeg|png|gif|bmp|webp|tiff)$/i.test(filePath);
      const isJson = /\.json$/i.test(filePath);
      const isCsv = /\.csv$/i.test(filePath);
      const isText = /\.txt$/i.test(filePath);

      const rowData: DatasetRow = {
        index: rowIndex,
        path: filePath,
        split: splitName,
        metadata: {
          path: filePath,
          directory: filePath.includes('/') ? filePath.substring(0, filePath.lastIndexOf('/')) : '',
          filename: filePath.split('/').pop() || filePath
        }
      };

      if (isImage) rowData.image = filePath;

      if (isJson) {
        try {
          const fileContent = await this.downloadFile(datasetId, filePath);
          if (fileContent) {
            const jData = JSON.parse(fileContent.toString('utf-8'));
            rowData.data = jData;
          }
        } catch (e) {
          const errorMessage = e instanceof Error ? e.message : String(e);
          logger.warn(`Failed to parse JSON data from ${filePath}: ${errorMessage}`);
        }
      }

      if (isCsv) {
        try {
          const fileContent = await this.downloadFile(datasetId, filePath);
          if (fileContent) {
            const csvContent = fileContent.toString('utf-8');
            const lines = csvContent.split('\n').slice(0, 10);

            if (lines.length > 0) {
              const headers = lines[0].split(',').map((h: string) => h.trim());

              if (lines.length > 1) {
                const values = lines[1].split(',').map((v: string) => v.trim());
                const rowObj: Record<string, string> = {};

                headers.forEach((header: string, i: number) => {
                  if (i < values.length) rowObj[header] = values[i];
                });

                rowData.data = rowObj;
              } else {
                rowData.data = { headers };
              }
            }
          }
        } catch (e) {
          const errorMessage = e instanceof Error ? e.message : String(e);
          logger.warn(`Failed to parse CSV data from ${filePath}: ${errorMessage}`);
        }
      }

      if (isText) {
        try {
          const fileContent = await this.downloadFile(datasetId, filePath);
          if (fileContent) {
            rowData.text = fileContent.toString('utf-8');
          }
        } catch (e) {
          const errorMessage = e instanceof Error ? e.message : String(e);
          logger.warn(`Failed to get text from ${filePath}: ${errorMessage}`);
        }
      }

      return rowData;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error(`Error getting dataset row ${rowIndex} from ${splitName}: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Download a field from a dataset row
   * @param datasetId Dataset ID
   * @param splitName Split name
   * @param rowIndex Row index
   * @param field Field to download (default: 'image')
   * @returns Field content as Buffer or null if not found
   */
  public async downloadRow(datasetId: string, splitName: string, rowIndex: number, field = 'image'): Promise<Buffer | null> {
    try {
      const rowData = await this.getDatasetRow(datasetId, splitName, rowIndex);
      if (!rowData) return null;

      // Handle image field specially
      if (field === 'image' && rowData.image) {
        return this.getDatasetSampleImage(datasetId, rowData.image);
      }

      // Handle other fields
      if (field in rowData) {
        const fieldValue = rowData[field as keyof DatasetRow];

        // If the field value is a string that looks like a path, try to download it
        if (typeof fieldValue === 'string' && (fieldValue.includes('/') || fieldValue.includes('.'))) {
          const fData = await this.downloadFile(datasetId, fieldValue);
          if (fData) {
            return fData;
          }
        }

        // Otherwise, return the JSON representation of the field
        return Buffer.from(JSON.stringify(fieldValue, null, 2));
      }

      return null;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error(`Error downloading field ${field} from row ${rowIndex} in ${splitName}: ${errorMessage}`);
      return null;
    }
  }
}

export const huggingFaceClient = new HuggingFaceClientCore();
export default huggingFaceClient;