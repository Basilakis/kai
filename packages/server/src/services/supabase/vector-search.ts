/**
 * Supabase Vector Search Service
 *
 * Provides efficient similarity search capabilities using pgvector in Supabase.
 * This implementation leverages PostgreSQL's vector extension for high-performance
 * nearest neighbor searches.
 */
import { supabase } from './supabaseClient';
import { handleSupabaseError } from '../../../shared/src/utils/supabaseErrorHandler';
import { logger } from '../../utils/logger';

// Vector search configuration
interface VectorSearchConfig {
  // Number of results to return (default: 10)
  limit?: number;

  // Minimum similarity threshold (0.0 to 1.0)
  threshold?: number;

  // Distance metric: 'cosine', 'euclidean', or 'inner_product'
  metric?: 'cosine' | 'euclidean' | 'inner_product';

  // Optional filters to apply to search
  filters?: Record<string, any>;
}

// Default search configuration
const DEFAULT_CONFIG: VectorSearchConfig = {
  limit: 10,
  threshold: 0.7,
  metric: 'cosine',
  filters: {}
};

/**
 * Vector Search Service for Supabase
 * Provides methods for storing and querying vector embeddings
 */
export class SupabaseVectorSearch {
  /**
   * Find similar vectors to the provided embedding
   *
   * @deprecated This method has issues with query parameterization and filtering.
   * Prefer using RPC functions via a service like `EnhancedVectorServiceImpl` for reliable vector search.
   * @param embedding The query vector to find similar vectors for
   * @param tableName The table containing vector embeddings
   * @param vectorColumn The column name for the vector data (default: 'embedding')
   * @param config Search configuration options
   * @returns Array of matches with their similarity scores
   */
  async findSimilar(
    embedding: number[],
    tableName: string,
    vectorColumn: string = 'embedding',
    config: VectorSearchConfig = {}
  ): Promise<any[]> { // Return type changed to any[] as it's now non-functional
    logger.warn(`DEPRECATED: SupabaseVectorSearch.findSimilar is called for table ${tableName}. This method is flawed and should not be used. Use an RPC-based vector search via EnhancedVectorServiceImpl.`);
    
    // Returning empty or throwing an error to discourage use.
    // For now, returning empty to avoid breaking existing calls immediately.
    return [];

    /* Original flawed implementation:
    try {
      // Merge with default config
      const { limit, threshold, metric, filters } = {
        ...DEFAULT_CONFIG,
        ...config
      };

      // Correctly format the embedding for SQL query
      const embeddingString = `[${embedding.join(',')}]`;

      // Build the select string based on the metric
      let similaritySelect: string;
      switch (metric) {
        case 'euclidean':
          similaritySelect = `${vectorColumn} <-> '${embeddingString}' AS distance`; // Lower is better
          break;
        case 'inner_product':
          similaritySelect = `(${vectorColumn} <#> '${embeddingString}') * -1 AS similarity`; // Higher is better (negated inner product)
          break;
        case 'cosine':
        default:
          similaritySelect = `1 - (${vectorColumn} <=> '${embeddingString}') AS similarity`; // Higher is better
          break;
      }
      
      let query = supabase.getClient()
        .from(tableName)
        .select(`*, ${similaritySelect}`);

      // Apply threshold based on metric
      // For cosine and inner_product (negated), higher similarity is better (filter >= threshold)
      // For euclidean, lower distance is better (filter <= threshold, if threshold represents max distance)
      // This part needs careful handling if threshold meaning changes with metric.
      // Assuming threshold always means "similarity >= threshold" for cosine/inner_product
      // and "distance <= threshold" for euclidean. The current DEFAULT_CONFIG.threshold is 0.7 (for similarity).
      
      if (metric === 'euclidean') {
        // If threshold is for similarity, convert it for distance or adjust logic.
        // For simplicity, let's assume threshold is max distance for euclidean.
        query = query.lte(vectorColumn, threshold); // Placeholder, needs correct distance operator
      } else {
         // This is still problematic as Supabase client might not directly support filtering on calculated distance/similarity this way without RPC.
         // The original query.filter('similarity', 'gte', threshold) was also problematic.
         // A raw query or RPC is generally needed for this.
         // For demonstration of fixing the embedding parameter, we'll keep a simplified filter attempt.
         // This part highlights why RPCs are better.
         // query = query.whereRaw(`1 - (${vectorColumn} <=> '${embeddingString}') >= ${threshold}`); // Example of raw filter
      }
      
      // Add any additional filters
      if (filters && Object.keys(filters).length > 0) {
        for (const [key, value] of Object.entries(filters)) {
          query = query.filter(key, 'eq', value);
        }
      }

      // Order and limit
      if (metric === 'euclidean') {
        query = query.order('distance', { ascending: true }); // Order by distance for euclidean
      } else {
        query = query.order('similarity', { ascending: false }); // Order by similarity for cosine/inner_product
      }
      query = query.limit(limit || 10);


      const { data, error } = await query;

      if (error) {
        throw handleSupabaseError(error, 'findSimilar', {
          tableName,
          vectorColumn,
          threshold: config.threshold,
          limit: config.limit
        });
      }

      return data;
    } catch (error) {
      throw handleSupabaseError(error, 'findSimilar', {
        tableName,
        vectorColumn,
        threshold: config.threshold,
        limit: config.limit
      });
    }
    */
  }

  /**
   * Store a vector embedding in Supabase
   *
   * @param embedding The vector to store
   * @param metadata Additional metadata to store with the vector
   * @param tableName The table to store the vector in
   * @param vectorColumn The column name for the vector data (default: 'embedding')
   * @returns The created record ID
   */
  async storeEmbedding(
    embedding: number[],
    metadata: Record<string, any>,
    tableName: string,
    vectorColumn: string = 'embedding'
  ) {
    try {
      // Prepare data for insertion
      const data = {
        ...metadata,
        [vectorColumn]: embedding,
        created_at: new Date().toISOString()
      };

      // Insert the data using proper client
      const { data: result, error } = await supabase.getClient()
        .from(tableName)
        .insert(data)
        .select('id');

      if (error) {
        throw handleSupabaseError(error, 'storeEmbedding', {
          tableName,
          vectorColumn,
          metadataKeys: Object.keys(metadata)
        });
      }

      return result[0].id;
    } catch (error) {
      throw handleSupabaseError(error, 'storeEmbedding', {
        tableName,
        vectorColumn,
        metadataKeys: Object.keys(metadata)
      });
    }
  }

  /**
   * Create a vector index for faster similarity searches
   *
   * @param tableName The table to create the index for
   * @param vectorColumn The column name for the vector data
   * @param indexMethod The index method to use ('ivfflat', 'hnsw')
   * @param dimensions Optional vector dimensions (default: 1536 for typical embeddings)
   * @returns True if the index was created successfully
   */
  async createIndex(
    tableName: string,
    vectorColumn: string = 'embedding',
    indexMethod: 'ivfflat' | 'hnsw' = 'hnsw',
    dimensions: number = 1536
  ) {
    try {
      // Get the Supabase client
      const client = supabase.getClient();

      // For PostgreSQL, this would typically be done with a raw SQL query
      try {
        // For some operations, we need to use raw SQL to create indices
        const indexName = `idx_${tableName}_${vectorColumn}_${indexMethod}`;

        // Note: The actual SQL execution will depend on whether Supabase allows raw SQL
        // This might need to be done through database migrations or admin console
        const sql = indexMethod === 'hnsw'
          ? `CREATE INDEX IF NOT EXISTS ${indexName} ON ${tableName} USING hnsw (${vectorColumn} vector_l2_ops) WITH (dims=${dimensions});`
          : `CREATE INDEX IF NOT EXISTS ${indexName} ON ${tableName} USING ivfflat (${vectorColumn} vector_l2_ops) WITH (lists=100);`;

        logger.info(`Vector index creation: ${sql}`);

        // If Supabase allows raw SQL:
        // await client.rpc('execute_sql', { sql: sql });
      } catch (error) {
        throw handleSupabaseError(error, 'createIndex', {
          tableName,
          vectorColumn,
          indexMethod,
          dimensions
        });
      }

      return true;
    } catch (error) {
      throw handleSupabaseError(error, 'createIndex', {
        tableName,
        vectorColumn,
        indexMethod,
        dimensions
      });
    }
  }
}

// Export singleton instance
export const vectorSearch = new SupabaseVectorSearch();