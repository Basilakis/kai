/**
 * Tests for the MCP Client Service Predictive Analytics Methods
 */

import mcpClientService, { MCPServiceKey } from '../../services/mcp/mcpClientService';
import creditService from '../../services/credit/creditService';
import axios from 'axios';
import { logger } from '../../utils/logger';

// Mock dependencies
jest.mock('axios');
jest.mock('../../services/credit/creditService', () => ({
  hasEnoughCreditsForService: jest.fn(),
  useServiceCredits: jest.fn()
}));
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

describe('MCP Client Service - Predictive Analytics', () => {
  // Environment variables
  const originalEnv = process.env;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock environment variables
    process.env.MCP_SERVER_URL = 'http://mcp-server.example.com';
    process.env.MCP_TIMEOUT = '30000';
    
    // Mock axios
    (axios.post as jest.Mock).mockResolvedValue({
      data: {}
    });
    
    // Mock credit service
    (creditService.hasEnoughCreditsForService as jest.Mock).mockResolvedValue(true);
  });
  
  afterEach(() => {
    // Restore environment variables
    process.env = originalEnv;
  });

  describe('generateTimeSeriesForecast', () => {
    it('should call the MCP server with correct parameters', async () => {
      // Mock axios response
      (axios.post as jest.Mock).mockResolvedValue({
        data: {
          historical: [
            { date: '2023-01-01T00:00:00Z', count: 10 },
            { date: '2023-01-02T00:00:00Z', count: 15 }
          ],
          forecast: [
            { date: '2023-01-03T00:00:00Z', count: 12, is_forecast: true },
            { date: '2023-01-04T00:00:00Z', count: 14, is_forecast: true }
          ],
          model_info: {
            name: 'TimeSeriesForecaster',
            version: '1.0',
            accuracy: 0.85,
            confidence: 0.9
          }
        }
      });
      
      // Call the service
      const result = await mcpClientService.generateTimeSeriesForecast(
        'user-123',
        {
          eventType: 'search',
          resourceType: 'material',
          startDate: '2023-01-01T00:00:00Z',
          endDate: '2023-01-02T00:00:00Z',
          forecastPeriods: 2,
          interval: 'day'
        }
      );
      
      // Verify credit check
      expect(creditService.hasEnoughCreditsForService).toHaveBeenCalledWith(
        'user-123',
        MCPServiceKey.ANALYTICS_FORECAST,
        3
      );
      
      // Verify axios call
      expect(axios.post).toHaveBeenCalledWith(
        'http://mcp-server.example.com/api/v1/analytics/forecast',
        {
          event_type: 'search',
          resource_type: 'material',
          start_date: '2023-01-01T00:00:00Z',
          end_date: '2023-01-02T00:00:00Z',
          forecast_periods: 2,
          interval: 'day'
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-User-ID': 'user-123'
          },
          timeout: 30000
        }
      );
      
      // Verify credit usage
      expect(creditService.useServiceCredits).toHaveBeenCalledWith(
        'user-123',
        MCPServiceKey.ANALYTICS_FORECAST,
        3,
        `${MCPServiceKey.ANALYTICS_FORECAST} API usage`,
        {
          forecastType: 'time-series',
          interval: 'day',
          periods: 2
        }
      );
      
      // Verify result
      expect(result).toBeDefined();
      expect(result.historical).toHaveLength(2);
      expect(result.forecast).toHaveLength(2);
      expect(result.modelInfo.name).toBe('TimeSeriesForecaster');
      expect(result.modelInfo.accuracy).toBe(0.85);
    });
    
    it('should throw an error when MCP server is not available', async () => {
      // Mock MCP availability
      (mcpClientService.isMCPAvailable as jest.Mock) = jest.fn().mockResolvedValue(false);
      
      // Call the service and expect error
      await expect(
        mcpClientService.generateTimeSeriesForecast(
          'user-123',
          {
            eventType: 'search',
            resourceType: 'material',
            startDate: '2023-01-01T00:00:00Z',
            endDate: '2023-01-02T00:00:00Z',
            forecastPeriods: 2,
            interval: 'day'
          }
        )
      ).rejects.toThrow('MCP server is not available');
    });
    
    it('should throw an error when user has insufficient credits', async () => {
      // Mock insufficient credits
      (creditService.hasEnoughCreditsForService as jest.Mock).mockResolvedValue(false);
      
      // Call the service and expect error
      await expect(
        mcpClientService.generateTimeSeriesForecast(
          'user-123',
          {
            eventType: 'search',
            resourceType: 'material',
            startDate: '2023-01-01T00:00:00Z',
            endDate: '2023-01-02T00:00:00Z',
            forecastPeriods: 2,
            interval: 'day'
          }
        )
      ).rejects.toThrow('Insufficient credits');
    });
    
    it('should handle MCP server errors', async () => {
      // Mock axios error
      (axios.post as jest.Mock).mockRejectedValue(new Error('MCP server error'));
      
      // Call the service and expect error
      await expect(
        mcpClientService.generateTimeSeriesForecast(
          'user-123',
          {
            eventType: 'search',
            resourceType: 'material',
            startDate: '2023-01-01T00:00:00Z',
            endDate: '2023-01-02T00:00:00Z',
            forecastPeriods: 2,
            interval: 'day'
          }
        )
      ).rejects.toThrow('MCP server error');
      
      // Verify error was logged
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('detectAnalyticsAnomalies', () => {
    it('should call the MCP server with correct parameters', async () => {
      // Mock axios response
      (axios.post as jest.Mock).mockResolvedValue({
        data: {
          time_series: [
            { date: '2023-01-01T00:00:00Z', count: 10 },
            { date: '2023-01-02T00:00:00Z', count: 15 },
            { date: '2023-01-03T00:00:00Z', count: 50 } // Anomaly
          ],
          anomalies: [
            { 
              date: '2023-01-03T00:00:00Z', 
              count: 50, 
              mean: 15, 
              std_dev: 5, 
              z_score: 7, 
              severity: 'high' 
            }
          ],
          statistics: {
            mean: 15,
            std_dev: 5,
            threshold: 2,
            confidence: 0.95
          }
        }
      });
      
      // Call the service
      const result = await mcpClientService.detectAnalyticsAnomalies(
        'user-123',
        {
          eventType: 'search',
          resourceType: 'material',
          startDate: '2023-01-01T00:00:00Z',
          endDate: '2023-01-03T00:00:00Z',
          interval: 'day',
          threshold: 2
        }
      );
      
      // Verify credit check
      expect(creditService.hasEnoughCreditsForService).toHaveBeenCalledWith(
        'user-123',
        MCPServiceKey.ANALYTICS_ANOMALY,
        3
      );
      
      // Verify axios call
      expect(axios.post).toHaveBeenCalledWith(
        'http://mcp-server.example.com/api/v1/analytics/anomalies',
        {
          event_type: 'search',
          resource_type: 'material',
          start_date: '2023-01-01T00:00:00Z',
          end_date: '2023-01-03T00:00:00Z',
          interval: 'day',
          threshold: 2
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-User-ID': 'user-123'
          },
          timeout: 30000
        }
      );
      
      // Verify credit usage
      expect(creditService.useServiceCredits).toHaveBeenCalledWith(
        'user-123',
        MCPServiceKey.ANALYTICS_ANOMALY,
        3,
        `${MCPServiceKey.ANALYTICS_ANOMALY} API usage`,
        {
          analysisType: 'anomaly-detection',
          interval: 'day'
        }
      );
      
      // Verify result
      expect(result).toBeDefined();
      expect(result.timeSeries).toHaveLength(3);
      expect(result.anomalies).toHaveLength(1);
      expect(result.anomalies[0].severity).toBe('high');
      expect(result.statistics.mean).toBe(15);
    });
  });

  describe('predictUserBehavior', () => {
    it('should call the MCP server with correct parameters', async () => {
      // Mock axios response
      (axios.post as jest.Mock).mockResolvedValue({
        data: {
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
          user_insights: {
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
          model_info: {
            name: 'BehaviorPredictor',
            version: '1.0',
            accuracy: 0.8,
            confidence: 0.75
          }
        }
      });
      
      // Call the service
      const result = await mcpClientService.predictUserBehavior(
        'admin-user-123',
        {
          userId: 'target-user-123',
          predictionType: 'next_action',
          lookbackDays: 30,
          includeUserProfile: true
        }
      );
      
      // Verify credit check
      expect(creditService.hasEnoughCreditsForService).toHaveBeenCalledWith(
        'admin-user-123',
        MCPServiceKey.ANALYTICS_USER_BEHAVIOR,
        4
      );
      
      // Verify axios call
      expect(axios.post).toHaveBeenCalledWith(
        'http://mcp-server.example.com/api/v1/analytics/user-behavior',
        {
          target_user_id: 'target-user-123',
          prediction_type: 'next_action',
          lookback_days: 30,
          include_user_profile: true
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-User-ID': 'admin-user-123'
          },
          timeout: 30000
        }
      );
      
      // Verify credit usage
      expect(creditService.useServiceCredits).toHaveBeenCalledWith(
        'admin-user-123',
        MCPServiceKey.ANALYTICS_USER_BEHAVIOR,
        4,
        `${MCPServiceKey.ANALYTICS_USER_BEHAVIOR} API usage`,
        {
          predictionType: 'next_action',
          targetUserId: 'target-user-123'
        }
      );
      
      // Verify result
      expect(result).toBeDefined();
      expect(result.userId).toBe('target-user-123');
      expect(result.predictions).toHaveLength(2);
      expect(result.userInsights.activityLevel).toBe('high');
      expect(result.userInsights.interests).toHaveLength(2);
      expect(result.modelInfo.name).toBe('BehaviorPredictor');
    });
  });
});
