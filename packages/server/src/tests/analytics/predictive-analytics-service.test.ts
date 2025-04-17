/**
 * Tests for the Predictive Analytics Service
 */

import { predictiveAnalyticsService } from '../../services/analytics/predictive-analytics-service';
import mcpClientService from '../../services/mcp/mcpClientService';
import creditService from '../../services/credit/creditService';
import { supabase } from '../../services/supabase/supabaseClient';

// Mock dependencies
jest.mock('../../services/mcp/mcpClientService', () => ({
  isMCPAvailable: jest.fn(),
  generateTimeSeriesForecast: jest.fn(),
  detectAnalyticsAnomalies: jest.fn(),
  predictUserBehavior: jest.fn()
}));

jest.mock('../../services/credit/creditService', () => ({
  hasEnoughCreditsForService: jest.fn(),
  useServiceCredits: jest.fn()
}));

jest.mock('../../services/supabase/supabaseClient', () => ({
  getClient: jest.fn().mockReturnValue({
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          then: jest.fn().mockResolvedValue({ data: [], error: null })
        })
      }),
      insert: jest.fn().mockReturnValue({
        then: jest.fn().mockResolvedValue({ error: null })
      })
    }),
    rpc: jest.fn().mockReturnValue({
      then: jest.fn().mockResolvedValue({ data: null, error: null })
    })
  })
}));

// Mock withConnection function
jest.mock('../../../../shared/src/services/supabase/connectionPool', () => ({
  withConnection: jest.fn().mockImplementation((callback) => callback({
    rpc: jest.fn().mockResolvedValue({
      data: {
        historical: [
          { date: '2023-01-01T00:00:00Z', count: 10 },
          { date: '2023-01-02T00:00:00Z', count: 15 }
        ],
        forecast: [
          { date: '2023-01-03T00:00:00Z', count: 12, is_forecast: true },
          { date: '2023-01-04T00:00:00Z', count: 14, is_forecast: true }
        ]
      },
      error: null
    })
  }))
}));

describe('Predictive Analytics Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateTimeSeriesForecast', () => {
    it('should use MCP when available and user has enough credits', async () => {
      // Mock MCP availability and credit check
      (mcpClientService.isMCPAvailable as jest.Mock).mockResolvedValue(true);
      (creditService.hasEnoughCreditsForService as jest.Mock).mockResolvedValue(true);
      
      // Mock MCP response
      (mcpClientService.generateTimeSeriesForecast as jest.Mock).mockResolvedValue({
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
      
      // Call the service
      const result = await predictiveAnalyticsService.generateTimeSeriesForecast(
        {
          eventType: 'search',
          resourceType: 'material',
          startDate: new Date('2023-01-01T00:00:00Z'),
          endDate: new Date('2023-01-02T00:00:00Z'),
          forecastPeriods: 2,
          interval: 'day'
        },
        'user-123'
      );
      
      // Verify MCP was called
      expect(mcpClientService.isMCPAvailable).toHaveBeenCalled();
      expect(creditService.hasEnoughCreditsForService).toHaveBeenCalled();
      expect(mcpClientService.generateTimeSeriesForecast).toHaveBeenCalledWith(
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
      
      // Verify credit usage was tracked
      expect(creditService.useServiceCredits).toHaveBeenCalled();
      
      // Verify result
      expect(result).toBeDefined();
      expect(result.historical).toHaveLength(2);
      expect(result.forecast).toHaveLength(2);
      expect(result.modelInfo.name).toBe('TimeSeriesForecaster');
      expect(result.modelInfo.accuracy).toBe(0.85);
    });
    
    it('should fall back to direct implementation when MCP is not available', async () => {
      // Mock MCP unavailability
      (mcpClientService.isMCPAvailable as jest.Mock).mockResolvedValue(false);
      
      // Call the service
      const result = await predictiveAnalyticsService.generateTimeSeriesForecast(
        {
          eventType: 'search',
          resourceType: 'material',
          startDate: new Date('2023-01-01T00:00:00Z'),
          endDate: new Date('2023-01-02T00:00:00Z'),
          forecastPeriods: 2,
          interval: 'day'
        },
        'user-123'
      );
      
      // Verify MCP was checked but not called
      expect(mcpClientService.isMCPAvailable).toHaveBeenCalled();
      expect(mcpClientService.generateTimeSeriesForecast).not.toHaveBeenCalled();
      
      // Verify result from direct implementation
      expect(result).toBeDefined();
      expect(result.historical).toHaveLength(2);
      expect(result.forecast).toHaveLength(2);
      expect(result.modelInfo.name).toBe('SimpleMovingAverage');
    });
    
    it('should fall back to direct implementation when user has insufficient credits', async () => {
      // Mock MCP availability but insufficient credits
      (mcpClientService.isMCPAvailable as jest.Mock).mockResolvedValue(true);
      (creditService.hasEnoughCreditsForService as jest.Mock).mockResolvedValue(false);
      
      // Call the service
      const result = await predictiveAnalyticsService.generateTimeSeriesForecast(
        {
          eventType: 'search',
          resourceType: 'material',
          startDate: new Date('2023-01-01T00:00:00Z'),
          endDate: new Date('2023-01-02T00:00:00Z'),
          forecastPeriods: 2,
          interval: 'day'
        },
        'user-123'
      );
      
      // Verify credit check was performed but MCP was not called
      expect(mcpClientService.isMCPAvailable).toHaveBeenCalled();
      expect(creditService.hasEnoughCreditsForService).toHaveBeenCalled();
      expect(mcpClientService.generateTimeSeriesForecast).not.toHaveBeenCalled();
      
      // Verify result from direct implementation
      expect(result).toBeDefined();
      expect(result.historical).toHaveLength(2);
      expect(result.forecast).toHaveLength(2);
      expect(result.modelInfo.name).toBe('SimpleMovingAverage');
    });
  });

  describe('detectAnomalies', () => {
    it('should use MCP when available and user has enough credits', async () => {
      // Mock MCP availability and credit check
      (mcpClientService.isMCPAvailable as jest.Mock).mockResolvedValue(true);
      (creditService.hasEnoughCreditsForService as jest.Mock).mockResolvedValue(true);
      
      // Mock MCP response
      (mcpClientService.detectAnalyticsAnomalies as jest.Mock).mockResolvedValue({
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
      
      // Call the service
      const result = await predictiveAnalyticsService.detectAnomalies(
        {
          eventType: 'search',
          resourceType: 'material',
          startDate: new Date('2023-01-01T00:00:00Z'),
          endDate: new Date('2023-01-03T00:00:00Z'),
          interval: 'day',
          threshold: 2
        },
        'user-123'
      );
      
      // Verify MCP was called
      expect(mcpClientService.isMCPAvailable).toHaveBeenCalled();
      expect(creditService.hasEnoughCreditsForService).toHaveBeenCalled();
      expect(mcpClientService.detectAnalyticsAnomalies).toHaveBeenCalledWith(
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
      
      // Verify credit usage was tracked
      expect(creditService.useServiceCredits).toHaveBeenCalled();
      
      // Verify result
      expect(result).toBeDefined();
      expect(result.timeSeries).toHaveLength(3);
      expect(result.anomalies).toHaveLength(1);
      expect(result.anomalies[0].severity).toBe('high');
      expect(result.statistics.mean).toBe(15);
    });
    
    it('should fall back to direct implementation when MCP is not available', async () => {
      // Mock MCP unavailability
      (mcpClientService.isMCPAvailable as jest.Mock).mockResolvedValue(false);
      
      // Call the service
      const result = await predictiveAnalyticsService.detectAnomalies(
        {
          eventType: 'search',
          resourceType: 'material',
          startDate: new Date('2023-01-01T00:00:00Z'),
          endDate: new Date('2023-01-03T00:00:00Z'),
          interval: 'day',
          threshold: 2
        },
        'user-123'
      );
      
      // Verify MCP was checked but not called
      expect(mcpClientService.isMCPAvailable).toHaveBeenCalled();
      expect(mcpClientService.detectAnalyticsAnomalies).not.toHaveBeenCalled();
      
      // Verify result
      expect(result).toBeDefined();
    });
  });

  describe('predictUserBehavior', () => {
    it('should use MCP when available and user has enough credits', async () => {
      // Mock MCP availability and credit check
      (mcpClientService.isMCPAvailable as jest.Mock).mockResolvedValue(true);
      (creditService.hasEnoughCreditsForService as jest.Mock).mockResolvedValue(true);
      
      // Mock MCP response
      (mcpClientService.predictUserBehavior as jest.Mock).mockResolvedValue({
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
      });
      
      // Call the service
      const result = await predictiveAnalyticsService.predictUserBehavior(
        {
          userId: 'target-user-123',
          predictionType: 'next_action',
          lookbackDays: 30,
          includeUserProfile: true
        },
        'admin-user-123'
      );
      
      // Verify MCP was called
      expect(mcpClientService.isMCPAvailable).toHaveBeenCalled();
      expect(creditService.hasEnoughCreditsForService).toHaveBeenCalled();
      expect(mcpClientService.predictUserBehavior).toHaveBeenCalledWith(
        'admin-user-123',
        {
          userId: 'target-user-123',
          predictionType: 'next_action',
          lookbackDays: 30,
          includeUserProfile: true
        }
      );
      
      // Verify credit usage was tracked
      expect(creditService.useServiceCredits).toHaveBeenCalled();
      
      // Verify result
      expect(result).toBeDefined();
      expect(result.userId).toBe('target-user-123');
      expect(result.predictions).toHaveLength(2);
      expect(result.userInsights.activityLevel).toBe('high');
      expect(result.userInsights.interests).toHaveLength(2);
      expect(result.modelInfo.name).toBe('BehaviorPredictor');
    });
    
    it('should fall back to direct implementation when MCP is not available', async () => {
      // Mock MCP unavailability
      (mcpClientService.isMCPAvailable as jest.Mock).mockResolvedValue(false);
      
      // Mock Supabase response for user activity data
      const mockSupabaseClient = supabase.getClient();
      (mockSupabaseClient.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue([
                {
                  id: 'event-1',
                  event_type: 'search',
                  resource_type: 'material',
                  user_id: 'target-user-123',
                  timestamp: '2023-01-01T10:00:00Z'
                },
                {
                  id: 'event-2',
                  event_type: 'view',
                  resource_type: 'catalog',
                  user_id: 'target-user-123',
                  timestamp: '2023-01-02T11:00:00Z'
                }
              ])
            })
          })
        })
      });
      
      // Call the service
      const result = await predictiveAnalyticsService.predictUserBehavior(
        {
          userId: 'target-user-123',
          predictionType: 'next_action',
          lookbackDays: 30,
          includeUserProfile: true
        },
        'admin-user-123'
      );
      
      // Verify MCP was checked but not called
      expect(mcpClientService.isMCPAvailable).toHaveBeenCalled();
      expect(mcpClientService.predictUserBehavior).not.toHaveBeenCalled();
      
      // Verify result
      expect(result).toBeDefined();
      expect(result.userId).toBe('target-user-123');
      expect(result.predictionType).toBe('next_action');
      expect(result.modelInfo.name).toBe('SimpleRuleBasedModel');
    });
  });
});
