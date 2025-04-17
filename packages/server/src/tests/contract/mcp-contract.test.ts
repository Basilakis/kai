/**
 * Contract Tests for MCP Integration
 * 
 * These tests verify the contract between our application and the MCP server.
 * They ensure that our application correctly formats requests to MCP and
 * correctly handles responses from MCP.
 */

import mcpClientService, { MCPServiceKey } from '../../services/mcp/mcpClientService';
import axios from 'axios';
import { logger } from '../../utils/logger';

// Mock axios for controlled testing
jest.mock('axios');
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

describe('MCP Contract Tests', () => {
  // Environment variables
  const originalEnv = process.env;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock environment variables
    process.env.MCP_SERVER_URL = 'http://mcp-server.example.com';
    process.env.MCP_TIMEOUT = '30000';
  });
  
  afterEach(() => {
    // Restore environment variables
    process.env = originalEnv;
  });
  
  describe('Time-Series Forecasting Contract', () => {
    it('should format request according to MCP contract', async () => {
      // Mock successful response
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
      await mcpClientService.generateTimeSeriesForecast(
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
      
      // Verify request format matches contract
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
    });
    
    it('should handle response according to MCP contract', async () => {
      // Mock response according to contract
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
      
      // Verify response handling matches contract
      expect(result).toEqual({
        historical: [
          { date: '2023-01-01T00:00:00Z', count: 10 },
          { date: '2023-01-02T00:00:00Z', count: 15 }
        ],
        forecast: [
          { date: '2023-01-03T00:00:00Z', count: 12, is_forecast: true },
          { date: '2023-01-04T00:00:00Z', count: 14, is_forecast: true }
        ],
        parameters: {
          eventType: 'search',
          resourceType: 'material',
          startDate: '2023-01-01T00:00:00Z',
          endDate: '2023-01-02T00:00:00Z',
          forecastPeriods: 2,
          interval: 'day'
        },
        modelInfo: {
          name: 'TimeSeriesForecaster',
          version: '1.0',
          accuracy: 0.85,
          confidence: 0.9
        }
      });
    });
    
    it('should handle error responses according to contract', async () => {
      // Mock error response according to contract
      (axios.post as jest.Mock).mockRejectedValue({
        response: {
          status: 400,
          data: {
            error: 'Invalid parameters',
            message: 'forecast_periods must be a positive integer'
          }
        }
      });
      
      // Call the service and expect error
      await expect(
        mcpClientService.generateTimeSeriesForecast(
          'user-123',
          {
            eventType: 'search',
            resourceType: 'material',
            startDate: '2023-01-01T00:00:00Z',
            endDate: '2023-01-02T00:00:00Z',
            forecastPeriods: -1, // Invalid value
            interval: 'day'
          }
        )
      ).rejects.toThrow();
      
      // Verify error was logged
      expect(logger.error).toHaveBeenCalled();
    });
  });
  
  describe('Anomaly Detection Contract', () => {
    it('should format request according to MCP contract', async () => {
      // Mock successful response
      (axios.post as jest.Mock).mockResolvedValue({
        data: {
          time_series: [],
          anomalies: [],
          statistics: {
            mean: 15,
            std_dev: 5,
            threshold: 2,
            confidence: 0.95
          }
        }
      });
      
      // Call the service
      await mcpClientService.detectAnalyticsAnomalies(
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
      
      // Verify request format matches contract
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
    });
    
    it('should handle response according to MCP contract', async () => {
      // Mock response according to contract
      (axios.post as jest.Mock).mockResolvedValue({
        data: {
          time_series: [
            { date: '2023-01-01T00:00:00Z', count: 10 },
            { date: '2023-01-02T00:00:00Z', count: 15 },
            { date: '2023-01-03T00:00:00Z', count: 50 }
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
      
      // Verify response handling matches contract
      expect(result).toEqual({
        timeSeries: [
          { date: '2023-01-01T00:00:00Z', count: 10 },
          { date: '2023-01-02T00:00:00Z', count: 15 },
          { date: '2023-01-03T00:00:00Z', count: 50 }
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
          threshold: 2,
          confidence: 0.95
        },
        parameters: {
          eventType: 'search',
          resourceType: 'material',
          startDate: '2023-01-01T00:00:00Z',
          endDate: '2023-01-03T00:00:00Z',
          interval: 'day'
        }
      });
    });
  });
  
  describe('User Behavior Prediction Contract', () => {
    it('should format request according to MCP contract', async () => {
      // Mock successful response
      (axios.post as jest.Mock).mockResolvedValue({
        data: {
          predictions: [],
          user_insights: {
            activityLevel: 'medium',
            interests: [],
            patterns: []
          },
          model_info: {
            name: 'DefaultModel',
            version: '1.0'
          }
        }
      });
      
      // Call the service
      await mcpClientService.predictUserBehavior(
        'admin-user-123',
        {
          userId: 'target-user-123',
          predictionType: 'next_action',
          lookbackDays: 30,
          includeUserProfile: true
        }
      );
      
      // Verify request format matches contract
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
    });
    
    it('should handle response according to MCP contract', async () => {
      // Mock response according to contract
      (axios.post as jest.Mock).mockResolvedValue({
        data: {
          predictions: [
            {
              action: 'search',
              probability: 0.8,
              confidence: 0.75
            }
          ],
          user_insights: {
            activityLevel: 'high',
            interests: [
              { category: 'material', score: 0.9 }
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
      
      // Verify response handling matches contract
      expect(result).toEqual({
        userId: 'target-user-123',
        predictionType: 'next_action',
        predictions: [
          {
            action: 'search',
            probability: 0.8,
            confidence: 0.75
          }
        ],
        userInsights: {
          activityLevel: 'high',
          interests: [
            { category: 'material', score: 0.9 }
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
      });
    });
  });
});
