# Recognition Assistant

This document provides detailed information about the Recognition Assistant, a specialized crewAI agent designed to enhance the material recognition workflow within the KAI platform.

## Overview

The Recognition Assistant uses artificial intelligence to help users identify and analyze materials through image recognition. It guides users through the recognition process, analyzes results, and provides detailed insights about materials to enhance the overall material identification experience.

## Key Capabilities

The Recognition Assistant offers multiple specialized functions:

1. **Image Processing Guidance**
   - Provide advice on capturing optimal images of materials
   - Suggest improvements for image quality to enhance recognition
   - Guide users on optimal lighting, angle, and distance

2. **Recognition Result Analysis**
   - Interpret and explain recognition results in detail
   - Analyze confidence scores and provide context
   - Compare similar materials and highlight key differences
   - Explain why certain materials were matched

3. **Material Property Explanation**
   - Provide detailed information about material properties
   - Explain material characteristics, applications, and limitations
   - Offer insights on material performance in different environments
   - Discuss maintenance requirements and durability factors

4. **Alternative Suggestion**
   - Recommend alternative materials with similar properties
   - Suggest materials that might better suit specific applications
   - Compare pros and cons of different material options
   - Provide context on availability and cost considerations

5. **Educational Support**
   - Explain material terminology and concepts
   - Provide historical context for different material types
   - Help users understand material classification systems
   - Answer detailed questions about construction materials

## Architecture

The Recognition Assistant integrates with the broader KAI platform through several key components:

### Component Structure

```
packages/
├── agents/
│   ├── src/
│   │   ├── frontend/
│   │   │   └── recognitionAssistant.ts   # Agent implementation
│   │   ├── services/
│   │   │   └── serviceFactory.ts         # Service creation system
│   │   ├── tools/
│   │   │   ├── materialSearch.ts         # Material search tool
│   │   │   ├── imageAnalysis.ts          # Image analysis tool
│   │   │   ├── vectorSearch.ts           # Vector search tool
│   │   │   └── index.ts                  # Tool exports
│   │   └── core/
│   │       └── types.ts                  # Agent type definitions
└── client/
    └── src/
        └── components/
            └── agents/
                ├── RecognitionPanel.tsx  # Client-side interface
                └── AgentDashboard.tsx    # Agent integration in UI
```

### Architectural Layers

1. **Agent Layer** (`recognitionAssistant.ts`)
   - Implements the agent's core capabilities
   - Defines specialized methods for recognition tasks
   - Processes user inputs and image uploads
   - Manages context for recognition operations

2. **Service Layer** (via ServiceFactory)
   - Provides access to material data and recognition systems
   - Handles API communication with error management
   - Formats requests and responses appropriately
   - Acts as a bridge to backend services

3. **Tool Layer** (materialSearch, imageAnalysis, vectorSearch)
   - Implements specialized tools for the agent to use
   - Enables material database queries
   - Provides image analysis capabilities
   - Facilitates vector-based similarity searches

4. **UI Layer** (`RecognitionPanel.tsx`)
   - Presents the agent's capabilities in the user interface
   - Handles image upload and display
   - Shows recognition results and agent insights
   - Provides chat interface for agent interaction

## Implementation Details

### Agent Implementation

The Recognition Assistant is a UserFacingAgent type that implements several specialized methods for recognition tasks:

```typescript
export class RecognitionAssistant implements UserFacingAgent {
  // Standard UserFacingAgent properties
  public id: string;
  public type: AgentType;
  public name: string;
  public description: string;
  public agent: Agent;
  public config: AgentConfig;

  // Recognition-specific methods
  public async processUserInput(input: string, context?: Record<string, any>): Promise<string>;
  public async processImage(imageUrl: string, metadata?: Record<string, any>): Promise<string>;
  public async analyzeRecognitionResults(results: any[], context?: Record<string, any>): Promise<string>;
  public async suggestImageImprovements(imageUrl: string, issues: string[]): Promise<string>;
}
```

### Agent Tools

The Recognition Assistant leverages specialized tools to perform its tasks:

```typescript
// Tool for searching materials in the database
const materialSearchTool = await createMaterialSearchTool();

// Tool for analyzing images
const imageAnalysisTool = await createImageAnalysisTool();

// Tool for performing vector-based similarity searches
const vectorSearchTool = await createVectorSearchTool();

// Create a Recognition Assistant with tools
const tools: Tool[] = [
  materialSearchTool,
  imageAnalysisTool,
  vectorSearchTool
];
```

### Client-Side Integration

The Recognition Assistant is integrated into the client interface through a specialized panel that provides:

1. **Image Upload Area** - For submitting materials for recognition
2. **Results Display** - For viewing recognition results with confidence scores
3. **Chat Interface** - For interacting with the agent about results
4. **Image Guidance** - For tips on capturing better images

## Setup Instructions

### Prerequisites

- Functioning KAI platform with image recognition capabilities
- CrewAI integration set up according to [CrewAI installation guide](./agents-crewai-installation.md)
- Materials database with vector search capabilities

### Installation

The Recognition Assistant is included in the standard crewAI integration package:

```bash
# Navigate to the agents directory
cd packages/agents

# Install dependencies if not already done
yarn install
```

### Configuration

Configure the agent in your application initialization:

```typescript
import { createRecognitionAssistant } from '@kai/agents';

// Create a Recognition Assistant instance
const recognitionAssistant = await createRecognitionAssistant(
  {
    id: 'recognition-assistant-1',
    // Additional configuration options
  },
  {
    provider: 'openai',
    name: 'gpt-4',
    temperature: 0.7
  }
);
```

## Usage Examples

### Client-Side Integration

```tsx
import React, { useState } from 'react';
import { RecognitionPanel } from '../components/agents/RecognitionPanel';

const RecognitionPage: React.FC = () => {
  return (
    <div className="recognition-page">
      <h1>Material Recognition</h1>
      <RecognitionPanel />
    </div>
  );
};

export default RecognitionPage;
```

### Processing an Uploaded Image

```typescript
import { createRecognitionAssistant } from '@kai/agents';

// Create the Recognition Assistant
const recognitionAssistant = await createRecognitionAssistant(
  { id: 'recognition-assistant-1' },
  { provider: 'openai', name: 'gpt-4', temperature: 0.7 }
);

// Process an uploaded image
const imageUrl = 'https://example.com/uploaded-image.jpg';
const metadata = {
  originalFileName: 'bathroom-tile.jpg',
  uploadedBy: 'user123',
  dimensions: '1024x768'
};

const insights = await recognitionAssistant.processImage(imageUrl, metadata);
console.log(insights);

// Analyze recognition results
const recognitionResults = [
  { materialId: 'mat123', name: 'Ceramic Tile', confidence: 0.92 },
  { materialId: 'mat456', name: 'Porcelain Tile', confidence: 0.87 },
  { materialId: 'mat789', name: 'Quarry Tile', confidence: 0.65 }
];

const analysis = await recognitionAssistant.analyzeRecognitionResults(recognitionResults);
console.log(analysis);

// Get image improvement suggestions
const imageIssues = ['poor lighting', 'blurry focus', 'inconsistent angle'];
const suggestions = await recognitionAssistant.suggestImageImprovements(imageUrl, imageIssues);
console.log(suggestions);
```

## Advanced Configuration

### Custom Material Search Tools

Create custom tools to enhance the Recognition Assistant's capabilities:

```typescript
import { Tool } from 'crewai';
import { ServiceFactory } from '../services/serviceFactory';

// Create a specialized material search tool for a specific category
const createSpecializedCeramicSearchTool = async (): Promise<Tool> => {
  const materialService = ServiceFactory.getInstance().materialService;
  
  return new Tool({
    name: 'ceramic_tile_search',
    description: 'Search specifically for ceramic tiles with detailed filtering',
    func: async (args) => {
      const { query, filters } = JSON.parse(args);
      
      // Add ceramic filter automatically
      const enhancedFilters = {
        ...filters,
        category: 'ceramic'
      };
      
      const results = await materialService.searchMaterials(query, enhancedFilters);
      return JSON.stringify(results);
    }
  });
};

// Add it to the agent
const recognitionAssistant = await createRecognitionAssistant(
  { id: 'ceramic-specialist-1' },
  { provider: 'openai', name: 'gpt-4', temperature: 0.7 },
  [await createSpecializedCeramicSearchTool()]
);
```

### Integration with External Recognition Systems

Connect the Recognition Assistant to external material recognition APIs:

```typescript
import { Tool } from 'crewai';
import axios from 'axios';

// Create a tool for external material recognition API
const createExternalRecognitionTool = async (): Promise<Tool> => {
  return new Tool({
    name: 'external_recognition',
    description: 'Perform material recognition using an external specialized API',
    func: async (args) => {
      const { imageUrl } = JSON.parse(args);
      
      try {
        const response = await axios.post('https://api.external-recognition.com/analyze', {
          image: imageUrl,
          apiKey: process.env.EXTERNAL_API_KEY
        });
        
        return JSON.stringify(response.data);
      } catch (error) {
        return JSON.stringify({ error: 'External recognition failed', details: error.message });
      }
    }
  });
};

// Add it to the agent
const recognitionAssistant = await createRecognitionAssistant(
  { id: 'multi-system-recognition-1' },
  { provider: 'openai', name: 'gpt-4', temperature: 0.7 },
  [await createExternalRecognitionTool()]
);
```

## Performance Considerations

### Optimizing Image Processing

1. **Image Preprocessing**
   - Implement client-side image resizing before upload
   - Use WebWorkers for browser-based image optimization
   - Apply appropriate compression based on network conditions

2. **Recognition Caching**
   - Cache recognition results for previously analyzed images
   - Implement fingerprinting for image similarity detection
   - Use TTL-based cache invalidation for freshness

3. **Progressive Loading**
   - Show preliminary results while detailed analysis continues
   - Implement priority-based processing queue
   - Display confidence thresholds incrementally

## Security Considerations

1. **Image Storage**
   - Implement proper access controls for uploaded images
   - Define appropriate retention policies
   - Sanitize metadata to prevent information leakage

2. **User Data Protection**
   - Limit collection of identifying information in recognition logs
   - Apply appropriate anonymization for analytics
   - Implement proper consent mechanisms for data usage

3. **Agent Boundaries**
   - Restrict the agent to recognition-related operations
   - Validate inputs to prevent injection attacks
   - Limit sensitive information in responses

## Related Documentation

- [Material Recognition](./material-recognition.md) - Core recognition system architecture
- [CrewAI Integration](./agents-crewai.md) - Overall agent system architecture
- [CrewAI Implementation](./agents-crewai-implementation.md) - Implementation details
- [Agent Installation](./agents-crewai-installation.md) - Setup instructions
- [Client Integration](./client-heroui-integration.md) - Frontend framework details