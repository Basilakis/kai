/**
 * Multi-Modal Search Service
 *
 * This service provides advanced search capabilities that combine text and image inputs
 * to deliver more accurate and contextually relevant search results. It integrates
 * text embeddings with image features for a unified search experience.
 */

import { logger } from '../../utils/logger';
import { supabase } from '../supabase/supabaseClient';
import { vectorSearch } from '../supabase/vector-search';
import { hybridSearch } from '../supabase/hybrid-search';
import { enhancedVectorService } from '../supabase/enhanced-vector-service';
import queryUnderstandingService from './query-understanding-service';
import mcpClientService, { MCPServiceKey } from '../mcp/mcpClientService';
import creditService from '../credit/creditService';
import { generateImageEmbedding } from '@kai/ml';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

/**
 * Multi-modal search options
 */
export interface MultiModalSearchOptions {
  // Text query component
  textQuery?: string;
  
  // Image component
  imageBase64?: string;
  imagePath?: string;
  imageUrl?: string;
  
  // Search parameters
  materialType?: string | string[];
  limit?: number;
  skip?: number;
  threshold?: number;
  
  // Weighting between modalities
  textWeight?: number;
  imageWeight?: number;
  
  // Additional filters
  filters?: Record<string, any>;
  
  // Include related information
  includeKnowledge?: boolean;
  includeRelationships?: boolean;
}

/**
 * Multi-modal search result
 */
export interface MultiModalSearchResult {
  materials: any[];
  knowledgeEntries?: any[];
  relationships?: any[];
  metadata: {
    textQuery?: string;
    enhancedTextQuery?: string;
    imageSource?: string;
    textWeight?: number;
    imageWeight?: number;
    searchStrategy: string;
    processingTime: number;
  };
}

/**
 * Multi-Modal Search Service class
 */
class MultiModalSearchService {
  private static instance: MultiModalSearchService;
  
  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {}
  
  /**
   * Get singleton instance
   */
  public static getInstance(): MultiModalSearchService {
    if (!MultiModalSearchService.instance) {
      MultiModalSearchService.instance = new MultiModalSearchService();
    }
    return MultiModalSearchService.instance;
  }
  
  /**
   * Check if MCP is available for multi-modal search
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
   * Search using both text and image inputs
   * 
   * @param options Search options containing text and/or image inputs
   * @param userId User ID for MCP integration
   * @returns Search results with materials and metadata
   */
  public async search(
    options: MultiModalSearchOptions,
    userId?: string
  ): Promise<MultiModalSearchResult> {
    const startTime = Date.now();
    
    try {
      // Validate inputs - at least one modality must be provided
      if (!options.textQuery && !options.imageBase64 && !options.imagePath && !options.imageUrl) {
        throw new Error('At least one search modality (text or image) must be provided');
      }
      
      // Set default options
      const mergedOptions = {
        limit: 10,
        skip: 0,
        threshold: 0.5,
        textWeight: 0.5,
        imageWeight: 0.5,
        includeKnowledge: true,
        includeRelationships: true,
        ...options
      };
      
      // Check if MCP is available and user ID is provided
      const mcpAvailable = await this.isMCPAvailable();
      
      if (mcpAvailable && userId) {
        try {
          // Estimate query complexity (2 units per multi-modal search)
          const estimatedUnits = 2;
          
          // Check if user has enough credits
          const hasEnoughCredits = await creditService.hasEnoughCreditsForService(
            userId,
            MCPServiceKey.VECTOR_SEARCH,
            estimatedUnits
          );
          
          if (hasEnoughCredits) {
            // Use MCP for multi-modal search
            const mcpResult = await this.performMCPMultiModalSearch(mergedOptions, userId);
            
            // Track credit usage
            await creditService.useServiceCredits(
              userId,
              MCPServiceKey.VECTOR_SEARCH,
              estimatedUnits,
              `${MCPServiceKey.VECTOR_SEARCH} API usage`,
              {
                searchType: 'multi-modal',
                hasText: !!mergedOptions.textQuery,
                hasImage: !!(mergedOptions.imageBase64 || mergedOptions.imagePath || mergedOptions.imageUrl)
              }
            );
            
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
          logger.warn(`MCP multi-modal search failed, falling back to direct implementation: ${mcpError.message}`);
        }
      }
      
      // Fall back to direct implementation if MCP is not available or failed
      return await this.performDirectMultiModalSearch(mergedOptions);
    } catch (error) {
      logger.error(`Error in multi-modal search: ${error}`);
      throw error;
    }
  }
  
  /**
   * Perform multi-modal search using MCP
   */
  private async performMCPMultiModalSearch(
    options: MultiModalSearchOptions,
    userId: string
  ): Promise<MultiModalSearchResult> {
    // Prepare image data if provided
    let imageData: string | undefined;
    
    if (options.imageBase64) {
      imageData = options.imageBase64;
    } else if (options.imagePath) {
      // Read image file and convert to base64
      const imageBuffer = fs.readFileSync(options.imagePath);
      imageData = imageBuffer.toString('base64');
    } else if (options.imageUrl) {
      // MCP will handle URL fetching
      imageData = options.imageUrl;
    }
    
    // Call MCP for multi-modal search
    const mcpResult = await mcpClientService.performMultiModalSearch(
      userId,
      {
        textQuery: options.textQuery,
        imageData,
        imageType: options.imageBase64 ? 'base64' : options.imagePath ? 'file' : 'url',
        materialType: Array.isArray(options.materialType) 
          ? options.materialType[0] 
          : options.materialType,
        limit: options.limit,
        skip: options.skip,
        threshold: options.threshold,
        textWeight: options.textWeight,
        imageWeight: options.imageWeight,
        includeKnowledge: options.includeKnowledge,
        includeRelationships: options.includeRelationships,
        filters: options.filters
      }
    );
    
    return {
      materials: mcpResult.materials || [],
      knowledgeEntries: mcpResult.knowledgeEntries || [],
      relationships: mcpResult.relationships || [],
      metadata: {
        textQuery: options.textQuery,
        enhancedTextQuery: mcpResult.enhancedTextQuery,
        imageSource: options.imageBase64 ? 'base64' : options.imagePath ? 'file' : options.imageUrl,
        textWeight: options.textWeight,
        imageWeight: options.imageWeight,
        searchStrategy: 'mcp-multi-modal',
        processingTime: 0 // Will be updated by the caller
      }
    };
  }
  
  /**
   * Perform multi-modal search using direct implementation
   */
  private async performDirectMultiModalSearch(
    options: MultiModalSearchOptions
  ): Promise<MultiModalSearchResult> {
    const startTime = Date.now();
    
    // Process text query if provided
    let textEmbedding: number[] | undefined;
    let enhancedTextQuery: string | undefined;
    
    if (options.textQuery) {
      // Enhance query using semantic understanding
      const enhancedQueryResult = await queryUnderstandingService.enhanceQuery(
        options.textQuery,
        {
          expandSynonyms: true,
          domainContext: 'material'
        }
      );
      
      enhancedTextQuery = enhancedQueryResult.enhancedQuery;
      textEmbedding = enhancedQueryResult.queryEmbedding;
    }
    
    // Process image if provided
    let imageEmbedding: number[] | undefined;
    let tempImagePath: string | undefined;
    
    try {
      if (options.imageBase64) {
        // Convert base64 to temporary file
        const imageBuffer = Buffer.from(options.imageBase64, 'base64');
        tempImagePath = path.join(os.tmpdir(), `${uuidv4()}.jpg`);
        fs.writeFileSync(tempImagePath, imageBuffer);
        
        // Generate embedding
        const embedding = await generateImageEmbedding(tempImagePath);
        imageEmbedding = embedding.vector;
      } else if (options.imagePath) {
        // Generate embedding from file path
        const embedding = await generateImageEmbedding(options.imagePath);
        imageEmbedding = embedding.vector;
      } else if (options.imageUrl) {
        // Download image to temporary file
        // This is a simplified implementation - in a real app, you'd use a proper HTTP client
        logger.warn('Image URL processing not implemented in direct mode');
      }
      
      // Combine embeddings based on weights
      let combinedEmbedding: number[] | undefined;
      
      if (textEmbedding && imageEmbedding) {
        // Ensure embeddings have the same dimensions
        const minLength = Math.min(textEmbedding.length, imageEmbedding.length);
        
        // Weighted combination of embeddings
        combinedEmbedding = new Array(minLength);
        for (let i = 0; i < minLength; i++) {
          combinedEmbedding[i] = (
            options.textWeight! * textEmbedding[i] + 
            options.imageWeight! * imageEmbedding[i]
          );
        }
        
        // Normalize the combined embedding
        const magnitude = Math.sqrt(
          combinedEmbedding.reduce((sum, val) => sum + val * val, 0)
        );
        
        if (magnitude > 0) {
          for (let i = 0; i < combinedEmbedding.length; i++) {
            combinedEmbedding[i] /= magnitude;
          }
        }
      } else {
        // Use whichever embedding is available
        combinedEmbedding = textEmbedding || imageEmbedding;
      }
      
      // Perform search with combined embedding
      if (combinedEmbedding) {
        // Prepare filters if material type is specified
        const filters: Record<string, any> = { ...options.filters };
        
        if (options.materialType) {
          if (Array.isArray(options.materialType)) {
            filters.material_type = options.materialType[0];
          } else {
            filters.material_type = options.materialType;
          }
        }
        
        // Determine search strategy
        let searchStrategy = 'combined';
        if (textEmbedding && !imageEmbedding) {
          searchStrategy = 'text-only';
        } else if (!textEmbedding && imageEmbedding) {
          searchStrategy = 'image-only';
        }
        
        // Use enhanced vector service for search
        const searchResult = await enhancedVectorService.searchMaterialsWithKnowledge(
          options.textQuery || '',
          Array.isArray(options.materialType) ? options.materialType[0] : options.materialType,
          filters,
          options.limit,
          options.includeKnowledge,
          options.includeRelationships
        );
        
        return {
          materials: searchResult.materials,
          knowledgeEntries: searchResult.knowledgeEntries,
          relationships: searchResult.relationships,
          metadata: {
            textQuery: options.textQuery,
            enhancedTextQuery,
            imageSource: options.imageBase64 ? 'base64' : options.imagePath ? 'file' : options.imageUrl,
            textWeight: options.textWeight,
            imageWeight: options.imageWeight,
            searchStrategy,
            processingTime: Date.now() - startTime
          }
        };
      } else {
        throw new Error('Failed to generate embeddings for search');
      }
    } finally {
      // Clean up temporary file if created
      if (tempImagePath && fs.existsSync(tempImagePath)) {
        try {
          fs.unlinkSync(tempImagePath);
        } catch (error) {
          logger.warn(`Failed to clean up temporary image file: ${error}`);
        }
      }
    }
  }
}

export const multiModalSearchService = MultiModalSearchService.getInstance();
export default multiModalSearchService;
