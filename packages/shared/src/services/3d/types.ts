/**
 * Base types for 3D services
 */

export interface Material {
  type: string;
  properties: Record<string, any>;
  textures?: Record<string, string>;
}

export interface Scene3D {
  id: string;
  name: string;
  elements: Array<{
    id: string;
    type: string;
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    dimensions: { width: number; height: number; depth: number };
    mesh?: {
      vertices: number[][];
      normals?: number[][];
      uvs?: number[][];
      indices?: number[];
    };
    material?: {
      type: string;
      properties: Record<string, any>;
      textures?: Record<string, string>;
    };
    metadata?: Record<string, any>;
  }>;
  metadata?: Record<string, any>;
}

export interface ProcessingResult {
  success: boolean;
  data?: any;
  error?: string;
}

export interface ModelEndpoints {
  // Image-based reconstruction
  nerfStudio: string;
  instantNgp: string;
  blenderProc: string;
  
  // Text-based generation
  shapE: string;
  get3d: string;
  hunyuan3d: string;
  
  // Scene understanding
  yolo: string;  // Object detection
  sam: string;   // Segmentation
  midas: string; // Depth estimation
  
  // Architectural
  architecturalRecognition: string;
  roomLayoutGenerator: string;
  
  // Material and style
  controlNet: string;
  text2material: string;
  clip: string;

  // Allow string indexing
  [key: string]: string;
}

export interface ServiceError extends Error {
  name: string;
  message: string;
  code?: string;
  status?: number;
}

export function isServiceError(error: unknown): error is ServiceError {
  return error instanceof Error && 'name' in error && 'message' in error;
}

export interface ArchitecturalElement {
  id: string;
  type: 'wall' | 'window' | 'door' | 'furniture';
  position: { x: number; y: number; z: number };
  dimensions: { width: number; height: number; depth: number };
  rotation: { x: number; y: number; z: number };
  metadata?: {
    style?: string;
    material?: string;
    standardSize?: boolean;
    type?: string;
  };
}

export interface RoomLayout {
  id: string;
  name: string;
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
    occupancyRate?: number;
    flowScore?: number;
  };
  preview?: string; // Base64 encoded preview image
  thumbnail?: string; // Base64 encoded thumbnail image
}

export interface HouseGenerationConfig {
  style?: string;
  roomCount?: number;
  floorCount?: number;
  constraints?: {
    maxArea?: number;
    minArea?: number;
    requireGarage?: boolean;
    requireBasement?: boolean;
  };
  texturePreferences?: {
    exteriorStyle?: string;
    interiorStyle?: string;
    materialTypes?: string[];
  };
}

export interface HouseGenerationResult {
  outline: {
    sketch: string; // Base64 encoded image
    refined: string; // Base64 encoded image
  };
  shell: {
    model: string; // GLB format base64
    preview: string; // Base64 encoded preview
  };
  detailedScene: {
    model: string; // GLB format base64
    preview: string; // Base64 encoded preview
  };
  furniture: Array<{
    type: string;
    model: string; // GLB format base64
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
  }>;
  textures: {
    exterior: Record<string, string>; // Material name -> Base64 texture maps
    interior: Record<string, string>; // Material name -> Base64 texture maps
  };
}

export interface ThreeDProvider {
  processImage(imageBuffer: Buffer, options: {
    detectObjects?: boolean;
    estimateDepth?: boolean;
    segmentScene?: boolean;
  }): Promise<ProcessingResult>;

  processText(text: string, options: {
    style?: string;
    constraints?: any;
  }): Promise<ProcessingResult>;

  generateVariations(scene: Scene3D, options: {
    count?: number;
    constraints?: {
      style?: string;
      budget?: number;
      materials?: string[];
    };
  }): Promise<Scene3D[]>;

  exportScene(scene: Scene3D, format: 'gltf' | 'obj' | 'fbx'): Promise<any>;
}

export interface ArchitecturalProvider extends ThreeDProvider {
  processArchitecturalDrawing(drawing: ArrayBuffer): Promise<RoomLayout>;
  generateRoomLayout(specifications: any): Promise<RoomLayout[]>;
  generateFurniturePlacement(layout: RoomLayout, requirements: any): Promise<any>;
}

export interface HouseGenerationProvider extends ThreeDProvider {
  generateHouse(description: string, config: HouseGenerationConfig): Promise<HouseGenerationResult>;
  refineResult(result: any, feedback: string, options?: any): Promise<any>;
}

export type GPUTier = 'low' | 'medium' | 'high';

export interface GPU_TIER_CONFIGS {
  [key: string]: {
    maxBatchSize: number;
    maxTextureSize: number;
    maxVertices: number;
    maxDrawCalls: number;
  };
}

export enum TaskPriority {
  LOW = 0,
  MEDIUM = 1,
  HIGH = 2
}

export interface RESOURCE_THRESHOLDS {
  memory: {
    low: number;
    medium: number;
    high: number;
  };
  gpu: {
    low: number;
    medium: number;
    high: number;
  };
}