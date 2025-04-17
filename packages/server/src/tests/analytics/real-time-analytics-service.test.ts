/**
 * Tests for the Real-Time Analytics Service
 */

import { realTimeAnalyticsService } from '../../services/analytics/real-time-analytics-service';
import mcpClientService from '../../services/mcp/mcpClientService';
import creditService from '../../services/credit/creditService';
import { supabase } from '../../services/supabase/supabaseClient';
import { v4 as uuidv4 } from 'uuid';
import http from 'http';
import WebSocket from 'ws';

// Mock dependencies
jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('mock-uuid')
}));

jest.mock('../../services/mcp/mcpClientService', () => ({
  isMCPAvailable: jest.fn(),
  processRealTimeAnalytics: jest.fn()
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
        }),
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              then: jest.fn().mockResolvedValue({ data: [], error: null })
            })
          })
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

jest.mock('ws', () => {
  const MockWebSocket = jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    clients: new Set(),
    close: jest.fn().mockImplementation(cb => cb())
  }));
  
  MockWebSocket.Server = jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    clients: new Set(),
    close: jest.fn().mockImplementation(cb => cb())
  }));
  
  return MockWebSocket;
});

describe('Real-Time Analytics Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('trackEvent', () => {
    it('should add event to buffer and return event ID', async () => {
      // Call the service
      const eventId = await realTimeAnalyticsService.trackEvent({
        event_type: 'search',
        resource_type: 'material',
        user_id: 'user-123',
        query: 'marble tile'
      });
      
      // Verify UUID was generated
      expect(uuidv4).toHaveBeenCalled();
      
      // Verify event ID was returned
      expect(eventId).toBe('mock-uuid');
    });
    
    it('should use provided event ID if available', async () => {
      // Call the service with custom ID
      const eventId = await realTimeAnalyticsService.trackEvent({
        id: 'custom-id',
        event_type: 'search',
        resource_type: 'material',
        user_id: 'user-123',
        query: 'marble tile'
      });
      
      // Verify UUID was not generated
      expect(uuidv4).not.toHaveBeenCalled();
      
      // Verify custom event ID was returned
      expect(eventId).toBe('custom-id');
    });
  });

  describe('getRecentEvents', () => {
    it('should retrieve recent events from database', async () => {
      // Mock Supabase response
      const mockEvents = [
        {
          id: 'event-1',
          event_type: 'search',
          resource_type: 'material',
          user_id: 'user-123',
          query: 'marble tile',
          timestamp: '2023-01-01T00:00:00Z',
          processed_at: '2023-01-01T00:00:01Z',
          insights: { searchQuery: 'marble tile' }
        },
        {
          id: 'event-2',
          event_type: 'view',
          resource_type: 'catalog',
          user_id: 'user-123',
          resource_id: 'catalog-123',
          timestamp: '2023-01-01T00:01:00Z',
          processed_at: '2023-01-01T00:01:01Z',
          insights: { viewedResource: 'catalog-123' }
        }
      ];
      
      const mockSupabaseClient = supabase.getClient();
      (mockSupabaseClient.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                data: mockEvents,
                error: null
              })
            })
          })
        })
      });
      
      // Call the service
      const events = await realTimeAnalyticsService.getRecentEvents('user-123', 10);
      
      // Verify Supabase was called
      expect(supabase.getClient).toHaveBeenCalled();
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('real_time_analytics_events');
      
      // Verify result
      expect(events).toEqual(mockEvents);
    });
    
    it('should return empty array on error', async () => {
      // Mock Supabase error
      const mockSupabaseClient = supabase.getClient();
      (mockSupabaseClient.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                data: null,
                error: new Error('Database error')
              })
            })
          })
        })
      });
      
      // Call the service
      const events = await realTimeAnalyticsService.getRecentEvents('user-123', 10);
      
      // Verify result is empty array
      expect(events).toEqual([]);
    });
  });

  describe('initialize', () => {
    it('should initialize WebSocket server', () => {
      // Create mock HTTP server
      const mockServer = {} as http.Server;
      
      // Initialize service
      realTimeAnalyticsService.initialize(mockServer);
      
      // Verify WebSocket server was created
      expect(WebSocket.Server).toHaveBeenCalledWith({
        server: mockServer,
        path: '/api/analytics/real-time'
      });
    });
  });

  describe('close', () => {
    it('should close WebSocket server', async () => {
      // Create mock HTTP server and initialize
      const mockServer = {} as http.Server;
      realTimeAnalyticsService.initialize(mockServer);
      
      // Close service
      await realTimeAnalyticsService.close();
      
      // Verify WebSocket server was closed
      const mockWss = (WebSocket.Server as jest.Mock).mock.results[0].value;
      expect(mockWss.close).toHaveBeenCalled();
    });
  });

  describe('subscribe and unsubscribe', () => {
    it('should create and remove subscriptions', () => {
      // Create subscription
      const callback = jest.fn();
      const subscriptionId = realTimeAnalyticsService.subscribe(
        'user-123',
        { event_type: 'search' },
        callback,
        { enableAnomalyDetection: true }
      );
      
      // Verify subscription ID was returned
      expect(subscriptionId).toBeDefined();
      
      // Unsubscribe
      const result = realTimeAnalyticsService.unsubscribe(subscriptionId);
      
      // Verify unsubscribe was successful
      expect(result).toBe(true);
    });
    
    it('should unsubscribe all for a user', () => {
      // Create multiple subscriptions for same user
      const callback = jest.fn();
      realTimeAnalyticsService.subscribe(
        'user-123',
        { event_type: 'search' },
        callback
      );
      realTimeAnalyticsService.subscribe(
        'user-123',
        { event_type: 'view' },
        callback
      );
      realTimeAnalyticsService.subscribe(
        'user-456',
        { event_type: 'search' },
        callback
      );
      
      // Unsubscribe all for user-123
      realTimeAnalyticsService.unsubscribeAll('user-123');
      
      // Create new subscription for user-123
      const subscriptionId = realTimeAnalyticsService.subscribe(
        'user-123',
        { event_type: 'download' },
        callback
      );
      
      // Verify new subscription has different ID (subscriptions were cleared)
      expect(subscriptionId).toBeDefined();
    });
  });
});
