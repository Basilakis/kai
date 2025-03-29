/**
 * Dataset Vector Service
 * 
 * Extends dataset management capabilities with vector embedding features,
 * enabling similarity-based operations on dataset images and entries.
 * Integrates with Supabase Vector for efficient embedding storage and retrieval.
 */

import { logger } from '../../utils/logger';
import { vectorSearch } from '../supabase/vector-search';
import { supabaseDatasetService, DatasetImage } from './index';
import { supabaseClient } from '../supabase/supabaseClient';
import { SupabaseClient } from '@supabase/supabase-js';

// Define interfaces for vector operations
interface DatasetImageEmbedding {
  id: string;
  datasetId: string;
  imageId: string;
  className: string;
  embedding: number[];
  metadata?: Record<string, any>;
}

interface VectorSimilarityResult {
  imageId: string;
  className: string;
  similarity: number;
  metadata?: Record<string, any>;
}

interface DuplicateDetectionOptions {
  threshold: number;
  checkAcrossClasses: boolean;
  checkAcrossDatasets: boolean;
  limit?: number;
}

interface SimilarImagesOptions {
  threshold: number;
  className?: string;
  limit?: number;
  includeMetadata?: boolean;
}

// Interface for vector search filters
interface VectorSearchFilters extends Record<string, any> {
  dataset_id?: string;
  class_name?: string;
  image_id?: any; // Can be string or object with operators
}

// Interface for Supabase embedding result
interface EmbeddingResult {
  id: string;
  image_id: string;
  class_name: string;
  embedding: number[];
  metadata?: Record<string, any>;
  similarity?: number;
}

/**
 * Dataset Vector Service
 * Provides vector-based operations for dataset management
 */
export class DatasetVectorService {
  private static instance: DatasetVectorService;
  private embeddingTableName = 'dataset_image_embeddings';
  private vectorColumnName = 'embedding';

  private constructor() {
    logger.info('Dataset Vector Service initialized');
    
    // Ensure vector index exists
    this.ensureVectorIndex().catch(error => {
      logger.error(`Failed to ensure vector index: ${error}`);
    });
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): DatasetVectorService {
    if (!DatasetVectorService.instance) {
      DatasetVectorService.instance = new DatasetVectorService();
    }
    return DatasetVectorService.instance;
  }

  /**
   * Ensure the vector index exists for dataset embeddings
   */
  private async ensureVectorIndex(): Promise<void> {
    try {
      // Check if the embeddings table exists
      const client = supabaseClient.getClient();
      
      // Cast client to any to allow chained methods
      const { data, error } = await (client as any)
        .from('information_schema.tables')
        .select('*')
        .eq('table_name', this.embeddingTableName);
      
      if (error) {
        throw error;
      }
      
      // If table doesn't exist, create it
      if (!data || data.length === 0) {
        logger.info(`Creating ${this.embeddingTableName} table`);
        
        // PostgreSQL table creation
        await client.rpc('execute_sql', {
          sql: `
            CREATE TABLE IF NOT EXISTS ${this.embeddingTableName} (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              dataset_id UUID NOT NULL,
              image_id TEXT NOT NULL,
              class_name TEXT,
              ${this.vectorColumnName} vector(384),
              metadata JSONB,
              created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            
            CREATE INDEX IF NOT EXISTS idx_${this.embeddingTableName}_dataset_id 
              ON ${this.embeddingTableName}(dataset_id);
            
            CREATE INDEX IF NOT EXISTS idx_${this.embeddingTableName}_image_id 
              ON ${this.embeddingTableName}(image_id);
          `
        });
      }
      
      // Create vector index if it doesn't exist
      await vectorSearch.createIndex(
        this.embeddingTableName,
        this.vectorColumnName,
        'hnsw',
        384 // Using standard embedding dimension
      );
      
      logger.info('Vector index for dataset embeddings is ready');
    } catch (error) {
      logger.error(`Failed to create vector index: ${error}`);
      throw error;
    }
  }

  /**
   * Store embedding for a dataset image
   * 
   * @param datasetId Dataset ID
   * @param imageId Image ID
   * @param className Class name
   * @param embedding Vector embedding
   * @param metadata Additional metadata
   * @returns ID of the stored embedding
   */
  public async storeImageEmbedding(
    datasetId: string,
    imageId: string,
    className: string,
    embedding: number[],
    metadata?: Record<string, any>
  ): Promise<string> {
    try {
      logger.info(`Storing embedding for image ${imageId} in dataset ${datasetId}`);
      
      // Check embedding dimension
      if (embedding.length !== 384) {
        logger.warn(`Embedding dimension (${embedding.length}) is not the expected size (384)`);
      }
      
      // Store embedding using vector search service
      const id = await vectorSearch.storeEmbedding(
        embedding,
        {
          dataset_id: datasetId,
          image_id: imageId,
          class_name: className,
          metadata: metadata || {}
        },
        this.embeddingTableName,
        this.vectorColumnName
      );
      
      logger.debug(`Stored embedding with ID: ${id}`);
      return id;
    } catch (error) {
      logger.error(`Failed to store image embedding: ${error}`);
      throw new Error(`Failed to store image embedding: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Find similar images within a dataset
   * 
   * @param datasetId Dataset ID
   * @param embedding Query embedding
   * @param options Search options
   * @returns Array of similar images with similarity scores
   */
  public async findSimilarImages(
    datasetId: string,
    embedding: number[],
    options: SimilarImagesOptions = { threshold: 0.7, limit: 10 }
  ): Promise<VectorSimilarityResult[]> {
    try {
      logger.info(`Finding similar images in dataset ${datasetId}`);
      
      // Setup search configuration
      const searchConfig: {
        limit: number;
        threshold: number;
        includeMetadata: boolean;
        filters: VectorSearchFilters;
      } = {
        limit: options.limit || 10,
        threshold: options.threshold || 0.7,
        includeMetadata: options.includeMetadata !== false,
        filters: {
          dataset_id: datasetId
        }
      };
      
      // Add class filter if specified
      if (options.className) {
        searchConfig.filters.class_name = options.className;
      }
      
      // Perform vector search
      const results = await vectorSearch.findSimilar(
        embedding,
        this.embeddingTableName,
        this.vectorColumnName,
        searchConfig
      );
      
      // Format results
      const formattedResults: VectorSimilarityResult[] = results.map((result: EmbeddingResult) => ({
        imageId: result.image_id,
        className: result.class_name,
        similarity: result.similarity || 0,
        metadata: options.includeMetadata ? result.metadata : undefined
      }));
      
      logger.debug(`Found ${formattedResults.length} similar images`);
      return formattedResults;
    } catch (error) {
      logger.error(`Failed to find similar images: ${error}`);
      throw new Error(`Failed to find similar images: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Detect duplicates in a dataset
   * 
   * @param datasetId Dataset ID
   * @param options Duplicate detection options
   * @returns Map of images to their duplicates
   */
  public async detectDuplicates(
    datasetId: string,
    options: DuplicateDetectionOptions = { 
      threshold: 0.95, 
      checkAcrossClasses: false,
      checkAcrossDatasets: false,
      limit: 1000
    }
  ): Promise<Map<string, VectorSimilarityResult[]>> {
    try {
      logger.info(`Detecting duplicates in dataset ${datasetId}`);
      
      // Get all embeddings for the dataset
      const client = supabaseClient.getClient();
      
      // Cast client to any to allow chained methods
      const { data: embeddings, error } = await (client as any)
        .from(this.embeddingTableName)
        .select('id, image_id, class_name, embedding')
        .eq('dataset_id', datasetId)
        .limit(options.limit || 1000);
      
      if (error) {
        throw error;
      }
      
      if (!embeddings || embeddings.length === 0) {
        logger.info(`No embeddings found for dataset ${datasetId}`);
        return new Map();
      }
      
      logger.debug(`Processing ${embeddings.length} embeddings for duplicate detection`);
      
      // Map to store results
      const duplicatesMap = new Map<string, VectorSimilarityResult[]>();
      
      // Process each embedding to find duplicates
      for (const embedding of embeddings) {
        // Skip if already processed as a duplicate
        if (duplicatesMap.has(embedding.image_id)) {
          continue;
        }
        
        // Setup search filters
        const filters: VectorSearchFilters = {
          // Exclude the same image
          image_id: { $ne: embedding.image_id }
        };
        
        // Filter by dataset if not checking across datasets
        if (!options.checkAcrossDatasets) {
          filters.dataset_id = datasetId;
        }
        
        // Filter by class if not checking across classes
        if (!options.checkAcrossClasses && embedding.class_name) {
          filters.class_name = embedding.class_name;
        }
        
        // Find similar images
        const similarResults = await vectorSearch.findSimilar(
          embedding.embedding,
          this.embeddingTableName,
          this.vectorColumnName,
          {
            threshold: options.threshold,
            limit: 10, // We only need a few duplicates per image
            filters
          }
        );
        
        // If duplicates found, add to map
        if (similarResults.length > 0) {
          duplicatesMap.set(
            embedding.image_id,
            similarResults.map((result: EmbeddingResult) => ({
              imageId: result.image_id,
              className: result.class_name,
              similarity: result.similarity || 0
            }))
          );
        }
      }
      
      logger.info(`Found duplicates for ${duplicatesMap.size} images`);
      return duplicatesMap;
    } catch (error) {
      logger.error(`Failed to detect duplicates: ${error}`);
      throw new Error(`Failed to detect duplicates: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Organize dataset by similarity clusters
   * 
   * @param datasetId Dataset ID
   * @param numberOfClusters Number of clusters to create
   * @returns Map of cluster IDs to image IDs
   */
  public async clusterDatasetImages(
    datasetId: string,
    numberOfClusters: number = 5
  ): Promise<Map<number, string[]>> {
    try {
      logger.info(`Clustering images in dataset ${datasetId} into ${numberOfClusters} clusters`);
      
      // Get all embeddings for the dataset
      const client = supabaseClient.getClient();
      
      // Cast client to any to allow chained methods
      const { data: embeddings, error } = await (client as any)
        .from(this.embeddingTableName)
        .select('image_id, embedding')
        .eq('dataset_id', datasetId);
      
      if (error) {
        throw error;
      }
      
      if (!embeddings || embeddings.length === 0) {
        logger.info(`No embeddings found for dataset ${datasetId}`);
        return new Map();
      }
      
      // For a real implementation, we would use a clustering algorithm here
      // This is a simplified version that simulates clustering
      
      // Create clusters (in a real implementation, this would use k-means or similar)
      const clusterMap = new Map<number, string[]>();
      
      // Assign each image to a random cluster (just for demonstration)
      // In a real implementation, this would use actual vector clustering
      embeddings.forEach((embedding: { image_id: string; embedding: number[] }) => {
        const clusterId = Math.floor(Math.random() * numberOfClusters);
        
        if (!clusterMap.has(clusterId)) {
          clusterMap.set(clusterId, []);
        }
        
        const cluster = clusterMap.get(clusterId);
        if (cluster) {
          cluster.push(embedding.image_id);
        }
      });
      
      logger.info(`Created ${clusterMap.size} clusters for dataset ${datasetId}`);
      return clusterMap;
    } catch (error) {
      logger.error(`Failed to cluster dataset images: ${error}`);
      throw new Error(`Failed to cluster dataset images: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Find outlier images in a dataset class
   * 
   * @param datasetId Dataset ID
   * @param className Class name
   * @param threshold Similarity threshold
   * @returns Array of outlier image IDs
   */
  public async findOutlierImages(
    datasetId: string,
    className: string,
    threshold: number = 0.6
  ): Promise<string[]> {
    try {
      logger.info(`Finding outliers in dataset ${datasetId}, class ${className}`);
      
      // Get all embeddings for the class
      const client = supabaseClient.getClient();
      
      // Cast client to any to allow chained methods
      const { data: embeddings, error } = await (client as any)
        .from(this.embeddingTableName)
        .select('id, image_id, embedding')
        .eq('dataset_id', datasetId)
        .eq('class_name', className);
      
      if (error) {
        throw error;
      }
      
      if (!embeddings || embeddings.length === 0) {
        logger.info(`No embeddings found for dataset ${datasetId}, class ${className}`);
        return [];
      }
      
      logger.debug(`Analyzing ${embeddings.length} images for outliers`);
      
      // Find average embedding (centroid) for the class
      const dimensions = embeddings[0].embedding.length;
      const centroid = new Array(dimensions).fill(0);
      
      // Sum all embeddings
      embeddings.forEach((item: { embedding: number[] }) => {
        if (item.embedding && Array.isArray(item.embedding)) {
          for (let i = 0; i < dimensions; i++) {
            centroid[i] += item.embedding[i] || 0;
          }
        }
      });
      
      // Divide by count to get average
      for (let i = 0; i < dimensions; i++) {
        centroid[i] /= embeddings.length;
      }
      
      // Find outliers (images far from centroid)
      const outliers: string[] = [];
      
      // Calculate similarity to centroid for each image
      for (const embedding of embeddings) {
        // Calculate cosine similarity
        const similarity = this.calculateCosineSimilarity(centroid, embedding.embedding);
        
        // If below threshold, consider an outlier
        if (similarity < threshold) {
          outliers.push(embedding.image_id);
        }
      }
      
      logger.info(`Found ${outliers.length} outliers in class ${className}`);
      return outliers;
    } catch (error) {
      logger.error(`Failed to find outlier images: ${error}`);
      throw new Error(`Failed to find outlier images: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   * 
   * @param vec1 First vector
   * @param vec2 Second vector
   * @returns Cosine similarity (0-1)
   */
  private calculateCosineSimilarity(vec1: number[], vec2: number[]): number {
    if (!vec1 || !vec2 || !Array.isArray(vec1) || !Array.isArray(vec2)) {
      return 0;
    }
    
    const length = Math.min(vec1.length, vec2.length);
    
    let dotProduct = 0;
    let mag1 = 0;
    let mag2 = 0;
    
    for (let i = 0; i < length; i++) {
      const v1 = vec1[i] || 0;
      const v2 = vec2[i] || 0;
      
      dotProduct += v1 * v2;
      mag1 += v1 * v1;
      mag2 += v2 * v2;
    }
    
    mag1 = Math.sqrt(mag1);
    mag2 = Math.sqrt(mag2);
    
    if (mag1 === 0 || mag2 === 0) {
      return 0;
    }
    
    return dotProduct / (mag1 * mag2);
  }

  /**
   * Generate embeddings for a dataset
   * 
   * @param datasetId Dataset ID
   * @param options Generation options
   * @returns Count of generated embeddings
   */
  public async generateEmbeddingsForDataset(
    datasetId: string,
    options: {
      force?: boolean;
      batchSize?: number;
    } = {}
  ): Promise<number> {
    try {
      logger.info(`Generating embeddings for dataset ${datasetId}`);
      
      // Get dataset to confirm it exists
      const dataset = await supabaseDatasetService.getDatasetById(datasetId);
      if (!dataset) {
        throw new Error(`Dataset not found: ${datasetId}`);
      }
      
      // Get dataset classes
      const classes = await supabaseDatasetService.getDatasetClasses(datasetId);
      
      if (!classes || classes.length === 0) {
        logger.warn(`No classes found for dataset ${datasetId}`);
        return 0;
      }
      
      let totalEmbeddings = 0;
      
      // Process each class
      for (const datasetClass of classes) {
        logger.debug(`Processing class: ${datasetClass.name}`);
        
        // Get images for class
        const images = await supabaseDatasetService.getClassImages(
          datasetId, 
          datasetClass.id
        );
        
        if (!images || images.length === 0) {
          logger.debug(`No images found for class ${datasetClass.name}`);
          continue;
        }
        
        logger.debug(`Found ${images.length} images for class ${datasetClass.name}`);
        
        // Process images in batches
        const batchSize = options.batchSize || 50;
        
        for (let i = 0; i < images.length; i += batchSize) {
          const batch = images.slice(i, i + batchSize);
          
          // Process batch
          await Promise.all(batch.map(async (image: DatasetImage) => {
            try {
              // Check if embedding already exists
              if (!options.force) {
                const client = supabaseClient.getClient();
                
                // Cast client to any to allow chained methods
                const { data, error } = await (client as any)
                  .from(this.embeddingTableName)
                  .select('id')
                  .eq('dataset_id', datasetId)
                  .eq('image_id', image.id)
                  .eq('class_name', datasetClass.name)
                  .maybeSingle();
                
                if (error) {
                  throw error;
                }
                
                if (data) {
                  // Embedding already exists
                  return;
                }
              }
              
              // Generate embedding
              // In a real implementation, this would call a ML service
              // Here we simulate with random values
              const embedding = this.generateMockEmbedding(384);
              
              // Store embedding
              await this.storeImageEmbedding(
                datasetId,
                image.id,
                datasetClass.name,
                embedding,
                {
                  width: image.width,
                  height: image.height,
                  format: image.format,
                  size: image.size
                }
              );
              
              totalEmbeddings++;
            } catch (error) {
              logger.error(`Failed to process image ${image.id}: ${error}`);
            }
          }));
          
          logger.debug(`Processed batch ${i/batchSize + 1}/${Math.ceil(images.length/batchSize)}`);
        }
      }
      
      logger.info(`Generated ${totalEmbeddings} embeddings for dataset ${datasetId}`);
      return totalEmbeddings;
    } catch (error) {
      logger.error(`Failed to generate embeddings for dataset: ${error}`);
      throw new Error(`Failed to generate embeddings for dataset: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generate a mock embedding for testing
   * 
   * @param dimensions Number of dimensions
   * @returns Random embedding vector
   */
  private generateMockEmbedding(dimensions: number): number[] {
    const embedding = new Array(dimensions);
    
    // Generate random values
    for (let i = 0; i < dimensions; i++) {
      embedding[i] = (Math.random() * 2) - 1; // Values between -1 and 1
    }
    
    // Normalize
    const magnitude = Math.sqrt(
      embedding.reduce((sum, val) => sum + val * val, 0)
    );
    
    for (let i = 0; i < dimensions; i++) {
      embedding[i] = embedding[i] / magnitude;
    }
    
    return embedding;
  }
}

// Export singleton instance
export const datasetVectorService = DatasetVectorService.getInstance();
export default datasetVectorService;