/**
 * Predictive Analytics Controller
 * 
 * This controller provides API endpoints for predictive analytics functionality,
 * including time-series forecasting, anomaly detection, and user behavior prediction.
 */

import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { ApiError } from '../middleware/error.middleware';
import predictiveAnalyticsService from '../services/analytics/predictive-analytics-service';

/**
 * Generate a time-series forecast
 * 
 * @route POST /api/analytics/predictive/forecast
 */
export const generateForecast = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    // Get forecast options from request body
    const { 
      eventType,
      resourceType,
      startDate,
      endDate,
      forecastPeriods,
      interval
    } = req.body;
    
    // Validate required parameters
    if (!startDate || !endDate) {
      throw new ApiError(400, 'Start date and end date are required');
    }
    
    if (!forecastPeriods || forecastPeriods < 1) {
      throw new ApiError(400, 'Forecast periods must be a positive number');
    }
    
    if (!interval || !['hour', 'day', 'week', 'month'].includes(interval)) {
      throw new ApiError(400, 'Interval must be one of: hour, day, week, month');
    }
    
    // Generate forecast
    const forecast = await predictiveAnalyticsService.generateTimeSeriesForecast(
      {
        eventType,
        resourceType,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        forecastPeriods,
        interval: interval as 'hour' | 'day' | 'week' | 'month'
      },
      userId
    );
    
    res.status(200).json({
      success: true,
      data: forecast
    });
  } catch (error: any) {
    logger.error(`Error generating forecast: ${error}`);
    
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Internal server error',
      message: 'Failed to generate forecast'
    });
  }
};

/**
 * Detect anomalies in analytics data
 * 
 * @route POST /api/analytics/predictive/anomalies
 */
export const detectAnomalies = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    // Get anomaly detection options from request body
    const { 
      eventType,
      resourceType,
      startDate,
      endDate,
      interval,
      threshold
    } = req.body;
    
    // Validate required parameters
    if (!startDate || !endDate) {
      throw new ApiError(400, 'Start date and end date are required');
    }
    
    if (!interval || !['hour', 'day', 'week', 'month'].includes(interval)) {
      throw new ApiError(400, 'Interval must be one of: hour, day, week, month');
    }
    
    // Detect anomalies
    const anomalies = await predictiveAnalyticsService.detectAnomalies(
      {
        eventType,
        resourceType,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        interval: interval as 'hour' | 'day' | 'week' | 'month',
        threshold
      },
      userId
    );
    
    res.status(200).json({
      success: true,
      data: anomalies
    });
  } catch (error: any) {
    logger.error(`Error detecting anomalies: ${error}`);
    
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Internal server error',
      message: 'Failed to detect anomalies'
    });
  }
};

/**
 * Predict user behavior
 * 
 * @route POST /api/analytics/predictive/user-behavior
 */
export const predictUserBehavior = async (req: Request, res: Response) => {
  try {
    const requestUserId = req.user?.id;
    
    // Get user behavior prediction options from request body
    const { 
      userId,
      predictionType,
      lookbackDays,
      includeUserProfile
    } = req.body;
    
    // Validate required parameters
    if (!userId) {
      throw new ApiError(400, 'User ID is required');
    }
    
    if (!predictionType || !['next_action', 'churn_risk', 'engagement', 'content_preference'].includes(predictionType)) {
      throw new ApiError(400, 'Prediction type must be one of: next_action, churn_risk, engagement, content_preference');
    }
    
    if (!lookbackDays || lookbackDays < 1) {
      throw new ApiError(400, 'Lookback days must be a positive number');
    }
    
    // Predict user behavior
    const prediction = await predictiveAnalyticsService.predictUserBehavior(
      {
        userId,
        predictionType: predictionType as 'next_action' | 'churn_risk' | 'engagement' | 'content_preference',
        lookbackDays,
        includeUserProfile
      },
      requestUserId
    );
    
    res.status(200).json({
      success: true,
      data: prediction
    });
  } catch (error: any) {
    logger.error(`Error predicting user behavior: ${error}`);
    
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Internal server error',
      message: 'Failed to predict user behavior'
    });
  }
};

export default {
  generateForecast,
  detectAnomalies,
  predictUserBehavior
};
