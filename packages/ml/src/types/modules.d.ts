declare module '@kai/shared/src/types/reconstruction' {
  export interface ProcessingResult {
    success: boolean;
    data?: ReconstructionResult;
    error?: string;
  }

  export interface ReconstructionResult {
    layout: RoomLayout;
    reconstruction: {
      mesh: ReconstructionMesh;
      materials: ReconstructionMaterial[];
      metadata: Record<string, unknown>;
    };
    segmentation: SegmentationResult;
    depth: DepthResult;
  }

  export interface PipelineConfig {
    useParallel?: boolean;
    gpuAcceleration?: boolean;
    optimizationLevel?: 'fast' | 'balanced' | 'quality';
    exportFormat?: 'glb' | 'obj' | 'fbx';
  }

  export interface ProcessingError extends Error {
    code?: number;
    details?: unknown;
  }

  export interface RoomLayout {
    dimensions: {
      width: number;
      length: number;
      height: number;
    };
    elements: ArchitecturalElement[];
    metadata: {
      style?: string;
      purpose?: string;
      standardsCompliance?: boolean;
    };
    preview?: string;
    thumbnail?: string;
  }

  export interface ArchitecturalElement {
    type: 'wall' | 'window' | 'door';
    position: { x: number; y: number; z: number };
    dimensions: { width: number; height: number; depth: number };
    rotation: { y: number };
    metadata?: {
      style?: string;
      material?: string;
      standardSize?: boolean;
    };
  }

  export interface ReconstructionMesh {
    vertices: number[][];
    faces: number[][];
    normals?: number[][];
    uvs?: number[][];
  }

  export interface ReconstructionMaterial {
    name: string;
    properties: {
      color?: [number, number, number];
      metallic?: number;
      roughness?: number;
      normalMap?: string;
      albedoMap?: string;
    };
  }

  export interface SegmentationResult {
    objects: Array<{
      type: string;
      confidence: number;
      bbox: [number, number, number, number];
      mask?: Uint8Array;
    }>;
    walls: Array<{
      points: [number, number][];
      type: 'wall' | 'window' | 'door';
    }>;
    floor: {
      points: [number, number][];
      material?: string;
    };
    ceiling: {
      points: [number, number][];
      material?: string;
    };
  }

  export interface DepthResult {
    map: Float32Array;
    confidence: Float32Array;
    scale?: number;
    min?: number;
    max?: number;
  }
}

declare module 'fs/promises' {
  export function mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  export function writeFile(path: string, data: Buffer | string): Promise<void>;
  export function rmdir(path: string, options?: { recursive?: boolean }): Promise<void>;
}