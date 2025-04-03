import { logger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { BaseThreeDProvider } from './baseProvider';
import {
  ProcessingResult,
  RoomLayout,
  Scene3D,  // Required for core 3D scene representation
  ArchitecturalProvider as IArchitecturalProvider,
  ModelEndpoints,
  ArchitecturalElement
} from './types';

/**
 * Provider for architectural design and room layout
 */
export class ArchitecturalProvider extends BaseThreeDProvider implements IArchitecturalProvider {
  constructor(modelEndpoints: ModelEndpoints) {
    super(modelEndpoints);
  }

  /**
   * Process architectural drawing to extract room layout
   */
  async processArchitecturalDrawing(drawing: ArrayBuffer): Promise<RoomLayout> {
    try {
      const formData = new FormData();
      formData.append('drawing', new Blob([drawing]));

      const response = await fetch(
        `${this.modelEndpoints.architecturalRecognition}/process`,
        {
          method: 'POST',
          body: formData
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to process architectural drawing: ${response.statusText}`);
      }

      const result = await response.json();
      return await this.validateArchitecturalStandards(result);
    } catch (error) {
      logger.error('Error processing architectural drawing:', { error });
      throw error;
    }
  }

  /**
   * Process image through architectural pipeline
   */
  async processImage(imageBuffer: Buffer, options: {
    detectObjects?: boolean;
    estimateDepth?: boolean;
    segmentScene?: boolean;
  }): Promise<ProcessingResult> {
    try {
      // Create form data with image and options
      const formData = new FormData();
      formData.append('image', new Blob([imageBuffer]));
      formData.append('options', JSON.stringify(options));

      // Send to ML service
      const response = await fetch(
        `${this.apiBase}/3d/process-architectural-image`,
        {
          method: 'POST',
          body: formData
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to process image: ${response.statusText}`);
      }

      return {
        success: true,
        data: await response.json()
      };
    } catch (error) {
      logger.error('Error processing image:', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Process text input for architectural generation
   */
  async processText(text: string, options: {
    style?: string;
    constraints?: any;
  }): Promise<ProcessingResult> {
    try {
      const response = await fetch(
        `${this.modelEndpoints.roomLayoutGenerator}/generate-from-text`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, options })
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to process text: ${response.statusText}`);
      }

      return {
        success: true,
        data: await response.json()
      };
    } catch (error) {
      logger.error('Error processing text:', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Generate room layout based on specifications
   */
  async generateRoomLayout(specifications: {
    rooms: Array<{
      dimensions: { width: number; length: number; height: number };
      windows?: Array<{ wall: 'north' | 'south' | 'east' | 'west'; position: number }>;
      doors?: Array<{ wall: 'north' | 'south' | 'east' | 'west'; position: number }>;
    }>;
    style?: string;
  }): Promise<RoomLayout[]> {
    try {
      const response = await fetch(
        `${this.modelEndpoints.roomLayoutGenerator}/generate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(specifications)
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to generate room layout: ${response.statusText}`);
      }

      const layouts = await response.json() as RoomLayout[];
      return await Promise.all(layouts.map(layout => this.validateArchitecturalStandards(layout)));
    } catch (error) {
      logger.error('Error generating room layout:', { error });
      throw error;
    }
  }

  /**
   * Generate furniture placement for a room layout
   */
  async generateFurniturePlacement(layout: RoomLayout, requirements: {
    style?: string;
    constraints?: {
      minSpacing?: number;
      alignToWalls?: boolean;
      maxOccupancy?: number;
    };
  }): Promise<{
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
  }> {
    try {
      const response = await fetch(
        `${this.modelEndpoints.blenderProc}/furniture-placement`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ layout, requirements })
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to generate furniture placement: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Convert to Scene3D for better integration with 3D systems
      const scene = this.convertToScene3D({
        ...layout,
        elements: [
          ...layout.elements,
          ...result.furniture.map((f: {
            id?: string;
            type: string;
            position: { x: number; y: number; z: number };
            rotation: { y: number };
            dimensions: { width: number; height: number; depth: number };
          }) => ({
            id: f.id || uuidv4(),
            type: 'furniture',
            position: f.position,
            rotation: { 
              x: 0, 
              y: f.rotation.y || 0, 
              z: 0 
            },
            dimensions: {
              width: f.dimensions.width,
              height: f.dimensions.height,
              depth: f.dimensions.depth
            },
            metadata: { type: f.type }
          }))
        ],
        metadata: {
          ...layout.metadata,
          style: result.metadata.style,
          occupancyRate: result.metadata.occupancyRate,
          flowScore: result.metadata.flowScore
        }
      });

      return {
        ...result,
        scene // Include the 3D scene representation
      };
    } catch (error) {
      logger.error('Error generating furniture placement:', { error });
      throw error;
    }
  }

  /**
   * Convert room layout to 3D scene representation
   */
  private convertToScene3D(layout: RoomLayout): Scene3D {
    return {
      id: layout.id || uuidv4(),
      name: layout.name || 'Architectural Scene',
      elements: layout.elements.map((element: ArchitecturalElement) => ({
        id: element.id || uuidv4(),
        type: element.type,
        position: element.position,
        rotation: {
          x: element.rotation?.x || 0,
          y: element.rotation?.y || 0,
          z: element.rotation?.z || 0
        },
        dimensions: element.dimensions,
        metadata: element.metadata
      })),
      metadata: {
        ...layout.metadata,
        generatedFrom: 'architectural-provider'
      }
    };
  }

  private async validateArchitecturalStandards(layout: RoomLayout): Promise<RoomLayout> {
    // Validate against architectural standards
    const standardDoorHeight = 2.1; // meters
    const standardWindowHeight = 1.5; // meters
    const minRoomHeight = 2.4; // meters
    const minDoorWidth = 0.8; // meters
    
    // Adjust elements to meet standards
    layout.elements = layout.elements.map(element => {
      switch (element.type) {
        case 'door':
          element.dimensions.height = standardDoorHeight;
          element.dimensions.width = Math.max(element.dimensions.width, minDoorWidth);
          element.metadata = { ...element.metadata, standardSize: true };
          break;
        case 'window':
          element.dimensions.height = standardWindowHeight;
          element.metadata = { ...element.metadata, standardSize: true };
          break;
        case 'wall':
          element.dimensions.height = Math.max(layout.dimensions.height, minRoomHeight);
          break;
      }
      return element;
    });

    layout.metadata = {
      ...layout.metadata,
      standardsCompliance: true
    };

    return layout;
  }
}