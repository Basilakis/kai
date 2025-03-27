#!/bin/bash

# Setup script for KAI crewAI integration
# This script installs dependencies, creates required directories,
# and sets up the environment for the crewAI agent system.

echo "🤖 Setting up KAI crewAI integration..."

# Create necessary directories
mkdir -p logs

# Install agent dependencies
echo "📦 Installing agent dependencies..."
cd ../
yarn add crewai redis winston winston-daily-rotate-file @types/node

# Install client dependencies (if this script is run from the root)
echo "📦 Installing client UI dependencies..."
cd ../client
yarn add @emotion/styled @emotion/react react-dropzone

# Create placeholders for missing files
echo "📄 Creating any missing module files..."
cd ../agents/src

# Ensure directories exist
mkdir -p frontend backend tools utils core

# Create missing frontend agent files if they don't exist
if [ ! -f "frontend/materialExpert.ts" ]; then
    echo "Creating placeholder for materialExpert.ts..."
    cat > frontend/materialExpert.ts << EOF
/**
 * Material Expert Agent
 * 
 * Provides detailed information about construction materials,
 * their properties, applications, and maintenance requirements.
 */

import { Agent, Tool } from 'crewai';
import { AgentConfig, AgentType, UserFacingAgent } from '../core/types';
import { createLogger } from '../utils/logger';

// Logger instance
const logger = createLogger('MaterialExpert');

/**
 * Material Expert agent class
 */
export class MaterialExpert implements UserFacingAgent {
  id: string;
  type: AgentType;
  name: string;
  description: string;
  agent: Agent;
  config: AgentConfig;
  
  constructor(
    id: string,
    agent: Agent,
    config: AgentConfig
  ) {
    this.id = id;
    this.type = AgentType.MATERIAL_EXPERT;
    this.name = 'Material Expert';
    this.description = 'Provides detailed information about construction materials';
    this.agent = agent;
    this.config = config;
    
    logger.info(\`Created MaterialExpert agent with ID: \${id}\`);
  }
  
  /**
   * Get the underlying crewAI agent
   */
  getAgent(): Agent {
    return this.agent;
  }
  
  /**
   * Process a user input and generate a response
   */
  async processUserInput(input: string): Promise<string> {
    logger.info(\`Processing user input: "\${input}"\`);
    
    try {
      // In a real implementation, this would run the agent with the input
      // For the current implementation, we'll return a placeholder
      return \`I'm the Material Expert agent. You asked: "\${input}". I'm still being implemented, but I'll be able to provide detailed information about construction materials soon.\`;
    } catch (error) {
      logger.error(\`Error processing input: \${error}\`);
      return 'I encountered an error while processing your request. Please try again.';
    }
  }
  
  /**
   * Run a specific task with this agent
   */
  async runTask(task: string): Promise<string> {
    logger.info(\`Running task: "\${task}"\`);
    
    try {
      // In a real implementation, this would execute the task with the agent
      // For the current implementation, we'll return a placeholder
      return \`I'll help with the task: "\${task}". I'm specialized in providing information about construction materials.\`;
    } catch (error) {
      logger.error(\`Error running task: \${error}\`);
      return 'I encountered an error while running this task. Please try again.';
    }
  }
}

/**
 * Create a Material Expert agent
 */
export async function createMaterialExpert(config: AgentConfig): Promise<UserFacingAgent> {
  logger.info('Creating Material Expert agent');
  
  // Create the tools for this agent
  const tools: Tool[] = [
    // In a real implementation, we would add specialized material-related tools
  ];
  
  // Add any additional tools from the config
  if (config.additionalTools) {
    tools.push(...config.additionalTools);
  }
  
  // Create the crewAI agent
  const agent = new Agent({
    name: 'Material Expert',
    goal: 'Provide detailed information about construction materials, properties, and best practices',
    backstory: 'I am an expert in construction materials with extensive knowledge of their properties, applications, and maintenance requirements.',
    verbose: config.verbose || false,
    tools: tools,
    llm: config.llm
  });
  
  // Create and return the MaterialExpert agent
  return new MaterialExpert(
    \`material-expert-\${Date.now()}\`,
    agent,
    config
  );
}
EOF
fi

if [ ! -f "frontend/projectAssistant.ts" ]; then
    echo "Creating placeholder for projectAssistant.ts..."
    cat > frontend/projectAssistant.ts << EOF
/**
 * Project Assistant Agent
 * 
 * Helps organize materials into projects, recommend materials,
 * calculate quantities, and provide project-specific recommendations.
 */

import { Agent, Tool } from 'crewai';
import { AgentConfig, AgentType, UserFacingAgent } from '../core/types';
import { createLogger } from '../utils/logger';

// Logger instance
const logger = createLogger('ProjectAssistant');

/**
 * Project Assistant agent class
 */
export class ProjectAssistant implements UserFacingAgent {
  id: string;
  type: AgentType;
  name: string;
  description: string;
  agent: Agent;
  config: AgentConfig;
  
  constructor(
    id: string,
    agent: Agent,
    config: AgentConfig
  ) {
    this.id = id;
    this.type = AgentType.PROJECT_ASSISTANT;
    this.name = 'Project Assistant';
    this.description = 'Helps with project planning and material organization';
    this.agent = agent;
    this.config = config;
    
    logger.info(\`Created ProjectAssistant agent with ID: \${id}\`);
  }
  
  /**
   * Get the underlying crewAI agent
   */
  getAgent(): Agent {
    return this.agent;
  }
  
  /**
   * Process a user input and generate a response
   */
  async processUserInput(input: string): Promise<string> {
    logger.info(\`Processing user input: "\${input}"\`);
    
    try {
      // In a real implementation, this would run the agent with the input
      // For the current implementation, we'll return a placeholder
      return \`I'm the Project Assistant agent. You asked: "\${input}". I'm still being implemented, but I'll be able to help with project planning and material organization soon.\`;
    } catch (error) {
      logger.error(\`Error processing input: \${error}\`);
      return 'I encountered an error while processing your request. Please try again.';
    }
  }
  
  /**
   * Run a specific task with this agent
   */
  async runTask(task: string): Promise<string> {
    logger.info(\`Running task: "\${task}"\`);
    
    try {
      // In a real implementation, this would execute the task with the agent
      // For the current implementation, we'll return a placeholder
      return \`I'll help with the task: "\${task}". I'm specialized in project planning and material organization.\`;
    } catch (error) {
      logger.error(\`Error running task: \${error}\`);
      return 'I encountered an error while running this task. Please try again.';
    }
  }
}

/**
 * Create a Project Assistant agent
 */
export async function createProjectAssistant(config: AgentConfig): Promise<UserFacingAgent> {
  logger.info('Creating Project Assistant agent');
  
  // Create the tools for this agent
  const tools: Tool[] = [
    // In a real implementation, we would add specialized project-related tools
  ];
  
  // Add any additional tools from the config
  if (config.additionalTools) {
    tools.push(...config.additionalTools);
  }
  
  // Create the crewAI agent
  const agent = new Agent({
    name: 'Project Assistant',
    goal: 'Help organize materials into projects and provide project-specific recommendations',
    backstory: 'I am a project planning assistant with expertise in organizing materials, calculating quantities, and optimizing project resources.',
    verbose: config.verbose || false,
    tools: tools,
    llm: config.llm
  });
  
  // Create and return the ProjectAssistant agent
  return new ProjectAssistant(
    \`project-assistant-\${Date.now()}\`,
    agent,
    config
  );
}
EOF
fi

# Create missing backend agent files if they don't exist
if [ ! -f "backend/analyticsAgent.ts" ]; then
    echo "Creating placeholder for analyticsAgent.ts..."
    cat > backend/analyticsAgent.ts << EOF
/**
 * Analytics Agent
 * 
 * Processes system metrics, user behaviors, and usage patterns,
 * and generating insights for administrators.
 */

import { Agent, Tool } from 'crewai';
import { AgentConfig, AgentType, SystemAgent } from '../core/types';
import { createLogger } from '../utils/logger';

// Logger instance
const logger = createLogger('AnalyticsAgent');

/**
 * Analytics agent class
 */
export class AnalyticsAgent implements SystemAgent {
  id: string;
  type: AgentType;
  name: string;
  description: string;
  agent: Agent;
  config: AgentConfig;
  
  constructor(
    id: string,
    agent: Agent,
    config: AgentConfig
  ) {
    this.id = id;
    this.type = AgentType.ANALYTICS;
    this.name = 'Analytics Agent';
    this.description = 'Analyzes system data and generates insights';
    this.agent = agent;
    this.config = config;
    
    logger.info(\`Created AnalyticsAgent with ID: \${id}\`);
  }
  
  /**
   * Get the underlying crewAI agent
   */
  getAgent(): Agent {
    return this.agent;
  }
  
  /**
   * Run a specific task with this agent
   */
  async runTask(task: string): Promise<string> {
    logger.info(\`Running task: "\${task}"\`);
    
    try {
      // In a real implementation, this would execute the task with the agent
      // For the current implementation, we'll return a placeholder
      return \`I'll analyze the data for the task: "\${task}". I'm specialized in processing system metrics and user behaviors.\`;
    } catch (error) {
      logger.error(\`Error running task: \${error}\`);
      return 'I encountered an error while running this task. Please try again.';
    }
  }
  
  /**
   * Process a system event
   */
  async processEvent(eventType: string, eventData: any): Promise<void> {
    logger.info(\`Processing event: \${eventType}\`);
    
    try {
      // In a real implementation, this would process the event with the agent
      logger.debug(\`Event data: \${JSON.stringify(eventData)}\`);
      
      // For now, we just log the event
      logger.info(\`Processed event: \${eventType}\`);
    } catch (error) {
      logger.error(\`Error processing event: \${error}\`);
    }
  }
}

/**
 * Create an Analytics agent
 */
export async function createAnalyticsAgent(config: AgentConfig): Promise<SystemAgent> {
  logger.info('Creating Analytics agent');
  
  // Create the tools for this agent
  const tools: Tool[] = [
    // In a real implementation, we would add specialized analytics tools
  ];
  
  // Add any additional tools from the config
  if (config.additionalTools) {
    tools.push(...config.additionalTools);
  }
  
  // Create the crewAI agent
  const agent = new Agent({
    name: 'Analytics Agent',
    goal: 'Analyze system metrics and user behaviors to generate actionable insights',
    backstory: 'I am an analytics specialist who excels at processing data, identifying patterns, and generating insights.',
    verbose: config.verbose || false,
    tools: tools,
    llm: config.llm
  });
  
  // Create and return the AnalyticsAgent
  return new AnalyticsAgent(
    \`analytics-agent-\${Date.now()}\`,
    agent,
    config
  );
}
EOF
fi

if [ ! -f "backend/operationsAgent.ts" ]; then
    echo "Creating placeholder for operationsAgent.ts..."
    cat > backend/operationsAgent.ts << EOF
/**
 * Operations Agent
 * 
 * Monitors system health and performance, detecting potential issues,
 * and recommending optimizations to ensure efficient operation.
 */

import { Agent, Tool } from 'crewai';
import { AgentConfig, AgentType, SystemAgent } from '../core/types';
import { createLogger } from '../utils/logger';

// Logger instance
const logger = createLogger('OperationsAgent');

/**
 * Operations agent class
 */
export class OperationsAgent implements SystemAgent {
  id: string;
  type: AgentType;
  name: string;
  description: string;
  agent: Agent;
  config: AgentConfig;
  
  constructor(
    id: string,
    agent: Agent,
    config: AgentConfig
  ) {
    this.id = id;
    this.type = AgentType.OPERATIONS;
    this.name = 'Operations Agent';
    this.description = 'Monitors system health and recommends optimizations';
    this.agent = agent;
    this.config = config;
    
    logger.info(\`Created OperationsAgent with ID: \${id}\`);
  }
  
  /**
   * Get the underlying crewAI agent
   */
  getAgent(): Agent {
    return this.agent;
  }
  
  /**
   * Run a specific task with this agent
   */
  async runTask(task: string): Promise<string> {
    logger.info(\`Running task: "\${task}"\`);
    
    try {
      // In a real implementation, this would execute the task with the agent
      // For the current implementation, we'll return a placeholder
      return \`I'll monitor the system for the task: "\${task}". I'm specialized in system health monitoring and optimization.\`;
    } catch (error) {
      logger.error(\`Error running task: \${error}\`);
      return 'I encountered an error while running this task. Please try again.';
    }
  }
  
  /**
   * Process a system event
   */
  async processEvent(eventType: string, eventData: any): Promise<void> {
    logger.info(\`Processing event: \${eventType}\`);
    
    try {
      // In a real implementation, this would process the event with the agent
      logger.debug(\`Event data: \${JSON.stringify(eventData)}\`);
      
      // For now, we just log the event
      logger.info(\`Processed event: \${eventType}\`);
    } catch (error) {
      logger.error(\`Error processing event: \${error}\`);
    }
  }
}

/**
 * Create an Operations agent
 */
export async function createOperationsAgent(config: AgentConfig): Promise<SystemAgent> {
  logger.info('Creating Operations agent');
  
  // Create the tools for this agent
  const tools: Tool[] = [
    // In a real implementation, we would add specialized operations tools
  ];
  
  // Add any additional tools from the config
  if (config.additionalTools) {
    tools.push(...config.additionalTools);
  }
  
  // Create the crewAI agent
  const agent = new Agent({
    name: 'Operations Agent',
    goal: 'Monitor system health and performance, detect issues, and recommend optimizations',
    backstory: 'I am a system operations specialist who excels at identifying performance issues and optimizing system resources.',
    verbose: config.verbose || false,
    tools: tools,
    llm: config.llm
  });
  
  // Create and return the OperationsAgent
  return new OperationsAgent(
    \`operations-agent-\${Date.now()}\`,
    agent,
    config
  );
}
EOF
fi

echo "✅ Setup complete! The crewAI integration is ready for development."
echo "🚀 You can now use the agent system in your KAI project."