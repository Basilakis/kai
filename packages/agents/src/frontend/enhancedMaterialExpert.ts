/**
 * Enhanced Material Expert Agent
 * 
 * An improved version of the MaterialExpert that ensures comprehensive
 * material metadata is included in all responses.
 * 
 * This version extends the BaseMaterialExpert class while adding
 * specialized metadata processing functionality.
 */

import { Agent } from 'crewai';
import { createLogger } from '../utils/logger';
import { AgentConfig } from '../core/types';
import { BaseMaterialExpert, createMaterialExpertAgentConfig } from './base/BaseMaterialExpert';
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
export class EnhancedMaterialExpert extends BaseMaterialExpert {
  /**
   * Create a new EnhancedMaterialExpert instance
   */
  constructor(config: AgentConfig, agent: Agent) {
    super(config, agent);
    logger.info(`EnhancedMaterialExpert instantiated with ID: ${this.id}`);
  }
  
  /**
   * Override processResult to enhance the response with metadata formatting
   * 
   * This method processes the raw result to ensure that any mentioned materials
   * include comprehensive metadata information
   */
  protected override processResult(response: string, originalQuery: string): string {
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
): Promise<EnhancedMaterialExpert> {
  logger.info('Creating EnhancedMaterialExpert agent');
  
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
  
  // Create enhanced agent config with metadata instructions
  const enhancedModelSettings = {
    ...modelSettings,
    // Add any enhanced model settings here
  };
  
  // Create a customized agent config with enhanced role and instructions
  const enhancedConfig = {
    ...config,
    name: config.name || 'Enhanced Material Expert',
    description: config.description || 'Expert in construction materials with comprehensive metadata formatting',
    role: `Construction material specialist with deep knowledge of materials and their properties. ${materialMetadataInstructions}`,
    goal: 'Provide accurate and detailed information about construction materials to help users make informed decisions, always including comprehensive metadata for each material.',
    backstory: 'With years of experience in material science and construction, I can identify materials, explain their properties, and recommend the best options for specific applications. I always provide comprehensive metadata for all materials I discuss.'
  };
  
  // Use the shared configuration function from the base class with enhanced config
  const { agent } = createMaterialExpertAgentConfig(enhancedConfig, enhancedModelSettings);
  
  // Create and return the EnhancedMaterialExpert instance
  return new EnhancedMaterialExpert(config, agent);
}

export default {
  EnhancedMaterialExpert,
  createEnhancedMaterialExpert
};