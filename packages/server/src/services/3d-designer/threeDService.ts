import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import mcpClientService, { MCPServiceKey } from '../mcp/mcpClientService';
import { logger } from '../../utils/logger';

interface Scene3D {
  id: string;
  reconstruction: {
    mesh: any;
    materials: any[];
    textures: any[];
  };
  objects?: Array<{
    id: string;
    type: string;
    position: [number, number, number];
    rotation: [number, number, number];
    scale: [number, number, number];
    material?: string;
  }>;
}

interface ProcessingResult {
  id: string;
  scene?: Scene3D;
  objects?: Array<{
    id: string;
    type: string;
    confidence: number;
    bbox: [number, number, number, number];
    position?: [number, number, number];
  }>;
  depthMap?: {
    url: string;
    data: Float32Array;
    dimensions: { width: number; height: number };
  };
  segments?: Array<{
    id: string;
    mask: Uint8Array;
    class: string;
    confidence: number;
  }>;
}

export class ThreeDService {
  private modelEndpoints: {
    // Image-based reconstruction
    nerfStudio: string;
    instantNgp: string;
    blenderProc: string;
    // Text-based generation
    shapE: string;
    get3d: string;
    // Scene understanding
    yolo: string;
    sam: string;
    midas: string;
  };

  constructor() {
    this.modelEndpoints = {
      // Image-based reconstruction
      nerfStudio: process.env.NERF_STUDIO_ENDPOINT || 'http://localhost:5000/nerf-studio',
      instantNgp: process.env.INSTANT_NGP_ENDPOINT || 'http://localhost:5000/instant-ngp',
      blenderProc: process.env.BLENDER_PROC_ENDPOINT || 'http://localhost:5000/blender-proc',
      // Text-based generation
      shapE: process.env.SHAP_E_ENDPOINT || 'http://localhost:5000/shap-e',
      get3d: process.env.GET3D_ENDPOINT || 'http://localhost:5000/get3d',
      // Scene understanding
      yolo: process.env.YOLO_ENDPOINT || 'http://localhost:5000/yolo',
      sam: process.env.SAM_ENDPOINT || 'http://localhost:5000/sam',
      midas: process.env.MIDAS_ENDPOINT || 'http://localhost:5000/midas'
    };
  }

  /**
   * Check if MCP is available for 3D operations
   * @returns True if MCP is available
   */
  private async isMCPAvailable(): Promise<boolean> {
    try {
      return await mcpClientService.isMCPAvailable();
    } catch (error) {
      logger.error(`Error checking MCP availability: ${error}`);
      return false;
    }
  }

  /**
   * Process input (image or text) through the 3D reconstruction pipeline
   */
  async process(input: Buffer | string, options: {
    inputType: 'image' | 'text';
    detectObjects?: boolean;
    estimateDepth?: boolean;
    segmentScene?: boolean;
  }, userId?: string): Promise<ProcessingResult> {
    const result: ProcessingResult = {
      id: uuidv4()
    };

    try {
      if (options.inputType === 'image') {
        return this.processImageInput(input as Buffer, options, userId);
      } else {
        return this.processTextInput(input as string, options, userId);
      }
    } catch (error) {
      console.error('Error processing input:', error);
      throw new Error('Failed to process through 3D reconstruction pipeline');
    }
  }

  /**
   * Process image input using NeRF-based reconstruction
   */
  private async processImageInput(imageBuffer: Buffer, options: {
    detectObjects?: boolean;
    estimateDepth?: boolean;
    segmentScene?: boolean;
  }, userId?: string): Promise<ProcessingResult> {
    const result: ProcessingResult = {
      id: uuidv4()
    };

    try {
      // Check if MCP is available and user ID is provided
      const mcpAvailable = await this.isMCPAvailable();

      if (mcpAvailable && userId) {
        try {
          // Save image to temporary file for MCP
          const tempFilePath = `/tmp/${uuidv4()}.jpg`;
          require('fs').writeFileSync(tempFilePath, imageBuffer);

          try {
            // Use MCP for 3D reconstruction
            const mcpResult = await mcpClientService.reconstructModelFromImage(
              userId,
              tempFilePath,
              {
                model: 'nerfStudio',
                format: 'glb',
                quality: 'medium'
              }
            );

            result.scene = {
              modelUrl: mcpResult.modelUrl,
              thumbnailUrl: mcpResult.thumbnailUrl
            };

            return result;
          } finally {
            // Clean up temporary file
            try {
              require('fs').unlinkSync(tempFilePath);
            } catch (cleanupError) {
              logger.warn(`Failed to clean up temporary file: ${cleanupError}`);
            }
          }
        } catch (mcpError: any) {
          // If MCP fails with insufficient credits, rethrow the error
          if (mcpError.message === 'Insufficient credits') {
            throw mcpError;
          }

          // For other MCP errors, log and fall back to direct API calls
          logger.warn(`MCP 3D reconstruction failed, falling back to direct API calls: ${mcpError.message}`);
        }
      }

      // Fall back to direct API calls if MCP is not available or failed
      // 1. NeRF-based reconstruction
      const [nerfStudioResult, instantNgpResult] = await Promise.all([
        this.runNerfStudio(imageBuffer),
        this.runInstantNGP(imageBuffer)
      ]);

      // 2. Scene understanding tasks
      const sceneUnderstandingTasks = [];
      if (options.detectObjects) sceneUnderstandingTasks.push(this.detectObjects(imageBuffer));
      if (options.estimateDepth) sceneUnderstandingTasks.push(this.estimateDepth(imageBuffer));
      if (options.segmentScene) sceneUnderstandingTasks.push(this.segmentScene(imageBuffer));

      const sceneResults = await Promise.all(sceneUnderstandingTasks);

      // 3. Merge NeRF results
      const merged3D = await this.mergeNerfResults(nerfStudioResult, instantNgpResult);

      // 4. Clean up with BlenderProc
      const cleaned3D = await this.cleanupWithBlenderProc(merged3D);

      // Combine all results
      result.scene = cleaned3D;
      if (sceneResults[0]) result.objects = sceneResults[0];
      if (sceneResults[1]) result.depthMap = sceneResults[1];
      if (sceneResults[2]) result.segments = sceneResults[2];

      return result;
    } catch (error) {
      console.error('Error in image processing pipeline:', error);
      throw error;
    }
  }

  /**
   * Process text input using Shap-E and GET3D
   */
  private async processTextInput(text: string, options: any, userId?: string): Promise<ProcessingResult> {
    const result: ProcessingResult = {
      id: uuidv4()
    };

    try {
      // Check if MCP is available and user ID is provided
      const mcpAvailable = await this.isMCPAvailable();

      if (mcpAvailable && userId) {
        try {
          // Use MCP for text-to-3D generation
          const mcpResult = await mcpClientService.generateTextTo3D(
            userId,
            text,
            {
              model: 'shapE',
              format: 'glb',
              quality: 'medium'
            }
          );

          result.scene = {
            modelUrl: mcpResult.modelUrl,
            thumbnailUrl: mcpResult.thumbnailUrl
          };

          return result;
        } catch (mcpError: any) {
          // If MCP fails with insufficient credits, rethrow the error
          if (mcpError.message === 'Insufficient credits') {
            throw mcpError;
          }

          // For other MCP errors, log and fall back to direct API calls
          logger.warn(`MCP text-to-3D generation failed, falling back to direct API calls: ${mcpError.message}`);
        }
      }

      // Fall back to direct API calls if MCP is not available or failed
      // 1. Generate base structure with Shap-E
      const baseStructure = await this.generateBaseStructure(text);

      // 2. Fill details with GET3D
      const detailedScene = await this.fillSceneDetails(baseStructure, text);

      // 3. Clean up with BlenderProc
      const finalScene = await this.cleanupWithBlenderProc(detailedScene);

      result.scene = finalScene;
      return result;
    } catch (error) {
      console.error('Error in text processing pipeline:', error);
      throw error;
    }
  }

  private async runNerfStudio(imageBuffer: Buffer): Promise<any> {
    try {
      const response = await axios.post(
        this.modelEndpoints.nerfStudio,
        imageBuffer,
        {
          headers: { 'Content-Type': 'application/octet-stream' }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error running NeRF Studio:', error);
      return null;
    }
  }

  private async runInstantNGP(imageBuffer: Buffer): Promise<any> {
    try {
      const response = await axios.post(
        this.modelEndpoints.instantNgp,
        imageBuffer,
        {
          headers: { 'Content-Type': 'application/octet-stream' }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error running Instant-NGP:', error);
      return null;
    }
  }

  private async detectObjects(imageBuffer: Buffer): Promise<any> {
    try {
      const response = await axios.post(
        this.modelEndpoints.yolo,
        imageBuffer,
        {
          headers: { 'Content-Type': 'application/octet-stream' }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error detecting objects:', error);
      return null;
    }
  }

  private async estimateDepth(imageBuffer: Buffer): Promise<any> {
    try {
      const response = await axios.post(
        this.modelEndpoints.midas,
        imageBuffer,
        {
          headers: { 'Content-Type': 'application/octet-stream' }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error estimating depth:', error);
      return null;
    }
  }

  private async segmentScene(imageBuffer: Buffer): Promise<any> {
    try {
      const response = await axios.post(
        this.modelEndpoints.sam,
        imageBuffer,
        {
          headers: { 'Content-Type': 'application/octet-stream' }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error segmenting scene:', error);
      return null;
    }
  }

  private async generateBaseStructure(text: string): Promise<any> {
    try {
      const response = await axios.post(
        this.modelEndpoints.shapE,
        { prompt: text },
        {
          headers: { 'Content-Type': 'application/json' }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error generating base structure:', error);
      return null;
    }
  }

  private async fillSceneDetails(baseStructure: any, text: string): Promise<any> {
    try {
      const response = await axios.post(
        this.modelEndpoints.get3d,
        {
          baseStructure,
          prompt: text
        },
        {
          headers: { 'Content-Type': 'application/json' }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error filling scene details:', error);
      return null;
    }
  }

  private async cleanupWithBlenderProc(scene: any): Promise<any> {
    try {
      const response = await axios.post(
        this.modelEndpoints.blenderProc,
        scene,
        {
          headers: { 'Content-Type': 'application/json' }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error cleaning up scene:', error);
      return null;
    }
  }

  private async mergeNerfResults(nerfStudioResult: any, instantNgpResult: any): Promise<any> {
    // Implement merging logic here
    return {
      ...nerfStudioResult,
      ...instantNgpResult
    };
  }

  /**
   * Process an image through the 3D reconstruction pipeline (legacy method)
   */
  async processImage(imageBuffer: Buffer, options: {
    detectObjects?: boolean;
    estimateDepth?: boolean;
    segmentScene?: boolean;
  }, userId?: string): Promise<ProcessingResult> {
    return this.process(imageBuffer, { ...options, inputType: 'image' }, userId);
  }

  /**
   * Generate scene variations
   */
  async generateVariations(sceneData: Scene3D, options: {
    count?: number;
    constraints?: {
      style?: string;
      budget?: number;
      materials?: string[];
    };
  } = {}): Promise<Scene3D[]> {
    try {
      const count = options.count || 3;
      const constraints = options.constraints || {};
      const variations: Scene3D[] = [];

      for (let i = 0; i < count; i++) {
        // Generate variation using GET3D
        const variation = await this.fillSceneDetails(sceneData,
          `Variation ${i + 1} with style: ${constraints.style || 'default'}`
        );

        // Apply constraints
        if (variation && variation.objects) {
          variation.objects = variation.objects.map((obj: { id: string; material?: string; [key: string]: any }) => ({
            ...obj,
            material: constraints.materials?.[i % (constraints.materials?.length || 1)] || obj.material,
          }));
        }

        if (variation) {
          variations.push(variation);
        }
      }

      return variations;
    } catch (error) {
      console.error('Error generating variations:', error);
      return [];
    }
  }

  /**
   * Export scene to various formats
   */
  async exportScene(scene: Scene3D, format: 'gltf' | 'obj' | 'fbx' = 'gltf'): Promise<any> {
    try {
      const formatters = {
        gltf: this.exportToGLTF,
        obj: this.exportToOBJ,
        fbx: this.exportToFBX
      };

      const formatter = formatters[format];
      if (!formatter) {
        throw new Error(`Unsupported format: ${format}`);
      }

      return formatter(scene);
    } catch (error) {
      console.error(`Error exporting scene to ${format}:`, error);
      return null;
    }
  }

  private exportToGLTF = (scene: Scene3D): any => {
    return {
      asset: { version: '2.0' },
      scenes: [{
        nodes: scene.objects?.map((_, index) => index) || []
      }],
      nodes: scene.objects?.map(obj => ({
        mesh: obj.id,
        position: obj.position,
        rotation: obj.rotation,
        scale: obj.scale
      })) || [],
      meshes: scene.reconstruction.mesh ? [scene.reconstruction.mesh] : [],
      materials: scene.reconstruction.materials || []
    };
  };

  private exportToOBJ = (scene: Scene3D): string => {
    let content = '# Exported from KAI 3D Designer\n';

    if (scene.reconstruction.mesh) {
      const { vertices, normals, uvs } = scene.reconstruction.mesh;

      vertices?.forEach((v: number[]) => content += `v ${v.join(' ')}\n`);
      normals?.forEach((n: number[]) => content += `vn ${n.join(' ')}\n`);
      uvs?.forEach((uv: number[]) => content += `vt ${uv.join(' ')}\n`);
    }

    return content;
  };

  private exportToFBX = (scene: Scene3D): any => {
    return {
      header: {
        version: '7.4',
        creator: 'KAI 3D Designer'
      },
      objects: scene.objects?.map(obj => ({
        id: obj.id,
        type: 'Mesh',
        position: obj.position,
        rotation: obj.rotation,
        scale: obj.scale,
        material: obj.material
      })) || [],
      materials: scene.reconstruction.materials || []
    };
  };
}

export default new ThreeDService();