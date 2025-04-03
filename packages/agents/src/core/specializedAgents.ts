import { Agent, Task } from 'crewai';
import { RoomLayout } from '../services/3d-designer/threeDService';
import { MaterialRecommendation } from '../services/materialService';

export interface ExecutableAgent extends Agent {
  executeTask(task: Task): Promise<any>;
}

export interface FurniturePlacementAgent extends ExecutableAgent {
  executeTask(task: Task): Promise<{
    furniture: Array<{
      type: string;
      position: { x: number; y: number; z: number };
      rotation: { y: number };
      dimensions: { width: number; length: number; height: number };
    }>;
    metadata: {
      style: string;
      occupancyRate: number;
      flowScore: number;
    };
  }>;
}

export interface MaterialExpertAgent extends ExecutableAgent {
  executeTask(task: Task): Promise<MaterialRecommendation>;
}

export interface SceneRefinerAgent extends ExecutableAgent {
  executeTask(task: Task): Promise<{
    layout?: RoomLayout;
    furniture?: any;
    materials?: MaterialRecommendation;
    refinements: Array<{
      type: string;
      description: string;
      before: any;
      after: any;
    }>;
  }>;
}

export function createFurniturePlacementAgent(agent: Agent, executeTask: (task: Task) => Promise<any>): FurniturePlacementAgent {
  return Object.assign(agent, { executeTask });
}

export function createMaterialExpertAgent(agent: Agent, executeTask: (task: Task) => Promise<any>): MaterialExpertAgent {
  return Object.assign(agent, { executeTask });
}

export function createSceneRefinerAgent(agent: Agent, executeTask: (task: Task) => Promise<any>): SceneRefinerAgent {
  return Object.assign(agent, { executeTask });
}