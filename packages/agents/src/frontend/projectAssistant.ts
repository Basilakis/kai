/**
 * Project Assistant Agent
 * 
 * A specialized agent that helps users organize materials into projects,
 * calculate quantities, estimate costs, and plan material applications.
 */

import { Agent, Task } from 'crewai';
import { createLogger } from '../utils/logger';
import { AgentConfig, AgentType, UserFacingAgent } from '../core/types';
import { createMaterialSearchTool } from '../tools/materialSearch';
import { createVectorSearchTool } from '../tools/vectorSearch';

// Logger instance
const logger = createLogger('ProjectAssistant');

/**
 * Project Assistant class that helps with material project planning
 */
export class ProjectAssistant implements UserFacingAgent {
  // Required properties from UserFacingAgent interface
  public id: string;
  public type: AgentType;
  public name: string;
  public description: string;
  
  // Agent properties
  public agent: Agent;
  public config: AgentConfig;

  /**
   * Create a new ProjectAssistant instance
   */
  constructor(config: AgentConfig, agent: Agent) {
    this.id = config.id;
    this.type = AgentType.PROJECT_ASSISTANT;
    this.name = config.name || 'Project Assistant';
    this.description = config.description || 'Expert in project planning and material organization';
    this.agent = agent;
    this.config = config;
    
    logger.info(`ProjectAssistant agent created with ID: ${this.id}`);
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
        description: `Help with this project planning question: ${message}`,
        expected_output: 'Detailed project advice, material planning, or quantity calculations',
        agent: this.agent
      });
      
      // Execute the task and return the result
      // Using any type assertion as executeTask might not be in Agent's TypeScript definition
      const result = await (this.agent as any).executeTask(task);
      logger.info('Task executed successfully');
      return result;
    } catch (error) {
      logger.error(`Error processing user input: ${error}`);
      return "I'm sorry, I encountered an error while processing your project question. Could you please try rephrasing it?";
    }
  }
}

/**
 * Create a ProjectAssistant agent with the provided configuration
 */
export async function createProjectAssistant(
  config: AgentConfig,
  modelSettings: any
): Promise<UserFacingAgent> {
  logger.info('Creating ProjectAssistant agent');
  
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
    name: config.name || 'Project Assistant',
    role: 'Project planning specialist who helps organize materials and estimate quantities',
    goal: 'Help users plan and organize their materials into cohesive projects with accurate quantities and costs',
    backstory: 'With expertise in project management and material application, I can help you organize materials, calculate quantities, and plan material applications for optimal results.',
    verbose: config.verbose || false,
    llm: modelSettings,
    tools
  });
  
  // Create and return the ProjectAssistant instance
  return new ProjectAssistant(config, agent);
}

export default {
  ProjectAssistant,
  createProjectAssistant
};