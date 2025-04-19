/**
 * Material Expert Agent
 * 
 * A specialized agent that provides deep knowledge about construction materials,
 * their properties, applications, and compatibility with other materials.
 * 
 * This is a simplified implementation that extends the BaseMaterialExpert class.
 */

import { Agent } from 'crewai';
import { createLogger } from '../utils/logger';
import { AgentConfig, AgentType } from '../core/types';
import { BaseMaterialExpert, createMaterialExpertAgentConfig } from './base/BaseMaterialExpert';

// Logger instance
const logger = createLogger('MaterialExpert');

/**
 * Material Expert class that provides detailed information about materials
 */
export class MaterialExpert extends BaseMaterialExpert {
  /**
   * Create a new MaterialExpert instance
   */
  constructor(config: AgentConfig, agent: Agent) {
    super(config, agent);
    logger.info(`MaterialExpert instantiated with ID: ${this.id}`);
  }

  // No need to override processUserInput or other methods
  // as the base implementation provides the necessary functionality
}

/**
 * Create a MaterialExpert agent with the provided configuration
 */
export async function createMaterialExpert(
  config: AgentConfig,
  modelSettings: any
): Promise<MaterialExpert> {
  logger.info('Creating MaterialExpert agent');
  
  // Use the shared configuration function from the base class
  const { agent } = createMaterialExpertAgentConfig(config, modelSettings);
  
  // Create and return the MaterialExpert instance
  return new MaterialExpert(config, agent);
}

export default {
  MaterialExpert,
  createMaterialExpert
};