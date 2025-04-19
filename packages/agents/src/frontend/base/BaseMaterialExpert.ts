/**
 * Base Material Expert Agent
 * 
 * This base class provides the common functionality for MaterialExpert implementations,
 * reducing duplication between the regular and enhanced versions.
 */

import { Agent, Task } from 'crewai';
import { createLogger } from '../../utils/logger';
import { AgentConfig, AgentType, UserFacingAgent } from '../../core/types';
import { createMaterialSearchTool } from '../../tools/materialSearch';
import { createVectorSearchTool } from '../../tools/vectorSearch';

// Logger instance
const logger = createLogger('BaseMaterialExpert');

/**
 * Base Material Expert class with shared functionality
 */
export abstract class BaseMaterialExpert implements UserFacingAgent {
  // Required properties from UserFacingAgent interface
  public id: string;
  public type: AgentType;
  public name: string;
  public description: string;
  
  // Agent properties
  public agent: Agent;
  public config: AgentConfig;

  /**
   * Create a new BaseMaterialExpert instance
   */
  constructor(config: AgentConfig, agent: Agent) {
    this.id = config.id;
    this.type = AgentType.MATERIAL_EXPERT;
    this.name = config.name || 'Material Expert';
    this.description = config.description || 'Expert in construction materials and their properties';
    this.agent = agent;
    this.config = config;
    
    logger.info(`${this.constructor.name} agent created with ID: ${this.id}`);
  }

  /**
   * Get the underlying crewAI agent
   */
  public getAgent(): Agent {
    return this.agent;
  }

  /**
   * Process a user input message and provide a response
   * This method can be overridden by subclasses to customize response processing
   */
  public async processUserInput(message: string): Promise<string> {
    logger.info(`Processing user input: ${message}`);
    
    try {
      // Create a task for the agent to process
      const task = new Task({
        description: `Answer this question about materials: ${message}`,
        expected_output: 'Detailed explanation of material properties, applications, or comparisons',
        agent: this.agent
      });
      
      // Execute the task
      // Using any type assertion as executeTask might not be in Agent's TypeScript definition
      const result = await (this.agent as any).executeTask(task);
      logger.info('Task executed successfully');
      
      // By default, return the raw result (subclasses may override to enhance)
      return this.processResult(result, message);
    } catch (error) {
      logger.error(`Error processing user input: ${error}`);
      return "I'm sorry, I encountered an error while processing your question. Could you please try rephrasing it?";
    }
  }
  
  /**
   * Process the result before returning it to the user
   * This method can be overridden by subclasses to provide enhanced processing
   */
  protected processResult(result: string, originalQuery: string): string {
    // Base implementation just returns the original result
    return result;
  }
}

/**
 * Create proper agent configuration for Material Experts
 * Shared implementation for all material expert types
 */
export function createMaterialExpertAgentConfig(
  config: AgentConfig,
  modelSettings: any,
  additionalTools: any[] = []
): { agent: Agent, tools: any[] } {
  logger.info('Creating agent configuration for MaterialExpert');
  
  // Create tools for the agent
  const tools = [
    createMaterialSearchTool(),
    createVectorSearchTool(),
    ...additionalTools
  ].filter(Boolean); // Filter out any undefined tools
  
  if (config.additionalTools) {
    tools.push(...config.additionalTools);
  }
  
  // Create the crewAI agent
  const agent = new Agent({
    name: config.name || 'Material Expert',
    role: 'Construction material specialist with deep knowledge of materials and their properties',
    goal: 'Provide accurate and detailed information about construction materials to help users make informed decisions',
    backstory: 'With years of experience in material science and construction, I can identify materials, explain their properties, and recommend the best options for specific applications.',
    verbose: config.verbose || false,
    llm: modelSettings,
    tools
  });
  
  return { agent, tools };
}