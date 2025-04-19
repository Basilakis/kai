# 3D Visualization System

This document outlines the 3D visualization system's architecture, components, and integration with crewAI.

## Overview

The 3D visualization system provides comprehensive capabilities for:
- 3D reconstruction from images using NeRF-based models
- Text-to-3D generation using multiple models
- Scene understanding and material recognition
- Integration with existing knowledge base
- Gaussian Splatting support for enhanced realism
- WebGPU and WebXR optimizations for improved performance

## Core Components

### 1. Visualization Layer

#### ThreeJsViewer Component
The core visualization component built with Three.js that provides:
- Real-time 3D rendering with WebGL
- WebXR support for AR/VR experiences
- BVH-optimized ray tracing
- Efficient scene management

#### EnhancedThreeJsViewer Component
An advanced viewer extension that provides:
- WebGPU rendering support for modern hardware with performance monitoring
- Gaussian Splatting for photorealistic point cloud rendering with custom shaders
- Adaptive Level of Detail (LOD) optimization with distance-based adjustment
- Hierarchical occlusion culling for performance optimization
- Improved BVH integration with three-mesh-bvh and spatial partitioning
- Progressive texture loading for faster initial rendering
- Deferred rendering pipeline for complex lighting scenarios
- Dynamic memory management for large scene optimization
- Texture compression with automatic format selection
- Instance batching for similar objects
- Support for multiple model formats (GLTF, GLB, FBX, OBJ, PLY, Gaussian Splats)

```typescript
// Example usage of EnhancedThreeJsViewer
<EnhancedThreeJsViewer
  modelUrl="path/to/model.splat"
  modelType="gaussian"
  initialPosition={{ x: 0, y: 0, z: 5 }}
  enableVR={true}
  enableAR={true}
  enableBVH={true}
  enableLOD={true}
  enableOcclusionCulling={true}
  preferWebGPU={true}
  onSceneReady={(scene) => {
    // Scene is ready for interaction
  }}
/>
```

```typescript
// Enhanced configuration options
interface EnhancedViewerOptions {
  // Rendering options
  renderMode: 'webgl' | 'webgl2' | 'webgpu';
  renderPipeline: 'forward' | 'deferred';
  
  // Performance options
  enableInstancing: boolean;
  enableCompression: boolean;
  
  // Feature options
  enableShadows: boolean;
  shadowType: 'basic' | 'pcss' | 'raytraced';
  
  // Optimization options
  cullingStrategy: 'frustum' | 'occlusion' | 'hierarchical';
  lodStrategy: 'distance' | 'performance' | 'quality';
  
  // Progressive loading
  progressiveLoadingEnabled: boolean;
  initialLoadQuality: 'low' | 'medium' | 'high';
  
  // Gaussian splat options
  splatQuality: 'low' | 'medium' | 'high';
  adaptiveSplatRendering: boolean;
  maxSplatCount: number;
}
```

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
- Enhanced with three-mesh-bvh library integration
- Optimized ray casting for interactive applications

![BVH Visualization](docs/images/bvh-optimization.png)

#### Level of Detail (LOD) System
Dynamic mesh simplification based on camera distance:
- Automatic creation of multiple detail levels
- Progressive rendering for complex scenes
- Exponential distance-based detail reduction
- Optimized for mobile and low-power devices

#### Occlusion Culling
Advanced rendering optimization techniques:
- Multi-level hierarchical occlusion culling
- Hardware-accelerated occlusion queries (WebGPU)
- Only renders objects within the view frustum
- Skips rendering for occluded objects
- Software-based occlusion prediction
- Temporal coherence optimization to reduce occlusion testing
- Significant performance boost for complex scenes (up to 70% fewer draw calls)
- Adaptive culling based on object size, distance, and scene complexity
- Dynamic occlusion thresholds based on device performance
- Pre-computed visibility sets for static scenes

```typescript
// Occlusion culling configuration
const occlusionSystem = new HierarchicalOcclusionCulling({
  // Use hardware queries when available
  useHardwareQueries: renderer.capabilities.hasFeature('occlusion-query'),
  
  // How many frames to skip between full occlusion tests
  temporalCoherenceFrames: 5,
  
  // Minimum object size to consider for culling (prevents culling small objects)
  minimumObjectSize: 0.5,
  
  // Pre-compute visibility for static objects
  precomputeStaticVisibility: true,
  
  // Debug visualization
  debugVisualization: false
});

// Register with the renderer
renderer.setOcclusionCulling(occlusionSystem);
```

#### WebXR Integration
Built-in support for immersive experiences:
- VR mode with full scene navigation
- AR mode for real-world integration
- Device capability detection
- Optimized rendering for XR
- Automatic VR/AR button injection
- Performance optimizations for mobile XR

![WebXR Features](docs/images/webxr-features.png)

#### Gaussian Splatting Support
Integration with state-of-the-art point cloud rendering:
- Photorealistic rendering of captured environments with advanced point cloud representation
- Progressive loading of splat data with dynamic level of detail
- Integration with Python Gaussian Splatting service for processing and conversion
- Custom shader implementation with adaptive point sizing and alpha blending
- Real-time environment lighting integration for realistic appearance
- Support for large-scale scenes with millions of points
- Adaptive performance optimization based on device capabilities
- Custom rendering pipeline with optimized draw calls

```typescript
// The GaussianSplattingShader provides custom rendering for splats
const splattingMaterial = new THREE.ShaderMaterial({
  vertexShader: GaussianSplattingShader.vertexShader,
  fragmentShader: GaussianSplattingShader.fragmentShader,
  uniforms: {
    pointSize: { value: 2.0 },
    alphaTest: { value: 0.5 },
    splatTexture: { value: null },
    adaptiveScaling: { value: true },
    maxDistance: { value: 100.0 }
  },
  transparent: true,
  depthTest: true,
  blending: THREE.NormalBlending
});

// The GaussianSplattingLoader handles splat file formats
const loader = new GaussianSplattingLoader();
const model = await loader.loadAsync("path/to/model.splat");
scene.add(model);
```

#### WebGPU Integration
Next-generation graphics API support:
- Automatic capability detection with feature-level testing
- Seamless fallback to WebGL when WebGPU is unavailable
- Performance optimization with up to 50% better frame rates on compatible hardware
- Advanced rendering features including compute shaders for complex calculations
- Hardware-accelerated ray tracing on supported devices
- Pipeline state caching for efficient render state management
- Bindless textures for improved material rendering performance
- Prepared for future rendering pipeline upgrades with extensible architecture

```typescript
// WebGPU initialization with fallback
const renderer = await initRenderer({
  preferWebGPU: true,
  fallbackToWebGL: true,
  powerPreference: 'high-performance',
  antialias: true,
  enableRayTracing: hasRayTracingSupport()
});

// Feature detection example
if (renderer.capabilities.hasFeature('compute-shaders')) {
  // Enable advanced compute features
  scene.enableParticleSimulation();
  scene.enableFluidDynamics();
}
```

### 2. Image Processing Pipeline
- **Room Layout Extraction**
  * HorizonNet for initial layout analysis
  * CubeMap for room mapping
  * Scene cleanup with BlenderProc
  * Integration with Gaussian Splatting for photorealistic reconstruction

- **Scene Understanding**
  * YOLO v8 for object detection
  * MiDaS for depth estimation
  * SAM for scene segmentation

### 3. Text Processing Pipeline
- **Base Structure Generation**
  * Shap-E for generating base house structure
  * GET3D for detailed scene generation
  * Hunyuan3D-2 for alternative generation
  * Support for direct GLB/GLTF output formats

### 4. Material Integration
- Leverages existing knowledge base
- Vector similarity search
- Material suggestions based on context
- Integration with FurnitureMaterialEditor component
- Real-time material previews using PBR workflows

## Model Integration

### NeRF-based Models
- **NerfStudio Integration**
  * Scene reconstruction from multiple views
  * Lighting estimation
  * Material property extraction
  * Conversion pipeline to Gaussian Splatting format

- **Instant-NGP**
  * Fast reconstruction capabilities
  * Real-time preview generation
  * Optimization for performance
  * Direct export to Three.js compatible formats

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