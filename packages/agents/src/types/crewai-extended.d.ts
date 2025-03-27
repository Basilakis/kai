/**
 * Extended type declarations for crewAI
 * 
 * This file extends the basic crewAI types to accommodate our custom usage patterns
 * and resolve type compatibility issues.
 */

declare module 'crewai' {
  // Main crewAI exports
  export class Agent {
    constructor(options: AgentOptions);
    execute(task: TaskInput): Promise<string>;
  }

  export class Crew {
    constructor(options: CrewOptions);
    kickoff(): Promise<string[]>;
  }

  export class Task {
    constructor(options: TaskOptions);
  }

  export class Tool {
    constructor(options: ToolOptions);
  }

  // Agent types
  export interface AgentOptions {
    // Core properties from crewAI
    name?: string;
    goal: string;
    backstory: string;
    verbose?: boolean;
    allowDelegation?: boolean;
    llm?: any;
    tools?: Tool[];
    memory?: boolean;
    
    // Extended properties for our implementation
    role?: string;  // Add role property which our code uses
  }

  // Task types
  export interface TaskOptions {
    description: string;
    expected_output?: string;
    agent?: Agent;
    async_execution?: boolean;
    tools?: Tool[];
    context?: TaskContext;
    callback?: (result: string) => void;
  }

  // Make context accept either string, string[] or Record<string, any>
  export type TaskContext = string | string[] | Record<string, any>;

  // For direct task execution without creating a Task instance
  export interface TaskInput {
    task: string;
    context?: TaskContext;
  }

  // Tool types
  export interface ToolOptions {
    name: string;
    description: string;
    func: (...args: any[]) => Promise<any> | any;
  }

  // Crew types
  export interface CrewOptions {
    agents: Agent[];
    tasks: Task[];
    verbose?: boolean;
    process?: string;
    memory?: boolean;
    maxWorkers?: number;
    maxConcurrentTasks?: number;
    stepCallback?: (step: CrewStep) => void;
  }

  export interface CrewStep {
    agentName: string;
    taskDescription: string;
    output: string;
  }
}