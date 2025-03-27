# crewAI Integration Implementation

This document provides a comprehensive overview of the crewAI agent integration implementation for the KAI platform, including the current state, architecture, and next steps.

## Implementation Summary

The integration of crewAI agents into the KAI platform has been implemented with the following components:

### Backend Components

1. **Agent Controller** (`packages/server/src/controllers/agents.controller.ts`)
   - Session management for agent conversations
   - Message processing and response generation
   - Image upload and analysis for recognition agents
   - Mock implementation of agent processing with hooks for crewAI integration

2. **Agent Routes** (`packages/server/src/routes/agents.routes.ts`)
   - RESTful API endpoints for agent interaction
   - Session creation, message sending, and retrieval
   - Image upload for recognition agents
   - Admin endpoints for system status monitoring

3. **Server Integration** (`packages/server/src/server.ts`)
   - Registration of agent routes at `/api/agents`
   - Integration with existing authentication and middleware

### Frontend Components

1. **Agent Service** (`packages/client/src/services/agentService.ts`)
   - Centralized service for agent communication
   - Session management and message handling
   - Image upload for recognition agents
   - Mock implementations with hooks for real API integration

2. **Agent Chat Component** (`packages/client/src/components/agents/AgentChat.tsx`)
   - Reusable chat interface for agent interactions
   - Real-time message display and input handling
   - Image upload capabilities for recognition agents
   - Typing indicators and message threading

3. **Specialized Agent Panels**
   - `RecognitionPanel`: Image upload and material recognition with agent assistance
   - `MaterialExpertPanel`: Detailed material information with expert guidance
   - `ProjectAssistantPanel`: Project planning and material organization with agent assistance

4. **Agent Dashboard** (`packages/client/src/components/agents/AgentDashboard.tsx`)
   - Unified interface for accessing different agent capabilities
   - Tab-based navigation between agent types
   - Consistent UI and experience across agent interactions

### Agent Package

1. **Core Agent System** (`packages/agents/src/core/`)
   - Agent type definitions and configuration interfaces
   - System initialization and management
   - Agent creation and registration

2. **Frontend Agents** (`packages/agents/src/frontend/`)
   - `RecognitionAssistant`: Helps identify materials from images
   - `MaterialExpert`: Provides detailed information about materials
   - `ProjectAssistant`: Helps organize materials into projects

3. **Backend Agents** (`packages/agents/src/backend/`)
   - `KnowledgeBaseAgent`: Maintains and improves the knowledge base
   - `AnalyticsAgent`: Processes usage patterns and system metrics
   - `OperationsAgent`: Monitors system health and performance

4. **Agent Tools** (`packages/agents/src/tools/`)
   - `materialSearch`: Search for materials in the database
   - `imageAnalysis`: Analyze images for recognition
   - `vectorSearch`: Perform semantic similarity searches

## Current State and Dependencies

The implementation currently includes all necessary files and structure for the crewAI integration, but has the following dependencies that need to be installed to complete the integration:

1. **crewAI Package**: Core dependency for agent functionality
2. **Redis**: For agent memory and session persistence
3. **Winston**: For structured logging
4. **@types/node**: For Node.js typings
5. **@emotion/styled** and **@emotion/react**: For frontend styling (client package)
6. **react-dropzone**: For image upload functionality (client package)

These dependencies are referenced in the setup script and package.json files but need to be installed. The current implementation includes mock functionality that allows the system to function without these dependencies during development.

## Integration Architecture

The crewAI integration follows a layered architecture:

1. **User Interface Layer**: React components for agent interaction
2. **Service Layer**: Client-side services for agent communication
3. **API Layer**: RESTful endpoints for agent operations
4. **Agent System Layer**: Core agent definitions and management
5. **Tool Layer**: Specialized capabilities for agents

Data flows through these layers as follows:

1. User interacts with a specialized agent panel
2. Panel sends requests through the agentService
3. Service communicates with the backend API
4. API routes the request to the appropriate controller method
5. Controller processes the request and invokes the agent system
6. Agent system delegates to the appropriate agent type
7. Agent utilizes tools to perform operations
8. Results flow back through the layers to the user

## Next Steps to Complete the Integration

To complete the crewAI integration, follow these steps:

### 1. Install Dependencies

Run the setup script to install all required dependencies:

```bash
# Make the script executable
chmod +x packages/agents/scripts/setup.sh

# Run the setup script
cd packages/agents/scripts
./setup.sh

# Install client dependencies
cd ../../client
npm install @emotion/styled @emotion/react react-dropzone

# Install server dependencies
cd ../server
npm install uuid multer
```

### 2. Finalize Backend Integration

1. **Update Type Definitions**: Create a local type definition file for @kai/agents to resolve import errors:

```typescript
// packages/server/src/types/kai-agents.d.ts
declare module '@kai/agents' {
  export enum AgentType {
    RECOGNITION = 'recognition',
    MATERIAL_EXPERT = 'material',
    PROJECT_ASSISTANT = 'project',
    KNOWLEDGE_BASE = 'knowledge_base',
    ANALYTICS = 'analytics',
    OPERATIONS = 'operations'
  }

  export interface AgentConfig {
    // Add necessary properties
  }

  export function initializeAgentSystem(config: any): Promise<void>;
}
```

2. **Create uploads directory**: Ensure the directory for image uploads exists:

```bash
mkdir -p uploads
```

3. **Implement null checks**: Update the controller to handle potentially undefined sessionId parameters:

```typescript
// In packages/server/src/controllers/agents.controller.ts
// Update the getMessages function:
if (!sessionId) {
  return res.status(400).json({ error: 'Session ID is required' });
}
const session = sessions.get(sessionId);
```

### 3. Complete Frontend Integration

1. **Fix Type Issues**: Update the client tsconfig.json to include proper TypeScript definitions:

```json
{
  "compilerOptions": {
    "typeRoots": ["./node_modules/@types", "./src/types"]
  }
}
```

2. **Create Local Type Definitions**: Add missing type definitions for React hooks:

```typescript
// packages/client/src/types/react-hooks.d.ts
import React from 'react';

declare module 'react' {
  export function useRef<T>(initialValue: T): React.RefObject<T>;
  export function useRef<T>(initialValue: null): React.RefObject<T | null>;
  export function useRef<T = undefined>(): React.RefObject<T | undefined>;
  
  export interface KeyboardEvent<T = Element> extends React.SyntheticEvent<T> {
    altKey: boolean;
    charCode: number;
    ctrlKey: boolean;
    key: string;
    keyCode: number;
    locale: string;
    metaKey: boolean;
    repeat: boolean;
    shiftKey: boolean;
    which: number;
  }
  
  export function useCallback<T extends (...args: any[]) => any>(
    callback: T,
    deps: ReadonlyArray<any>
  ): T;
}
```

3. **Fix Null Reference Handling**: Update the RecognitionPanel component to safely handle potential undefined values:

```typescript
// In topResult usage, add null checks:
content: `I've identified your material as ${topResult?.name || 'Unknown'} with ${topResult ? Math.round(topResult.confidence * 100) : 0}% confidence...`
```

### 4. Connect to Real API Endpoints

1. **Update agentService**: Modify the service to call the actual backend endpoints:

```typescript
// In packages/client/src/services/agentService.ts
// Replace mock implementations with actual API calls:
async sendMessage(sessionId: string, message: string): Promise<void> {
  const response = await fetch(`/api/agents/session/${sessionId}/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message })
  });
  
  if (!response.ok) {
    throw new Error('Failed to send message');
  }
}
```

2. **Update image upload**: Connect the image upload functionality to the actual API endpoint:

```typescript
// In upload functionality:
const formData = new FormData();
formData.append('image', file);

const response = await fetch(`/api/agents/session/${sessionId}/image`, {
  method: 'POST',
  body: formData
});
```

### 5. Testing and Validation

1. **Start the development server**:
```bash
cd packages/server
npm run dev
```

2. **Start the client application**:
```bash
cd packages/client
npm run dev
```

3. **Navigate to the agents dashboard** at `/agents` to test the integration.

4. **Validate each agent type** by interacting with them and ensuring proper responses.

## Future Enhancements

Once the basic integration is complete, consider these enhancements:

1. **Real-time Communication**: Implement WebSocket communication for real-time agent responses
2. **Context Awareness**: Enhance agents with user history and preferences
3. **Voice Interface**: Add speech-to-text and text-to-speech capabilities
4. **Integration with Knowledge Base**: Connect agents directly to the KAI knowledge base
5. **Performance Optimization**: Implement caching and response optimization

## Conclusion

The crewAI integration has been successfully implemented with all necessary structure and components. By following the next steps outlined above, the integration can be completed and deployed, providing KAI users with intelligent assistance throughout their material discovery and project management workflows.