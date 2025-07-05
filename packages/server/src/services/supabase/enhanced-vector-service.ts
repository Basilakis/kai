/**
 * Enhanced Vector Service Implementation
 *
 * Provides advanced vector search capabilities, integrating with Python scripts and Supabase.
 * Implements the EnhancedVectorService interface.
 */

// Use require syntax for modules with suppressed typescript checking
// @ts-ignore - Using require for child_process compatibility if needed
import childProcess from 'child_process';
import path from 'path';
import fs from 'fs';
import { logger } from '../../utils/logger';
import { supabaseClient } from './supabaseClient';
import { handleSupabaseError } from '../../../../shared/src/utils/supabaseErrorHandler';
import { KnowledgeBaseService } from '../knowledgeBase/knowledgeBaseService';
import { ApiError } from '../../middleware/error.middleware'; // Import ApiError

// Import types from the dedicated types file
import {
  EnhancedVectorService as IEnhancedVectorService, // Use alias for interface
  EmbeddingResult,
  SearchOptions,
  SearchResult,
  VectorSearchConfig,
  SearchWithKnowledgeResult,
  QueryRoutingOptions,
  SemanticKnowledgeOrganization,
  KnowledgeEntry,
  MaterialRelationship,
  EmbeddingGenerationOptions, // Corrected: Use existing type
  SimilarMaterialsOptions // Corrected: Use existing type
} from '../../types/enhancedVector.types';

/**
 * Enhanced Vector Service Implementation Class
 */
export class EnhancedVectorServiceImpl implements IEnhancedVectorService {
  private pythonPath: string;
  private scriptPath: string;
  private configCache: Map<string, VectorSearchConfig> = new Map();
  private __knowledgeBaseService?: KnowledgeBaseService;
  private embeddingModelName: string;

  constructor(knowledgeBaseService?: KnowledgeBaseService) {
    this.pythonPath = process.env.PYTHON_PATH || 'python';
    this.scriptPath = path.resolve(process.cwd(), 'packages/ml/python/enhanced_text_embeddings.py');
    this.embeddingModelName = process.env.EMBEDDING_MODEL_NAME || 'all-MiniLM-L6-v2';

    if (!fs.existsSync(this.scriptPath)) {
      logger.warn(`Enhanced text embeddings script not found at ${this.scriptPath}. Embedding generation might fail.`);
    }

    this.__knowledgeBaseService = knowledgeBaseService;
    // Load configs asynchronously, don't block constructor
    this.loadConfigsFromDatabase().catch(err => {
      logger.error('Failed initial config load:', err);
      // Initialize with default config if loading fails
      this.initializeDefaultConfig();
    });
  }

  /**
   * Set the knowledge base service instance.
   */
  public setKnowledgeBaseService(service: KnowledgeBaseService): void {
    this.__knowledgeBaseService = service;
    logger.info('KnowledgeBaseService injected into EnhancedVectorServiceImpl.');
  }

  /**
   * Initialize default configuration if database load fails.
   */
  private initializeDefaultConfig(): void {
    if (!this.configCache.has('default')) {
      this.configCache.set('default', {
        id: 'default-uuid', // Placeholder UUID
        name: 'default',
        denseWeight: 0.7,
        indexType: 'hnsw',
        indexParameters: { m: 16, ef_construction: 64, ef_search: 40 },
        description: 'Default configuration'
      });
      logger.info('Initialized with default vector search configuration.');
    }
  }

  /**
   * Call a Python module with specified method and arguments.
   */
  private async invokePythonModule(
    moduleName: string,
    method: string,
    args: Record<string, any>
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const scriptPath = path.resolve(process.cwd(), `packages/ml/python/${moduleName}`);

      if (!fs.existsSync(scriptPath)) {
        logger.error(`Python module not found at ${scriptPath}`);
        return reject(new ApiError(500, `Internal configuration error: Python module ${moduleName} not found.`));
      }

      const pythonArgs = [
        scriptPath,
        '--method', method,
        '--args', JSON.stringify(args)
      ];

      logger.debug(`Spawning Python: ${this.pythonPath} ${pythonArgs.join(' ')}`);
      const pythonProcess = childProcess.spawn(this.pythonPath, pythonArgs);

      let outputData = '';
      let errorData = '';

      if (pythonProcess.stdout) {
        pythonProcess.stdout.on('data', (data: Buffer) => { outputData += data.toString(); });
      } else {
        logger.warn(`Python process for ${moduleName} has no stdout stream.`);
      }

      if (pythonProcess.stderr) {
        pythonProcess.stderr.on('data', (data: Buffer) => { errorData += data.toString(); });
      } else {
        logger.warn(`Python process for ${moduleName} has no stderr stream.`);
      }

      pythonProcess.on('error', (spawnError: Error) => {
        logger.error(`Failed to spawn Python process for ${moduleName}: ${spawnError.message}`);
        reject(new ApiError(500, `Failed to execute ML process: ${spawnError.message}`));
      });

      pythonProcess.on('close', (code: number | null) => {
        logger.debug(`Python process for ${moduleName} exited with code ${code}. Output length: ${outputData.length}, Error length: ${errorData.length}`);
        if (code !== 0) {
          logger.error(`Python module ${moduleName} (${method}) failed with code ${code}. Error: ${errorData}`);
          // Try to parse error data for a more specific message
          let detail = errorData.trim();
          try {
             const errorJson = JSON.parse(errorData);
             if (errorJson.error) detail = errorJson.error;
          } catch { /* Ignore parsing error */ }
          // Corrected: ApiError takes only (statusCode, message)
          return reject(new ApiError(500, `ML processing failed (code ${code}). Details: ${detail}`));
        }

        try {
          // Handle potentially empty output
          if (!outputData.trim()) {
             logger.warn(`Python module ${moduleName} (${method}) produced empty output.`);
             return resolve({}); // Resolve with empty object for empty output
          }
          const result = JSON.parse(outputData);
          resolve(result);
        } catch (parseError: unknown) {
          const errorMsg = `Failed to parse Python module ${moduleName} (${method}) result: ${parseError}. Output: ${outputData}`;
          logger.error(errorMsg);
          // Corrected: ApiError takes only (statusCode, message)
          reject(new ApiError(500, 'Failed to parse ML process result.'));
        }
      });
    });
  }

  /**
   * Load vector search configurations from the database.
   */
  private async loadConfigsFromDatabase(): Promise<void> {
    try {
      const { data, error } = await supabaseClient.getClient()
        .from('vector_search_config')
        .select('*');

      if (error) {
        // throw handleSupabaseError(error, 'loadConfigsFromDatabase');
        throw new ApiError(500, `Supabase error in loadConfigsFromDatabase: ${error.message}`);
      }

      const newCache = new Map<string, VectorSearchConfig>();
      if (data) {
        for (const config of data) {
          newCache.set(config.name, {
            id: config.id,
            name: config.name,
            description: config.description,
            denseWeight: config.dense_weight,
            indexType: config.index_type,
            indexParameters: config.index_parameters,
            materialType: config.material_type,
            modelPath: config.model_path
          });
        }
        this.configCache = newCache;
        logger.info(`Loaded ${this.configCache.size} vector search configurations from database.`);
      } else {
         logger.info('No vector search configurations found in database.');
         this.configCache.clear(); // Clear cache if no data
      }
      // Ensure default exists if cache is empty or doesn't have 'default'
      this.initializeDefaultConfig();

    } catch (error) {
      logger.error(`Failed to load vector search configurations: ${error instanceof Error ? error.message : error}`);
      this.initializeDefaultConfig(); // Fallback to default on error
      // Do not re-throw, allow service to start with default
    }
  }

  /**
   * Get configuration for the specified material type or config name.
   */
  private getConfig(configName: string = 'default', materialType?: string): VectorSearchConfig {
    // Try material type specific config first
    if (materialType) {
      for (const config of this.configCache.values()) {
        if (config.materialType === materialType) {
          return config;
        }
      }
    }
    // Try specified config name
    const namedConfig = this.configCache.get(configName);
    if (namedConfig) {
      return namedConfig;
    }
    // Fall back to default
    const defaultConfig = this.configCache.get('default');
    if (defaultConfig) {
      return defaultConfig;
    }
    // Should not happen if initializeDefaultConfig works, but as a last resort:
    logger.error('Default configuration missing unexpectedly. Creating ad-hoc default.');
    return {
      id: 'adhoc-default-uuid', name: 'default', denseWeight: 0.7, indexType: 'hnsw', indexParameters: { m: 16, ef_construction: 64, ef_search: 40 }
    };
  }

  /**
   * Generate text embeddings using the Python script.
   */
  // Corrected: Use EmbeddingGenerationOptions type
  public async generateEmbedding(text: string, options: EmbeddingGenerationOptions = {}): Promise<EmbeddingResult> {
    try {
      const {
        method = 'hybrid',
        denseModel = 'all-MiniLM-L6-v2',
        denseDimensions = 384,
        sparseMethod = 'tfidf',
        sparseFeatures = 10000,
        materialCategory
      } = options;

      const pythonArgs = {
        text,
        method,
        dense_model: denseModel,
        dense_dimensions: denseDimensions,
        sparse_method: sparseMethod,
        sparse_features: sparseFeatures,
        pgvector_format: true,
        material_category: materialCategory
      };

      // Use invokePythonModule for consistency
      const result = await this.invokePythonModule('enhanced_text_embeddings.py', 'generate', pythonArgs);

      // Validate the result structure (basic check)
      if (typeof result !== 'object' || result === null) {
         throw new Error('Invalid embedding result format received from Python script.');
      }

      // Map Python result keys to EmbeddingResult keys if necessary (assuming they match for now)
      return result as EmbeddingResult;

    } catch (error) {
      logger.error(`Failed to generate embedding: ${error instanceof Error ? error.message : error}`);
      if (error instanceof ApiError) throw error; // Re-throw ApiError
      // Corrected: ApiError takes only (statusCode, message)
      throw new ApiError(500, `Embedding generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Store embeddings in the database.
   */
  public async storeEmbedding(materialId: string, embeddingResult: EmbeddingResult, text: string): Promise<boolean> {
    try {
      const { dense_vector, sparse_indices, sparse_values, sparse_dimensions, material_category, processing_time } = embeddingResult;

      let sparseEmbeddingJson = null;
      if (sparse_indices && sparse_values && sparse_dimensions) {
        sparseEmbeddingJson = { indices: sparse_indices, values: sparse_values, dimensions: sparse_dimensions };
      }

      const metadata = {
        text_length: text.length,
        method: sparseEmbeddingJson && dense_vector ? 'hybrid' : (dense_vector ? 'dense' : 'sparse'),
        material_category: material_category,
        processing_time: processing_time,
        timestamp: Date.now()
      };

      const { error } = await supabaseClient.getClient()
        .from('materials')
        .update({
          dense_embedding: dense_vector, // Assumes pgvector format '[1,2,3]'
          sparse_embedding: sparseEmbeddingJson, // Stored as JSONB
          embedding_metadata: metadata,
          embedding_method: metadata.method,
          embedding_quality: 1.0 // Placeholder
        })
        .eq('id', materialId);

      if (error) {
        // throw handleSupabaseError(error, 'storeEmbedding');
        throw new ApiError(500, `Supabase error in storeEmbedding: ${error.message}`);
      }

      // Log metrics (non-critical)
      this.logEmbeddingMetrics(materialId, embeddingResult, text).catch(logErr => {
         logger.warn(`Failed to log embedding metrics for ${materialId}: ${logErr}`);
      });

      return true;
    } catch (error) {
      logger.error(`Failed to store embedding for material ${materialId}: ${error instanceof Error ? error.message : error}`);
      if (error instanceof ApiError) throw error;
      // Corrected: ApiError takes only (statusCode, message)
      throw new ApiError(500, `Failed to store embedding for material ${materialId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Log embedding metrics to the database (internal helper).
   */
  private async logEmbeddingMetrics(materialId: string, embeddingResult: EmbeddingResult, text: string): Promise<void> {
     try {
       const { dense_vector, sparse_indices, dense_dimensions, processing_time, material_category } = embeddingResult;
       const embeddingType = sparse_indices && dense_vector ? 'hybrid' : (dense_vector ? 'dense' : 'sparse');
       const qualityScore = 1.0; // Placeholder

       const { error } = await supabaseClient.getClient()
         .from('embedding_metrics')
         .insert({
           material_id: materialId,
           embedding_type: embeddingType,
           model_name: this.embeddingModelName,
           dimensions: dense_dimensions,
           quality_score: qualityScore,
           processing_time_ms: processing_time ? processing_time * 1000 : null,
           metrics: {
             text_length: text.length,
             material_category,
             timestamp: Date.now()
           }
         });

       if (error) {
         // Log Supabase error specifically for metrics
         logger.warn(`Supabase error logging embedding metrics for ${materialId}: ${error.message}`);
         // Do not throw - logging is non-critical
       }
     } catch (error) {
       // Catch any other unexpected errors during logging
       logger.warn(`Unexpected error logging embedding metrics for ${materialId}: ${error instanceof Error ? error.message : error}`);
       // Do not throw - logging is non-critical
     }
   }


  /**
   * Search for materials using hybrid search.
   */
  public async searchMaterials(options: SearchOptions): Promise<SearchResult[]> {
    const startTime = Date.now();
    let config: VectorSearchConfig | null = null;
    try {
      const {
        query,
        materialType,
        limit = 10,
        threshold = 0.5,
        // denseWeight is now primarily controlled by config, but allow override? Interface doesn't specify.
        useSpecializedIndex = true
      } = options;

      config = this.getConfig(materialType || 'default', materialType);
      const effectiveDenseWeight = config.denseWeight; // Use config weight

      let results: SearchResult[] = [];

      // Use RPC function for optimized search
      const rpcFn = useSpecializedIndex && materialType ? 'material_hybrid_search' : 'find_similar_materials_hybrid';
      let rpcParams: any;

      if (rpcFn === 'material_hybrid_search') {
         rpcParams = {
           query_text: query,
           material_type: materialType,
           max_results: limit,
           config_name: config.name // Pass config name
         };
      } else {
         // Need to generate embedding first for the generic function
         const embeddingResult = await this.generateEmbedding(query, { method: 'hybrid', materialCategory: materialType });
         if (!embeddingResult.dense_vector) {
           throw new Error('Failed to generate query embedding for generic search.');
         }
         let sparseEmbeddingJson = null;
         if (embeddingResult.sparse_indices && embeddingResult.sparse_values && embeddingResult.sparse_dimensions) {
            sparseEmbeddingJson = { indices: embeddingResult.sparse_indices, values: embeddingResult.sparse_values, dimensions: embeddingResult.sparse_dimensions };
         }
         rpcParams = {
           dense_query_vector: embeddingResult.dense_vector,
           sparse_query_vector: sparseEmbeddingJson,
           similarity_threshold: threshold,
           max_results: limit,
           material_type_filter: materialType, // Filter within the function
           dense_weight: effectiveDenseWeight
         };
      }

      const { data, error } = await supabaseClient.getClient().rpc(rpcFn, rpcParams);

      if (error) {
        // throw handleSupabaseError(error, `searchMaterials (RPC: ${rpcFn})`);
        throw new ApiError(500, `Supabase error in searchMaterials (RPC: ${rpcFn}): ${error.message}`);
      }

      if (data) {
        results = data.map((item: any): SearchResult => ({
          id: item.id,
          name: item.name,
          materialType: item.material_type,
          similarity: item.similarity,
          // 'matched_by' might only be returned by 'material_hybrid_search'
          matchedBy: item.matched_by || (rpcFn === 'material_hybrid_search' ? 'hybrid' : 'vector')
        }));
      }

      // Update metrics (non-critical)
      this.updateSearchMetrics(config.id, Date.now() - startTime).catch(logErr => {
         logger.warn(`Failed to update search metrics for config ${config?.id}: ${logErr}`);
      });

      return results;

    } catch (error) {
      logger.error(`Failed to search materials: ${error instanceof Error ? error.message : error}`);
      // Update metrics even on error? Maybe not useful.
      if (error instanceof ApiError) throw error;
      // Corrected: ApiError takes only (statusCode, message)
      throw new ApiError(500, `Material search failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Update search metrics (internal helper).
   */
  private async updateSearchMetrics(configId: string, queryTimeMs: number): Promise<void> {
     try {
       const { data, error } = await supabaseClient.getClient()
         .from('vector_search_config')
         .select('queries_count, average_query_time_ms')
         .eq('id', configId)
         .single(); // Use single() as ID should be unique

       if (error && error.code !== 'PGRST116') { // Ignore 'not found' error
         // throw handleSupabaseError(error, 'updateSearchMetrics - select');
         // Log warning instead of throwing for metrics
         logger.warn(`Supabase error selecting metrics for config ${configId}: ${error.message}`);
         return; // Exit metrics update on select error
       }

       const prevCount = data?.queries_count || 0;
       const prevAverage = data?.average_query_time_ms || 0;
       const newAverage = prevCount > 0 ? ((prevAverage * prevCount) + queryTimeMs) / (prevCount + 1) : queryTimeMs;

       const { error: updateError } = await supabaseClient.getClient()
         .from('vector_search_config')
         .update({
           queries_count: prevCount + 1,
           average_query_time_ms: newAverage,
           last_updated_at: new Date().toISOString()
         })
         .eq('id', configId);

       if (updateError) {
         // Log Supabase error specifically for metrics update
         logger.warn(`Supabase error updating search metrics for config ${configId}: ${updateError.message}`);
         // Do not throw - logging is non-critical
       }
     } catch (error) {
       // Catch any other unexpected errors during metrics update
       logger.warn(`Unexpected error updating search metrics for config ${configId}: ${error instanceof Error ? error.message : error}`);
       // Do not throw - logging is non-critical
     }
   }


  /**
   * Find similar materials to a specific material.
   */
  // Corrected: Use SimilarMaterialsOptions type
  public async findSimilarMaterials(materialId: string, options: SimilarMaterialsOptions = {}): Promise<SearchResult[]> {
     const startTime = Date.now();
     let config: VectorSearchConfig | null = null;
     try {
       const {
         limit = 10,
         threshold = 0.5,
         sameMaterialType = false,
         denseWeight // Allow override from options? Interface doesn't specify.
       } = options;

       const { data: material, error: materialError } = await supabaseClient.getClient()
         .from('materials')
         .select('id, name, material_type, dense_embedding, sparse_embedding')
         .eq('id', materialId)
          .single();

       if (materialError) {
         // throw handleSupabaseError(materialError, 'findSimilarMaterials - get source material');
         throw new ApiError(500, `Supabase error in findSimilarMaterials - get source material: ${materialError.message}`);
       }
       if (!material) {
         throw new ApiError(404, `Source material not found: ${materialId}`);
       }
       if (!material.dense_embedding) {
         throw new ApiError(400, `Source material ${materialId} does not have embeddings.`);
       }

       config = this.getConfig('default', material.material_type);
       const effectiveDenseWeight = denseWeight !== undefined ? denseWeight : config.denseWeight;

       const { data, error } = await supabaseClient.getClient()
         .rpc('find_similar_materials_hybrid', {
           dense_query_vector: material.dense_embedding,
           sparse_query_vector: material.sparse_embedding, // Can be null
           similarity_threshold: threshold,
           max_results: limit + 1, // Fetch one extra to filter self
           material_type_filter: sameMaterialType ? material.material_type : null,
           dense_weight: effectiveDenseWeight
         });

       if (error) {
         throw handleSupabaseError(error, 'findSimilarMaterials - RPC call');
       }

       const results: SearchResult[] = data
         ? data
             .filter((item: any) => item.id !== materialId) // Filter self
             .slice(0, limit) // Apply limit after filtering
             .map((item: any): SearchResult => ({
               id: item.id,
               name: item.name,
               materialType: item.material_type,
               similarity: item.similarity,
               matchedBy: 'hybrid' // RPC function implies hybrid match
             }))
         : [];

       // Update metrics (non-critical)
       this.updateSearchMetrics(config.id, Date.now() - startTime).catch(logErr => {
          logger.warn(`Failed to update search metrics for config ${config?.id}: ${logErr}`);
       });

       return results;

     } catch (error) {
       logger.error(`Failed to find similar materials for ${materialId}: ${error instanceof Error ? error.message : error}`);
       if (error instanceof ApiError) throw error;
       // Corrected: ApiError takes only (statusCode, message)
       throw new ApiError(500, `Failed to find similar materials for ${materialId}: ${error instanceof Error ? error.message : String(error)}`);
     }
   }

  // --- Knowledge Base Integration Methods ---

   public async searchMaterialsWithKnowledge(
     query: string,
     materialType?: string,
     filters?: Record<string, any>,
     limit: number = 10,
     includeKnowledge: boolean = true,
     includeRelationships: boolean = true
   ): Promise<SearchWithKnowledgeResult> {
     try {
       const result = await this.invokePythonModule('hybrid_retriever.py', 'retrieve', {
         query,
         material_type: materialType,
         filters: filters || {},
         limit,
         include_knowledge: includeKnowledge,
         include_relationships: includeRelationships
       });

       // Basic validation of Python result structure
       if (!result || typeof result !== 'object') {
          throw new Error('Invalid response structure from hybrid_retriever.py');
       }

       return {
         materials: result.results || [],
         knowledgeEntries: (result.knowledge_entries || []).map(this.mapKnowledgeEntry), // Ensure type safety
         relationships: (result.relationships || []).map(this.mapMaterialRelationship), // Ensure type safety
         metadata: result.metadata || {}
       };
     } catch (error) {
       logger.error(`Failed to search materials with knowledge: ${error instanceof Error ? error.message : error}`);
       // Fallback to standard search
       const materials = await this.searchMaterials({ query, materialType, limit });
       return { materials, knowledgeEntries: [], relationships: [], metadata: { error: `Knowledge search failed: ${error instanceof Error ? error.message : String(error)}`, fallback: true } };
     }
   }

   public async findSimilarMaterialsWithKnowledge(
     materialId: string,
     materialType?: string,
     limit: number = 10,
     includeKnowledge: boolean = true
     // includeRelationships is implicitly true in Python script for this method
   ): Promise<SearchWithKnowledgeResult> {
     try {
       const result = await this.invokePythonModule('hybrid_retriever.py', 'find_similar_by_id', {
         material_id: materialId,
         material_type: materialType,
         limit,
         include_knowledge: includeKnowledge,
         include_relationships: true // Hardcoded as per Python script expectation
       });

       if (!result || typeof result !== 'object') {
          throw new Error('Invalid response structure from hybrid_retriever.py');
       }

       return {
         materials: result.results || [],
         knowledgeEntries: (result.knowledge_entries || []).map(this.mapKnowledgeEntry),
         relationships: (result.relationships || []).map(this.mapMaterialRelationship),
         metadata: result.metadata || {}
       };
     } catch (error) {
       logger.error(`Failed to find similar materials with knowledge: ${error instanceof Error ? error.message : error}`);
       const materials = await this.findSimilarMaterials(materialId, { limit, sameMaterialType: !!materialType });
       return { materials, knowledgeEntries: [], relationships: [], metadata: { error: `Knowledge similarity search failed: ${error instanceof Error ? error.message : String(error)}`, fallback: true } };
     }
   }

   public async routeQuery(options: QueryRoutingOptions): Promise<SearchWithKnowledgeResult> {
     try {
       const { query, materialType, filters, strategy = 'hybrid', limit = 10 } = options; // Add limit default

       const result = await this.invokePythonModule('context_assembler.py', 'route_query', {
         query,
         material_type: materialType,
         filters: filters || {},
         strategy,
         limit // Pass limit to Python
       });

       if (!result || typeof result !== 'object') {
          throw new Error('Invalid response structure from context_assembler.py route_query');
       }

       return {
         materials: result.results || [],
         knowledgeEntries: (result.knowledge_entries || []).map(this.mapKnowledgeEntry),
         relationships: (result.relationships || []).map(this.mapMaterialRelationship),
         metadata: {
           searchStrategy: result.search_strategy || strategy,
           queryType: result.query_type || 'unknown',
           ...(result.metadata || {})
         }
       };
     } catch (error) {
       logger.error(`Error routing query: ${error instanceof Error ? error.message : error}`);
       const materials = await this.searchMaterials({ query: options.query, materialType: options.materialType, filters: options.filters, limit: options.limit });
       return {
         materials, knowledgeEntries: [], relationships: [],
         metadata: { searchStrategy: 'vector_only', queryType: 'error_fallback', error: `Query routing failed: ${error instanceof Error ? error.message : String(error)}` }
       };
     }
   }

   public async getMaterialKnowledge(materialId: string, query?: string, limit: number = 5): Promise<{ entries: KnowledgeEntry[], relationships: MaterialRelationship[], metadata: any }> {
     try {
       // KnowledgeBaseService check is good, but Python script is the primary source here
       const result = await this.invokePythonModule('context_assembler.py', 'get_related_knowledge', {
         material_id: materialId,
         limit,
         query: query || '',
         include_relationships: true
       });

       if (!result || typeof result !== 'object') {
          throw new Error('Invalid response structure from context_assembler.py get_related_knowledge');
       }

       return {
         entries: (result.entries || []).map(this.mapKnowledgeEntry),
         relationships: (result.relationships || []).map(this.mapMaterialRelationship),
         metadata: { material_id: materialId, ...(result.metadata || {}) }
       };
     } catch (error) {
       logger.error(`Error getting material knowledge for ${materialId}: ${error instanceof Error ? error.message : error}`);
       // Fallback logic removed as getEntriesForMaterial does not exist on KnowledgeBaseService.
       // Return empty result with error metadata.
       return {
         entries: [],
         relationships: [],
         metadata: {
           material_id: materialId,
           error: `Failed to retrieve knowledge via Python and no valid fallback exists: ${error instanceof Error ? error.message : String(error)}`
         }
       };
     }
   }

   public async assembleContext(materials: any[], query: string, userContext?: Record<string, any>): Promise<any> {
     try {
       const result = await this.invokePythonModule('context_assembler.py', 'assemble_context', {
         retrieved_materials: materials,
         query,
         user_context: userContext || {}
       });

       if (!result || typeof result !== 'object') {
          throw new Error('Invalid response structure from context_assembler.py assemble_context');
       }
       return result; // Return raw Python result for now, type can be refined
     } catch (error) {
       logger.error(`Error assembling context: ${error instanceof Error ? error.message : error}`);
       return { query, materials, error: `Context assembly failed: ${error instanceof Error ? error.message : String(error)}`, materials_count: materials.length };
     }
   }

   public async createSemanticKnowledgeOrganization(knowledgeEntries: KnowledgeEntry[], query: string): Promise<SemanticKnowledgeOrganization> {
     try {
       // Map entries to format expected by Python script if necessary (assuming it matches for now)
       const result = await this.invokePythonModule('context_assembler.py', 'create_semantic_knowledge_organization', {
         knowledge_facts: knowledgeEntries,
         query
       });

       if (!result || typeof result !== 'object') {
          throw new Error('Invalid response structure from context_assembler.py create_semantic_knowledge_organization');
       }

       return {
         queryTheme: result.query_theme || 'general_information',
         primaryCategories: result.primary_categories || [],
         categoryDistribution: result.category_distribution || {},
         categoryContents: result.category_contents || {}
       };
     } catch (error) {
       logger.error(`Error creating semantic organization: ${error instanceof Error ? error.message : error}`);
       // Fallback to default organization
       return this.createDefaultSemanticOrganization(knowledgeEntries, query);
     }
   }

   // Helper to map raw Python knowledge entry to typed KnowledgeEntry
   private mapKnowledgeEntry(rawEntry: any): KnowledgeEntry {
      return {
         id: rawEntry.id || 'unknown-id',
         materialId: rawEntry.material_id || rawEntry.materialId || 'unknown-material-id',
         content: rawEntry.content || '',
         source: rawEntry.source,
         confidence: typeof rawEntry.confidence === 'number' ? rawEntry.confidence : 0,
         relevance: typeof rawEntry.relevance === 'number' ? rawEntry.relevance : 0,
         category: rawEntry.category,
         semanticTags: Array.isArray(rawEntry.semantic_tags) ? rawEntry.semantic_tags : [],
         linkedMaterials: Array.isArray(rawEntry.linked_materials) ? rawEntry.linked_materials : []
      };
   }

   // Helper to map raw Python relationship to typed MaterialRelationship
   private mapMaterialRelationship(rawRel: any): MaterialRelationship {
      return {
         id: rawRel.id || 'unknown-rel-id',
         sourceId: rawRel.source_id || 'unknown-source',
         sourceName: rawRel.source_name || 'Unknown Source',
         targetId: rawRel.target_id || 'unknown-target',
         targetName: rawRel.target_name || 'Unknown Target',
         type: rawRel.type || 'related',
         strength: typeof rawRel.strength === 'number' ? rawRel.strength : 0,
         description: rawRel.description
      };
   }

   /**
    * Create a default semantic organization (internal helper).
     */
    private createDefaultSemanticOrganization(knowledgeEntries: KnowledgeEntry[], _query: string): SemanticKnowledgeOrganization {
      const entriesByMaterial: Record<string, string[]> = {};
      knowledgeEntries.forEach(entry => {
        // Initialize array if it doesn't exist
        if (!entriesByMaterial[entry.materialId]) {
          entriesByMaterial[entry.materialId] = [];
        }
        // Use non-null assertion since we've just initialized the array if it was undefined
        entriesByMaterial[entry.materialId]!.push(entry.id);
      });
      const materialCount = Object.keys(entriesByMaterial).length;
     return {
       queryTheme: 'general_information',
       primaryCategories: ['by_material'],
       categoryDistribution: { by_material: { count: materialCount, percentage: 1.0 } },
       categoryContents: { by_material: Object.values(entriesByMaterial).flat() }
     };
   }

  // --- Admin Methods ---

  public async refreshVectorViews(): Promise<boolean> {
    try {
      const { error } = await supabaseClient.getClient().rpc('refresh_vector_materialized_views');
      if (error) {
        // throw handleSupabaseError(error, 'refreshVectorViews');
        throw new ApiError(500, `Supabase error in refreshVectorViews: ${error.message}`);
      }
      logger.info('Successfully refreshed vector materialized views.');
      return true;
    } catch (error) {
      logger.error(`Failed to refresh vector materialized views: ${error instanceof Error ? error.message : error}`);
      // Do not throw ApiError here, controller handles boolean return
      return false;
    }
  }

  public async getPerformanceStats(): Promise<any> { // Return type 'any' for now
    try {
      const { data, error } = await supabaseClient.getClient()
        .from('vector_search_performance') // Assuming this table exists
        .select('*');

      if (error) {
        throw handleSupabaseError(error, 'getPerformanceStats');
      }
      return data || []; // Return empty array if no data
    } catch (error) {
       logger.error(`Failed to get performance stats: ${error instanceof Error ? error.message : error}`);
       if (error instanceof ApiError) throw error;
       // Corrected: ApiError takes only (statusCode, message)
       throw new ApiError(500, `Failed to retrieve performance statistics: ${error instanceof Error ? error.message : String(error)}`);
     }
   }

  public async updateSearchConfig(config: Partial<VectorSearchConfig> & { name: string }): Promise<VectorSearchConfig> {
    try {
      const dbConfig = {
        name: config.name,
        description: config.description,
        dense_weight: config.denseWeight,
        index_type: config.indexType,
        index_parameters: config.indexParameters,
        material_type: config.materialType,
        model_path: config.modelPath,
        // Ensure last_updated_at is set on update
        last_updated_at: new Date().toISOString()
      };

      // Use upsert for simplicity: insert if not exists, update if exists
      const { data, error } = await supabaseClient.getClient()
        .from('vector_search_config')
        .upsert(dbConfig, { onConflict: 'name' }) // Upsert based on unique name
        .select()
        .single(); // Expect single result

      if (error) {
        throw handleSupabaseError(error, 'updateSearchConfig');
      }
      if (!data) {
         throw new Error('Upsert operation did not return data.'); // Should not happen with .select().single()
      }

      const updatedConfig: VectorSearchConfig = {
        id: data.id,
        name: data.name,
        description: data.description,
        denseWeight: data.dense_weight,
        indexType: data.index_type,
        indexParameters: data.index_parameters,
        materialType: data.material_type,
        modelPath: data.model_path
      };

      // Update cache
      this.configCache.set(updatedConfig.name, updatedConfig);
      logger.info(`Updated/Created vector search config: ${updatedConfig.name}`);
      return updatedConfig;

    } catch (error) {
       logger.error(`Failed to update search config '${config.name}': ${error instanceof Error ? error.message : error}`);
       if (error instanceof ApiError) throw error;
       // Corrected: ApiError takes only (statusCode, message)
       throw new ApiError(500, `Failed to update search config '${config.name}': ${error instanceof Error ? error.message : String(error)}`);
     }
   }

  public async deleteSearchConfig(configName: string): Promise<boolean> {
    try {
      if (configName === 'default') {
        throw new ApiError(400, 'Cannot delete the default configuration.');
      }

      const { error, count } = await supabaseClient.getClient()
        .from('vector_search_config')
        .delete()
        .eq('name', configName);

      if (error) {
        throw handleSupabaseError(error, 'deleteSearchConfig');
      }

      if (count === 0) {
         logger.warn(`Attempted to delete non-existent config: ${configName}`);
         // Consider if this should be an error or just return false/true
         // Returning true as the state matches the desired outcome (config doesn't exist)
      } else {
         logger.info(`Deleted vector search config: ${configName}`);
      }

      // Remove from cache regardless of count
      this.configCache.delete(configName);
      return true; // Indicate success even if it didn't exist

    } catch (error) {
      logger.error(`Failed to delete search config '${configName}': ${error instanceof Error ? error.message : error}`);
      if (error instanceof ApiError) throw error;
      // Do not throw ApiError here, controller handles boolean return
      return false;
    }
  }

  public async getSearchConfigs(): Promise<VectorSearchConfig[]> {
    try {
      // Attempt to refresh cache first
      await this.loadConfigsFromDatabase();
      // Return values from the cache
      return Array.from(this.configCache.values());
    } catch (error) {
      // Log error but return potentially stale cache data if available
      logger.error(`Failed to refresh search configs, returning cached data: ${error instanceof Error ? error.message : error}`);
      if (this.configCache.size > 0) {
         return Array.from(this.configCache.values());
      }
       // If cache is also empty, re-throw as ApiError
       // Corrected: ApiError takes only (statusCode, message)
       throw new ApiError(500, `Failed to retrieve search configurations: ${error instanceof Error ? error.message : String(error)}`);
     }
   }

  /**
   * Compare similarity between two texts.
   */
  public async compareSimilarity(text1: string, text2: string): Promise<number> {
    try {
      // Generate embeddings concurrently
      const [result1, result2] = await Promise.all([
        this.generateEmbedding(text1, { method: 'dense' }), // Only need dense for cosine similarity
        this.generateEmbedding(text2, { method: 'dense' })
      ]);

      if (!result1.dense_vector || !result2.dense_vector) {
        let errorMsg = '';
        if (!result1.dense_vector) errorMsg += 'Failed to generate embedding for text1. ';
        if (!result2.dense_vector) errorMsg += 'Failed to generate embedding for text2.';
        throw new Error(errorMsg.trim());
      }

      const vec1 = result1.dense_vector;
      const vec2 = result2.dense_vector;

      if (vec1.length !== vec2.length) {
         throw new Error(`Embedding dimension mismatch: ${vec1.length} vs ${vec2.length}`);
      }
      if (vec1.length === 0) {
         return 0; // Avoid division by zero for empty vectors
      }

      // Calculate Cosine Similarity
      let dotProduct = 0;
      let norm1 = 0;
      let norm2 = 0;
      for (let i = 0; i < vec1.length; i++) {
        // Add non-null assertions to handle TypeScript's undefined check
        dotProduct += vec1[i]! * vec2[i]!;
        norm1 += vec1[i]! * vec1[i]!;
        norm2 += vec2[i]! * vec2[i]!;
      }

       norm1 = Math.sqrt(norm1);
      norm2 = Math.sqrt(norm2);

      if (norm1 === 0 || norm2 === 0) {
        return 0; // Handle zero vectors
      }

      const similarity = dotProduct / (norm1 * norm2);
      // Clamp similarity to [0, 1] range (cosine similarity is [-1, 1], but embeddings often non-negative)
      // Or should it be [-1, 1]? Let's assume [-1, 1] is correct for cosine.
      return Math.max(-1, Math.min(1, similarity));

    } catch (error) {
       logger.error(`Failed to compare similarity: ${error instanceof Error ? error.message : error}`);
       if (error instanceof ApiError) throw error;
       // Corrected: ApiError takes only (statusCode, message)
       throw new ApiError(500, `Failed to compare text similarity: ${error instanceof Error ? error.message : String(error)}`);
     }
   }
}

// Export singleton instance using the new class name
export const enhancedVectorService = new EnhancedVectorServiceImpl();
// Optionally, keep the old export name for compatibility if needed, but better to update consumers
// export default enhancedVectorService;