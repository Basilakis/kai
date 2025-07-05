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
import { supabaseClient } from '../../../../shared/src/services/supabase/supabaseClient';
import { logger } from '../../utils/logger';
import { knowledgeBaseService } from './knowledgeBaseService';
import { entityLinkingService } from './entityLinking.service';
import { messageBrokerFactory } from '../messaging/messageBrokerFactory';

// Get broker instance
const broker = messageBrokerFactory.createBroker();

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
export interface SupabaseExternalSourceEndpoint {
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
  endpoints: Record<string, SupabaseExternalSourceEndpoint>;
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

// External source configuration interfaces for Supabase
interface ExternalSourceOAuthConfig {
  clientId?: string;
  clientSecret?: string;
  tokenUrl?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string; // ISO date string for Supabase
}

interface ExternalSourceMappings {
  idField: string;
  nameField: string;
  descriptionField?: string;
  propertiesMap?: Record<string, string>;
}

interface ExternalSourceStats {
  totalMaterials?: number;
  lastSyncDuration?: number;
  lastSyncSuccess?: boolean;
  materialsCreated?: number;
  materialsUpdated?: number;
  errors?: Array<{
    timestamp: string; // ISO date string for Supabase
    message: string;
  }>;
}

// Extended ExternalSourceConfig interface for Supabase
interface ExternalSourceRecord extends ExternalSourceConfig {
  created_at?: string;
  updated_at?: string;
}

// Helper functions for external source operations
function updateNextSync(syncInterval: number): string {
  const now = new Date();
  return new Date(now.getTime() + (syncInterval * 60 * 1000)).toISOString();
}

function recordSyncResult(
  currentStats: ExternalSourceStats,
  success: boolean,
  duration: number,
  error?: string
): { stats: ExternalSourceStats; lastSyncTimestamp: string; nextSyncTimestamp: string } {
  const updatedStats = {
    ...currentStats,
    lastSyncSuccess: success,
    lastSyncDuration: duration,
    errors: currentStats.errors || []
  };
  
  if (!success && error) {
    updatedStats.errors.push({
      timestamp: new Date().toISOString(),
      message: error
    });
  }
  
  return {
    stats: updatedStats,
    lastSyncTimestamp: new Date().toISOString(),
    nextSyncTimestamp: updateNextSync(60) // Default sync interval
  };
}

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
      const { error: updateError } = await supabaseClient.getClient()
        .from('external_sources')
        .update({
          last_sync_timestamp: now.toISOString(),
          stats: {
            last_sync_duration: Date.now() - (lastSyncDate?.getTime() || 0),
            last_sync_success: true,
            materials_created: result.itemsCreated,
            materials_updated: result.itemsUpdated
          }
        })
        .eq('id', this.config.id);

      if (updateError) {
        throw new Error(`Failed to update external source sync stats: ${updateError.message}`);
      }

      // Send sync completion event
      await broker.publish('system', 'knowledge-base-event', {
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
      await broker.publish('system', 'knowledge-base-event', {
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
    const { data: source, error: createError } = await supabaseClient.getClient()
      .from('external_sources')
      .insert(sourceData)
      .select()
      .single();

    if (createError) {
      throw new Error(`Failed to create external source: ${createError.message}`);
    }
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
    const { data: sources, error: findError } = await supabaseClient.getClient()
      .from('external_sources')
      .select('*')
      .match(filter);

    if (findError) {
      throw new Error(`Failed to fetch external sources: ${findError.message}`);
    }

    return sources || [];
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
    const { data: source, error: findError } = await supabaseClient.getClient()
      .from('external_sources')
      .select('*')
      .eq('id', id)
      .single();

    if (findError) {
      throw new Error(`Failed to find external source: ${findError.message}`);
    }
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
    const { data: source, error: updateError } = await supabaseClient.getClient()
      .from('external_sources')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update external source: ${updateError.message}`);
    }
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
    const { error: deleteError } = await supabaseClient.getClient()
      .from('external_sources')
      .delete()
      .eq('id', id);

    if (deleteError) {
      throw new Error(`Failed to delete external source: ${deleteError.message}`);
    }
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