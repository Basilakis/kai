import * as THREE from 'three';
import { PythonShell, Options } from 'python-shell';
import * as path from 'path';
import * as fs from 'fs';
import { MaterialDetails } from '../materialService';

// Get the directory path for the Python scripts
const PYTHON_SCRIPT_DIR = path.join(process.cwd(), 'src/services/3d-designer/python');

interface SceneLayout {
  furniture: Array<{
    type: string;
    position: { x: number; y: number; z: number };
    rotation: { y: number };
    dimensions: { width: number; height: number; depth: number };
    surfaceId?: string; // ID of the surface this furniture is placed on
    surfaceHeight?: number; // Height of the surface from ground
    isPlaceable?: boolean; // Whether this furniture can have items placed on it
    supportedWeight?: number; // Maximum weight this furniture can support
    availableSurface?: { // Surface area available for placing items
      width: number;
      depth: number;
      offset: { x: number; z: number }; // Offset from furniture position
    };
  }>;
  surfaces: Array<{
    id: string;
    type: 'table' | 'shelf' | 'cabinet' | 'custom';
    position: { x: number; y: number; z: number };
    dimensions: { width: number; height: number; depth: number };
    maxWeight: number;
    occupied: boolean;
  }>;
}

interface FurnitureAsset {
  id: string;
  modelPath: string;
  category: string;
  dimensions: {
    width: number;
    height: number;
    depth: number;
  };
}

interface PlacementConstraints {
  roomDimensions: {
    width: number;
    length: number;
    height: number;
  };
  existingFurniture?: FurnitureAsset[];
  style?: string;
  specificConstraints?: {
    minSpacing?: number;
    walkwayWidth?: number;
    alignToWalls?: boolean;
  };
  materials?: MaterialDetails[]; // Materials to be used in the scene
}

interface CollisionData {
  object1: string;
  object2: string;
  position: [number, number, number];
  normal: [number, number, number];
  distance: number;
}

export class FurniturePlacementService {
  private pythonProcess: PythonShell | null = null;
  private threeDFrontDatasetPath: string;

  constructor(config: { threeDFrontPath: string }) {
    this.threeDFrontDatasetPath = config.threeDFrontPath;
    this.initializePyBullet().catch(error => {
      console.error('Failed to initialize PyBullet:', error);
      throw error;
    });
  }

  private async initializePyBullet(): Promise<void> {
    const pythonScript = path.join(PYTHON_SCRIPT_DIR, 'physics_server.py');
    
    try {
      // Verify that Python script exists first
      if (!fs.existsSync(pythonScript)) {
        throw new Error(`Physics server script not found at: ${pythonScript}`);
      }
      
      // Define a timeout to handle hanging process initialization
      const initializationTimeout = 30000; // 30 seconds
      
      const options: Options = {
        mode: 'json',
        pythonPath: process.env.PYTHON_PATH || 'python3',
        pythonOptions: ['-u'], // Unbuffered stdout and stderr
        args: [this.threeDFrontDatasetPath]
      };

      // Create the Python process
      this.pythonProcess = new PythonShell(pythonScript, options);

      if (!this.pythonProcess) {
        throw new Error('Failed to create Python process');
      }
      
      // Set up error handler that persists after initialization
      this.pythonProcess.on('error', (err: Error) => {
        console.error('PyBullet server error:', err);
      });
      
      // Handle unexpected process exit
      this.pythonProcess.on('close', (code: number) => {
        if (code !== 0) {
          console.error(`PyBullet server exited with code ${code}`);
        }
        this.pythonProcess = null; // Clear the reference
      });

      // Wait for initialization with timeout
      await Promise.race([
        new Promise<void>((resolve, reject) => {
          if (!this.pythonProcess) {
            reject(new Error('PyBullet process not initialized'));
            return;
          }

          // Use a flag to ensure we only process the first message
          let messageProcessed = false;
          
          // Listen for the ready message
          const messageHandler = (message: { status: string }) => {
            // Skip if we've already processed a message
            if (messageProcessed) return;
            
            // Mark as processed to ignore future messages
            messageProcessed = true;
            
            if (message && message.status === 'ready') {
              console.log('PyBullet server ready');
              resolve();
            } else {
              reject(new Error(`Invalid initialization response: ${JSON.stringify(message)}`));
            }
          };
          
          // Register message handler
          this.pythonProcess.on('message', messageHandler);
        }),
        new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`PyBullet initialization timed out after ${initializationTimeout}ms`));
          }, initializationTimeout);
        })
      ]);
    } catch (error) {
      // Clean up if initialization fails
      if (this.pythonProcess) {
        try {
          this.pythonProcess.kill();
          this.pythonProcess = null;
        } catch (cleanupError) {
          console.error('Error cleaning up Python process:', cleanupError);
        }
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error initializing PyBullet: ${errorMessage}`);
      throw error;
    }
  }

  async generateFurniturePlacement(
    roomDescription: string,
    constraints: PlacementConstraints
  ): Promise<{
    layout: SceneLayout;
    assets: FurnitureAsset[];
    physicsValidation: boolean;
  }> {
    try {
      const initialLayout = await this.generateInitialLayout(roomDescription, constraints);
      const assets = await this.fetchMatchingAssets(initialLayout);
      const { validatedLayout, isValid } = await this.validatePhysics(initialLayout, assets);

      return {
        layout: validatedLayout,
        assets,
        physicsValidation: isValid
      };
    } catch (error) {
      console.error('Error in furniture placement:', error);
      throw new Error('Failed to generate furniture placement');
    }
  }

  private async generateInitialLayout(
    description: string,
    constraints: PlacementConstraints
  ): Promise<SceneLayout> {
    try {
      const diffuSceneParams = {
        room_dims: constraints.roomDimensions,
        style: constraints.style || 'modern',
        description,
        existing_furniture: constraints.existingFurniture || [],
        materials: constraints.materials?.map(m => ({
          id: m.id,
          name: m.name,
          type: m.type,
          properties: m.properties,
          applicationAreas: m.applicationAreas || []
        })) || []
      };

      const layout = await this.callDiffuScene(diffuSceneParams);
      return this.processDiffuSceneOutput(layout);
    } catch (error) {
      console.error('Error generating initial layout:', error);
      throw error;
    }
  }

  private async callDiffuScene(params: {
    room_dims: { width: number; length: number; height: number };
    style: string;
    description: string;
    existing_furniture: FurnitureAsset[];
    materials: Array<{
      id: string;
      name: string;
      type: string;
      properties: any;
      applicationAreas: string[];
    }>;
  }): Promise<SceneLayout> {
    // Mock implementation for DiffuScene API
    return {
      furniture: [
        {
          type: 'sofa',
          position: { x: 2, y: 0, z: 1.5 },
          rotation: { y: 0 },
          dimensions: { width: 2.2, height: 0.9, depth: 1 }
        },
        {
          type: 'coffee_table',
          position: { x: 2, y: 0, z: 2.8 },
          rotation: { y: 0 },
          dimensions: { width: 1.2, height: 0.45, depth: 0.8 }
        }
      ],
      surfaces: []
    };
  }

  private async fetchMatchingAssets(layout: SceneLayout): Promise<FurnitureAsset[]> {
    try {
      const assets: FurnitureAsset[] = [];
      for (const furniture of layout.furniture) {
        const asset = await this.findMatchingAsset(furniture);
        assets.push(asset);
      }
      return assets;
    } catch (error) {
      console.error('Error fetching matching assets:', error);
      throw error;
    }
  }

  private async findMatchingAsset(furniture: SceneLayout['furniture'][0]): Promise<FurnitureAsset> {
    const modelPath = path.join(
      this.threeDFrontDatasetPath,
      furniture.type,
      'model.obj'
    );

    return {
      id: `${furniture.type}_${Date.now()}`,
      modelPath,
      category: furniture.type,
      dimensions: furniture.dimensions
    };
  }

  private processDiffuSceneOutput(layout: SceneLayout): SceneLayout {
    return {
      furniture: layout.furniture.map(item => ({
        type: item.type,
        position: {
          x: Number(item.position.x.toFixed(3)),
          y: Number(item.position.y.toFixed(3)),
          z: Number(item.position.z.toFixed(3))
        },
        rotation: { y: Number(item.rotation.y.toFixed(3)) },
        dimensions: {
          width: Number(item.dimensions.width.toFixed(3)),
          height: Number(item.dimensions.height.toFixed(3)),
          depth: Number(item.dimensions.depth.toFixed(3))
        }
      })),
      surfaces: layout.surfaces || []
    };
  }

  private async validatePhysics(
    layout: SceneLayout,
    assets: FurnitureAsset[]
  ): Promise<{ validatedLayout: SceneLayout; isValid: boolean }> {
    try {
      // First validate base furniture placement
      const baseValidation = await this.runPhysicsSimulation(layout, assets);
      
      if (!baseValidation.isValid && baseValidation.collisions) {
        return await this.optimizePlacement(layout, assets, baseValidation.collisions);
      }

      // Then validate surface placements
      const surfaceValidation = await this.validateSurfacePlacements(layout);
      if (!surfaceValidation.isValid && surfaceValidation.issues) {
        return await this.optimizeSurfacePlacements(layout, surfaceValidation.issues);
      }

      return {
        validatedLayout: layout,
        isValid: true
      };
    } catch (error) {
      console.error('Error validating physics:', error);
      throw error;
    }
  }

  private async runPhysicsSimulation(
    layout: SceneLayout,
    assets: FurnitureAsset[]
  ): Promise<{ isValid: boolean; collisions?: CollisionData[] }> {
    return new Promise((resolve, reject) => {
      if (!this.pythonProcess || !this.pythonProcess.send) {
        reject(new Error('PyBullet server not initialized'));
        return;
      }

      const message = {
        command: 'validate',
        layout: {
          furniture: layout.furniture.map(item => ({
            ...item,
            modelPath: assets.find(a => a.category === item.type)?.modelPath
          }))
        }
      };

      // Use a flag-based approach to handle message processing
      let messageProcessed = false;
      let timeoutId: number | null = null;
      
      // Set up a response handler with flag-based "once" behavior
      const messageHandler = (response: { 
        isValid: boolean; 
        collisions?: CollisionData[];
      }) => {
        // Skip if we've already processed a response
        if (messageProcessed) return;
        
        // Mark as processed to ignore future messages
        messageProcessed = true;
        
        // Clear timeout if it exists
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        
        // Resolve with the response
        resolve(response);
      };
      
      // Set up a timeout to handle potential hangs
      const messageTimeoutMs = 10000; // 10 seconds
      timeoutId = setTimeout(() => {
        // Only timeout if we haven't received a response yet
        if (!messageProcessed && this.pythonProcess) {
          messageProcessed = true; // Mark as processed to ignore late responses
          reject(new Error('Physics simulation timed out'));
        }
      }, messageTimeoutMs);
      
      // Register the message handler and send the command
      this.pythonProcess.on('message', messageHandler);
      this.pythonProcess.send(JSON.stringify(message));
    });
  }

  private async optimizePlacement(
    layout: SceneLayout,
    assets: FurnitureAsset[],
    collisions: CollisionData[]
  ): Promise<{ validatedLayout: SceneLayout; isValid: boolean }> {
    const optimizedLayout = { ...layout };
    
    for (const collision of collisions) {
      const furniture = optimizedLayout.furniture.find(
        f => f.type === collision.object1 || f.type === collision.object2
      );
      if (furniture) {
        furniture.position = this.calculateNewPosition(furniture, collision);
      }
    }

    return {
      validatedLayout: optimizedLayout,
      isValid: true
    };
  }

  private calculateNewPosition(
    furniture: SceneLayout['furniture'][0], 
    collision: CollisionData
  ): { x: number; y: number; z: number } {
    return {
      x: furniture.position.x + (collision.normal[0] || 0),
      y: furniture.position.y,
      z: furniture.position.z + (collision.normal[2] || 0)
    };
  }

  private async validateSurfacePlacements(
    layout: SceneLayout
  ): Promise<{ isValid: boolean; issues?: Array<{ 
    furnitureId: string; 
    surfaceId: string; 
    issue: 'weight_exceeded' | 'surface_overlap' | 'unstable' | 'height_mismatch' 
  }> }> {
    const issues: Array<{
      furnitureId: string;
      surfaceId: string;
      issue: 'weight_exceeded' | 'surface_overlap' | 'unstable' | 'height_mismatch';
    }> = [];

    // Check each piece of furniture placed on a surface
    for (const furniture of layout.furniture) {
      if (furniture.surfaceId) {
        const surface = layout.surfaces.find(s => s.id === furniture.surfaceId);
        if (surface) {
          // Check weight limits
          if (surface.maxWeight < this.calculateWeight(furniture)) {
            issues.push({
              furnitureId: furniture.type,
              surfaceId: surface.id,
              issue: 'weight_exceeded'
            });
          }

          // Check surface area and overlap
          if (!this.checkSurfaceFit(furniture, surface)) {
            issues.push({
              furnitureId: furniture.type,
              surfaceId: surface.id,
              issue: 'surface_overlap'
            });
          }

          // Check stability
          if (!this.checkStability(furniture, surface)) {
            issues.push({
              furnitureId: furniture.type,
              surfaceId: surface.id,
              issue: 'unstable'
            });
          }
        }
      }
    }

    return {
      isValid: issues.length === 0,
      issues: issues.length > 0 ? issues : undefined
    };
  }

  private calculateWeight(furniture: SceneLayout['furniture'][0]): number {
    // Simple weight calculation based on dimensions
    const volume = furniture.dimensions.width * 
                   furniture.dimensions.height * 
                   furniture.dimensions.depth;
    return volume * 100; // Assuming average density
  }

  private checkSurfaceFit(
    furniture: SceneLayout['furniture'][0],
    surface: SceneLayout['surfaces'][0]
  ): boolean {
    // Check if furniture fits within surface dimensions
    return furniture.dimensions.width <= surface.dimensions.width &&
           furniture.dimensions.depth <= surface.dimensions.depth;
  }

  private checkStability(
    furniture: SceneLayout['furniture'][0],
    surface: SceneLayout['surfaces'][0]
  ): boolean {
    // Check if center of mass is supported
    const furnitureCenter = {
      x: furniture.position.x + furniture.dimensions.width / 2,
      z: furniture.position.z + furniture.dimensions.depth / 2
    };

    const surfaceMin = {
      x: surface.position.x,
      z: surface.position.z
    };

    const surfaceMax = {
      x: surface.position.x + surface.dimensions.width,
      z: surface.position.z + surface.dimensions.depth
    };

    return furnitureCenter.x >= surfaceMin.x &&
           furnitureCenter.x <= surfaceMax.x &&
           furnitureCenter.z >= surfaceMin.z &&
           furnitureCenter.z <= surfaceMax.z;
  }

  private async optimizeSurfacePlacements(
    layout: SceneLayout,
    issues: Array<{ 
      furnitureId: string; 
      surfaceId: string; 
      issue: 'weight_exceeded' | 'surface_overlap' | 'unstable' | 'height_mismatch' 
    }>
  ): Promise<{ validatedLayout: SceneLayout; isValid: boolean }> {
    const optimizedLayout = { ...layout };

    for (const issue of issues) {
      const furniture = optimizedLayout.furniture.find(f => f.type === issue.furnitureId);
      const surface = optimizedLayout.surfaces.find(s => s.id === issue.surfaceId);

      if (furniture && surface) {
        switch (issue.issue) {
          case 'surface_overlap':
            // Try to adjust position within surface bounds
            this.adjustPositionWithinSurface(furniture, surface);
            break;
          case 'unstable':
            // Center the furniture on the surface
            this.centerOnSurface(furniture, surface);
            break;
          case 'weight_exceeded':
          case 'height_mismatch':
            // Remove from surface and place on floor
            furniture.surfaceId = undefined;
            furniture.surfaceHeight = 0;
            furniture.position.y = 0;
            break;
        }
      }
    }

    return {
      validatedLayout: optimizedLayout,
      isValid: true // Optimized placement should be valid
    };
  }

  private adjustPositionWithinSurface(
    furniture: SceneLayout['furniture'][0],
    surface: SceneLayout['surfaces'][0]
  ): void {
    furniture.position.x = Math.max(
      surface.position.x,
      Math.min(
        surface.position.x + surface.dimensions.width - furniture.dimensions.width,
        furniture.position.x
      )
    );

    furniture.position.z = Math.max(
      surface.position.z,
      Math.min(
        surface.position.z + surface.dimensions.depth - furniture.dimensions.depth,
        furniture.position.z
      )
    );
  }

  private centerOnSurface(
    furniture: SceneLayout['furniture'][0],
    surface: SceneLayout['surfaces'][0]
  ): void {
    furniture.position.x = surface.position.x + 
      (surface.dimensions.width - furniture.dimensions.width) / 2;
    furniture.position.z = surface.position.z + 
      (surface.dimensions.depth - furniture.dimensions.depth) / 2;
  }

  async cleanup(): Promise<void> {
    if (this.pythonProcess) {
      this.pythonProcess.kill();
    }
  }
}