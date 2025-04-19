// WebGPU type declarations
// This file provides TypeScript declarations for WebGPU API

interface GPUAdapter {
  requestDevice(): Promise<GPUDevice>;
}

interface GPUDevice {
  createCommandEncoder(): GPUCommandEncoder;
  createShaderModule(descriptor: any): GPUShaderModule;
  createRenderPipeline(descriptor: any): GPURenderPipeline;
  createBuffer(descriptor: any): GPUBuffer;
  createTexture(descriptor: any): GPUTexture;
  queue: GPUQueue;
}

interface GPUQueue {
  submit(commandBuffers: GPUCommandBuffer[]): void;
}

interface GPUCommandEncoder {
  beginRenderPass(descriptor: any): GPURenderPassEncoder;
  finish(): GPUCommandBuffer;
}

interface GPURenderPassEncoder {
  setPipeline(pipeline: GPURenderPipeline): void;
  setVertexBuffer(slot: number, buffer: GPUBuffer, offset?: number): void;
  draw(vertexCount: number, instanceCount?: number, firstVertex?: number, firstInstance?: number): void;
  endPass(): void;
}

interface GPUShaderModule {}
interface GPURenderPipeline {}
interface GPUBuffer {}
interface GPUTexture {}
interface GPUCommandBuffer {}

// Extend Navigator interface for WebGPU support
interface Navigator {
  gpu?: {
    requestAdapter(): Promise<GPUAdapter | null>;
  };
}
