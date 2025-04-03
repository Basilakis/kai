# 3D Visualization System

This document outlines the 3D visualization system's architecture, components, and integration with crewAI.

## Overview

The 3D visualization system provides comprehensive capabilities for:
- 3D reconstruction from images using NeRF-based models
- Text-to-3D generation using multiple models
- Scene understanding and material recognition
- Integration with existing knowledge base

## Core Components

### 1. Visualization Layer

#### ThreeJsViewer Component
The core visualization component built with Three.js that provides:
- Real-time 3D rendering with WebGL
- WebXR support for AR/VR experiences
- BVH-optimized ray tracing
- Efficient scene management

![ThreeJsViewer Architecture](docs/images/threejs-viewer-architecture.png)

```typescript
// Example usage of ThreeJsViewer
<ThreeJsViewer
  modelUrl="path/to/model.glb"
  modelType="3d"
  enableVR={true}
  enableAR={true}
  enableBVH={true}
  onSceneReady={(scene) => {
    // Scene is ready for interaction
  }}
/>
```

#### SceneController Component
Manages scene modifications and real-time updates:
- Batch processing for performance
- Real-time preview system
- Export capabilities for multiple formats
- Object selection and manipulation

![Scene Controller Flow](docs/images/scene-controller-flow.png)

```typescript
// Example usage of SceneController
<SceneController
  scene={scene}
  enableRealTimePreview={true}
  previewInterval={100}
>
  {/* Child components receive scene control props */}
</SceneController>
```

#### Export Capabilities
Support for multiple 3D formats:
- GLB/GLTF with metadata preservation
- FBX export
- OBJ export
- Configurable texture and quality settings

![Export Options](docs/images/export-options.png)

#### BVH Optimization
Automatic Bounding Volume Hierarchy for improved performance:
- Faster ray tracing and intersection tests
- Optimized scene traversal
- Automatic updates on geometry changes

![BVH Visualization](docs/images/bvh-optimization.png)

#### WebXR Integration
Built-in support for immersive experiences:
- VR mode with full scene navigation
- AR mode for real-world integration
- Device capability detection
- Optimized rendering for XR

![WebXR Features](docs/images/webxr-features.png)

### 2. Image Processing Pipeline
- **Room Layout Extraction**
  * HorizonNet for initial layout analysis
  * CubeMap for room mapping
  * Scene cleanup with BlenderProc

- **Scene Understanding**
  * YOLO v8 for object detection
  * MiDaS for depth estimation
  * SAM for scene segmentation

### 2. Text Processing Pipeline
- **Base Structure Generation**
  * Shap-E for generating base house structure
  * GET3D for detailed scene generation
  * Hunyuan3D-2 for alternative generation

### 3. Material Integration
- Leverages existing knowledge base
- Vector similarity search
- Material suggestions based on context

## Model Integration

### NeRF-based Models
- **NerfStudio Integration**
  * Scene reconstruction from multiple views
  * Lighting estimation
  * Material property extraction

- **Instant-NGP**
  * Fast reconstruction capabilities
  * Real-time preview generation
  * Optimization for performance

### Text-to-3D Models
- **Shap-E**
  * Base structure generation
  * Coarse layout definition
  * Initial scene composition

- **GET3D**
  * Detailed object generation
  * Furniture placement
  * Scene refinement

- **Hunyuan3D-2**
  * Alternative generation approach
  * Style-based modifications
  * Scene variations

### Scene Understanding Models
- **YOLO v8**
  * Object detection and classification
  * Spatial relationship analysis
  * Scene composition understanding

- **MiDaS**
  * Depth estimation from single images
  * Spatial understanding
  * Scene structure analysis

- **SAM (Segment Anything Model)**
  * Object and wall segmentation
  * Material boundary detection
  * Scene component isolation

## CrewAI Integration

### 3D Designer Agent
The system includes a specialized 3D Designer agent that:
- Processes both images and text descriptions
- Coordinates multiple model pipelines
- Integrates with material knowledge base
- Provides natural language interaction

```typescript
// Example agent configuration
const config: ThreeDDesignerConfig = {
  knowledgeBaseUrl: process.env.KNOWLEDGE_BASE_URL,
  modelEndpoints: {
    nerfStudio: process.env.NERF_STUDIO_ENDPOINT,
    instantNgp: process.env.INSTANT_NGP_ENDPOINT,
    shapE: process.env.SHAPE_E_ENDPOINT,
    get3d: process.env.GET3D_ENDPOINT,
    hunyuan3d: process.env.HUNYUAN3D_ENDPOINT,
    blenderProc: process.env.BLENDER_PROC_ENDPOINT
  }
};
```

### LLM Integration
- Uses ChatOpenAI for natural language processing
- Handles multimodal inputs (text + images)
- Provides detailed explanations and suggestions

## Usage Examples

### Image-based Reconstruction
```typescript
// Process an image for 3D reconstruction
const result = await threeDService.processImageInput(image, {
  detectObjects: true,
  estimateDepth: true,
  segmentScene: true
});
```

### Text-based Generation
```typescript
// Generate a 3D scene from text description
const scene = await threeDService.processTextInput(description, {
  style: "modern",
  constraints: {
    roomSize: "large",
    lighting: "natural"
  }
});
```

### Scene Refinement
```typescript
// Refine generated scene based on feedback
const refined = await threeDService.refineResult(scene, feedback, {
  focusAreas: ["lighting", "materials"],
  preserveStructure: true
});
```

## Dependencies

### Required Packages
- @langchain/openai for LLM integration
- Three.js for 3D visualization
- TensorFlow.js for client-side inference

### Model Dependencies
- NeRF-based models (NerfStudio, Instant-NGP)
- Text-to-3D models (Shap-E, GET3D, Hunyuan3D-2)
- Scene understanding models (YOLO v8, MiDaS, SAM)

## Setup Instructions

1. Install required packages:
```bash
npm install @langchain/openai three @tensorflow/tfjs
```

2. Configure environment variables:
```env
OPENAI_API_KEY=your_key_here
KNOWLEDGE_BASE_URL=your_kb_url
NERF_STUDIO_ENDPOINT=your_endpoint
# ... additional endpoints
```

3. Initialize the service:
```typescript
const threeDService = new ThreeDService(config);
```

## Best Practices

### Image Input
- Provide clear, well-lit images
- Include multiple angles when possible
- Ensure good contrast and minimal noise

### Text Descriptions
- Be specific about spatial relationships
- Include material preferences
- Specify style and constraints clearly

### Scene Refinement
- Provide focused feedback
- Specify areas for improvement
- Include reference images when possible

## Error Handling

The system includes comprehensive error handling:
- Input validation
- Model availability checks
- Processing pipeline monitoring
- Graceful fallbacks

## Performance Considerations

- Model selection based on requirements
- Caching for frequent operations
- Progressive loading for large scenes
- Optimization options for different devices

## Future Improvements

Planned enhancements include:
- Additional model integrations
- Real-time collaboration features
- Enhanced material suggestions
- Improved performance optimization