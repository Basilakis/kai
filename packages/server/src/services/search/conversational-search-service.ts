/**
 * Conversational Search Service
 *
 * This service provides advanced search capabilities that maintain context across
 * multiple search queries, allowing for follow-up questions and refinements.
 * It integrates with the query understanding service to interpret natural language
 * queries in the context of previous interactions.
 */

import { logger } from '../../utils/logger';
import { supabase } from '../supabase/supabaseClient';
import { v4 as uuidv4 } from 'uuid';
import queryUnderstandingService from './query-understanding-service';
import { enhancedVectorService } from '../supabase/enhanced-vector-service';
import mcpClientService, { MCPServiceKey } from '../mcp/mcpClientService';
import creditService from '../credit/creditService';

/**
 * Conversation context for search
 */
export interface ConversationContext {
  sessionId: string;
  history: ConversationMessage[];
  entities: Record<string, any>;
  preferences: Record<string, any>;
  lastQuery?: string;
  lastResults?: any[];
}

/**
 * Conversation message
 */
export interface ConversationMessage {
  id: string;
  role: 'user' | 'system' | 'assistant';
  content: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

/**
 * Conversational search options
 */
export interface ConversationalSearchOptions {
  query: string;
  sessionId?: string;
  materialType?: string | string[];
  limit?: number;
  skip?: number;
  includeKnowledge?: boolean;
  includeRelationships?: boolean;
  filters?: Record<string, any>;
  userPreferences?: Record<string, any>;
}

/**
 * Conversational search result
 */
export interface ConversationalSearchResult {
  materials: any[];
  knowledgeEntries?: any[];
  relationships?: any[];
  sessionId: string;
  enhancedQuery: string;
  interpretedQuery: string;
  metadata: {
    processingTime: number;
    searchStrategy: string;
    contextUsed: boolean;
    detectedEntities?: Record<string, any>;
    confidence: number;
  };
}

/**
 * Conversational Search Service class
 */
class ConversationalSearchService {
  private static instance: ConversationalSearchService;
  private conversations: Map<string, ConversationContext>;
  private readonly tableName = 'conversation_sessions';
  
  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
    this.conversations = new Map<string, ConversationContext>();
    this.initializeService().catch(err => {
      logger.error(`Failed to initialize ConversationalSearchService: ${err}`);
    });
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(): ConversationalSearchService {
    if (!ConversationalSearchService.instance) {
      ConversationalSearchService.instance = new ConversationalSearchService();
    }
    return ConversationalSearchService.instance;
  }
  
  /**
   * Initialize the service
   */
  private async initializeService(): Promise<void> {
    try {
      // Check if the table exists, and create it if it doesn't
      const { error } = await supabase.getClient()
        .from(this.tableName)
        .select('id')
        .limit(1);
      
      if (error && error.code === '42P01') {
        // Table doesn't exist, create it
        logger.info(`Creating ${this.tableName} table`);
        await this.createConversationTable();
      }
    } catch (err) {
      logger.error(`Error checking conversation table: ${err}`);
    }
  }
  
  /**
   * Create the conversation_sessions table in the database
   */
  private async createConversationTable(): Promise<void> {
    try {
      const { error } = await supabase.getClient().rpc('create_conversation_table');
      
      if (error) {
        logger.error(`Failed to create conversation table: ${error}`);
        throw error;
      }
      
      logger.info('Conversation table created successfully');
    } catch (err) {
      logger.error(`Error creating conversation table: ${err}`);
      throw err;
    }
  }
  
  /**
   * Check if MCP is available for conversational search
   */
  private async isMCPAvailable(): Promise<boolean> {
    try {
      return await mcpClientService.isMCPAvailable();
    } catch (error) {
      logger.error(`Error checking MCP availability: ${error}`);
      return false;
    }
  }
  
  /**
   * Perform conversational search
   * 
   * @param options Search options with query and session ID
   * @param userId User ID for MCP integration
   * @returns Search results with materials and conversation context
   */
  public async search(
    options: ConversationalSearchOptions,
    userId?: string
  ): Promise<ConversationalSearchResult> {
    const startTime = Date.now();
    
    try {
      // Set default options
      const mergedOptions = {
        limit: 10,
        skip: 0,
        includeKnowledge: true,
        includeRelationships: true,
        ...options
      };
      
      // Get or create conversation context
      let context: ConversationContext;
      
      if (mergedOptions.sessionId) {
        // Try to get existing context from memory
        context = this.conversations.get(mergedOptions.sessionId) || await this.loadConversationContext(mergedOptions.sessionId);
      } else {
        // Create new conversation context
        context = this.createConversationContext(mergedOptions.userPreferences);
      }
      
      // Check if MCP is available and user ID is provided
      const mcpAvailable = await this.isMCPAvailable();
      
      if (mcpAvailable && userId) {
        try {
          // Estimate query complexity (2 units per conversational search)
          const estimatedUnits = 2;
          
          // Check if user has enough credits
          const hasEnoughCredits = await creditService.hasEnoughCreditsForService(
            userId,
            MCPServiceKey.CONVERSATIONAL_SEARCH,
            estimatedUnits
          );
          
          if (hasEnoughCredits) {
            // Use MCP for conversational search
            const mcpResult = await this.performMCPConversationalSearch(mergedOptions, context, userId);
            
            // Track credit usage
            await creditService.useServiceCredits(
              userId,
              MCPServiceKey.CONVERSATIONAL_SEARCH,
              estimatedUnits,
              `${MCPServiceKey.CONVERSATIONAL_SEARCH} API usage`,
              {
                sessionId: context.sessionId,
                historyLength: context.history.length
              }
            );
            
            // Update conversation context with new message
            this.updateConversationContext(context, {
              id: uuidv4(),
              role: 'user',
              content: mergedOptions.query,
              timestamp: new Date().toISOString(),
              metadata: {
                enhancedQuery: mcpResult.enhancedQuery,
                interpretedQuery: mcpResult.interpretedQuery
              }
            });
            
            // Add system response
            this.updateConversationContext(context, {
              id: uuidv4(),
              role: 'assistant',
              content: `Found ${mcpResult.materials.length} materials matching your query.`,
              timestamp: new Date().toISOString(),
              metadata: {
                resultCount: mcpResult.materials.length
              }
            });
            
            // Save updated context
            await this.saveConversationContext(context);
            
            return {
              ...mcpResult,
              metadata: {
                ...mcpResult.metadata,
                processingTime: Date.now() - startTime
              }
            };
          }
        } catch (mcpError: any) {
          // For MCP errors, log and fall back to direct implementation
          logger.warn(`MCP conversational search failed, falling back to direct implementation: ${mcpError.message}`);
        }
      }
      
      // Fall back to direct implementation if MCP is not available or failed
      return await this.performDirectConversationalSearch(mergedOptions, context);
    } catch (error) {
      logger.error(`Error in conversational search: ${error}`);
      throw error;
    }
  }
  
  /**
   * Perform conversational search using MCP
   */
  private async performMCPConversationalSearch(
    options: ConversationalSearchOptions,
    context: ConversationContext,
    userId: string
  ): Promise<ConversationalSearchResult> {
    // Call MCP for conversational search
    const mcpResult = await mcpClientService.performConversationalSearch(
      userId,
      {
        query: options.query,
        sessionId: context.sessionId,
        conversationHistory: context.history,
        materialType: Array.isArray(options.materialType) 
          ? options.materialType[0] 
          : options.materialType,
        limit: options.limit,
        skip: options.skip,
        includeKnowledge: options.includeKnowledge,
        includeRelationships: options.includeRelationships,
        filters: options.filters,
        userPreferences: options.userPreferences
      }
    );
    
    return {
      materials: mcpResult.materials || [],
      knowledgeEntries: mcpResult.knowledgeEntries || [],
      relationships: mcpResult.relationships || [],
      sessionId: context.sessionId,
      enhancedQuery: mcpResult.enhancedQuery || options.query,
      interpretedQuery: mcpResult.interpretedQuery || options.query,
      metadata: {
        processingTime: 0, // Will be updated by the caller
        searchStrategy: 'mcp-conversational',
        contextUsed: mcpResult.contextUsed || false,
        detectedEntities: mcpResult.detectedEntities,
        confidence: mcpResult.confidence || 0.5
      }
    };
  }
  
  /**
   * Perform conversational search using direct implementation
   */
  private async performDirectConversationalSearch(
    options: ConversationalSearchOptions,
    context: ConversationContext
  ): Promise<ConversationalSearchResult> {
    const startTime = Date.now();
    
    // Analyze query in context of conversation history
    const enhancedQueryResult = await queryUnderstandingService.enhanceQuery(
      options.query,
      {
        expandSynonyms: true,
        includeRelatedTerms: true,
        domainContext: 'material'
      },
      {
        conversationHistory: context.history,
        userPreferences: options.userPreferences
      }
    );
    
    // Extract entities from the query
    const detectedEntities = this.extractEntities(options.query, enhancedQueryResult.relatedTerms);
    
    // Merge detected entities with context entities
    const mergedEntities = { ...context.entities, ...detectedEntities };
    
    // Interpret query based on conversation context
    const interpretedQuery = this.interpretQueryWithContext(
      options.query,
      enhancedQueryResult.enhancedQuery,
      context
    );
    
    // Prepare filters based on context and current query
    const filters = this.prepareFiltersFromContext(options.filters || {}, mergedEntities);
    
    // Perform search with interpreted query
    const searchResult = await enhancedVectorService.searchMaterialsWithKnowledge(
      interpretedQuery,
      Array.isArray(options.materialType) ? options.materialType[0] : options.materialType,
      filters,
      options.limit,
      options.includeKnowledge,
      options.includeRelationships
    );
    
    // Update conversation context with new message
    this.updateConversationContext(context, {
      id: uuidv4(),
      role: 'user',
      content: options.query,
      timestamp: new Date().toISOString(),
      metadata: {
        enhancedQuery: enhancedQueryResult.enhancedQuery,
        interpretedQuery
      }
    });
    
    // Add system response
    this.updateConversationContext(context, {
      id: uuidv4(),
      role: 'assistant',
      content: `Found ${searchResult.materials.length} materials matching your query.`,
      timestamp: new Date().toISOString(),
      metadata: {
        resultCount: searchResult.materials.length
      }
    });
    
    // Update context with last query and results
    context.lastQuery = options.query;
    context.lastResults = searchResult.materials;
    context.entities = mergedEntities;
    
    // Save updated context
    await this.saveConversationContext(context);
    
    return {
      materials: searchResult.materials,
      knowledgeEntries: searchResult.knowledgeEntries,
      relationships: searchResult.relationships,
      sessionId: context.sessionId,
      enhancedQuery: enhancedQueryResult.enhancedQuery,
      interpretedQuery,
      metadata: {
        processingTime: Date.now() - startTime,
        searchStrategy: 'direct-conversational',
        contextUsed: context.history.length > 0,
        detectedEntities,
        confidence: enhancedQueryResult.confidence
      }
    };
  }
  
  /**
   * Create a new conversation context
   */
  private createConversationContext(userPreferences?: Record<string, any>): ConversationContext {
    const sessionId = uuidv4();
    
    const context: ConversationContext = {
      sessionId,
      history: [],
      entities: {},
      preferences: userPreferences || {}
    };
    
    // Add initial system message
    this.updateConversationContext(context, {
      id: uuidv4(),
      role: 'system',
      content: 'Conversation started. How can I help you find materials today?',
      timestamp: new Date().toISOString()
    });
    
    // Store in memory
    this.conversations.set(sessionId, context);
    
    return context;
  }
  
  /**
   * Update conversation context with a new message
   */
  private updateConversationContext(context: ConversationContext, message: ConversationMessage): void {
    context.history.push(message);
    
    // Limit history to last 20 messages to prevent context explosion
    if (context.history.length > 20) {
      context.history = context.history.slice(context.history.length - 20);
    }
  }
  
  /**
   * Load conversation context from database
   */
  private async loadConversationContext(sessionId: string): Promise<ConversationContext> {
    try {
      // Check if we have it in memory first
      const memoryContext = this.conversations.get(sessionId);
      if (memoryContext) {
        return memoryContext;
      }
      
      // Load from database
      const { data, error } = await supabase.getClient()
        .from(this.tableName)
        .select('*')
        .eq('id', sessionId)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          // Not found, create new context
          return this.createConversationContext();
        }
        throw error;
      }
      
      // Parse the data
      const context: ConversationContext = {
        sessionId: data.id,
        history: JSON.parse(data.history || '[]'),
        entities: JSON.parse(data.entities || '{}'),
        preferences: JSON.parse(data.preferences || '{}'),
        lastQuery: data.last_query,
        lastResults: JSON.parse(data.last_results || '[]')
      };
      
      // Store in memory
      this.conversations.set(sessionId, context);
      
      return context;
    } catch (error) {
      logger.error(`Error loading conversation context: ${error}`);
      return this.createConversationContext();
    }
  }
  
  /**
   * Save conversation context to database
   */
  private async saveConversationContext(context: ConversationContext): Promise<void> {
    try {
      // Store in memory
      this.conversations.set(context.sessionId, context);
      
      // Save to database
      const { error } = await supabase.getClient()
        .from(this.tableName)
        .upsert({
          id: context.sessionId,
          history: JSON.stringify(context.history),
          entities: JSON.stringify(context.entities),
          preferences: JSON.stringify(context.preferences),
          last_query: context.lastQuery,
          last_results: JSON.stringify(context.lastResults || []),
          updated_at: new Date().toISOString()
        });
      
      if (error) {
        throw error;
      }
    } catch (error) {
      logger.error(`Error saving conversation context: ${error}`);
    }
  }
  
  /**
   * Extract entities from query
   */
  private extractEntities(query: string, relatedTerms: string[]): Record<string, any> {
    const entities: Record<string, any> = {};
    
    // Simple entity extraction based on common material properties
    const colorRegex = /\b(white|black|gray|grey|red|blue|green|yellow|brown|beige|ivory|cream|gold|silver)\b/gi;
    const colorMatches = query.match(colorRegex);
    if (colorMatches) {
      entities.color = colorMatches[0].toLowerCase();
    }
    
    const materialTypeRegex = /\b(ceramic|porcelain|marble|granite|limestone|travertine|slate|quartzite|onyx|glass|metal|wood)\b/gi;
    const materialMatches = query.match(materialTypeRegex);
    if (materialMatches) {
      entities.materialType = materialMatches[0].toLowerCase();
    }
    
    const finishRegex = /\b(polished|honed|brushed|tumbled|matte|glossy|textured|satin|leathered)\b/gi;
    const finishMatches = query.match(finishRegex);
    if (finishMatches) {
      entities.finish = finishMatches[0].toLowerCase();
    }
    
    const sizeRegex = /\b(\d+(?:\.\d+)?)\s*(?:x\s*(\d+(?:\.\d+)?))?\s*(?:x\s*(\d+(?:\.\d+)?))?\s*(mm|cm|m|inch|inches|in|ft|feet)?\b/gi;
    const sizeMatches = [...query.matchAll(sizeRegex)];
    if (sizeMatches.length > 0) {
      const match = sizeMatches[0];
      entities.size = {
        width: parseFloat(match[1]),
        height: match[2] ? parseFloat(match[2]) : undefined,
        depth: match[3] ? parseFloat(match[3]) : undefined,
        unit: match[4] || 'cm'
      };
    }
    
    return entities;
  }
  
  /**
   * Interpret query based on conversation context
   */
  private interpretQueryWithContext(
    originalQuery: string,
    enhancedQuery: string,
    context: ConversationContext
  ): string {
    // If this is the first query, just use the enhanced query
    if (context.history.length <= 1) {
      return enhancedQuery;
    }
    
    // Check for follow-up indicators
    const followUpIndicators = [
      'show me more',
      'more like this',
      'similar to',
      'what about',
      'how about',
      'and also',
      'what if',
      'can you show',
      'do you have'
    ];
    
    const isFollowUp = followUpIndicators.some(indicator => 
      originalQuery.toLowerCase().includes(indicator.toLowerCase())
    );
    
    // Handle pronouns referring to previous results
    const pronounRegex = /\b(it|this|that|these|those|them|they)\b/gi;
    const hasPronoun = pronounRegex.test(originalQuery);
    
    if (isFollowUp || hasPronoun) {
      // This is likely a follow-up query, incorporate context
      if (context.lastQuery) {
        // Extract key terms from the last query
        const lastQueryTerms = context.lastQuery
          .toLowerCase()
          .replace(/[^\w\s]/g, '')
          .split(/\s+/)
          .filter(term => term.length > 3); // Only keep meaningful terms
        
        // Extract key terms from the current query
        const currentQueryTerms = originalQuery
          .toLowerCase()
          .replace(/[^\w\s]/g, '')
          .split(/\s+/)
          .filter(term => term.length > 3);
        
        // Find terms in the last query that aren't in the current query
        const missingTerms = lastQueryTerms.filter(term => 
          !currentQueryTerms.some(currentTerm => 
            currentTerm.includes(term) || term.includes(currentTerm)
          )
        );
        
        // Combine with current query if there are missing terms
        if (missingTerms.length > 0) {
          return `${enhancedQuery} ${missingTerms.join(' ')}`;
        }
      }
    }
    
    // Default to enhanced query
    return enhancedQuery;
  }
  
  /**
   * Prepare filters based on context and entities
   */
  private prepareFiltersFromContext(
    baseFilters: Record<string, any>,
    entities: Record<string, any>
  ): Record<string, any> {
    const filters = { ...baseFilters };
    
    // Add entity-based filters
    if (entities.color) {
      filters.color = entities.color;
    }
    
    if (entities.materialType) {
      filters.material_type = entities.materialType;
    }
    
    if (entities.finish) {
      filters.finish = entities.finish;
    }
    
    return filters;
  }
  
  /**
   * Get conversation history
   * 
   * @param sessionId Conversation session ID
   * @returns Conversation history
   */
  public async getConversationHistory(sessionId: string): Promise<ConversationMessage[]> {
    try {
      const context = await this.loadConversationContext(sessionId);
      return context.history;
    } catch (error) {
      logger.error(`Error getting conversation history: ${error}`);
      return [];
    }
  }
  
  /**
   * Clear conversation history
   * 
   * @param sessionId Conversation session ID
   * @returns Success status
   */
  public async clearConversationHistory(sessionId: string): Promise<boolean> {
    try {
      // Remove from memory
      this.conversations.delete(sessionId);
      
      // Remove from database
      const { error } = await supabase.getClient()
        .from(this.tableName)
        .delete()
        .eq('id', sessionId);
      
      if (error) {
        throw error;
      }
      
      return true;
    } catch (error) {
      logger.error(`Error clearing conversation history: ${error}`);
      return false;
    }
  }
}

export const conversationalSearchService = ConversationalSearchService.getInstance();
export default conversationalSearchService;
