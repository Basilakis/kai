import { Agent, Crew, Task } from 'crewai';
import { Redis } from 'redis';
import { ThreeDService, ModelEndpoints } from '../services/3d-designer/threeDService';
import { MaterialService } from '../services/materialService';
import { VectorService } from '../services/vectorService';
import { createLogger } from '../utils/logger';
import { LayoutGeneratorAgent } from '../frontend/specialized/layoutGeneratorAgent';
import {
  FurniturePlacementAgent,
  MaterialExpertAgent,
  SceneRefinerAgent,
  createFurniturePlacementAgent,
  createMaterialExpertAgent,
  createSceneRefinerAgent
} from './specializedAgents';

// Types for state management
interface SceneState {
  id: string;
  version: number;
  layout?: any;
  furniture?: any;
  materials?: any;
  feedback?: string[];
  status: 'in_progress' | 'completed' | 'failed';
  agentResults: Record<string, any>;
  timestamp: number;
}

interface CoordinatorConfig {
  redisConfig?: {
    host: string;
    port: number;
    password?: string;
  };
  modelEndpoints: ModelEndpoints;
  serviceEndpoints: {
    materialService: string;
    vectorService: string;
  };
}

/**
 * Coordinates the 3D visualization pipeline between CrewAI agents
 * and manages progressive scene refinement
 */
export class ThreeDVisualizationCoordinator {
  private logger = createLogger('3DVisCoordinator');
  private redisClient: Redis | null = null;
  private threeDService: ThreeDService;
  private materialService: MaterialService;
  private vectorService: VectorService;

  // Specialized agents
  private layoutAgent: LayoutGeneratorAgent = new LayoutGeneratorAgent({
    modelEndpoints: {} as ModelEndpoints // Will be initialized in constructor
  });
  private furnitureAgent: FurniturePlacementAgent = createFurniturePlacementAgent(
    new Agent({
      name: 'Furniture Placement Specialist',
      goal: 'Optimize furniture arrangements with physics constraints',
      backstory: 'Expert in interior design and physics-based placement',
      allowDelegation: true
    }),
    async () => ({ furniture: [], metadata: { style: '', occupancyRate: 0, flowScore: 0 } })
  );
  private materialAgent: MaterialExpertAgent = createMaterialExpertAgent(
    new Agent({
      name: 'Material Expert',
      goal: 'Select and map appropriate materials to surfaces',
      backstory: 'Expert in material properties and aesthetic combinations',
      allowDelegation: true
    }),
    async () => ({ suggestions: [], metadata: { style: '', colorPalette: [], estimatedCost: 0 } })
  );
  private refinementAgent: SceneRefinerAgent = createSceneRefinerAgent(
    new Agent({
      name: 'Scene Refiner',
      goal: 'Progressively improve scene based on feedback',
      backstory: 'Expert in 3D scene optimization and refinement',
      allowDelegation: true
    }),
    async () => ({ refinements: [] })
  );

  constructor(config: CoordinatorConfig) {
    // Initialize services
    this.threeDService = new ThreeDService(config.modelEndpoints);
    this.materialService = new MaterialService({
      baseURL: config.serviceEndpoints.materialService
    });
    this.vectorService = new VectorService({
      baseURL: config.serviceEndpoints.vectorService
    });

    // Initialize Redis if configured
    if (config.redisConfig) {
      this.initializeRedis(config.redisConfig);
    }

    // Initialize specialized agents
    this.initializeAgents();
  }

  /**
   * Initialize Redis client for state persistence
   */
  private async initializeRedis(config: CoordinatorConfig['redisConfig']) {
    if (!config) return;

    try {
      this.redisClient = Redis.createClient({
        socket: {
          host: config.host,
          port: config.port
        },
        password: config.password
      }) as Redis;

      await this.redisClient.connect();
      this.logger.info('Redis connected successfully');
    } catch (error) {
      this.logger.error('Redis connection failed:', error);
      throw error;
    }
  }

  /**
   * Initialize specialized agents for different aspects of 3D visualization
   */
  private initializeAgents() {
    // Re-initialize layout agent with proper model endpoints
    this.layoutAgent = new LayoutGeneratorAgent({
      modelEndpoints: this.threeDService.getModelEndpoints()
    });

    // Initialize furniture placement agent
    this.furnitureAgent = createFurniturePlacementAgent(
      new Agent({
        name: 'Furniture Placement Specialist',
        goal: 'Optimize furniture arrangements with physics constraints',
        backstory: 'Expert in interior design and physics-based placement',
        allowDelegation: true
      }),
      async (task: Task) => {
        const { layout, requirements } = JSON.parse(task.description);
        return this.threeDService.generateFurniturePlacement(layout, requirements);
      }
    );

    // Initialize material expert agent
    this.materialAgent = createMaterialExpertAgent(
      new Agent({
        name: 'Material Expert',
        goal: 'Select and map appropriate materials to surfaces',
        backstory: 'Expert in material properties and aesthetic combinations',
        allowDelegation: true
      }),
      async (task: Task) => {
        const { layout, furniture, requirements } = JSON.parse(task.description);
        return this.materialService.suggestMaterials(layout, furniture, requirements);
      }
    );

    // Initialize scene refiner agent
    this.refinementAgent = createSceneRefinerAgent(
      new Agent({
        name: 'Scene Refiner',
        goal: 'Progressively improve scene based on feedback',
        backstory: 'Expert in 3D scene optimization and refinement',
        allowDelegation: true
      }),
      async (task: Task) => {
        const { currentState, feedback } = JSON.parse(task.description);
        return this.threeDService.refineResult(currentState, feedback);
      }
    );
  }

  /**
   * Create a new scene state or load existing one
   */
  async initializeSceneState(sceneId: string): Promise<SceneState> {
    const initialState: SceneState = {
      id: sceneId,
      version: 1,
      status: 'in_progress',
      agentResults: {},
      timestamp: Date.now()
    };

    if (this.redisClient) {
      await this.redisClient.set(
        `scene:${sceneId}`,
        JSON.stringify(initialState)
      );
    }

    return initialState;
  }

  /**
   * Get current state of a scene
   */
  async getSceneState(sceneId: string): Promise<SceneState | null> {
    if (!this.redisClient) return null;

    const state = await this.redisClient.get(`scene:${sceneId}`);
    return state ? JSON.parse(state) : null;
  }

  /**
   * Update scene state with new data
   */
  async updateSceneState(
    sceneId: string,
    updates: Partial<SceneState>
  ): Promise<SceneState> {
    const currentState = await this.getSceneState(sceneId) || 
                        await this.initializeSceneState(sceneId);

    const newState: SceneState = {
      ...currentState,
      ...updates,
      version: currentState.version + 1,
      timestamp: Date.now()
    };

    if (this.redisClient) {
      await this.redisClient.set(
        `scene:${sceneId}`,
        JSON.stringify(newState)
      );
    }

    return newState;
  }

  /**
   * Create a crew for scene generation
   */
  createSceneGenerationCrew(): Crew {
    return new Crew({
      agents: [
        this.layoutAgent,
        this.furnitureAgent,
        this.materialAgent,
        this.refinementAgent
      ],
      tasks: [],
      verbose: true
    });
  }

  /**
   * Process a scene generation request through the agent pipeline
   */
  async processSceneRequest(
    sceneId: string,
    requirements: any
  ): Promise<SceneState> {
    // Initialize scene state
    let state = await this.initializeSceneState(sceneId);

    try {
      // 1. Generate layout
      const layoutTask = new Task({
        description: JSON.stringify({
          type: 'layout_generation',
          requirements
        }),
        agent: this.layoutAgent
      });

      const layoutResult = await this.layoutAgent.executeTask(layoutTask);
      state = await this.updateSceneState(sceneId, {
        layout: layoutResult,
        agentResults: {
          ...state.agentResults,
          layout: layoutResult
        }
      });

      // 2. Place furniture
      const furnitureTask = new Task({
        description: JSON.stringify({
          type: 'furniture_placement',
          layout: layoutResult,
          requirements
        }),
        agent: this.furnitureAgent
      });

      const furnitureResult = await this.furnitureAgent.executeTask(furnitureTask);
      state = await this.updateSceneState(sceneId, {
        furniture: furnitureResult,
        agentResults: {
          ...state.agentResults,
          furniture: furnitureResult
        }
      });

      // 3. Select materials
      const materialTask = new Task({
        description: JSON.stringify({
          type: 'material_selection',
          layout: layoutResult,
          furniture: furnitureResult,
          requirements
        }),
        agent: this.materialAgent
      });

      const materialResult = await this.materialAgent.executeTask(materialTask);
      state = await this.updateSceneState(sceneId, {
        materials: materialResult,
        agentResults: {
          ...state.agentResults,
          materials: materialResult
        }
      });

      // Mark as completed
      state = await this.updateSceneState(sceneId, {
        status: 'completed'
      });

      return state;
    } catch (error) {
      this.logger.error('Error processing scene request:', error);
      
      // Update state with error
      state = await this.updateSceneState(sceneId, {
        status: 'failed',
        feedback: [...(state.feedback || []), error instanceof Error ? error.message : 'Unknown error']
      });

      throw error instanceof Error ? error : new Error('Unknown error occurred');
    }
  }

  /**
   * Process feedback and refine the scene
   */
  async processRefinementFeedback(
    sceneId: string,
    feedback: string
  ): Promise<SceneState> {
    const currentState = await this.getSceneState(sceneId);
    if (!currentState) {
      throw new Error(`No scene found with ID ${sceneId}`);
    }

    try {
      const refinementTask = new Task({
        description: JSON.stringify({
          type: 'scene_refinement',
          currentState,
          feedback
        }),
        agent: this.refinementAgent
      });

      const refinementResult = await this.refinementAgent.executeTask(refinementTask);
      
      // Update state with refinements
      const newState = await this.updateSceneState(sceneId, {
        ...refinementResult,
        feedback: [...(currentState.feedback || []), feedback]
      });

      return newState;
    } catch (error) {
      this.logger.error('Error processing refinement:', error);
      throw error;
    }
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    if (this.redisClient) {
      await this.redisClient.disconnect();
    }
  }
}