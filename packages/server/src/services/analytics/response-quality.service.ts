import { logger } from '../../utils/logger';
import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../../types/supabase';

/**
 * Response feedback type
 */
export enum FeedbackType {
  THUMBS_UP = 'thumbs_up',
  THUMBS_DOWN = 'thumbs_down',
  STAR_RATING = 'star_rating',
  DETAILED = 'detailed'
}

/**
 * Error category type
 */
export enum ErrorCategory {
  FACTUAL_ERROR = 'factual_error',
  HALLUCINATION = 'hallucination',
  INCOMPLETE_ANSWER = 'incomplete_answer',
  MISUNDERSTOOD_QUERY = 'misunderstood_query',
  IRRELEVANT = 'irrelevant',
  OTHER = 'other'
}

/**
 * Response feedback interface
 */
export interface ResponseFeedback {
  id?: string;
  responseId: string;
  userId: string;
  modelId: string;
  feedbackType: FeedbackType;
  rating?: number; // 1-5 for star ratings
  isPositive?: boolean; // true for thumbs up, false for thumbs down
  errorCategory?: ErrorCategory;
  feedbackText?: string;
  createdAt?: Date;
}

/**
 * Response quality metrics interface
 */
export interface ResponseQualityMetrics {
  overallSatisfaction: number; // percentage
  responseAccuracy: number; // percentage
  averageRating: number; // out of 5
  totalResponses: number;
  ratedResponses: number;
  feedbackRate: number; // percentage
  errorDistribution: {
    category: ErrorCategory;
    count: number;
    percentage: number;
  }[];
  modelComparison: {
    modelId: string;
    modelName: string;
    accuracy: number;
    satisfaction: number;
    averageRating: number;
    responseCount: number;
  }[];
  dailyTrends: {
    date: string;
    satisfaction: number;
    accuracy: number;
    rating: number;
    responses: number;
  }[];
}

/**
 * Response Quality Service
 * Handles tracking and analyzing response quality metrics
 */
export class ResponseQualityService {
  private supabase: SupabaseClient<Database>;

  /**
   * Constructor
   * @param supabaseClient Supabase client
   */
  constructor(supabaseClient: SupabaseClient<Database>) {
    this.supabase = supabaseClient;
  }

  /**
   * Record user feedback for a response
   * @param feedback Feedback data
   * @returns Recorded feedback
   */
  public async recordFeedback(feedback: ResponseFeedback): Promise<ResponseFeedback> {
    try {
      const { data, error } = await this.supabase
        .from('response_feedback')
        .insert({
          response_id: feedback.responseId,
          user_id: feedback.userId,
          model_id: feedback.modelId,
          feedback_type: feedback.feedbackType,
          rating: feedback.rating,
          is_positive: feedback.isPositive,
          error_category: feedback.errorCategory,
          feedback_text: feedback.feedbackText,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        logger.error('Error recording response feedback', { error, feedback });
        throw error;
      }

      // Map the database response to our interface
      return {
        id: data.id,
        responseId: data.response_id,
        userId: data.user_id,
        modelId: data.model_id,
        feedbackType: data.feedback_type as FeedbackType,
        rating: data.rating,
        isPositive: data.is_positive,
        errorCategory: data.error_category as ErrorCategory,
        feedbackText: data.feedback_text,
        createdAt: new Date(data.created_at)
      };
    } catch (error) {
      logger.error('Error in recordFeedback', { error });
      throw error;
    }
  }

  /**
   * Get quality metrics for a specific time range
   * @param startDate Start date
   * @param endDate End date
   * @param modelId Optional model ID to filter by
   * @returns Response quality metrics
   */
  public async getQualityMetrics(
    startDate: Date,
    endDate: Date,
    modelId?: string
  ): Promise<ResponseQualityMetrics> {
    try {
      // Build the base query
      let query = this.supabase
        .from('response_feedback')
        .select('*, model:models(name)')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      // Add model filter if provided
      if (modelId) {
        query = query.eq('model_id', modelId);
      }

      // Execute the query
      const { data, error } = await query;

      if (error) {
        logger.error('Error fetching response feedback', { error, startDate, endDate, modelId });
        throw error;
      }

      // Get total responses (including those without feedback)
      const { count: totalResponses, error: countError } = await this.supabase
        .from('model_responses')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (countError) {
        logger.error('Error counting total responses', { error: countError });
        throw countError;
      }

      // Process the data to calculate metrics
      const ratedResponses = data.length;
      const feedbackRate = totalResponses ? (ratedResponses / totalResponses) * 100 : 0;

      // Calculate satisfaction (percentage of positive feedback)
      const positiveCount = data.filter(f => 
        (f.feedback_type === FeedbackType.THUMBS_UP && f.is_positive) || 
        (f.feedback_type === FeedbackType.STAR_RATING && f.rating && f.rating >= 4)
      ).length;
      
      const overallSatisfaction = ratedResponses ? (positiveCount / ratedResponses) * 100 : 0;

      // Calculate average rating
      const ratingSum = data
        .filter(f => f.feedback_type === FeedbackType.STAR_RATING && f.rating)
        .reduce((sum, f) => sum + (f.rating || 0), 0);
      
      const ratingCount = data.filter(f => f.feedback_type === FeedbackType.STAR_RATING && f.rating).length;
      const averageRating = ratingCount ? ratingSum / ratingCount : 0;

      // Calculate response accuracy (inverse of error rate)
      const errorCount = data.filter(f => f.error_category).length;
      const responseAccuracy = ratedResponses ? ((ratedResponses - errorCount) / ratedResponses) * 100 : 0;

      // Calculate error distribution
      const errorCategories = Object.values(ErrorCategory);
      const errorDistribution = errorCategories.map(category => {
        const count = data.filter(f => f.error_category === category).length;
        return {
          category,
          count,
          percentage: errorCount ? (count / errorCount) * 100 : 0
        };
      }).filter(e => e.count > 0);

      // Calculate model comparison
      const modelIds = [...new Set(data.map(f => f.model_id))];
      const modelComparison = await Promise.all(modelIds.map(async (id) => {
        const modelData = data.filter(f => f.model_id === id);
        const modelPositiveCount = modelData.filter(f => 
          (f.feedback_type === FeedbackType.THUMBS_UP && f.is_positive) || 
          (f.feedback_type === FeedbackType.STAR_RATING && f.rating && f.rating >= 4)
        ).length;
        
        const modelRatingSum = modelData
          .filter(f => f.feedback_type === FeedbackType.STAR_RATING && f.rating)
          .reduce((sum, f) => sum + (f.rating || 0), 0);
        
        const modelRatingCount = modelData.filter(f => f.feedback_type === FeedbackType.STAR_RATING && f.rating).length;
        const modelErrorCount = modelData.filter(f => f.error_category).length;
        
        // Get model name
        const { data: modelInfo, error: modelError } = await this.supabase
          .from('models')
          .select('name')
          .eq('id', id)
          .single();
        
        if (modelError) {
          logger.error('Error fetching model info', { error: modelError, modelId: id });
          throw modelError;
        }

        return {
          modelId: id,
          modelName: modelInfo.name,
          accuracy: modelData.length ? ((modelData.length - modelErrorCount) / modelData.length) * 100 : 0,
          satisfaction: modelData.length ? (modelPositiveCount / modelData.length) * 100 : 0,
          averageRating: modelRatingCount ? modelRatingSum / modelRatingCount : 0,
          responseCount: modelData.length
        };
      }));

      // Calculate daily trends
      const dailyTrends = this.calculateDailyTrends(data, startDate, endDate);

      return {
        overallSatisfaction,
        responseAccuracy,
        averageRating,
        totalResponses: totalResponses || 0,
        ratedResponses,
        feedbackRate,
        errorDistribution,
        modelComparison,
        dailyTrends
      };
    } catch (error) {
      logger.error('Error in getQualityMetrics', { error });
      throw error;
    }
  }

  /**
   * Get problematic responses
   * @param limit Number of responses to return
   * @param offset Offset for pagination
   * @param filters Optional filters
   * @returns Problematic responses
   */
  public async getProblematicResponses(
    limit: number = 10,
    offset: number = 0,
    filters: {
      modelId?: string;
      errorCategory?: ErrorCategory;
      minRating?: number;
      maxRating?: number;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ) {
    try {
      // Build the base query
      let query = this.supabase
        .from('response_feedback')
        .select(`
          *,
          model:models(name),
          response:model_responses(query_text, response_text)
        `)
        .or('feedback_type.eq.detailed,and(feedback_type.eq.star_rating,rating.lte.2),and(feedback_type.eq.thumbs_up,is_positive.eq.false)')
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters.modelId) {
        query = query.eq('model_id', filters.modelId);
      }

      if (filters.errorCategory) {
        query = query.eq('error_category', filters.errorCategory);
      }

      if (filters.minRating !== undefined) {
        query = query.gte('rating', filters.minRating);
      }

      if (filters.maxRating !== undefined) {
        query = query.lte('rating', filters.maxRating);
      }

      if (filters.startDate) {
        query = query.gte('created_at', filters.startDate.toISOString());
      }

      if (filters.endDate) {
        query = query.lte('created_at', filters.endDate.toISOString());
      }

      // Apply pagination
      query = query.range(offset, offset + limit - 1);

      // Execute the query
      const { data, error } = await query;

      if (error) {
        logger.error('Error fetching problematic responses', { error, filters });
        throw error;
      }

      return data.map(item => ({
        id: item.id,
        responseId: item.response_id,
        userId: item.user_id,
        modelId: item.model_id,
        modelName: item.model?.name,
        feedbackType: item.feedback_type,
        rating: item.rating,
        isPositive: item.is_positive,
        errorCategory: item.error_category,
        feedbackText: item.feedback_text,
        query: item.response?.query_text,
        response: item.response?.response_text,
        createdAt: new Date(item.created_at)
      }));
    } catch (error) {
      logger.error('Error in getProblematicResponses', { error });
      throw error;
    }
  }

  /**
   * Calculate daily trends from feedback data
   * @param data Feedback data
   * @param startDate Start date
   * @param endDate End date
   * @returns Daily trends
   */
  private calculateDailyTrends(data: any[], startDate: Date, endDate: Date) {
    const dailyTrends: {
      date: string;
      satisfaction: number;
      accuracy: number;
      rating: number;
      responses: number;
    }[] = [];

    // Create a map of dates
    const dateMap = new Map<string, {
      responses: number;
      positiveCount: number;
      errorCount: number;
      ratingSum: number;
      ratingCount: number;
    }>();

    // Initialize the map with all dates in the range
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateString = currentDate.toISOString().split('T')[0];
      dateMap.set(dateString, {
        responses: 0,
        positiveCount: 0,
        errorCount: 0,
        ratingSum: 0,
        ratingCount: 0
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Populate the map with data
    data.forEach(item => {
      const dateString = new Date(item.created_at).toISOString().split('T')[0];
      const dateData = dateMap.get(dateString);
      
      if (dateData) {
        dateData.responses++;
        
        if ((item.feedback_type === FeedbackType.THUMBS_UP && item.is_positive) || 
            (item.feedback_type === FeedbackType.STAR_RATING && item.rating && item.rating >= 4)) {
          dateData.positiveCount++;
        }
        
        if (item.error_category) {
          dateData.errorCount++;
        }
        
        if (item.feedback_type === FeedbackType.STAR_RATING && item.rating) {
          dateData.ratingSum += item.rating;
          dateData.ratingCount++;
        }
      }
    });

    // Convert the map to an array of daily trends
    dateMap.forEach((value, key) => {
      dailyTrends.push({
        date: key,
        satisfaction: value.responses ? (value.positiveCount / value.responses) * 100 : 0,
        accuracy: value.responses ? ((value.responses - value.errorCount) / value.responses) * 100 : 0,
        rating: value.ratingCount ? value.ratingSum / value.ratingCount : 0,
        responses: value.responses
      });
    });

    // Sort by date
    dailyTrends.sort((a, b) => a.date.localeCompare(b.date));

    return dailyTrends;
  }
}

export default ResponseQualityService;
