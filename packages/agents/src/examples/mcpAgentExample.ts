/**
 * MCP Agent Integration Example
 * 
 * This example demonstrates how to integrate the MCP-powered agent system
 * with the main KAI application. It shows how to create agents that use the
 * MCP architecture for improved LLM inference performance, resource efficiency,
 * and monitoring.
 */

import { AgentType } from '../core/types';
import { initializeAgentSystem } from '../core/agentSystem';
import mcpAgentFactory from '../core/mcpAgentFactory';
import { isMCPEnabledForComponent } from '../utils/mcpIntegration';
import { initializeLLMEnvironment } from '../utils/llmInferenceHelper';
import { createLogger } from '../utils/logger';

// Logger instance for the example
const logger = createLogger('MCPAgentExample');

/**
 * Initialize the MCP-enabled agent system
 */
export async function initializeMCPAgentSystem(apiKey: string): Promise<void> {
  // First, initialize the standard agent system
  await initializeAgentSystem({
    apiKey,
    defaultModel: {
      provider: 'openai',
      name: 'gpt-4-turbo',
      temperature: 0.7
    },
    logLevel: 'info'
  });
  
  // Initialize the LLM environment for our MCP infrastructure
  await initializeLLMEnvironment();
  
  logger.info('MCP-enabled agent system initialized');
}

/**
 * Create a material expert agent with MCP capabilities
 */
export async function createMCPMaterialExpert(userId: string): Promise<any> {
  // Check if MCP is enabled for agent inference
  const mcpEnabled = isMCPEnabledForComponent('agentInference');
  
  // Create an agent configuration
  const agentConfig = {
    id: `material-expert-${userId}`,
    type: AgentType.MATERIAL_EXPERT,
    name: 'Material Expert',
    description: 'Expert on construction and design materials',
    userId
  };
  
  // Create the model settings
  const modelSettings = {
    provider: 'openai' as 'openai' | 'azure' | 'anthropic' | 'local',
    name: 'gpt-4-turbo',
    temperature: 0.7,
    enableBatching: true,
    enableMetrics: true
  };
  
  logger.info(`Creating MCP material expert agent for user ${userId} (MCP ${mcpEnabled ? 'enabled' : 'disabled'})`);
  
  // Create the MCP-enabled agent
  const agent = await mcpAgentFactory.createMCPEnabledAgent(agentConfig, modelSettings);
  
  return agent;
}

/**
 * Create a material expert with image analysis capabilities
 */
export async function createImageCapableMaterialExpert(userId: string): Promise<any> {
  // Create an agent configuration
  const agentConfig = {
    id: `image-material-expert-${userId}`,
    type: AgentType.MATERIAL_EXPERT,
    name: 'Image-Capable Material Expert',
    description: 'Expert on identifying and describing materials from images',
    userId
  };
  
  // Create the model settings
  const modelSettings = {
    provider: 'openai' as 'openai' | 'azure' | 'anthropic' | 'local',
    name: 'gpt-4-vision',
    temperature: 0.5,
    enableBatching: true,
    enableMetrics: true
  };
  
  logger.info(`Creating image-capable material expert for user ${userId}`);
  
  // Create the specialized material expert
  const agent = await mcpAgentFactory.createImageCapableMaterialExpert(agentConfig, modelSettings);
  
  return agent;
}

/**
 * Process a user query with an MCP-enabled agent
 */
export async function processUserQuery(agent: any, query: string): Promise<string> {
  logger.info(`Processing user query: ${query.substring(0, 30)}...`);
  
  try {
    // Process the query using the agent
    const response = await agent.processUserInput(query);
    
    logger.info('Query processed successfully');
    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Error processing query: ${errorMessage}`);
    
    return `I'm sorry, I encountered an error processing your request: ${errorMessage}`;
  }
}

/**
 * Create a streaming agent for real-time responses
 */
export async function createStreamingAgent(
  userId: string, 
  streamCallback: (chunk: string, done: boolean) => void
): Promise<any> {
  // Create an agent configuration
  const agentConfig = {
    id: `streaming-agent-${userId}`,
    type: AgentType.PROJECT_ASSISTANT,
    name: 'Streaming Project Assistant',
    description: 'Real-time assistant for design and construction projects',
    userId
  };
  
  // Create the model settings
  const modelSettings = {
    provider: 'openai' as 'openai' | 'azure' | 'anthropic' | 'local',
    name: 'gpt-4-turbo',
    temperature: 0.7,
    enableBatching: false, // Batching not compatible with streaming
    enableMetrics: true
  };
  
  logger.info(`Creating streaming agent for user ${userId}`);
  
  // Create the streaming agent
  const agent = await mcpAgentFactory.createStreamingMCPAgent(
    agentConfig,
    modelSettings,
    streamCallback
  );
  
  return agent;
}

/**
 * Process an image with an image-capable agent
 */
export async function processImage(
  agent: any,
  imageBase64: string
): Promise<any> {
  logger.info('Processing image with MCP-enabled agent');
  
  try {
    // Analyze the image using the agent
    const analysisResult = await agent.analyzeImage(imageBase64);
    
    logger.info('Image processed successfully');
    return analysisResult;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Error processing image: ${errorMessage}`);
    
    return {
      error: `Failed to process image: ${errorMessage}`
    };
  }
}

/**
 * Example usage in an Express API
 * 
 * This shows how the MCP agent system could be integrated with a web API.
 * (Not actual code to run, just for illustration)
 */
export function expressApiExample(): void {
  /*
  // In your Express setup
  app.post('/api/agent/query', async (req, res) => {
    const { userId, query } = req.body;
    
    // Get or create agent for user
    let agent = userAgents.get(userId);
    if (!agent) {
      agent = await createMCPMaterialExpert(userId);
      userAgents.set(userId, agent);
    }
    
    // Process the query
    const response = await processUserQuery(agent, query);
    
    res.json({ response });
  });
  
  // Streaming endpoint
  app.post('/api/agent/stream', async (req, res) => {
    const { userId, query } = req.body;
    
    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // Create streaming agent with callback
    const agent = await createStreamingAgent(userId, (chunk, done) => {
      res.write(`data: ${JSON.stringify({ chunk, done })}\n\n`);
      if (done) {
        res.end();
      }
    });
    
    // Process the query (response will be streamed via callback)
    await agent.processUserInput(query);
  });
  
  // Image analysis endpoint
  app.post('/api/agent/analyze-image', async (req, res) => {
    const { userId, imageBase64 } = req.body;
    
    // Create or get image-capable agent
    let agent = imageAgents.get(userId);
    if (!agent) {
      agent = await createImageCapableMaterialExpert(userId);
      imageAgents.set(userId, agent);
    }
    
    // Process the image
    const result = await processImage(agent, imageBase64);
    
    res.json(result);
  });
  */
}

// Export the functions for use in the application
export default {
  initializeMCPAgentSystem,
  createMCPMaterialExpert,
  createImageCapableMaterialExpert,
  processUserQuery,
  createStreamingAgent,
  processImage
};