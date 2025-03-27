/**
 * Extended crewAI Type Definitions
 * 
 * This file provides extended type definitions for crewAI to make it
 * compatible with our implementation patterns.
 */

// Import the base types from crewAI
import { Agent, AgentConfig, Task } from 'crewai';

/**
 * Extended Agent Configuration
 * Adds additional properties supported by our implementation
 */
export interface ExtendedAgentConfig extends AgentConfig {
  // Additional properties our implementation uses
  role?: string;
  id?: string;
  model?: {
    provider?: string;
    name?: string;
    temperature?: number;
  };
  llm?: any;
  additionalTools?: any[];
  verbose?: boolean;
}

/**
 * Extended Task Type
 * Used for task parameters that accept object contexts
 */
export interface ExtendedTaskExecution {
  task: string | Task;
  context?: string | string[] | Record<string, any>;
}

/**
 * Patch the Agent's execute method to accept our extended parameters
 */
declare module 'crewai' {
  interface Agent {
    execute(params: string | Task | ExtendedTaskExecution): Promise<string>;
  }

  // Add our extended properties to the constructor options
  interface AgentConfig {
    name: string; // Name is required by crewAI
    role?: string;
    goal?: string;
    backstory?: string;
    id?: string;
    model?: {
      provider?: string;
      name?: string;
      temperature?: number;
    };
    llm?: any;
    additionalTools?: any[];
    verbose?: boolean;
    allowDelegation?: boolean;
  }
}

// Export the base types along with our extended interfaces
export { Agent, AgentConfig, Task };