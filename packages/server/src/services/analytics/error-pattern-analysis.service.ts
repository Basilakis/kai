/**
 * Error Pattern Analysis Service
 * 
 * This service analyzes error patterns in model responses based on user feedback.
 * It identifies common error types, suggests improvements, and tracks error trends over time.
 */

import { supabase } from '../../config/supabase';
import { logger } from '../../utils/logger';
import { ErrorCategory } from './response-quality.service';

// Error pattern interface
export interface ErrorPattern {
  id: string;
  category: ErrorCategory;
  description: string;
  frequency: number;
  examples: Array<{
    query: string;
    response: string;
    feedback?: string;
  }>;
  suggestedFix?: string;
  firstDetected: Date;
  lastDetected: Date;
  status: 'active' | 'fixed' | 'monitoring';
  relatedPatterns?: string[];
}

// Error trend interface
export interface ErrorTrend {
  category: ErrorCategory;
  counts: Array<{
    date: string;
    count: number;
  }>;
  trend: 'increasing' | 'decreasing' | 'stable';
  percentageChange: number;
}

// Improvement suggestion interface
export interface ImprovementSuggestion {
  id: string;
  patternId: string;
  suggestion: string;
  rationale: string;
  impact: 'high' | 'medium' | 'low';
  implementationDifficulty: 'high' | 'medium' | 'low';
  createdAt: Date;
  status: 'pending' | 'implemented' | 'rejected';
}

/**
 * Error Pattern Analysis Service
 */
class ErrorPatternAnalysisService {
  /**
   * Analyze error patterns for a model
   * @param modelId Model ID
   * @param startDate Start date
   * @param endDate End date
   * @param minFrequency Minimum frequency to consider a pattern
   * @returns Error patterns
   */
  public async analyzeErrorPatterns(
    modelId: string,
    startDate: Date,
    endDate: Date,
    minFrequency: number = 3
  ): Promise<ErrorPattern[]> {
    try {
      // Get feedback data with errors
      const { data: feedbackData, error: feedbackError } = await supabase
        .from('response_feedback')
        .select(`
          id,
          error_category,
          feedback_text,
          created_at,
          response:model_responses(
            id,
            query_text,
            response_text
          )
        `)
        .eq('model_id', modelId)
        .not('error_category', 'is', null)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (feedbackError) {
        logger.error('Error getting feedback data', { error: feedbackError, modelId });
        throw feedbackError;
      }

      if (!feedbackData || feedbackData.length === 0) {
        return [];
      }

      // Group feedback by error category
      const feedbackByCategory: Record<string, any[]> = {};
      
      feedbackData.forEach(feedback => {
        const category = feedback.error_category;
        if (!feedbackByCategory[category]) {
          feedbackByCategory[category] = [];
        }
        feedbackByCategory[category].push(feedback);
      });

      // Identify patterns within each category
      const patterns: ErrorPattern[] = [];
      
      for (const [category, feedbacks] of Object.entries(feedbackByCategory)) {
        if (feedbacks.length < minFrequency) {
          continue; // Skip categories with too few examples
        }

        // Simple pattern: just group by category for now
        // In a real implementation, this would use NLP to cluster similar errors
        const pattern: ErrorPattern = {
          id: `pattern-${category}-${Date.now()}`,
          category: category as ErrorCategory,
          description: this.getErrorCategoryDescription(category as ErrorCategory),
          frequency: feedbacks.length,
          examples: feedbacks.slice(0, 5).map(feedback => ({
            query: feedback.response?.query_text || '',
            response: feedback.response?.response_text || '',
            feedback: feedback.feedback_text
          })),
          suggestedFix: this.getSuggestedFix(category as ErrorCategory),
          firstDetected: new Date(feedbacks.reduce((min, f) => 
            new Date(f.created_at) < new Date(min) ? f.created_at : min, 
            feedbacks[0].created_at
          )),
          lastDetected: new Date(feedbacks.reduce((max, f) => 
            new Date(f.created_at) > new Date(max) ? f.created_at : max, 
            feedbacks[0].created_at
          )),
          status: 'active'
        };

        patterns.push(pattern);
      }

      // Sort patterns by frequency
      return patterns.sort((a, b) => b.frequency - a.frequency);
    } catch (error) {
      logger.error('Error analyzing error patterns', { error, modelId });
      throw error;
    }
  }

  /**
   * Get error trends for a model
   * @param modelId Model ID
   * @param days Number of days to analyze
   * @returns Error trends
   */
  public async getErrorTrends(modelId: string, days: number = 30): Promise<ErrorTrend[]> {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Get daily error counts by category
      const { data, error } = await supabase.rpc('get_daily_error_counts', {
        p_model_id: modelId,
        p_start_date: startDate.toISOString(),
        p_end_date: endDate.toISOString()
      });

      if (error) {
        logger.error('Error getting daily error counts', { error, modelId });
        throw error;
      }

      if (!data || data.length === 0) {
        return [];
      }

      // Group by category
      const trendsByCategory: Record<string, any[]> = {};
      
      data.forEach((item: any) => {
        if (!trendsByCategory[item.error_category]) {
          trendsByCategory[item.error_category] = [];
        }
        trendsByCategory[item.error_category].push({
          date: item.day,
          count: item.count
        });
      });

      // Calculate trends
      const trends: ErrorTrend[] = [];
      
      for (const [category, counts] of Object.entries(trendsByCategory)) {
        // Sort counts by date
        counts.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // Calculate trend
        const firstWeekCounts = counts.slice(0, 7).reduce((sum, item) => sum + item.count, 0);
        const lastWeekCounts = counts.slice(-7).reduce((sum, item) => sum + item.count, 0);
        
        let trendDirection: 'increasing' | 'decreasing' | 'stable' = 'stable';
        let percentageChange = 0;
        
        if (firstWeekCounts > 0) {
          percentageChange = ((lastWeekCounts - firstWeekCounts) / firstWeekCounts) * 100;
          
          if (percentageChange > 10) {
            trendDirection = 'increasing';
          } else if (percentageChange < -10) {
            trendDirection = 'decreasing';
          }
        }

        trends.push({
          category: category as ErrorCategory,
          counts,
          trend: trendDirection,
          percentageChange
        });
      }

      // Sort trends by percentage change (most increasing first)
      return trends.sort((a, b) => b.percentageChange - a.percentageChange);
    } catch (error) {
      logger.error('Error getting error trends', { error, modelId });
      throw error;
    }
  }

  /**
   * Generate improvement suggestions for error patterns
   * @param patterns Error patterns
   * @returns Improvement suggestions
   */
  public generateImprovementSuggestions(patterns: ErrorPattern[]): ImprovementSuggestion[] {
    const suggestions: ImprovementSuggestion[] = [];
    
    patterns.forEach(pattern => {
      const suggestion: ImprovementSuggestion = {
        id: `suggestion-${pattern.id}`,
        patternId: pattern.id,
        suggestion: this.getSuggestedFix(pattern.category) || 'Review examples and improve model training',
        rationale: this.getSuggestionRationale(pattern.category),
        impact: this.getImpactLevel(pattern.frequency),
        implementationDifficulty: this.getDifficultyLevel(pattern.category),
        createdAt: new Date(),
        status: 'pending'
      };
      
      suggestions.push(suggestion);
    });
    
    // Sort suggestions by impact (high to low)
    return suggestions.sort((a, b) => {
      const impactOrder = { high: 3, medium: 2, low: 1 };
      const difficultyOrder = { low: 3, medium: 2, high: 1 };
      
      // Prioritize high impact, low difficulty
      const aScore = impactOrder[a.impact] * difficultyOrder[a.implementationDifficulty];
      const bScore = impactOrder[b.impact] * difficultyOrder[b.implementationDifficulty];
      
      return bScore - aScore;
    });
  }

  /**
   * Store an error pattern
   * @param pattern Error pattern
   * @returns Stored pattern ID
   */
  public async storeErrorPattern(pattern: ErrorPattern): Promise<string> {
    try {
      const { data, error } = await supabase
        .from('error_patterns')
        .insert({
          id: pattern.id,
          category: pattern.category,
          description: pattern.description,
          frequency: pattern.frequency,
          examples: pattern.examples,
          suggested_fix: pattern.suggestedFix,
          first_detected: pattern.firstDetected.toISOString(),
          last_detected: pattern.lastDetected.toISOString(),
          status: pattern.status,
          related_patterns: pattern.relatedPatterns
        })
        .select('id')
        .single();

      if (error) {
        logger.error('Error storing error pattern', { error, pattern });
        throw error;
      }

      return data.id;
    } catch (error) {
      logger.error('Error in storeErrorPattern', { error });
      throw error;
    }
  }

  /**
   * Store an improvement suggestion
   * @param suggestion Improvement suggestion
   * @returns Stored suggestion ID
   */
  public async storeImprovementSuggestion(suggestion: ImprovementSuggestion): Promise<string> {
    try {
      const { data, error } = await supabase
        .from('improvement_suggestions')
        .insert({
          id: suggestion.id,
          pattern_id: suggestion.patternId,
          suggestion: suggestion.suggestion,
          rationale: suggestion.rationale,
          impact: suggestion.impact,
          implementation_difficulty: suggestion.implementationDifficulty,
          created_at: suggestion.createdAt.toISOString(),
          status: suggestion.status
        })
        .select('id')
        .single();

      if (error) {
        logger.error('Error storing improvement suggestion', { error, suggestion });
        throw error;
      }

      return data.id;
    } catch (error) {
      logger.error('Error in storeImprovementSuggestion', { error });
      throw error;
    }
  }

  /**
   * Get stored error patterns
   * @param modelId Model ID (optional)
   * @param status Status filter (optional)
   * @param limit Limit
   * @param offset Offset
   * @returns Error patterns
   */
  public async getStoredErrorPatterns(
    modelId?: string,
    status?: 'active' | 'fixed' | 'monitoring',
    limit: number = 10,
    offset: number = 0
  ): Promise<{ patterns: ErrorPattern[]; total: number }> {
    try {
      let query = supabase
        .from('error_patterns')
        .select('*', { count: 'exact' });

      if (modelId) {
        query = query.eq('model_id', modelId);
      }

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error, count } = await query
        .order('frequency', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        logger.error('Error getting stored error patterns', { error, modelId });
        throw error;
      }

      const patterns: ErrorPattern[] = data.map(pattern => ({
        id: pattern.id,
        category: pattern.category as ErrorCategory,
        description: pattern.description,
        frequency: pattern.frequency,
        examples: pattern.examples,
        suggestedFix: pattern.suggested_fix,
        firstDetected: new Date(pattern.first_detected),
        lastDetected: new Date(pattern.last_detected),
        status: pattern.status as 'active' | 'fixed' | 'monitoring',
        relatedPatterns: pattern.related_patterns
      }));

      return {
        patterns,
        total: count || 0
      };
    } catch (error) {
      logger.error('Error in getStoredErrorPatterns', { error, modelId });
      throw error;
    }
  }

  /**
   * Get stored improvement suggestions
   * @param patternId Pattern ID (optional)
   * @param status Status filter (optional)
   * @param limit Limit
   * @param offset Offset
   * @returns Improvement suggestions
   */
  public async getStoredImprovementSuggestions(
    patternId?: string,
    status?: 'pending' | 'implemented' | 'rejected',
    limit: number = 10,
    offset: number = 0
  ): Promise<{ suggestions: ImprovementSuggestion[]; total: number }> {
    try {
      let query = supabase
        .from('improvement_suggestions')
        .select('*', { count: 'exact' });

      if (patternId) {
        query = query.eq('pattern_id', patternId);
      }

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        logger.error('Error getting stored improvement suggestions', { error, patternId });
        throw error;
      }

      const suggestions: ImprovementSuggestion[] = data.map(suggestion => ({
        id: suggestion.id,
        patternId: suggestion.pattern_id,
        suggestion: suggestion.suggestion,
        rationale: suggestion.rationale,
        impact: suggestion.impact as 'high' | 'medium' | 'low',
        implementationDifficulty: suggestion.implementation_difficulty as 'high' | 'medium' | 'low',
        createdAt: new Date(suggestion.created_at),
        status: suggestion.status as 'pending' | 'implemented' | 'rejected'
      }));

      return {
        suggestions,
        total: count || 0
      };
    } catch (error) {
      logger.error('Error in getStoredImprovementSuggestions', { error, patternId });
      throw error;
    }
  }

  /**
   * Update error pattern status
   * @param patternId Pattern ID
   * @param status New status
   * @returns Updated pattern
   */
  public async updateErrorPatternStatus(
    patternId: string,
    status: 'active' | 'fixed' | 'monitoring'
  ): Promise<ErrorPattern> {
    try {
      const { data, error } = await supabase
        .from('error_patterns')
        .update({ status })
        .eq('id', patternId)
        .select('*')
        .single();

      if (error) {
        logger.error('Error updating error pattern status', { error, patternId });
        throw error;
      }

      return {
        id: data.id,
        category: data.category as ErrorCategory,
        description: data.description,
        frequency: data.frequency,
        examples: data.examples,
        suggestedFix: data.suggested_fix,
        firstDetected: new Date(data.first_detected),
        lastDetected: new Date(data.last_detected),
        status: data.status as 'active' | 'fixed' | 'monitoring',
        relatedPatterns: data.related_patterns
      };
    } catch (error) {
      logger.error('Error in updateErrorPatternStatus', { error, patternId });
      throw error;
    }
  }

  /**
   * Update improvement suggestion status
   * @param suggestionId Suggestion ID
   * @param status New status
   * @returns Updated suggestion
   */
  public async updateImprovementSuggestionStatus(
    suggestionId: string,
    status: 'pending' | 'implemented' | 'rejected'
  ): Promise<ImprovementSuggestion> {
    try {
      const { data, error } = await supabase
        .from('improvement_suggestions')
        .update({ status })
        .eq('id', suggestionId)
        .select('*')
        .single();

      if (error) {
        logger.error('Error updating improvement suggestion status', { error, suggestionId });
        throw error;
      }

      return {
        id: data.id,
        patternId: data.pattern_id,
        suggestion: data.suggestion,
        rationale: data.rationale,
        impact: data.impact as 'high' | 'medium' | 'low',
        implementationDifficulty: data.implementation_difficulty as 'high' | 'medium' | 'low',
        createdAt: new Date(data.created_at),
        status: data.status as 'pending' | 'implemented' | 'rejected'
      };
    } catch (error) {
      logger.error('Error in updateImprovementSuggestionStatus', { error, suggestionId });
      throw error;
    }
  }

  /**
   * Get error category description
   * @param category Error category
   * @returns Description
   */
  private getErrorCategoryDescription(category: ErrorCategory): string {
    switch (category) {
      case ErrorCategory.FACTUAL_ERROR:
        return 'Response contains factually incorrect information';
      case ErrorCategory.HALLUCINATION:
        return 'Response contains made-up or fabricated information';
      case ErrorCategory.INCOMPLETE_ANSWER:
        return 'Response is incomplete or missing key information';
      case ErrorCategory.MISUNDERSTOOD_QUERY:
        return 'Model misunderstood the user\'s query or intent';
      case ErrorCategory.IRRELEVANT:
        return 'Response is irrelevant to the user\'s query';
      case ErrorCategory.OTHER:
        return 'Other error type not covered by standard categories';
      default:
        return 'Unknown error category';
    }
  }

  /**
   * Get suggested fix for an error category
   * @param category Error category
   * @returns Suggested fix
   */
  private getSuggestedFix(category: ErrorCategory): string {
    switch (category) {
      case ErrorCategory.FACTUAL_ERROR:
        return 'Enhance the model\'s knowledge base with accurate information and fine-tune on corrected examples';
      case ErrorCategory.HALLUCINATION:
        return 'Implement stronger grounding techniques and train the model to indicate uncertainty rather than fabricating information';
      case ErrorCategory.INCOMPLETE_ANSWER:
        return 'Fine-tune the model to provide more comprehensive responses and improve context handling';
      case ErrorCategory.MISUNDERSTOOD_QUERY:
        return 'Improve query understanding through better intent recognition and fine-tune on misunderstood examples';
      case ErrorCategory.IRRELEVANT:
        return 'Enhance relevance scoring and train the model to better match responses to queries';
      case ErrorCategory.OTHER:
        return 'Review examples to identify specific issues and develop targeted improvements';
      default:
        return 'Analyze examples and develop a custom improvement strategy';
    }
  }

  /**
   * Get suggestion rationale
   * @param category Error category
   * @returns Rationale
   */
  private getSuggestionRationale(category: ErrorCategory): string {
    switch (category) {
      case ErrorCategory.FACTUAL_ERROR:
        return 'Factual errors undermine user trust and can lead to incorrect decisions. Improving factual accuracy is critical for maintaining credibility.';
      case ErrorCategory.HALLUCINATION:
        return 'Hallucinations are particularly damaging to user trust and can be difficult to detect. Reducing hallucinations is essential for reliable AI systems.';
      case ErrorCategory.INCOMPLETE_ANSWER:
        return 'Incomplete answers force users to ask follow-up questions or seek information elsewhere, reducing efficiency and satisfaction.';
      case ErrorCategory.MISUNDERSTOOD_QUERY:
        return 'Query misunderstanding leads to irrelevant responses and user frustration. Improving query understanding enhances the overall user experience.';
      case ErrorCategory.IRRELEVANT:
        return 'Irrelevant responses waste user time and reduce confidence in the system. Enhancing relevance improves user satisfaction and engagement.';
      case ErrorCategory.OTHER:
        return 'Addressing these miscellaneous issues will improve overall response quality and user experience.';
      default:
        return 'Addressing this issue will improve response quality and user satisfaction.';
    }
  }

  /**
   * Get impact level based on frequency
   * @param frequency Error frequency
   * @returns Impact level
   */
  private getImpactLevel(frequency: number): 'high' | 'medium' | 'low' {
    if (frequency >= 10) {
      return 'high';
    } else if (frequency >= 5) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Get implementation difficulty level
   * @param category Error category
   * @returns Difficulty level
   */
  private getDifficultyLevel(category: ErrorCategory): 'high' | 'medium' | 'low' {
    switch (category) {
      case ErrorCategory.FACTUAL_ERROR:
        return 'medium'; // Requires knowledge base updates
      case ErrorCategory.HALLUCINATION:
        return 'high'; // Challenging problem in AI
      case ErrorCategory.INCOMPLETE_ANSWER:
        return 'medium'; // Requires training on more comprehensive examples
      case ErrorCategory.MISUNDERSTOOD_QUERY:
        return 'medium'; // Requires intent recognition improvements
      case ErrorCategory.IRRELEVANT:
        return 'low'; // Often fixable with better matching
      case ErrorCategory.OTHER:
        return 'medium'; // Varies based on specific issues
      default:
        return 'medium';
    }
  }
}

export const errorPatternAnalysisService = new ErrorPatternAnalysisService();
export default errorPatternAnalysisService;
