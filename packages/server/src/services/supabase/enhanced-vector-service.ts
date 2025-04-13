/**
 * Enhanced Vector Service
 *
 * This service provides advanced vector search capabilities for the RAG system,
 * supporting both dense and sparse embeddings, HNSW indexing, and specialized
 * indexes for different material categories.
 *
 * It integrates with the enhanced_text_embeddings.py Python module for
 * generating embeddings and uses the updated Supabase schema for storage.
 *
 * Now enhanced with knowledge base integration, bidirectional linking, and
 * semantic indexing capabilities.
 */

// Use require syntax for modules with suppressed typescript checking
// @ts-ignore
const childProcess = require('child_process');
import path from 'path';
import fs from 'fs';
import { logger } from '../../utils/logger';
import { supabase } from './supabaseClient';
import { handleSupabaseError } from '../../../shared/src/utils/supabaseErrorHandler';
import { KnowledgeBaseService } from '../knowledgeBase/knowledgeBaseService';
interface KnowledgeEntry {
  id: string;
  materialId: string;
  content: string;
  source?: string;
  confidence: number;
  relevance: number;
  category?: string;
  semanticTags?: string[];
  linkedMaterials?: any[];
}

interface MaterialRelationship {
  id: string;
  sourceId: string;
  sourceName: string;
  targetId: string;
  targetName: string;
  type: string;
  strength: number;
  description?: string;
}

interface SearchWithKnowledgeResult {
  materials: any[];
  knowledgeEntries: KnowledgeEntry[];
  relationships: MaterialRelationship[];
  metadata?: any;
}

interface QueryRoutingOptions {
  query: string;
  materialType?: string;
  filters?: Record<string, any>;
  strategy?: 'hybrid' | 'vector_first' | 'knowledge_first' | 'balanced';
}

interface SemanticKnowledgeOrganization {
  queryTheme: string;
  primaryCategories: string[];
  categoryDistribution: Record<string, any>;
  categoryContents: Record<string, string[]>;
}
// Import types
interface DenseEmbedding {
  vector: number[];
  dimensions: number;
}

interface SparseEmbedding {
  indices: number[];
  values: number[];
  dimensions: number;
}

interface EmbeddingMetadata {
  text_length: number;
  method: 'dense' | 'sparse' | 'hybrid';
  material_category?: string;
  processing_time: number;
  timestamp: number;
}

interface EmbeddingResult {
  dense_vector?: number[];
  sparse_indices?: number[];
  sparse_values?: number[];
  dense_dimensions?: number;
  sparse_dimensions?: number;
  material_category?: string;
  processing_time?: number;
  error?: string;
}

interface SearchOptions {
  query: string;
  materialType?: string;
  limit?: number;
  threshold?: number;
  denseWeight?: number;
  useSpecializedIndex?: boolean;
}

interface SearchResult {
  id: string;
  name: string;
  materialType: string;
  similarity: number;
  matchedBy: 'text' | 'vector' | 'hybrid';
}

interface VectorSearchConfig {
  id: string;
  name: string;
  description?: string;
  denseWeight: number;
  indexType: string;
  indexParameters: Record<string, any>;
  materialType?: string;
  modelPath?: string;
}

/**
 * Enhanced Vector Service Class
 */
export class EnhancedVectorService {
  private pythonPath: string;
  private scriptPath: string;
  private configCache: Map<string, VectorSearchConfig> = new Map();
  private knowledgeBaseService?: KnowledgeBaseService;

  constructor(knowledgeBaseService?: KnowledgeBaseService) {
    // Set paths to Python executable and script
    this.pythonPath = process.env.PYTHON_PATH || 'python';
    // Use relative path from project root instead of __dirname
    this.scriptPath = path.resolve(process.cwd(), 'packages/ml/python/enhanced_text_embeddings.py');

    // Validate that the script exists
    if (!fs.existsSync(this.scriptPath)) {
      logger.warn(`Enhanced text embeddings script not found at ${this.scriptPath}`);
    }

    // Initialize config cache
    this.loadConfigsFromDatabase();

    // Set knowledge base service if provided
    this.knowledgeBaseService = knowledgeBaseService;
  }
  /**
   * Set the knowledge base service instance
   */
  public setKnowledgeBaseService(service: KnowledgeBaseService): void {
    this.knowledgeBaseService = service;
  }

  /**
   * Call a Python module with specified method and arguments
   */
  private async invokePythonModule(
    moduleName: string,
    method: string,
    args: Record<string, any>
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      // Prepare command
      const scriptPath = path.resolve(process.cwd(), `packages/ml/python/${moduleName}`);

      // Check if script exists
      if (!fs.existsSync(scriptPath)) {
        return reject(new Error(`Python module not found at ${scriptPath}`));
      }

      // Prepare arguments
      const pythonArgs = [
        scriptPath,
        '--method', method,
        '--args', JSON.stringify(args)
      ];

      // Spawn Python process
      const pythonProcess = childProcess.spawn(this.pythonPath, pythonArgs);

      let outputData = '';
      let errorData = '';

      // Handle stdout data
      if (pythonProcess.stdout) {
        pythonProcess.stdout.on('data', (data: Buffer) => {
          outputData += data.toString();
        });
      }

      // Handle stderr data
      if (pythonProcess.stderr) {
        pythonProcess.stderr.on('data', (data: Buffer) => {
          errorData += data.toString();
        });
      }

      // Handle process completion
      pythonProcess.on('close', (code: number) => {
        if (code !== 0) {
          logger.error(`Failed to execute Python module: ${errorData}`);
          return reject(new Error(`Failed to execute Python module: ${errorData}`));
        }

        try {
          const result = JSON.parse(outputData);
          resolve(result);
        } catch (error) {
          logger.error(`Failed to parse Python module result: ${error}`);
          reject(new Error(`Failed to parse Python module result: ${error}`));
        }
      });
    });
  }
  /**
   * Load vector search configurations from the database
   */
  private async loadConfigsFromDatabase(): Promise<void> {
    try {
      // Use the Supabase client to get configurations
      const result = await supabaseClient.getClient()
        .from('vector_search_config')
        .select('*');

      const { data, error } = result;
  /**
   * Search for materials with enhanced knowledge base integration
   * @param {string} query - Natural language query
   * @param {string} [materialType] - Optional material type filter
   * @param {Record<string, any>} [filters] - Additional filters
   * @param {number} [limit=10] - Maximum number of results
   * @param {boolean} [includeKnowledge=true] - Whether to include knowledge entries
   * @param {boolean} [includeRelationships=true] - Whether to include material relationships
   * @returns {Promise<SearchWithKnowledgeResult>} - Search results with knowledge integration
   */
  public async searchMaterialsWithKnowledge(
    query: string,
    materialType?: string,
    filters?: Record<string, any>,
    limit: number = 10,
    includeKnowledge: boolean = true,
    includeRelationships: boolean = true
  ): Promise<SearchWithKnowledgeResult> {
    try {
      // Call the hybrid retriever Python module
      const result = await this.invokePythonModule('hybrid_retriever.py', 'retrieve', {
        query,
        material_type: materialType,
        filters: filters || {},
        limit,
        include_knowledge: includeKnowledge,
        include_relationships: includeRelationships
      });

      if (result) {
        return {
          materials: result.results || [],
          knowledgeEntries: result.knowledge_entries || [],
          relationships: result.relationships || [],
          metadata: result.metadata || {}
        };
      }

      return {
        materials: [],
        knowledgeEntries: [],
        relationships: [],
        metadata: {}
      };
    } catch (error) {
      logger.error(`Failed to search materials with knowledge: ${error}`);

      // Fall back to standard search and add empty knowledge
      const materials = await this.searchMaterials(query, materialType, filters, limit);

      return {
        materials,
        knowledgeEntries: [],
        relationships: [],
        metadata: { error: `${error}` }
      };
    }
  }
      if (error) {
        throw error;
      }

      // Cache the configurations
      if (data) {
        for (const config of data) {
          this.configCache.set(config.name, {
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

        logger.info(`Loaded ${data.length} vector search configurations from database`);
      }
    } catch (error) {
      logger.error(`Failed to load vector search configurations: ${error}`);
      // Initialize with default config if loading fails
      this.configCache.set('default', {
        id: 'default',
        name: 'default',
        denseWeight: 0.7,
        indexType: 'hnsw',
        indexParameters: { m: 16, ef_construction: 64, ef_search: 40 }
      });
    }
  }
  /**
   * Find similar materials with knowledge integration
   * @param {string} materialId - Material ID to find similar items to
   * @param {string} [materialType] - Optional material type filter
   * @param {number} [limit=10] - Maximum number of results
   * @param {boolean} [includeKnowledge=true] - Whether to include knowledge entries
   * @returns {Promise<SearchWithKnowledgeResult>} - Similar materials with knowledge integration
   */
  public async findSimilarMaterialsWithKnowledge(
    materialId: string,
    materialType?: string,
    limit: number = 10,
    includeKnowledge: boolean = true
  ): Promise<SearchWithKnowledgeResult> {
    try {
      // Call the Python module to find similar materials with knowledge integration
      const result = await this.invokePythonModule('hybrid_retriever.py', 'find_similar_by_id', {
        material_id: materialId,
        material_type: materialType,
        limit,
        include_knowledge: includeKnowledge,
        include_relationships: true
      });

      if (result) {
        return {
          materials: result.results || [],
          knowledgeEntries: result.knowledge_entries || [],
          relationships: result.relationships || [],
          metadata: result.metadata || {}
        };
      }

      return {
        materials: [],
        knowledgeEntries: [],
        relationships: [],
        metadata: {}
      };
    } catch (error) {
      logger.error(`Failed to find similar materials with knowledge: ${error}`);

      // Fall back to standard search
      const materials = await this.findSimilarMaterials(materialId, materialType, limit);

      return {
        materials,
        knowledgeEntries: [],
        relationships: [],
        metadata: { error: `${error}` }
      };
    }
  }

  /**
   * Route a query between vector search and knowledge base based on the query type
   * @param {QueryRoutingOptions} options - Query routing options
   * @returns {Promise<SearchWithKnowledgeResult>} - Combined results from appropriate sources
   */
  public async routeQuery(options: QueryRoutingOptions): Promise<SearchWithKnowledgeResult> {
    try {
      const { query, materialType, filters, strategy = 'hybrid' } = options;

      // Call the context assembler for intelligent query routing
      const result = await this.invokePythonModule('context_assembler.py', 'route_query', {
        query,
        material_type: materialType,
        filters: filters || {},
        strategy
      });

      if (result) {
        return {
          materials: result.results || [],
          knowledgeEntries: result.knowledge_entries || [],
          relationships: result.relationships || [],
          metadata: {
            searchStrategy: result.search_strategy,
            queryType: result.query_type,
            ...result.metadata
          }
        };
      }

      // Fall back to standard search if Python module fails
      const materials = await this.searchMaterials(query, materialType, filters);

      return {
        materials,
        knowledgeEntries: [],
        relationships: [],
        metadata: {
          searchStrategy: 'vector_only',
          queryType: 'fallback',
          error: 'Failed to route query through Python module'
        }
      };
    } catch (error) {
      logger.error(`Error routing query: ${error}`);

      // Fall back to standard search in case of errors
      const materials = await this.searchMaterials(options.query, options.materialType, options.filters);

      return {
        materials,
        knowledgeEntries: [],
        relationships: [],
        metadata: {
          searchStrategy: 'vector_only',
          queryType: 'error_fallback',
          error: `${error}`
        }
      };
    }
  }

  /**
   * Get knowledge entries related to a material with enhanced bidirectional linking
   * @param {string} materialId - Material ID
   * @param {string} [query] - Optional query for semantic filtering
   * @param {number} [limit=5] - Maximum number of entries
   * @returns {Promise<any>} - Knowledge entries and related materials
   */
  public async getMaterialKnowledge(
    materialId: string,
    query?: string,
    limit: number = 5
  ): Promise<any> {
    try {
      // Check if we have the knowledge base service available
      if (!this.knowledgeBaseService) {
        throw new Error('Knowledge base service not available');
      }

      // Call the context assembler to get related knowledge
      const result = await this.invokePythonModule('context_assembler.py', 'get_related_knowledge', {
        material_id: materialId,
        limit,
        query: query || '',
        include_relationships: true
      });

      return result || {
        entries: [],
        relationships: [],
        metadata: { material_id: materialId }
      };
    } catch (error) {
      logger.error(`Error getting material knowledge: ${error}`);

      // Try to fall back to knowledge base service directly
      if (this.knowledgeBaseService) {
        try {
          const entries = await this.knowledgeBaseService.getEntriesForMaterial(materialId, limit);

          return {
            entries,
            relationships: [],
            metadata: {
              material_id: materialId,
              fallback: true,
              error: `${error}`
            }
          };
        } catch (kbError) {
          logger.error(`Error in fallback knowledge retrieval: ${kbError}`);
        }
      }

      return {
        entries: [],
        relationships: [],
        metadata: {
          material_id: materialId,
          error: `${error}`
        }
      };
    }
  }

  /**
   * Assemble an enhanced context from materials and knowledge entries
   * @param {any[]} materials - Material data
   * @param {string} query - User query
   * @param {Record<string, any>} [userContext] - Additional user context
   * @returns {Promise<any>} - Assembled context
   */
  public async assembleContext(
    materials: any[],
    query: string,
    userContext?: Record<string, any>
  ): Promise<any> {
    try {
      // Call the context assembler to organize and structure the context
      const result = await this.invokePythonModule('context_assembler.py', 'assemble_context', {
        retrieved_materials: materials,
        query,
        user_context: userContext || {}
      });

      return result || {
        error: 'Failed to assemble context',
        query,
        materials_count: materials.length
      };
    } catch (error) {
      logger.error(`Error assembling context: ${error}`);

      // Return a minimal context in case of error
      return {
        query,
        materials,
        error: `${error}`,
        materials_count: materials.length
      };
    }
  }

  /**
   * Create a semantic knowledge organization for a set of knowledge entries
   * @param {KnowledgeEntry[]} knowledgeEntries - Knowledge entries to organize
   * @param {string} query - User query for context
   * @returns {Promise<SemanticKnowledgeOrganization>} - Semantic organization
   */
  public async createSemanticKnowledgeOrganization(
    knowledgeEntries: KnowledgeEntry[],
    query: string
  ): Promise<SemanticKnowledgeOrganization> {
    try {
      // Call the context assembler to create semantic organization
      const result = await this.invokePythonModule('context_assembler.py', 'create_semantic_knowledge_organization', {
        knowledge_facts: knowledgeEntries,
        query
      });

      if (result) {
        return {
          queryTheme: result.query_theme || 'general_information',
          primaryCategories: result.primary_categories || [],
          categoryDistribution: result.category_distribution || {},
          categoryContents: result.category_contents || {}
        };
      }

      // Return default organization if Python module fails
      return this.createDefaultSemanticOrganization(knowledgeEntries, query);
    } catch (error) {
      logger.error(`Error creating semantic organization: ${error}`);

      // Create a basic organization as fallback
      return this.createDefaultSemanticOrganization(knowledgeEntries, query);
    }
  }

  /**
   * Create a default semantic organization in case of errors
   */
  private createDefaultSemanticOrganization(
    knowledgeEntries: KnowledgeEntry[],
    query: string
  ): SemanticKnowledgeOrganization {
    // Group entries by material ID
    const entriesByMaterial: Record<string, string[]> = {};

    for (const entry of knowledgeEntries) {
      if (!entriesByMaterial[entry.materialId]) {
        entriesByMaterial[entry.materialId] = [];
      }
      entriesByMaterial[entry.materialId].push(entry.id);
    }

    return {
      queryTheme: 'general_information',
      primaryCategories: ['by_material'],
      categoryDistribution: {
        by_material: {
          count: Object.keys(entriesByMaterial).length,
          percentage: 1.0
        }
      },
      categoryContents: {
        by_material: Object.values(entriesByMaterial).flat()
      }
    };
  }
  /**
   * Get configuration for the specified material type or config name
   */
  private getConfig(configName: string = 'default', materialType?: string): VectorSearchConfig {
    // Try to get material type specific config first
    if (materialType) {
      for (const [, config] of this.configCache.entries()) {
        if (config.materialType === materialType) {
          return config;
        }
      }
    }

    // Try to get the specified config
    if (this.configCache.has(configName)) {
      return this.configCache.get(configName)!;
    }

    // Fall back to default config
    if (this.configCache.has('default')) {
      return this.configCache.get('default')!;
    }

    // Create and return a default config if nothing else is available
    return {
      id: 'default',
      name: 'default',
      denseWeight: 0.7,
      indexType: 'hnsw',
      indexParameters: { m: 16, ef_construction: 64, ef_search: 40 }
    };
  }

  /**
   * Generate text embeddings using the Python script
   */
  public async generateEmbedding(
    text: string,
    options: {
      method?: 'dense' | 'sparse' | 'hybrid';
      denseModel?: string;
      denseDimensions?: number;
      sparseMethod?: 'tfidf' | 'bm25' | 'count';
      sparseFeatures?: number;
      materialCategory?: string;
    } = {}
  ): Promise<EmbeddingResult> {
    return new Promise((resolve, reject) => {
      // Set default options
      const method = options.method || 'hybrid';
      const denseModel = options.denseModel || 'all-MiniLM-L6-v2';
      const denseDimensions = options.denseDimensions || 384;
      const sparseMethod = options.sparseMethod || 'tfidf';
      const sparseFeatures = options.sparseFeatures || 10000;
      const materialCategory = options.materialCategory;

      // Validate that the script exists
      if (!fs.existsSync(this.scriptPath)) {
        return reject(new Error(`Enhanced text embeddings script not found at ${this.scriptPath}`));
      }

      // Prepare command
      const args = [
        this.scriptPath,
        text,
        '--method', method,
        '--dense-model', denseModel,
        '--dense-dimensions', denseDimensions.toString(),
        '--sparse-method', sparseMethod,
        '--sparse-features', sparseFeatures.toString(),
        '--pgvector-format'
      ];

      if (materialCategory) {
        args.push('--material-category', materialCategory);
      }

      // Spawn Python process (using require-style import)
      const pythonProcess = childProcess.spawn(this.pythonPath, args);

      let outputData = '';
      let errorData = '';

      // Handle stdout data with explicit type
      if (pythonProcess.stdout) {
        pythonProcess.stdout.on('data', (data: Buffer) => {
          outputData += data.toString();
        });
      }

      // Handle stderr data with explicit type
      if (pythonProcess.stderr) {
        pythonProcess.stderr.on('data', (data: Buffer) => {
          errorData += data.toString();
        });
      }

      // Handle process completion with explicit type
      pythonProcess.on('close', (code: number) => {
        if (code !== 0) {
          logger.error(`Failed to generate embedding: ${errorData}`);
          return reject(new Error(`Failed to generate embedding: ${errorData}`));
        }

        try {
          const result = JSON.parse(outputData);
          resolve(result);
        } catch (error) {
          logger.error(`Failed to parse embedding result: ${error}`);
          reject(new Error(`Failed to parse embedding result: ${error}`));
        }
      });
    });
  }

  /**
   * Store embeddings in the database
   */
  public async storeEmbedding(
    materialId: string,
    embeddingResult: EmbeddingResult,
    text: string
  ): Promise<boolean> {
    try {
      // Extract embeddings from result
      const { dense_vector, sparse_indices, sparse_values, dense_dimensions, sparse_dimensions, material_category, processing_time } = embeddingResult;

      // Prepare sparse embedding JSON if available
      let sparseEmbedding = null;
      if (sparse_indices && sparse_values) {
        sparseEmbedding = {
          indices: sparse_indices,
          values: sparse_values,
          dimensions: sparse_dimensions
        };
      }

      // Prepare metadata
      const metadata = {
        text_length: text.length,
        method: sparse_indices && dense_vector ? 'hybrid' : (dense_vector ? 'dense' : 'sparse'),
        material_category,
        processing_time,
        timestamp: Date.now()
      };

      // Using ts-ignore to bypass TypeScript warning about chained methods
      const updateQuery = supabaseClient.getClient()
        .from('materials')
        .update({
          dense_embedding: dense_vector,
          sparse_embedding: sparseEmbedding,
          embedding_metadata: metadata,
          embedding_method: metadata.method,
          embedding_quality: 1.0 // Default quality, can be updated later
        });

      // @ts-ignore - Ignoring TypeScript error for method chain
      const { error } = await updateQuery.eq('id', materialId);

      if (error) {
        throw error;
      }

      // Log metrics
      await this.logEmbeddingMetrics(materialId, embeddingResult, text);

      return true;
    } catch (error) {
      logger.error(`Failed to store embedding: ${error}`);
      return false;
    }
  }

  /**
   * Log embedding metrics to the database
   */
  private async logEmbeddingMetrics(
    materialId: string,
    embeddingResult: EmbeddingResult,
    text: string
  ): Promise<void> {
    try {
      const { dense_vector, sparse_indices, dense_dimensions, processing_time, material_category } = embeddingResult;

      // Determine embedding type
      const embeddingType = sparse_indices && dense_vector ? 'hybrid' : (dense_vector ? 'dense' : 'sparse');

      // Calculate quality score (placeholder for now)
      const qualityScore = 1.0;

      // Insert metrics record
      const { error } = await supabaseClient.getClient()
        .from('embedding_metrics')
        .insert({
          material_id: materialId,
          embedding_type: embeddingType,
          model_name: 'all-MiniLM-L6-v2', // Default model, should be parameterized
          dimensions: dense_dimensions,
          quality_score: qualityScore,
          processing_time_ms: processing_time ? processing_time * 1000 : 0,
          metrics: {
            text_length: text.length,
            material_category,
            timestamp: Date.now()
          }
        });

      if (error) {
        throw error;
      }
    } catch (error) {
      logger.error(`Failed to log embedding metrics: ${error}`);
      // Non-critical failure, don't propagate error
    }
  }

  /**
   * Search for materials using the hybrid search functionality
   */
  public async searchMaterials(options: SearchOptions): Promise<SearchResult[]> {
    try {
      const {
        query,
        materialType,
        limit = 10,
        threshold = 0.5,
        denseWeight = 0.7,
        useSpecializedIndex = true
      } = options;

      // Get the appropriate config
      const configName = materialType ? materialType : 'default';
      const config = this.getConfig(configName, materialType);

      // Measure query time for metrics
      const startTime = Date.now();

      let results: SearchResult[] = [];

      // Determine if we should use specialized index or direct query
      if (useSpecializedIndex && materialType) {
        // Call the material_hybrid_search function
        const { data, error } = await supabaseClient.getClient()
          .rpc('material_hybrid_search', {
            query_text: query,
            material_type: materialType,
            max_results: limit,
            config_name: config.name
          });

        if (error) {
          throw error;
        }

        // Transform results to standard format
        if (data) {
          results = data.map((item: any) => ({
            id: item.id,
            name: item.name,
            materialType: item.material_type,
            similarity: item.similarity,
            matchedBy: item.matched_by as 'text' | 'vector' | 'hybrid'
          }));
        }
      } else {
        // Generate embedding for the query
        const embeddingResult = await this.generateEmbedding(query, {
          method: 'hybrid',
          materialCategory: materialType
        });

        if (!embeddingResult.dense_vector) {
          throw new Error('Failed to generate embedding for query');
        }

        // Prepare sparse embedding
        let sparseEmbedding = null;
        if (embeddingResult.sparse_indices && embeddingResult.sparse_values) {
          sparseEmbedding = {
            indices: embeddingResult.sparse_indices,
            values: embeddingResult.sparse_values,
            dimensions: embeddingResult.sparse_dimensions
          };
        }

        // Call the find_similar_materials_hybrid function
        const { data, error } = await supabaseClient.getClient()
          .rpc('find_similar_materials_hybrid', {
            dense_query_vector: embeddingResult.dense_vector,
            sparse_query_vector: sparseEmbedding,
            similarity_threshold: threshold,
            max_results: limit,
            material_type_filter: materialType,
            dense_weight: config.denseWeight
          });

        if (error) {
          throw error;
        }

        // Transform results to standard format
        if (data) {
          results = data.map((item: any) => ({
            id: item.id,
            name: item.name,
            materialType: item.material_type,
            similarity: item.similarity,
            matchedBy: 'hybrid' as 'hybrid'
          }));
        }
      }

      // Update metrics
      await this.updateSearchMetrics(config.id, Date.now() - startTime);

      return results;
    } catch (error) {
      logger.error(`Failed to search materials: ${error}`);
      throw error;
    }
  }

  /**
   * Update search metrics in the database
   */
  private async updateSearchMetrics(configId: string, queryTimeMs: number): Promise<void> {
    try {
      // Get current metrics
      const query = supabaseClient.getClient()
        .from('vector_search_config')
        .select('queries_count, average_query_time_ms');

      // @ts-ignore - Ignoring TypeScript error for method chain
      const { data, error } = await query.eq('id', configId).single();

      if (error) {
        throw error;
      }

      // Calculate new average
      const prevCount = data?.queries_count || 0;
      const prevAverage = data?.average_query_time_ms || 0;

      let newAverage = queryTimeMs;
      if (prevCount > 0) {
        newAverage = ((prevAverage * prevCount) + queryTimeMs) / (prevCount + 1);
      }

      // Update metrics
      const updateQuery = supabaseClient.getClient()
        .from('vector_search_config')
        .update({
          queries_count: prevCount + 1,
          average_query_time_ms: newAverage,
          last_updated_at: new Date().toISOString()
        });

      // @ts-ignore - Ignoring TypeScript error for method chain
      const { error: updateError } = await updateQuery.eq('id', configId);

      if (updateError) {
        throw updateError;
      }
    } catch (error) {
      logger.error(`Failed to update search metrics: ${error}`);
      // Non-critical failure, don't propagate error
    }
  }

  /**
   * Find similar materials to a specific material
   */
  public async findSimilarMaterials(
    materialId: string,
    options: {
      limit?: number;
      threshold?: number;
      sameMaterialType?: boolean;
      denseWeight?: number;
    } = {}
  ): Promise<SearchResult[]> {
    try {
      const {
        limit = 10,
        threshold = 0.5,
        sameMaterialType = false,
        denseWeight
      } = options;

      // Get the material's embeddings
      const query = supabaseClient.getClient()
        .from('materials')
        .select('id, name, material_type, dense_embedding, sparse_embedding');

      // @ts-ignore - Ignoring TypeScript error for method chain
      const { data: material, error: materialError } = await query.eq('id', materialId).single();

      if (materialError) {
        throw materialError;
      }

      if (!material || !material.dense_embedding) {
        throw new Error('Material does not have embeddings');
      }

      // Get the appropriate config
      const config = this.getConfig('default', material.material_type);
      const effectiveDenseWeight = denseWeight !== undefined ? denseWeight : config.denseWeight;

      // Measure query time for metrics
      const startTime = Date.now();

      // Call the find_similar_materials_hybrid function
      const { data, error } = await supabaseClient.getClient()
        .rpc('find_similar_materials_hybrid', {
          dense_query_vector: material.dense_embedding,
          sparse_query_vector: material.sparse_embedding,
          similarity_threshold: threshold,
          max_results: limit + 1, // Add 1 to account for the source material
          material_type_filter: sameMaterialType ? material.material_type : null,
          dense_weight: effectiveDenseWeight
        });

      if (error) {
        throw error;
      }

      // Filter out the source material and transform results
      const results = data
        ? data
            .filter((item: any) => item.id !== materialId)
            .slice(0, limit)
            .map((item: any) => ({
              id: item.id,
              name: item.name,
              materialType: item.material_type,
              similarity: item.similarity,
              matchedBy: 'hybrid' as 'hybrid'
            }))
        : [];

      // Update metrics
      await this.updateSearchMetrics(config.id, Date.now() - startTime);

      return results;
    } catch (error) {
      logger.error(`Failed to find similar materials: ${error}`);
      throw error;
    }
  }

  /**
   * Refresh the materialized views for vector search
   */
  public async refreshVectorViews(): Promise<boolean> {
    try {
      const { error } = await supabase.getClient()
        .rpc('refresh_vector_materialized_views');

      if (error) {
        throw error;
      }

      logger.info('Successfully refreshed vector materialized views');
      return true;
    } catch (error) {
      logger.error(`Failed to refresh vector materialized views: ${error}`);
      return false;
    }
  }

  /**
   * Get vector search performance statistics
   */
  public async getPerformanceStats(): Promise<any> {
    try {
      const { data, error } = await supabase.getClient()
        .from('vector_search_performance')
        .select('*');

      if (error) {
        throw handleSupabaseError(error, 'getPerformanceStats');
      }

      return data;
    } catch (error) {
      throw handleSupabaseError(error, 'getPerformanceStats');
    }
  }

  /**
   * Update or create a vector search configuration
   */
  public async updateSearchConfig(config: Partial<VectorSearchConfig> & { name: string }): Promise<VectorSearchConfig> {
    try {
      // Format for database
      const dbConfig = {
        name: config.name,
        description: config.description,
        dense_weight: config.denseWeight,
        index_type: config.indexType,
        index_parameters: config.indexParameters,
        material_type: config.materialType,
        model_path: config.modelPath
      };

      // Check if config exists
      const checkQuery = supabase.getClient()
        .from('vector_search_config')
        .select('id');

      // @ts-ignore - Ignoring TypeScript error for method chain
      const { data: existingConfig, error: checkError } = await checkQuery.eq('name', config.name).maybeSingle();

      if (checkError) {
        throw checkError;
      }

      let result;

      if (existingConfig) {
        // Update existing config
        const updateQuery = supabase.getClient()
          .from('vector_search_config')
          .update(dbConfig);

        // @ts-ignore - Ignoring TypeScript error for method chain
        const { data, error } = await updateQuery.eq('id', existingConfig.id).select().single();

        if (error) {
          throw error;
        }

        result = data;
      } else {
        // Create new config
        const insertQuery = supabase.getClient()
          .from('vector_search_config')
          .insert(dbConfig);

        // @ts-ignore - Ignoring TypeScript error for method chain
        const { data, error } = await insertQuery.select().single();

        if (error) {
          throw error;
        }

        result = data;
      }

      // Update cache
      if (result) {
        this.configCache.set(result.name, {
          id: result.id,
          name: result.name,
          description: result.description,
          denseWeight: result.dense_weight,
          indexType: result.index_type,
          indexParameters: result.index_parameters,
          materialType: result.material_type,
          modelPath: result.model_path
        });

        return this.configCache.get(result.name)!;
      } else {
        throw new Error('Failed to get result from database operation');
      }
    } catch (error) {
      logger.error(`Failed to update search config: ${error}`);
      throw error;
    }
  }

  /**
   * Delete a vector search configuration
   */
  public async deleteSearchConfig(configName: string): Promise<boolean> {
    try {
      // Don't allow deleting the default config
      if (configName === 'default') {
        throw new Error('Cannot delete the default configuration');
      }

      // Delete the configuration
      const deleteQuery = supabase.getClient()
        .from('vector_search_config')
        .delete();

      // @ts-ignore - Ignoring TypeScript error for method chain
      const { error } = await deleteQuery.eq('name', configName);

      if (error) {
        throw error;
      }

      // Remove from cache
      this.configCache.delete(configName);

      return true;
    } catch (error) {
      logger.error(`Failed to delete search config: ${error}`);
      throw error;
    }
  }

  /**
   * Get all vector search configurations
   */
  public async getSearchConfigs(): Promise<VectorSearchConfig[]> {
    try {
      const { data, error } = await supabase.getClient()
        .from('vector_search_config')
        .select('*');

      if (error) {
        throw error;
      }

      // Transform to our format
      if (data) {
        return data.map((config: any) => ({
          id: config.id,
          name: config.name,
          description: config.description,
          denseWeight: config.dense_weight,
          indexType: config.index_type,
          indexParameters: config.index_parameters,
          materialType: config.material_type,
          modelPath: config.model_path
        }));
      }

      return [];
    } catch (error) {
      logger.error(`Failed to get search configs: ${error}`);
      throw error;
    }
  }

  /**
   * Compare similarity between two texts
   */
  public async compareSimilarity(text1: string, text2: string): Promise<number> {
    try {
      // Generate embeddings for both texts
      const [embedding1, embedding2] = await Promise.all([
        this.generateEmbedding(text1),
        this.generateEmbedding(text2)
      ]);

      // Check that embeddings were generated successfully
      if (!embedding1.dense_vector || !embedding2.dense_vector) {
        throw new Error('Failed to generate embeddings');
      }

      // Make absolutely sure both dense vectors exist and are arrays
      const denseVector1 = embedding1.dense_vector;
      const denseVector2 = embedding2.dense_vector;

      // Compute cosine similarity between dense vectors
      const dotProduct = denseVector1.reduce((sum, val, i) => {
        // Explicitly check index bounds
        if (i < denseVector2.length) {
          // @ts-ignore - TypeScript doesn't know denseVector2 is defined here
          return sum + val * denseVector2[i];
        }
        return sum;
      }, 0);

      const norm1 = Math.sqrt(denseVector1.reduce((sum, val) => sum + val * val, 0));
      const norm2 = Math.sqrt(denseVector2.reduce((sum, val) => sum + val * val, 0));

      if (norm1 === 0 || norm2 === 0) {
        return 0;
      }

      // Return cosine similarity
      return dotProduct / (norm1 * norm2);
    } catch (error) {
      logger.error(`Failed to compare similarity: ${error}`);
      throw error;
    }
  }
}

// Export singleton instance
export const enhancedVectorService = new EnhancedVectorService();
export default enhancedVectorService;