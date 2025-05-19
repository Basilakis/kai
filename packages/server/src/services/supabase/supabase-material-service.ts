/**
 * Supabase Material Service
 * 
 * This service provides an interface for material-related operations using Supabase.
 * It replaces the previous MongoDB-based material implementation.
 */

import { v4 as uuidv4 } from 'uuid';
import { PostgrestError } from '@supabase/supabase-js';
import { logger } from '../../utils/logger';
import { supabaseClient } from './supabaseClient';
import { hybridSearch } from './hybrid-search';

import type { 
  MaterialType, 
  MaterialMetadata, 
  SearchOptions,
  HybridSearchOptions 
} from '@kai/shared';

// Define types for Supabase data
interface SupabaseMaterialData {
  id: string;
  name: string;
  description?: string;
  manufacturer?: string;
  collection_id?: string;
  series_id?: string;
  category_id?: string;
  material_type: string;
  dimensions: any;
  color: any;
  finish: string;
  pattern?: string;
  texture?: string;
  technical_specs?: any;
  images?: any[];
  tags?: string[];
  catalog_id: string;
  catalog_page?: number;
  extracted_at: string;
  updated_at: string;
  created_by?: string;
  vector_representation?: number[];
  metadata?: any;
  metadata_confidence?: any;
  [key: string]: any;
}

// Define types for collection and indexing data
interface MaterialTypeData {
  material_type: string;
  count: number;
}

interface MaterialCollectionData {
  collection_name: string;
  count: number;
}

/**
 * Supabase Material Service
 * Manages material storage, retrieval, and search using Supabase
 */
export class SupabaseMaterialService {
  private static instance: SupabaseMaterialService;

  private constructor() {
    logger.info('Supabase Material Service initialized');
  }

  /**
   * Get the singleton instance
   * @returns The SupabaseMaterialService instance
   */
  public static getInstance(): SupabaseMaterialService {
    if (!SupabaseMaterialService.instance) {
      SupabaseMaterialService.instance = new SupabaseMaterialService();
    }
    return SupabaseMaterialService.instance;
  }

  /**
   * Create a new material
   * @param materialData Material data
   * @returns Created material
   */
  public async createMaterial(materialData: Partial<MaterialType>): Promise<MaterialType> {
    try {
      // Generate UUID if not provided
      const id = materialData.id || uuidv4();

      // Handle nested objects and arrays
      const supabaseData = this.transformMaterialForSupabase({
        ...materialData,
        id,
        extractedAt: materialData.extractedAt || new Date(),
        updatedAt: new Date()
      });

      // Insert material into Supabase
      const { data, error } = await supabaseClient
        .getClient()
        .from('materials')
        .insert(supabaseData)
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Transform back to application format
      return this.transformMaterialFromSupabase(data);
    } catch (err) {
      logger.error(`Failed to create material: ${err}`);
      throw new Error(`Failed to create material: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Get a material by ID
   * @param id Material ID
   * @returns Material document or null if not found
   */
  public async getMaterialById(id: string): Promise<MaterialType | null> {
    try {
      const { data, error } = await supabaseClient
        .getClient()
        .from('materials')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned - not found
          return null;
        }
        throw error;
      }

      if (!data) {
        return null;
      }

      return this.transformMaterialFromSupabase(data);
    } catch (err) {
      logger.error(`Failed to get material: ${err}`);
      throw new Error(`Failed to get material: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Update a material
   * @param id Material ID
   * @param updateData Update data
   * @returns Updated material document or null if not found
   */
  public async updateMaterial(id: string, updateData: Partial<MaterialType>): Promise<MaterialType | null> {
    try {
      // Version record is created by a database trigger (see supabase-schema.md)
      // await this.createMaterialVersion(id, updateData);
      
      // Transform data for Supabase
      const supabaseData = this.transformMaterialForSupabase({
        ...updateData,
        updatedAt: new Date()
      });

      // Update material in Supabase
      const { data, error } = await supabaseClient
        .getClient()
        .from('materials')
        .update(supabaseData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      if (!data) {
        return null;
      }

      return this.transformMaterialFromSupabase(data);
    } catch (err) {
      logger.error(`Failed to update material: ${err}`);
      throw new Error(`Failed to update material: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Delete a material
   * @param id Material ID
   * @returns Deleted material document or null if not found
   */
  public async deleteMaterial(id: string): Promise<MaterialType | null> {
    try {
      // Get the material before deleting
      const material = await this.getMaterialById(id);
      
      if (!material) {
        return null;
      }

      const { error } = await supabaseClient
        .getClient()
        .from('materials')
        .delete()
        .eq('id', id);

      if (error) {
        throw error;
      }

      return material;
    } catch (err) {
      logger.error(`Failed to delete material: ${err}`);
      throw new Error(`Failed to delete material: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Search for materials
   * @param options Search options
   * @returns Array of material documents and total count
   */
  public async searchMaterials(options: SearchOptions): Promise<{
    materials: MaterialType[];
    total: number;
  }> {
    try {
      const {
        query,
        materialType,
        manufacturer,
        color,
        finish,
        dimensions,
        tags,
        limit = 10,
        skip = 0,
        sort = { field: 'updated_at', direction: 'desc' }
      } = options;

      // Build query
      let supabaseQuery = supabaseClient
        .getClient()
        .from('materials')
        .select('*', { count: 'exact' });

      // Text search
      if (query) {
        supabaseQuery = supabaseQuery.textSearch('search_text', query);
      }

      // Material type filter
      if (materialType) {
        if (Array.isArray(materialType)) {
          supabaseQuery = supabaseQuery.in('material_type', materialType);
        } else {
          supabaseQuery = supabaseQuery.eq('material_type', materialType);
        }
      }

      // Manufacturer filter
      if (manufacturer) {
        if (Array.isArray(manufacturer)) {
          supabaseQuery = supabaseQuery.in('manufacturer', manufacturer);
        } else {
          supabaseQuery = supabaseQuery.eq('manufacturer', manufacturer);
        }
      }

      // Color filter
      if (color) {
        if (Array.isArray(color)) {
          // For color, we need to handle JSONB field
          const colorConditions = color.map(c => `color->>'name' ILIKE '%${c}%'`).join(' OR ');
          supabaseQuery = supabaseQuery.or(colorConditions);
        } else {
          supabaseQuery = supabaseQuery.ilike('color->>name', `%${color}%`);
        }
      }

      // Finish filter
      if (finish) {
        if (Array.isArray(finish)) {
          supabaseQuery = supabaseQuery.in('finish', finish);
        } else {
          supabaseQuery = supabaseQuery.eq('finish', finish);
        }
      }

      // Tags filter
      if (tags && tags.length > 0) {
        // Array contains all elements using PostgreSQL's @> operator
        supabaseQuery = supabaseQuery.contains('tags', tags);
      }

      // Apply sorting
      if (sort) {
        const sortDirection = sort.direction === 'desc' ? true : false;
        supabaseQuery = supabaseQuery.order(sort.field, { ascending: !sortDirection });
      }

      // Apply pagination
      supabaseQuery = supabaseQuery.range(skip, skip + limit - 1);

      // Execute query
      const { data, error, count } = await supabaseQuery;

      if (error) {
        throw error;
      }

      // Transform results
      const materials = data.map((item: SupabaseMaterialData) => this.transformMaterialFromSupabase(item));

      return {
        materials,
        total: count || materials.length
      };
    } catch (err) {
      logger.error(`Failed to search materials: ${err}`);
      throw new Error(`Failed to search materials: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Find similar materials based on vector representation
   * @param vectorOrId Material ID or vector representation
   * @param options Search options
   * @returns Array of similar materials with similarity scores
   */
  public async findSimilarMaterials(
    vectorOrId: string | number[],
    options: {
      limit?: number;
      threshold?: number;
      materialType?: string | string[];
    } = {}
  ): Promise<Array<{
    material: MaterialType;
    similarity: number;
  }>> {
    try {
      const { limit = 10, threshold = 0.7, materialType } = options;
      
      let vector: number[];
      
      // If vectorOrId is a string, get the vector representation from the database
      if (typeof vectorOrId === 'string') {
        const material = await this.getMaterialById(vectorOrId);
        if (!material || !material.vectorRepresentation || material.vectorRepresentation.length === 0) {
          throw new Error(`Material not found or has no vector representation: ${vectorOrId}`);
        }
        vector = material.vectorRepresentation;
      } else {
        vector = vectorOrId;
      }

      // Use the find_similar_materials PostgreSQL function
      const { data, error } = await supabaseClient
        .getClient()
        .rpc('find_similar_materials', {
          search_vector: vector,
          similarity_threshold: threshold,
          max_results: limit,
          material_type_filter: Array.isArray(materialType) ? materialType[0] : materialType || null
        });

      if (error) {
        throw error;
      }

      // For each result, get the full material data
      const similarMaterials = await Promise.all(
        data.map(async (result: any) => {
          const material = await this.getMaterialById(result.id);
          return {
            material: material!,
            similarity: result.similarity
          };
        })
      );

      return similarMaterials;
    } catch (err) {
      logger.error(`Failed to find similar materials: ${err}`);
      throw new Error(`Failed to find similar materials: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Perform hybrid search combining text and vector similarity
   * @param query Text search query
   * @param vectorOrId Material ID or vector embedding for similarity comparison
   * @param options Hybrid search options
   * @returns Array of materials with text, vector, and combined scores
   */
  public async hybridSearchMaterials(
    query: string,
    vectorOrId: string | number[],
    options: HybridSearchOptions = {}
  ): Promise<Array<{
    material: MaterialType;
    textScore: number;
    vectorScore: number;
    combinedScore: number;
  }>> {
    try {
      let vector: number[];
      
      // If vectorOrId is a string, get the vector representation from the database
      if (typeof vectorOrId === 'string') {
        const material = await this.getMaterialById(vectorOrId);
        if (!material || !material.vectorRepresentation || material.vectorRepresentation.length === 0) {
          throw new Error(`Material not found or has no vector representation: ${vectorOrId}`);
        }
        vector = material.vectorRepresentation;
      } else {
        vector = vectorOrId;
      }
      
      // Default options
      const mergedOptions = {
        textWeight: options.textWeight ?? 0.5,
        vectorWeight: options.vectorWeight ?? 0.5,
        limit: options.limit ?? 10,
        threshold: options.threshold ?? 0.3,
        materialType: options.materialType
      };
      
      // Prepare filters if material type is specified
      const filters: Record<string, any> = {};
      if (mergedOptions.materialType) {
        if (Array.isArray(mergedOptions.materialType)) {
          // For now, just use the first material type as a filter
          filters.material_type = mergedOptions.materialType[0];
        } else {
          filters.material_type = mergedOptions.materialType;
        }
      }
      
      // Perform hybrid search
      const results = await hybridSearch.search({
        textQuery: query,
        embedding: vector,
        textWeight: mergedOptions.textWeight,
        vectorWeight: mergedOptions.vectorWeight,
        limit: mergedOptions.limit,
        threshold: mergedOptions.threshold,
        filters
      }, 'materials');
      
      // If no results, return empty array
      if (!results || results.length === 0) {
        return [];
      }
      
      // Get full material data for each result
      const materials = await Promise.all(
        results.map(async (result: any) => {
          const material = await this.getMaterialById(result.id);
          return {
            material: material!,
            textScore: result.text_score,
            vectorScore: result.vector_score,
            combinedScore: result.combined_score
          };
        })
      );
      
      return materials;
    } catch (err) {
      logger.error(`Failed to perform hybrid search: ${err}`);
      throw new Error(`Failed to perform hybrid search: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Create a material version record
   * @param materialId Material ID
   * @param updateData Update data
   * @param userId User ID
   * @returns Version ID
   */
  private async createMaterialVersion(
    materialId: string,
    updateData: Partial<MaterialType>,
    userId?: string
  ): Promise<string> {
    try {
      // Get current material
      const currentMaterial = await this.getMaterialById(materialId);
      if (!currentMaterial) {
        throw new Error(`Material not found: ${materialId}`);
      }
      
      // Create version record
      const versionId = uuidv4();
      
      const { error } = await supabaseClient
        .getClient()
        .from('versions')
        .insert({
          id: versionId,
          entity_id: materialId,
          entity_type: 'material',
          previous_data: currentMaterial,
          change_description: updateData.metadata?.changeDescription || 'Material updated',
          created_by: userId
        });

      if (error) {
        throw error;
      }
      
      return versionId;
    } catch (err) {
      logger.error(`Failed to create material version: ${err}`);
      throw new Error(`Failed to create material version: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Get material version history
   * @param materialId Material ID
   * @returns Array of versions
   */
  public async getMaterialVersionHistory(materialId: string): Promise<any[]> {
    try {
      const { data, error } = await supabaseClient
        .getClient()
        .from('versions')
        .select('*')
        .eq('entity_id', materialId)
        .eq('entity_type', 'material')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data;
    } catch (err) {
      logger.error(`Failed to get material version history: ${err}`);
      throw new Error(`Failed to get material version history: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Revert a material to a previous version
   * @param materialId Material ID
   * @param versionId Version ID to revert to
   * @param userId User ID
   * @returns Reverted material document
   */
  public async revertMaterialVersion(
    materialId: string,
    versionId: string,
    userId?: string
  ): Promise<MaterialType> {
    try {
      // Get the version to revert to
      const { data: versionData, error: versionError } = await supabaseClient
        .getClient()
        .from('versions')
        .select('*')
        .eq('id', versionId)
        .eq('entity_id', materialId)
        .single();

      if (versionError) {
        throw versionError;
      }

      if (!versionData) {
        throw new Error(`Version not found: ${versionId}`);
      }

      // Create a new version record for the revert operation
      const currentMaterial = await this.getMaterialById(materialId);
      if (!currentMaterial) {
        throw new Error(`Material not found: ${materialId}`);
      }

      const newVersionId = uuidv4();
      
      const { error: newVersionError } = await supabaseClient
        .getClient()
        .from('versions')
        .insert({
          id: newVersionId,
          entity_id: materialId,
          entity_type: 'material',
          previous_data: currentMaterial,
          change_description: `Reverted to version ${versionId}`,
          created_by: userId
        });

      if (newVersionError) {
        throw newVersionError;
      }

      // Extract previous data
      const previousData = versionData.previous_data as MaterialType;
      
      // Update material with previous data
      const supabaseData = this.transformMaterialForSupabase({
        ...previousData,
        updatedAt: new Date()
      });

      // Update material in Supabase
      const { data, error } = await supabaseClient
        .getClient()
        .from('materials')
        .update(supabaseData)
        .eq('id', materialId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return this.transformMaterialFromSupabase(data);
    } catch (err) {
      logger.error(`Failed to revert material version: ${err}`);
      throw new Error(`Failed to revert material version: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Transform material document to Supabase format
   * @param material Material document
   * @returns Supabase-formatted material object
   */
  private transformMaterialForSupabase(material: Partial<MaterialType>): Record<string, any> {
    // Convert camelCase to snake_case and handle nested objects
    const result: Record<string, any> = {};

    // Map simple fields
    if (material.id !== undefined) result.id = material.id;
    if (material.name !== undefined) result.name = material.name;
    if (material.description !== undefined) result.description = material.description;
    if (material.manufacturer !== undefined) result.manufacturer = material.manufacturer;
    if (material.collectionId !== undefined) result.collection_id = material.collectionId;
    if (material.seriesId !== undefined) result.series_id = material.seriesId;
    if (material.categoryId !== undefined) result.category_id = material.categoryId;
    if (material.materialType !== undefined) result.material_type = material.materialType;
    if (material.finish !== undefined) result.finish = material.finish;
    if (material.pattern !== undefined) result.pattern = material.pattern;
    if (material.texture !== undefined) result.texture = material.texture;
    if (material.tags !== undefined) result.tags = material.tags;
    if (material.catalogId !== undefined) result.catalog_id = material.catalogId;
    if (material.catalogPage !== undefined) result.catalog_page = material.catalogPage;
    if (material.extractedAt !== undefined) result.extracted_at = material.extractedAt;
    if (material.updatedAt !== undefined) result.updated_at = material.updatedAt;
    if (material.createdBy !== undefined) result.created_by = material.createdBy;
    if (material.vectorRepresentation !== undefined) result.vector_representation = material.vectorRepresentation;

    // Handle complex/nested objects as JSONB
    if (material.dimensions !== undefined) result.dimensions = material.dimensions;
    if (material.color !== undefined) result.color = material.color;
    if (material.technicalSpecs !== undefined) result.technical_specs = material.technicalSpecs;
    if (material.images !== undefined) result.images = material.images;
    if (material.metadata !== undefined) result.metadata = material.metadata;
    if (material.metadataConfidence !== undefined) result.metadata_confidence = material.metadataConfidence;

    return result;
  }

  /**
   * Transform Supabase data to Material document format
   * @param data Supabase data
   * @returns Material document
   */
  private transformMaterialFromSupabase(data: Record<string, any>): MaterialType {
    // Convert snake_case to camelCase and reconstruct the document
    const material: Partial<MaterialType> = {
      id: data.id,
      name: data.name,
      description: data.description,
      manufacturer: data.manufacturer,
      
      // Collection organization
      collectionId: data.collection_id,
      seriesId: data.series_id,
      
      // Category info
      categoryId: data.category_id,
      materialType: data.material_type,
      
      // Properties
      dimensions: data.dimensions,
      color: data.color,
      finish: data.finish,
      pattern: data.pattern,
      texture: data.texture,
      technicalSpecs: data.technical_specs,
      
      // Images
      images: data.images || [],
      
      // Metadata
      tags: data.tags || [],
      catalogId: data.catalog_id,
      catalogPage: data.catalog_page,
      extractedAt: data.extracted_at ? new Date(data.extracted_at) : new Date(),
      updatedAt: data.updated_at ? new Date(data.updated_at) : new Date(),
      createdBy: data.created_by,
      
      // Vector data
      vectorRepresentation: data.vector_representation,
      
      // Additional metadata
      metadata: data.metadata || {},
      metadataConfidence: data.metadata_confidence || {}
    };

    return material as MaterialType;
  }

  /**
   * Get knowledge base statistics
   * @returns Knowledge base statistics
   */
  public async getKnowledgeBaseStats(): Promise<{
    materialCount: number;
    collectionCount: number;
    materialsByType: Record<string, number>;
    materialsByCollection: Array<{ collection: string; count: number }>;
    recentUpdates: number;
    indexingStatus: Record<string, number>;
  }> {
    try {
      // Get material count
      const { count: materialCount, error: materialError } = await supabaseClient
        .getClient()
        .from('materials')
        .select('*', { count: 'exact', head: true });
      
      if (materialError) throw materialError;

      // Get collection count
      const { count: collectionCount, error: collectionError } = await supabaseClient
        .getClient()
        .from('collections')
        .select('*', { count: 'exact', head: true });
      
      if (collectionError) throw collectionError;

      // Materials by type
      const { data: materialsByTypeData, error: materialsByTypeError } = await supabaseClient
        .getClient()
        .rpc('get_materials_by_type');
      
      if (materialsByTypeError) throw materialsByTypeError;

      const materialsByType: Record<string, number> = {};
      materialsByTypeData.forEach((item: { material_type: string; count: number }) => {
        materialsByType[item.material_type] = item.count;
      });

      // Materials by collection
      const { data: materialsByCollectionData, error: materialsByCollectionError } = await supabaseClient
        .getClient()
        .rpc('get_materials_by_collection', { limit_val: 10 });
      
      if (materialsByCollectionError) throw materialsByCollectionError;

      const materialsByCollection = materialsByCollectionData.map(
        (item: { collection_name: string; count: number }) => ({
          collection: item.collection_name,
          count: item.count
        })
      );

      // Recent updates (past week)
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const { count: recentUpdates, error: recentError } = await supabaseClient
        .getClient()
        .from('materials')
        .select('*', { count: 'exact', head: true })
        .gte('updated_at', oneWeekAgo.toISOString());
      
      if (recentError) throw recentError;

      // Vector indexing status
      const { data: indexStatusData, error: indexError } = await supabaseClient
        .getClient()
        .from('vector_indexes')
        .select('status, count')
        .csv();
      
      if (indexError) throw indexError;

      const indexingStatus: Record<string, number> = {};
      if (indexStatusData) {
        const rows = indexStatusData.trim().split('\n').slice(1); // Skip header
        rows.forEach((row: string) => {
          const parts = row.split(',');
          if (parts.length >= 2 && parts[0] && parts[1]) {
            const status = parts[0];
            const count = parts[1];
            indexingStatus[status] = parseInt(count, 10);
          }
        });
      }

      return {
        materialCount: materialCount || 0,
        collectionCount: collectionCount || 0,
        materialsByType,
        materialsByCollection,
        recentUpdates: recentUpdates || 0,
        indexingStatus
      };
    } catch (err) {
      logger.error(`Failed to get knowledge base stats: ${err}`);
      throw new Error(`Failed to get knowledge base stats: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

// Export singleton instance
export const supabaseMaterialService = SupabaseMaterialService.getInstance();
export default supabaseMaterialService;