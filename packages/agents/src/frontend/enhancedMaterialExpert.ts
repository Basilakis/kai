/**
 * Enhanced Material Expert Agent
 * 
 * An improved version of the MaterialExpert that ensures comprehensive
 * material metadata is included in all responses.
 */

import { Agent, Task } from 'crewai';
import { createLogger } from '../utils/logger';
import { AgentConfig, AgentType, UserFacingAgent } from '../core/types';
import { createMaterialSearchTool } from '../tools/materialSearch';
import { createVectorSearchTool } from '../tools/vectorSearch';
import { 
  formatMaterialMetadata, 
  generateMaterialDescription,
  formatMaterialSearchResults
} from '../utils/materialMetadataFormatter';

// Logger instance
const logger = createLogger('EnhancedMaterialExpert');

/**
 * Enhanced Material Expert class that provides detailed information about materials
 * with comprehensive metadata formatting
 */
export class EnhancedMaterialExpert implements UserFacingAgent {
  // Required properties from UserFacingAgent interface
  public id: string;
  public type: AgentType;
  public name: string;
  public description: string;
  
  // Agent properties
  public agent: Agent;
  public config: AgentConfig;

  /**
   * Create a new EnhancedMaterialExpert instance
   */
  constructor(config: AgentConfig, agent: Agent) {
    this.id = config.id;
    this.type = AgentType.MATERIAL_EXPERT;
    this.name = config.name || 'Material Expert';
    this.description = config.description || 'Expert in construction materials and their properties';
    this.agent = agent;
    this.config = config;
    
    logger.info(`EnhancedMaterialExpert agent created with ID: ${this.id}`);
  }

  /**
   * Get the underlying crewAI agent
   */
  public getAgent(): Agent {
    return this.agent;
  }

  /**
   * Process a user input message and provide a response with comprehensive
   * material metadata
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
      const rawResult = await (this.agent as any).executeTask(task);
      logger.info('Task executed successfully');
      
      // Process the result to ensure material metadata is properly formatted
      const enhancedResult = this.enhanceResponseWithMetadata(rawResult, message);
      return enhancedResult;
    } catch (error) {
      logger.error(`Error processing user input: ${error}`);
      return "I'm sorry, I encountered an error while processing your question. Could you please try rephrasing it?";
    }
  }
  
  /**
   * Enhance the agent's response with formatted material metadata
   * 
   * This method processes the response to ensure that any mentioned materials
   * include comprehensive metadata information
   */
  private enhanceResponseWithMetadata(response: string, originalQuery: string): string {
    try {
      logger.debug('Enhancing response with comprehensive material metadata');
      
      // Check if the response contains JSON data (material search results)
      if (response.includes('"id":') && response.includes('"name":')) {
        try {
          // Try to parse JSON data in the response
          const jsonMatch = response.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const jsonData = JSON.parse(jsonMatch[0]);
            
            // Format material results if they exist
            if (jsonData.results && Array.isArray(jsonData.results)) {
              const formattedMaterials = formatMaterialSearchResults(jsonData.results);
              
              // Generate detailed descriptions for each material
              const materialDescriptions = formattedMaterials.map(material => 
                generateMaterialDescription(material)
              );
              
              // Replace the JSON data with formatted material descriptions
              return response.replace(
                jsonMatch[0], 
                `Here are the materials that match your query:\n\n${materialDescriptions.join('\n\n---\n\n')}`
              );
            }
            
            // Handle single material case
            if (jsonData.id && jsonData.name) {
              const formattedMaterial = formatMaterialMetadata(jsonData);
              const materialDescription = generateMaterialDescription(formattedMaterial);
              
              // Replace the JSON data with formatted material description
              return response.replace(jsonMatch[0], materialDescription);
            }
          }
        } catch (error) {
          logger.warn(`Error parsing JSON in response: ${error}`);
          // Continue with the original response if JSON parsing fails
        }
      }
      
      // If no JSON data found, return the original response
      return response;
    } catch (error) {
      logger.error(`Error enhancing response with metadata: ${error}`);
      return response; // Return original response on error
    }
  }
}

/**
 * Create an EnhancedMaterialExpert agent with the provided configuration
 */
export async function createEnhancedMaterialExpert(
  config: AgentConfig,
  modelSettings: any
): Promise<UserFacingAgent> {
  logger.info('Creating EnhancedMaterialExpert agent');
  
  // Create tools for the agent
  const tools = [
    await createMaterialSearchTool(),
    await createVectorSearchTool()
  ];
  
  if (config.additionalTools) {
    tools.push(...config.additionalTools);
  }
  
  // Detailed instructions for how to present material information
  const materialMetadataInstructions = `
IMPORTANT: When discussing materials, ALWAYS include comprehensive details about:
- What the material is (e.g., tile, wood, lighting)
- The specific name of the material (e.g., Blanco Beige, Nordic Oak)
- Available colors
- Available sizes/dimensions
- Finish options
- Technical specifications
- Manufacturer information

For example, instead of just saying "This tile would work well for your bathroom floor",
provide detailed information like: "Blanco Beige is a porcelain tile manufactured by 
CeramicWorks. It comes in White and Cream colors, available in sizes 12"x24", 24"x24", 
and 24"x48". It has a matte finish with R10 slip resistance rating, making it suitable 
for bathroom floors."

Always present material information in a clear, structured format that highlights
the key metadata properties available in our database.
`;
  
  // Create the crewAI agent with enhanced role, goal and backstory
  const agent = new Agent({
    name: config.name || 'Material Expert',
    role: `Construction material specialist with deep knowledge of materials and their properties. ${materialMetadataInstructions}`,
    goal: 'Provide accurate and detailed information about construction materials to help users make informed decisions, always including comprehensive metadata for each material.',
    backstory: 'With years of experience in material science and construction, I can identify materials, explain their properties, and recommend the best options for specific applications. I always provide comprehensive metadata for all materials I discuss.',
    verbose: config.verbose || false,
    llm: modelSettings,
    tools
  });
  
  // Create and return the EnhancedMaterialExpert instance
  return new EnhancedMaterialExpert(config, agent);
}

export default {
  EnhancedMaterialExpert,
  createEnhancedMaterialExpert
};