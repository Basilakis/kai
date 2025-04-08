# 3D Designer Agent

This document provides detailed information about the 3D Designer Agent, a specialized crewAI agent focused on 3D visualization, design, and intelligent furniture placement within the KAI platform.

## Overview

The 3D Designer Agent enables the transformation of both images and text descriptions into detailed 3D environments. It can process 2D architectural drawings, generate room layouts from text descriptions, place furniture with physical accuracy, and refine designs based on user feedback. The agent integrates material knowledge with spatial understanding to create coherent, realistic 3D visualizations.

## Key Capabilities

The 3D Designer Agent offers multiple specialized functions:

1. **2D to 3D Conversion**
   - Process architectural drawings and convert to 3D models
   - Identify room layouts, walls, windows, and doors
   - Maintain architectural proportions and standards
   - Suggest appropriate materials for detected elements

2. **Text-to-3D Generation**
   - Generate 3D room layouts from text descriptions
   - Create multiple interconnected rooms with correct relationships
   - Implement specified architectural styles and proportions
   - Produce physically accurate and aesthetically pleasing environments

3. **Intelligent Furniture Placement**
   - Position furniture with physics-based constraints
   - Ensure proper clearances and functional arrangements
   - Optimize layouts for traffic flow and usability
   - Maintain style consistency across furniture selections

4. **Material Integration**
   - Search and recommend appropriate materials for surfaces
   - Apply materials with correct texture mappings and scale
   - Ensure material compatibility and style coherence
   - Integrate with KAI's material database for rich selections

5. **Design Refinement**
   - Iteratively improve designs based on feedback
   - Modify elements while maintaining structural integrity
   - Adjust material selections and furniture placement
   - Provide explanations for design decisions and changes

## Architecture

The 3D Designer Agent integrates with the broader KAI platform through several key components:

### Component Structure

```
packages/
├── agents/
│   ├── src/
│   │   ├── frontend/
│   │   │   └── threeDDesignerAgent.ts  # Agent implementation
│   │   ├── services/
│   │   │   ├── 3d-designer/
│   │   │   │   ├── threeDService.ts    # 3D visualization service
│   │   │   │   └── furniturePlacementService.ts  # Furniture layout
│   │   │   ├── materialService.ts      # Material data access
│   │   │   ├── vectorService.ts        # Vector search capabilities
│   │   │   └── serviceFactory.ts       # Service creation system
│   │   └── core/
│   │       └── types.ts                # Agent type definitions
└── client/
    └── src/
        └── components/
            └── agents/
                ├── ThreeDDesignerPanel.tsx  # Client-side interface
                └── AgentDashboard.tsx       # Agent integration in UI
```

### Architectural Layers

1. **Agent Layer** (`threeDDesignerAgent.ts`)
   - Implements the agent's core capabilities
   - Processes user inputs (drawings and text descriptions)
   - Coordinates multiple services for comprehensive results
   - Generates detailed explanations of designs and choices

2. **Service Layer**
   - `threeDService.ts`: Handles 3D visualization and rendering
   - `furniturePlacementService.ts`: Manages physics-based furniture placement
   - `materialService.ts`: Accesses material database
   - `vectorService.ts`: Provides vector-based similarity searches

3. **Visualization Layer**
   - Integrates with multiple 3D generation models
   - Processes inputs through specialized neural networks
   - Generates renderable 3D models with proper materials
   - Validates physical constraints and optimization

4. **UI Layer** (`ThreeDDesignerPanel.tsx`)
   - Provides input interfaces for drawings and text descriptions
   - Displays 3D visualization results
   - Enables interactive feedback and refinement
   - Offers material browsing and selection

## Implementation Details

### Agent Implementation

The 3D Designer Agent implements several specialized methods for 3D design tasks:

```typescript
export class ThreeDDesignerAgent extends Agent {
  // Service integrations
  private threeDService: ThreeDService;
  private materialService: MaterialService;
  private vectorService: VectorService;
  private furniturePlacementService: FurniturePlacementService;

  // Core functionality methods
  public async process2DDrawing(task: Task): Promise<any>;
  public async generateRoomFromText(task: Task): Promise<any>;
  public async refineResult(task: Task): Promise<any>;
  
  // Helper methods
  private async searchRelevantMaterials(result: any): Promise<MaterialDetails[]>;
  private extractMaterialRequirements(result: any): { query: string; filters: Record<string, any> };
  private async generateArchitecturalResponse(layout: RoomLayout, materials: MaterialDetails[]): Promise<string>;
  private async generateRoomLayoutResponse(rooms: RoomLayout[], materials: MaterialDetails[]): Promise<string>;
  private async generateRefinementResponse(result: any, feedback: string): Promise<string>;
}
```

### Configuration Options

The 3D Designer Agent is configured with specific endpoints and resources:

```typescript
interface ThreeDDesignerConfig {
  knowledgeBaseUrl: string;
  modelEndpoints: {
    nerfStudio: string;
    instantNgp: string;
    shapE: string;
    get3d: string;
    hunyuan3d: string;
    blenderProc: string;
    architecturalRecognition: string;
    roomLayoutGenerator: string;
  };
  threeDFrontPath: string; // Path to 3D-FRONT dataset for furniture models
}
```

### Response Generation

The agent uses Claude's multimodal capabilities to generate detailed explanations:

```typescript
private async invokeLLM(prompt: string, options?: {
  system?: string;
  messages?: Array<{
    role: string;
    content: Array<{
      type: string;
      text?: string;
      source?: {
        type: string;
        media_type: string;
        data: string;
      };
    }>;
  }>;
}): Promise<string>
```

### Client-Side Integration

The 3D Designer Agent is integrated into the client interface through a specialized panel with:

1. **Input Options** - Drawing upload and text description interface
2. **3D Visualization** - Interactive 3D viewer for results
3. **Material Selection** - Interface for browsing and applying materials
4. **Feedback Mechanisms** - Tools for refining and adjusting designs

## Setup Instructions

### Prerequisites

- Functioning KAI platform with 3D visualization capabilities
- CrewAI integration set up according to [CrewAI installation guide](./agents-crewai-installation.md)
- Materials database with vector search capabilities
- Access to 3D furniture models (e.g., 3D-FRONT dataset)
- Anthropic API key for Claude model access

### Installation

The 3D Designer Agent is included in the standard crewAI integration package:

```bash
# Navigate to the agents directory
cd packages/agents

# Install dependencies if not already done
yarn install
```

### Configuration

Configure the agent in your application initialization:

```typescript
import { ThreeDDesignerAgent } from '@kai/agents/frontend/threeDDesignerAgent';

// Create a 3D Designer Agent instance
const threeDDesignerAgent = new ThreeDDesignerAgent({
  knowledgeBaseUrl: process.env.KNOWLEDGE_BASE_URL,
  modelEndpoints: {
    nerfStudio: process.env.NERF_STUDIO_ENDPOINT,
    instantNgp: process.env.INSTANT_NGP_ENDPOINT,
    shapE: process.env.SHAPE_ENDPOINT,
    get3d: process.env.GET3D_ENDPOINT,
    hunyuan3d: process.env.HUNYUAN3D_ENDPOINT,
    blenderProc: process.env.BLENDER_PROC_ENDPOINT,
    architecturalRecognition: process.env.ARCHITECTURAL_RECOGNITION_ENDPOINT,
    roomLayoutGenerator: process.env.ROOM_LAYOUT_GENERATOR_ENDPOINT
  },
  threeDFrontPath: process.env.THREE_D_FRONT_PATH
});
```

## Usage Examples

### Client-Side Integration

```tsx
import React from 'react';
import { ThreeDDesignerPanel } from '../components/agents/ThreeDDesignerPanel';

const ThreeDDesignerPage: React.FC = () => {
  return (
    <div className="threeD-designer-page">
      <h1>3D Designer</h1>
      <ThreeDDesignerPanel />
    </div>
  );
};

export default ThreeDDesignerPage;
```

### Processing a 2D Architectural Drawing

```typescript
import { ThreeDDesignerAgent } from '@kai/agents/frontend/threeDDesignerAgent';
import { Task } from 'crewai';

// Create the 3D Designer Agent
const threeDDesignerAgent = new ThreeDDesignerAgent({
  // Configuration options
  knowledgeBaseUrl: 'https://api.example.com/knowledge-base',
  modelEndpoints: {
    // Model endpoints
  },
  threeDFrontPath: '/path/to/3d-front'
});

// Process a 2D architectural drawing
const task = new Task({
  description: JSON.stringify({
    drawing: 'base64-encoded-image-of-architectural-drawing'
  })
});

const result = await threeDDesignerAgent.process2DDrawing(task);
console.log(result.layout);
console.log(result.materials);
console.log(result.explanation);
```

### Generating a Room from Text Description

```typescript
import { ThreeDDesignerAgent } from '@kai/agents/frontend/threeDDesignerAgent';
import { Task } from 'crewai';

// Create the 3D Designer Agent
const threeDDesignerAgent = new ThreeDDesignerAgent({
  // Configuration options
});

// Generate rooms from text description
const task = new Task({
  description: JSON.stringify({
    rooms: [
      {
        type: 'living',
        dimensions: { width: 5, length: 7, height: 2.8 },
        features: ['large windows', 'fireplace', 'open plan']
      },
      {
        type: 'kitchen',
        dimensions: { width: 4, length: 5, height: 2.8 },
        features: ['island counter', 'modern appliances']
      }
    ],
    style: 'modern minimalist'
  })
});

const result = await threeDDesignerAgent.generateRoomFromText(task);
console.log(result.rooms);
console.log(result.materials);
console.log(result.explanation);
```

### Refining a Design Based on Feedback

```typescript
import { ThreeDDesignerAgent } from '@kai/agents/frontend/threeDDesignerAgent';
import { Task } from 'crewai';

// Create the 3D Designer Agent
const threeDDesignerAgent = new ThreeDDesignerAgent({
  // Configuration options
});

// Refine a design based on feedback
const task = new Task({
  description: JSON.stringify({
    result: previousDesignResult,
    feedback: "The living room feels cramped. Please make it more spacious and move the sofa away from the window. Also, I'd prefer warmer wood tones for the flooring.",
    options: {
      preserveLayout: true,
      adjustFurniture: true,
      changeMaterials: true
    }
  })
});

const refinedResult = await threeDDesignerAgent.refineResult(task);
console.log(refinedResult.result);
console.log(refinedResult.explanation);
```

## Advanced Configuration

### Custom Material Integration

Enhance the 3D Designer Agent with specialized material integration:

```typescript
import { ThreeDDesignerAgent } from '@kai/agents/frontend/threeDDesignerAgent';
import { CustomMaterialService } from './customMaterialService';

// Create a custom material service
const customMaterialService = new CustomMaterialService({
  baseURL: 'https://api.example.com/custom-materials',
  apiKey: process.env.CUSTOM_MATERIALS_API_KEY
});

// Override the material service in the agent
const threeDDesignerAgent = new ThreeDDesignerAgent({
  // Standard configuration
});

// Replace the material service with custom implementation
threeDDesignerAgent.setMaterialService(customMaterialService);
```

### Physics-Based Optimization Settings

Customize the physics constraints for furniture placement:

```typescript
import { ThreeDDesignerAgent } from '@kai/agents/frontend/threeDDesignerAgent';

// Create the 3D Designer Agent
const threeDDesignerAgent = new ThreeDDesignerAgent({
  // Standard configuration
});

// Generate a room with custom physics constraints
const task = new Task({
  description: JSON.stringify({
    rooms: [{
      type: 'living',
      dimensions: { width: 5, length: 7, height: 2.8 }
    }],
    style: 'modern',
    physicsConstraints: {
      gravitationalForce: 9.8,
      frictionCoefficient: 0.5,
      minClearance: {
        walkways: 0.8,  // 80cm for walkways
        seating: 0.45,  // 45cm between seating
        walls: 0.05     // 5cm from walls
      },
      optimizationGoals: {
        conversation: 0.8,  // Weight for conversation-friendly layouts
        viewingAngles: 0.6, // Weight for optimal TV/window viewing
        traffic: 0.7        // Weight for smooth traffic flow
      }
    }
  })
});

const result = await threeDDesignerAgent.generateRoomFromText(task);
```

## Performance Considerations

### 3D Model Optimization

1. **Level-of-Detail Management**
   - Implement progressive LOD based on camera distance
   - Optimize polygon counts for interactive viewing
   - Use instancing for repeated elements (furniture, fixtures)

2. **Texture Optimization**
   - Apply texture compression appropriate for web viewing
   - Implement material atlasing for reduced draw calls
   - Use mipmap generation for distant textures

3. **Scene Graph Optimization**
   - Implement frustum culling for large scenes
   - Use spatial partitioning for complex environments
   - Batch similar materials to reduce state changes

## Security Considerations

1. **Input Validation**
   - Sanitize all image and text inputs
   - Validate architectural specifications against safety standards
   - Implement size and complexity limits for 3D generation

2. **Resource Management**
   - Implement timeouts for long-running 3D operations
   - Set memory limits for complex scene generation
   - Use job queuing for resource-intensive operations

3. **Access Control**
   - Restrict access to 3D generation capabilities as needed
   - Implement usage quotas for resource-intensive operations
   - Track and audit usage patterns for security monitoring

## Related Documentation

- [3D Reconstruction Pipeline](./3d-reconstruction-pipeline.md) - Details on the underlying 3D technologies
- [3D Visualization](./3d-visualization.md) - Visualization system architecture
- [Material Recognition](./material-recognition.md) - Integration with material recognition
- [CrewAI Integration](./agents-crewai.md) - Overall agent system architecture
- [Text-to-3D Generation](./text-to-3d-generation.md) - Text-to-3D model details