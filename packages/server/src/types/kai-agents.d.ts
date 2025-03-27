/**
 * Type definitions for @kai/agents package
 * 
 * This file provides TypeScript type definitions for the @kai/agents package,
 * enabling proper type checking and autocomplete in the server codebase while
 * the package is being developed.
 */

declare module '@kai/agents' {
  /**
   * Supported agent types in the KAI platform
   */
  export enum AgentType {
    RECOGNITION = 'recognition',
    MATERIAL_EXPERT = 'material',
    PROJECT_ASSISTANT = 'project',
    KNOWLEDGE_BASE = 'knowledge_base',
    ANALYTICS = 'analytics',
    OPERATIONS = 'operations'
  }

  /**
   * Configuration for the agent system
   */
  export interface AgentConfig {
    /** API key for OpenAI or other LLM provider */
    apiKey: string;
    
    /** Redis connection details for agent memory persistence */
    redis?: {
      host: string;
      port: number;
      password?: string;
      db?: number;
    };
    
    /** Default model configuration */
    defaultModel?: {
      provider: 'openai' | 'azure' | 'anthropic' | 'local';
      name: string;
      temperature: number;
    };
    
    /** Logging level */
    logLevel?: 'debug' | 'info' | 'warn' | 'error';
  }

  /**
   * Initialize the agent system with the provided configuration
   */
  export function initializeAgentSystem(config: AgentConfig): Promise<void>;

  /**
   * Base interface for all agents in the system
   */
  export interface Agent {
    id: string;
    type: AgentType;
    name: string;
    description: string;
  }

  /**
   * User-facing agent that interacts with frontend users
   */
  export interface UserFacingAgent extends Agent {
    getAgent(): any;
    processUserInput(input: string): Promise<string>;
  }

  /**
   * System agent that performs backend operations
   */
  export interface SystemAgent extends Agent {
    getAgent(): any;
    runTask(task: string): Promise<string>;
    processEvent(eventType: string, eventData: any): Promise<void>;
  }

  // Frontend agent exports
  export class RecognitionAssistant implements UserFacingAgent {
    id: string;
    type: AgentType;
    name: string;
    description: string;
    getAgent(): any;
    processUserInput(input: string): Promise<string>;
  }

  export class MaterialExpert implements UserFacingAgent {
    id: string;
    type: AgentType;
    name: string;
    description: string;
    getAgent(): any;
    processUserInput(input: string): Promise<string>;
  }

  export class ProjectAssistant implements UserFacingAgent {
    id: string;
    type: AgentType;
    name: string;
    description: string;
    getAgent(): any;
    processUserInput(input: string): Promise<string>;
  }

  // Backend agent exports
  export class KnowledgeBaseAgent implements SystemAgent {
    id: string;
    type: AgentType;
    name: string;
    description: string;
    getAgent(): any;
    runTask(task: string): Promise<string>;
    processEvent(eventType: string, eventData: any): Promise<void>;
  }

  export class AnalyticsAgent implements SystemAgent {
    id: string;
    type: AgentType;
    name: string;
    description: string;
    getAgent(): any;
    runTask(task: string): Promise<string>;
    processEvent(eventType: string, eventData: any): Promise<void>;
  }

  export class OperationsAgent implements SystemAgent {
    id: string;
    type: AgentType;
    name: string;
    description: string;
    getAgent(): any;
    runTask(task: string): Promise<string>;
    processEvent(eventType: string, eventData: any): Promise<void>;
  }
}