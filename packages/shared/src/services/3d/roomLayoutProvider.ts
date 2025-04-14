import { logger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { BaseThreeDProvider } from './baseProvider';
import {
  ArchitecturalElement,
  RoomLayout,
  ProcessingResult,
  Scene3D,
  ModelEndpoints
} from './types';

/**
 * Interface for RoomLayoutProvider specific options
 */
export interface RoomLayoutOptions {
  style?: string;
  quality?: 'low' | 'medium' | 'high';
  useCache?: boolean;
  designPrinciples?: Array<{
    name: string;
    weight: number;
  }>;
}

/**
 * Interface for furniture item used in placement
 */
export interface FurnitureItem {
  id?: string;
  type: string;
  dimensions: {
    width: number;
    depth: number;
    height: number;
  };
  preferred_zone?: string;
  keep_position?: boolean;
  position?: {
    x: number;
    y: number;
    z: number;
  };
  rotation?: number;
  orientation_constraints?: string[];
}

/**
 * Provider for room layout and furniture placement optimization using SpaceFormer
 */
export class RoomLayoutProvider extends BaseThreeDProvider {
  constructor(modelEndpoints: ModelEndpoints) {
    super(modelEndpoints);
  }

  /**
   * Generate optimized room layout based on dimensions and room type
   * 
   * @param roomDimensions - The dimensions of the room
   * @param roomType - The type of room (e.g., living_room, bedroom, kitchen)
   * @param fixedElements - Fixed elements like doors and windows
   * @param options - Additional options for layout generation
   * @returns Promise with generated layouts
   */
  async generateOptimizedLayout(
    roomDimensions: { width: number; length: number; height?: number },
    roomType: string,
    fixedElements?: Array<{
      type: 'door' | 'window' | 'built_in';
      wall: 'north' | 'south' | 'east' | 'west';
      position: number;
      width: number;
      height: number;
    }>,
    options?: RoomLayoutOptions
  ): Promise<RoomLayout[]> {
    try {
      // Prepare the request body
      const requestBody = {
        room_dimensions: roomDimensions,
        room_type: roomType,
        fixed_elements: fixedElements || [],
        style_preferences: options?.style ? { [options.style]: 1.0 } : undefined,
        quality: options?.quality || 'medium'
      };

      // Call the SpaceFormer service
      const response = await fetch(
        `${this.modelEndpoints.spaceFormer}/generate-room-layout`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to generate room layout: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.error) {
        throw new Error(`Service error: ${result.error}`);
      }

      // Convert the service response to RoomLayout objects
      const layouts: RoomLayout[] = result.layouts.map((layout: any) => {
        return this.convertServiceResponseToRoomLayout(layout, roomType, roomDimensions);
      });

      return layouts;
    } catch (error) {
      logger.error('Error generating optimized room layout:', { error });
      throw error;
    }
  }

  /**
   * Place furniture optimally in a room layout
   * 
   * @param layout - The room layout to place furniture in
   * @param furnitureItems - Furniture items to place
   * @param options - Additional options for furniture placement
   * @returns Promise with furniture placement result
   */
  async optimizeFurniturePlacement(
    layout: RoomLayout,
    furnitureItems: FurnitureItem[],
    options?: RoomLayoutOptions & {
      constraints?: {
        minSpacing?: number;
        alignToWalls?: boolean;
        optimization_goals?: Record<string, number>;
      }
    }
  ): Promise<{
    layout: RoomLayout;
    placements: Array<{
      furniture_id: string;
      position: { x: number; y: number; z: number };
      rotation: number;
      zone: string;
    }>;
    metrics: {
      flow_score: number;
      occupancy_rate: number;
      accessibility_score: number;
      design_principles_score: Record<string, number>;
    };
  }> {
    try {
      // Prepare the request body
      const requestBody = {
        room_layout: {
          layouts: [this.convertRoomLayoutToServiceFormat(layout)]
        },
        furniture_items: furnitureItems,
        constraints: options?.constraints,
        quality: options?.quality || 'medium'
      };

      // Call the SpaceFormer service
      const response = await fetch(
        `${this.modelEndpoints.spaceFormer}/place-furniture`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to optimize furniture placement: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.error) {
        throw new Error(`Service error: ${result.error}`);
      }

      // Get the best furniture placement (highest score)
      const bestPlacement = result.furniture_placements[0];

      // Update the room layout with the placed furniture
      const updatedLayout = { ...layout };
      
      // Add furniture elements to the layout
      const furnitureElements: ArchitecturalElement[] = bestPlacement.furniture_placements.map(
        (placement: {
          id: string;
          position: { x: number; y: number; z: number };
          rotation: number;
          zone: string;
        }) => {
          // Find the corresponding furniture item
          const furnitureItem = furnitureItems.find(item => 
            item.id === placement.id || 
            (item.id === undefined && placement.id.includes(item.type))
          );

          if (!furnitureItem) {
            logger.warn(`Furniture item not found for placement: ${placement.id}`);
            return null;
          }

          // Create an architectural element for the furniture
          return {
            id: placement.id,
            type: 'furniture',
            position: placement.position,
            dimensions: {
              width: furnitureItem.dimensions.width,
              height: furnitureItem.dimensions.height,
              depth: furnitureItem.dimensions.depth
            },
            rotation: {
              x: 0,
              y: placement.rotation,
              z: 0
            },
            metadata: {
              type: furnitureItem.type,
              zone: placement.zone
            }
          };
        }
      ).filter(Boolean) as ArchitecturalElement[];

      // Update the room layout with furniture
      updatedLayout.elements = [
        ...updatedLayout.elements.filter(element => element.type !== 'furniture'),
        ...furnitureElements
      ];

      // Update metadata with placement metrics
      updatedLayout.metadata = {
        ...updatedLayout.metadata,
        flowScore: bestPlacement.metrics.flow_score,
        occupancyRate: bestPlacement.metrics.occupancy_rate,
        accessibilityScore: bestPlacement.metrics.accessibility_score,
        designPrinciplesScores: bestPlacement.metrics.design_principles_scores
      };

      return {
        layout: updatedLayout,
        placements: bestPlacement.furniture_placements,
        metrics: {
          flow_score: bestPlacement.metrics.flow_score,
          occupancy_rate: bestPlacement.metrics.occupancy_rate,
          accessibility_score: bestPlacement.metrics.accessibility_score,
          design_principles_score: bestPlacement.metrics.design_principles_scores
        }
      };
    } catch (error) {
      logger.error('Error optimizing furniture placement:', { error });
      throw error;
    }
  }

  /**
   * Analyze an existing layout and provide improvement suggestions
   * 
   * @param layout - The room layout to analyze
   * @param furnitureItems - Existing furniture items
   * @returns Promise with analysis and suggestions
   */
  async analyzeLayout(
    layout: RoomLayout,
    furnitureItems: FurnitureItem[]
  ): Promise<{
    overall_score: number;
    principle_scores: Record<string, number>;
    suggestions: Array<{
      principle: string;
      score: number;
      suggestion: string;
      priority: 'high' | 'medium' | 'low';
    }>;
  }> {
    try {
      // Prepare room data from layout
      const roomData = {
        dimensions: layout.dimensions,
        type: layout.metadata.purpose || 'room',
        fixed_elements: layout.elements
          .filter(element => element.type !== 'furniture')
          .map(element => ({
            type: element.type,
            position: {
              x: element.position.x,
              y: element.position.y,
              z: element.position.z
            },
            dimensions: {
              width: element.dimensions.width,
              height: element.dimensions.height,
              depth: element.dimensions.depth
            },
            rotation: element.rotation.y || 0
          }))
      };

      // Prepare furniture data from layout
      const existingFurniture = layout.elements
        .filter(element => element.type === 'furniture')
        .map(element => ({
          id: element.id,
          type: element.metadata?.type || 'furniture',
          dimensions: {
            width: element.dimensions.width,
            depth: element.dimensions.depth,
            height: element.dimensions.height
          },
          position: {
            x: element.position.x,
            y: element.position.y,
            z: element.position.z
          },
          rotation: element.rotation.y || 0
        }));

      // Use the furniture items if provided, otherwise use existing furniture
      const furnitureData = furnitureItems.length > 0 ? furnitureItems : existingFurniture;

      // Call the SpaceFormer service
      const response = await fetch(
        `${this.modelEndpoints.spaceFormer}/analyze-layout`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            room_data: roomData,
            furniture_data: furnitureData
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to analyze layout: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.error) {
        throw new Error(`Service error: ${result.error}`);
      }

      return {
        overall_score: result.overall_score,
        principle_scores: result.principle_scores,
        suggestions: result.suggestions
      };
    } catch (error) {
      logger.error('Error analyzing layout:', { error });
      throw error;
    }
  }

  /**
   * Optimize an existing layout based on specific goals
   * 
   * @param layout - The room layout to optimize
   * @param furnitureItems - Existing furniture items
   * @param optimizationGoals - Weights for different optimization goals
   * @param options - Additional options for optimization
   * @returns Promise with optimized layout
   */
  async optimizeExistingLayout(
    layout: RoomLayout,
    furnitureItems: FurnitureItem[],
    optimizationGoals: Record<string, number>,
    options?: RoomLayoutOptions
  ): Promise<{
    original_layout: RoomLayout;
    optimized_layout: RoomLayout;
    changes: Array<{
      furniture_id: string;
      old_position?: { x: number; y: number; z: number };
      new_position: { x: number; y: number; z: number };
      old_rotation?: number;
      new_rotation: number;
    }>;
    improvement_metrics: Record<string, number>;
  }> {
    try {
      // Prepare room data from layout
      const roomData = {
        dimensions: layout.dimensions,
        type: layout.metadata.purpose || 'room',
        fixed_elements: layout.elements
          .filter(element => element.type !== 'furniture')
          .map(element => ({
            type: element.type,
            position: {
              x: element.position.x,
              y: element.position.y,
              z: element.position.z
            },
            dimensions: {
              width: element.dimensions.width,
              height: element.dimensions.height,
              depth: element.dimensions.depth
            },
            rotation: element.rotation.y || 0
          }))
      };

      // Prepare furniture data 
      const existingFurniture = layout.elements
        .filter(element => element.type === 'furniture')
        .map(element => ({
          id: element.id,
          type: element.metadata?.type || 'furniture',
          dimensions: {
            width: element.dimensions.width,
            depth: element.dimensions.depth,
            height: element.dimensions.height
          },
          position: {
            x: element.position.x,
            y: element.position.y,
            z: element.position.z
          },
          rotation: element.rotation.y || 0
        }));

      // Use the furniture items if provided, otherwise use existing furniture
      const furnitureData = furnitureItems.length > 0 ? furnitureItems : existingFurniture;

      // Call the SpaceFormer service
      const response = await fetch(
        `${this.modelEndpoints.spaceFormer}/optimize-existing-layout`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            room_data: roomData,
            furniture_data: furnitureData,
            optimization_goals: optimizationGoals,
            quality: options?.quality || 'medium'
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to optimize existing layout: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.error) {
        throw new Error(`Service error: ${result.error}`);
      }

      // Get the optimized layout from the result
      const optimizedResult = result.optimized_placement.furniture_placements[0];
      
      // Create a copy of the original layout
      const optimizedLayout = { ...layout };
      
      // Track changes for each furniture item
      const changes = [];
      
      // Update the room layout with optimized furniture positions
      const updatedElements = [...layout.elements];
      
      // Process each furniture placement
      for (const placement of optimizedResult.furniture_placements) {
        // Find the corresponding element in the layout
        const elementIndex = updatedElements.findIndex(
          element => element.type === 'furniture' && element.id === placement.id
        );
        
        if (elementIndex >= 0) {
          const currentElement = updatedElements[elementIndex];
          // Only proceed if we have a valid element
          if (currentElement) {
            // Store the change information
            changes.push({
              furniture_id: placement.id,
              old_position: currentElement.position ? { ...currentElement.position } : undefined,
              new_position: { ...placement.position },
              old_rotation: currentElement.rotation?.y,
              new_rotation: placement.rotation
            });
            
            // Update the element
            updatedElements[elementIndex] = {
              id: currentElement.id,
              type: currentElement.type,
              dimensions: currentElement.dimensions,
              position: placement.position,
              rotation: {
                x: 0,
                y: placement.rotation,
                z: 0
              },
              metadata: {
                ...(currentElement.metadata || {}),
                zone: placement.zone
              }
            };
          }
        }
      }
      
      // Update the layout with the new elements
      optimizedLayout.elements = updatedElements;
      
      // Update metadata with optimization metrics
      optimizedLayout.metadata = {
        ...optimizedLayout.metadata,
        optimized: true,
        flowScore: optimizedResult.metrics.flow_score,
        occupancyRate: optimizedResult.metrics.occupancy_rate,
        accessibilityScore: optimizedResult.metrics.accessibility_score
      };
      
      // Calculate improvement metrics
      const improvementMetrics: Record<string, number> = {};
      for (const [key, value] of Object.entries(optimizedResult.metrics)) {
        const originalValue = layout.metadata[this.camelCaseToSnakeCase(key)];
        if (originalValue !== undefined) {
          improvementMetrics[key] = (value as number) - (originalValue as number);
        }
      }

      return {
        original_layout: layout,
        optimized_layout: optimizedLayout,
        changes,
        improvement_metrics: improvementMetrics
      };
    } catch (error) {
      logger.error('Error optimizing existing layout:', { error });
      throw error;
    }
  }

  /**
   * Process an image of a room for layout analysis
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
        `${this.modelEndpoints.spaceFormer}/process-room-image`,
        {
          method: 'POST',
          body: formData
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to process room image: ${response.statusText}`);
      }

      const result = await response.json();

      return {
        success: true,
        data: result
      };
    } catch (error) {
      logger.error('Error processing room image:', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Process text description for layout generation
   */
  async processText(text: string, options: {
    style?: string;
    constraints?: any;
  }): Promise<ProcessingResult> {
    try {
      const response = await fetch(
        `${this.modelEndpoints.spaceFormer}/process-text-description`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, options })
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to process text description: ${response.statusText}`);
      }

      return {
        success: true,
        data: await response.json()
      };
    } catch (error) {
      logger.error('Error processing text description:', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Convert a room layout from the service response format to our RoomLayout type
   */
  private convertServiceResponseToRoomLayout(
    serviceLayout: any,
    roomType: string,
    roomDimensions: { width: number; length: number; height?: number }
  ): RoomLayout {
    // Create zones as walls
    const zones = serviceLayout.zones.map((zone: any) => {
      return {
        id: zone.id || uuidv4(),
        type: 'wall',
        position: {
          x: zone.position.x,
          y: 0,
          z: zone.position.z
        },
        dimensions: {
          width: zone.dimensions.width,
          height: roomDimensions.height || 2.7, // Default height
          depth: zone.dimensions.depth
        },
        rotation: {
          x: 0,
          y: 0,
          z: 0
        },
        metadata: {
          type: 'zone',
          purpose: zone.purpose
        }
      } as ArchitecturalElement;
    });

    // Create circulation paths as special elements
    const paths = serviceLayout.circulation_paths.map((path: any) => {
      return {
        id: path.id || uuidv4(),
        type: 'wall', // Using wall type but with special metadata
        position: {
          x: path.start.x,
          y: 0,
          z: path.start.z
        },
        dimensions: {
          width: 0.8, // Default width for a path
          height: 0.01, // Very thin
          depth: this.calculatePathLength(path.start, path.end)
        },
        rotation: {
          x: 0,
          y: this.calculatePathRotation(path.start, path.end),
          z: 0
        },
        metadata: {
          type: 'circulation_path',
          priority: path.priority
        }
      } as ArchitecturalElement;
    });

    return {
      id: uuidv4(),
      name: `${roomType} Layout`,
      dimensions: {
        width: roomDimensions.width,
        length: roomDimensions.length,
        height: roomDimensions.height || 2.7
      },
      elements: [...zones, ...paths],
      metadata: {
        style: serviceLayout.style,
        purpose: roomType,
        score: serviceLayout.score
      }
    };
  }

  /**
   * Convert our RoomLayout type to the format expected by the service
   */
  private convertRoomLayoutToServiceFormat(layout: RoomLayout): any {
    // Extract zones from elements
    const zones = layout.elements
      .filter(element => element.metadata?.type === 'zone')
      .map(element => ({
        id: element.id,
        position: {
          x: element.position.x,
          z: element.position.z
        },
        dimensions: {
          width: element.dimensions.width,
          depth: element.dimensions.depth
        },
        purpose: element.metadata?.purpose || 'generic'
      }));

    // Extract circulation paths
    const circulationPaths = layout.elements
      .filter(element => element.metadata?.type === 'circulation_path')
      .map(element => {
        // Calculate start and end points based on position, dimensions, and rotation
        const angle = element.rotation.y || 0;
        const length = element.dimensions.depth;
        
        // Start point is at the element's position
        const start = {
          x: element.position.x,
          z: element.position.z
        };
        
        // End point is calculated based on angle and length
        const end = {
          x: start.x + Math.sin(angle) * length,
          z: start.z + Math.cos(angle) * length
        };
        
        return {
          id: element.id,
          start,
          end,
          priority: element.metadata?.priority || 'medium'
        };
      });

    return {
      id: layout.id,
      style: layout.metadata.style,
      score: layout.metadata.score || 0.0,
      zones,
      circulation_paths: circulationPaths
    };
  }

  /**
   * Calculate length of a path between two points
   */
  private calculatePathLength(start: { x: number; z: number }, end: { x: number; z: number }): number {
    return Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.z - start.z, 2));
  }

  /**
   * Calculate rotation angle of a path
   */
  private calculatePathRotation(start: { x: number; z: number }, end: { x: number; z: number }): number {
    return Math.atan2(end.x - start.x, end.z - start.z);
  }

  /**
   * Convert camelCase to snake_case
   */
  private camelCaseToSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}