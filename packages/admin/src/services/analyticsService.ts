/**
 * Analytics Service
 * 
 * This service provides methods to fetch analytics data from the backend API
 * including search metrics, agent prompts, API usage statistics, and other
 * analytics data for the admin dashboard.
 */

// Using dynamic import to work around the axios module not found error
// This would typically be a regular import, but TypeScript configurations may vary
const axios = (() => {
  try {
    // @ts-ignore
    return require('axios');
  } catch (e) {
    // Fallback for when axios isn't found
    console.warn('Axios not found, using fetch API instead');
    return {
      get: async (url: string, config?: any) => {
        const headers = new Headers();
        if (config?.headers) {
          Object.entries(config.headers).forEach(([key, value]) => 
            headers.append(key, value as string)
          );
        }
        const response = await fetch(url, { headers });
        return { 
          status: response.status, 
          statusText: response.statusText,
          data: await response.json()
        };
      },
      delete: async (url: string, config?: any) => {
        const headers = new Headers();
        if (config?.headers) {
          Object.entries(config.headers).forEach(([key, value]) => 
            headers.append(key, value as string)
          );
        }
        const response = await fetch(url, { 
          method: 'DELETE',
          headers 
        });
        return { 
          status: response.status, 
          statusText: response.statusText,
          data: await response.json()
        };
      }
    };
  }
})();

// Types for analytics data
export interface AnalyticsEvent {
  id?: string;
  timestamp?: string;
  user_id?: string;
  event_type: string;
  resource_type?: string;
  query?: string;
  parameters?: Record<string, any>;
  response_status?: number;
  response_time?: number;
  ip_address?: string;
  user_agent?: string;
  session_id?: string;
}

export interface AnalyticsQueryOptions {
  startDate?: Date;
  endDate?: Date;
  eventType?: string;
  resourceType?: string;
  userId?: string;
  limit?: number;
  skip?: number;
  sort?: Record<string, 'asc' | 'desc'>;
}

export interface AnalyticsTrendOptions {
  timeframe: 'day' | 'week' | 'month';
  eventType?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface AnalyticsStats {
  total: number;
  byEventType: Record<string, number>;
  byResourceType: Record<string, number>;
  topQueries: Array<{query: string; count: number}>;
  topMaterials: Array<{materialId: string; name: string; count: number}>;
  averageResponseTime: Record<string, number>;
}

export interface TopQuery {
  query: string;
  count: number;
}

export interface TopPrompt {
  prompt: string;
  count: number;
}

export interface TopMaterial {
  materialId: string;
  name: string;
  count: number;
}

// Base API URL
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

/**
 * Analytics Service Class
 */
class AnalyticsService {
  /**
   * Get analytics events with optional filtering
   */
  async getEvents(options: AnalyticsQueryOptions = {}): Promise<AnalyticsEvent[]> {
    try {
      // Build query parameters
      const params = new URLSearchParams();
      
      if (options.startDate) {
        params.append('startDate', options.startDate.toISOString());
      }
      
      if (options.endDate) {
        params.append('endDate', options.endDate.toISOString());
      }
      
      if (options.eventType) {
        params.append('eventType', options.eventType);
      }
      
      if (options.resourceType) {
        params.append('resourceType', options.resourceType);
      }
      
      if (options.userId) {
        params.append('userId', options.userId);
      }
      
      if (options.limit) {
        params.append('limit', options.limit.toString());
      }
      
      if (options.skip) {
        params.append('skip', options.skip.toString());
      }
      
      if (options.sort) {
        const sortKey = Object.keys(options.sort)[0];
        if (sortKey) {
          params.append('sortBy', sortKey);
          params.append('sortDirection', options.sort[sortKey]);
        }
      }
      
      // Make API request
      const response = await axios.get(`${API_BASE_URL}/admin/analytics/events`, { 
        params,
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      return response.data.data;
    } catch (error) {
      console.error('Error fetching analytics events:', error);
      throw error;
    }
  }
  
  /**
   * Get analytics trends over time
   */
  async getTrends(options: AnalyticsTrendOptions): Promise<Record<string, number>> {
    try {
      // Build query parameters
      const params = new URLSearchParams();
      
      params.append('timeframe', options.timeframe);
      
      if (options.eventType) {
        params.append('eventType', options.eventType);
      }
      
      if (options.startDate) {
        params.append('startDate', options.startDate.toISOString());
      }
      
      if (options.endDate) {
        params.append('endDate', options.endDate.toISOString());
      }
      
      // Make API request
      const response = await axios.get(`${API_BASE_URL}/admin/analytics/trends`, { 
        params,
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      return response.data.data;
    } catch (error) {
      console.error('Error fetching analytics trends:', error);
      throw error;
    }
  }
  
  /**
   * Get analytics statistics
   */
  async getStats(startDate?: Date, endDate?: Date): Promise<AnalyticsStats> {
    try {
      // Build query parameters
      const params = new URLSearchParams();
      
      if (startDate) {
        params.append('startDate', startDate.toISOString());
      }
      
      if (endDate) {
        params.append('endDate', endDate.toISOString());
      }
      
      // Make API request
      const response = await axios.get(`${API_BASE_URL}/admin/analytics/stats`, { 
        params,
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      return response.data.data;
    } catch (error) {
      console.error('Error fetching analytics statistics:', error);
      throw error;
    }
  }
  
  /**
   * Get top search queries
   */
  async getTopSearchQueries(limit: number = 10, startDate?: Date, endDate?: Date): Promise<TopQuery[]> {
    try {
      // Build query parameters
      const params = new URLSearchParams();
      
      params.append('limit', limit.toString());
      
      if (startDate) {
        params.append('startDate', startDate.toISOString());
      }
      
      if (endDate) {
        params.append('endDate', endDate.toISOString());
      }
      
      // Make API request
      const response = await axios.get(`${API_BASE_URL}/admin/analytics/searches`, { 
        params,
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      return response.data.data;
    } catch (error) {
      console.error('Error fetching top search queries:', error);
      throw error;
    }
  }
  
  /**
   * Get top agent prompts
   */
  async getTopAgentPrompts(limit: number = 10, startDate?: Date, endDate?: Date): Promise<TopPrompt[]> {
    try {
      // Build query parameters
      const params = new URLSearchParams();
      
      params.append('limit', limit.toString());
      
      if (startDate) {
        params.append('startDate', startDate.toISOString());
      }
      
      if (endDate) {
        params.append('endDate', endDate.toISOString());
      }
      
      // Make API request
      const response = await axios.get(`${API_BASE_URL}/admin/analytics/agent-prompts`, { 
        params,
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      return response.data.data;
    } catch (error) {
      console.error('Error fetching top agent prompts:', error);
      throw error;
    }
  }
  
  /**
   * Get top viewed materials
   */
  async getTopMaterials(limit: number = 10, startDate?: Date, endDate?: Date): Promise<TopMaterial[]> {
    try {
      // Build query parameters
      const params = new URLSearchParams();
      
      params.append('limit', limit.toString());
      
      if (startDate) {
        params.append('startDate', startDate.toISOString());
      }
      
      if (endDate) {
        params.append('endDate', endDate.toISOString());
      }
      
      // Make API request
      const response = await axios.get(`${API_BASE_URL}/admin/analytics/materials`, { 
        params,
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      return response.data.data;
    } catch (error) {
      console.error('Error fetching top materials:', error);
      throw error;
    }
  }
  
  /**
   * Clear analytics data (admin only)
   */
  async clearData(before?: Date): Promise<number> {
    try {
      // Build query parameters
      const params = new URLSearchParams();
      
      if (before) {
        params.append('before', before.toISOString());
      }
      
      // Make API request
      const response = await axios.delete(`${API_BASE_URL}/admin/analytics/data`, { 
        params,
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      return response.data.data.count;
    } catch (error) {
      console.error('Error clearing analytics data:', error);
      throw error;
    }
  }
}

// Export a singleton instance
const analyticsService = new AnalyticsService();
export default analyticsService;