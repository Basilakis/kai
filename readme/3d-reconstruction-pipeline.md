# 3D Reconstruction Pipeline

This document outlines the 3D reconstruction pipeline implementation for the CrewAI 3D Visual Builder.

## Components Overview

### 1. Room Layout Extraction
- **HorizonNet + CubeMap**
  - Uses HorizonNet for accurate room boundary detection
  - CubeMap generation for complete room visualization
  - Handles complex room geometries and layouts
  - Dependencies: `horizon-net>=1.0.0`

### 2. Depth Estimation
- **MiDaS Integration**
  - High-quality monocular depth estimation
  - Post-processing pipeline for NeRF compatibility
  - Confidence map generation
  - Dependencies: `midas-py>=1.0.0`

### 3. Room Segmentation
- **Segment Anything Model (SAM)**
  - Precise room element segmentation
  - Wall, floor, ceiling detection
  - Object boundary identification
  - Dependencies: `segment-anything>=1.0`

### 4. Object Detection
- **YOLO v8**
  - Real-time object detection and classification
  - Furniture and fixture identification
  - High-confidence scoring system
  - Dependencies: `ultralytics>=8.0.0`

### 5. NeRF-based Scene Reconstruction
- **NerfStudio/Instant-NGP**
  - Parallel training implementation
  - Multi-view synthesis
  - High-quality scene reconstruction
  - Dependencies:
    - `nerfstudio>=0.3.0`
    - `instant-ngp>=1.0.0`

### 6. Gaussian Splatting as an Alternative
- **Gaussian Splatting Implementation**
  - 10-20x faster rendering speeds compared to traditional NeRF
  - Comparable or better visual quality with improved detail retention
  - More efficient training (hours instead of days)
  - Better handling of complex geometries and transparent/reflective surfaces
  
  **Technical Implementation:**
  - Based on 3D Gaussian Splatting framework and NVIDIA's Splatfacto
  - Custom Python service (`gaussian_splatting_service.py`) handles:
    - 3D point cloud to Gaussian primitives conversion
    - Optimization of 3D Gaussians (position, scale, rotation, opacity)
    - Progressive coarsening for LOD management
    - Export to mesh and point-cloud formats
  
  **Integration Points:**
  - TypeScript bridge (`gaussian-splatting-bridge.ts`) connects frontend to Python backend
  - Enhanced ThreeJS viewer with dedicated GaussianSplattingLoader
  - Support for real-time Gaussian rendering with WebGL
  - Progressive loading and streaming for large scenes
  
  **Compatibility Considerations:**
  - Hardware requirements: 
    - GPU with 8GB+ VRAM for training
    - Standard WebGL-capable GPU for rendering
  - Browser compatibility:
    - Full support in Chrome/Edge/Firefox with WebGL 2.0
    - Limited support in Safari (iOS performance limitations)
  - Memory usage:
    - Can require 1.5-2x more memory than mesh-based formats for complex scenes
    - Progressive streaming helps mitigate memory issues on mobile devices
  
  **Potential Integration Issues:**
  - Non-trivial conversion from Gaussian representation to traditional meshes
  - May require custom shader implementation for optimal rendering
  - Cannot use standard PBR material system directly on Gaussian points
  - Limited multi-user editing capabilities for Gaussian-based scenes
  
  **Advantages over NeRF:**
  - Real-time rendering without separate mesh extraction step
  - Better preservation of fine details and transparency
  - More efficient training pipeline (3-5x faster)
  - Direct export to optimized point cloud formats
  - Better interaction with scene lighting and global illumination

### 6. 3D Model Processing
- **BlenderProc**
  - Automated texturing pipeline
  - UV mapping optimization
  - Material property extraction
  - Dependencies: `blenderproc>=2.6.0`

### 7. Edge Refinement
- **Marching Cubes (Open3D)**
  - Mesh optimization
  - Edge detection and refinement
  - Surface smoothing
  - Dependencies: `open3d>=0.17.0`

## Setup and Installation

1. Install Python dependencies:
```bash
cd packages/ml
pip install -r requirements.txt
```

2. Install Node.js dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your settings
```

## Pipeline Workflow

1. **Input Processing**
   - Image validation
   - Format conversion
   - Resolution optimization

2. **Layout Analysis**
   ```mermaid
   graph TD
     A[Input Image] --> B[HorizonNet]
     B --> C[Layout Extraction]
     C --> D[CubeMap Generation]
     D --> E[Room Structure]
   ```

3. **Depth and Segmentation**
   ```mermaid
   graph TD
     A[Processed Image] --> B[MiDaS]
     A --> C[SAM]
     B --> D[Depth Map]
     C --> E[Room Segments]
     D --> F[NeRF Input]
     E --> F
   ```

4. **Object Recognition**
   ```mermaid
   graph TD
     A[Scene] --> B[YOLO v8]
     B --> C[Object Detection]
     C --> D[Classification]
     D --> E[Spatial Mapping]
   ```

5. **3D Reconstruction**
   ```mermaid
   graph TD
     A[Processed Data] --> B[NeRF Training]
     B --> C[Scene Reconstruction]
     C --> D[BlenderProc]
     D --> E[Final Model]
   ```

## Implementation Details

### TypeScript Bridge
The `ReconstructionBridge` class (`packages/ml/src/reconstruction-bridge.ts`) handles communication between the frontend and Python pipeline:

```typescript
interface PipelineConfig {
  useParallel?: boolean;
  gpuAcceleration?: boolean;
  optimizationLevel?: 'fast' | 'balanced' | 'quality';
  exportFormat?: 'glb' | 'obj' | 'fbx';
}
```

### Python Pipeline
The main reconstruction pipeline (`packages/ml/python/room_reconstruction_pipeline.py`) orchestrates all components:

1. **Layout Extraction**
   - Room boundary detection
   - Structural element identification
   - CubeMap generation

2. **Depth Processing**
   - MiDaS inference
   - Depth map refinement
   - Confidence estimation

3. **Segmentation**
   - SAM model initialization
   - Room element segmentation
   - Boundary refinement

4. **Object Detection**
   - YOLO v8 inference
   - Object classification
   - Spatial relationship mapping

5. **NeRF Processing**
   - Parallel training setup
   - View synthesis
   - Quality optimization

6. **Model Processing**
   - Mesh extraction
   - UV mapping
   - Texture application

7. **Edge Refinement**
   - Marching Cubes implementation
   - Edge detection
   - Surface optimization

## Performance Considerations

- GPU acceleration for NeRF training
- Parallel processing for multiple views
- Memory optimization for large scenes
- Caching for intermediate results

## Error Handling

- Input validation
- Component failure recovery
- Resource cleanup
- Error reporting

## Future Improvements

1. **Enhanced Parallelization**
   - Multi-GPU support
   - Distributed training

2. **Quality Improvements**
   - Higher resolution support
   - Better texture mapping
   - Advanced material recognition

3. **Pipeline Optimization**
   - Faster processing
   - Reduced memory usage
   - Improved caching

## References

- [HorizonNet Paper](https://arxiv.org/abs/1901.03861)
- [MiDaS Documentation](https://github.com/isl-org/MiDaS)
- [SAM Paper](https://arxiv.org/abs/2304.02643)
- [YOLO v8 Documentation](https://docs.ultralytics.com/)
- [NeRF Documentation](https://docs.nerf.studio/)
- [BlenderProc Guide](https://github.com/DLR-RM/BlenderProc)
- [Open3D Documentation](http://www.open3d.org/)