/**
 * Integration Tests for Predictive Analytics
 * 
 * These tests verify the integration between components in the predictive analytics system.
 * Unlike unit tests, these tests use minimal mocking and test the actual interactions
 * between components.
 */

import { predictiveAnalyticsService } from '../../services/analytics/predictive-analytics-service';
import { supabase } from '../../services/supabase/supabaseClient';
import mcpClientService from '../../services/mcp/mcpClientService';
import creditService from '../../services/credit/creditService';
import { v4 as uuidv4 } from 'uuid';

// Partial mocking - only mock external API calls, not internal functionality
jest.mock('../../services/mcp/mcpClientService', () => {
  // Keep the original module
  const originalModule = jest.requireActual('../../services/mcp/mcpClientService');
  
  // Mock only the methods that make external API calls
  return {
    ...originalModule,
    isMCPAvailable: jest.fn().mockResolvedValue(false), // Force direct implementation
    generateTimeSeriesForecast: jest.fn(),
    detectAnalyticsAnomalies: jest.fn(),
    predictUserBehavior: jest.fn()
  };
});

// Setup test data in the database
const setupTestData = async () => {
  // Create test analytics events
  const events = [];
  const userId = `test-user-${uuidv4()}`;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30); // 30 days ago
  
  // Create events for the past 30 days
  for (let i = 0; i < 30; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    
    // Create a search event
    events.push({
      id: `search-event-${i}`,
      event_type: 'search',
      resource_type: 'material',
      user_id: userId,
      query: 'marble tile',
      timestamp: date.toISOString(),
      source: 'test'
    });
    
    // Create a view event
    events.push({
      id: `view-event-${i}`,
      event_type: 'view',
      resource_type: 'material',
      resource_id: `material-${i % 5}`, // Cycle through 5 materials
      user_id: userId,
      timestamp: date.toISOString(),
      source: 'test'
    });
  }
  
  // Insert events into the database
  const { error } = await supabase.getClient()
    .from('analytics_events')
    .insert(events);
  
  if (error) {
    throw new Error(`Failed to insert test data: ${error.message}`);
  }
  
  return { userId };
};

// Clean up test data
const cleanupTestData = async (userId: string) => {
  const { error } = await supabase.getClient()
    .from('analytics_events')
    .delete()
    .eq('user_id', userId);
  
  if (error) {
    console.error(`Failed to clean up test data: ${error.message}`);
  }
};

describe('Predictive Analytics Integration', () => {
  let testUserId: string;
  
  beforeAll(async () => {
    // Setup test data
    const { userId } = await setupTestData();
    testUserId = userId;
  });
  
  afterAll(async () => {
    // Clean up test data
    await cleanupTestData(testUserId);
  });
  
  describe('Time-Series Forecasting', () => {
    it('should generate a forecast using database functions', async () => {
      // Use the direct implementation (MCP is mocked as unavailable)
      const result = await predictiveAnalyticsService.generateTimeSeriesForecast({
        eventType: 'search',
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        endDate: new Date(),
        forecastPeriods: 7,
        interval: 'day'
      });
      
      // Verify the result structure
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(Array.isArray(result.historical)).toBe(true);
      expect(Array.isArray(result.forecast)).toBe(true);
      expect(result.forecast.length).toBe(7); // 7 forecast periods
      expect(result.modelInfo).toBeDefined();
      
      // Verify the forecast was stored in the database
      const { data, error } = await supabase.getClient()
        .from('predictive_analytics_results')
        .select('*')
        .eq('id', result.id)
        .single();
      
      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.model_type).toBe('time-series');
      expect(data.prediction_type).toBe('forecast');
    });
  });
  
  describe('Anomaly Detection', () => {
    it('should detect anomalies using database functions', async () => {
      // Use the direct implementation (MCP is mocked as unavailable)
      const result = await predictiveAnalyticsService.detectAnomalies({
        eventType: 'search',
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        endDate: new Date(),
        interval: 'day',
        threshold: 2.0
      });
      
      // Verify the result structure
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(Array.isArray(result.timeSeries)).toBe(true);
      expect(Array.isArray(result.anomalies)).toBe(true);
      expect(result.statistics).toBeDefined();
      expect(result.statistics.mean).toBeDefined();
      expect(result.statistics.stdDev).toBeDefined();
      expect(result.statistics.threshold).toBe(2.0);
      
      // Verify the anomaly detection was stored in the database
      const { data, error } = await supabase.getClient()
        .from('predictive_analytics_results')
        .select('*')
        .eq('id', result.id)
        .single();
      
      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.model_type).toBe('anomaly-detection');
      expect(data.prediction_type).toBe('anomaly-detection');
    });
  });
  
  describe('User Behavior Prediction', () => {
    it('should predict user behavior using database functions', async () => {
      // Use the direct implementation (MCP is mocked as unavailable)
      const result = await predictiveAnalyticsService.predictUserBehavior({
        userId: testUserId,
        predictionType: 'next_action',
        lookbackDays: 30,
        includeUserProfile: true
      });
      
      // Verify the result structure
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.userId).toBe(testUserId);
      expect(result.predictionType).toBe('next_action');
      expect(Array.isArray(result.predictions)).toBe(true);
      expect(result.userInsights).toBeDefined();
      expect(result.userInsights.activityLevel).toBeDefined();
      expect(Array.isArray(result.userInsights.interests)).toBe(true);
      expect(Array.isArray(result.userInsights.patterns)).toBe(true);
      
      // Verify the prediction was stored in the database
      const { data, error } = await supabase.getClient()
        .from('predictive_analytics_results')
        .select('*')
        .eq('id', result.id)
        .single();
      
      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.model_type).toBe('user-behavior');
      expect(data.prediction_type).toBe('user-behavior');
    });
  });
  
  describe('End-to-End Flow', () => {
    it('should handle the complete flow from data to prediction', async () => {
      // This test verifies the complete flow from data collection to prediction
      
      // 1. Track some events for the test user
      const eventIds = [];
      for (let i = 0; i < 5; i++) {
        const eventId = await predictiveAnalyticsService.trackEvent({
          event_type: 'search',
          resource_type: 'material',
          user_id: testUserId,
          query: 'ceramic tile',
          timestamp: new Date().toISOString()
        });
        eventIds.push(eventId);
      }
      
      // 2. Generate a forecast
      const forecast = await predictiveAnalyticsService.generateTimeSeriesForecast({
        eventType: 'search',
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        endDate: new Date(),
        forecastPeriods: 7,
        interval: 'day'
      });
      
      // 3. Detect anomalies
      const anomalies = await predictiveAnalyticsService.detectAnomalies({
        eventType: 'search',
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        endDate: new Date(),
        interval: 'day',
        threshold: 2.0
      });
      
      // 4. Predict user behavior
      const behavior = await predictiveAnalyticsService.predictUserBehavior({
        userId: testUserId,
        predictionType: 'next_action',
        lookbackDays: 30,
        includeUserProfile: true
      });
      
      // Verify all steps worked
      expect(eventIds.length).toBe(5);
      expect(forecast).toBeDefined();
      expect(anomalies).toBeDefined();
      expect(behavior).toBeDefined();
      
      // Verify the predictions reference the correct user
      expect(behavior.userId).toBe(testUserId);
      
      // Clean up the events we just created
      for (const eventId of eventIds) {
        await supabase.getClient()
          .from('analytics_events')
          .delete()
          .eq('id', eventId);
      }
    });
  });
});
