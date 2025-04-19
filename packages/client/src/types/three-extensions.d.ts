import * as THREE from 'three';

// Extend Three.js type definitions to include commonly used properties and methods
// that are not properly typed in the Three.js TypeScript definitions

declare module 'three' {
  // Extend Navigator interface for WebGPU support
  interface Navigator {
    gpu?: {
      requestAdapter(): Promise<any>;
    };
  }

  // Add GaussianPrimitivesGeometry class for our custom implementation
  class GaussianPrimitivesGeometry extends BufferGeometry {
    constructor(
      positions: Float32Array,
      colors: Float32Array,
      scales: Float32Array,
      rotations: Float32Array,
      opacities: Float32Array,
      normals?: Float32Array,
      uvs?: Float32Array
    );
  }
}