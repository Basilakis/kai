import { logger } from '../../utils/logger';
import { supabaseClient } from '../supabase/supabaseClient';

/**
 * TypeScript interfaces for NLP tag matching
 */
export interface TagMatchResult {
  tagId: string;
  tagName: string;
  confidenceScore: number;
  matchingMethod: 'exact' | 'synonym' | 'fuzzy' | 'nlp';
}

export interface TagMatchingOptions {
  minConfidence?: number;
  enableFuzzyMatching?: boolean;
  enableSynonymMatching?: boolean;
  maxResults?: number;
}

export interface TagMatchingLogEntry {
  materialId?: string;
  extractedText: string;
  matchedTagId?: string;
  confidenceScore?: number;
  matchingMethod: string;
  categoryName: string;
}

export interface CategoryTagsCache {
  [categoryName: string]: {
    tags: Array<{
      id: string;
      name: string;
      normalized_name: string;
      synonyms: string[];
      confidence_threshold: number;
    }>;
    lastUpdated: number;
  };
}

/**
 * NLP Tag Matching Service
 * 
 * This service provides intelligent tag matching capabilities using:
 * - Exact matching on normalized names
 * - Synonym matching with predefined alternatives
 * - Fuzzy string matching using PostgreSQL's pg_trgm extension
 * - Comprehensive logging and analytics
 * 
 * @example
 * ```typescript
 * const tagService = new TagMatchingService();
 * const matches = await tagService.findMatchingTags('matte finish', 'finishes');
 * ```
 */
export class TagMatchingService {
  private static instance: TagMatchingService;
  private tagsCache: CategoryTagsCache = {};
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly DEFAULT_MIN_CONFIDENCE = 0.7;
  private readonly DEFAULT_MAX_RESULTS = 5;

  /**
   * Singleton pattern to ensure single instance across the application
   */
  public static getInstance(): TagMatchingService {
    if (!TagMatchingService.instance) {
      TagMatchingService.instance = new TagMatchingService();
    }
    return TagMatchingService.instance;
  }

  /**
   * Find matching tags for extracted text within a specific category
   * 
   * @param extractedText - The text extracted from PDF or other sources
   * @param categoryName - The category to search within (colors, material_types, finishes, etc.)
   * @param options - Optional configuration for matching behavior
   * @returns Promise<TagMatchResult[]> - Array of matching tags with confidence scores
   */
  public async findMatchingTags(
    extractedText: string,
    categoryName: string,
    options: TagMatchingOptions = {}
  ): Promise<TagMatchResult[]> {
    try {
      const {
        minConfidence = this.DEFAULT_MIN_CONFIDENCE,
        enableFuzzyMatching = true,
        enableSynonymMatching = true,
        maxResults = this.DEFAULT_MAX_RESULTS
      } = options;

      // Validate inputs
      if (!extractedText?.trim()) {
        logger.warn('Empty extracted text provided to findMatchingTags');
        return [];
      }

      if (!categoryName?.trim()) {
        logger.warn('Empty category name provided to findMatchingTags');
        return [];
      }

      const normalizedText = this.normalizeText(extractedText);
      logger.debug(`Finding tags for text: "${normalizedText}" in category: ${categoryName}`);

      // Try database function first (most efficient)
      const dbResults = await this.findTagsUsingDatabaseFunction(
        extractedText,
        categoryName,
        minConfidence
      );

      if (dbResults.length > 0) {
        logger.debug(`Found ${dbResults.length} matches using database function`);
        return dbResults.slice(0, maxResults);
      }

      // Fallback to application-level matching if database function fails
      logger.debug('Database function returned no results, trying application-level matching');
      const appResults = await this.findTagsUsingApplicationLogic(
        normalizedText,
        categoryName,
        {
          minConfidence,
          enableFuzzyMatching,
          enableSynonymMatching
        }
      );

      return appResults.slice(0, maxResults);

    } catch (error) {
      logger.error(`Error in findMatchingTags: ${error}`);
      throw new Error(`Failed to find matching tags: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find matching tags using PostgreSQL database functions
   * This leverages the optimized SQL functions for better performance
   */
  private async findTagsUsingDatabaseFunction(
    extractedText: string,
    categoryName: string,
    minConfidence: number
  ): Promise<TagMatchResult[]> {
    try {
      const { data, error } = await supabaseClient
        .rpc('find_matching_tags', {
          extracted_text: extractedText,
          category_name: categoryName,
          min_confidence: minConfidence
        });

      if (error) {
        logger.error(`Database function error: ${error.message}`);
        throw error;
      }

      if (!data || data.length === 0) {
        return [];
      }

      return data.map((row: any) => ({
        tagId: row.tag_id,
        tagName: row.tag_name,
        confidenceScore: row.confidence_score,
        matchingMethod: row.matching_method as TagMatchResult['matchingMethod']
      }));

    } catch (error) {
      logger.error(`Error using database function: ${error}`);
      // Don't throw here, let it fall back to application logic
      return [];
    }
  }

  /**
   * Application-level tag matching as fallback
   * Used when database functions are not available or fail
   */
  private async findTagsUsingApplicationLogic(
    normalizedText: string,
    categoryName: string,
    options: {
      minConfidence: number;
      enableFuzzyMatching: boolean;
      enableSynonymMatching: boolean;
    }
  ): Promise<TagMatchResult[]> {
    try {
      const tags = await this.getTagsForCategory(categoryName);
      const results: TagMatchResult[] = [];

      for (const tag of tags) {
        // 1. Exact match
        if (tag.normalized_name === normalizedText) {
          results.push({
            tagId: tag.id,
            tagName: tag.name,
            confidenceScore: 1.0,
            matchingMethod: 'exact'
          });
          continue; // Exact match found, no need to check other methods
        }

        // 2. Synonym match
        if (options.enableSynonymMatching && tag.synonyms.length > 0) {
          const normalizedSynonyms = tag.synonyms.map(s => this.normalizeText(s));
          if (normalizedSynonyms.includes(normalizedText)) {
            results.push({
              tagId: tag.id,
              tagName: tag.name,
              confidenceScore: 0.95,
              matchingMethod: 'synonym'
            });
            continue;
          }
        }

        // 3. Fuzzy match
        if (options.enableFuzzyMatching) {
          const similarity = this.calculateStringSimilarity(normalizedText, tag.normalized_name);
          if (similarity >= options.minConfidence) {
            results.push({
              tagId: tag.id,
              tagName: tag.name,
              confidenceScore: similarity,
              matchingMethod: 'fuzzy'
            });
          }
        }
      }

      // Sort by confidence score (highest first)
      return results.sort((a, b) => b.confidenceScore - a.confidenceScore);

    } catch (error) {
      logger.error(`Error in application-level matching: ${error}`);
      return [];
    }
  }

  /**
   * Get all active tags for a specific category with caching
   */
  private async getTagsForCategory(categoryName: string): Promise<Array<{
    id: string;
    name: string;
    normalized_name: string;
    synonyms: string[];
    confidence_threshold: number;
  }>> {
    try {
      // Check cache first
      const cached = this.tagsCache[categoryName];
      if (cached && (Date.now() - cached.lastUpdated) < this.CACHE_TTL) {
        return cached.tags;
      }

      // Fetch from database
      const { data, error } = await supabaseClient
        .rpc('get_tags_by_category', { category_name: categoryName });

      if (error) {
        logger.error(`Error fetching tags for category ${categoryName}: ${error.message}`);
        throw error;
      }

      const tags = data || [];

      // Update cache
      this.tagsCache[categoryName] = {
        tags,
        lastUpdated: Date.now()
      };

      return tags;

    } catch (error) {
      logger.error(`Error getting tags for category ${categoryName}: ${error}`);
      return [];
    }
  }

  /**
   * Log tag matching decision for analytics and debugging
   */
  public async logTagMatching(logEntry: TagMatchingLogEntry): Promise<string | null> {
    try {
      const { data, error } = await supabaseClient
        .rpc('log_tag_matching', {
          p_material_id: logEntry.materialId || null,
          p_extracted_text: logEntry.extractedText,
          p_matched_tag_id: logEntry.matchedTagId || null,
          p_confidence_score: logEntry.confidenceScore || null,
          p_matching_method: logEntry.matchingMethod,
          p_category_name: logEntry.categoryName
        });

      if (error) {
        logger.error(`Error logging tag matching: ${error.message}`);
        return null;
      }

      return data;

    } catch (error) {
      logger.error(`Error in logTagMatching: ${error}`);
      return null;
    }
  }

  /**
   * Process multiple categories for a single text input
   * Useful for comprehensive tag extraction from PDF content
   */
  public async findTagsForAllCategories(
    extractedText: string,
    categories: string[] = ['colors', 'material_types', 'finishes', 'collections', 'technical_specs'],
    options: TagMatchingOptions = {}
  ): Promise<{ [categoryName: string]: TagMatchResult[] }> {
    try {
      const results: { [categoryName: string]: TagMatchResult[] } = {};

      // Process categories in parallel for better performance
      const promises = categories.map(async (category) => {
        const matches = await this.findMatchingTags(extractedText, category, options);
        return { category, matches };
      });

      const categoryResults = await Promise.all(promises);

      // Organize results by category
      categoryResults.forEach(({ category, matches }) => {
        results[category] = matches;
      });

      return results;

    } catch (error) {
      logger.error(`Error in findTagsForAllCategories: ${error}`);
      throw error;
    }
  }

  /**
   * Clear the tags cache (useful for testing or when tags are updated)
   */
  public clearCache(): void {
    this.tagsCache = {};
    logger.debug('Tag matching service cache cleared');
  }

  /**
   * Get cache statistics for monitoring
   */
  public getCacheStats(): { categories: number; totalTags: number; oldestCache: number } {
    const categories = Object.keys(this.tagsCache).length;
    const totalTags = Object.values(this.tagsCache).reduce((sum, cache) => sum + cache.tags.length, 0);
    const oldestCache = Math.min(...Object.values(this.tagsCache).map(cache => cache.lastUpdated));

    return { categories, totalTags, oldestCache };
  }

  /**
   * Normalize text for consistent matching
   * Converts to lowercase, trims whitespace, and removes extra spaces
   */
  private normalizeText(text: string): string {
    return text.toLowerCase().trim().replace(/\s+/g, ' ');
  }

  /**
   * Calculate string similarity using Levenshtein distance
   * Returns a value between 0 and 1, where 1 is identical
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1.0;
    if (str1.length === 0 || str2.length === 0) return 0.0;

    const matrix: number[][] = [];
    const len1 = str1.length;
    const len2 = str2.length;

    // Initialize matrix with proper type safety
    for (let i = 0; i <= len1; i++) {
      matrix[i] = [];
      matrix[i]![0] = i;
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0]![j] = j;
    }

    // Fill matrix with proper null checks
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        const deletion = (matrix[i - 1]?.[j] ?? 0) + 1;
        const insertion = (matrix[i]?.[j - 1] ?? 0) + 1;
        const substitution = (matrix[i - 1]?.[j - 1] ?? 0) + cost;
        
        matrix[i]![j] = Math.min(deletion, insertion, substitution);
      }
    }

    const maxLength = Math.max(len1, len2);
    const distance = matrix[len1]?.[len2] ?? 0;
    return (maxLength - distance) / maxLength;
  }

  /**
   * Validate that required database functions exist
   * Useful for health checks and setup validation
   */
  public async validateDatabaseFunctions(): Promise<{
    isValid: boolean;
    missingFunctions: string[];
    errors: string[];
  }> {
    const requiredFunctions = [
      'find_matching_tags',
      'get_tags_by_category',
      'log_tag_matching',
      'normalize_tag_name'
    ];

    const missingFunctions: string[] = [];
    const errors: string[] = [];

    for (const functionName of requiredFunctions) {
      try {
        // Test if function exists by calling it with minimal parameters
        const { error } = await supabaseClient
          .rpc(functionName, functionName === 'normalize_tag_name' 
            ? { tag_name: 'test' } 
            : functionName === 'find_matching_tags'
            ? { extracted_text: 'test', category_name: 'colors', min_confidence: 0.7 }
            : functionName === 'get_tags_by_category'
            ? { category_name: 'colors' }
            : { 
                p_material_id: null,
                p_extracted_text: 'test',
                p_matched_tag_id: null,
                p_confidence_score: null,
                p_matching_method: 'test',
                p_category_name: 'colors'
              }
          );

        if (error && error.code === '42883') { // Function does not exist
          missingFunctions.push(functionName);
        } else if (error && error.code !== 'PGRST116') { // Ignore "no rows" errors
          errors.push(`${functionName}: ${error.message}`);
        }
      } catch (error) {
        errors.push(`${functionName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return {
      isValid: missingFunctions.length === 0 && errors.length === 0,
      missingFunctions,
      errors
    };
  }
}

// Export singleton instance for easy importing
export const tagMatchingService = TagMatchingService.getInstance();