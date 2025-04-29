/**
 * Base Material Expert Agent
 * 
 * This base class provides the common functionality for MaterialExpert implementations,
 * reducing duplication between the regular and enhanced versions.
 * 
 * Supports commands:
 * - /hybrid: Uses a combination of vector and text search for better results
 */

import { Agent, Task } from 'crewai';
import { createLogger } from '../../utils/logger';
import { AgentConfig, AgentType, UserFacingAgent } from '../../core/types';
import { createMaterialSearchTool } from '../../tools/materialSearch';
import { createVectorSearchTool } from '../../tools/vectorSearch';
import { getMaterialService } from '../../services/serviceFactory';
import * as vectorSearchAdapter from '../../services/adapters/vectorSearchMcpAdapter';

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
    
    // Check for command prefixes
    if (message.startsWith('/hybrid')) {
      return this.processHybridSearchCommand(message);
    }
    
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
  
  /**
   * Process a hybrid search command that combines vector and text search
   * 
   * @param message The message containing the hybrid search command
   * @returns The search results with explanation
   */
  protected async processHybridSearchCommand(message: string): Promise<string> {
    // Extract the query by removing the command prefix
    const query = message.substring('/hybrid'.length).trim();
    
    if (!query) {
      return "Please provide a search query after the /hybrid command. For example: `/hybrid white marble tile`";
    }
    
    logger.info(`Processing hybrid search for query: "${query}"`);
    
    try {
      // Get services
      const materialService = getMaterialService();
      
      // Define search weights
      const textWeight = 0.4;
      const vectorWeight = 0.6;
      
      // 1. Perform text search
      const textSearchParams = {
        query,
        limit: 20, // Get more results to allow for merging
        includeMetadata: true
      };
      
      const textResults = await materialService.searchMaterials(textSearchParams);
      logger.debug(`Text search returned ${textResults.results.length} results`);
      
      // 2. Perform vector search
      const vectorSearchParams = {
        query,
        limit: 20, // Get more results to allow for merging
        includeMetadata: true
      };
      
      const vectorResults = await vectorSearchAdapter.searchByVector(vectorSearchParams);
      logger.debug(`Vector search returned ${vectorResults.length} results`);
      
      // 3. Combine results with weighted scoring
      const combinedResults = this.combineSearchResults(
        textResults.results, 
        vectorResults, 
        textWeight, 
        vectorWeight
      );
      
      // 4. Format and return the results
      return this.formatHybridSearchResults(query, combinedResults);
    } catch (error) {
      logger.error(`Error in hybrid search: ${error}`);
      return `I encountered an error while performing the hybrid search: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
  
  /**
   * Combine text search and vector search results with weighted scoring
   * 
   * @param textResults Results from text search
   * @param vectorResults Results from vector search
   * @param textWeight Weight for text search scores (0.0 to 1.0)
   * @param vectorWeight Weight for vector search scores (0.0 to 1.0)
   * @returns Combined and sorted results
   */
  private combineSearchResults(
    textResults: any[], 
    vectorResults: any[], 
    textWeight: number, 
    vectorWeight: number
  ): any[] {
    // Create a map to store combined results by ID
    const resultsMap = new Map();
    
    // Process text search results
    textResults.forEach(item => {
      resultsMap.set(item.id, {
        ...item,
        textScore: item.score || 0,
        vectorScore: 0,
        combinedScore: (item.score || 0) * textWeight,
        matchedBy: 'text'
      });
    });
    
    // Process vector search results
    vectorResults.forEach(item => {
      if (resultsMap.has(item.id)) {
        // Update existing item with vector score
        const existingItem = resultsMap.get(item.id);
        existingItem.vectorScore = item.similarity || 0;
        existingItem.combinedScore = 
          (existingItem.textScore * textWeight) + 
          (existingItem.vectorScore * vectorWeight);
        existingItem.matchedBy = 'hybrid';
      } else {
        // Add new item
        resultsMap.set(item.id, {
          ...item,
          textScore: 0,
          vectorScore: item.similarity || 0,
          combinedScore: (item.similarity || 0) * vectorWeight,
          matchedBy: 'vector'
        });
      }
    });
    
    // Convert map to array and sort by combined score
    const combinedResults = Array.from(resultsMap.values())
      .sort((a, b) => b.combinedScore - a.combinedScore);
    
    // Take top 10 results
    return combinedResults.slice(0, 10);
  }
  
  /**
   * Format hybrid search results for display
   * 
   * @param query The original search query
   * @param results The combined search results
   * @returns Formatted results message
   */
  private formatHybridSearchResults(query: string, results: any[]): string {
    if (!results.length) {
      return `No materials were found matching your hybrid search query: "${query}". Please try different search terms.`;
    }
    
    let response = `Here are the top materials matching your hybrid search query: "${query}"\n\n`;
    
    // Add brief explanation of hybrid search
    response += "The results below used our hybrid search system, combining traditional keyword matching with semantic similarity for more accurate results.\n\n";
    
    // Format each result
    results.forEach((result, index) => {
      const matchMethod = result.matchedBy === 'hybrid' 
        ? 'both text and vector similarity' 
        : (result.matchedBy === 'vector' ? 'semantic similarity' : 'keyword matching');
      
      response += `${index + 1}. ${result.name} (${result.id})\n`;
      response += `   Manufacturer: ${result.manufacturer || 'Unknown'}\n`;
      
      if (result.metadata) {
        if (result.metadata.material) response += `   Material: ${result.metadata.material}\n`;
        if (result.metadata.color) response += `   Color: ${result.metadata.color}\n`;
        if (result.metadata.finish) response += `   Finish: ${result.metadata.finish}\n`;
        if (result.metadata.size) response += `   Size: ${result.metadata.size}\n`;
      }
      
      response += `   Match Score: ${(result.combinedScore * 100).toFixed(1)}%\n`;
      response += `   Found via: ${matchMethod}\n\n`;
    });
    
    response += "To search with regular mode, simply type your query without the /hybrid prefix.";
    
    return response;
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