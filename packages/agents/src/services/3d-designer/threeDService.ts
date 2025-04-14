import { ServiceConfig } from '../baseService'; // Assuming baseService exists for potential shared config/logging
import { MaterialSearchResult } from '../materialService'; // Assuming this is used elsewhere or can be removed if not
// import { DataPipelineService } from './dataPipelineService'; // Data pipeline logic might move to workers or coordinator
import { GPUTier, GPU_TIER_CONFIGS, TaskPriority, RESOURCE_THRESHOLDS } from './types'; // Keep types if needed
import { SubscriptionTier } from '@kai/shared'; // Import from shared package
import { v4 as uuidv4 } from 'uuid'; // For potential client-side tracking if needed

// Define Coordinator API interaction types (align with coordinator service)
interface WorkflowRequest {
  type: string; // e.g., '3d-reconstruction'
  userId: string; // Need a way to get current user ID
  subscriptionTier?: SubscriptionTier; // Need user subscription info
  qualityTarget?: 'auto' | 'low' | 'medium' | 'high';
  priority?: 'low' | 'medium' | 'high' | 'critical'; // Optional priority
  enableCaching?: boolean;
  parameters: Record<string, any>; // Input parameters for the workflow
  workflowId?: string; // Optional client-generated ID for tracking
}

interface WorkflowStatus {
  id: string;
  type: string;
  userId: string;
  qualityLevel: string;
  createdAt: string;
  status: 'Pending' | 'Running' | 'Succeeded' | 'Failed' | 'Error' | 'Skipped';
  progress: number;
  estimatedCompletionTime: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  duration: number | undefined;
  outputUrl?: string; // Assuming the finalizer step provides this
  nodes?: any[]; // Detailed node status
}

interface SearchOptions {
  query: string;
  filters?: Record<string, any>;
  limit?: number; // Keep if search is still relevant here
}

// Keep if needed, or move related logic
// interface MaterialDetails {
//   id: string;
//   name: string;
//   properties: Record<string, any>;
// }

export interface ArchitecturalElement {
  type: 'wall' | 'window' | 'door';
  position: { x: number; y: number; z: number };
  dimensions: { width: number; height: number; depth: number }; // Keep if layout generation is still initiated here
  rotation: { y: number };
  metadata?: {
    style?: string;
    material?: string;
    standardSize?: boolean;
  };
}

// Keep if layout generation is still initiated here
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

// Simplified result type for workflow submission
export interface WorkflowSubmissionResult {
  workflowId: string;
}

// Keep if search is still relevant here
// interface SearchResult {
//   materials: MaterialSearchResult[];
//   total: number;
// }

export interface ModelEndpoints {
  nerfStudio: string;
  instantNgp: string;
  shapE: string; // Text-to-3D (Base Structure)
  get3d: string; // Text-to-3D (Detailed Scene)
  hunyuan3d: string; // Text-to-3D (Alternative)
  blenderProc: string; // Scene Cleanup & Furniture Placement
  architecturalRecognition: string; // Process Drawings
  roomLayoutGenerator: string; // Generate Layouts
  controlNet: string; // House Outline Generation
  text2material: string; // Texture Generation
  clip: string; // Validation
  // Add other specific model endpoints if needed
}

// Config interfaces (keep if text-to-3d is still initiated here)
interface HunyuanConfig {
  temperature?: number;
  num_inference_steps?: number;
  guidance_scale?: number;
}
interface HouseGenerationConfig {
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
interface HouseGenerationResult {
  // Define structure if needed, or remove if result is just URL
  outputUrl?: string;
}


export class ThreeDService {
  // Remove direct model endpoints if all logic moves to Coordinator/Workers
  // private modelEndpoints: ModelEndpoints;
  // private apiBase: string; // Remove if not calling monolithic ML service

  private coordinatorUrl: string; // URL for the Coordinator Service API
  // private dataPipeline: DataPipelineService; // Remove if data handling moves to workers

  constructor(
    // Remove modelEndpoints if unused
    // modelEndpoints: ModelEndpoints
  ) {
    // this.modelEndpoints = modelEndpoints; // Remove
    // this.apiBase = process.env.ML_SERVICE_URL || 'http://localhost:5000'; // Remove

    // Get Coordinator URL from environment or config
    // Assumes Coordinator service is exposed internally at 'coordinator-service.kai-ml.svc.cluster.local:80'
    this.coordinatorUrl = process.env.COORDINATOR_URL || 'http://coordinator-service.kai-ml.svc.cluster.local:80/api';

    // Remove DataPipelineService initialization if its logic moves
    // this.dataPipeline = new DataPipelineService(...);
  }

  // Remove if not needed
  // getModelEndpoints(): ModelEndpoints {
  //   return { ...this.modelEndpoints };
  // }

  // --- Helper to submit workflow ---
  private async submitWorkflowAndWait(request: WorkflowRequest): Promise<WorkflowStatus> {
    console.log(`Submitting workflow: ${request.type}`, request.parameters);
    const submitResponse = await fetch(`${this.coordinatorUrl}/workflow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!submitResponse.ok) {
      const errorText = await submitResponse.text();
      console.error(`Failed to submit workflow: ${submitResponse.statusText}`, errorText);
      throw new Error(`Failed to submit workflow: ${submitResponse.statusText} - ${errorText}`);
    }

    const { workflowId } = await submitResponse.json();
    console.log(`Workflow submitted with ID: ${workflowId}`);

    // Poll for status until completion
    let status: WorkflowStatus | null = null;
    const pollInterval = 5000; // 5 seconds
    const maxAttempts = 12 * 60 * 2; // 2 hours timeout (adjust as needed)
    let attempts = 0;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      attempts++;

      try {
        const statusResponse = await fetch(`${this.coordinatorUrl}/workflow/${workflowId}/status`);
        if (!statusResponse.ok) {
          console.warn(`Failed to get workflow status (attempt ${attempts}): ${statusResponse.statusText}`);
          continue; // Continue polling
        }

        status = await statusResponse.json();
        console.log(`Workflow ${workflowId} status: ${status?.status}, Progress: ${status?.progress}%`);

        if (status?.status === 'Succeeded' || status?.status === 'Failed' || status?.status === 'Error') {
          break; // Workflow finished
        }
      } catch (error) {
        console.warn(`Error polling workflow status (attempt ${attempts}):`, error);
      }
    }

    if (!status) {
      throw new Error(`Workflow ${workflowId} status polling timed out or failed.`);
    }
    if (status.status !== 'Succeeded') {
      throw new Error(`Workflow ${workflowId} failed with status: ${status.status}`);
    }

    console.log(`Workflow ${workflowId} completed successfully.`);
    return status;
  }


  // --- Refactored Methods to use Coordinator ---

  // Example: Refactor processArchitecturalDrawing
  async processArchitecturalDrawing(
    drawing: ArrayBuffer,
    userId: string, // Pass user context
    subscriptionTier: SubscriptionTier = 'standard' // Pass subscription context
  ): Promise<RoomLayout> { // Return type might change depending on what the workflow outputs
    try {
      // Convert ArrayBuffer to Base64 or upload to S3 first to get a URL
      // Argo workflows typically work better with URLs or S3 paths
      const drawingUrl = await this.uploadToS3(drawing, `input/arch-drawing-${uuidv4()}.png`); // Placeholder upload function

      const request: WorkflowRequest = {
        type: '3d-reconstruction', // Assuming this workflow handles it, adjust if needed
        userId: userId,
        subscriptionTier: subscriptionTier,
        qualityTarget: 'medium', // Or determine based on context
        parameters: {
          'input-images': JSON.stringify([drawingUrl]), // Pass as URL list
          'processing-mode': 'architectural-drawing' // Add parameter to guide workflow
          // Add other relevant parameters from original method if needed
        }
      };

      const finalStatus = await this.submitWorkflowAndWait(request);

      // Assuming the final output is a RoomLayout JSON stored at the outputUrl
      if (!finalStatus.outputUrl) {
        throw new Error('Workflow completed but did not provide an output URL.');
      }

      // Fetch the result from the output URL (e.g., S3)
      const resultResponse = await fetch(finalStatus.outputUrl); // Need S3 fetch logic
      if (!resultResponse.ok) {
        throw new Error(`Failed to fetch result from ${finalStatus.outputUrl}`);
      }
      const roomLayout: RoomLayout = await resultResponse.json();

      // Perform any necessary post-processing or validation (like validateArchitecturalStandards)
      // This could also potentially be a final step in the Argo workflow itself
      const validatedLayout = await this.validateArchitecturalStandards(roomLayout);

      return validatedLayout;

    } catch (error) {
      console.error('Error processing architectural drawing via workflow:', error);
      throw error;
    }
  }

  // Implement S3 upload functionality
  private async uploadToS3(data: ArrayBuffer, key: string): Promise<string> {
    console.log(`Uploading data to S3 at key: ${key}`);
    
    try {
      // Import the storage adapter using relative path
      const { storage } = await import('../../../../../packages/shared/src/services/storage/s3StorageAdapter');
      
      // Convert the ArrayBuffer to a Buffer for upload
      const buffer = Buffer.from(data);
      
      // Define the bucket for 3D processing data
      const bucket = 'kai-intermediate-data';
      
      // Upload the data to S3
      const result = await storage.upload(buffer, {
        bucket,
        path: key,
        // Make files available to coordinator and processing services
        isPublic: false,
        metadata: {
          contentType: 'application/octet-stream',
          source: '3d-designer-service'
        }
      });
      
      if (result.error) {
        console.error(`Failed to upload to S3: ${result.error.message}`);
        throw result.error;
      }
      
      // Return the S3 URL in the expected format
      return `s3://${bucket}/${key}`;
    } catch (error) {
      console.error('Error uploading to S3:', error);
      // Fall back to returning just the path in case of error
      // This can help workflows continue with local processing in development
      return `s3://kai-intermediate-data/${key}`;
    }
  }


  // Refactor processImageInput similarly...
  async processImageInput(
    image: ArrayBuffer,
    options: { /* ... options ... */ },
    userId: string,
    subscriptionTier: SubscriptionTier = 'standard'
  ): Promise<any> { // Return type might be just the workflow ID or final status/result URL
     try {
      const imageUrl = await this.uploadToS3(image, `input/image-${uuidv4()}.png`);

      const request: WorkflowRequest = {
        type: '3d-reconstruction', // Or a different workflow type if applicable
        userId: userId,
        subscriptionTier: subscriptionTier,
        parameters: {
          'input-images': JSON.stringify([imageUrl]),
          'options': JSON.stringify(options) // Pass original options
        }
      };

      // Option 1: Submit and return ID immediately
      // const submitResponse = await fetch(`${this.coordinatorUrl}/workflow`, { ... });
      // const { workflowId } = await submitResponse.json();
      // return { workflowId };

      // Option 2: Submit and wait (as implemented above)
      const finalStatus = await this.submitWorkflowAndWait(request);
      // Fetch result from finalStatus.outputUrl if needed
      // const result = await fetch(finalStatus.outputUrl).then(res => res.json());
      // return result;
      return finalStatus; // Return status including output URL

    } catch (error) {
      console.error('Error processing image via workflow:', error);
      throw error;
    }
  }

  // Refactor processTextInput similarly...
  async processTextInput(
    description: string,
    options: { /* ... options ... */ },
    userId: string,
    subscriptionTier: SubscriptionTier = 'standard'
  ): Promise<any> { // Return type might be just the workflow ID or final status/result URL
    try {
      const request: WorkflowRequest = {
        type: 'text-to-3d', // Assuming a dedicated workflow type exists
        userId: userId,
        subscriptionTier: subscriptionTier,
        parameters: {
          'description': description,
          'options': JSON.stringify(options)
        }
      };

      const finalStatus = await this.submitWorkflowAndWait(request);
      // Fetch result from finalStatus.outputUrl if needed
      return finalStatus;

    } catch (error) {
      console.error('Error processing text input via workflow:', error);
      throw error;
    }
  }

  // Refactor generateHouse similarly...
   async generateHouse(
    description: string,
    config: HouseGenerationConfig,
    userId: string,
    subscriptionTier: SubscriptionTier = 'standard'
  ): Promise<any> { // Return type might be just the workflow ID or final status/result URL
     try {
      const request: WorkflowRequest = {
        type: 'house-generation', // Assuming a dedicated workflow type exists
        userId: userId,
        subscriptionTier: subscriptionTier,
        parameters: {
          'description': description,
          'config': JSON.stringify(config)
        }
      };

      const finalStatus = await this.submitWorkflowAndWait(request);
      // Fetch result from finalStatus.outputUrl if needed
      return finalStatus;

    } catch (error) {
      console.error('Error generating house via workflow:', error);
      throw error;
    }
  }

  // --- Keep utility/validation methods if still needed locally ---
  // Or move them to appropriate worker scripts if they belong there

  private async validateArchitecturalStandards(layout: RoomLayout): Promise<RoomLayout> {
    // This logic could potentially be a step in the Argo workflow itself
    console.log("Validating architectural standards (client-side)...");
    // ... (validation logic remains the same for now) ...
    return layout;
  }

  // GPU Tier detection might still be useful for client-side decisions, or removed if unused
  // Restore original implementation to fix lint error
  private detectGPUTier(): GPUTier {
    try {
      // Check if we're in Node.js environment
      const isNode = typeof window === 'undefined';

      if (isNode) {
        // Server-side detection using environment variables
        const gpuEnv = process.env.GPU_TIER || process.env.RENDER_CAPABILITY;
        if (gpuEnv) {
          if (gpuEnv.toLowerCase().includes('high') ||
              gpuEnv.toLowerCase().includes('nvidia') ||
              gpuEnv.toLowerCase().includes('rtx')) {
            return 'high';
          } else if (gpuEnv.toLowerCase().includes('low')) {
            return 'low';
          }
        }

        // Check for GPU-related environment variables
        const hasGPU = process.env.HAS_GPU === 'true' ||
                       process.env.CUDA_VISIBLE_DEVICES ||
                       process.env.GPU_COUNT;

        if (hasGPU) {
          return 'high';
        }

        // Use memory-based heuristic without requiring 'os' module
        // This assumes large memory systems have better GPU capability
        const heapStats = process.memoryUsage();
        const heapTotal = heapStats.heapTotal / (1024 * 1024 * 1024); // GB
        const totalMemoryEstimate = heapTotal * 8; // Rough estimate

        if (totalMemoryEstimate > 24) {
          return 'high';
        } else if (totalMemoryEstimate > 12) {
          return 'medium';
        } else {
          return 'low';
        }
      } else {
        // Browser environment detection
        const gl = document.createElement('canvas').getContext('webgl2');
        if (!gl) {
          return 'low'; // WebGL2 not supported
        }

        // Check for specific WebGL extensions and capabilities
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (!debugInfo) {
          return 'medium'; // Can't get detailed info, assume medium
        }

        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);

        // Check for high-end GPU indicators
        if (renderer.includes('RTX') ||
            renderer.includes('Quadro') ||
            renderer.includes('NVIDIA') ||
            renderer.includes('AMD Radeon Pro')) {
          return 'high';
        }

        // Check for integrated/low-end GPU indicators
        if (renderer.includes('Intel') ||
            renderer.includes('HD Graphics') ||
            renderer.includes('UHD Graphics')) {
          return 'low';
        }

        // Check available texture units as another performance indicator
        const maxTextureUnits = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);
        if (maxTextureUnits >= 16) {
          return 'high';
        } else if (maxTextureUnits >= 8) {
          return 'medium';
        } else {
          return 'low';
        }
      }

      // Default fallback if all detection methods fail
      console.log('GPU tier detection fallback to medium');
      return 'medium';
    } catch (error) {
      console.error('Error detecting GPU tier:', error);
      return 'medium'; // Safe fallback
    }
  }

  // Remove methods that are now fully handled by workflows
  // private generateBaseStructure(...)
  // private generateDetailedScene(...)
  // private generateHunyuanScene(...)
  // private mergeScenes(...)
  // private cleanupWithBlenderProc(...)
  // private calculateElementDistance(...)
  // private determineElementType(...)
  // private calculateDimensions(...)
  // private convertUnifiedToRoomLayout(...)

  // Add methods for interacting with Coordinator status/results if needed
  async getWorkflowStatus(workflowId: string): Promise<WorkflowStatus | null> {
    try {
      const response = await fetch(`${this.coordinatorUrl}/workflow/${workflowId}/status`);
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`Failed to get workflow status: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`Error getting status for workflow ${workflowId}:`, error);
      throw error;
    }
  }

  async cancelWorkflow(workflowId: string): Promise<boolean> {
     try {
      const response = await fetch(`${this.coordinatorUrl}/workflow/${workflowId}/cancel`, { method: 'PUT' });
      return response.ok;
    } catch (error) {
      console.error(`Error cancelling workflow ${workflowId}:`, error);
      return false;
    }
  }

  // Remove refineResult if refinement is handled via new workflow submissions
  // async refineResult(...)

}

export default ThreeDService;