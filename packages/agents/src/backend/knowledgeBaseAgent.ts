/**
 * Knowledge Base Agent
 * 
 * An agent that monitors and interacts with the knowledge base system,
 * providing intelligent assistance for data management, quality assurance,
 * and insights generation.
 */

import { Agent, Tool } from 'crewai';
import { AgentConfig, AgentType, SystemAgent } from '../core/types';
import { createLogger } from '../utils/logger';

// Import KAI-specific tools
import { createMaterialSearchTool } from '../tools/materialSearch';
import { createVectorSearchTool } from '../tools/vectorSearch';

// Logger instance
const logger = createLogger('KnowledgeBaseAgent');

/**
 * Knowledge Base Agent class
 * Provides intelligent assistance for knowledge base operations
 */
export class KnowledgeBaseAgent implements SystemAgent {
  // Required SystemAgent interface properties
  public id: string;
  public type: AgentType;
  public name: string;
  public description: string;
  public agent: Agent;
  public config: AgentConfig;
  
  /**
   * Create a new KnowledgeBaseAgent
   */
  constructor(agent: Agent, config: AgentConfig) {
    this.agent = agent;
    this.config = config;
    this.id = config.id || `knowledge-agent-${Date.now()}`;
    this.type = AgentType.KNOWLEDGE_BASE;
    this.name = "Knowledge Base Agent";
    this.description = "Intelligent assistant for knowledge base operations";
    logger.info(`KnowledgeBaseAgent initialized with ID: ${this.id}`);
  }
  
  /**
   * Get the underlying crewAI agent
   */
  getAgent(): Agent {
    return this.agent;
  }
  
  /**
   * Run a specific task with the agent
   */
  async runTask(taskDescription: string, context?: Record<string, any>): Promise<any> {
    logger.info(`Running task for agent ${this.config.id}: ${taskDescription}`);
    
    try {
      // Execute the agent with the task and context
      const result = await this.agent.execute({
        task: taskDescription,
        context: context || {},
      });
      
      logger.debug(`Task result: ${result}`);
      return result;
    } catch (error) {
      logger.error(`Error running task: ${error}`);
      throw error;
    }
  }
  
  /**
   * Process a system event
   */
  async processEvent(eventType: string, eventData: any): Promise<void> {
    logger.info(`Processing event of type ${eventType} for agent ${this.config.id}`);
    
    try {
      // Process the event based on its type
      switch (eventType) {
        case 'material_added':
          await this.handleMaterialAdded(eventData);
          break;
          
        case 'material_updated':
          await this.handleMaterialUpdated(eventData);
          break;
          
        case 'material_deleted':
          await this.handleMaterialDeleted(eventData);
          break;
          
        case 'search_index_updated':
          await this.handleSearchIndexUpdated(eventData);
          break;
          
        default:
          logger.warn(`Unknown event type: ${eventType}`);
      }
    } catch (error) {
      logger.error(`Error processing event: ${error}`);
    }
  }
  
  /**
   * Handle a material added event
   */
  private async handleMaterialAdded(data: any): Promise<void> {
    logger.info(`Processing material added event for material ID: ${data.id}`);
    
    // Execute the agent with a material analysis task
    await this.agent.execute({
      task: 'Analyze the newly added material and suggest metadata improvements or relationships to existing materials',
      context: {
        eventType: 'material_added',
        material: data,
      },
    });
  }
  
  /**
   * Handle a material updated event
   */
  private async handleMaterialUpdated(data: any): Promise<void> {
    logger.info(`Processing material updated event for material ID: ${data.id}`);
    
    // Execute the agent with a change analysis task
    await this.agent.execute({
      task: 'Analyze the changes to the material and assess the impact on relationships and search quality',
      context: {
        eventType: 'material_updated',
        material: data.current,
        previousVersion: data.previous,
        changedFields: data.changedFields,
      },
    });
  }
  
  /**
   * Handle a material deleted event
   */
  private async handleMaterialDeleted(data: any): Promise<void> {
    logger.info(`Processing material deleted event for material ID: ${data.id}`);
    
    // Execute the agent with a deletion impact analysis task
    await this.agent.execute({
      task: 'Analyze the impact of the material deletion on related materials and suggest adjustments',
      context: {
        eventType: 'material_deleted',
        materialId: data.id,
        materialType: data.type,
        relatedMaterialIds: data.relatedMaterialIds,
      },
    });
  }
  
  /**
   * Handle a search index updated event
   */
  private async handleSearchIndexUpdated(data: any): Promise<void> {
    logger.info(`Processing search index updated event for index: ${data.indexName}`);
    
    // Execute the agent with an index optimization task
    await this.agent.execute({
      task: 'Analyze the search index performance and suggest optimizations or improvements',
      context: {
        eventType: 'search_index_updated',
        indexName: data.indexName,
        indexType: data.indexType,
        stats: data.stats,
      },
    });
  }
  
  /**
   * Analyze quality issues in the knowledge base
   */
  async analyzeQualityIssues(options?: { 
    materialType?: string;
    severity?: 'low' | 'medium' | 'high';
    limit?: number;
  }): Promise<any> {
    logger.info(`Analyzing quality issues for agent ${this.config.id}`);
    
    try {
      // Execute the agent with a quality analysis task
      const result = await this.agent.execute({
        task: 'Identify and analyze quality issues in the knowledge base materials',
        context: {
          options: options || {},
        },
      });
      
      return JSON.parse(result);
    } catch (error) {
      logger.error(`Error analyzing quality issues: ${error}`);
      throw error;
    }
  }
  
  /**
   * Generate statistics and insights about the knowledge base
   */
  async generateInsights(): Promise<any> {
    logger.info(`Generating knowledge base insights for agent ${this.config.id}`);
    
    try {
      // Execute the agent with an insights generation task
      const result = await this.agent.execute({
        task: 'Analyze the knowledge base and generate insights about content, quality, and usage patterns',
        context: {},
      });
      
      return JSON.parse(result);
    } catch (error) {
      logger.error(`Error generating insights: ${error}`);
      throw error;
    }
  }
  
  /**
   * Answer a natural language query about the knowledge base
   */
  async answerQuery(query: string): Promise<string> {
    logger.info(`Answering query for agent ${this.config.id}: "${query}"`);
    
    try {
      // Execute the agent with a query answering task
      const result = await this.agent.execute({
        task: `Answer the following query about the knowledge base: "${query}"`,
        context: {
          query,
        },
      });
      
      return result;
    } catch (error) {
      logger.error(`Error answering query: ${error}`);
      return `Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}

/**
 * Create a Knowledge Base Agent
 */
export async function createKnowledgeBaseAgent(
  config: AgentConfig,
  modelSettings: { provider: string; name: string; temperature: number }
): Promise<KnowledgeBaseAgent> {
  logger.info(`Creating Knowledge Base Agent with ID: ${config.id}`);
  
  // Create specialized tools for the knowledge base agent
  const tools: Tool[] = [
    await createMaterialSearchTool(),
    await createVectorSearchTool(),
    // Additional tools would be added here in a real implementation
  ];
  
  // Agent description for defining capabilities and behavior
  const agentDescription = `
    You are a Knowledge Base Agent that monitors and enhances the KAI material knowledge base.
    Your primary responsibilities include:
    
    1. Analyzing materials to ensure data quality and completeness
    2. Identifying relationships between materials
    3. Suggesting metadata improvements
    4. Monitoring search index performance
    5. Generating insights about the knowledge base
    
    You have access to the KAI platform's material database, search capabilities,
    and metadata systems. You should provide detailed analysis and actionable
    recommendations to improve the knowledge base.
  `;
  
  // Create the crewAI agent
  const agent = new Agent({
    name: 'Knowledge Base Expert',
    role: 'Knowledge Base Expert',
    goal: 'Maintain and enhance the quality and value of the material knowledge base',
    backstory: 'You are an AI assistant specialized in knowledge management and material science. You help ensure the KAI knowledge base contains high-quality, well-structured information about materials.',
    verbose: true,
    allowDelegation: false,
    tools,
    llm: {
      model: modelSettings.name,
      temperature: modelSettings.temperature,
    },
  });
  
  // Create and return the Knowledge Base Agent
  return new KnowledgeBaseAgent(agent, config);
}

export default {
  createKnowledgeBaseAgent,
  KnowledgeBaseAgent,
};