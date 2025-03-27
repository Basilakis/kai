/**
 * Operations Agent
 * 
 * A specialized agent that monitors system health, detects potential issues,
 * and provides recommendations for optimizing performance and reliability.
 */

import { Agent, Task } from 'crewai';
import { createLogger } from '../utils/logger';
import { AgentConfig, AgentType, SystemAgent } from '../core/types';

// Logger instance
const logger = createLogger('OperationsAgent');

/**
 * Operations Agent class that monitors system health and performance
 */
export class OperationsAgent implements SystemAgent {
  // Required properties from SystemAgent interface
  public id: string;
  public type: AgentType;
  public name: string;
  public description: string;
  
  // Agent properties
  public agent: Agent;
  public config: AgentConfig;

  /**
   * Create a new OperationsAgent instance
   */
  constructor(config: AgentConfig, agent: Agent) {
    this.id = config.id;
    this.type = AgentType.OPERATIONS;
    this.name = config.name || 'Operations Agent';
    this.description = config.description || 'Monitors system health and optimizes performance';
    this.agent = agent;
    this.config = config;
    
    logger.info(`OperationsAgent created with ID: ${this.id}`);
  }

  /**
   * Get the underlying crewAI agent
   */
  public getAgent(): Agent {
    return this.agent;
  }

  /**
   * Run a specific operations task
   */
  public async runTask(taskDescription: string): Promise<string> {
    logger.info(`Running task: ${taskDescription}`);
    
    try {
      const task = new Task({
        description: taskDescription,
        expected_output: 'JSON string with operational analysis and recommendations',
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
        message: "Failed to complete operations task",
        details: String(error)
      });
    }
  }

  /**
   * Process a system event and detect potential issues
   */
  public async processEvent(eventType: string, eventData: any): Promise<void> {
    logger.info(`Processing event of type ${eventType}`);
    
    try {
      // In a complete implementation, this would analyze the event for
      // operational concerns like performance bottlenecks or error patterns
      
      // For now, we'll just log the event
      const contextData = {
        timestamp: new Date().toISOString(),
        eventType,
        eventData
      };
      
      // Convert complex context to string since Task.context expects string | string[]
      const task = new Task({
        description: `Analyze this ${eventType} event for operational concerns`,
        expected_output: 'JSON string with operational insights and recommendations',
        agent: this.agent,
        context: JSON.stringify(contextData)
      });
      
      // Process the event asynchronously
      (this.agent as any).executeTask(task)
        .then((result: any) => {
          logger.info(`Generated operational insights for ${eventType} event`);
          // In a real implementation, we would trigger alerts or remediation workflows
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
 * Create an OperationsAgent with the provided configuration
 */
export async function createOperationsAgent(
  config: AgentConfig,
  modelSettings: any
): Promise<SystemAgent> {
  logger.info('Creating OperationsAgent');
  
  // Define tools for the agent
  // In a complete implementation, these would include system monitoring and performance tools
  const tools = [];
  
  if (config.additionalTools) {
    tools.push(...config.additionalTools);
  }
  
  // Create the crewAI agent
  const agent = new Agent({
    name: config.name || 'Operations Agent',
    role: 'System operations expert who monitors health and optimizes performance',
    goal: 'Ensure the platform operates efficiently and reliably by identifying issues and optimization opportunities',
    backstory: 'With deep knowledge of system architecture and performance optimization, I excel at detecting potential issues before they impact users and finding ways to improve system efficiency.',
    verbose: config.verbose || false,
    llm: modelSettings,
    tools
  });
  
  // Create and return the OperationsAgent instance
  return new OperationsAgent(config, agent);
}

export default {
  OperationsAgent,
  createOperationsAgent
};