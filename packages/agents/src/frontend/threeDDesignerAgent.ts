import { Agent, Task } from 'crewai';
import { MaterialDetails, MaterialSearchResult } from '../services/materialService';
import { ThreeDService, RoomLayout } from '../services/3d-designer/threeDService';
import { MaterialService } from '../services/materialService';
import { VectorService } from '../services/vectorService';
import { ServiceConfig } from '../services/baseService';
import { FurniturePlacementService } from '../services/3d-designer/furniturePlacementService';

// Ensure this matches the expected ModelEndpoints interface in ThreeDService
interface ThreeDDesignerConfig {
  knowledgeBaseUrl: string;
  modelEndpoints: {
    nerfStudio: string;
    instantNgp: string;
    shapE: string;
    get3d: string;
    hunyuan3d: string;
    blenderProc: string;
    architecturalRecognition: string;
    roomLayoutGenerator: string;
    controlNet: string; // Required by ModelEndpoints type
    text2material: string; // Required by ModelEndpoints type
    clip: string; // Required by ModelEndpoints type
  };
  threeDFrontPath: string; // Path to 3D-FRONT dataset for furniture models
}

// Define the extended search response type to match what the API actually returns
interface ExtendedSearchResponse {
  materials: Array<{ id: string }>;
  [key: string]: any;
}

export class ThreeDDesignerAgent extends Agent {
  private anthropicApiKey: string;
  private threeDService: ThreeDService;
  private materialService: MaterialService;
  private vectorService: VectorService;
  private furniturePlacementService: FurniturePlacementService;

  constructor(config: ThreeDDesignerConfig) {
    super({
      name: '3D Designer Agent',
      description: 'Expert in 3D visualization, design, and intelligent furniture placement',
      backstory: `I am a specialized AI agent trained in 3D visualization and design. I can reconstruct 3D environments 
                 from images using advanced neural rendering techniques, generate them from text descriptions, and create 
                 physically accurate furniture arrangements. I have expertise in room layout analysis, object detection, 
                 depth estimation, material recognition, and physics-based furniture placement optimization.`,
      goal: 'Create accurate 3D reconstructions from images and text descriptions, optimize layouts, suggest materials, and ensure physical accuracy'
    });

    // Initialize API key
    this.anthropicApiKey = process.env.ANTHROPIC_API_KEY || '';

    // Initialize services
    this.threeDService = new ThreeDService(config.modelEndpoints);
    this.furniturePlacementService = new FurniturePlacementService({
      threeDFrontPath: config.threeDFrontPath
    });
    const serviceConfig: ServiceConfig = {
      baseURL: config.knowledgeBaseUrl,
      headers: {
        'Authorization': `Bearer ${process.env.KAI_API_KEY}`
      }
    };

    this.materialService = new MaterialService(serviceConfig);
    this.vectorService = new VectorService(serviceConfig);
  }

  async process2DDrawing(task: Task): Promise<any> {
    const taskData = JSON.parse(task.description);
    const { drawing } = taskData;
    
    try {
      // Process the 2D architectural drawing
      const roomLayout = await this.threeDService.processArchitecturalDrawing(drawing);

      // Search for appropriate materials based on the architectural elements
      const materials = await this.searchRelevantMaterials({
        elements: roomLayout.elements,
        style: roomLayout.metadata.style
      });

      // Generate response explaining the conversion
      const response = await this.generateArchitecturalResponse(roomLayout, materials);

      return {
        success: true,
        layout: roomLayout,
        materials,
        explanation: response
      };
    } catch (error) {
      console.error('Error processing image:', error);
      return {
        success: false,
        error: 'Failed to process image input'
      };
    }
  }

  async generateRoomFromText(task: Task): Promise<any> {
    const taskData = JSON.parse(task.description);
    const { rooms, style } = taskData;

    try {
      // Generate room layouts from specifications
      const roomLayouts = await this.threeDService.generateRoomLayout({ rooms, style });

      // For each room, handle furniture placement if specified
      const furnishedRooms = await Promise.all(roomLayouts.map(async (layout) => {
        const result = await this.furniturePlacementService.generateFurniturePlacement(
          `Generate furniture layout for ${layout.metadata.purpose || 'room'} with style ${style || 'modern'}`,
          {
            roomDimensions: layout.dimensions,
            style,
            specificConstraints: {
              alignToWalls: true,
              minSpacing: 0.6 // minimum 60cm between furniture
            }
          }
        );
        return { ...layout, furniture: result.layout };
      }));

      // Search for appropriate materials
      const materials = await this.searchRelevantMaterials({
        elements: furnishedRooms.flatMap(room => room.elements),
        style
      });

      // Generate response explaining the design
      const response = await this.generateRoomLayoutResponse(furnishedRooms, materials);

      return {
        success: true,
        rooms: furnishedRooms,
        materials,
        explanation: response
      };
    } catch (error) {
      console.error('Error processing text input:', error);
      return {
        success: false,
        error: 'Failed to process text description'
      };
    }
  }

  async refineResult(task: Task): Promise<any> {
    const taskData = JSON.parse(task.description);
    const { result, feedback, options } = taskData;

    try {
      // Refine the result based on feedback
      const refinedResult = await this.threeDService.refineResult(result, feedback, options);

      // Generate response explaining the refinements
      const response = await this.generateRefinementResponse(refinedResult, feedback);

      return {
        success: true,
        result: refinedResult,
        explanation: response
      };
    } catch (error) {
      console.error('Error refining result:', error);
      return {
        success: false,
        error: 'Failed to refine result'
      };
    }
  }

  private async searchRelevantMaterials(result: any): Promise<MaterialDetails[]> {
    try {
      // Extract material requirements from result
      const requirements = this.extractMaterialRequirements(result);

      // Search vector database for similar materials
      const searchResult = await this.vectorService.searchMaterials({
        query: requirements.query,
        filters: requirements.filters
      });
      
      // Handle case where search result doesn't have expected structure
      if (!searchResult || !searchResult.results || !Array.isArray(searchResult.results)) {
        console.warn('Search result missing results array:', searchResult);
        return [];
      }

      // Results are already MaterialDetails[], no need to fetch details again
      return searchResult.results;
    } catch (error) {
      console.error('Error searching materials:', error);
      return [];
    }
  }

  private extractMaterialRequirements(result: any): { query: string; filters: Record<string, any> } {
    // Extract material requirements from analysis result
    const materialTypes = result.detectedObjects?.filter((obj: any) => 
      obj.type === 'material' || obj.type === 'surface'
    ) || [];

    const query = materialTypes
      .map((obj: any) => obj.description || obj.name)
      .join(' OR ');

    return {
      query: query || 'generic material',
      filters: {
        type: materialTypes.map((obj: any) => obj.type),
        confidence: { min: 0.7 }
      }
    };
  }

  private async generateArchitecturalResponse(layout: RoomLayout, materials: MaterialDetails[]): Promise<string> {
    // Generate response explaining the architectural conversion
    const response = await this.invokeLLM(
      `Explain the conversion of 2D architectural drawing to 3D model:
       Layout: ${JSON.stringify(layout, null, 2)}
       Materials: ${JSON.stringify(materials, null, 2)}
       
       Include:
       1. Recognized architectural elements (walls, windows, doors)
       2. Room dimensions and layout structure
       3. Suggested materials for each element
       4. Compliance with architectural standards
       5. Any potential improvements or considerations`,
      {
        system: `You are a 3D architectural design expert specialized in explaining 
                architectural conversions and standards. Focus on clarity and technical accuracy.`
      }
    );

    return response;
  }

  private async generateRoomLayoutResponse(rooms: RoomLayout[], materials: MaterialDetails[]): Promise<string> {
    // Generate response explaining the room layouts and furniture placement
    const response = await this.invokeLLM(
      `Explain the generated room layouts and furniture placement:
       Rooms: ${JSON.stringify(rooms, null, 2)}
       Materials: ${JSON.stringify(materials, null, 2)}
       
       Include in your explanation:
       1. Overall layout of each room and their relationships
       2. Architectural elements and their placement
       3. Furniture arrangements and flow
       4. Material selections and their applications
       5. Compliance with architectural standards
       6. Potential improvements or variations`,
      {
        system: `You are a 3D design expert specialized in analyzing and explaining 3D scenes, 
                spatial relationships, and material choices. Focus on technical accuracy and 
                practical design considerations.`,
        messages: [
          {
            role: "assistant",
            content: [
              {
                type: "text",
                text: "I'll analyze the 3D scene and materials with a focus on spatial relationships and technical accuracy."
              },
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: "image/png",
                  data: rooms[0]?.preview || rooms[0]?.thumbnail || ''
                }
              }
            ]
          }
        ]
      }
    );

    return response;
  }

  private async extractAndFetchMaterials(description: string): Promise<MaterialDetails[]> {
    try {
      // Extract material names or references from the description
      const materialReferences = this.extractMaterialReferences(description);
      
      // Search for each material in the knowledge base
      const materials = await Promise.all(
        materialReferences.map(async (ref) => {
          try {
            const searchResult = await this.vectorService.searchMaterials({
              query: ref,
              filters: { exact_match: true }
            });
            
            // Handle case where search result doesn't have expected structure
            if (!searchResult || !searchResult.results || !Array.isArray(searchResult.results) || searchResult.results.length === 0) {
              console.warn(`No matching materials found for reference: ${ref}`);
              return null;
            }

            const materialId = searchResult.results[0]?.id;
            if (!materialId) {
              console.warn('Material found but missing ID:', searchResult.results[0]);
              return null;
            }

            return await this.materialService.getMaterial(materialId);
          } catch (searchError) {
            console.error(`Error searching for material reference "${ref}":`, searchError);
            return null;
          }
        })
      );

      // Filter out any null values from failed material fetches
      return materials.filter((m): m is MaterialDetails => m !== null);
    } catch (error) {
      console.error('Error extracting materials:', error);
      return [];
    }
  }

  private extractMaterialReferences(description: string): string[] {
    // Handle edge cases for empty or invalid input
    if (!description || typeof description !== 'string') {
      console.warn('Invalid description provided to extractMaterialReferences:', description);
      return [];
    }

    // Use regex or NLP to find material references
    const materialPatterns = [
      /tile\s+([A-Za-z0-9\s]+)/i,
      /floor(?:ing)?\s+([A-Za-z0-9\s]+)/i,
      /material\s+([A-Za-z0-9\s]+)/i,
      /surface\s+([A-Za-z0-9\s]+)/i,
      /wall\s+([A-Za-z0-9\s]+)/i
    ];

    const references = new Set<string>();
    for (const pattern of materialPatterns) {
      const matches = description.match(pattern);
      if (matches && matches[1]) {
        references.add(matches[1].trim());
      }
    }

    return Array.from(references);
  }

  private async enhanceWithMaterialDetails(
    result: any,
    materials: MaterialDetails[]
  ): Promise<any> {
    return {
      ...result,
      materials: materials.map(material => ({
        id: material.id,
        name: material.name,
        type: material.type,
        properties: material.properties,
        preview: material.preview,
        textures: material.textures,
        applicationAreas: material.applicationAreas
      })),
      layout: {
        ...result.layout,
        surfaceMaterials: this.mapMaterialsToSurfaces(result.layout, materials)
      }
    };
  }

  private mapMaterialsToSurfaces(layout: any, materials: MaterialDetails[]): Record<string, MaterialDetails> {
    // Map materials to appropriate surfaces in the layout
    const surfaceMappings: Record<string, MaterialDetails> = {};
    
    // Handle edge case of empty materials array
    if (!Array.isArray(materials) || materials.length === 0) {
      console.warn('No materials provided for mapping to surfaces');
      return surfaceMappings;
    }
    
    for (const material of materials) {
      // Validate material and its properties before accessing them
      if (!material) continue;
      
      const applicationAreas = material.applicationAreas || [];
      
      if (Array.isArray(applicationAreas)) {
        if (applicationAreas.includes('floor')) {
          surfaceMappings.floor = material;
        }
        if (applicationAreas.includes('wall')) {
          surfaceMappings.walls = material;
        }
        if (applicationAreas.includes('ceiling')) {
          surfaceMappings.ceiling = material;
        }
        if (applicationAreas.includes('countertop')) {
          surfaceMappings.countertop = material;
        }
      }
    }

    return surfaceMappings;
  }

  private async generateFurniturePlacementResponse(result: any): Promise<string> {
    const response = await this.invokeLLM(
      this.createFurniturePlacementPrompt(result, result.materials),
      {
        system: `You are a 3D interior design expert specialized in explaining furniture placement decisions. 
                Focus on the rationale behind each placement, considering physical constraints, 
                functionality, and aesthetic harmony.`,
        messages: [
          {
            role: "assistant",
            content: [
              {
                type: "text",
                text: "I'll explain the furniture placement with visual context."
              },
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: "image/png",
                  data: result.layout.preview || result.layout.thumbnail
                }
              }
            ]
          }
        ]
      }
    );

    return response;
  }

  private createFurniturePlacementPrompt(result: any, materials: MaterialDetails[]): string {
    const materialDescriptions = materials.map(m => 
      `${m.name}: ${m.properties.description || 'No description available'}`
    ).join('\n');

    return `Explain the furniture placement layout and material usage:
            Layout: ${JSON.stringify(result.layout, null, 2)}
            Physics Validation: ${result.physicsValidation}
            
            Materials Used:
            ${materialDescriptions}
            
            Include in your explanation:
            1. Overall room layout and furniture positioning
            2. How the placement optimizes space usage and functionality
            3. Physical constraints and clearances maintained
            4. How the selected materials enhance the space
            5. Style considerations and aesthetic harmony
            6. Any potential alternative arrangements to consider`;
  }

  private async generateDesignResponse(result: any, materials: any[]): Promise<string> {
    // Generate natural language response explaining the design choices
    const response = await this.invokeLLM(
      this.createDesignPrompt(result, materials),
      {
        system: `You are a 3D design expert specialized in explaining design decisions, 
                material selections, and spatial arrangements. Focus on the rationale behind 
                each choice and how it contributes to the overall design.`,
        messages: [
          {
            role: "assistant",
            content: [
              {
                type: "text",
                text: "I'll explain the design choices and material selections with visual context."
              },
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: "image/png",
                  data: result.preview || result.thumbnail
                }
              },
              ...materials.map(m => ({
                type: "image",
                source: {
                  type: "base64",
                  media_type: "image/png",
                  data: m.preview
                }
              }))
            ]
          }
        ]
      }
    );

    return response;
  }

  private async generateRefinementResponse(result: any, feedback: string): Promise<string> {
    // Generate natural language response explaining the refinements
    const response = await this.invokeLLM(
      this.createRefinementPrompt(result, feedback),
      {
        system: `You are a 3D design expert specialized in refining and improving 3D scenes. 
                Focus on explaining how the refinements enhance the design while maintaining 
                technical accuracy and practical feasibility.`
      }
    );

    return response;
  }

  private createAnalysisPrompt(result: any, materials: any[]): string {
    return `Analyze the following 3D reconstruction result and suggested materials:
            Result: ${JSON.stringify(result, null, 2)}
            Materials: ${JSON.stringify(materials, null, 2)}
            
            Explain the reconstruction, including:
            1. Room layout and dimensions
            2. Detected objects and their placement
            3. Suggested materials and why they were chosen
            4. Any potential improvements or considerations`;
  }

  private createDesignPrompt(result: any, materials: any[]): string {
    return `Explain the generated 3D design and material choices:
            Design: ${JSON.stringify(result, null, 2)}
            Materials: ${JSON.stringify(materials, null, 2)}
            
            Include in your explanation:
            1. Overall layout and design choices
            2. How the design meets the specified requirements
            3. Material selections and their benefits
            4. Potential variations or improvements`;
  }

  private async invokeLLM(prompt: string, options?: {
    system?: string;
    messages?: Array<{
      role: string;
      content: Array<{
        type: string;
        text?: string;
        source?: {
          type: string;
          media_type: string;
          data: string;
        };
      }>;
    }>;
  }): Promise<string> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.anthropicApiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-opus-20240229',
        max_tokens: 4096,
        temperature: 0.7,
        messages: [
          ...(options?.messages || []),
          {
            role: 'user',
            content: prompt
          }
        ],
        system: options?.system
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to invoke LLM: ${response.statusText}`);
    }

    const result = await response.json();
    return result.content[0].text;
  }

  private createRefinementPrompt(result: any, feedback: string): string {
    return `Explain the refinements made based on feedback:
            Original Feedback: ${feedback}
            Refined Result: ${JSON.stringify(result, null, 2)}
            
            Include in your explanation:
            1. Changes made in response to feedback
            2. How the refinements improve the design
            3. Any additional suggestions for improvement`;
  }
}