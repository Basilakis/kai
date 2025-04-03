import { Agent, Task } from 'crewai';
import { ThreeDService, ModelEndpoints } from '../../services/3d-designer/threeDService';
import { createLogger } from '../../utils/logger';

interface Room {
  dimensions: { width: number; length: number; height: number };
  windows?: Array<{ wall: 'north' | 'south' | 'east' | 'west'; position: number }>;
  doors?: Array<{ wall: 'north' | 'south' | 'east' | 'west'; position: number }>;
}

interface LayoutGeneratorConfig {
  modelEndpoints: ModelEndpoints;
}

/**
 * Specialized agent for generating room layouts from requirements or 2D drawings
 */
export class LayoutGeneratorAgent extends Agent {
  private logger = createLogger('LayoutGenerator');
  private threeDService: ThreeDService;

  constructor(config: LayoutGeneratorConfig) {
    super({
      name: 'Layout Generator',
      goal: 'Generate optimal room layouts based on requirements or 2D drawings',
      backstory: `I am a specialized AI agent trained in architectural design and space planning. 
                 I can analyze 2D drawings and requirements to generate optimal 3D room layouts 
                 that follow architectural standards and design principles.`,
      verbose: true
    });

    this.threeDService = new ThreeDService(config.modelEndpoints);
  }

  async executeTask(task: Task): Promise<any> {
    const taskData = JSON.parse(task.description);
    const { type, requirements } = taskData;

    try {
      switch (type) {
        case 'layout_from_requirements':
          return await this.generateLayoutFromRequirements(requirements);
        
        case 'layout_from_drawing':
          return await this.generateLayoutFromDrawing(requirements);
        
        default:
          throw new Error(`Unsupported task type: ${type}`);
      }
    } catch (error) {
      this.logger.error('Error executing layout task:', error);
      throw error;
    }
  }

  private async generateLayoutFromRequirements(requirements: any): Promise<any> {
    this.logger.info('Generating layout from requirements');

    const { rooms, style, constraints } = requirements;

    // Generate room layouts
    const layout = await this.threeDService.generateRoomLayout({
      rooms: rooms.map((room: Room) => ({
        dimensions: room.dimensions,
        windows: room.windows,
        doors: room.doors
      })),
      style
    });

    // Validate layout against architectural standards
    const validationResult = await this.validateLayout(layout);
    if (!validationResult.valid) {
      this.logger.warn('Layout validation warnings:', validationResult.warnings);
    }

    return {
      layout,
      validation: validationResult,
      metadata: {
        generatedFrom: 'requirements',
        style,
        timestamp: Date.now()
      }
    };
  }

  private async generateLayoutFromDrawing(requirements: any): Promise<any> {
    this.logger.info('Generating layout from 2D drawing');

    const { drawing, scale, preferences } = requirements;

    // Process the architectural drawing
    const layout = await this.threeDService.processArchitecturalDrawing(drawing);

    // Validate the generated layout
    const validationResult = await this.validateLayout(layout);
    if (!validationResult.valid) {
      this.logger.warn('Layout validation warnings:', validationResult.warnings);
    }

    return {
      layout,
      validation: validationResult,
      metadata: {
        generatedFrom: 'drawing',
        scale,
        timestamp: Date.now()
      }
    };
  }

  private async validateLayout(layout: any): Promise<{
    valid: boolean;
    warnings: string[];
  }> {
    const warnings: string[] = [];

    // Check room dimensions
    for (const room of layout.rooms || []) {
      if (room.dimensions.width < 2 || room.dimensions.length < 2) {
        warnings.push(`Room "${room.name}" is too small for comfortable use`);
      }
    }

    // Check door placements
    for (const door of layout.doors || []) {
      if (door.width < 0.8) {
        warnings.push(`Door at (${door.position.x}, ${door.position.y}) is narrower than standard width`);
      }
    }

    // Check window placements
    for (const window of layout.windows || []) {
      if (window.height < 1) {
        warnings.push(`Window at (${window.position.x}, ${window.position.y}) is shorter than recommended height`);
      }
    }

    // Check wall alignments
    for (const wall of layout.walls || []) {
      if (!this.isWallAligned(wall)) {
        warnings.push(`Wall at (${wall.start.x}, ${wall.start.y}) is not properly aligned`);
      }
    }

    return {
      valid: warnings.length === 0,
      warnings
    };
  }

  private isWallAligned(wall: any): boolean {
    // Check if wall is vertical or horizontal (allowing small deviation)
    const dx = Math.abs(wall.end.x - wall.start.x);
    const dy = Math.abs(wall.end.y - wall.start.y);
    const tolerance = 0.01; // 1cm tolerance

    return dx < tolerance || dy < tolerance;
  }
}