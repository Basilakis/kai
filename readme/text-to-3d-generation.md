# Text-to-3D Generation System

A comprehensive system for generating 3D house models from text descriptions, combining multiple AI models and techniques for realistic and physically accurate results.

## Core Components

### 1. House Outline Generation
- **ControlNet + Stable Diffusion** for initial architectural sketching
- Edge detection and guidance for accurate outlines
- Architectural feasibility validation
- Sketch refinement with professional blueprint styling

### 2. House Shell Generation (Shap-E)
- Base structure generation from text descriptions
- Feature-preserving mesh processing
- Structure refinement with feedback integration
- Normal computation and UV mapping

### 3. Object & Furniture Generation (GET3D)
- Integration with NVIDIA's GET3D model
- 3D-FRONT dataset for reference and training
- CLIP-based validation for style matching
- Furniture optimization and placement

### 4. Scene Layout & Physics
- DiffuScene/SceneDiffuser for layout optimization
- PyBullet physics-based validation
- Graph-based planning for multi-level homes
- Manual adjustment capabilities

## Technical Implementation

### House Outline Generation
```plaintext
Text Description → ControlNet Sketch → Stable Diffusion Refinement → Architectural Blueprint
```

Key features:
- Canny edge detection for architectural guidance
- Professional blueprint style enforcement
- Architectural feasibility validation

### House Shell Generation
```plaintext
Text → Shap-E Model → Base Structure → Refinement → Final Shell
```

Features:
- Feature-preserving mesh processing
- Normal computation
- UV mapping for texturing
- Interactive refinement

### Furniture Generation & Placement
```plaintext
Text → GET3D → 3D-FRONT Reference → CLIP Validation → Optimized Furniture
```

Capabilities:
- Style-matched furniture generation
- Physics-based placement validation
- Multi-level planning support

### Scene Optimization
```plaintext
Layout → DiffuScene → Physics Validation → Final Scene
```

Features:
- Graph-based room connectivity
- Physics-based stability checking
- Manual adjustment support

## Integration with External Models

### ControlNet Integration
- Uses `sd-controlnet-canny` for edge detection
- Custom architectural guidance parameters
- Blueprint style enforcement

### Shap-E Integration
- Base model: `openai/shap-e-base`
- Custom refinement pipeline
- Feature preservation system

### GET3D Integration
- Base model: `nvidia/get3d-base`
- 3D-FRONT dataset integration
- CLIP-based validation

### DiffuScene Integration
- Scene optimization with physics
- Multi-level planning support
- PyBullet physics validation

## System Requirements

### Hardware Requirements
- GPU memory requirements:
  - ControlNet + Stable Diffusion: ~8GB
  - Shap-E: ~6GB
  - GET3D: ~8GB
  - DiffuScene: ~4GB

- CPU requirements:
  - Multi-core processor recommended
  - 16GB+ RAM for large scenes
  - Fast storage for model weights

- Network requirements:
  - Initial model downloads: ~20GB
  - Runtime API calls for style matching

## Model Weights and Dependencies

### Required Models
- ControlNet: `lllyasviel/sd-controlnet-canny`
- Stable Diffusion: `runwayml/stable-diffusion-v1-5`
- Shap-E: `openai/shap-e-base`
- GET3D: `nvidia/get3d-base`
- CLIP: `openai/clip-vit-base-patch32`
- DiffuScene: `scene-diffuser/diffuscene-base`

### Dataset Requirements
- 3D-FRONT dataset for furniture reference
- House templates for architectural guidance
- Style reference database

## Physics Validation

### PyBullet Configuration
- Gravity: -9.81 m/s²
- Solver iterations: 50
- Contact breaking threshold: 0.001
- Cone friction enabled

### Stability Checks
- Vertical movement threshold: 0.05m
- Tilt threshold: ~5.7 degrees
- Simulation duration: 4 seconds at 60Hz

## Multi-Level Planning

### Graph-Based Approach
- Room connectivity analysis
- Level transition optimization
- Traffic flow consideration
- Clearance validation

### Connection Types
- Stairs
- Elevators
- Open spaces
- Doorways

## Style Application

### Geometric Patterns
- Wave patterns
- Noise patterns
- Custom deformations

### Style Parameters
- Pattern scale
- Pattern strength
- Deformation types

## Optimization Features

### Mesh Optimization
- Vertex count limitation (10,000 max)
- Feature preservation
- Duplicate vertex removal
- Vertex cache optimization

### Layout Optimization
- Room connectivity
- Furniture placement
- Physics constraints
- Multi-level alignment

## Error Handling

### Physics Validation
- Unstable placement detection
- Automatic position adjustment
- Collision resolution
- Floor contact enforcement

### Model Fallbacks
- Alternative position sampling
- Style matching thresholds
- Geometry simplification
- Layout adjustment strategies

## Future Improvements

### Planned Enhancements
- Real-time visualization
- Interactive refinement UI
- Additional style references
- Enhanced physics simulation

### Research Areas
- Advanced material generation
- Dynamic furniture placement
- Improved style transfer
- Real-time optimization

## Contributing

### Development Setup
1. Clone repository
2. Install dependencies
3. Download model weights
4. Configure environment

### Testing
- Unit tests for components
- Integration tests for pipeline
- Physics validation tests
- Style application tests

## Rendering & Visualization Layer

### Web-Based Visualization
- Three.js/Babylon.js integration for real-time rendering
- WebGL-based rendering pipeline
- Custom shaders for material visualization
- Progressive loading for large scenes

### User Interaction
- Orbit controls for camera navigation
- Object transformation controls (translate, rotate, scale)
- Scene hierarchy manipulation
- Real-time property editing

### Real-Time Preview System
- Progressive refinement rendering
- Material preview with PBR support
- Lighting preview with real-time shadows
- Interactive furniture placement

### Export Capabilities
- GLB/GLTF export with full material support
- FBX export with scene hierarchy preservation
- OBJ export with material and UV preservation
- Custom metadata preservation across formats

### Performance Optimization
- BVH (Bounding Volume Hierarchy) implementation
  - Spatial partitioning for ray tracing
  - Dynamic updates for scene modifications
  - Optimized intersection testing
  - Level-of-Detail (LOD) management

### WebXR Integration
- VR mode with motion controls
- AR mode for real-world visualization
- Hand tracking for natural interaction
- Spatial anchoring for AR placement

### Technical Details

#### Rendering Pipeline
```plaintext
Scene Graph → BVH Update → Frustum Culling → Draw Call Optimization → WebGL Render
```

#### BVH Implementation
- Dynamic BVH construction
- Surface Area Heuristic (SAH)
- Parallel BVH traversal
- Automatic rebalancing

#### WebXR Features
- 6-DOF tracking
- Controller ray-casting
- Occlusion handling
- Spatial mapping

#### Export Process
```plaintext
Scene → Metadata Collection → Format-Specific Optimization → Buffer Generation → File Export
```

### Performance Considerations

#### BVH Optimization
- Maximum tree depth: 16
- Minimum node size: 32 triangles
- Rebalance threshold: 25% imbalance
- Update frequency: Per frame for dynamic objects

#### Rendering Optimization
- Draw call batching
- Texture atlas generation
- Shader permutation management
- Occlusion culling

#### Memory Management
- Geometry instancing
- Texture streaming
- Mesh decimation
- Resource pooling

### Development Guidelines

#### Adding New Features
1. Implement core functionality
2. Add WebXR support
3. Optimize performance
4. Add export support

#### Testing Requirements
- Performance benchmarks
- VR/AR compatibility
- Export format validation
- Cross-browser testing

## License
MIT License - See LICENSE file for details