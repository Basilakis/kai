/**
 * Agent System Core
 *
 * Provides initialization, management, and coordination of crewAI agents
 * throughout the KAI platform, with connections to real KAI services.
 */

import { Agent, Crew, Task } from 'crewai';
import { Redis } from 'redis';
import { Tool } from 'crewai';

import { createLogger } from '../services';
import { config } from '../services';
import { auth } from '../services';
import { AgentConfig, AgentType, AgentCreationResult } from './types';
import {
  ErrorHandler,
  AgentSystemError,
  AgentInitializationError,
  ServiceConnectionError,
  ResourceNotFoundError,
  TaskExecutionError,
  ValidationError
} from './errors';

// Import the logAgentActivity function
import { logAgentActivity } from '../utils/activityLogger';

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

  // Use unified config as defaults if no config provided
  globalConfig = {
    apiKey: config?.apiKey || config.get('openai.apiKey'),
    defaultModel: config?.defaultModel || {
      provider: 'openai',
      name: config.get('openai.defaultModel'),
      temperature: config.get('openai.temperature')
    },
    logLevel: (config?.logLevel || config.get('logging.level')) as any,
    globalTools: config?.globalTools || [],
    redis: config?.redis || (config.get('redis.url') ? {
      host: new URL(config.get('redis.url')).hostname,
      port: parseInt(new URL(config.get('redis.url')).port || '6379', 10),
      password: config.get('redis.password'),
      db: config.get('redis.db')
    } : undefined)
  };

  // Validate required configuration
  if (!globalConfig.apiKey) {
    throw new ValidationError(
      'OpenAI API key is required. Set OPENAI_API_KEY environment variable or provide in config.',
      { severity: 'high' }
    );
  }

  // Set up API key for the LLM provider
  process.env.OPENAI_API_KEY = globalConfig.apiKey;

  // Logging is already configured by the unified services

  // Initialize Redis client if configured
  if (globalConfig.redis) {
    logger.info('Connecting to Redis for agent memory persistence');

    try {
      // Create Redis client with correct configuration
      // Note: Pass database parameter as specified in the Redis client API
      redisClient = Redis.createClient({
        socket: {
          host: globalConfig.redis.host,
          port: globalConfig.redis.port,
        },
        password: globalConfig.redis.password
      }) as Redis;

      await redisClient.connect();
      logger.info('Redis connection established');
    } catch (error) {
      const redisError = new ServiceConnectionError('Redis', 'connect', {
        cause: error instanceof Error ? error : undefined,
        data: {
          host: globalConfig.redis.host,
          port: globalConfig.redis.port
        },
        severity: 'medium' // Not critical, can continue without Redis
      });
      logger.error(`${redisError.message}`, { error: redisError });
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

  // Use unified config as defaults if no config provided
  const serviceConfig = {
    apiUrl: config?.apiUrl || config.get('services.kaiApiUrl'),
    vectorDbUrl: config?.vectorDbUrl || config.get('services.vectorDbUrl'),
    mlServiceUrl: config?.mlServiceUrl || config.get('services.mlServiceUrl'),
    apiKey: config?.apiKey || config.get('services.apiKey'),
    enableMockFallback: config?.enableMockFallback !== undefined ?
      config.enableMockFallback : config.get('services.enableMockFallback')
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
      // Use the unified auth service
      await auth.login({
        apiKey: serviceConfig.apiKey
      });
      logger.info('Successfully authenticated with KAI API');
    } catch (error) {
      const authError = new ServiceConnectionError('Authentication', 'login', {
        cause: error instanceof Error ? error : undefined,
        data: { apiUrl: serviceConfig.apiUrl },
        severity: 'high'
      });
      logger.error(`${authError.message}`, { error: authError });

      if (!serviceConfig.enableMockFallback) {
        throw new ServiceConnectionError('Authentication', 'login', {
          cause: error instanceof Error ? error : undefined,
          data: {
            apiUrl: serviceConfig.apiUrl,
            message: 'Authentication failed and mock fallback is disabled'
          },
          severity: 'critical'
        });
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
    throw new ValidationError('Agent system is not initialized. Call initializeAgentSystem first.', {
      severity: 'high'
    });
  }
}

/**
 * Create an agent based on the provided configuration
 */
export async function createAgent(config: AgentConfig): Promise<AgentCreationResult> {
  ensureInitialized();

  return ErrorHandler.withErrorHandling(async () => {
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

    try {
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
          throw new ValidationError(`Unsupported agent type: ${config.type}`, {
            data: { type: config.type },
            severity: 'high'
          });
      }
    } catch (error) {
      // Log agent creation failure
      logAgentActivity(config.id, {
        action: 'agent_creation',
        status: 'error',
        error: error instanceof Error ? error : new Error(String(error)),
        details: {
          type: config.type,
          name: config.name
        }
      });

      // Rethrow as specialized error
      throw new AgentInitializationError(
        `Failed to initialize agent of type ${config.type}`,
        {
          agentId: config.id,
          agentType: config.type,
          cause: error instanceof Error ? error : undefined,
          severity: 'high'
        }
      );
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
  }, {
    agentId: config.id,
    agentType: config.type
  });
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
      throw new ResourceNotFoundError('Agent', id, {
        data: { context: 'createCrew' },
        severity: 'high'
      });
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

  return ErrorHandler.withErrorHandling(async () => {
    const agentResult = activeAgents.get(agentId);
    if (!agentResult) {
      throw new ResourceNotFoundError('Agent', agentId, {
        data: { context: 'executeAgentTask' },
        severity: 'high'
      });
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
        throw new ValidationError(`Agent ${agentId} does not support task execution`, {
          data: {
            agentType: agentResult.type,
            availableMethods: Object.keys(agentResult.instance)
          },
          severity: 'high'
        });
      }
    } catch (error: any) {
      // Convert to specialized error and log
      const taskError = new TaskExecutionError(
        `Failed to execute task with agent ${agentId}`,
        {
          taskId: `task-${Date.now()}`,
          agentId: agentId,
          taskDescription: taskDescription.substring(0, 100) + (taskDescription.length > 100 ? '...' : ''),
          cause: error instanceof Error ? error : undefined,
          severity: 'high'
        }
      );

      // Log task execution error
      logAgentActivity(agentId, {
        action: 'task_execution',
        status: 'error',
        error: taskError,
        details: {
          task: taskDescription.substring(0, 100) + (taskDescription.length > 100 ? '...' : '')
        }
      });

      throw taskError;
    }
  }, {
    agentId,
    taskDescription: taskDescription.substring(0, 100)
  });
}

/**
 * Process an event with the appropriate agent
 */
export async function processEventWithAgent(agentId: string, eventType: string, eventData: any): Promise<void> {
  ensureInitialized();

  return ErrorHandler.withErrorHandling(async () => {
    const agentResult = activeAgents.get(agentId);
    if (!agentResult) {
      throw new ResourceNotFoundError('Agent', agentId, {
        data: {
          context: 'processEventWithAgent',
          eventType
        },
        severity: 'high'
      });
    }

  logger.info(`Processing event ${eventType} with agent ${agentId}`);

    try {
      // Only backend agents should have processEvent method
      if ('processEvent' in agentResult.instance) {
        await agentResult.instance.processEvent(eventType, eventData);
      } else {
        throw new ValidationError(`Agent ${agentId} does not support event processing`, {
          data: {
            agentType: agentResult.type,
            eventType: eventType,
            availableMethods: Object.keys(agentResult.instance)
          },
          severity: 'medium'
        });
      }
    } catch (error: any) {
      // Convert to specialized error and log
      const eventError = new TaskExecutionError(
        `Failed to process event ${eventType} with agent ${agentId}`,
        {
          taskId: `event-${Date.now()}`,
          agentId: agentId,
          data: { eventType, eventData },
          cause: error instanceof Error ? error : undefined,
          severity: 'medium'
        }
      );

      // Log event processing error
      logAgentActivity(agentId, {
        action: 'event_processing',
        status: 'error',
        error: eventError,
        details: {
          eventType
        }
      });

      throw eventError;
    }
  }, {
    agentId,
    eventType
  });
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