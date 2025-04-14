# System Dependencies and Integrations

This document provides a comprehensive overview of all dependencies, integrations, and packages used across different systems within the KAI platform. It serves as a reference for developers and should be updated whenever new dependencies are added.

## Table of Contents

- [3D Visualization & Model Generation](#3d-visualization--model-generation)
- [Material Recognition & Property Extraction](#material-recognition--property-extraction)
- [Scene Understanding & Reconstruction](#scene-understanding--reconstruction)
- [Interior Design & Automation](#interior-design--automation)
- [Texture & Content Generation](#texture--content-generation)
- [Mobile & Performance Optimization](#mobile--performance-optimization)
- [Infrastructure & Processing](#infrastructure--processing)
- [Development Tools](#development-tools)

## 3D Visualization & Model Generation

| Dependency | Version | Purpose | Integration Points |
|------------|---------|---------|-------------------|
| **hdrnet-pytorch** | ^0.2.0 | Automatic lighting inference and environment map generation | Used by `LightingEstimationService` to generate HDR environment maps for realistic lighting in 3D visualizations |
| **envmapnet** | ^0.1.0 | Environment map processing and enhancement | Complements HDRNet for improved environment map quality and tone mapping |
| **Three.js** | N/A | 3D rendering library for web-based visualization | Core component for all 3D visualization features in client applications |

### Key Components:
- **LightingEstimationService**: Leverages HDRNet for automatic lighting inference from images
- **MaterialVisualizationProvider**: Uses environment maps for physically-based lighting in 3D scenes
- **ThreeJsViewer**: Renders 3D models with realistic lighting and materials

### Integration Flow:
1. Material images are processed through HDRNet to extract lighting information
2. Generated environment maps are used for physically-based rendering
3. Three.js creates the final visualization with accurate lighting and shadows

## Material Recognition & Property Extraction

| Dependency | Version | Purpose | Integration Points |
|------------|---------|---------|-------------------|
| **materialnet** | ^1.0.0 | Automatic PBR material property extraction | Used by `MaterialNetProvider` to extract physically-based rendering properties from material images |
| **tensorflow-js** | N/A | ML inference for front-end material recognition | Powers client-side material recognition features |
| **pytorch** | N/A | Deep learning framework for advanced material analysis | Backend for material recognition model training and inference |

### Key Components:
- **MaterialNetProvider**: Extracts PBR properties from material images
- **MaterialRecognitionProvider**: Identifies materials from images
- **MaterialVisualizationProvider**: Uses extracted properties for accurate rendering

### Integration Flow:
1. Material images are processed through MaterialNet to extract PBR properties
2. Extracted properties are used to enhance 3D visualizations
3. Recognition results inform material selection and recommendations

## Scene Understanding & Reconstruction

| Dependency | Version | Purpose | Integration Points |
|------------|---------|---------|-------------------|
| **pycolmap** | ^0.3.0 | Camera pose estimation and multi-view consistency | Used by `CameraEstimationProvider` to extract camera poses from multiple images for consistent 3D reconstruction |
| **diffusionnerf** | ^0.1.0 | Enhanced scene optimization with diffusion models | Used by `DiffusionNeRFProvider` to improve scene reconstruction with adaptive quality selection based on input images |
| **point-e** | ^0.1.0 | Point cloud processing, noise reduction, and geometry optimization | Used by `PointCloudProvider` to enhance point cloud processing prior to mesh construction, improve geometry quality, and add denoising capabilities |
| **scene-graph-3d** | ^0.1.0 | 3D scene graph generation for relational understanding | Powers the `SceneGraphProvider` for creating relationship-aware scene representations, semantic queries, and intelligent scene editing tools |

### Key Components:
- **CameraEstimationProvider**: Uses COLMAP for Structure-from-Motion processing and camera pose extraction
- **colmap_sfm_service.py**: Python service that performs the actual COLMAP processing
- **camera-pose.routes.ts**: API endpoints for camera pose estimation and NeRF enhancement
- **DiffusionNeRFProvider**: Extends BaseThreeDProvider to optimize scene reconstruction using diffusion models
- **diffusion_nerf_service.py**: Python service that implements quality assessment and adaptive reconstruction methods
- **scene-optimization.routes.ts**: API endpoints for scene optimization and quality-based reconstruction
- **NeRFProvider**: Handles neural radiance field processing for 3D reconstruction
- **PointCloudProvider**: Processes and optimizes point cloud data with noise reduction and geometry enhancement
- **point_cloud_service.py**: Python service that implements point cloud processing, denoising, and optimization algorithms
- **point-cloud.routes.ts**: API endpoints for point cloud processing, generation, completion, and mesh improvement
- **SceneGraphProvider**: Generates scene graphs for semantic understanding

### Integration Flow:
1. **Camera Pose Estimation**:
   - Multiple images are uploaded through the `/api/camera-pose/estimate` endpoint
   - Images are processed by the COLMAP service to extract camera poses
   - Results include camera intrinsics, extrinsics, and 3D points
   - Optional visualization and NeRF format conversion

2. **NeRF Enhancement**:
   - Existing NeRF data is enhanced with camera poses via the `/api/camera-pose/enhance-nerf` endpoint
   - Improved camera positioning leads to more accurate 3D reconstructions
   - Results are compatible with standard NeRF training pipelines

3. **Scene Optimization**:
   - Images are analyzed for quality assessment via the `/api/scene-optimization/assess` endpoint
   - Based on quality metrics, the appropriate reconstruction method is selected
   - For sparse or incomplete views, DiffusionNeRF is used to fill in missing information
   - Results include enhanced 3D models with improved geometry and textures
   - Optional caching for faster processing of similar scenes

4. **3D Visualization**:
   - Camera pose data is used by the ThreeJsViewer for accurate perspective rendering
   - MaterialVisualizationProvider uses camera positions for consistent material appearance
   - DiffusionNeRFProvider generates optimized scenes for visualization
   - PointCloudProvider optimizes point clouds and improves mesh quality
   - SceneController leverages camera transformation matrices for proper navigation

5. **Material Recognition Integration**:
   - Camera poses provide geometric context for material recognition
   - Multiple views of the same material improve property extraction accuracy
   - DiffusionNeRF models enhance material surfaces for better property extraction
   - MaterialNetProvider benefits from spatial relationships between detected materials

6. **Adaptive Processing Pipeline**:
   - Quality assessment determines the best reconstruction approach:
     - High-quality inputs: Standard NeRF reconstruction
     - Medium-quality inputs: Hybrid approach with DiffusionNeRF enhancement
     - Low-quality inputs: Full DiffusionNeRF reconstruction with regularization
   - Processing results are cached for similar future requests
   - Point-E Integration:
     - Raw point clouds are processed with noise reduction via `/api/point-cloud/process`
     - Text-to-point-cloud generation via `/api/point-cloud/generate`
     - Partial point cloud completion via `/api/point-cloud/complete`
     - Mesh geometry improvement via `/api/point-cloud/improve-mesh`
     - Image-to-point-cloud extraction via `/api/point-cloud/process-image`
   - Scene Graph Generation:
     - **SceneGraphProvider**: Creates relationship-aware scene representations via `/api/scene-graph/*` endpoints
     - **scene_graph_service.py**: Python ML service that implements the 3DSSG algorithms
     - Supports multiple input types:
       - 3D model-based scene graph generation via `/api/scene-graph/generate-from-model`
       - Point cloud-based graph generation via `/api/scene-graph/generate-from-point-cloud`
       - Image-based graph generation via `/api/scene-graph/generate-from-images`
       - Text-based scene description via `/api/scene-graph/generate-from-text`
     - Advanced features:
       - Semantic queries on scene graphs via `/api/scene-graph/query`
       - Layout suggestions via `/api/scene-graph/generate-suggestions`
       - Relationship-aware editing with contextual understanding
       - Support for multiple confidence levels and relationship limits
     - Integration with other components:
       - Works with PointCloudProvider for geometry understanding
       - Enhances MaterialNetProvider with semantic material relationships
       - Improves RoomLayoutProvider with object relationship context

## Interior Design & Automation

| Dependency | Version | Purpose | Integration Points |
|------------|---------|---------|-------------------|
| **spaceformer** | ^0.2.0 | Layout generation and furniture placement | Powers automated interior design features through RoomLayoutProvider and ArchitecturalProvider |

### Key Components:
- **RoomLayoutProvider**: Generates optimized room layouts and handles furniture placement optimization using design principles
- **FurniturePlacementService**: Automatically places furniture in scenes based on accessibility and flow
- **ArchitecturalProvider**: Handles architectural elements, layout constraints, and room structure
- **space_former_service.py**: Python ML service that implements the core SpaceFormer functionality

### Features:
- Automated room layout generation based on room dimensions and type
- Intelligent furniture placement using design principles
- Multi-criteria optimization (flow, accessibility, balance, etc.)
- Layout analysis with improvement suggestions
- Room image processing for layout detection
- Design style enforcement and consistency
- Accessibility scoring and optimization

### API Endpoints:
- **/api/room-layout/generate**: Generate optimized room layouts
- **/api/room-layout/optimize-furniture**: Optimize furniture placement
- **/api/room-layout/analyze**: Analyze existing layouts and provide suggestions
- **/api/room-layout/process-image**: Process room images for layout recognition
- **/api/room-layout/optimize-existing**: Optimize existing layouts

### Integration Flow:
1. Room dimensions and constraints are processed through SpaceFormer
2. Layout suggestions are generated based on design principles
3. Furniture is automatically placed according to the layout
4. Optimization goals can be specified (e.g., prioritize flow, accessibility, or style)
5. Results include metrics for flow, occupancy, accessibility, and design principle compliance

## Texture & Content Generation

| Dependency | Version | Purpose | Integration Points |
|------------|---------|---------|-------------------|
| **text2texture** | ^0.1.0 | Texture generation and enhancement | Improves texture quality and generates new textures from descriptions |

### Key Components:
- **TextureEnhancementProvider**: Enhances and generates textures
- **TextToTextureService**: Converts text descriptions to textures

### Integration Flow:
1. Low-resolution textures are processed for enhancement
2. Text descriptions are converted to high-quality textures
3. Generated textures are applied to 3D models

## Mobile & Performance Optimization

| Dependency | Version | Purpose | Integration Points |
|------------|---------|---------|-------------------|
| **draco3d** | ^1.5.0 | 3D mesh compression for mobile delivery | Optimizes 3D models for mobile and web delivery |
| **assemblyscript** | ^0.27.1 | WebAssembly compilation for browser performance | Used to compile performance-critical components to WebAssembly |

### Key Components:
- **LODGenerator**: Creates multiple detail levels for progressive loading
- **MeshOptimizer**: Compresses and optimizes meshes for delivery
- **WasmProcessor**: Handles WebAssembly compilation and execution

### Integration Flow:
1. 3D models are optimized and compressed using Draco
2. Multiple LODs are generated for progressive loading
3. Performance-critical code is compiled to WebAssembly

## Infrastructure & Processing

| Dependency | Version | Purpose | Integration Points |
|------------|---------|---------|-------------------|
| **serverless** | ^3.30.1 | Serverless function deployment | Used for cloud function management |
| **aws-lambda** | ^1.0.7 | AWS Lambda functionality | Powers serverless processing in AWS environment |
| **apache-airflow-client** | ^2.5.1 | Workflow orchestration | Manages complex processing pipelines |
| **bull** | ^4.10.4 | Redis-based queue for Node.js | Powers distributed task processing |

### Key Components:
- **QueueManager**: Handles distributed task processing
- **WorkflowManager**: Orchestrates complex processing pipelines
- **CloudFunctionService**: Manages serverless function deployment and execution

### Integration Flow:
1. Tasks are submitted to processing queues
2. Workers process tasks in distributed fashion
3. Complex workflows are orchestrated through Airflow
4. Results are stored and made available to clients

## Development Tools

| Dependency | Version | Purpose | Integration Points |
|------------|---------|---------|-------------------|
| **wasm-pack** | ^0.10.3 | WebAssembly packaging | Packages Rust code for WebAssembly |
| **wasm-bindgen-cli** | ^0.2.87 | WebAssembly bindings generator | Generates JavaScript bindings for WebAssembly modules |

### Key Components:
- **BuildTools**: Handles compilation and packaging
- **DevEnvironment**: Manages development environment setup

---

## Updating This Documentation

When adding new dependencies or integrations:

1. Add the dependency to the appropriate section
2. Document its purpose and integration points
3. Update any affected component descriptions
4. If creating a new category, add it to the Table of Contents

Last updated: April 2025