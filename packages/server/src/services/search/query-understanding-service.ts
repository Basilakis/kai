/**
 * Query Understanding Service
 * 
 * This service enhances search capabilities by using vector embeddings to understand
 * natural language queries and find semantically related content even without exact keyword matches.
 * It leverages Supabase Vector for storing and querying embeddings of previous queries,
 * common search terms, and semantic concepts.
 */

import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger';
import { supabaseClient } from '../supabase/supabaseClient';
import { vectorSearch } from '../supabase/vector-search';

/**
 * Query expansion result
 */
export interface ExpandedQuery {
  originalQuery: string;
  enhancedQuery: string;
  relatedTerms: string[];
  queryEmbedding: number[];
  confidence: number;
}

/**
 * Query understanding options
 */
export interface QueryUnderstandingOptions {
  expandSynonyms?: boolean;
  includeRelatedTerms?: boolean;
  domainContext?: string;
  minConfidence?: number;
  maxRelatedTerms?: number;
}

/**
 * Query context for personalization
 */
export interface QueryContext {
  userId?: string;
  userPreferences?: string[];
  recentSearches?: string[];
  recentlyViewedItems?: string[];
  domainSpecific?: Record<string, any>;
}

/**
 * Semantic concept entry
 */
interface SemanticConcept {
  id: string;
  term: string;
  embedding: number[];
  relatedTerms: string[];
  domainContext: string;
  popularity: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Query Understanding Service
 * 
 * Enhances search by understanding the semantic meaning of queries using vector embeddings
 */
export class QueryUnderstandingService {
  private static instance: QueryUnderstandingService;
  private embeddingTableName = 'semantic_concepts';
  private vectorColumnName = 'embedding';
  private queryHistoryTableName = 'query_history';
  
  private constructor() {
    logger.info('Query Understanding Service initialized');
    
    // Ensure tables and indices exist
    this.ensureTables().catch(error => {
      logger.error(`Failed to ensure tables: ${error}`);
    });
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(): QueryUnderstandingService {
    if (!QueryUnderstandingService.instance) {
      QueryUnderstandingService.instance = new QueryUnderstandingService();
    }
    return QueryUnderstandingService.instance;
  }
  
  /**
   * Ensure necessary tables and indices exist
   */
  private async ensureTables(): Promise<void> {
    try {
      const client = supabaseClient.getClient();
      
      // Create semantic concepts table if it doesn't exist
      await client.rpc('execute_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS ${this.embeddingTableName} (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            term TEXT NOT NULL,
            ${this.vectorColumnName} vector(384),
            related_terms TEXT[] DEFAULT '{}',
            domain_context TEXT DEFAULT 'general',
            popularity INTEGER DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
          
          CREATE INDEX IF NOT EXISTS idx_${this.embeddingTableName}_term 
            ON ${this.embeddingTableName}(term);
          
          CREATE INDEX IF NOT EXISTS idx_${this.embeddingTableName}_domain 
            ON ${this.embeddingTableName}(domain_context);
        `
      });
      
      // Create query history table if it doesn't exist
      await client.rpc('execute_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS ${this.queryHistoryTableName} (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id TEXT,
            query TEXT NOT NULL,
            ${this.vectorColumnName} vector(384),
            result_count INTEGER DEFAULT 0,
            clicked_results TEXT[] DEFAULT '{}',
            session_id TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
          
          CREATE INDEX IF NOT EXISTS idx_${this.queryHistoryTableName}_user_id 
            ON ${this.queryHistoryTableName}(user_id);
          
          CREATE INDEX IF NOT EXISTS idx_${this.queryHistoryTableName}_query 
            ON ${this.queryHistoryTableName}(query);
        `
      });
      
      // Create vector index if it doesn't exist
      await vectorSearch.createIndex(
        this.embeddingTableName,
        this.vectorColumnName,
        'hnsw',
        384
      );
      
      logger.info('Query understanding tables and indices are ready');
    } catch (error) {
      logger.error(`Failed to create tables: ${error}`);
      throw error;
    }
  }
  
  /**
   * Process and enhance a search query using semantic understanding
   * 
   * @param query Original search query
   * @param options Query understanding options
   * @param context User and session context for personalization
   * @returns Enhanced query with semantic understanding
   */
  public async enhanceQuery(
    query: string,
    options: QueryUnderstandingOptions = {},
    context?: QueryContext
  ): Promise<ExpandedQuery> {
    try {
      logger.info(`Enhancing query: "${query}"`);
      
      const {
        expandSynonyms = true,
        includeRelatedTerms = true,
        domainContext = 'general',
        minConfidence = 0.7,
        maxRelatedTerms = 5
      } = options;
      
      // Generate embedding for the query
      const queryEmbedding = await this.generateQueryEmbedding(query);
      
      // Find semantically similar concepts
      const similarConcepts = await this.findSimilarConcepts(
        queryEmbedding, 
        domainContext,
        minConfidence
      );
      
      // Extract related terms from similar concepts
      const relatedTerms: string[] = [];
      if (includeRelatedTerms && similarConcepts.length > 0) {
          // Flatten and deduplicate related terms
          const allRelatedTerms = new Set<string>();
          similarConcepts.forEach(concept => {
            (concept.related_terms || []).forEach((term: string) => {
              if (term.toLowerCase() !== query.toLowerCase()) {
                allRelatedTerms.add(term);
              }
            });
          });
        
        // Add top terms based on the limit
        relatedTerms.push(...Array.from(allRelatedTerms).slice(0, maxRelatedTerms));
      }
      
      // Create enhanced query by adding synonyms
      let enhancedQuery = query;
      if (expandSynonyms && similarConcepts.length > 0) {
        const synonyms = similarConcepts
          .slice(0, 3) // Use top 3 concepts
          .map(concept => concept.term)
          .filter(term => term.toLowerCase() !== query.toLowerCase());
        
        if (synonyms.length > 0) {
          enhancedQuery = `${query} ${synonyms.join(' ')}`;
        }
      }
      
      // Personalize based on user context if available
      if (context?.userId) {
        enhancedQuery = await this.personalizeQuery(enhancedQuery, context);
      }
      
      // Calculate confidence score based on similarity of top concept
      const confidence = similarConcepts.length > 0 ? 
        similarConcepts[0].similarity : 0.5;
      
      // Store query in history
      await this.storeQueryHistory(query, queryEmbedding, context?.userId);
      
      return {
        originalQuery: query,
        enhancedQuery,
        relatedTerms,
        queryEmbedding,
        confidence
      };
    } catch (error) {
      logger.error(`Failed to enhance query: ${error}`);
      
      // Return basic result with original query if enhancement fails
      return {
        originalQuery: query,
        enhancedQuery: query,
        relatedTerms: [],
        queryEmbedding: await this.generateMockEmbedding(),
        confidence: 0
      };
    }
  }
  
  /**
   * Find similar semantic concepts for a query
   * 
   * @param embedding Query embedding
   * @param domainContext Domain context
   * @param minConfidence Minimum confidence threshold
   * @returns Similar semantic concepts
   */
  private async findSimilarConcepts(
    embedding: number[],
    domainContext: string,
    minConfidence: number
  ): Promise<any[]> {
    try {
      // Use vector search to find similar concepts
      const results = await vectorSearch.findSimilar(
        embedding,
        this.embeddingTableName,
        this.vectorColumnName,
        {
          threshold: minConfidence,
          limit: 10,
          filters: {
            domain_context: domainContext === 'general' 
              ? { $in: [domainContext, 'general'] }
              : domainContext
          }
        }
      );
      
      return results;
    } catch (error) {
      logger.error(`Error finding similar concepts: ${error}`);
      return [];
    }
  }
  
  /**
   * Generate embedding vector for a query string
   * 
   * @param query Query string
   * @returns Embedding vector
   */
  private async generateQueryEmbedding(query: string): Promise<number[]> {
    try {
      // In a real implementation, this would call an embedding API (OpenAI, etc.)
      // For this example, we'll use a simple mock implementation
      
      // Simple mock implementation for testing
      // This would be replaced with actual embedding generation in production
      return this.generateMockEmbedding();
      
    } catch (error) {
      logger.error(`Error generating query embedding: ${error}`);
      return this.generateMockEmbedding();
    }
  }
  
  /**
   * Generate a mock embedding vector for testing
   * 
   * @returns Mock embedding vector
   */
  private async generateMockEmbedding(): Promise<number[]> {
    const dimensions = 384;
    const embedding = new Array(dimensions);
    
    // Fill with random values
    for (let i = 0; i < dimensions; i++) {
      embedding[i] = (Math.random() * 2) - 1; // Values between -1 and 1
    }
    
    // Normalize to unit length
    const magnitude = Math.sqrt(
      embedding.reduce((sum, val) => sum + val * val, 0)
    );
    
    for (let i = 0; i < dimensions; i++) {
      embedding[i] = embedding[i] / magnitude;
    }
    
    return embedding;
  }
  
  /**
   * Store a query in the history
   * 
   * @param query Query string
   * @param embedding Query embedding
   * @param userId Optional user ID
   */
  private async storeQueryHistory(
    query: string,
    embedding: number[],
    userId?: string
  ): Promise<void> {
    try {
      const client = supabaseClient.getClient();
      
      // Prepare data
      const data = {
        id: uuidv4(),
        user_id: userId,
        query,
        embedding,
        created_at: new Date().toISOString()
      };
      
      // Insert into history table
      await (client as any)
        .from(this.queryHistoryTableName)
        .insert(data);
      
      // Optional: update semantic concepts popularity
      await this.updateConceptPopularity(query);
      
    } catch (error) {
      logger.error(`Error storing query history: ${error}`);
      // Don't throw - this is a non-critical operation
    }
  }
  
  /**
   * Update concept popularity when a query is used
   * 
   * @param query Query string
   */
  private async updateConceptPopularity(query: string): Promise<void> {
    try {
      const client = supabaseClient.getClient();
      
      // Increment popularity for exact match
      await (client as any)
        .from(this.embeddingTableName)
        .update({ 
          popularity: client.rpc('increment_counter', { count: 1 }),
          updated_at: new Date().toISOString()
        })
        .eq('term', query);
      
    } catch (error) {
      logger.error(`Error updating concept popularity: ${error}`);
      // Don't throw - this is a non-critical operation
    }
  }
  
  /**
   * Personalize a query based on user context
   * 
   * @param query Query string
   * @param context User context
   * @returns Personalized query
   */
  private async personalizeQuery(
    query: string,
    context: QueryContext
  ): Promise<string> {
    try {
      let personalizedQuery = query;
      
      // Add user preferences if relevant
      if (context.userPreferences && context.userPreferences.length > 0) {
        // Check if any preferences are relevant to the query
        // This would be more sophisticated in a real implementation
        const relevantPreferences = context.userPreferences.filter(pref => 
          query.toLowerCase().includes(pref.toLowerCase())
        );
        
        if (relevantPreferences.length > 0) {
          personalizedQuery = `${query} ${relevantPreferences[0]}`;
        }
      }
      
      // Consider recently viewed items
      if (context.recentlyViewedItems && context.recentlyViewedItems.length > 0) {
        // In a real implementation, this would use embeddings to find related items
        // For this example, we just use the most recent item
        const recentItem = context.recentlyViewedItems[0];
        
        // Get embedding for recent item (mock implementation)
        const itemEmbedding = await this.generateMockEmbedding();
        
        // Get embedding for query
        const queryEmbedding = await this.generateQueryEmbedding(query);
        
        // Calculate similarity (mock implementation)
        const similarity = this.calculateCosineSimilarity(queryEmbedding, itemEmbedding);
        
        // If similar enough, consider in personalization
        if (similarity > 0.7) {
          personalizedQuery = `${query} ${recentItem}`;
        }
      }
      
      return personalizedQuery;
    } catch (error) {
      logger.error(`Error personalizing query: ${error}`);
      return query; // Return original query if personalization fails
    }
  }
  
  /**
   * Add a new semantic concept to the knowledge base
   * 
   * @param term Term or phrase
   * @param relatedTerms Related terms or synonyms
   * @param domainContext Domain context
   * @returns Created concept ID
   */
  public async addSemanticConcept(
    term: string,
    relatedTerms: string[] = [],
    domainContext: string = 'general'
  ): Promise<string> {
    try {
      logger.info(`Adding semantic concept: "${term}"`);
      
      // Generate embedding for the term
      const embedding = await this.generateQueryEmbedding(term);
      
      // Store in Supabase
      const id = await vectorSearch.storeEmbedding(
        embedding,
        {
          term,
          related_terms: relatedTerms,
          domain_context: domainContext,
          popularity: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        this.embeddingTableName,
        this.vectorColumnName
      );
      
      logger.info(`Added semantic concept with ID: ${id}`);
      return id;
    } catch (error) {
      logger.error(`Failed to add semantic concept: ${error}`);
      throw new Error(`Failed to add semantic concept: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Get user's recent queries
   * 
   * @param userId User ID
   * @param limit Maximum number of queries to return
   * @returns Recent queries
   */
  public async getUserRecentQueries(
    userId: string,
    limit: number = 10
  ): Promise<string[]> {
    try {
      const client = supabaseClient.getClient();
      
      // Get recent queries for user
      const { data, error } = await (client as any)
        .from(this.queryHistoryTableName)
        .select('query')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) {
        throw error;
      }
      
      return data ? data.map((item: any) => item.query) : [];
    } catch (error) {
      logger.error(`Failed to get user recent queries: ${error}`);
      return [];
    }
  }
  
  /**
   * Get trending queries across all users
   * 
   * @param timeframe Timeframe in hours (default: 24)
   * @param limit Maximum number of queries to return
   * @returns Trending queries with counts
   */
  public async getTrendingQueries(
    timeframe: number = 24,
    limit: number = 10
  ): Promise<Array<{ query: string; count: number }>> {
    try {
      const client = supabaseClient.getClient();
      
      // Calculate timeframe
      const cutoffDate = new Date();
      cutoffDate.setHours(cutoffDate.getHours() - timeframe);
      
      // Run SQL to get trending queries
      const { data, error } = await client.rpc('get_trending_queries', {
        timeframe_hours: timeframe,
        result_limit: limit
      });
      
      if (error) {
        throw error;
      }
      
      return data || [];
    } catch (error) {
      logger.error(`Failed to get trending queries: ${error}`);
      return [];
    }
  }
  
  /**
   * Calculate cosine similarity between two vectors
   * 
   * @param vec1 First vector
   * @param vec2 Second vector
   * @returns Cosine similarity (0-1)
   */
  private calculateCosineSimilarity(vec1: number[], vec2: number[]): number {
    if (!vec1 || !vec2 || !Array.isArray(vec1) || !Array.isArray(vec2)) {
      return 0;
    }
    
    const length = Math.min(vec1.length, vec2.length);
    
    let dotProduct = 0;
    let mag1 = 0;
    let mag2 = 0;
    
    for (let i = 0; i < length; i++) {
      const v1 = vec1[i] || 0;
      const v2 = vec2[i] || 0;
      
      dotProduct += v1 * v2;
      mag1 += v1 * v1;
      mag2 += v2 * v2;
    }
    
    mag1 = Math.sqrt(mag1);
    mag2 = Math.sqrt(mag2);
    
    if (mag1 === 0 || mag2 === 0) {
      return 0;
    }
    
    return dotProduct / (mag1 * mag2);
  }
}

// Export singleton instance
export const queryUnderstandingService = QueryUnderstandingService.getInstance();
export default queryUnderstandingService;