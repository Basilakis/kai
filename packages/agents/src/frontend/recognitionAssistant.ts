/**
 * Recognition Assistant Agent
 * 
 * An agent that enhances the image upload and recognition process by providing
 * guidance, analysis, and recommendations based on recognition results.
 */

import { Agent, Tool } from 'crewai';
import { AgentConfig, AgentType, UserFacingAgent } from '../core/types';
import { createLogger } from '../utils/logger';

// Import KAI-specific tools and utilities
import { createMaterialSearchTool } from '../tools/materialSearch';
import { createImageAnalysisTool } from '../tools/imageAnalysis';
import { createVectorSearchTool } from '../tools/vectorSearch';

// Logger instance
const logger = createLogger('RecognitionAssistant');

/**
 * Recognition Assistant class
 * Provides enhanced capabilities for material recognition workflow
 */
export class RecognitionAssistant implements UserFacingAgent {
  public id: string;
  public type: AgentType;
  public name: string;
  public description: string;
  public agent: Agent;
  public config: AgentConfig;
  
  constructor(agent: Agent, config: AgentConfig) {
    this.id = config.id || `recognition-assistant-${Date.now()}`;
    this.type = AgentType.RECOGNITION;
    this.name = 'Recognition Assistant';
    this.description = 'AI assistant for material recognition and analysis';
    this.agent = agent;
    this.config = config;
    logger.info(`RecognitionAssistant initialized with ID: ${this.id}`);
  }
  
  /**
   * Get the underlying crewAI agent
   */
  public getAgent(): Agent {
    return this.agent;
  }
  
  /**
   * Process user input and generate a response
   * 
   * @param input The user's text input
   * @param context Optional context about the current interaction
   * @returns Promise resolving to the agent's response
   */
  public async processUserInput(input: string, context?: Record<string, any>): Promise<string> {
    logger.info(`Processing user input for agent ${this.id}`);
    
    try {
      // Execute the agent with the user's input and context
      const result = await this.agent.execute({
        task: `Respond to the user's question or request: "${input}"`,
        context: context || {},
      });
      
      logger.debug(`Recognition agent response for "${input}": ${result}`);
      return result;
    } catch (error) {
      logger.error(`Error processing user input: ${error}`);
      return 'I encountered an error while processing your request. Please try again.';
    }
  }
  
  /**
   * Process an uploaded image and provide insights
   */
  async processImage(imageUrl: string, metadata?: Record<string, any>): Promise<string> {
    logger.info(`Processing image for agent ${this.config.id}: ${imageUrl}`);
    
    try {
      // Prepare the context with image URL and metadata
      const context = {
        imageUrl,
        ...metadata,
      };
      
      // Execute the agent with image processing task
      const result = await this.agent.execute({
        task: 'Analyze the provided image and identify potential materials. Provide detailed insights about the recognized materials.',
        context,
      });
      
      logger.debug(`Image analysis result: ${result}`);
      return result;
    } catch (error) {
      logger.error(`Error processing image: ${error}`);
      return 'I encountered an error while analyzing the image. Please try again.';
    }
  }
  
  /**
   * Provide detailed analysis of recognition results
   */
  async analyzeRecognitionResults(results: any[], context?: Record<string, any>): Promise<string> {
    logger.info(`Analyzing recognition results for agent ${this.config.id}`);
    
    try {
      // Prepare context with recognition results
      const analysisContext = {
        recognitionResults: results,
        ...context,
      };
      
      // Execute the agent with analysis task
      const analysis = await this.agent.execute({
        task: 'Analyze the material recognition results and provide detailed insights, comparisons, and recommendations.',
        context: analysisContext,
      });
      
      logger.debug(`Recognition results analysis: ${analysis}`);
      return analysis;
    } catch (error) {
      logger.error(`Error analyzing recognition results: ${error}`);
      return 'I encountered an error while analyzing the recognition results.';
    }
  }
  
  /**
   * Suggest improvements for image quality to enhance recognition
   */
  async suggestImageImprovements(imageUrl: string, issues: string[]): Promise<string> {
    logger.info(`Suggesting image improvements for agent ${this.config.id}`);
    
    try {
      // Prepare context with image URL and identified issues
      const context = {
        imageUrl,
        identifiedIssues: issues,
      };
      
      // Execute the agent with improvement suggestion task
      const suggestions = await this.agent.execute({
        task: 'Suggest specific improvements for the image to enhance recognition accuracy.',
        context,
      });
      
      logger.debug(`Image improvement suggestions: ${suggestions}`);
      return suggestions;
    } catch (error) {
      logger.error(`Error suggesting image improvements: ${error}`);
      return 'I encountered an error while generating improvement suggestions.';
    }
  }
}

/**
 * Create a Recognition Assistant agent
 */
export async function createRecognitionAssistant(
  config: AgentConfig,
  modelSettings: { provider: string; name: string; temperature: number }
): Promise<RecognitionAssistant> {
  logger.info(`Creating Recognition Assistant with ID: ${config.id}`);
  
  // Create specialized tools for the recognition assistant
  const tools: Tool[] = [
    await createMaterialSearchTool(),
    await createImageAnalysisTool(),
    await createVectorSearchTool(),
  ];
  
  // Agent description for defining capabilities and behavior
  const agentDescription = `
    You are a Material Recognition Assistant that helps users identify and analyze tiles and materials.
    Your primary responsibility is to enhance the image recognition process by:
    
    1. Providing guidance for capturing optimal images of materials
    2. Analyzing recognition results and offering detailed insights
    3. Explaining material properties, applications, and characteristics
    4. Comparing similar materials and highlighting key differences
    5. Suggesting alternative materials when appropriate
    
    You have access to the KAI platform's material database and recognition systems.
    You should always provide helpful, detailed responses that educate the user
    about materials while maintaining a professional, supportive tone.
  `;
  
  // Create the crewAI agent
  const agent = new Agent({
    name: 'Material Recognition Assistant',
    role: 'Material Recognition Expert',
    goal: 'Provide accurate, helpful information about materials and guide users through the recognition process',
    backstory: 'You are an AI assistant with extensive knowledge of construction materials, especially tiles. You help users identify and learn about materials by analyzing images and providing detailed information.',
    verbose: true,
    allowDelegation: false,
    tools,
    llm: {
      model: modelSettings.name,
      temperature: modelSettings.temperature,
    },
  });
  
  // Create and return the Recognition Assistant
  return new RecognitionAssistant(agent, config);
}

export default {
  createRecognitionAssistant,
  RecognitionAssistant,
};