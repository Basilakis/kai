/**
 * Analytics Service Adapter for Agents
 * 
 * This module provides a bridge to the main analytics service in the server package,
 * allowing agent activity to be tracked without direct cross-package dependencies.
 */

import { BaseService, ServiceConfig } from './baseService';
import { env } from '../../../shared/src/utils/environment';
import { createLogger } from '../utils/logger';

// Logger instance
const logger = createLogger('AnalyticsService');

// Mirror of AnalyticsEventType from server package
export enum AnalyticsEventType {
  SEARCH = 'search',
  AGENT_PROMPT = 'agent_prompt',
  API_REQUEST = 'api_request',
  MATERIAL_VIEW = 'material_view',
  RECOGNITION = 'recognition'
}

// Mirror of AnalyticsSourceType from server package
export enum AnalyticsSourceType {
  API = 'api',
  INTERNAL = 'internal',
  CREW_AI_AGENT = 'crew_ai_agent',
  USER_INTERFACE = 'user_interface', 
  SYSTEM = 'system',
  SCHEDULER = 'scheduler'
}

/**
 * Analytics Service Adapter for tracking agent activities
 * Extends BaseService to get access to protected HTTP methods
 */
class AnalyticsServiceAdapter extends BaseService {
  constructor() {
    const config: ServiceConfig = {
      baseURL: env.services.kaiApiUrl || 'http://localhost:3000',
      timeout: 10000,
      useAuth: true
    };
    super(config);
    logger.info('Analytics Service Adapter initialized');
  }

  /**
   * Track a crewAI agent activity event
   * 
   * @param agentId The ID of the agent
   * @param agentType The type of agent
   * @param action The action performed by the agent
   * @param status The status of the action
   * @param details Additional details about the action
   * @returns A promise that resolves when the tracking is complete
   */
  public async trackCrewAIAgentActivity(
    agentId: string,
    agentType: string,
    action: string,
    status: string,
    details?: Record<string, any>
  ): Promise<void> {
    try {
      // Call the server's analyticsService via API
      await this.post('/analytics/agent-activity', {
        agentId,
        agentType,
        action,
        status,
        details,
        source: AnalyticsSourceType.CREW_AI_AGENT,
        source_detail: agentId
      });
      logger.debug(`Tracked agent activity: ${agentId}, ${action}, ${status}`);
    } catch (error: unknown) {
      // Don't throw errors from analytics tracking to avoid disrupting agent operations
      logger.error(`Failed to track agent activity in analytics: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Track an agent search event
   * 
   * @param query The search query
   * @param resourceType The type of resource being searched
   * @param agentId The ID of the agent making the search
   * @param parameters Additional search parameters
   * @returns A promise that resolves when the tracking is complete
   */
  public async trackAgentSearch(
    query: string,
    resourceType: string,
    agentId: string,
    parameters?: Record<string, any>
  ): Promise<void> {
    try {
      await this.post('/analytics/search', {
        query,
        resourceType,
        parameters,
        source: AnalyticsSourceType.CREW_AI_AGENT,
        source_detail: agentId
      });
      logger.debug(`Tracked agent search: ${agentId}, ${query}`);
    } catch (error: unknown) {
      logger.error(`Failed to track agent search in analytics: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Track an agent API request event
   * 
   * @param path The API endpoint path
   * @param method The HTTP method used
   * @param agentId The ID of the agent making the request
   * @param parameters Request parameters and body
   * @returns A promise that resolves when the tracking is complete
   */
  public async trackAgentApiRequest(
    path: string,
    method: string,
    agentId: string,
    parameters?: Record<string, any>
  ): Promise<void> {
    try {
      await this.post('/analytics/api-request', {
        path,
        method,
        parameters,
        source: AnalyticsSourceType.CREW_AI_AGENT,
        source_detail: agentId
      });
      logger.debug(`Tracked agent API request: ${agentId}, ${method} ${path}`);
    } catch (error: unknown) {
      logger.error(`Failed to track agent API request in analytics: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

// Export singleton instance
export const analyticsService = new AnalyticsServiceAdapter();
export default analyticsService;