/**
 * Types for MiDaS depth map processing
 */

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