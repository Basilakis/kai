/**
 * Material Expert Agent
 * 
 * A specialized agent that provides deep knowledge about construction materials,
 * their properties, applications, and compatibility with other materials.
 */

import { Agent, Task } from 'crewai';
import { createLogger } from '../utils/logger';
import { AgentConfig, AgentType, UserFacingAgent } from '../core/types';
import { createMaterialSearchTool } from '../tools/materialSearch';
import { createVectorSearchTool } from '../tools/vectorSearch';

// Logger instance
const logger = createLogger('MaterialExpert');

/**
 * Material Expert class that provides detailed information about materials
 */
export class MaterialExpert implements UserFacingAgent {
  // Required properties from UserFacingAgent interface
  public id: string;
  public type: AgentType;
  public name: string;
  public description: string;
  
  // Agent properties
  public agent: Agent;
  public config: AgentConfig;

  /**
   * Create a new MaterialExpert instance
   */
  constructor(config: AgentConfig, agent: Agent) {
    this.id = config.id;
    this.type = AgentType.MATERIAL_EXPERT;
    this.name = config.name || 'Material Expert';
    this.description = config.description || 'Expert in construction materials and their properties';
    this.agent = agent;
    this.config = config;
    
    logger.info(`MaterialExpert agent created with ID: ${this.id}`);
  }

  /**
   * Get the underlying crewAI agent
   */
  public getAgent(): Agent {
    return this.agent;
  }

  /**
   * Process a user input message and provide a response
   */
  public async processUserInput(message: string): Promise<string> {
    logger.info(`Processing user input: ${message}`);
    
    try {
      // In a complete implementation, this would create a task for the agent to process
      // For now, we'll use a simplified version
      const task = new Task({
        description: `Answer this question about materials: ${message}`,
        expected_output: 'Detailed explanation of material properties, applications, or comparisons',
        agent: this.agent
      });
      
      // Execute the task and return the result
      // Using any type assertion as executeTask might not be in Agent's TypeScript definition
      const result = await (this.agent as any).executeTask(task);
      logger.info('Task executed successfully');
      return result;
    } catch (error) {
      logger.error(`Error processing user input: ${error}`);
      return "I'm sorry, I encountered an error while processing your question. Could you please try rephrasing it?";
    }
  }
}

/**
 * Create a MaterialExpert agent with the provided configuration
 */
export async function createMaterialExpert(
  config: AgentConfig,
  modelSettings: any
): Promise<UserFacingAgent> {
  logger.info('Creating MaterialExpert agent');
  
  // Create tools for the agent
  const tools = [
    await createMaterialSearchTool(),
    await createVectorSearchTool()
  ];
  
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
  
  // Create and return the MaterialExpert instance
  return new MaterialExpert(config, agent);
}

export default {
  MaterialExpert,
  createMaterialExpert
};