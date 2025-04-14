import { BaseThreeDProvider } from './baseProvider';
import { 
  ModelEndpoints, 
  ProcessingResult, 
  SceneGraph, 
  SceneGraphNode, 
  SceneGraphEdge,
  SceneGraphOptions,
  Scene3D
} from './types';
import { logger } from '../../utils/logger';
import axios from 'axios';

/**
 * Provider for scene graph generation and relational understanding.
 * This provider leverages 3DSSG to create relationship-aware scene 
 * representations that enhance editing and interaction capabilities.
 */
export class SceneGraphProvider extends BaseThreeDProvider {
  private graphCache: Map<string, SceneGraph> = new Map();
  
  constructor(modelEndpoints: ModelEndpoints) {
    super(modelEndpoints);
    logger.info('SceneGraphProvider initialized');
  }
  
  /**
   * Generate a scene graph from a 3D model file.
   * 
   * @param modelBuffer - The 3D model buffer
   * @param format - The format of the model (gltf, obj, etc.)
   * @param options - Options for scene graph generation
   * @returns A Promise resolving to the generated scene graph
   */
  public async generateSceneGraphFromModel(
    modelBuffer: Buffer, 
    format: string = 'gltf',
    options: SceneGraphOptions = {}
  ): Promise<SceneGraph> {
    logger.info('Generating scene graph from model');
    
    try {
      // Create a cache key from the buffer and options
      const cacheKey = this.createCacheKey(modelBuffer, options);
      
      // Check if we have a cached result
      if (options.useCache !== false && this.graphCache.has(cacheKey)) {
        logger.info('Returning cached scene graph');
        return this.graphCache.get(cacheKey)!;
      }
      
      // Prepare the form data for the request
      const formData = new FormData();
      const blob = new Blob([modelBuffer], { type: 'application/octet-stream' });
      formData.append('model', blob, `model.${format}`);
      formData.append('format', format);
      
      if (options.minConfidence) {
        formData.append('min_confidence', options.minConfidence.toString());
      }
      
      if (options.maxRelationships) {
        formData.append('max_relationships', options.maxRelationships.toString());
      }
      
      // Make the API request
      const response = await axios.post(
        `${this.modelEndpoints.sceneGraph}/generate-from-model`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          },
          timeout: options.timeout || 60000
        }
      );
      
      // Process the response
      const sceneGraph = this.processSceneGraphResponse(response.data);
      
      // Cache the result if caching is enabled
      if (options.useCache !== false) {
        this.graphCache.set(cacheKey, sceneGraph);
      }
      
      return sceneGraph;
    } catch (error) {
      logger.error('Failed to generate scene graph from model', { error });
      throw new Error(`Failed to generate scene graph: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Generate a scene graph from a point cloud.
   * 
   * @param pointCloudBuffer - The point cloud buffer
   * @param options - Options for scene graph generation
   * @returns A Promise resolving to the generated scene graph
   */
  public async generateSceneGraphFromPointCloud(
    pointCloudBuffer: Buffer,
    options: SceneGraphOptions = {}
  ): Promise<SceneGraph> {
    logger.info('Generating scene graph from point cloud');
    
    try {
      // Create a cache key from the buffer and options
      const cacheKey = this.createCacheKey(pointCloudBuffer, options);
      
      // Check if we have a cached result
      if (options.useCache !== false && this.graphCache.has(cacheKey)) {
        logger.info('Returning cached scene graph');
        return this.graphCache.get(cacheKey)!;
      }
      
      // Prepare the form data for the request
      const formData = new FormData();
      const blob = new Blob([pointCloudBuffer], { type: 'application/octet-stream' });
      formData.append('point_cloud', blob, 'point_cloud.ply');
      
      if (options.minConfidence) {
        formData.append('min_confidence', options.minConfidence.toString());
      }
      
      if (options.maxRelationships) {
        formData.append('max_relationships', options.maxRelationships.toString());
      }
      
      // Make the API request
      const response = await axios.post(
        `${this.modelEndpoints.sceneGraph}/generate-from-point-cloud`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          },
          timeout: options.timeout || 60000
        }
      );
      
      // Process the response
      const sceneGraph = this.processSceneGraphResponse(response.data);
      
      // Cache the result if caching is enabled
      if (options.useCache !== false) {
        this.graphCache.set(cacheKey, sceneGraph);
      }
      
      return sceneGraph;
    } catch (error) {
      logger.error('Failed to generate scene graph from point cloud', { error });
      throw new Error(`Failed to generate scene graph from point cloud: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Generate a scene graph from multiple images.
   * 
   * @param imageBuffers - Array of image buffers
   * @param cameraParams - Optional camera parameters for each image
   * @param options - Options for scene graph generation
   * @returns A Promise resolving to the generated scene graph
   */
  public async generateSceneGraphFromImages(
    imageBuffers: Buffer[],
    cameraParams?: Array<{
      position: [number, number, number];
      rotation: [number, number, number, number];
      intrinsics: {
        focalLength: number;
        principalPoint: [number, number];
        imageSize: [number, number];
      };
    }>,
    options: SceneGraphOptions = {}
  ): Promise<SceneGraph> {
    logger.info(`Generating scene graph from ${imageBuffers.length} images`);
    
    try {
      // Create a cache key from the buffers and options
      const cacheKey = this.createCacheKey(Buffer.concat(imageBuffers), options);
      
      // Check if we have a cached result
      if (options.useCache !== false && this.graphCache.has(cacheKey)) {
        logger.info('Returning cached scene graph');
        return this.graphCache.get(cacheKey)!;
      }
      
      // Prepare the form data for the request
      const formData = new FormData();
      
      // Add each image to the form data
      imageBuffers.forEach((buffer, index) => {
        const blob = new Blob([buffer], { type: 'image/jpeg' });
        formData.append(`image_${index}`, blob, `image_${index}.jpg`);
      });
      
      // Add camera parameters if provided
      if (cameraParams) {
        formData.append('camera_params', JSON.stringify(cameraParams));
      }
      
      if (options.minConfidence) {
        formData.append('min_confidence', options.minConfidence.toString());
      }
      
      if (options.maxRelationships) {
        formData.append('max_relationships', options.maxRelationships.toString());
      }
      
      // Make the API request
      const response = await axios.post(
        `${this.modelEndpoints.sceneGraph}/generate-from-images`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          },
          timeout: options.timeout || 120000  // Longer timeout for multiple images
        }
      );
      
      // Process the response
      const sceneGraph = this.processSceneGraphResponse(response.data);
      
      // Cache the result if caching is enabled
      if (options.useCache !== false) {
        this.graphCache.set(cacheKey, sceneGraph);
      }
      
      return sceneGraph;
    } catch (error) {
      logger.error('Failed to generate scene graph from images', { error });
      throw new Error(`Failed to generate scene graph from images: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Query a scene graph for specific relationships or objects.
   * 
   * @param sceneGraph - The scene graph to query
   * @param query - A natural language or structured query
   * @returns A Promise resolving to the query results
   */
  public async querySceneGraph(
    sceneGraph: SceneGraph,
    query: string
  ): Promise<any[]> {
    logger.info(`Querying scene graph with: ${query}`);
    
    try {
      // Make the API request
      const response = await axios.post(
        `${this.modelEndpoints.sceneGraph}/query`,
        {
          scene_graph: sceneGraph,
          query: query
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      return response.data.results || [];
    } catch (error) {
      logger.error('Failed to query scene graph', { error });
      throw new Error(`Failed to query scene graph: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Generate editing suggestions based on the scene graph.
   * 
   * @param sceneGraph - The scene graph to analyze
   * @returns A Promise resolving to editing suggestions
   */
  public async generateEditingSuggestions(
    sceneGraph: SceneGraph
  ): Promise<any[]> {
    logger.info('Generating editing suggestions');
    
    try {
      // Make the API request
      const response = await axios.post(
        `${this.modelEndpoints.sceneGraph}/generate-suggestions`,
        {
          scene_graph: sceneGraph
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      return response.data.suggestions || [];
    } catch (error) {
      logger.error('Failed to generate editing suggestions', { error });
      throw new Error(`Failed to generate editing suggestions: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Enhance a 3D scene with relationship data from a scene graph.
   * 
   * @param scene - The 3D scene to enhance
   * @param sceneGraph - The scene graph containing relationship data
   * @returns A Promise resolving to the enhanced scene
   */
  public async enhanceSceneWithRelationships(
    scene: Scene3D,
    sceneGraph: SceneGraph
  ): Promise<Scene3D> {
    logger.info('Enhancing scene with relationship data');
    
    try {
      // Apply scene graph relationships to the scene
      // This would integrate relationship data with the scene's object hierarchy
      
      // Map scene graph nodes to scene objects
      const nodeToObjectMap = new Map<string, Scene3D['elements'][0]>();
      
      // For each node in the scene graph, find the corresponding object in the scene
      sceneGraph.nodes.forEach((node: SceneGraphNode) => {
        // Find matching object by name, position, or other attributes
        const matchingObject = scene.elements.find((element) => 
          element.type === node.type || 
          this.arePositionsSimilar(
            [element.position.x, element.position.y, element.position.z], 
            node.position
          )
        );
        
        if (matchingObject) {
          nodeToObjectMap.set(node.id, matchingObject);
          
          // Enhance the object with relationship metadata
          matchingObject.metadata = {
            ...matchingObject.metadata,
            nodeId: node.id,
            nodeType: node.type,
            confidence: node.confidence,
            attributes: node.attributes
          };
        }
      });
      
      // Add relationship data to the scene
      sceneGraph.edges.forEach((edge: SceneGraphEdge) => {
        const sourceObject = nodeToObjectMap.get(edge.source);
        const targetObject = nodeToObjectMap.get(edge.target);
        
        if (sourceObject && targetObject) {
          // Add relationship metadata to the source object
          if (!sourceObject.relationships) {
            sourceObject.relationships = [];
          }
          
          sourceObject.relationships.push({
            type: edge.type,
            target: targetObject.id,
            targetName: targetObject.name,
            confidence: edge.confidence,
            attributes: edge.attributes
          });
          
          // Add inverse relationship metadata to the target object
          if (!targetObject.relationships) {
            targetObject.relationships = [];
          }
          
          targetObject.relationships.push({
            type: this.getInverseRelationType(edge.type),
            target: sourceObject.id,
            targetName: sourceObject.name,
            confidence: edge.confidence,
            attributes: edge.attributes
          });
        }
      });
      
      // Add scene graph metadata to the scene
      scene.metadata = {
        ...scene.metadata,
        hasSceneGraph: true,
        sceneGraphGenerated: new Date().toISOString(),
        nodeCount: sceneGraph.nodes.length,
        edgeCount: sceneGraph.edges.length
      };
      
      return scene;
    } catch (error) {
      logger.error('Failed to enhance scene with relationships', { error });
      throw new Error(`Failed to enhance scene with relationships: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Process an image using the scene graph provider.
   * Implementation of abstract method from BaseThreeDProvider.
   * 
   * @param imageBuffer - The image buffer to process
   * @param options - Processing options
   * @returns A Promise resolving to the processing result
   */
  public async processImage(
    imageBuffer: Buffer,
    options: { [key: string]: any } = {}
  ): Promise<ProcessingResult> {
    logger.info('Processing image with SceneGraphProvider');
    
    try {
      // Generate a scene graph from the image
      const sceneGraph = await this.generateSceneGraphFromImages([imageBuffer], undefined, {
        minConfidence: options.minConfidence,
        maxRelationships: options.maxRelationships,
        useCache: options.useCache
      });
      
      return {
        success: true,
        data: {
          sceneGraph
        }
      };
    } catch (error) {
      logger.error('Failed to process image', { error });
      return {
        success: false,
        error: `Failed to process image: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
  
  /**
   * Process text using the scene graph provider.
   * Implementation of abstract method from BaseThreeDProvider.
   * 
   * @param text - The text to process
   * @param options - Processing options
   * @returns A Promise resolving to the processing result
   */
  public async processText(
    text: string,
    options: { style?: string; constraints?: any } = {}
  ): Promise<ProcessingResult> {
    logger.info('Processing text with SceneGraphProvider');
    
    try {
      // For text processing, we'll parse the text as a query or scene description
      
      if (text.toLowerCase().startsWith('query:')) {
        // This is a query for an existing scene graph
        // In a real implementation, we'd need to have a scene graph to query
        return {
          success: false,
          error: 'Text queries require an existing scene graph. Please use querySceneGraph method instead.'
        };
      } else {
        // Interpret the text as a scene description and try to generate a minimal scene graph
        // Make the API request to generate a scene graph from text description
        const response = await axios.post(
          `${this.modelEndpoints.sceneGraph}/generate-from-text`,
          {
            text,
            style: options.style,
            constraints: options.constraints
          },
          {
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );
        
        // Process the response
        const sceneGraph = this.processSceneGraphResponse(response.data);
        
        return {
          success: true,
          data: {
            sceneGraph
          }
        };
      }
    } catch (error) {
      logger.error('Failed to process text', { error });
      return {
        success: false,
        error: `Failed to process text: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
  
  /**
   * Create a cache key from a buffer and options.
   * 
   * @param buffer - The buffer to create a key for
   * @param options - The options to include in the key
   * @returns A string cache key
   */
  private createCacheKey(buffer: Buffer, options: any): string {
    // Create a hash of the buffer
    const crypto = require('crypto');
    const hash = crypto.createHash('md5').update(buffer).digest('hex');
    
    // Create a hash of the options
    const optionsHash = crypto.createHash('md5')
      .update(JSON.stringify(options))
      .digest('hex');
    
    return `${hash}_${optionsHash}`;
  }
  
  /**
   * Process the scene graph response from the API.
   * 
   * @param responseData - The raw response data
   * @returns A processed SceneGraph object
   */
  private processSceneGraphResponse(responseData: any): SceneGraph {
    // If the response already has the expected structure, return it directly
    if (
      responseData && 
      Array.isArray(responseData.nodes) && 
      Array.isArray(responseData.edges)
    ) {
      return responseData as SceneGraph;
    }
    
    // Otherwise, create a scene graph from the response data
    const sceneGraph: SceneGraph = {
      nodes: [],
      edges: [],
      metadata: {
        timestamp: new Date().toISOString(),
        source: 'SceneGraphProvider'
      }
    };
    
    // Process nodes if they exist
    if (responseData.nodes) {
      sceneGraph.nodes = responseData.nodes.map((node: any) => ({
        id: node.id,
        type: node.type || 'unknown',
        label: node.label || 'Unknown',
        position: node.position || [0, 0, 0],
        size: node.size || [1, 1, 1],
        confidence: node.confidence || 1.0,
        attributes: node.attributes || {}
      }));
    }
    
    // Process edges if they exist
    if (responseData.edges) {
      sceneGraph.edges = responseData.edges.map((edge: any) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: edge.type || 'unknown',
        label: edge.label || 'Unknown',
        confidence: edge.confidence || 1.0,
        attributes: edge.attributes || {}
      }));
    }
    
    // Add any additional metadata
    if (responseData.metadata) {
      sceneGraph.metadata = {
        ...sceneGraph.metadata,
        ...responseData.metadata
      };
    }
    
    return sceneGraph;
  }
  
  /**
   * Check if two 3D positions are similar within a threshold.
   * 
   * @param pos1 - The first position
   * @param pos2 - The second position
   * @param threshold - The similarity threshold (default: 0.1)
   * @returns True if the positions are similar, false otherwise
   */
  private arePositionsSimilar(
    pos1: [number, number, number],
    pos2: [number, number, number],
    threshold: number = 0.1
  ): boolean {
    const distance = Math.sqrt(
      Math.pow(pos1[0] - pos2[0], 2) +
      Math.pow(pos1[1] - pos2[1], 2) +
      Math.pow(pos1[2] - pos2[2], 2)
    );
    
    return distance <= threshold;
  }
  
  /**
   * Get the inverse of a relationship type.
   * 
   * @param relationType - The relationship type
   * @returns The inverse relationship type
   */
  private getInverseRelationType(relationType: string): string {
    const inverseMap: Record<string, string> = {
      'on': 'supports',
      'supports': 'on',
      'in': 'contains',
      'contains': 'in',
      'next_to': 'next_to',
      'attached_to': 'attached_to',
      'part_of': 'has_part',
      'has_part': 'part_of',
      'left_of': 'right_of',
      'right_of': 'left_of',
      'above': 'below',
      'below': 'above',
      'in_front_of': 'behind',
      'behind': 'in_front_of'
    };
    
    return inverseMap[relationType] || `inverse_of_${relationType}`;
  }
}