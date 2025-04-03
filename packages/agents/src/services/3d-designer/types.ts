// GPU capability tiers
export type GPUTier = 'low' | 'medium' | 'high' | 'ultra';

// GPU Memory configurations per tier
export const GPU_TIER_CONFIGS = {
  low: {
    maxBatchSize: 1,
    memoryLimit: 2048,  // 2GB
    maxTextureSize: 2048,
    maxVertices: 100000
  },
  medium: {
    maxBatchSize: 2,
    memoryLimit: 4096,  // 4GB
    maxTextureSize: 4096,
    maxVertices: 250000
  },
  high: {
    maxBatchSize: 4,
    memoryLimit: 8192,  // 8GB
    maxTextureSize: 8192,
    maxVertices: 500000
  },
  ultra: {
    maxBatchSize: 8,
    memoryLimit: 16384,  // 16GB
    maxTextureSize: 16384,
    maxVertices: 1000000
  }
};

// Task priority levels
export enum TaskPriority {
  LOW = 0,
  MEDIUM = 1,
  HIGH = 2,
  CRITICAL = 3
}

// Acceleration structure types
export type AccelerationType = 'bvh' | 'octree' | 'kdtree';

// Cache eviction policies
export type CachePolicy = 'lru' | 'lfu';

// Performance metrics
export interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  gpuMemoryUsage: number;
  cpuUsage: number;
  drawCalls: number;
  triangleCount: number;
}

// Resource usage thresholds
export const RESOURCE_THRESHOLDS = {
  fps: {
    min: 30,
    target: 60
  },
  gpuMemory: {
    warning: 0.8,  // 80% usage
    critical: 0.9  // 90% usage
  },
  drawCalls: {
    warning: 1000,
    critical: 2000
  }
};

// LOD distance thresholds (in world units)
export const LOD_THRESHOLDS = {
  high: 10,
  medium: 50,
  low: 100,
  ultraLow: 200
};

// Material quality settings per GPU tier
export const MATERIAL_QUALITY_SETTINGS = {
  low: {
    maxTextures: 2,
    textureResolution: 1024,
    enableNormalMaps: false,
    enableMetallicRoughness: false
  },
  medium: {
    maxTextures: 4,
    textureResolution: 2048,
    enableNormalMaps: true,
    enableMetallicRoughness: true
  },
  high: {
    maxTextures: 8,
    textureResolution: 4096,
    enableNormalMaps: true,
    enableMetallicRoughness: true
  },
  ultra: {
    maxTextures: 16,
    textureResolution: 8192,
    enableNormalMaps: true,
    enableMetallicRoughness: true
  }
};

// Unified model data types
export interface UnifiedGeometry {
  vertices: Float32Array;
  indices: Uint32Array;
  normals?: Float32Array;
  uvs?: Float32Array;
}

export interface UnifiedMaterial {
  id: string;
  albedo?: string;  // Base64 texture
  roughness?: number;
  metallic?: number;
  normal?: string;  // Base64 texture
}

export interface UnifiedTransform {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}

export interface UnifiedNode {
  id: string;
  type: 'mesh' | 'group' | 'light';
  transform: UnifiedTransform;
  children?: string[];  // IDs of child nodes
}

export interface UnifiedBoundingBox {
  min: [number, number, number];
  max: [number, number, number];
}

export interface UnifiedMetadata {
  source: string;
  timestamp: number;
  version: string;
  bbox: UnifiedBoundingBox;
}

// GPU Task types
export interface GPUTask {
  id: string;
  priority: TaskPriority;
  estimatedMemory: number;
  execute: () => Promise<any>;
}

export interface GPUSchedulerConfig {
  maxConcurrentTasks: number;
  memoryLimit: number;
  priorityLevels: number;
}

// Cache types
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  size: number;
  hits: number;
}

export interface CacheMetrics {
  totalSize: number;
  itemCount: number;
  hitRate: number;
  missRate: number;
}

// Acceleration structure types
export interface BVHNode {
  bbox: UnifiedBoundingBox;
  children?: BVHNode[];
  triangles?: number[];
}

export interface OctreeNode {
  center: [number, number, number];
  size: number;
  children?: OctreeNode[];
  objects?: number[];
}

export interface KDTreeNode {
  splitAxis: 'x' | 'y' | 'z';
  splitValue: number;
  left?: KDTreeNode;
  right?: KDTreeNode;
  objects?: number[];
}

// AI Model Version Configuration
export interface AIModelVersion {
  name: string;
  version: string;
  checkpointUrl: string;
  configUrl: string;
  lastValidated: Date;
  compatibleInputFormats: string[];
  outputFormat: string;
  gpuMemoryRequired: number;
}

// MiDaS Specific Types
export interface MiDaSConfig {
  modelVersion: string;
  inputSize: {
    width: number;
    height: number;
  };
  depthNormalization: {
    min: number;
    max: number;
  };
  postProcessing: {
    enableSmoothing: boolean;
    smoothingKernelSize: number;
    enableHolesFilling: boolean;
    confidenceThreshold: number;
  };
}

export interface DepthMapResult {
  depthMap: Float32Array;
  confidence: Float32Array;
  metadata: {
    scale: number;
    shift: number;
    aspectRatio: number;
    originalSize: {
      width: number;
      height: number;
    };
  };
}

// Unified AI Model Wrapper Interface
export interface AIModelWrapper<InputType, OutputType> {
  readonly modelInfo: AIModelVersion;
  initialize(): Promise<void>;
  predict(input: InputType): Promise<OutputType>;
  validateInput(input: InputType): boolean;
  validateOutput(output: OutputType): boolean;
  cleanup(): Promise<void>;
}

// Standardized I/O Formats
export interface ModelInput {
  type: 'image' | 'pointCloud' | 'mesh' | 'voxel';
  data: ArrayBuffer | string; // Binary data or base64 string
  metadata: {
    format: string;
    size: {
      width?: number;
      height?: number;
      depth?: number;
    };
    encoding: string;
  };
}

export interface ModelOutput {
  type: 'depthMap' | 'segmentation' | 'reconstruction' | 'pose';
  data: ArrayBuffer;
  metadata: {
    format: string;
    dimensions: number[];
    confidence?: number;
    processingTime: number;
  };
}

// Performance monitoring types
export interface PerformanceSnapshot {
  timestamp: number;
  metrics: PerformanceMetrics;
  gpuTier: GPUTier;
  memoryUsage: {
    gpu: number;
    system: number;
    cache: number;
  };
}

export interface OptimizationSuggestion {
  type: 'LOD' | 'GPU' | 'Cache' | 'Acceleration';
  priority: TaskPriority;
  description: string;
  estimatedImpact: {
    fps: number;
    memory: number;
    loadTime: number;
  };
}