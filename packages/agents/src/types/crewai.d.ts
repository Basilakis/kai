/**
 * Type declarations for crewAI
 * 
 * This file provides TypeScript declarations for the crewAI package
 * used for implementing intelligent agents in the KAI platform.
 */

declare module 'crewai' {
  export interface AgentConfig {
    name: string;
    description?: string;
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
  }

  export class Agent {
    constructor(config: AgentConfig);
    
    id: string;
    name: string;
    description: string;
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
    
    execute(task: Task): Promise<string>;
    askLLM(task: Task, context?: string): Promise<string>;
    run(task: Task): Promise<string>;
  }

  export interface ToolConfig {
    name: string;
    description: string;
    func: (...args: any[]) => Promise<any> | any;
  }

  export class Tool {
    constructor(config: ToolConfig);
    
    name: string;
    description: string;
    func: (...args: any[]) => Promise<any> | any;
    
    call(args: any): Promise<any>;
  }

  export interface TaskConfig {
    description: string;
    expected_output?: string;
    agent?: Agent;
    async_execution?: boolean;
    tools?: Tool[];
    context?: string[] | string;
    callbacks?: any[];
  }

  export class Task {
    constructor(config: TaskConfig);
    
    description: string;
    expected_output: string;
    agent: Agent;
    async_execution: boolean;
    tools: Tool[];
    context: string[] | string;
    callbacks: any[];
    
    execute(): Promise<string>;
  }

  export interface CrewConfig {
    agents: Agent[];
    tasks: Task[];
    verbose?: boolean;
    process?: 'sequential' | 'hierarchical';
    maxConcurrency?: number;
    memory?: boolean;
    callbacks?: any[];
  }

  export class Crew {
    constructor(config: CrewConfig);
    
    agents: Agent[];
    tasks: Task[];
    verbose: boolean;
    process: 'sequential' | 'hierarchical';
    maxConcurrency: number;
    memory: boolean;
    callbacks: any[];
    
    kickoff(): Promise<string[]>;
  }
}