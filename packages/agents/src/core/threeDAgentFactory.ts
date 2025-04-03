/**
 * Factory for creating specialized 3D visualization agents
 */
import { Agent, Crew, Task } from 'crewai';
import { createLogger } from '../utils/logger';
import { ThreeDService, ModelEndpoints } from '../services/3d-designer/threeDService';
import { MaterialService } from '../services/materialService';
import { LayoutGeneratorAgent } from '../frontend/specialized/layoutGeneratorAgent';
import {
  FurniturePlacementAgent,
  MaterialExpertAgent,
  SceneRefinerAgent,
  createFurniturePlacementAgent,
  createMaterialExpertAgent,
  createSceneRefinerAgent
} from './specializedAgents';

export interface ThreeDAgentConfig {
  modelEndpoints: ModelEndpoints;
  serviceEndpoints: {
    materialService: string;
  };
  allowDelegation?: boolean;
  maxRetries?: number;
  timeoutMs?: number;
}

export class ThreeDAgentFactory {
  private logger = createLogger('ThreeDAgentFactory');
  private threeDService: ThreeDService;
  private materialService: MaterialService;

  constructor(config: ThreeDAgentConfig) {
    this.threeDService = new ThreeDService(config.modelEndpoints);
    this.materialService = new MaterialService({
      baseURL: config.serviceEndpoints.materialService
    });
  }

  /**
   * Create a layout generator agent
   */
  createLayoutAgent(): LayoutGeneratorAgent {
    this.logger.info('Creating layout generator agent');
    return new LayoutGeneratorAgent({
      modelEndpoints: this.threeDService.getModelEndpoints()
    });
  }

  /**
   * Create a furniture placement agent
   */
  createFurniturePlacementAgent(): FurniturePlacementAgent {
    this.logger.info('Creating furniture placement agent');
    return createFurniturePlacementAgent(
      new Agent({
        name: 'Furniture Placement Specialist',
        goal: 'Optimize furniture arrangements with physics constraints',
        backstory: 'Expert in interior design and physics-based placement',
        allowDelegation: true
      }),
      async (task) => {
        const { layout, requirements } = JSON.parse(task.description);
        return this.threeDService.generateFurniturePlacement(layout, requirements);
      }
    );
  }

  /**
   * Create a material expert agent
   */
  createMaterialExpertAgent(): MaterialExpertAgent {
    this.logger.info('Creating material expert agent');
    return createMaterialExpertAgent(
      new Agent({
        name: 'Material Expert',
        goal: 'Select and map appropriate materials to surfaces',
        backstory: 'Expert in material properties and aesthetic combinations',
        allowDelegation: true
      }),
      async (task) => {
        const { layout, furniture, requirements } = JSON.parse(task.description);
        return this.materialService.suggestMaterials(layout, furniture, requirements);
      }
    );
  }

  /**
   * Create a scene refiner agent
   */
  createSceneRefinerAgent(): SceneRefinerAgent {
    this.logger.info('Creating scene refiner agent');
    return createSceneRefinerAgent(
      new Agent({
        name: 'Scene Refiner',
        goal: 'Progressively improve scene based on feedback',
        backstory: 'Expert in 3D scene optimization and refinement',
        allowDelegation: true
      }),
      async (task) => {
        const { currentState, feedback } = JSON.parse(task.description);
        return this.threeDService.refineResult(currentState, feedback);
      }
    );
  }

  /**
   * Create all specialized agents needed for 3D visualization
   */
  createAllAgents() {
    return {
      layoutAgent: this.createLayoutAgent(),
      furnitureAgent: this.createFurniturePlacementAgent(),
      materialAgent: this.createMaterialExpertAgent(),
      refinerAgent: this.createSceneRefinerAgent()
    };
  }

  /**
   * Create a crew with all specialized agents
   */
  createCrew(): Crew {
    const allAgents = this.createAllAgents();
    return new Crew({
      agents: Object.values(allAgents),
      tasks: [],
      verbose: true,
      process: 'sequential',
      maxConcurrency: 1
    });
  }
}