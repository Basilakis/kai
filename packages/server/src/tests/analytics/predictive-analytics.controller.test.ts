/**
 * Tests for the Predictive Analytics Controller
 */

import { Request, Response } from 'express';
import predictiveAnalyticsController from '../../controllers/predictive-analytics.controller';
import predictiveAnalyticsService from '../../services/analytics/predictive-analytics-service';

// Mock dependencies
jest.mock('../../services/analytics/predictive-analytics-service', () => ({
  generateTimeSeriesForecast: jest.fn(),
  detectAnomalies: jest.fn(),
  predictUserBehavior: jest.fn()
}));

describe('Predictive Analytics Controller', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let responseObject: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup response mock
    responseObject = {};
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockImplementation(result => {
        responseObject = result;
        return mockResponse;
      })
    };
  });

  describe('generateForecast', () => {
    it('should return a forecast when valid parameters are provided', async () => {
      // Setup request mock
      mockRequest = {
        user: { id: 'user-123' },
        body: {
          eventType: 'search',
          resourceType: 'material',
          startDate: '2023-01-01T00:00:00Z',
          endDate: '2023-01-10T00:00:00Z',
          forecastPeriods: 5,
          interval: 'day'
        }
      };
      
      // Mock service response
      const mockForecast = {
        id: 'forecast-123',
        historical: [
          { date: '2023-01-01T00:00:00Z', count: 10 },
          { date: '2023-01-02T00:00:00Z', count: 15 }
        ],
        forecast: [
          { date: '2023-01-11T00:00:00Z', count: 12, is_forecast: true },
          { date: '2023-01-12T00:00:00Z', count: 14, is_forecast: true }
        ],
        parameters: {
          eventType: 'search',
          resourceType: 'material',
          startDate: '2023-01-01T00:00:00Z',
          endDate: '2023-01-10T00:00:00Z',
          forecastPeriods: 5,
          interval: 'day'
        },
        modelInfo: {
          name: 'TimeSeriesForecaster',
          version: '1.0',
          accuracy: 0.85,
          confidence: 0.9
        }
      };
      
      (predictiveAnalyticsService.generateTimeSeriesForecast as jest.Mock).mockResolvedValue(mockForecast);
      
      // Call controller
      await predictiveAnalyticsController.generateForecast(mockRequest as Request, mockResponse as Response);
      
      // Verify service was called with correct parameters
      expect(predictiveAnalyticsService.generateTimeSeriesForecast).toHaveBeenCalledWith(
        {
          eventType: 'search',
          resourceType: 'material',
          startDate: expect.any(Date),
          endDate: expect.any(Date),
          forecastPeriods: 5,
          interval: 'day'
        },
        'user-123'
      );
      
      // Verify response
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(responseObject).toEqual({
        success: true,
        data: mockForecast
      });
    });
    
    it('should return an error when required parameters are missing', async () => {
      // Setup request mock with missing parameters
      mockRequest = {
        user: { id: 'user-123' },
        body: {
          eventType: 'search',
          resourceType: 'material',
          // Missing startDate
          endDate: '2023-01-10T00:00:00Z',
          forecastPeriods: 5,
          interval: 'day'
        }
      };
      
      // Call controller
      await predictiveAnalyticsController.generateForecast(mockRequest as Request, mockResponse as Response);
      
      // Verify service was not called
      expect(predictiveAnalyticsService.generateTimeSeriesForecast).not.toHaveBeenCalled();
      
      // Verify error response
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(responseObject).toEqual({
        success: false,
        error: 'Start date and end date are required',
        message: 'Failed to generate forecast'
      });
    });
    
    it('should return an error when the service throws an exception', async () => {
      // Setup request mock
      mockRequest = {
        user: { id: 'user-123' },
        body: {
          eventType: 'search',
          resourceType: 'material',
          startDate: '2023-01-01T00:00:00Z',
          endDate: '2023-01-10T00:00:00Z',
          forecastPeriods: 5,
          interval: 'day'
        }
      };
      
      // Mock service error
      (predictiveAnalyticsService.generateTimeSeriesForecast as jest.Mock).mockRejectedValue(
        new Error('Service error')
      );
      
      // Call controller
      await predictiveAnalyticsController.generateForecast(mockRequest as Request, mockResponse as Response);
      
      // Verify error response
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(responseObject).toEqual({
        success: false,
        error: 'Service error',
        message: 'Failed to generate forecast'
      });
    });
  });

  describe('detectAnomalies', () => {
    it('should return anomalies when valid parameters are provided', async () => {
      // Setup request mock
      mockRequest = {
        user: { id: 'user-123' },
        body: {
          eventType: 'search',
          resourceType: 'material',
          startDate: '2023-01-01T00:00:00Z',
          endDate: '2023-01-10T00:00:00Z',
          interval: 'day',
          threshold: 2.5
        }
      };
      
      // Mock service response
      const mockAnomalies = {
        id: 'anomaly-123',
        timeSeries: [
          { date: '2023-01-01T00:00:00Z', count: 10 },
          { date: '2023-01-02T00:00:00Z', count: 15 },
          { date: '2023-01-03T00:00:00Z', count: 50 } // Anomaly
        ],
        anomalies: [
          { 
            date: '2023-01-03T00:00:00Z', 
            count: 50, 
            mean: 15, 
            stdDev: 5, 
            zScore: 7, 
            severity: 'high' 
          }
        ],
        statistics: {
          mean: 15,
          stdDev: 5,
          threshold: 2.5
        },
        parameters: {
          eventType: 'search',
          resourceType: 'material',
          startDate: '2023-01-01T00:00:00Z',
          endDate: '2023-01-10T00:00:00Z',
          interval: 'day'
        }
      };
      
      (predictiveAnalyticsService.detectAnomalies as jest.Mock).mockResolvedValue(mockAnomalies);
      
      // Call controller
      await predictiveAnalyticsController.detectAnomalies(mockRequest as Request, mockResponse as Response);
      
      // Verify service was called with correct parameters
      expect(predictiveAnalyticsService.detectAnomalies).toHaveBeenCalledWith(
        {
          eventType: 'search',
          resourceType: 'material',
          startDate: expect.any(Date),
          endDate: expect.any(Date),
          interval: 'day',
          threshold: 2.5
        },
        'user-123'
      );
      
      // Verify response
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(responseObject).toEqual({
        success: true,
        data: mockAnomalies
      });
    });
    
    it('should return an error when required parameters are missing', async () => {
      // Setup request mock with missing parameters
      mockRequest = {
        user: { id: 'user-123' },
        body: {
          eventType: 'search',
          resourceType: 'material',
          startDate: '2023-01-01T00:00:00Z',
          endDate: '2023-01-10T00:00:00Z',
          // Missing interval
          threshold: 2.5
        }
      };
      
      // Call controller
      await predictiveAnalyticsController.detectAnomalies(mockRequest as Request, mockResponse as Response);
      
      // Verify service was not called
      expect(predictiveAnalyticsService.detectAnomalies).not.toHaveBeenCalled();
      
      // Verify error response
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(responseObject).toEqual({
        success: false,
        error: 'Interval must be one of: hour, day, week, month',
        message: 'Failed to detect anomalies'
      });
    });
  });

  describe('predictUserBehavior', () => {
    it('should return user behavior predictions when valid parameters are provided', async () => {
      // Setup request mock
      mockRequest = {
        user: { id: 'admin-user-123' },
        body: {
          userId: 'target-user-123',
          predictionType: 'next_action',
          lookbackDays: 30,
          includeUserProfile: true
        }
      };
      
      // Mock service response
      const mockPrediction = {
        id: 'prediction-123',
        userId: 'target-user-123',
        predictionType: 'next_action',
        predictions: [
          {
            action: 'search',
            probability: 0.8,
            confidence: 0.75
          },
          {
            action: 'view',
            probability: 0.6,
            confidence: 0.7
          }
        ],
        userInsights: {
          activityLevel: 'high',
          interests: [
            { category: 'material', score: 0.9 },
            { category: 'catalog', score: 0.7 }
          ],
          patterns: [
            {
              pattern: 'time_of_day',
              description: 'User is most active during the morning',
              strength: 0.85
            }
          ]
        },
        modelInfo: {
          name: 'BehaviorPredictor',
          version: '1.0',
          accuracy: 0.8,
          confidence: 0.75
        }
      };
      
      (predictiveAnalyticsService.predictUserBehavior as jest.Mock).mockResolvedValue(mockPrediction);
      
      // Call controller
      await predictiveAnalyticsController.predictUserBehavior(mockRequest as Request, mockResponse as Response);
      
      // Verify service was called with correct parameters
      expect(predictiveAnalyticsService.predictUserBehavior).toHaveBeenCalledWith(
        {
          userId: 'target-user-123',
          predictionType: 'next_action',
          lookbackDays: 30,
          includeUserProfile: true
        },
        'admin-user-123'
      );
      
      // Verify response
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(responseObject).toEqual({
        success: true,
        data: mockPrediction
      });
    });
    
    it('should return an error when required parameters are missing', async () => {
      // Setup request mock with missing parameters
      mockRequest = {
        user: { id: 'admin-user-123' },
        body: {
          // Missing userId
          predictionType: 'next_action',
          lookbackDays: 30,
          includeUserProfile: true
        }
      };
      
      // Call controller
      await predictiveAnalyticsController.predictUserBehavior(mockRequest as Request, mockResponse as Response);
      
      // Verify service was not called
      expect(predictiveAnalyticsService.predictUserBehavior).not.toHaveBeenCalled();
      
      // Verify error response
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(responseObject).toEqual({
        success: false,
        error: 'User ID is required',
        message: 'Failed to predict user behavior'
      });
    });
    
    it('should return an error when prediction type is invalid', async () => {
      // Setup request mock with invalid prediction type
      mockRequest = {
        user: { id: 'admin-user-123' },
        body: {
          userId: 'target-user-123',
          predictionType: 'invalid_type', // Invalid prediction type
          lookbackDays: 30,
          includeUserProfile: true
        }
      };
      
      // Call controller
      await predictiveAnalyticsController.predictUserBehavior(mockRequest as Request, mockResponse as Response);
      
      // Verify service was not called
      expect(predictiveAnalyticsService.predictUserBehavior).not.toHaveBeenCalled();
      
      // Verify error response
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(responseObject).toEqual({
        success: false,
        error: 'Prediction type must be one of: next_action, churn_risk, engagement, content_preference',
        message: 'Failed to predict user behavior'
      });
    });
  });
});
