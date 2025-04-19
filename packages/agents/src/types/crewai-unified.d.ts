/**
 * Unified CrewAI Type Definitions
 * 
 * This file consolidates all CrewAI-related type definitions into a single source of truth,
 * replacing the previously duplicated definitions across:
 * - packages/agents/src/types/crewai.d.ts
 * - packages/agents/src/types/crewai-extended.d.ts
 * - packages/agents/src/core/crewai-types.ts
 */

declare module 'crewai' {
  // Main crewAI classes
  export class Agent {
    constructor(options: AgentConfig);
    
    id: string;
    name: string;
    description: string;
    role?: string;
    goal: string;
    backstory: string;
    verbose: boolean;
    allowDelegation: boolean;
    memory: boolean;
    llm: any;
    maxIterations: number;
    maxExecutionTime: number;
    callbacks: any[];
    tools: Tool[];
    
    execute(task: Task | string | TaskExecution): Promise<string>;
    askLLM(task: Task, context?: string): Promise<string>;
    run(task: Task): Promise<string>;
  }

  export class Crew {
    constructor(options: CrewConfig);
    
    agents: Agent[];
    tasks: Task[];
    verbose: boolean;
    process: 'sequential' | 'hierarchical';
    maxConcurrency: number;
    memory: boolean;
    callbacks: any[];
    
    kickoff(): Promise<string[]>;
  }

  export class Task {
    constructor(options: TaskConfig);
    
    description: string;
    expected_output: string;
    agent: Agent;
    async_execution: boolean;
    tools: Tool[];
    context: string[] | string | Record<string, any>;
    callbacks: any[];
    
    execute(): Promise<string>;
  }

  export class Tool {
    constructor(options: ToolConfig);
    
    name: string;
    description: string;
    func: (...args: any[]) => Promise<any> | any;
    
    call(args: any): Promise<any>;
  }

  // Configuration interfaces
  export interface AgentConfig {
    name: string;
    description?: string;
    role?: string;
    goal?: string;
    backstory?: string;
    verbose?: boolean;
    allowDelegation?: boolean;
    memory?: boolean;
    llm?: any; // LLM instance or configuration
    maxIterations?: number;
    maxExecutionTime?: number;
    callbacks?: any[];
    tools?: Tool[];
    additionalTools?: any[];
    id?: string;
    model?: {
      provider?: string;
      name?: string;
      temperature?: number;
    };
  }

  export interface TaskConfig {
    description: string;
    expected_output?: string;
    agent?: Agent;
    async_execution?: boolean;
    tools?: Tool[];
    context?: TaskContext;
    callbacks?: any[];
  }

  export interface ToolConfig {
    name: string;
    description: string;
    func: (...args: any[]) => Promise<any> | any;
  }

  export interface CrewConfig {
    agents: Agent[];
    tasks: Task[];
    verbose?: boolean;
    process?: 'sequential' | 'hierarchical';
    maxConcurrency?: number;
    maxWorkers?: number;
    memory?: boolean;
    callbacks?: any[];
    stepCallback?: (step: CrewStep) => void;
  }

  export interface CrewStep {
    agentName: string;
    taskDescription: string;
    output: string;
  }

  // Additional types for extended functionality
  export type TaskContext = string | string[] | Record<string, any>;

  export interface TaskExecution {
    task: string | Task;
    context?: TaskContext;
  }
}

// Export extended types that are used outside the module declaration
export interface ExtendedTaskExecution {
  task: string | import('crewai').Task;
  context?: string | string[] | Record<string, any>;
}

export interface ExtendedAgentConfig extends import('crewai').AgentConfig {
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

// Re-export the core types for convenience
import { Agent, AgentConfig, Task, Tool, TaskConfig, CrewConfig } from 'crewai';
export { Agent, AgentConfig, Task, Tool, TaskConfig, CrewConfig };