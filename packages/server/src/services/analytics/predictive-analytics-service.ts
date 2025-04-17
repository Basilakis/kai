/**
 * Predictive Analytics Service
 *
 * This service provides predictive analytics capabilities including:
 * - Time-series forecasting
 * - Anomaly detection
 * - User behavior prediction
 */

import { logger } from '../../utils/logger';
import { supabase } from '../supabase/supabaseClient';
import { withConnection } from '../../../../shared/src/services/supabase/connectionPool';
import { withCache } from '../../../../shared/src/services/supabase/queryCache';
import mcpClientService, { MCPServiceKey } from '../mcp/mcpClientService';
import creditService from '../credit/creditService';
import { v4 as uuidv4 } from 'uuid';

/**
 * Time-series forecast options
 */
export interface TimeSeriesForecastOptions {
  eventType?: string;
  resourceType?: string;
  startDate: Date;
  endDate: Date;
  forecastPeriods: number;
  interval: 'hour' | 'day' | 'week' | 'month';
}

/**
 * Time-series forecast result
 */
export interface TimeSeriesForecastResult {
  id: string;
  historical: Array<{
    date: string;
    count: number;
  }>;
  forecast: Array<{
    date: string;
    count: number;
    is_forecast: boolean;
  }>;
  parameters: {
    eventType?: string;
    resourceType?: string;
    startDate: string;
    endDate: string;
    forecastPeriods: number;
    interval: string;
  };
  modelInfo: {
    name: string;
    version: string;
    accuracy?: number;
    confidence?: number;
  };
}

/**
 * Anomaly detection options
 */
export interface AnomalyDetectionOptions {
  eventType?: string;
  resourceType?: string;
  startDate: Date;
  endDate: Date;
  interval: 'hour' | 'day' | 'week' | 'month';
  threshold?: number;
}

/**
 * Anomaly detection result
 */
export interface AnomalyDetectionResult {
  id: string;
  timeSeries: Array<{
    date: string;
    count: number;
  }>;
  anomalies: Array<{
    date: string;
    count: number;
    mean: number;
    stdDev: number;
    zScore: number;
    severity: 'low' | 'medium' | 'high';
  }>;
  statistics: {
    mean: number;
    stdDev: number;
    threshold: number;
  };
  parameters: {
    eventType?: string;
    resourceType?: string;
    startDate: string;
    endDate: string;
    interval: string;
  };
}

/**
 * User behavior prediction options
 */
export interface UserBehaviorPredictionOptions {
  userId: string;
  predictionType: 'next_action' | 'churn_risk' | 'engagement' | 'content_preference';
  lookbackDays: number;
  includeUserProfile?: boolean;
}

/**
 * User behavior prediction result
 */
export interface UserBehaviorPredictionResult {
  id: string;
  userId: string;
  predictionType: string;
  predictions: Array<{
    action: string;
    probability: number;
    confidence: number;
    recommendedContent?: Array<{
      id: string;
      type: string;
      name: string;
      score: number;
    }>;
  }>;
  userInsights: {
    activityLevel: 'low' | 'medium' | 'high';
    interests: Array<{
      category: string;
      score: number;
    }>;
    patterns: Array<{
      pattern: string;
      description: string;
      strength: number;
    }>;
  };
  modelInfo: {
    name: string;
    version: string;
    accuracy?: number;
    confidence?: number;
  };
}

/**
 * Predictive Analytics Service class
 */
class PredictiveAnalyticsService {
  private static instance: PredictiveAnalyticsService;
  private readonly tableName = 'predictive_analytics_results';

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
    this.initializeService().catch(err => {
      logger.error(`Failed to initialize PredictiveAnalyticsService: ${err}`);
    });
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): PredictiveAnalyticsService {
    if (!PredictiveAnalyticsService.instance) {
      PredictiveAnalyticsService.instance = new PredictiveAnalyticsService();
    }
    return PredictiveAnalyticsService.instance;
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
        await this.createPredictiveAnalyticsTable();
      }
    } catch (err) {
      logger.error(`Error initializing predictive analytics service: ${err}`);
    }
  }

  /**
   * Create the predictive_analytics_results table in the database
   */
  private async createPredictiveAnalyticsTable(): Promise<void> {
    try {
      const { error } = await supabase.getClient().rpc('create_predictive_analytics_table');

      if (error) {
        logger.error(`Failed to create predictive analytics table: ${error}`);
        throw error;
      }

      logger.info('Predictive analytics table created successfully');
    } catch (err) {
      logger.error(`Error creating predictive analytics table: ${err}`);
      throw err;
    }
  }

  /**
   * Check if MCP is available for predictive analytics
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
   * Generate a time-series forecast
   *
   * @param options Forecast options
   * @param userId User ID for MCP integration
   * @returns Forecast result
   */
  public async generateTimeSeriesForecast(
    options: TimeSeriesForecastOptions,
    userId?: string
  ): Promise<TimeSeriesForecastResult> {
    try {
      // Generate a unique ID for this forecast
      const forecastId = uuidv4();

      // Check if MCP is available and user ID is provided
      const mcpAvailable = await this.isMCPAvailable();

      if (mcpAvailable && userId) {
        try {
          // Estimate query complexity (3 units per forecast)
          const estimatedUnits = 3;

          // Check if user has enough credits
          const hasEnoughCredits = await creditService.hasEnoughCreditsForService(
            userId,
            MCPServiceKey.ANALYTICS_TRENDS,
            estimatedUnits
          );

          if (hasEnoughCredits) {
            // Use MCP for time-series forecasting
            const mcpResult = await mcpClientService.generateTimeSeriesForecast(
              userId,
              {
                eventType: options.eventType,
                resourceType: options.resourceType,
                startDate: options.startDate.toISOString(),
                endDate: options.endDate.toISOString(),
                forecastPeriods: options.forecastPeriods,
                interval: options.interval
              }
            );

            // Track credit usage
            await creditService.useServiceCredits(
              userId,
              MCPServiceKey.ANALYTICS_TRENDS,
              estimatedUnits,
              `${MCPServiceKey.ANALYTICS_TRENDS} API usage`,
              {
                forecastType: 'time-series',
                interval: options.interval,
                periods: options.forecastPeriods
              }
            );

            // Store forecast result
            await this.storeForecastResult(
              forecastId,
              'time-series',
              mcpResult.modelInfo.name,
              mcpResult.modelInfo.version,
              options,
              mcpResult,
              mcpResult.modelInfo.accuracy,
              mcpResult.modelInfo.confidence,
              userId
            );

            return {
              ...mcpResult,
              id: forecastId
            };
          }
        } catch (mcpError: any) {
          // For MCP errors, log and fall back to direct implementation
          logger.warn(`MCP time-series forecast failed, falling back to direct implementation: ${mcpError.message}`);
        }
      }

      // Fall back to direct implementation if MCP is not available or failed
      return await this.generateDirectTimeSeriesForecast(forecastId, options, userId);
    } catch (error) {
      logger.error(`Error generating time-series forecast: ${error}`);
      throw error;
    }
  }

  /**
   * Generate a time-series forecast using direct implementation
   *
   * @param forecastId Forecast ID
   * @param options Forecast options
   * @param userId User ID
   * @returns Forecast result
   */
  private async generateDirectTimeSeriesForecast(
    forecastId: string,
    options: TimeSeriesForecastOptions,
    userId?: string
  ): Promise<TimeSeriesForecastResult> {
    try {
      // Use database function for forecasting
      const result = await withConnection(async (client) => {
        const { data, error } = await client.rpc('generate_time_series_forecast', {
          p_event_type: options.eventType,
          p_resource_type: options.resourceType,
          p_start_date: options.startDate.toISOString(),
          p_end_date: options.endDate.toISOString(),
          p_forecast_periods: options.forecastPeriods,
          p_interval: options.interval
        });

        if (error) {
          logger.error(`Failed to generate time-series forecast: ${error}`);
          throw error;
        }

        return data;
      });

      // Transform result to match interface
      const forecastResult: TimeSeriesForecastResult = {
        id: forecastId,
        historical: result.historical || [],
        forecast: result.forecast || [],
        parameters: {
          eventType: options.eventType,
          resourceType: options.resourceType,
          startDate: options.startDate.toISOString(),
          endDate: options.endDate.toISOString(),
          forecastPeriods: options.forecastPeriods,
          interval: options.interval
        },
        modelInfo: {
          name: 'SimpleMovingAverage',
          version: '1.0',
          // Simple accuracy estimation based on historical data variance
          accuracy: 0.7, // Placeholder accuracy
          confidence: 0.6 // Placeholder confidence
        }
      };

      // Store forecast result
      await this.storeForecastResult(
        forecastId,
        'time-series',
        forecastResult.modelInfo.name,
        forecastResult.modelInfo.version,
        options,
        forecastResult,
        forecastResult.modelInfo.accuracy,
        forecastResult.modelInfo.confidence,
        userId
      );

      return forecastResult;
    } catch (error) {
      logger.error(`Error generating direct time-series forecast: ${error}`);
      throw error;
    }
  }

  /**
   * Store forecast result in database
   *
   * @param id Result ID
   * @param modelType Model type
   * @param modelName Model name
   * @param modelVersion Model version
   * @param options Input options
   * @param results Results
   * @param accuracy Accuracy
   * @param confidence Confidence
   * @param userId User ID
   */
  /**
   * Detect anomalies in analytics data
   *
   * @param options Anomaly detection options
   * @param userId User ID for MCP integration
   * @returns Anomaly detection result
   */
  public async detectAnomalies(
    options: AnomalyDetectionOptions,
    userId?: string
  ): Promise<AnomalyDetectionResult> {
    try {
      // Generate a unique ID for this detection
      const detectionId = uuidv4();

      // Check if MCP is available and user ID is provided
      const mcpAvailable = await this.isMCPAvailable();

      if (mcpAvailable && userId) {
        try {
          // Estimate query complexity (3 units per anomaly detection)
          const estimatedUnits = 3;

          // Check if user has enough credits
          const hasEnoughCredits = await creditService.hasEnoughCreditsForService(
            userId,
            MCPServiceKey.ANALYTICS_STATS,
            estimatedUnits
          );

          if (hasEnoughCredits) {
            // Use MCP for anomaly detection
            const mcpResult = await mcpClientService.detectAnalyticsAnomalies(
              userId,
              {
                eventType: options.eventType,
                resourceType: options.resourceType,
                startDate: options.startDate.toISOString(),
                endDate: options.endDate.toISOString(),
                interval: options.interval,
                threshold: options.threshold
              }
            );

            // Track credit usage
            await creditService.useServiceCredits(
              userId,
              MCPServiceKey.ANALYTICS_STATS,
              estimatedUnits,
              `${MCPServiceKey.ANALYTICS_STATS} API usage`,
              {
                analysisType: 'anomaly-detection',
                interval: options.interval
              }
            );

            // Store anomaly detection result
            await this.storeAnomalyResult(
              detectionId,
              'anomaly-detection',
              'StatisticalOutlier',
              '1.0',
              options,
              mcpResult,
              mcpResult.statistics.confidence,
              userId
            );

            return {
              ...mcpResult,
              id: detectionId
            };
          }
        } catch (mcpError: any) {
          // For MCP errors, log and fall back to direct implementation
          logger.warn(`MCP anomaly detection failed, falling back to direct implementation: ${mcpError.message}`);
        }
      }

      // Fall back to direct implementation if MCP is not available or failed
      return await this.detectAnomaliesDirect(detectionId, options, userId);
    } catch (error) {
      logger.error(`Error detecting anomalies: ${error}`);
      throw error;
    }
  }

  /**
   * Detect anomalies using direct implementation
   *
   * @param detectionId Detection ID
   * @param options Anomaly detection options
   * @param userId User ID
   * @returns Anomaly detection result
   */
  private async detectAnomaliesDirect(
    detectionId: string,
    options: AnomalyDetectionOptions,
    userId?: string
  ): Promise<AnomalyDetectionResult> {
    try {
      // Use database function for anomaly detection
      const result = await withConnection(async (client) => {
        const { data, error } = await client.rpc('detect_analytics_anomalies', {
          p_event_type: options.eventType,
          p_resource_type: options.resourceType,
          p_start_date: options.startDate.toISOString(),
          p_end_date: options.endDate.toISOString(),
          p_interval: options.interval,
          p_threshold: options.threshold || 2.0
        });

        if (error) {
          logger.error(`Failed to detect anomalies: ${error}`);
          throw error;
        }

        return data;
      });

      // Transform result to match interface
      const detectionResult: AnomalyDetectionResult = {
        id: detectionId,
        timeSeries: result.time_series || [],
        anomalies: result.anomalies || [],
        statistics: {
          mean: result.statistics.mean,
          stdDev: result.statistics.std_dev,
          threshold: result.statistics.threshold
        },
        parameters: {
          eventType: options.eventType,
          resourceType: options.resourceType,
          startDate: options.startDate.toISOString(),
          endDate: options.endDate.toISOString(),
          interval: options.interval
        }
      };

      // Store anomaly detection result
      await this.storeAnomalyResult(
        detectionId,
        'anomaly-detection',
        'StatisticalOutlier',
        '1.0',
        options,
        detectionResult,
        detectionResult.anomalies.length > 0 ? 0.8 : 0.6, // Simple confidence estimation
        userId
      );

      return detectionResult;
    } catch (error) {
      logger.error(`Error detecting anomalies directly: ${error}`);
      throw error;
    }
  }

  /**
   * Store anomaly detection result in database
   *
   * @param id Result ID
   * @param modelType Model type
   * @param modelName Model name
   * @param modelVersion Model version
   * @param options Input options
   * @param results Results
   * @param confidence Confidence
   * @param userId User ID
   */
  private async storeAnomalyResult(
    id: string,
    modelType: string,
    modelName: string,
    modelVersion: string,
    options: any,
    results: any,
    confidence?: number,
    userId?: string
  ): Promise<void> {
    try {
      // Store result in database
      const { error } = await supabase.getClient()
        .from(this.tableName)
        .insert({
          id,
          model_type: modelType,
          model_name: modelName,
          model_version: modelVersion,
          prediction_type: 'anomaly-detection',
          start_date: options.startDate.toISOString(),
          end_date: options.endDate.toISOString(),
          input_parameters: options,
          results,
          confidence,
          created_by: userId
        });

      if (error) {
        logger.error(`Failed to store anomaly detection result: ${error}`);
      }
    } catch (error) {
      logger.error(`Error storing anomaly detection result: ${error}`);
    }
  }

  /**
   * Store forecast result in database
   *
   * @param id Result ID
   * @param modelType Model type
   * @param modelName Model name
   * @param modelVersion Model version
   * @param options Input options
   * @param results Results
   * @param accuracy Accuracy
   * @param confidence Confidence
   * @param userId User ID
   */
  private async storeForecastResult(
    id: string,
    modelType: string,
    modelName: string,
    modelVersion: string,
    options: any,
    results: any,
    accuracy?: number,
    confidence?: number,
    userId?: string
  ): Promise<void> {
    try {
      // Store result in database
      const { error } = await supabase.getClient()
        .from(this.tableName)
        .insert({
          id,
          model_type: modelType,
          model_name: modelName,
          model_version: modelVersion,
          prediction_type: 'forecast',
          start_date: options.startDate.toISOString(),
          end_date: options.endDate.toISOString(),
          input_parameters: options,
          results,
          accuracy,
          confidence,
          created_by: userId
        });

      if (error) {
        logger.error(`Failed to store forecast result: ${error}`);
      }
    } catch (error) {
      logger.error(`Error storing forecast result: ${error}`);
    }
  }

  /**
   * Predict user behavior
   *
   * @param options User behavior prediction options
   * @param requestUserId User ID making the request (for MCP integration)
   * @returns User behavior prediction result
   */
  public async predictUserBehavior(
    options: UserBehaviorPredictionOptions,
    requestUserId?: string
  ): Promise<UserBehaviorPredictionResult> {
    try {
      // Generate a unique ID for this prediction
      const predictionId = uuidv4();

      // Check if MCP is available and user ID is provided
      const mcpAvailable = await this.isMCPAvailable();

      if (mcpAvailable && requestUserId) {
        try {
          // Estimate query complexity (4 units per user behavior prediction)
          const estimatedUnits = 4;

          // Check if user has enough credits
          const hasEnoughCredits = await creditService.hasEnoughCreditsForService(
            requestUserId,
            MCPServiceKey.ANALYTICS_STATS,
            estimatedUnits
          );

          if (hasEnoughCredits) {
            // Use MCP for user behavior prediction
            const mcpResult = await mcpClientService.predictUserBehavior(
              requestUserId,
              {
                userId: options.userId,
                predictionType: options.predictionType,
                lookbackDays: options.lookbackDays,
                includeUserProfile: options.includeUserProfile
              }
            );

            // Track credit usage
            await creditService.useServiceCredits(
              requestUserId,
              MCPServiceKey.ANALYTICS_STATS,
              estimatedUnits,
              `${MCPServiceKey.ANALYTICS_STATS} API usage`,
              {
                analysisType: 'user-behavior-prediction',
                predictionType: options.predictionType
              }
            );

            // Store user behavior prediction result
            await this.storeUserBehaviorResult(
              predictionId,
              'user-behavior',
              mcpResult.modelInfo.name,
              mcpResult.modelInfo.version,
              options,
              mcpResult,
              mcpResult.modelInfo.accuracy,
              mcpResult.modelInfo.confidence,
              requestUserId
            );

            return {
              ...mcpResult,
              id: predictionId
            };
          }
        } catch (mcpError: any) {
          // For MCP errors, log and fall back to direct implementation
          logger.warn(`MCP user behavior prediction failed, falling back to direct implementation: ${mcpError.message}`);
        }
      }

      // Fall back to direct implementation if MCP is not available or failed
      return await this.predictUserBehaviorDirect(predictionId, options, requestUserId);
    } catch (error) {
      logger.error(`Error predicting user behavior: ${error}`);
      throw error;
    }
  }

  /**
   * Predict user behavior using direct implementation
   *
   * @param predictionId Prediction ID
   * @param options User behavior prediction options
   * @param requestUserId User ID making the request
   * @returns User behavior prediction result
   */
  private async predictUserBehaviorDirect(
    predictionId: string,
    options: UserBehaviorPredictionOptions,
    requestUserId?: string
  ): Promise<UserBehaviorPredictionResult> {
    try {
      // Get user activity data from analytics events
      const { data: eventData, error: eventError } = await supabase.getClient()
        .from('analytics_events')
        .select('*')
        .eq('user_id', options.userId)
        .gte('timestamp', new Date(Date.now() - options.lookbackDays * 24 * 60 * 60 * 1000).toISOString())
        .order('timestamp', { ascending: false });

      if (eventError) {
        logger.error(`Failed to get user activity data: ${eventError}`);
        throw eventError;
      }

      // Get user profile data if requested
      let userData = null;
      if (options.includeUserProfile) {
        const { data: profileData, error: profileError } = await supabase.getClient()
          .from('users')
          .select('*')
          .eq('id', options.userId)
          .single();

        if (profileError && profileError.code !== 'PGRST116') { // Not found is ok
          logger.error(`Failed to get user profile data: ${profileError}`);
        } else {
          userData = profileData;
        }
      }

      // Simple implementation of user behavior prediction
      // In a real implementation, this would use more sophisticated ML models
      const result = this.generateSimpleUserBehaviorPrediction(
        options.predictionType,
        eventData || [],
        userData
      );

      // Create prediction result
      const predictionResult: UserBehaviorPredictionResult = {
        id: predictionId,
        userId: options.userId,
        predictionType: options.predictionType,
        predictions: result.predictions,
        userInsights: result.userInsights,
        modelInfo: {
          name: 'SimpleRuleBasedModel',
          version: '1.0',
          accuracy: 0.6, // Placeholder accuracy
          confidence: 0.5 // Placeholder confidence
        }
      };

      // Store user behavior prediction result
      await this.storeUserBehaviorResult(
        predictionId,
        'user-behavior',
        predictionResult.modelInfo.name,
        predictionResult.modelInfo.version,
        options,
        predictionResult,
        predictionResult.modelInfo.accuracy,
        predictionResult.modelInfo.confidence,
        requestUserId
      );

      return predictionResult;
    } catch (error) {
      logger.error(`Error predicting user behavior directly: ${error}`);
      throw error;
    }
  }

  /**
   * Generate a simple user behavior prediction
   *
   * @param predictionType Type of prediction to generate
   * @param events User activity events
   * @param userData User profile data
   * @returns Simple prediction result
   */
  private generateSimpleUserBehaviorPrediction(
    predictionType: string,
    events: any[],
    userData: any
  ): {
    predictions: Array<{
      action: string;
      probability: number;
      confidence: number;
      recommendedContent?: Array<{
        id: string;
        type: string;
        name: string;
        score: number;
      }>;
    }>;
    userInsights: {
      activityLevel: 'low' | 'medium' | 'high';
      interests: Array<{
        category: string;
        score: number;
      }>;
      patterns: Array<{
        pattern: string;
        description: string;
        strength: number;
      }>;
    };
  } {
    // Determine activity level
    const activityLevel = events.length < 10 ? 'low' : events.length < 50 ? 'medium' : 'high';

    // Extract event types and count occurrences
    const eventTypeCounts: Record<string, number> = {};
    for (const event of events) {
      const eventType = event.event_type || 'unknown';
      eventTypeCounts[eventType] = (eventTypeCounts[eventType] || 0) + 1;
    }

    // Extract resource types and count occurrences
    const resourceTypeCounts: Record<string, number> = {};
    for (const event of events) {
      const resourceType = event.resource_type || 'unknown';
      resourceTypeCounts[resourceType] = (resourceTypeCounts[resourceType] || 0) + 1;
    }

    // Extract interests from event data
    const interests = Object.entries(resourceTypeCounts)
      .filter(([type]) => type !== 'unknown')
      .map(([category, count]) => ({
        category,
        score: count / events.length
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    // Generate patterns based on event sequence
    const patterns = [];

    // Time of day pattern
    const hourCounts: Record<number, number> = {};
    for (const event of events) {
      if (event.timestamp) {
        const hour = new Date(event.timestamp).getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      }
    }

    const maxHourCount = Math.max(...Object.values(hourCounts));
    const preferredHours = Object.entries(hourCounts)
      .filter(([_, count]) => count > maxHourCount * 0.7)
      .map(([hour]) => parseInt(hour));

    if (preferredHours.length > 0) {
      const timeOfDay = preferredHours.some(h => h >= 5 && h < 12) ? 'morning' :
                       preferredHours.some(h => h >= 12 && h < 18) ? 'afternoon' :
                       preferredHours.some(h => h >= 18 && h < 22) ? 'evening' : 'night';

      patterns.push({
        pattern: 'time_of_day',
        description: `User is most active during the ${timeOfDay}`,
        strength: maxHourCount / events.length
      });
    }

    // Session frequency pattern
    const daysCovered = Math.min(options.lookbackDays, 30); // Cap at 30 days
    const sessionCount = new Set(events.map(e => e.timestamp ? new Date(e.timestamp).toDateString() : '')).size;
    const sessionFrequency = sessionCount / daysCovered;

    patterns.push({
      pattern: 'session_frequency',
      description: `User visits approximately ${Math.round(sessionFrequency * 7)} times per week`,
      strength: Math.min(1, sessionFrequency * 2) // Normalize to 0-1
    });

    // Generate predictions based on prediction type
    const predictions = [];

    switch (predictionType) {
      case 'next_action':
        // Predict next action based on most frequent actions
        const topActions = Object.entries(eventTypeCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3);

        for (const [action, count] of topActions) {
          predictions.push({
            action,
            probability: count / events.length,
            confidence: 0.6
          });
        }
        break;

      case 'churn_risk':
        // Simple churn risk based on recency and frequency
        const lastActivityDate = events.length > 0 ? new Date(events[0].timestamp) : new Date(0);
        const daysSinceLastActivity = (Date.now() - lastActivityDate.getTime()) / (24 * 60 * 60 * 1000);

        const churnRisk = Math.min(1, daysSinceLastActivity / 14 + (1 - sessionFrequency));

        predictions.push({
          action: 'churn',
          probability: churnRisk,
          confidence: 0.5 + (events.length / 100) * 0.3 // More data = higher confidence
        });
        break;

      case 'engagement':
        // Predict engagement level
        const engagementScore = Math.min(1, (events.length / 50) * 0.7 + sessionFrequency * 0.3);

        predictions.push({
          action: 'engagement',
          probability: engagementScore,
          confidence: 0.5 + (events.length / 100) * 0.3
        });
        break;

      case 'content_preference':
        // Predict content preferences based on resource types
        const topResources = Object.entries(resourceTypeCounts)
          .filter(([type]) => type !== 'unknown')
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3);

        for (const [resourceType, count] of topResources) {
          predictions.push({
            action: `prefer_${resourceType}`,
            probability: count / events.length,
            confidence: 0.6,
            recommendedContent: [
              {
                id: `sample_${resourceType}_1`,
                type: resourceType,
                name: `Sample ${resourceType} 1`,
                score: 0.9
              },
              {
                id: `sample_${resourceType}_2`,
                type: resourceType,
                name: `Sample ${resourceType} 2`,
                score: 0.8
              }
            ]
          });
        }
        break;
    }

    return {
      predictions,
      userInsights: {
        activityLevel,
        interests,
        patterns
      }
    };
  }

  /**
   * Store user behavior prediction result in database
   *
   * @param id Result ID
   * @param modelType Model type
   * @param modelName Model name
   * @param modelVersion Model version
   * @param options Input options
   * @param results Results
   * @param accuracy Accuracy
   * @param confidence Confidence
   * @param userId User ID making the request
   */
  private async storeUserBehaviorResult(
    id: string,
    modelType: string,
    modelName: string,
    modelVersion: string,
    options: any,
    results: any,
    accuracy?: number,
    confidence?: number,
    userId?: string
  ): Promise<void> {
    try {
      // Store result in database
      const { error } = await supabase.getClient()
        .from(this.tableName)
        .insert({
          id,
          model_type: modelType,
          model_name: modelName,
          model_version: modelVersion,
          prediction_type: 'user-behavior',
          start_date: new Date(Date.now() - options.lookbackDays * 24 * 60 * 60 * 1000).toISOString(),
          end_date: new Date().toISOString(),
          input_parameters: options,
          results,
          accuracy,
          confidence,
          created_by: userId
        });

      if (error) {
        logger.error(`Failed to store user behavior prediction result: ${error}`);
      }
    } catch (error) {
      logger.error(`Error storing user behavior prediction result: ${error}`);
    }
  }
}

export const predictiveAnalyticsService = PredictiveAnalyticsService.getInstance();
export default predictiveAnalyticsService;
