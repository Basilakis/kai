/**
 * Analytics Agent
 * 
 * A specialized agent that analyzes system metrics, user behavior patterns,
 * and generates insights about the platform's operation and performance.
 */

import { Agent, Task } from 'crewai';
import { createLogger } from '../utils/logger';
import { AgentConfig, AgentType, SystemAgent } from '../core/types';

// Logger instance
const logger = createLogger('AnalyticsAgent');

/**
 * Analytics Agent class that provides system insights and metrics analysis
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
    this.description = config.description || 'Analyzes system metrics and user behavior patterns';
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
  public async runTask(taskDescription: string): Promise<string> {
    logger.info(`Running task: ${taskDescription}`);
    
    try {
      const task = new Task({
        description: taskDescription,
        expected_output: 'JSON string with analysis results and recommendations',
        agent: this.agent
      });
      
      // Execute the task and return the result
      // Using any type assertion as executeTask might not be in Agent's TypeScript definition
      const result = await (this.agent as any).executeTask(task);
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
      // In a complete implementation, this would analyze the event and potentially
      // trigger other actions or store insights in a database
      
      // For now, we'll just log the event
      const contextData = {
        timestamp: new Date().toISOString(),
        eventType,
        eventData
      };
      
      // Convert complex context to string since Task.context expects string | string[]
      const task = new Task({
        description: `Analyze this ${eventType} event and generate insights`,
        expected_output: 'JSON string with insights and recommendations',
        agent: this.agent,
        context: JSON.stringify(contextData)
      });
      
      // Process the event asynchronously
      (this.agent as any).executeTask(task)
        .then((result: any) => {
          logger.info(`Generated insights for ${eventType} event`);
          // In a real implementation, we would store these insights or trigger actions
        })
        .catch((error: any) => {
          logger.error(`Error processing ${eventType} event: ${error}`);
        });
    } catch (error) {
      logger.error(`Error setting up event processing: ${error}`);
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
  
  // Define tools for the agent
  // In a complete implementation, these would be specialized analytics tools
  const tools = [];
  
  if (config.additionalTools) {
    tools.push(...config.additionalTools);
  }
  
  // Create the crewAI agent
  const agent = new Agent({
    name: config.name || 'Analytics Agent',
    role: 'System analyst who monitors platform metrics and user behaviors',
    goal: 'Provide actionable insights about system performance and user patterns to optimize the platform',
    backstory: 'With expertise in data analysis and system optimization, I can identify trends, anomalies, and opportunities for improvement across the platform.',
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