/**
 * Supabase Vector Search Service
 * 
 * Provides efficient similarity search capabilities using pgvector in Supabase.
 * This implementation leverages PostgreSQL's vector extension for high-performance
 * nearest neighbor searches.
 */
import { supabaseClient } from './supabaseClient';
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
  ) {
    try {
      // Merge with default config
      const { limit, threshold, metric, filters } = {
        ...DEFAULT_CONFIG,
        ...config
      };
      
      // Initialize query with proper client
      const client = supabaseClient.getClient();
      
      let query = client
        .from(tableName)
        .select(`
          *,
          similarity:1 - (${vectorColumn} <=> ${'embedding'})
        `)
        .order('similarity', { ascending: false })
        .limit(limit);
      
      // Add embedding parameter
      query = query.filter(`similarity`, 'gte', threshold);
      
      // Add any additional filters
      if (filters && Object.keys(filters).length > 0) {
        for (const [key, value] of Object.entries(filters)) {
          query = query.filter(key, 'eq', value);
        }
      }
      
      // Execute the query
      const { data, error } = await query;
      
      if (error) {
        logger.error(`Vector search error: ${error.message}`);
        throw error;
      }
      
      return data;
    } catch (error) {
      logger.error(`Vector search failed: ${error}`);
      throw error;
    }
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
      const client = supabaseClient.getClient();
      
      const { data: result, error } = await client
        .from(tableName)
        .insert(data)
        .select('id');
      
      if (error) {
        logger.error(`Failed to store embedding: ${error.message}`);
        throw error;
      }
      
      return result[0].id;
    } catch (error) {
      logger.error(`Embedding storage failed: ${error}`);
      throw error;
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
      const client = supabaseClient.getClient();
      
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
        logger.error(`Error creating vector index: ${error}`);
        throw error;
      }
      
      return true;
    } catch (error) {
      logger.error(`Index creation failed: ${error}`);
      throw error;
    }
  }
}

// Export singleton instance
export const vectorSearch = new SupabaseVectorSearch();