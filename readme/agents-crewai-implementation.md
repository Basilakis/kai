# crewAI Integration Implementation Guide

This document provides implementation details for integrating crewAI agents into the KAI platform, reflecting the current state including MCP integration.

## Implementation Status

The integration of crewAI agents into the KAI platform includes:

1.  **Core Framework:**
    *   An `agents` package with core types, interfaces, and configuration (`agentSystem.ts`).
    *   Agent system management using environment variables for configuration (API keys, service URLs).
    *   Optional Redis integration for agent memory persistence.
    *   Logging and error handling utilities.

2.  **MCP Integration (LLM):**
    *   Implemented via adapters (`llmInferenceMcpAdapter.ts`) and helpers (`llmInferenceHelper.ts`).
    *   Supports chat, completion, and embedding operations.
    *   Automatically routes requests to the MCP server when enabled (`isMCPEnabledForComponent`).
    *   Supports batching (`mcpBatchProcessor.ts`) and streaming (via WebSockets).
    *   Includes fallback to a local `LLMService` implementation if MCP is disabled or fails.
    *   Connects to real KAI backend services (configured via environment variables).

3.  **Agent Types & Factory:**
    *   Defined frontend agents (`RecognitionAssistant`, `MaterialExpert`, `ProjectAssistant`) and backend agents (`KnowledgeBaseAgent`, `AnalyticsAgent`, `OperationsAgent`).
    *   `mcpAgentFactory.ts` creates MCP-enabled frontend agents, leveraging the LLM adapter. Backend agent MCP usage needs further review.
    *   `createEnhancedMaterialExpert` is used for `MaterialExpert`.
    *   `createImageCapableMaterialExpert` adds image analysis via `imageAnalysisMcpAdapter`.

4.  **Frontend Components:**
    *   UI components for agent interaction exist (AgentChat, panels).
    *   Further integration work (WebSockets, state persistence) may be needed.

5.  **Tools & Adapters:**
    *   Basic agent tools (`materialSearch`, `imageAnalysis`, `vectorSearch`) exist.
    *   Adapters (`llmInferenceMcpAdapter`, `imageAnalysisMcpAdapter`, etc.) handle communication with MCP or local services.
    *   Completeness and robustness of individual agent/tool implementations require ongoing review.

## Setup Instructions

To set up the `agents` package:

1. Make the setup script executable:
   ```bash
   chmod +x packages/agents/setup.sh
   ```
   *(Note: The script path might be `packages/agents/scripts/setup.sh` depending on its exact location)*

2.  Run the setup script from the `packages/agents` directory:
    ```bash
    ./setup.sh 
    ```
    *(Or `scripts/setup.sh`)*

3.  The setup script primarily installs dependencies and may create placeholder files if any core agent/tool files are missing.

4.  **Environment Variables:** Configure the necessary environment variables for the agent system to connect to services. Refer to `packages/agents/src/utils/environment.ts` and the main `readme/agents-crewai.md` for required variables, which typically include:
    *   `OPENAI_API_KEY` (or other LLM provider key)
    *   `REDIS_URL`, `REDIS_PASSWORD` (optional, for persistence)
    *   `KAI_API_URL`, `VECTOR_DB_URL`, `ML_SERVICE_URL`, `KAI_API_KEY` (for KAI services)
    *   `MCP_SERVER_URL`, `MCP_AUTH_TOKEN` (if using MCP)
    *   Flags like `MCP_ENABLED_agentInference`, `MCP_BATCHING_ENABLED_agentInference`

## Usage Examples

### Initializing the Agent System with Service Connections

```typescript
import { initializeAgentSystem, connectToServices } from '@kai/agents';
import { env } from '@kai/agents/utils/environment'; // Assuming env is exported

// Initialize core system (uses env vars for keys, redis, etc.)
await initializeAgentSystem(); 

// Configure connections to KAI services (uses env vars by default)
await connectToServices(); 

// --- OR Initialize with explicit config ---
/*
await initializeAgentSystem({
  apiKey: process.env.OPENAI_API_KEY,
  redis: env.redis.url ? { host: new URL(env.redis.url).hostname, port: parseInt(new URL(env.redis.url).port || '6379'), password: env.redis.password } : undefined,
  logLevel: 'debug'
});

await connectToServices({
  apiUrl: env.services.kaiApiUrl,
  vectorDbUrl: env.services.vectorDbUrl,
  mlServiceUrl: env.services.mlServiceUrl,
  apiKey: env.services.apiKey,
  enableMockFallback: env.services.enableMockFallback
});
*/
```

### Creating an MCP-Enabled Agent

```typescript
import { createMCPEnabledAgent, AgentType } from '@kai/agents/core/mcpAgentFactory';
import { AgentConfig } from '@kai/agents'; // Assuming AgentConfig is exported

// Configuration for the agent
const agentConfig: AgentConfig = {
  id: 'mcp-material-expert-1',
  type: AgentType.MATERIAL_EXPERT,
  name: 'MCP Material Expert',
  description: 'Provides detailed material information using MCP',
  // Agent-specific tools can be added here if needed
  // tools: [customTool] 
};

// Model settings, potentially overriding defaults
const modelSettings = {
  provider: 'openai',
  name: 'gpt-4-turbo', // Use desired model
  temperature: 0.5,
  enableBatching: true, // Enable batching via MCP if desired
  // maxTokens: 2048 
};

// Create the agent
const mcpAgent = await createMCPEnabledAgent(agentConfig, modelSettings);

// Use the agent (it will use MCP for LLM ops if enabled)
const materialDetails = await mcpAgent.processUserInput('Tell me about Carrara marble.');
console.log(materialDetails);

// Example using image analysis capability (if created via createImageCapableMaterialExpert)
// const imageAnalysis = await mcpAgent.analyzeImage(imageBase64String);
// console.log(imageAnalysis);
```

## Next Development Steps

While the core MCP integration for LLM is in place, further work includes:

1.  **Complete Agent/Tool Logic:** Flesh out the specific implementations within agent classes and tools, replacing any remaining placeholders with robust logic and error handling.
2.  **Streaming Fallback:** Implement streaming support in the local `LLMService` fallback path or clearly document the limitation.
3.  **Backend Agent MCP Usage:** Review and potentially implement MCP integration for backend agents if required.
4.  **Enhance Frontend Integration:** Improve real-time communication (WebSockets), state management, and UI feedback for agent interactions.
5.  **Testing:** Develop comprehensive unit, integration, and potentially end-to-end tests for agents, tools, and MCP interactions.
6.  **Configuration & Deployment:** Finalize environment variable documentation, create deployment configurations, implement monitoring, and plan for scaling.

## Known Issues

1.  **Local Streaming Fallback:** The local `LLMService` used when MCP is unavailable does not currently support streaming responses.
2.  **Placeholder Implementations:** Some specific agent behaviors or tool functionalities might still be placeholders requiring full implementation.
3.  **Error Handling Granularity:** Error handling in some tools or specific agent logic might need refinement beyond basic try/catch blocks.

## Resources

- [Main crewAI Integration README](./agents-crewai.md)
- [MCP Integration Documentation](./../packages/agents/src/docs/mcp-integration.md)
- [crewAI Documentation](https://docs.crewai.com/)
- [Redis Documentation](https://redis.io/docs)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)