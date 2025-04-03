import { PythonShell } from 'python-shell';
import { ThreeDService, MaterialService, VectorService, Material, SearchResult } from './types/services';
import path from 'path';

interface TextTo3DConfig {
  pythonPath: string;
  modelEndpoints: {
    controlNet: string;
    stableDiffusion: string;
    shapE: string;
    get3d: string;
    diffuScene: string;
  };
  threeDFrontPath: string;
}

/**
 * Bridge between TypeScript ThreeDService and Python text-to-3D implementation
 */
export class TextTo3DBridge {
  private pythonProcess: PythonShell | null = null;
  private initialized = false;

  constructor(
    private config: TextTo3DConfig,
    private threeDService: ThreeDService,
    private materialService: MaterialService,
    private vectorService: VectorService
  ) {}

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Start Python process
    this.pythonProcess = new PythonShell(
      path.join(__dirname, '../python/text_to_3d.py'),
      {
        pythonPath: this.config.pythonPath,
        args: [
          '--model-endpoints', JSON.stringify(this.config.modelEndpoints),
          '--3d-front-path', this.config.threeDFrontPath
        ]
      }
    );

    // Initialize models
    await this.sendCommand('initialize');
    this.initialized = true;
  }

  async generateFromText(
    prompt: string,
    styleParams?: Record<string, any>,
    furniturePrompts?: string[]
  ): Promise<any> {
    await this.ensureInitialized();

    const result = await this.sendCommand('generate_from_text', {
      prompt,
      style_params: styleParams,
      furniture_prompts: furniturePrompts
    });

    // Process materials
    const materials = await this.processMaterials(result);

    return {
      ...result,
      materials
    };
  }

  async refineScene(
    scene: any,
    feedback: string,
    styleUpdates?: Record<string, any>
  ): Promise<any> {
    await this.ensureInitialized();

    const result = await this.sendCommand('refine_scene', {
      scene,
      feedback,
      style_updates: styleUpdates
    });

    // Process updated materials
    const materials = await this.processMaterials(result);

    return {
      ...result,
      materials
    };
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  private async sendCommand(
    command: string,
    data?: Record<string, any>
  ): Promise<any> {
    if (!this.pythonProcess) {
      throw new Error('Python process not initialized');
    }

    return new Promise((resolve, reject) => {
      this.pythonProcess!.send(JSON.stringify({
        command,
        data: data || {}
      }));

      this.pythonProcess!.once('message', (message: string) => {
        try {
          const result = JSON.parse(message);
          if (result.error) {
            reject(new Error(result.error));
          } else {
            resolve(result.data);
          }
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  private async processMaterials(result: any): Promise<any[]> {
    // Extract material requirements
    const requirements = this.extractMaterialRequirements(result);

    // Search for materials
    const searchResult = await this.vectorService.searchMaterials({
      query: requirements.query,
      filters: requirements.filters
    });

    // Get detailed information
    const materials = await Promise.all(
      searchResult.materials.map((material: { id: string }) => 
        this.materialService.getMaterial(material.id)
      )
    );

    return materials;
  }

  private extractMaterialRequirements(result: any): {
    query: string;
    filters: Record<string, any>;
  } {
    // Extract material types from scene
    const materialTypes = result.detailed_scene?.materials?.map(
      (m: any) => m.type
    ) || [];

    return {
      query: materialTypes.join(' OR ') || 'generic material',
      filters: {
        type: materialTypes,
        confidence: { min: 0.7 }
      }
    };
  }

  async cleanup(): Promise<void> {
    if (this.pythonProcess) {
      this.pythonProcess.end();
      this.pythonProcess = null;
    }
    this.initialized = false;
  }
}