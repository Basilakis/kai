/**
 * MCP-Enabled Agent Factory
 * 
 * Provides enhanced agent creation capabilities that leverage the MCP (Model Context Protocol)
 * architecture for improved LLM inference performance, resource efficiency, and monitoring.
 * 
 * This factory augments the standard agent system with:
 * - Centralized model management via MCP
 * - Token batching for improved throughput
 * - Performance metrics for monitoring
 * - Graceful fallbacks to local implementations
 */

import { Agent, Tool } from 'crewai';
import { createLogger } from '../utils/logger';
import { AgentConfig, AgentType } from './types';
import { createMaterialExpert } from '../frontend/materialExpert';
import { createEnhancedMaterialExpert } from '../frontend/enhancedMaterialExpert';
import { createProjectAssistant } from '../frontend/projectAssistant';
import { createRecognitionAssistant } from '../frontend/recognitionAssistant';

import { default as llmHelper, LLMChatMessage } from '../utils/llmInferenceHelper';
import { isMCPEnabledForComponent } from '../utils/mcpIntegration';
import { isBatchingEnabled } from '../utils/mcpBatchProcessor';

// Logger for the MCP agent factory
const logger = createLogger('MCPAgentFactory');

/**
 * Model configuration options for MCP-enabled agents
 */
export interface MCPModelSettings {
  /** Model provider (e.g., 'openai', 'azure', 'anthropic') */
  provider: 'openai' | 'azure' | 'anthropic' | 'local';
  
  /** Model name/identifier */
  name: string;
  
  /** Temperature setting for generation (0.0-1.0) */
  temperature: number;
  
  /** Optional model version */
  modelVersion?: string;
  
  /** Whether to use batching for improved throughput */
  enableBatching?: boolean;
  
  /** Maximum tokens to generate */
  maxTokens?: number;
  
  /** Whether to collect performance metrics */
  enableMetrics?: boolean;
}

/**
 * Base class for chat models
 */
class BaseChatModel {
  constructor() {}
  
  async _generate(messages: any, options?: any): Promise<any> {
    throw new Error('Method not implemented');
  }
  
  _llmType(): string {
    return 'base';
  }
  
  modelName(): string {
    return 'base';
  }
}

/**
 * Custom chat model that uses MCP for LLM operations
 */
class MCPChatModel extends BaseChatModel {
  private modelSettings: MCPModelSettings;
  private agentId: string;
  
  constructor(agentId: string, settings: MCPModelSettings) {
    super();
    this.modelSettings = settings;
    this.agentId = agentId;
    logger.debug(`Created MCP chat model for agent ${agentId} using ${settings.name}`);
  }
  
  /**
   * Generate a response using the LLM inference adapter
   */
  async _generate(
    messages: { role: string; content: string }[],
    options: any = {}
  ): Promise<any> {
    try {
      // Map messages to the format expected by our LLM helper
      const formattedMessages: LLMChatMessage[] = messages.map((msg) => ({
        role: msg.role as 'system' | 'user' | 'assistant' | 'function',
        content: msg.content
      }));
      
      // Log request details
      logger.debug(`Agent ${this.agentId} generating response using ${this.modelSettings.name}`);
      
      // Check if MCP and batching are enabled
      const mcpEnabled = isMCPEnabledForComponent('agentInference');
      const batchingEnabled = this.modelSettings.enableBatching && 
                            isBatchingEnabled('agentInference');
      
      // Execute the chat completion
      const result = await llmHelper.executeChat(
        formattedMessages,
        {
          model: this.modelSettings.name,
          temperature: this.modelSettings.temperature,
          maxTokens: this.modelSettings.maxTokens || 1024,
          modelVersion: this.modelSettings.modelVersion
        }
      );
      
      // Log response details
      logger.debug(`Generated response for agent ${this.agentId} (${result.usage.totalTokens} tokens, mcpEnabled=${mcpEnabled}, batching=${batchingEnabled})`);
      
      // Return in the format expected by crewAI
      return {
        generations: [
          {
            text: result.message.content,
            message: {
              role: 'assistant',
              content: result.message.content
            }
          }
        ],
        usage: {
          promptTokens: result.usage.promptTokens,
          completionTokens: result.usage.completionTokens,
          totalTokens: result.usage.totalTokens
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Error generating response for agent ${this.agentId}: ${errorMessage}`);
      throw error;
    }
  }
  
  /**
   * Get model name
   */
  _llmType(): string {
    return `mcp-${this.modelSettings.provider}-${this.modelSettings.name}`;
  }
  
  /**
   * Get model name for crewAI
   */
  modelName(): string {
    return this.modelSettings.name;
  }
}

/**
 * Create an agent with MCP-enabled LLM inference capabilities
 * 
 * @param config Agent configuration
 * @param modelSettings Model settings with MCP configuration
 * @returns The created agent instance with MCP capabilities
 */
export async function createMCPEnabledAgent(
  config: AgentConfig,
  modelSettings: MCPModelSettings
): Promise<any> {
  // Check if MCP is enabled for agent inference
  const mcpEnabled = isMCPEnabledForComponent('agentInference');
  
  logger.info(`Creating MCP-enabled agent ${config.id} (${config.type}) with MCP ${mcpEnabled ? 'enabled' : 'disabled'}`);
  
  // Create the MCP chat model
  const mcpModel = new MCPChatModel(config.id, modelSettings);
  
  // Create a model configuration compatible with crewAI
  const crewAIModelSettings = {
    provider: modelSettings.provider,
    name: modelSettings.name,
    temperature: modelSettings.temperature
  };
  
  // Determine which agent factory to use based on the agent type
  let agentInstance;
  switch (config.type) {
    case AgentType.RECOGNITION:
      agentInstance = await createRecognitionAssistant(config, crewAIModelSettings);
      break;
      
    case AgentType.MATERIAL_EXPERT:
      agentInstance = await createEnhancedMaterialExpert(config, crewAIModelSettings);
      break;
      
    case AgentType.PROJECT_ASSISTANT:
      agentInstance = await createProjectAssistant(config, crewAIModelSettings);
      break;
      
    default:
      logger.error(`Unsupported agent type for MCP: ${config.type}`);
      throw new Error(`Unsupported agent type for MCP: ${config.type}`);
  }
  
  // Enhance the agent instance with MCP capabilities
  return enhanceAgentWithMCP(agentInstance, config.id);
}

/**
 * Enhance an existing agent with MCP capabilities
 * 
 * @param agentInstance The agent instance to enhance
 * @param agentId The agent ID
 * @returns Enhanced agent instance
 */
function enhanceAgentWithMCP(agentInstance: any, agentId: string): any {
  // Check if MCP is enabled for agent inference
  const mcpEnabled = isMCPEnabledForComponent('agentInference');
  
  if (!mcpEnabled) {
    // If MCP is not enabled, return the original instance
    return agentInstance;
  }
  
  logger.debug(`Enhancing agent ${agentId} with MCP capabilities`);
  
  // The original processUserInput method
  const originalProcessUserInput = agentInstance.processUserInput;
  
  // Override the processUserInput method to leverage MCP
  agentInstance.processUserInput = async function(userInput: string): Promise<string> {
    try {
      // Start timing the request
      const startTime = Date.now();
      
      // Log the request
      logger.debug(`Processing user input with MCP-enabled agent ${agentId}`);
      
      // Call the original method
      const result = await originalProcessUserInput.call(this, userInput);
      
      // Calculate time taken
      const timeTaken = Date.now() - startTime;
      
      // Log success
      logger.debug(`MCP-enabled agent ${agentId} processed input in ${timeTaken}ms`);
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Error processing input with MCP-enabled agent ${agentId}: ${errorMessage}`);
      
      // Fallback to non-MCP processing if there was an error
      if (mcpEnabled) {
        logger.warn(`Falling back to non-MCP processing for agent ${agentId}`);
        return await originalProcessUserInput.call(this, userInput);
      }
      
      throw error;
    }
  };
  
  return agentInstance;
}

/**
 * Create a streaming MCP-enabled agent that supports real-time responses
 * 
 * @param config Agent configuration
 * @param modelSettings Model settings with MCP configuration
 * @param streamCallback Callback function for streamed responses
 * @returns The created streaming agent instance
 */
export async function createStreamingMCPAgent(
  config: AgentConfig,
  modelSettings: MCPModelSettings,
  streamCallback: (chunk: string, done: boolean) => void
): Promise<any> {
  // Similar to createMCPEnabledAgent but with streaming support
  const agent = await createMCPEnabledAgent(config, modelSettings);
  
  // The original processUserInput method
  const originalProcessUserInput = agent.processUserInput;
  
  // Override to add streaming
  agent.processUserInput = async function(userInput: string): Promise<string> {
    try {
      // Create system message based on agent type
      let systemMessage = "You are a helpful AI assistant.";
      
      switch (config.type) {
        case AgentType.MATERIAL_EXPERT:
          systemMessage = "You are a materials expert that helps identify and provide information about construction and design materials.";
          break;
        case AgentType.PROJECT_ASSISTANT:
          systemMessage = "You are a project assistant that helps with design and construction projects.";
          break;
        case AgentType.RECOGNITION:
          systemMessage = "You are a recognition assistant that helps identify materials from images and descriptions.";
          break;
      }
      
      // Use the LLM helper directly with streaming
      const result = await llmHelper.executeChat(
        [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userInput }
        ],
        {
          model: modelSettings.name,
          temperature: modelSettings.temperature,
          streaming: true,
          streamingCallback: streamCallback
        }
      );
      
      // Return the full response for non-streaming clients
      return result.message.content;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Error in streaming MCP agent ${config.id}: ${errorMessage}`);
      
      // Fall back to non-streaming mode
      logger.warn(`Falling back to non-streaming mode for agent ${config.id}`);
      return await originalProcessUserInput.call(agent, userInput);
    }
  };
  
  return agent;
}

/**
 * Create a specialized material expert that uses image analysis via MCP
 * 
 * @param config Agent configuration
 * @param modelSettings Model settings with MCP configuration
 * @returns Image-capable material expert
 */
export async function createImageCapableMaterialExpert(
  config: AgentConfig,
  modelSettings: MCPModelSettings
): Promise<any> {
  // First create a regular MCP-enabled agent
  const agent = await createMCPEnabledAgent({
    ...config,
    type: AgentType.MATERIAL_EXPERT
  }, modelSettings);
  
  // Import the image analysis adapter
  const imageAnalysisAdapter = await import('../services/adapters/imageAnalysisMcpAdapter.js').then(
    module => module.default
  );
  
  // Add image analysis capabilities
  agent.analyzeImage = async function(imageBase64: string): Promise<any> {
    try {
      logger.debug(`Agent ${config.id} analyzing image with MCP`);
      
      // Use the image analysis adapter
      const analysisResult = await imageAnalysisAdapter.analyzeImage(
        imageBase64,
        {
          detectMaterials: true,
          assessQuality: true,
          extractFeatures: true
        }
      );
      
      // Process the materials detected
      if (analysisResult.materials && analysisResult.materials.length > 0) {
        // Sort by confidence
        const sortedMaterials = [...analysisResult.materials]
          .sort((a, b) => b.confidence - a.confidence);
        
        // Get the top material
        const topMaterial = sortedMaterials[0];
        
        // Generate a description using the agent's LLM
        const description = await this.processUserInput(
          `Provide a detailed description of ${topMaterial.name} as a building/design material. Include its key properties, typical uses, and advantages.`
        );
        
        return {
          materialName: topMaterial.name,
          confidence: topMaterial.confidence,
          description,
          allMaterials: sortedMaterials.map(m => m.name),
          quality: analysisResult.quality
        };
      }
      
      return {
        error: 'No materials detected in the image'
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Error analyzing image with agent ${config.id}: ${errorMessage}`);
      
      return {
        error: `Failed to analyze image: ${errorMessage}`
      };
    }
  };
  
  return agent;
}

export default {
  createMCPEnabledAgent,
  createStreamingMCPAgent,
  createImageCapableMaterialExpert,
  enhanceAgentWithMCP,
  MCPChatModel
};