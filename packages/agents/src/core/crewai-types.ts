/**
 * CrewAI Type Definitions Exports
 * 
 * This file now imports and re-exports types from the unified CrewAI type definitions
 * instead of duplicating definitions. It maintains backward compatibility for any
 * code that imports from this file.
 */

// Import types from the unified definition file
import {
  Agent,
  AgentConfig,
  Task,
  ExtendedAgentConfig,
  ExtendedTaskExecution
} from '../types/crewai-unified';

// Re-export all the types for backward compatibility
export {
  Agent,
  AgentConfig,
  Task
};

// Use 'export type' for type-only exports when isolatedModules is enabled
export type { ExtendedAgentConfig, ExtendedTaskExecution };

/**
 * This file previously contained module augmentation for 'crewai'.
 * That has been moved to the unified type definition file at:
 * packages/agents/src/types/crewai-unified.d.ts
 * 
 * All extensions and additional properties are now defined there.
 */