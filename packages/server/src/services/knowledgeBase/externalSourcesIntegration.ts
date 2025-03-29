/**
 * External Sources Integration
 * 
 * Provides integration with external material databases and sources.
 * Implements a clean adapter pattern for different source types with
 * standardized data mapping and synchronization capabilities.
 * Supports dynamic source configuration through admin panel.
 */

import { v4 as uuidv4 } from 'uuid';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import mongoose from 'mongoose';
import { logger } from '../../utils/logger';
import { knowledgeBaseService } from './knowledgeBaseService';
import { entityLinkingService } from './entityLinking.service';
import { messageBroker } from '../messaging/messageBroker';

// Cache implementation
class Cache {
  private store = new Map<string, { data: any; expiresAt: number }>();
  private maxSize: number;
  private ttl: number;

  constructor(maxSize = 1000, ttlMs = 15 * 60 * 1000) {
    this.maxSize = maxSize;
    this.ttl = ttlMs;
  }

  set(key: string, value: any): void {
    if (this.store.size >= this.maxSize) {
      const oldestKey = Array.from(this.store.keys())[0];
      if (oldestKey) this.store.delete(oldestKey);
    }
    this.store.set(key, {
      data: value,
      expiresAt: Date.now() + this.ttl
    });
  }

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.data as T;
  }

  clear(): void {
    this.store.clear();
  }
}

// Global cache instance
const cache = new Cache();

// External source endpoint configuration
export interface ExternalSourceEndpoint {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  description: string;
  parameters?: Record<string, {
    type: string;
    required: boolean;
    description: string;
  }>;
}

// External source configuration
export interface ExternalSourceConfig {
  id: string;
  name: string;
  type: string;
  baseUrl: string;
  description: string;
  authType: 'basic' | 'oauth2' | 'api_key' | 'api_key_secret' | 'bearer' | 'custom';
  endpoints: Record<string, ExternalSourceEndpoint>;
  defaultSyncInterval: number;
  defaultBatchSize: number;
  enabled: boolean;
  syncInterval: number;
  lastSyncTimestamp?: Date;
  nextSyncTimestamp?: Date;
  apiKey?: string;
  apiSecret?: string;
  oauthConfig?: {
    clientId: string;
    clientSecret: string;
    tokenUrl: string;
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
  };
  mappings: {
    idField: string;
    nameField: string;
    descriptionField?: string;
    propertiesMap: Record<string, string>;
  };
  headers?: Record<string, string>;
  customConfig?: Record<string, any>;
}

// Source configuration schema
const externalSourceSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    default: () => uuidv4()
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  authType: {
    type: String,
    required: true,
    enum: ['basic', 'oauth2', 'api_key', 'api_key_secret', 'bearer', 'custom']
  },
  endpoints: {
    type: Map,
    of: new mongoose.Schema({
      path: String,
      method: {
        type: String,
        enum: ['GET', 'POST', 'PUT', 'DELETE']
      },
      description: String,
      parameters: {
        type: Map,
        of: new mongoose.Schema({
          type: String,
          required: Boolean,
          description: String
        })
      }
    }),
    required: true
  },
  defaultSyncInterval: {
    type: Number,
    required: true,
    default: 60
  },
  defaultBatchSize: {
    type: Number,
    required: true,
    default: 100
  },
  baseUrl: {
    type: String,
    required: true
  },
  enabled: {
    type: Boolean,
    default: true
  },
  syncInterval: {
    type: Number,
    required: true
  },
  lastSyncTimestamp: Date,
  nextSyncTimestamp: Date,
  apiKey: String,
  apiSecret: String,
  oauthConfig: {
    clientId: String,
    clientSecret: String,
    tokenUrl: String,
    accessToken: String,
    refreshToken: String,
    expiresAt: Date
  },
  mappings: {
    idField: {
      type: String,
      required: true
    },
    nameField: {
      type: String,
      required: true
    },
    descriptionField: String,
    propertiesMap: {
      type: Map,
      of: String,
      default: {}
    }
  },
  headers: {
    type: Map,
    of: String
  },
  customConfig: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  stats: {
    totalMaterials: {
      type: Number,
      default: 0
    },
    lastSyncDuration: Number,
    lastSyncSuccess: Boolean,
    materialsCreated: {
      type: Number,
      default: 0
    },
    materialsUpdated: {
      type: Number,
      default: 0
    },
    errors: [{
      timestamp: Date,
      message: String
    }]
  }
}, {
  timestamps: true,
  strict: false // Allow additional fields for custom sources
});

// Add indexes
externalSourceSchema.index({ type: 1 });
externalSourceSchema.index({ enabled: 1 });
externalSourceSchema.index({ nextSyncTimestamp: 1 });

// Add methods
externalSourceSchema.methods.updateNextSync = function() {
  const now = new Date();
  this.nextSyncTimestamp = new Date(now.getTime() + (this.syncInterval * 60 * 1000));
};

externalSourceSchema.methods.recordSyncResult = function(success: boolean, duration: number, error?: string) {
  this.stats.lastSyncSuccess = success;
  this.stats.lastSyncDuration = duration;
  
  if (!success && error) {
    this.stats.errors.push({
      timestamp: new Date(),
      message: error
    });
  }
  
  this.lastSyncTimestamp = new Date();
  this.updateNextSync();
};

// Create model
const ExternalSource = mongoose.model<mongoose.Document & ExternalSourceConfig>('ExternalSource', externalSourceSchema);

/**
 * Interface for external source adapters
 */
export interface IExternalSourceAdapter {
  validateConnection(): Promise<boolean>;
  search(query: Record<string, any>): Promise<any[]>;
  getById(id: string): Promise<any>;
  getAll(params?: Record<string, any>): Promise<any[]>;
  sync(fullSync?: boolean): Promise<{
    success: boolean;
    itemsProcessed: number;
    itemsCreated: number;
    itemsUpdated: number;
    errors: string[];
  }>;
}

/**
 * Base adapter implementation
 */
export class ExternalSourceAdapter implements IExternalSourceAdapter {
  protected config: ExternalSourceConfig;
  protected client: AxiosInstance;

  constructor(config: ExternalSourceConfig) {
    this.config = config;
    this.client = this.createHttpClient();
  }

  protected createHttpClient(): AxiosInstance {
    const config: AxiosRequestConfig = {
      baseURL: this.config.baseUrl,
      headers: { ...this.config.headers }
    };

    if (this.config.authType === 'basic' && this.config.customConfig?.credentials) {
      const { username, password } = this.config.customConfig.credentials;
      (config as any).auth = { username, password };
    } else if (this.config.authType === 'oauth2' && this.config.oauthConfig?.accessToken) {
      config.headers!.Authorization = `Bearer ${this.config.oauthConfig.accessToken}`;
    } else if (this.config.authType === 'api_key' && this.config.apiKey) {
      config.headers!['X-API-Key'] = this.config.apiKey;
    } else if (this.config.authType === 'api_key_secret' && this.config.apiSecret) {
      config.headers!['X-API-Secret'] = this.config.apiSecret;
    }

    return axios.create(config);
  }

  protected async getData<T>(
    endpoint: string,
    params: Record<string, any> = {},
    useCache = true
  ): Promise<T> {
    const cacheKey = `${this.config.id}:${endpoint}:${JSON.stringify(params)}`;
    
    if (useCache) {
      const cached = cache.get<T>(cacheKey);
      if (cached) return cached;
    }

    const response = await this.client.get<T>(endpoint, { params });
    
    if (useCache) {
      cache.set(cacheKey, response.data);
    }

    return response.data;
  }

  protected mapData(data: any): Record<string, any> {
    const result: Record<string, any> = {
      externalId: this.getNestedValue(data, this.config.mappings.idField),
      name: this.getNestedValue(data, this.config.mappings.nameField)
    };

    if (this.config.mappings.descriptionField) {
      result.description = this.getNestedValue(data, this.config.mappings.descriptionField);
    }

    const properties: Record<string, any> = {};
    for (const [key, path] of Object.entries(this.config.mappings.propertiesMap)) {
      properties[key] = this.getNestedValue(data, path);
    }
    result.properties = properties;

    return result;
  }

  protected getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((prev, curr) => prev?.[curr], obj);
  }

  public async validateConnection(): Promise<boolean> {
    try {
      const endpoint = this.config.endpoints.status?.path || '/status';
      await this.client.get(endpoint);
      return true;
    } catch {
      return false;
    }
  }

  public async search(query: Record<string, any>): Promise<any[]> {
    if (!this.config.endpoints.search?.path) {
      throw new Error(`Search endpoint not configured for source: ${this.config.id}`);
    }
    const endpoint = this.config.endpoints.search.path;
    const data = await this.getData<any[]>(endpoint, query);
    return data.map(item => this.mapData(item));
  }

  public async getById(id: string): Promise<any> {
    if (!this.config.endpoints.material?.path) {
      throw new Error(`Material endpoint not configured for source: ${this.config.id}`);
    }
    const endpoint = this.config.endpoints.material.path.replace('{id}', id);
    const data = await this.getData<any>(endpoint);
    return this.mapData(data);
  }

  public async getAll(params: Record<string, any> = {}): Promise<any[]> {
    const endpoint = this.config.endpoints.list?.path || this.config.endpoints.materials?.path || '/materials';
    const data = await this.getData<any[]>(endpoint, params);
    return data.map(item => this.mapData(item));
  }

  public async sync(fullSync = false): Promise<{
    success: boolean;
    itemsProcessed: number;
    itemsCreated: number;
    itemsUpdated: number;
    errors: string[];
  }> {
    const result = {
      success: true,
      itemsProcessed: 0,
      itemsCreated: 0,
      itemsUpdated: 0,
      errors: [] as string[]
    };

    try {
      const lastSyncDate = fullSync ? new Date(0) : this.config.lastSyncTimestamp;
      const materials = await this.getAll({
        updated_after: lastSyncDate?.toISOString()
      });

      for (const material of materials) {
        try {
          result.itemsProcessed++;
          
          const importedMaterial = await knowledgeBaseService.bulkImportMaterials(
            [material],
            'system',
            {
              updateExisting: true,
              detectDuplicates: true
            }
          );

          if (importedMaterial.imported > 0) {
            result.itemsCreated++;
          } else if (importedMaterial.updated > 0) {
            result.itemsUpdated++;
          }

          if (material.description) {
            await entityLinkingService.linkEntitiesInDescription(
              material.id,
              material.description,
              {
                linkMaterials: true,
                linkCollections: true,
                createRelationships: true,
                userId: 'system'
              }
            );
          }
        } catch (err) {
          const error = err instanceof Error ? err.message : String(err);
          result.errors.push(`Failed to process material: ${error}`);
        }
      }

      const now = new Date();
      await ExternalSource.updateOne(
        { id: this.config.id },
        { 
          lastSyncTimestamp: now,
          'stats.lastSyncDuration': Date.now() - (lastSyncDate?.getTime() || 0),
          'stats.lastSyncSuccess': true,
          'stats.materialsCreated': result.itemsCreated,
          'stats.materialsUpdated': result.itemsUpdated
        }
      );

      // Send sync completion event
      await messageBroker.publish('system', 'knowledge-base-event', {
        type: 'sync-completed',
        sourceId: this.config.id,
        sourceName: this.config.name,
        sourceType: this.config.type,
        timestamp: now,
        stats: {
          itemsProcessed: result.itemsProcessed,
          itemsCreated: result.itemsCreated,
          itemsUpdated: result.itemsUpdated,
          duration: Date.now() - (lastSyncDate?.getTime() || 0),
          errors: result.errors
        }
      });

      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      const errorResult = {
        ...result,
        success: false,
        errors: [...result.errors, `Sync failed: ${error}`]
      };

      // Send sync error event
      await messageBroker.publish('system', 'knowledge-base-event', {
        type: 'sync-failed',
        sourceId: this.config.id,
        sourceName: this.config.name,
        sourceType: this.config.type,
        timestamp: new Date(),
        error: error,
        stats: {
          itemsProcessed: result.itemsProcessed,
          itemsCreated: result.itemsCreated,
          itemsUpdated: result.itemsUpdated,
          errors: errorResult.errors
        }
      });

      return errorResult;
    }
  }
}

/**
 * Create a new external source
 */
export async function createExternalSource(sourceData: Partial<ExternalSourceConfig>): Promise<ExternalSourceConfig> {
  try {
    sourceData.id = sourceData.id || uuidv4();
    const source = await ExternalSource.create(sourceData);
    return source.toObject();
  } catch (err) {
    logger.error(`Failed to create external source: ${err}`);
    throw new Error(`Failed to create external source: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Get all external sources
 */
export async function getExternalSources(filter: Record<string, any> = {}): Promise<ExternalSourceConfig[]> {
  try {
    const sources = await ExternalSource.find(filter);
    return sources.map((source: mongoose.Document) => source.toObject());
  } catch (err) {
    logger.error(`Failed to get external sources: ${err}`);
    throw new Error(`Failed to get external sources: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Get external source by ID
 */
export async function getExternalSourceById(id: string): Promise<ExternalSourceConfig | null> {
  try {
    const source = await ExternalSource.findOne({ id });
    return source ? source.toObject() : null;
  } catch (err) {
    logger.error(`Failed to get external source: ${err}`);
    throw new Error(`Failed to get external source: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Update external source
 */
export async function updateExternalSource(
  id: string,
  updateData: Partial<ExternalSourceConfig>
): Promise<ExternalSourceConfig | null> {
  try {
    const source = await ExternalSource.findOneAndUpdate(
      { id },
      updateData,
      { new: true }
    );
    return source ? source.toObject() : null;
  } catch (err) {
    logger.error(`Failed to update external source: ${err}`);
    throw new Error(`Failed to update external source: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Delete external source
 */
export async function deleteExternalSource(id: string): Promise<boolean> {
  try {
    const result = await ExternalSource.deleteOne({ id });
    return result.deletedCount === 1;
  } catch (err) {
    logger.error(`Failed to delete external source: ${err}`);
    throw new Error(`Failed to delete external source: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Synchronize data from external source
 */
export async function syncExternalSource(
  sourceId: string,
  fullSync = false
): Promise<{
  success: boolean;
  itemsProcessed: number;
  itemsCreated: number;
  itemsUpdated: number;
  errors: string[];
}> {
  try {
    const source = await getExternalSourceById(sourceId);
    if (!source) {
      throw new Error(`External source not found: ${sourceId}`);
    }

    if (!source.enabled) {
      throw new Error(`External source is disabled: ${sourceId}`);
    }

    const adapter = new ExternalSourceAdapter(source);
    return await adapter.sync(fullSync);
  } catch (err) {
    logger.error(`Failed to sync external source: ${err}`);
    return {
      success: false,
      itemsProcessed: 0,
      itemsCreated: 0,
      itemsUpdated: 0,
      errors: [err instanceof Error ? err.message : String(err)]
    };
  }
}

export default {
  createExternalSource,
  getExternalSources,
  getExternalSourceById,
  updateExternalSource,
  deleteExternalSource,
  syncExternalSource
};