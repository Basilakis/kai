/**
 * Core types for the KAI crewAI integration
 */

import { Agent as CrewAIAgent } from 'crewai';

/**
 * Supported agent types
 */
export enum AgentType {
  // Frontend user-facing agents
  RECOGNITION = 'recognition',
  MATERIAL_EXPERT = 'material_expert',
  PROJECT_ASSISTANT = 'project_assistant',
  
  // Backend system agents
  KNOWLEDGE_BASE = 'knowledge_base',
  ANALYTICS = 'analytics',
  OPERATIONS = 'operations',
}

/**
 * Base configuration for all agents
 */
export interface AgentConfig {
  /** Unique identifier for the agent */
  id: string;
  
  /** Type of agent to create */
  type: AgentType;
  
  /** Optional name for the agent */
  name?: string;
  
  /** Agent description */
  description?: string;
  
  /** Memory configuration */
  memory?: {
    /** Whether the agent should use persistent memory */
    persistent: boolean;
    
    /** Memory TTL in seconds (default: 24 hours) */
    ttl?: number;
  };
  
  /** Model configuration */
  model?: {
    /** Model provider (default: OpenAI) */
    provider?: 'openai' | 'azure' | 'anthropic' | 'local';
    
    /** Model name */
    name?: string;
    
    /** Temperature setting (0-1) */
    temperature?: number;
  };
  
  /** Additional tools to provide to the agent */
  additionalTools?: any[];
  
  /** Enable verbose logging for the agent */
  verbose?: boolean;
  
  /** Large language model configuration */
  llm?: any;
  
  /** Additional agent-specific settings */
  settings?: Record<string, any>;
}

/**
 * Interface for frontend user-facing agents
 */
export interface UserFacingAgent {
  /** Unique identifier for the agent */
  id: string;
  
  /** Type of agent */
  type: AgentType;
  
  /** Agent name */
  name: string;
  
  /** Agent description */
  description: string;
  
  /** The underlying crewAI agent */
  agent: CrewAIAgent;
  
  /** Agent configuration */
  config: AgentConfig;
  
  /** Get the underlying crewAI agent */
  getAgent(): CrewAIAgent;
  
  /** Process a user input and generate a response */
  processUserInput(input: string, context?: Record<string, any>): Promise<string>;
  
  /** Process an uploaded image and provide insights */
  processImage?(imageUrl: string, metadata?: Record<string, any>): Promise<string>;
}

/**
 * Interface for backend system agents
 */
export interface SystemAgent {
  /** Unique identifier for the agent */
  id: string;
  
  /** Type of agent */
  type: AgentType;
  
  /** Agent name */
  name: string;
  
  /** Agent description */
  description: string;
  
  /** The underlying crewAI agent */
  agent: CrewAIAgent;
  
  /** Agent configuration */
  config: AgentConfig;
  
  /** Get the underlying crewAI agent */
  getAgent(): CrewAIAgent;
  
  /** Run the agent with a specific task */
  runTask(taskDescription: string, context?: Record<string, any>): Promise<any>;
  
  /** Process system events */
  processEvent(eventType: string, eventData: any): Promise<void>;
}

/**
 * Agent creation result
 */
export interface AgentCreationResult {
  /** Unique identifier for the agent */
  id: string;
  
  /** Type of the created agent */
  type: AgentType;
  
  /** Instance of the created agent */
  instance: UserFacingAgent | SystemAgent;
  
  /** Timestamp of creation */
  createdAt: Date;
}