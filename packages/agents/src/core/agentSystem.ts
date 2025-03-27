/**
 * Agent System Core
 * 
 * Provides initialization, management, and coordination of crewAI agents
 * throughout the KAI platform, with connections to real KAI services.
 */

import { Agent, Crew, Task } from 'crewai';
import { Redis } from 'redis';
import { Tool } from 'crewai';

import { createLogger, logAgentActivity } from '../utils/logger';
import { env, configureLoggingFromEnvironment } from '../utils/environment';
import { AgentConfig, AgentType, AgentCreationResult } from './types';
import { authService } from '../services/authService';

// Import agent factories
import { createRecognitionAssistant } from '../frontend/recognitionAssistant';
import { createMaterialExpert } from '../frontend/materialExpert';
import { createEnhancedMaterialExpert } from '../frontend/enhancedMaterialExpert';
import { createProjectAssistant } from '../frontend/projectAssistant';
import { createKnowledgeBaseAgent } from '../backend/knowledgeBaseAgent';
import { createAnalyticsAgent } from '../backend/analyticsAgent';
import { createOperationsAgent } from '../backend/operationsAgent';

// Logger instance
const logger = createLogger('AgentSystem');

/**
 * Global configuration for the agent system
 */
export interface AgentSystemConfig {
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
  
  /** System-wide tools to be available to all agents */
  globalTools?: Tool[];
  
  /** Logging level */
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * KAI service connection configuration
 */
export interface ServiceConnectionConfig {
  /** KAI API base URL */
  apiUrl?: string;
  
  /** Vector DB URL */
  vectorDbUrl?: string;
  
  /** ML Service URL */
  mlServiceUrl?: string;
  
  /** KAI API key (if required) */
  apiKey?: string;
  
  /** Enable mock services as fallback */
  enableMockFallback?: boolean;
}

// Internal state
let isInitialized = false;
let redisClient: Redis | null = null;
let globalConfig: AgentSystemConfig | null = null;
const activeAgents: Map<string, AgentCreationResult> = new Map();

/**
 * Initialize the agent system with the provided configuration
 * If no config is provided, it will use the environment variables
 */
export async function initializeAgentSystem(config?: Partial<AgentSystemConfig>): Promise<void> {
  if (isInitialized) {
    logger.warn('Agent system is already initialized');
    return;
  }
  
  logger.info('Initializing crewAI agent system');
  
  // Use environment variables as defaults if no config provided
  globalConfig = {
    apiKey: config?.apiKey || env.openai.apiKey,
    defaultModel: config?.defaultModel || {
      provider: 'openai',
      name: env.openai.defaultModel,
      temperature: env.openai.temperature
    },
    logLevel: (config?.logLevel || env.logging.level) as any,
    globalTools: config?.globalTools || [],
    redis: config?.redis || (env.redis.url ? {
      host: new URL(env.redis.url).hostname,
      port: parseInt(new URL(env.redis.url).port || '6379', 10),
      password: env.redis.password,
      db: env.redis.db
    } : undefined)
  };
  
  // Validate required configuration
  if (!globalConfig.apiKey) {
    throw new Error('OpenAI API key is required. Set OPENAI_API_KEY environment variable or provide in config.');
  }
  
  // Set up API key for the LLM provider
  process.env.OPENAI_API_KEY = globalConfig.apiKey;
  
  // Configure logging based on environment
  configureLoggingFromEnvironment();
  
  // Initialize Redis client if configured
  if (globalConfig.redis) {
    logger.info('Connecting to Redis for agent memory persistence');
    
    try {
      redisClient = Redis.createClient({
        socket: {
          host: globalConfig.redis.host,
          port: globalConfig.redis.port,
        },
        password: globalConfig.redis.password,
        database: globalConfig.redis.db || 0,
      }) as Redis;
      
      await redisClient.connect();
      logger.info('Redis connection established');
    } catch (error) {
      logger.error(`Failed to connect to Redis: ${error}`);
      logger.warn('Continuing without Redis persistence');
    }
  }
  
  isInitialized = true;
  logger.info('crewAI agent system initialized successfully');
}

/**
 * Connect to KAI services for agent operations
 */
export async function connectToServices(config?: ServiceConnectionConfig): Promise<void> {
  ensureInitialized();
  
  logger.info('Connecting to KAI services');
  
  // Use environment variables as defaults if no config provided
  const serviceConfig = {
    apiUrl: config?.apiUrl || env.services.kaiApiUrl,
    vectorDbUrl: config?.vectorDbUrl || env.services.vectorDbUrl,
    mlServiceUrl: config?.mlServiceUrl || env.services.mlServiceUrl,
    apiKey: config?.apiKey || env.services.apiKey,
    enableMockFallback: config?.enableMockFallback !== undefined ? 
      config.enableMockFallback : env.services.enableMockFallback
  };
  
  // Log connection details (without sensitive information)
  logger.info(`Service configuration:
    API URL: ${serviceConfig.apiUrl}
    Vector DB URL: ${serviceConfig.vectorDbUrl}
    ML Service URL: ${serviceConfig.mlServiceUrl}
    Using API key: ${serviceConfig.apiKey ? 'Yes' : 'No'}
    Mock fallback: ${serviceConfig.enableMockFallback ? 'Enabled' : 'Disabled'}
  `);
  
  // Initialize authentication if API key is provided
  if (serviceConfig.apiKey) {
    try {
      await authService.authenticateWithApiKey(serviceConfig.apiKey);
      logger.info('Successfully authenticated with KAI API');
    } catch (error) {
      logger.error(`Authentication failed: ${error}`);
      if (!serviceConfig.enableMockFallback) {
        throw new Error('Authentication failed and mock fallback is disabled');
      }
      logger.warn('Continuing with mock services due to authentication failure');
    }
  } else {
    logger.warn('No API key provided for KAI services, some features may be limited');
  }
  
  // The service connectors will use the environment variables 
  // or the explicitly provided configuration
  logger.info('Service connections configured successfully');
}

/**
 * Check if the agent system is initialized
 */
export function isAgentSystemInitialized(): boolean {
  return isInitialized;
}

/**
 * Get the system configuration
 */
export function getSystemConfig(): AgentSystemConfig | null {
  return globalConfig;
}

/**
 * Ensure the agent system is initialized before proceeding
 */
function ensureInitialized(): void {
  if (!isInitialized || !globalConfig) {
    throw new Error('Agent system is not initialized. Call initializeAgentSystem first.');
  }
}

/**
 * Create an agent based on the provided configuration
 */
export async function createAgent(config: AgentConfig): Promise<AgentCreationResult> {
  ensureInitialized();
  
  logger.info(`Creating agent of type ${config.type || AgentType.RECOGNITION} with ID ${config.id}`);
  
  // Track agent creation
  logAgentActivity(config.id, {
    action: 'agent_creation',
    status: 'start',
    details: {
      type: config.type || AgentType.RECOGNITION,
      name: config.name
    }
  });
  
  // Merge default model settings with agent-specific ones
  const modelSettings = {
    provider: globalConfig!.defaultModel?.provider || 'openai',
    name: globalConfig!.defaultModel?.name || 'gpt-4',
    temperature: globalConfig!.defaultModel?.temperature || 0.7,
    ...config.model,
  };
  
  let agentInstance;
  
  // Create the appropriate agent based on the type
  switch (config.type) {
    case AgentType.RECOGNITION:
      agentInstance = await createRecognitionAssistant(config, modelSettings);
      break;
      
    case AgentType.MATERIAL_EXPERT:
      // Use the enhanced material expert with metadata formatting
      agentInstance = await createEnhancedMaterialExpert(config, modelSettings);
      break;
      
    case AgentType.PROJECT_ASSISTANT:
      agentInstance = await createProjectAssistant(config, modelSettings);
      break;
      
    case AgentType.KNOWLEDGE_BASE:
      agentInstance = await createKnowledgeBaseAgent(config, modelSettings);
      break;
      
    case AgentType.ANALYTICS:
      agentInstance = await createAnalyticsAgent(config, modelSettings);
      break;
      
    case AgentType.OPERATIONS:
      agentInstance = await createOperationsAgent(config, modelSettings);
      break;
      
    default:
      logger.error(`Unsupported agent type: ${config.type}`);
      throw new Error(`Unsupported agent type: ${config.type}`);
  }
  
  // Create the result object
  const result: AgentCreationResult = {
    id: config.id,
    type: config.type,
    instance: agentInstance,
    createdAt: new Date(),
  };
  
  // Store the agent in the active agents map
  activeAgents.set(config.id, result);
  
  logger.info(`Agent ${config.id} created successfully`);
  
  // Log successful creation
  logAgentActivity(config.id, {
    action: 'agent_creation',
    status: 'success',
    details: {
      type: config.type,
      model: modelSettings.name
    }
  });
  
  return result;
}

/**
 * Get an agent by ID
 */
export function getAgent(id: string): AgentCreationResult | undefined {
  ensureInitialized();
  return activeAgents.get(id);
}

/**
 * Delete an agent by ID
 */
export function deleteAgent(id: string): boolean {
  ensureInitialized();
  
  if (activeAgents.has(id)) {
    activeAgents.delete(id);
    logger.info(`Agent ${id} deleted`);
    
    // Log agent deletion
    logAgentActivity(id, {
      action: 'agent_deletion',
      status: 'success'
    });
    
    return true;
  }
  
  logger.warn(`Agent ${id} not found for deletion`);
  return false;
}

/**
 * Get all active agents
 */
export function getAllAgents(): AgentCreationResult[] {
  ensureInitialized();
  return Array.from(activeAgents.values());
}

/**
 * Create a crew of multiple agents
 */
export function createCrew(name: string, agentIds: string[], tasks: string[]): Crew {
  ensureInitialized();
  
  // Get the agents
  const agents = agentIds.map(id => {
    const agentResult = activeAgents.get(id);
    if (!agentResult) {
      throw new Error(`Agent with ID ${id} not found`);
    }
    return (agentResult.instance as any).getAgent() as Agent;
  });
  
  // Create the crew - making sure we use proper Task constructor properties
  // Log the name for tracking purposes
  logger.info(`Creating crew: ${name}`);
  
  const crewInstance = new Crew({
    agents,
    tasks: tasks.map(description => new Task({
      description,
      expected_output: 'JSON string with results and recommendations',
      // Using any as the agent will be assigned by the Crew
      agent: undefined as any
    })),
    verbose: true
  });
  
  logger.info(`Created crew: ${name}`);
  return crewInstance;
}

/**
 * Execute a task with a specific agent
 */
export async function executeAgentTask(agentId: string, taskDescription: string): Promise<string> {
  ensureInitialized();
  
  const agentResult = activeAgents.get(agentId);
  if (!agentResult) {
    throw new Error(`Agent with ID ${agentId} not found`);
  }
  
  logger.info(`Executing task with agent ${agentId}: ${taskDescription}`);
  
  // Log task execution start
  logAgentActivity(agentId, {
    action: 'task_execution',
    status: 'start',
    details: {
      task: taskDescription.substring(0, 100) + (taskDescription.length > 100 ? '...' : '')
    }
  });
  
  try {
    // Each agent class should provide a runTask or processUserInput method
    if ('runTask' in agentResult.instance) {
      return await agentResult.instance.runTask(taskDescription);
    } else if ('processUserInput' in agentResult.instance) {
      return await agentResult.instance.processUserInput(taskDescription);
    } else {
      throw new Error(`Agent ${agentId} does not support task execution`);
    }
  } catch (error: any) {
    logger.error(`Error executing task with agent ${agentId}: ${error}`);
    
    // Log task execution error
    logAgentActivity(agentId, {
      action: 'task_execution',
      status: 'error',
      error: error instanceof Error ? error : new Error(String(error)),
      details: {
        task: taskDescription.substring(0, 100) + (taskDescription.length > 100 ? '...' : '')
      }
    });
    
    throw error;
  }
}

/**
 * Process an event with the appropriate agent
 */
export async function processEventWithAgent(agentId: string, eventType: string, eventData: any): Promise<void> {
  ensureInitialized();
  
  const agentResult = activeAgents.get(agentId);
  if (!agentResult) {
    throw new Error(`Agent with ID ${agentId} not found`);
  }
  
  logger.info(`Processing event ${eventType} with agent ${agentId}`);
  
  try {
    // Only backend agents should have processEvent method
    if ('processEvent' in agentResult.instance) {
      await agentResult.instance.processEvent(eventType, eventData);
    } else {
      throw new Error(`Agent ${agentId} does not support event processing`);
    }
  } catch (error: any) {
    logger.error(`Error processing event with agent ${agentId}: ${error}`);
    
    // Log event processing error
    logAgentActivity(agentId, {
      action: 'event_processing',
      status: 'error',
      error: error instanceof Error ? error : new Error(String(error)),
      details: {
        eventType
      }
    });
    
    throw error;
  }
}

/**
 * Shutdown the agent system and cleanup resources
 */
export async function shutdownAgentSystem(): Promise<void> {
  if (!isInitialized) {
    return;
  }
  
  logger.info('Shutting down agent system');
  
  // Close Redis connection if it was initialized
  if (redisClient) {
    await redisClient.disconnect();
    redisClient = null;
  }
  
  // Clear active agents
  activeAgents.clear();
  
  isInitialized = false;
  globalConfig = null;
  
  logger.info('Agent system shutdown complete');
}

export default {
  initializeAgentSystem,
  isAgentSystemInitialized,
  connectToServices,
  getSystemConfig,
  createAgent,
  getAgent,
  deleteAgent,
  getAllAgents,
  createCrew,
  executeAgentTask,
  processEventWithAgent,
  shutdownAgentSystem
};