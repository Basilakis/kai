/**
 * Analytics Agent
 * 
 * A specialized agent that analyzes system metrics, user behavior patterns,
 * and generates insights about the platform's operation and performance.
 * Provides assistance for market research, trend analysis, and decision-making.
 */

import { Agent, Task } from 'crewai';
import { createLogger } from '../utils/logger';
import { AgentConfig, AgentType, SystemAgent } from '../core/types';
import { getAnalyticsService } from '../services/serviceFactory';
import { 
  createAnalyticsTools, 
  createAnalyticsQueryTool,
  createTrendAnalysisTool,
  createAnalyticsStatsTool,
  createTopSearchQueriesTool,
  createTopAgentPromptsTool,
  createTopMaterialsTool
} from '../tools';
import { AnalyticsEventType } from '../services/analyticsService';

// Logger instance
const logger = createLogger('AnalyticsAgent');

/**
 * Analytics Agent class that provides system insights, metrics analysis,
 * market research, and decision support
 */
export class AnalyticsAgent implements SystemAgent {
  // Required properties from SystemAgent interface
  public id: string;
  public type: AgentType;
  public name: string;
  public description: string;
  
  // Agent properties
  public agent: Agent;
  public config: AgentConfig;

  /**
   * Create a new AnalyticsAgent instance
   */
  constructor(config: AgentConfig, agent: Agent) {
    this.id = config.id;
    this.type = AgentType.ANALYTICS;
    this.name = config.name || 'Analytics Agent';
    this.description = config.description || 'Analyzes metrics, trends, and user behaviors to provide insights for decision-making';
    this.agent = agent;
    this.config = config;
    
    logger.info(`AnalyticsAgent created with ID: ${this.id}`);
  }

  /**
   * Get the underlying crewAI agent
   */
  public getAgent(): Agent {
    return this.agent;
  }

  /**
   * Run a specific analysis task
   */
  public async runTask(taskDescription: string, context?: Record<string, any>): Promise<string> {
    logger.info(`Running task: ${taskDescription}`);
    
    try {
      const task = new Task({
        description: taskDescription,
        expected_output: 'JSON string with analysis results and recommendations',
        agent: this.agent,
        context: context ? JSON.stringify(context) : undefined
      });
      
      // Execute the task and return the result
      const result = await this.agent.execute({
        task: taskDescription,
        context: context || {}
      });
      
      logger.info('Task executed successfully');
      return result;
    } catch (error) {
      logger.error(`Error running task: ${error}`);
      return JSON.stringify({
        error: true,
        message: "Failed to complete analysis task",
        details: String(error)
      });
    }
  }

  /**
   * Process a system event and generate insights
   */
  public async processEvent(eventType: string, eventData: any): Promise<void> {
    logger.info(`Processing event of type ${eventType}`);
    
    try {
      // Format the event data for processing
      const contextData = {
        timestamp: new Date().toISOString(),
        eventType,
        eventData
      };
      
      // Choose the appropriate handler based on event type
      switch (eventType) {
        case 'usage_spike':
          await this.handleUsageSpike(eventData);
          break;
          
        case 'search_pattern_change':
          await this.handleSearchPatternChange(eventData);
          break;
          
        case 'new_material_trend':
          await this.handleNewMaterialTrend(eventData);
          break;
          
        default:
          // Process generic event
          await this.agent.execute({
            task: `Analyze this ${eventType} event and generate insights`,
            context: contextData
          });
      }
      
      logger.info(`Processed ${eventType} event successfully`);
    } catch (error) {
      logger.error(`Error processing event: ${error}`);
    }
  }

  /**
   * Handle a usage spike event
   */
  private async handleUsageSpike(data: any): Promise<void> {
    logger.info(`Analyzing usage spike: ${JSON.stringify(data)}`);
    
    try {
      // Execute the agent task to analyze the usage spike
      await this.agent.execute({
        task: 'Analyze this unexpected usage spike and identify possible causes and implications',
        context: {
          eventType: 'usage_spike',
          timestamp: new Date().toISOString(),
          spike: data
        }
      });
    } catch (error) {
      logger.error(`Error handling usage spike: ${error}`);
    }
  }

  /**
   * Handle a search pattern change event
   */
  private async handleSearchPatternChange(data: any): Promise<void> {
    logger.info(`Analyzing search pattern change: ${JSON.stringify(data)}`);
    
    try {
      // Execute the agent task to analyze the search pattern change
      await this.agent.execute({
        task: 'Analyze this change in search patterns and identify emerging user interests or needs',
        context: {
          eventType: 'search_pattern_change',
          timestamp: new Date().toISOString(),
          patterns: data
        }
      });
    } catch (error) {
      logger.error(`Error handling search pattern change: ${error}`);
    }
  }

  /**
   * Handle a new material trend event
   */
  private async handleNewMaterialTrend(data: any): Promise<void> {
    logger.info(`Analyzing new material trend: ${JSON.stringify(data)}`);
    
    try {
      // Execute the agent task to analyze the new material trend
      await this.agent.execute({
        task: 'Analyze this emerging trend in material interest and provide market insights',
        context: {
          eventType: 'new_material_trend',
          timestamp: new Date().toISOString(),
          trend: data
        }
      });
    } catch (error) {
      logger.error(`Error handling new material trend: ${error}`);
    }
  }

  /**
   * Get user behavior insights
   */
  public async getUserBehaviorInsights(
    startDate?: Date,
    endDate?: Date,
    segment?: string
  ): Promise<string> {
    logger.info(`Getting user behavior insights${segment ? ` for segment: ${segment}` : ''}`);
    
    try {
      // Create date range string for the task description
      const dateRangeStr = startDate && endDate 
        ? ` between ${startDate.toISOString()} and ${endDate.toISOString()}`
        : '';
      
      // Build the task description
      const taskDescription = `Analyze user behavior patterns${dateRangeStr}${segment ? ` for segment: ${segment}` : ''} and provide insights on usage patterns, preferences, and engagement levels`;
      
      // Execute the analysis
      const result = await this.agent.execute({
        task: taskDescription,
        context: {
          startDate: startDate?.toISOString(),
          endDate: endDate?.toISOString(),
          segment
        }
      });
      
      logger.info('User behavior analysis completed successfully');
      return result;
    } catch (error) {
      logger.error(`Error analyzing user behavior: ${error}`);
      return JSON.stringify({
        error: true,
        message: "Failed to analyze user behavior",
        details: String(error)
      });
    }
  }

  /**
   * Get market trend analysis
   */
  public async getMarketTrendAnalysis(
    timeframe: 'day' | 'week' | 'month' = 'month',
    category?: string
  ): Promise<string> {
    logger.info(`Getting market trend analysis for ${timeframe}${category ? ` in category: ${category}` : ''}`);
    
    try {
      // Build the task description
      const taskDescription = `Analyze market trends over the past ${timeframe}${category ? ` in the ${category} category` : ''} and identify emerging patterns, opportunities, and potential threats`;
      
      // Execute the analysis
      const result = await this.agent.execute({
        task: taskDescription,
        context: {
          timeframe,
          category,
          analysisType: 'market_trends'
        }
      });
      
      logger.info('Market trend analysis completed successfully');
      return result;
    } catch (error) {
      logger.error(`Error analyzing market trends: ${error}`);
      return JSON.stringify({
        error: true,
        message: "Failed to analyze market trends",
        details: String(error)
      });
    }
  }

  /**
   * Get competitive analysis
   */
  public async getCompetitiveAnalysis(
    competitorData: Array<{ name: string; metrics: Record<string, any> }>,
    focusAreas?: string[]
  ): Promise<string> {
    logger.info(`Performing competitive analysis against ${competitorData.length} competitors`);
    
    try {
      // Build the task description
      const taskDescription = `Analyze our performance against competitors${focusAreas ? ` focusing on: ${focusAreas.join(', ')}` : ''} and provide strategic recommendations`;
      
      // Execute the analysis
      const result = await this.agent.execute({
        task: taskDescription,
        context: {
          competitorData,
          focusAreas,
          analysisType: 'competitive_analysis'
        }
      });
      
      logger.info('Competitive analysis completed successfully');
      return result;
    } catch (error) {
      logger.error(`Error performing competitive analysis: ${error}`);
      return JSON.stringify({
        error: true,
        message: "Failed to complete competitive analysis",
        details: String(error)
      });
    }
  }

  /**
   * Get decision support analysis
   */
  public async getDecisionSupport(
    decision: string,
    options: Array<{ name: string; pros: string[]; cons: string[] }>,
    criteria?: Array<{ name: string; weight: number }>
  ): Promise<string> {
    logger.info(`Providing decision support for: ${decision}`);
    
    try {
      // Build the task description
      const taskDescription = `Analyze the options for this decision: "${decision}" and provide a data-driven recommendation`;
      
      // Execute the analysis
      const result = await this.agent.execute({
        task: taskDescription,
        context: {
          decision,
          options,
          criteria,
          analysisType: 'decision_support'
        }
      });
      
      logger.info('Decision support analysis completed successfully');
      return result;
    } catch (error) {
      logger.error(`Error providing decision support: ${error}`);
      return JSON.stringify({
        error: true,
        message: "Failed to provide decision support",
        details: String(error)
      });
    }
  }

  /**
   * Get product performance analysis
   */
  public async getProductPerformanceAnalysis(
    productId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<string> {
    logger.info(`Analyzing performance for product: ${productId}`);
    
    try {
      // Create date range string for the task description
      const dateRangeStr = startDate && endDate 
        ? ` between ${startDate.toISOString()} and ${endDate.toISOString()}`
        : '';
      
      // Build the task description
      const taskDescription = `Analyze the performance of product ${productId}${dateRangeStr} and provide insights on usage, user satisfaction, and areas for improvement`;
      
      // Execute the analysis
      const result = await this.agent.execute({
        task: taskDescription,
        context: {
          productId,
          startDate: startDate?.toISOString(),
          endDate: endDate?.toISOString(),
          analysisType: 'product_performance'
        }
      });
      
      logger.info('Product performance analysis completed successfully');
      return result;
    } catch (error) {
      logger.error(`Error analyzing product performance: ${error}`);
      return JSON.stringify({
        error: true,
        message: "Failed to analyze product performance",
        details: String(error)
      });
    }
  }

  /**
   * Process a natural language query about analytics
   */
  public async processAnalyticsQuery(query: string): Promise<string> {
    logger.info(`Processing analytics query: "${query}"`);
    
    try {
      // Execute the agent with the query
      const result = await this.agent.execute({
        task: `Answer this analytics question: "${query}"`,
        context: {
          query,
          analysisType: 'nl_query'
        }
      });
      
      logger.info('Analytics query processed successfully');
      return result;
    } catch (error) {
      logger.error(`Error processing analytics query: ${error}`);
      return JSON.stringify({
        error: true,
        message: "Failed to process analytics query",
        details: String(error)
      });
    }
  }
}

/**
 * Create an AnalyticsAgent with the provided configuration
 */
export async function createAnalyticsAgent(
  config: AgentConfig,
  modelSettings: any
): Promise<SystemAgent> {
  logger.info('Creating AnalyticsAgent');
  
  // Create specialized analytics tools
  const analyticsTools = await createAnalyticsTools();
  
  // Combine with any additional tools from config
  const tools = [...analyticsTools];
  
  if (config.additionalTools) {
    tools.push(...config.additionalTools);
  }
  
  // Define the agent's capabilities and role
  const agentDescription = `
    You are an Analytics Agent specializing in data analysis, market research, and decision support.
    
    Your capabilities include:
    
    1. Analyzing user behaviors and interaction patterns
    2. Identifying trends in platform usage and material interests
    3. Providing market research and competitive analysis
    4. Supporting data-driven decision-making with insights and recommendations
    5. Generating visualizations and reports to communicate insights effectively
    
    You have access to analytical tools that allow you to query historical data,
    analyze trends, and generate statistics about platform usage, user behaviors,
    and material interactions.
    
    When providing insights, always:
    - Base your analysis on available data
    - Consider multiple perspectives and potential biases
    - Provide actionable recommendations
    - Highlight limitations in the data or analysis
    - Use clear language that non-technical stakeholders can understand
  `;
  
  // Create the crewAI agent
  const agent = new Agent({
    name: config.name || 'Analytics Expert',
    role: 'Data Analyst and Market Research Specialist',
    goal: 'Provide actionable insights and data-driven recommendations to optimize performance and support strategic decision-making',
    backstory: 'With expertise in data analysis, market research, and business intelligence, I help organizations transform raw data into strategic insights that drive growth and improve decision-making.',
    verbose: config.verbose || false,
    llm: modelSettings,
    tools
  });
  
  // Create and return the AnalyticsAgent instance
  return new AnalyticsAgent(config, agent);
}

export default {
  AnalyticsAgent,
  createAnalyticsAgent
};