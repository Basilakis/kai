/**
 * Supabase Hybrid Search Service
 * 
 * Combines vector similarity search with full-text search for improved results.
 * This implementation leverages both PostgreSQL's text search capabilities and
 * pgvector extension to provide more relevant search results.
 */
import { supabaseClient } from './supabaseClient';
import { logger } from '../../utils/logger';
import { SupabaseVectorSearch } from './vector-search';

// Hybrid search configuration
interface HybridSearchConfig {
  // Text search parameters
  textQuery: string;
  
  // Vector search parameters
  embedding: number[];
  
  // Weights for combining scores (should sum to 1.0)
  textWeight?: number;
  vectorWeight?: number;
  
  // Number of results to return (default: 10)
  limit?: number;
  
  // Minimum combined score threshold (0.0 to 1.0)
  threshold?: number;
  
  // Optional filters to apply to search
  filters?: Record<string, any>;
}

// Default hybrid search configuration
const DEFAULT_CONFIG = {
  textWeight: 0.5,
  vectorWeight: 0.5,
  limit: 10,
  threshold: 0.3
};

/**
 * Hybrid Search Service for Supabase
 * Combines full-text search and vector similarity search for better results
 */
export class SupabaseHybridSearch {
  private vectorSearch: SupabaseVectorSearch;
  
  constructor() {
    this.vectorSearch = new SupabaseVectorSearch();
  }
  
  /**
   * Perform hybrid search using both text search and vector similarity
   * 
   * @param config Search configuration
   * @param tableName The table to search in
   * @param textColumns Array of columns to use for text search
   * @param vectorColumn Column name for vector embeddings
   * @returns Array of results with scores
   */
  async search(
    config: HybridSearchConfig,
    tableName: string,
    textColumns: string[] = ['name', 'description'],
    vectorColumn: string = 'embedding'
  ) {
    try {
      // Merge with default config
      const mergedConfig = { ...DEFAULT_CONFIG, ...config };
      const {
        textQuery,
        embedding,
        textWeight,
        vectorWeight,
        limit,
        threshold,
        filters
      } = mergedConfig;
      
      // Get Supabase client
      const client = supabaseClient.getClient();
      
      // Verify weights sum to 1.0 (approximately)
      if (Math.abs(textWeight + vectorWeight - 1.0) > 0.001) {
        logger.warn(`Hybrid search weights don't sum to 1.0: text=${textWeight}, vector=${vectorWeight}`);
      }
      
      // For materials table use specialized function
      if (tableName === 'materials' && filters && 'material_type' in filters) {
        const { data, error } = await client.rpc('hybrid_search_materials', {
          query_text: textQuery,
          query_embedding: embedding,
          text_weight: textWeight,
          vector_weight: vectorWeight,
          match_count: limit,
          material_type: filters.material_type || null
        });
        
        if (error) {
          logger.error(`Hybrid search materials error: ${error.message}`);
          throw error;
        }
        
        return data;
      }
      
      // Call the generic hybrid_search PostgreSQL function
      const { data, error } = await client.rpc('hybrid_search', {
        query_text: textQuery,
        query_embedding: embedding,
        table_name: tableName,
        text_columns: textColumns,
        vector_column: vectorColumn,
        text_weight: textWeight,
        vector_weight: vectorWeight,
        match_count: limit,
        score_threshold: threshold,
        filter_obj: filters ? JSON.stringify(filters) : '{}'
      });
      
      if (error) {
        logger.error(`Hybrid search error: ${error.message}`);
        throw error;
      }
      
      return data;
    } catch (error) {
      logger.error(`Hybrid search failed: ${error}`);
      throw error;
    }
  }
}

// Export singleton instance
export const hybridSearch = new SupabaseHybridSearch();
export default hybridSearch;