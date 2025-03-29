/**
 * Material Recognition Service
 * 
 * Uses vector embeddings to identify materials based on their visual features.
 * By storing visual feature vectors in Supabase Vector, the service can match
 * unknown materials against the database and provide confidence-based recognition results.
 */

import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger';
import { supabaseClient } from '../supabase/supabaseClient';
import { vectorSearch } from '../supabase/vector-search';

/**
 * Recognition result for a material
 */
export interface MaterialRecognitionResult {
  // Matched material information
  materialId: string;
  materialName: string;
  materialType: string;
  
  // Recognition metadata
  similarity: number;
  confidence: number;
  
  // Additional information
  attributes?: Record<string, any>;
  metadata?: Record<string, any>;
  
  // Optional alternatives
  alternatives?: Pick<MaterialRecognitionResult, 'materialId' | 'materialName' | 'materialType' | 'similarity' | 'confidence'>[];
}

/**
 * Material feature vector
 */
export interface MaterialFeatureVector {
  // Material identification
  materialId: string;
  materialName: string;
  materialType: string;
  
  // Feature data
  featureVector: number[];
  featureType: 'global' | 'texture' | 'color' | 'pattern';
  resolution?: string;
  
  // Additional metadata
  attributes?: Record<string, any>;
  metadata?: Record<string, any>;
}

/**
 * Recognition options
 */
export interface RecognitionOptions {
  // Recognition constraints
  materialType?: string | string[];
  minConfidence?: number;
  maxResults?: number;
  
  // Feature options
  featureType?: 'global' | 'texture' | 'color' | 'pattern';
  includeAttributes?: boolean;
  includeAlternatives?: boolean;
}

/**
 * Material Recognition Service
 * 
 * Identifies materials based on their visual feature vectors using Supabase Vector
 */
export class MaterialRecognitionService {
  private static instance: MaterialRecognitionService;
  private embeddingTableName = 'material_feature_vectors';
  private vectorColumnName = 'embedding';
  private recognitionHistoryTableName = 'recognition_history';
  
  private constructor() {
    logger.info('Material Recognition Service initialized');
    
    // Ensure tables and indices exist
    this.ensureTables().catch(error => {
      logger.error(`Failed to ensure tables: ${error}`);
    });
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(): MaterialRecognitionService {
    if (!MaterialRecognitionService.instance) {
      MaterialRecognitionService.instance = new MaterialRecognitionService();
    }
    return MaterialRecognitionService.instance;
  }
  
  /**
   * Ensure necessary tables and indices exist
   */
  private async ensureTables(): Promise<void> {
    try {
      const client = supabaseClient.getClient();
      
      // Create feature vectors table if it doesn't exist
      await client.rpc('execute_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS ${this.embeddingTableName} (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            material_id TEXT NOT NULL,
            material_name TEXT NOT NULL,
            material_type TEXT NOT NULL,
            feature_type TEXT NOT NULL,
            resolution TEXT,
            ${this.vectorColumnName} vector(512),
            attributes JSONB,
            metadata JSONB,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
          
          CREATE INDEX IF NOT EXISTS idx_${this.embeddingTableName}_material_id 
            ON ${this.embeddingTableName}(material_id);
          
          CREATE INDEX IF NOT EXISTS idx_${this.embeddingTableName}_material_type 
            ON ${this.embeddingTableName}(material_type);
            
          CREATE INDEX IF NOT EXISTS idx_${this.embeddingTableName}_feature_type 
            ON ${this.embeddingTableName}(feature_type);
        `
      });
      
      // Create recognition history table if it doesn't exist
      await client.rpc('execute_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS ${this.recognitionHistoryTableName} (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            source_id TEXT,
            image_url TEXT,
            query_vector vector(512),
            result_material_id TEXT,
            result_material_name TEXT,
            confidence FLOAT,
            is_correct BOOLEAN,
            user_feedback TEXT,
            session_id TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
          
          CREATE INDEX IF NOT EXISTS idx_${this.recognitionHistoryTableName}_result_material 
            ON ${this.recognitionHistoryTableName}(result_material_id);
            
          CREATE INDEX IF NOT EXISTS idx_${this.recognitionHistoryTableName}_is_correct 
            ON ${this.recognitionHistoryTableName}(is_correct);
        `
      });
      
      // Create vector index if it doesn't exist
      await vectorSearch.createIndex(
        this.embeddingTableName,
        this.vectorColumnName,
        'hnsw',
        512
      );
      
      logger.info('Material recognition tables and indices are ready');
    } catch (error) {
      logger.error(`Failed to create tables: ${error}`);
      throw error;
    }
  }
  
  /**
   * Recognize a material from its feature vector
   * 
   * @param featureVector Feature vector of the material to recognize
   * @param options Recognition options
   * @returns Recognition result with confidence score
   */
  public async recognizeMaterial(
    featureVector: number[],
    options: RecognitionOptions = {}
  ): Promise<MaterialRecognitionResult> {
    try {
      logger.info('Recognizing material from feature vector');
      
      const {
        materialType,
        minConfidence = 0.7,
        maxResults = 5,
        featureType = 'global',
        includeAttributes = true,
        includeAlternatives = true
      } = options;
      
      // Prepare filters
      const filters: Record<string, any> = {
        feature_type: featureType
      };
      
      // Add material type filter if specified
      if (materialType) {
        if (Array.isArray(materialType)) {
          filters.material_type = { $in: materialType };
        } else {
          filters.material_type = materialType;
        }
      }
      
      // Find similar feature vectors
      const similarVectors = await vectorSearch.findSimilar(
        featureVector,
        this.embeddingTableName,
        this.vectorColumnName,
        {
          threshold: minConfidence,
          limit: maxResults,
          filters
        }
      );
      
      // Handle case where no matches found
      if (!similarVectors || similarVectors.length === 0) {
        logger.info('No matching materials found');
        
        return {
          materialId: '',
          materialName: 'Unknown',
          materialType: 'Unknown',
          similarity: 0,
          confidence: 0,
          alternatives: []
        };
      }
      
      // Get best match
      const bestMatch = similarVectors[0];
      
      // Calculate confidence score (combination of vector similarity and other factors)
      const rawConfidence = bestMatch.similarity;
      
      // Additional confidence adjustments could be made here based on:
      // - Number of similar matches
      // - Distribution of similarity scores
      // - Historical accuracy for this material type
      // For now, we use the raw similarity as confidence
      const adjustedConfidence = rawConfidence;
      
      // Prepare alternatives if requested
      const alternatives = includeAlternatives && similarVectors.length > 1 
        ? similarVectors.slice(1).map((vector: any) => ({
            materialId: vector.material_id,
            materialName: vector.material_name,
            materialType: vector.material_type,
            similarity: vector.similarity,
            confidence: vector.similarity // Simplified confidence for alternatives
          }))
        : undefined;
      
      // Construct result
      const result: MaterialRecognitionResult = {
        materialId: bestMatch.material_id,
        materialName: bestMatch.material_name,
        materialType: bestMatch.material_type,
        similarity: rawConfidence,
        confidence: adjustedConfidence,
        attributes: includeAttributes ? bestMatch.attributes : undefined,
        metadata: includeAttributes ? bestMatch.metadata : undefined,
        alternatives
      };
      
      // Optionally log to recognition history
      await this.logRecognitionResult(featureVector, result);
      
      return result;
    } catch (error) {
      logger.error(`Recognition failed: ${error}`);
      throw new Error(`Recognition failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Store a material feature vector in the database
   * 
   * @param materialFeature Material feature vector to store
   * @returns ID of the stored feature vector
   */
  public async storeMaterialFeature(
    materialFeature: MaterialFeatureVector
  ): Promise<string> {
    try {
      logger.info(`Storing feature vector for material: ${materialFeature.materialName}`);
      
      // Check for required properties
      if (!materialFeature.materialId || !materialFeature.materialName || !materialFeature.materialType) {
        throw new Error('Material ID, name, and type are required');
      }
      
      if (!materialFeature.featureVector || !Array.isArray(materialFeature.featureVector)) {
        throw new Error('Valid feature vector is required');
      }
      
      // Store the embedding
      const id = await vectorSearch.storeEmbedding(
        materialFeature.featureVector,
        {
          material_id: materialFeature.materialId,
          material_name: materialFeature.materialName,
          material_type: materialFeature.materialType,
          feature_type: materialFeature.featureType,
          resolution: materialFeature.resolution,
          attributes: materialFeature.attributes || {},
          metadata: materialFeature.metadata || {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        this.embeddingTableName,
        this.vectorColumnName
      );
      
      logger.info(`Stored feature vector with ID: ${id}`);
      return id;
    } catch (error) {
      logger.error(`Failed to store material feature: ${error}`);
      throw new Error(`Failed to store material feature: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Extract feature vectors from a material image
   * 
   * @param imageData Image data (base64 or file)
   * @param materialType Optional material type hint
   * @returns Extracted feature vectors
   */
  public async extractFeatureVectors(
    imageData: string | Buffer,
    materialType?: string
  ): Promise<number[]> {
    try {
      logger.info('Extracting feature vectors from image');
      
      // In a real implementation, this would call a ML service to extract features
      // For this example, we'll use a mock implementation
      
      // This would be the feature extractor, likely using a pre-trained CNN
      // For example, using ResNet, EfficientNet, or a domain-specific model
      
      // Mock implementation for testing
      const featureVector = await this.generateMockFeatureVector(512, materialType);
      return featureVector;
      
    } catch (error) {
      logger.error(`Feature extraction failed: ${error}`);
      throw new Error(`Feature extraction failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Log a recognition result to history
   * 
   * @param queryVector Query vector
   * @param result Recognition result
   * @param sourceInfo Optional source information
   */
  private async logRecognitionResult(
    queryVector: number[],
    result: MaterialRecognitionResult,
    sourceInfo?: { sourceId?: string; imageUrl?: string; sessionId?: string }
  ): Promise<void> {
    try {
      const client = supabaseClient.getClient();
      
      // Prepare data
      const data = {
        id: uuidv4(),
        source_id: sourceInfo?.sourceId || null,
        image_url: sourceInfo?.imageUrl || null,
        query_vector: queryVector,
        result_material_id: result.materialId,
        result_material_name: result.materialName,
        confidence: result.confidence,
        session_id: sourceInfo?.sessionId || null,
        created_at: new Date().toISOString()
      };
      
      // Insert into history table
      await (client as any)
        .from(this.recognitionHistoryTableName)
        .insert(data);
      
    } catch (error) {
      logger.error(`Error logging recognition result: ${error}`);
      // Don't throw - this is a non-critical operation
    }
  }
  
  /**
   * Update recognition result with user feedback
   * 
   * @param recognitionId Recognition ID
   * @param isCorrect Whether the recognition was correct
   * @param feedback Optional user feedback
   * @param correctMaterialId Optional correct material ID
   */
  public async updateWithFeedback(
    recognitionId: string,
    isCorrect: boolean,
    feedback?: string,
    correctMaterialId?: string
  ): Promise<void> {
    try {
      logger.info(`Updating recognition ${recognitionId} with feedback: ${isCorrect}`);
      
      const client = supabaseClient.getClient();
      
      // Prepare update data
      const updateData: Record<string, any> = {
        is_correct: isCorrect
      };
      
      if (feedback) {
        updateData.user_feedback = feedback;
      }
      
      if (!isCorrect && correctMaterialId) {
        updateData.correct_material_id = correctMaterialId;
      }
      
      // Update the record
      await (client as any)
        .from(this.recognitionHistoryTableName)
        .update(updateData)
        .eq('id', recognitionId);
      
    } catch (error) {
      logger.error(`Error updating feedback: ${error}`);
      throw new Error(`Error updating feedback: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Get recognition accuracy statistics
   * 
   * @param materialType Optional material type filter
   * @param timeframeInDays Optional timeframe in days
   * @returns Recognition accuracy statistics
   */
  public async getAccuracyStats(
    materialType?: string,
    timeframeInDays?: number
  ): Promise<{
    totalCount: number;
    correctCount: number;
    accuracy: number;
    byMaterialType: Record<string, { count: number; accuracy: number }>;
  }> {
    try {
      const client = supabaseClient.getClient();
      
      // Build query filters
      const filters: string[] = ['is_correct IS NOT NULL'];
      
      if (materialType) {
        filters.push(`material_type = '${materialType}'`);
      }
      
      if (timeframeInDays) {
        filters.push(`created_at > NOW() - INTERVAL '${timeframeInDays} days'`);
      }
      
      // Execute the query using RPC
      const { data, error } = await client.rpc('get_recognition_stats', {
        filter_conditions: filters.join(' AND ')
      });
      
      if (error) {
        throw error;
      }
      
      // If no data, return empty stats
      if (!data) {
        return {
          totalCount: 0,
          correctCount: 0,
          accuracy: 0,
          byMaterialType: {}
        };
      }
      
      return data;
    } catch (error) {
      logger.error(`Error getting accuracy stats: ${error}`);
      throw new Error(`Error getting accuracy stats: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Generate a mock feature vector for testing
   * 
   * @param dimensions Number of dimensions
   * @param materialType Optional material type to influence the vector
   * @returns Mock feature vector
   */
  private async generateMockFeatureVector(
    dimensions: number,
    materialType?: string
  ): Promise<number[]> {
    const vector = new Array(dimensions);
    
    // Seed the random vector differently based on material type
    // This is a simple way to make vectors for the same material type
    // cluster together in the vector space
    let seedOffset = 0;
    if (materialType) {
      const hash = [...materialType].reduce((acc, char) => acc + char.charCodeAt(0), 0);
      seedOffset = (hash % 100) / 100;
    }
    
    // Generate random values with the seed influence
    for (let i = 0; i < dimensions; i++) {
      // Values between -1 and 1, influenced by the seed
      vector[i] = (Math.random() * 1.6) - 0.8 + (seedOffset * 0.4);
    }
    
    // Normalize to unit length
    const magnitude = Math.sqrt(
      vector.reduce((sum, val) => sum + val * val, 0)
    );
    
    for (let i = 0; i < dimensions; i++) {
      vector[i] = vector[i] / magnitude;
    }
    
    return vector;
  }
  
  /**
   * Bulk import material feature vectors
   * 
   * @param features Array of material feature vectors
   * @returns Number of imported features
   */
  public async bulkImportFeatures(
    features: MaterialFeatureVector[]
  ): Promise<number> {
    try {
      logger.info(`Bulk importing ${features.length} material feature vectors`);
      
      let importedCount = 0;
      
      // Process in batches
      const batchSize = 50;
      for (let i = 0; i < features.length; i += batchSize) {
        const batch = features.slice(i, i + batchSize);
        
        // Store each feature in the batch
        await Promise.all(batch.map(async (feature) => {
          try {
            await this.storeMaterialFeature(feature);
            importedCount++;
          } catch (error) {
            logger.error(`Error importing feature for ${feature.materialName}: ${error}`);
          }
        }));
        
        logger.debug(`Processed batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(features.length/batchSize)}`);
      }
      
      logger.info(`Successfully imported ${importedCount} feature vectors`);
      return importedCount;
    } catch (error) {
      logger.error(`Bulk import failed: ${error}`);
      throw new Error(`Bulk import failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Find materials with similar visual features
   * 
   * @param materialId Material ID to find similar materials for
   * @param options Search options
   * @returns Similar materials
   */
  public async findSimilarMaterials(
    materialId: string,
    options: {
      minSimilarity?: number;
      maxResults?: number;
      sameMaterialType?: boolean;
    } = {}
  ): Promise<MaterialRecognitionResult[]> {
    try {
      logger.info(`Finding materials similar to ${materialId}`);
      
      const {
        minSimilarity = 0.7,
        maxResults = 10,
        sameMaterialType = false
      } = options;
      
      const client = supabaseClient.getClient();
      
      // First, get the feature vector for the material
      const { data: materialFeature, error } = await (client as any)
        .from(this.embeddingTableName)
        .select('material_id, material_type, embedding')
        .eq('material_id', materialId)
        .eq('feature_type', 'global')  // Assuming global features for comparison
        .maybeSingle();
      
      if (error) {
        throw error;
      }
      
      if (!materialFeature) {
        throw new Error(`Material ${materialId} not found or has no feature vectors`);
      }
      
      // Prepare filters
      const filters: Record<string, any> = {
        // Exclude the same material
        material_id: { $ne: materialId }
      };
      
      // Filter by same material type if requested
      if (sameMaterialType) {
        filters.material_type = materialFeature.material_type;
      }
      
      // Find similar materials
      const similarVectors = await vectorSearch.findSimilar(
        materialFeature.embedding,
        this.embeddingTableName,
        this.vectorColumnName,
        {
          threshold: minSimilarity,
          limit: maxResults,
          filters
        }
      );
      
      // Convert to recognition results
      return similarVectors.map((vector: any) => ({
        materialId: vector.material_id,
        materialName: vector.material_name,
        materialType: vector.material_type,
        similarity: vector.similarity,
        confidence: vector.similarity,  // Using similarity as confidence
        attributes: vector.attributes
      }));
      
    } catch (error) {
      logger.error(`Error finding similar materials: ${error}`);
      throw new Error(`Error finding similar materials: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

// Export singleton instance
export const materialRecognitionService = MaterialRecognitionService.getInstance();
export default materialRecognitionService;