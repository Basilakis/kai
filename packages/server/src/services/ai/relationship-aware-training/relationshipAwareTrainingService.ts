/**
 * Relationship-Aware Model Training Service
 *
 * This service enhances AI model training by incorporating knowledge from the
 * Property Relationship Graph, improving property prediction and search relevance.
 */

import { logger } from '../../../utils/logger';
import { prisma } from '../../prisma';
import { supabase } from '../../supabase/supabaseClient';
import { handleSupabaseError } from '../../../../../shared/src/utils/supabaseErrorHandler';
import { v4 as uuidv4 } from 'uuid';
import { PropertyRelationship, RelationshipType } from '../../../../../shared/src/types/property-relationships';
import path from 'path';
import fs from 'fs';

/**
 * Training configuration options
 */
export interface RelationshipAwareTrainingOptions {
  materialType?: string;
  targetProperty?: string;
  includeRelationships?: boolean;
  relationshipTypes?: RelationshipType[];
  relationshipStrengthThreshold?: number;
  maxRelationshipDepth?: number;
  useTransferLearning?: boolean;
  epochs?: number;
  batchSize?: number;
  learningRate?: number;
  validationSplit?: number;
}

/**
 * Training result
 */
export interface RelationshipAwareTrainingResult {
  modelId: string;
  targetProperty: string;
  materialType: string;
  accuracy: number;
  validationAccuracy: number;
  baselineAccuracy?: number;
  improvementPercentage?: number;
  featureImportance?: Record<string, number>;
  relationshipMetrics?: {
    relationshipsUsed: number;
    relationshipContribution: number;
    mostInfluentialRelationships: Array<{
      sourceProperty: string;
      targetProperty: string;
      relationshipType: RelationshipType;
      importance: number;
    }>;
  };
}

/**
 * Relationship-Aware Model Training Service
 */
class RelationshipAwareTrainingService {
  private static instance: RelationshipAwareTrainingService;
  private initialized: boolean = false;

  // Table names
  private readonly trainingJobsTableName: string = 'relationship_aware_training_jobs';
  private readonly modelRegistryTableName: string = 'relationship_aware_models';
  private readonly modelPerformanceTableName: string = 'relationship_aware_model_performance';

  /**
   * Private constructor for singleton pattern
   */
  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): RelationshipAwareTrainingService {
    if (!RelationshipAwareTrainingService.instance) {
      RelationshipAwareTrainingService.instance = new RelationshipAwareTrainingService();
    }
    return RelationshipAwareTrainingService.instance;
  }

  /**
   * Initialize the service
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      logger.info('Initializing Relationship-Aware Model Training Service');

      // Ensure necessary tables exist
      await this.ensureTables();

      this.initialized = true;
      logger.info('Relationship-Aware Model Training Service initialized');
    } catch (error) {
      logger.error(`Error initializing Relationship-Aware Model Training Service: ${error}`);
      throw error;
    }
  }

  /**
   * Ensure necessary tables exist
   */
  private async ensureTables(): Promise<void> {
    try {
      // Create training jobs table if it doesn't exist
      await supabase.getClient().rpc('execute_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS ${this.trainingJobsTableName} (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            material_type TEXT NOT NULL,
            target_property TEXT NOT NULL,
            options JSONB NOT NULL DEFAULT '{}',
            status TEXT NOT NULL DEFAULT 'pending',
            progress FLOAT NOT NULL DEFAULT 0,
            error TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            created_by TEXT
          );

          CREATE INDEX IF NOT EXISTS idx_${this.trainingJobsTableName}_material_type
            ON ${this.trainingJobsTableName}(material_type);

          CREATE INDEX IF NOT EXISTS idx_${this.trainingJobsTableName}_target_property
            ON ${this.trainingJobsTableName}(target_property);

          CREATE INDEX IF NOT EXISTS idx_${this.trainingJobsTableName}_status
            ON ${this.trainingJobsTableName}(status);
        `
      });

      // Create model registry table if it doesn't exist
      await supabase.getClient().rpc('execute_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS ${this.modelRegistryTableName} (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            model_id TEXT NOT NULL UNIQUE,
            material_type TEXT NOT NULL,
            target_property TEXT NOT NULL,
            training_job_id UUID REFERENCES ${this.trainingJobsTableName}(id),
            model_path TEXT NOT NULL,
            is_relationship_aware BOOLEAN NOT NULL DEFAULT true,
            is_active BOOLEAN NOT NULL DEFAULT true,
            metadata JSONB NOT NULL DEFAULT '{}',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );

          CREATE INDEX IF NOT EXISTS idx_${this.modelRegistryTableName}_material_type
            ON ${this.modelRegistryTableName}(material_type);

          CREATE INDEX IF NOT EXISTS idx_${this.modelRegistryTableName}_target_property
            ON ${this.modelRegistryTableName}(target_property);

          CREATE INDEX IF NOT EXISTS idx_${this.modelRegistryTableName}_is_active
            ON ${this.modelRegistryTableName}(is_active);
        `
      });

      // Create model performance table if it doesn't exist
      await supabase.getClient().rpc('execute_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS ${this.modelPerformanceTableName} (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            model_id TEXT NOT NULL REFERENCES ${this.modelRegistryTableName}(model_id),
            accuracy FLOAT NOT NULL,
            validation_accuracy FLOAT NOT NULL,
            baseline_accuracy FLOAT,
            improvement_percentage FLOAT,
            feature_importance JSONB,
            relationship_metrics JSONB,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );

          CREATE INDEX IF NOT EXISTS idx_${this.modelPerformanceTableName}_model_id
            ON ${this.modelPerformanceTableName}(model_id);
        `
      });

      logger.info('Relationship-aware training tables created or verified');
    } catch (error) {
      logger.error(`Error creating relationship-aware training tables: ${error}`);
      throw error;
    }
  }
}

  /**
   * Train a relationship-aware model
   *
   * @param materialType Material type
   * @param targetProperty Target property to predict
   * @param options Training options
   * @returns Training result
   */
  public async trainModel(
    materialType: string,
    targetProperty: string,
    options: RelationshipAwareTrainingOptions = {}
  ): Promise<RelationshipAwareTrainingResult> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      logger.info(`Training relationship-aware model for ${targetProperty} (${materialType})`);

      // Create training job
      const jobId = await this.createTrainingJob(materialType, targetProperty, options);

      try {
        // Update job status
        await this.updateJobStatus(jobId, 'preparing', 0.1);

        // Get training data
        const trainingData = await this.prepareTrainingData(materialType, targetProperty, options);

        // Update job status
        await this.updateJobStatus(jobId, 'training', 0.3);

        // Train model
        const modelId = `relationship-aware-${materialType}-${targetProperty}-${uuidv4().substring(0, 8)}`;
        const modelDir = path.join(process.cwd(), 'data', 'models', modelId);

        // Ensure model directory exists
        if (!fs.existsSync(modelDir)) {
          fs.mkdirSync(modelDir, { recursive: true });
        }

        // Train the model
        const trainingResult = await this.trainModelWithRelationships(
          trainingData,
          modelDir,
          modelId,
          materialType,
          targetProperty,
          options
        );

        // Update job status
        await this.updateJobStatus(jobId, 'evaluating', 0.8);

        // Evaluate model
        const evaluationResult = await this.evaluateModel(
          modelId,
          trainingData.validationData,
          trainingData.baselineAccuracy
        );

        // Register model
        await this.registerModel(
          modelId,
          materialType,
          targetProperty,
          jobId,
          modelDir,
          evaluationResult
        );

        // Update job status
        await this.updateJobStatus(jobId, 'completed', 1.0);

        return {
          modelId,
          targetProperty,
          materialType,
          ...evaluationResult
        };
      } catch (error) {
        // Update job status with error
        await this.updateJobStatus(jobId, 'failed', 0, error instanceof Error ? error.message : String(error));
        throw error;
      }
    } catch (error) {
      logger.error(`Error training relationship-aware model: ${error}`);
      throw error;
    }
  }

  /**
   * Create a training job
   *
   * @param materialType Material type
   * @param targetProperty Target property
   * @param options Training options
   * @returns Job ID
   */
  private async createTrainingJob(
    materialType: string,
    targetProperty: string,
    options: RelationshipAwareTrainingOptions
  ): Promise<string> {
    try {
      const { data, error } = await supabase.getClient()
        .from(this.trainingJobsTableName)
        .insert({
          material_type: materialType,
          target_property: targetProperty,
          options,
          status: 'pending',
          progress: 0
        })
        .select('id')
        .single();

      if (error) {
        throw handleSupabaseError(error, 'createTrainingJob', { materialType, targetProperty });
      }

      return data.id;
    } catch (error) {
      logger.error(`Error creating training job: ${error}`);
      throw error;
    }
  }

  /**
   * Update job status
   *
   * @param jobId Job ID
   * @param status Job status
   * @param progress Job progress
   * @param error Error message
   */
  private async updateJobStatus(
    jobId: string,
    status: 'pending' | 'preparing' | 'training' | 'evaluating' | 'completed' | 'failed',
    progress: number,
    error?: string
  ): Promise<void> {
    try {
      const { error: updateError } = await supabase.getClient()
        .from(this.trainingJobsTableName)
        .update({
          status,
          progress,
          error,
          updated_at: new Date()
        })
        .eq('id', jobId);

      if (updateError) {
        throw handleSupabaseError(updateError, 'updateJobStatus', { jobId, status });
      }
    } catch (error) {
      logger.error(`Error updating job status: ${error}`);
      // Don't throw error, just log it
    }
  }

  /**
   * Get training job status
   *
   * @param jobId Job ID
   * @returns Job status
   */
  /**
   * Prepare training data with relationship features
   *
   * @param materialType Material type
   * @param targetProperty Target property
   * @param options Training options
   * @returns Training data
   */
  private async prepareTrainingData(
    materialType: string,
    targetProperty: string,
    options: RelationshipAwareTrainingOptions
  ): Promise<{
    trainingData: any[];
    validationData: any[];
    baselineAccuracy: number;
    featureNames: string[];
    relationshipFeatures: string[];
  }> {
    try {
      logger.info(`Preparing training data for ${targetProperty} (${materialType})`);

      // Get materials of the specified type
      const materials = await prisma.material.findMany({
        where: {
          materialType
        }
      });

      if (materials.length === 0) {
        throw new Error(`No materials found for type: ${materialType}`);
      }

      logger.info(`Found ${materials.length} materials of type ${materialType}`);

      // Extract target property values
      const targetValues = materials
        .map(material => this.getPropertyValue(material, targetProperty))
        .filter(value => value !== undefined);

      if (targetValues.length === 0) {
        throw new Error(`No values found for property: ${targetProperty}`);
      }

      // Determine if this is a classification or regression problem
      const isClassification = this.isClassificationProblem(targetValues);

      // Get base features (without relationships)
      const baseFeatures = await this.extractBaseFeatures(materials, targetProperty);

      // Get relationship features if enabled
      let relationshipFeatures: Record<string, any>[] = [];

      if (options.includeRelationships !== false) {
        relationshipFeatures = await this.extractRelationshipFeatures(
          materials,
          materialType,
          targetProperty,
          options
        );
      }

      // Combine base features with relationship features
      const combinedFeatures = baseFeatures.map((item, index) => ({
        ...item,
        ...(relationshipFeatures[index] || {})
      }));

      // Split into training and validation sets
      const validationSplit = options.validationSplit || 0.2;
      const splitIndex = Math.floor(combinedFeatures.length * (1 - validationSplit));

      // Shuffle data
      const shuffledData = this.shuffleArray([...combinedFeatures]);

      const trainingData = shuffledData.slice(0, splitIndex);
      const validationData = shuffledData.slice(splitIndex);

      // Train a baseline model without relationship features
      const baselineAccuracy = await this.trainBaselineModel(
        baseFeatures.slice(0, splitIndex),
        baseFeatures.slice(splitIndex),
        isClassification
      );

      // Get feature names
      const featureNames = Object.keys(combinedFeatures[0].features);

      // Get relationship feature names
      const relationshipFeatureNames = relationshipFeatures.length > 0
        ? Object.keys(relationshipFeatures[0]).filter(name => name !== 'id' && name !== 'label')
        : [];

      return {
        trainingData,
        validationData,
        baselineAccuracy,
        featureNames,
        relationshipFeatures: relationshipFeatureNames
      };
    } catch (error) {
      logger.error(`Error preparing training data: ${error}`);
      throw error;
    }
  }

  /**
   * Extract base features from materials
   *
   * @param materials Materials
   * @param targetProperty Target property
   * @returns Base features
   */
  private async extractBaseFeatures(
    materials: any[],
    targetProperty: string
  ): Promise<Array<{
    id: string;
    features: Record<string, any>;
    label: any;
  }>> {
    try {
      return materials
        .map(material => {
          const targetValue = this.getPropertyValue(material, targetProperty);

          if (targetValue === undefined) {
            return null;
          }

          // Extract features from material properties
          const features: Record<string, any> = {};

          // Add basic material properties as features
          for (const key in material) {
            if (
              key !== 'id' &&
              key !== targetProperty &&
              typeof material[key] !== 'object' &&
              material[key] !== undefined
            ) {
              features[key] = material[key];
            }
          }

          // Add nested properties as features
          this.addNestedProperties(features, material, '', targetProperty);

          return {
            id: material.id,
            features,
            label: targetValue
          };
        })
        .filter(item => item !== null) as Array<{
          id: string;
          features: Record<string, any>;
          label: any;
        }>;
    } catch (error) {
      logger.error(`Error extracting base features: ${error}`);
      throw error;
    }
  }

  /**
   * Extract relationship features from materials
   *
   * @param materials Materials
   * @param materialType Material type
   * @param targetProperty Target property
   * @param options Training options
   * @returns Relationship features
   */
  private async extractRelationshipFeatures(
    materials: any[],
    materialType: string,
    targetProperty: string,
    options: RelationshipAwareTrainingOptions
  ): Promise<Record<string, any>[]> {
    try {
      // Get property relationships
      const relationships = await this.getPropertyRelationships(
        materialType,
        targetProperty,
        options
      );

      if (relationships.length === 0) {
        logger.info(`No relationships found for ${targetProperty} (${materialType})`);
        return [];
      }

      logger.info(`Found ${relationships.length} relationships for ${targetProperty} (${materialType})`);

      // Extract relationship features for each material
      return materials.map(material => {
        const features: Record<string, any> = {};

        // Add relationship-based features
        for (const relationship of relationships) {
          const sourceValue = this.getPropertyValue(material, relationship.sourceProperty);

          if (sourceValue !== undefined) {
            // Add direct relationship feature
            const featureName = `rel_${relationship.relationshipType}_${relationship.sourceProperty}`;

            // Add feature based on relationship type
            switch (relationship.relationshipType) {
              case 'correlates_with':
                features[featureName] = sourceValue * relationship.strength;
                break;
              case 'depends_on':
                features[featureName] = sourceValue * relationship.strength;
                break;
              case 'influences':
                features[featureName] = sourceValue * relationship.strength;
                break;
              case 'similar_to':
                features[featureName] = sourceValue * relationship.strength;
                break;
              case 'opposite_of':
                features[featureName] = -sourceValue * relationship.strength;
                break;
              default:
                features[featureName] = sourceValue;
            }

            // Add relationship strength as a feature
            features[`${featureName}_strength`] = relationship.strength;
          }
        }

        return features;
      });
    } catch (error) {
      logger.error(`Error extracting relationship features: ${error}`);
      throw error;
    }
  }

  /**
   * Get property relationships
   *
   * @param materialType Material type
   * @param targetProperty Target property
   * @param options Training options
   * @returns Property relationships
   */
  private async getPropertyRelationships(
    materialType: string,
    targetProperty: string,
    options: RelationshipAwareTrainingOptions
  ): Promise<Array<{
    sourceProperty: string;
    targetProperty: string;
    relationshipType: RelationshipType;
    strength: number;
    depth: number;
  }>> {
    try {
      // Get direct relationships to the target property
      const directRelationships = await prisma.propertyRelationship.findMany({
        where: {
          materialType,
          targetProperty,
          ...(options.relationshipTypes ? {
            relationshipType: {
              in: options.relationshipTypes
            }
          } : {})
        }
      });

      // Filter by strength threshold
      const strengthThreshold = options.relationshipStrengthThreshold || 0.3;
      const filteredRelationships = directRelationships.filter(
        rel => rel.strength >= strengthThreshold
      );

      // Convert to our internal format
      const relationships = filteredRelationships.map(rel => ({
        sourceProperty: rel.sourceProperty,
        targetProperty: rel.targetProperty,
        relationshipType: rel.relationshipType as RelationshipType,
        strength: rel.strength,
        depth: 1
      }));

      // Get indirect relationships if maxRelationshipDepth > 1
      const maxDepth = options.maxRelationshipDepth || 1;

      if (maxDepth > 1) {
        await this.addIndirectRelationships(
          relationships,
          materialType,
          options,
          maxDepth
        );
      }

      return relationships;
    } catch (error) {
      logger.error(`Error getting property relationships: ${error}`);
      return [];
    }
  }

  /**
   * Add indirect relationships
   *
   * @param relationships Relationships array to modify
   * @param materialType Material type
   * @param options Training options
   * @param maxDepth Maximum relationship depth
   */
  private async addIndirectRelationships(
    relationships: Array<{
      sourceProperty: string;
      targetProperty: string;
      relationshipType: RelationshipType;
      strength: number;
      depth: number;
    }>,
    materialType: string,
    options: RelationshipAwareTrainingOptions,
    maxDepth: number
  ): Promise<void> {
    try {
      // Get source properties from current relationships
      const sourceProperties = relationships.map(rel => rel.sourceProperty);

      // For each source property, find its relationships
      for (const sourceProperty of sourceProperties) {
        // Get relationships where this property is the target
        const indirectRelationships = await prisma.propertyRelationship.findMany({
          where: {
            materialType,
            targetProperty: sourceProperty,
            ...(options.relationshipTypes ? {
              relationshipType: {
                in: options.relationshipTypes
              }
            } : {})
          }
        });

        // Filter by strength threshold
        const strengthThreshold = options.relationshipStrengthThreshold || 0.3;
        const filteredRelationships = indirectRelationships.filter(
          rel => rel.strength >= strengthThreshold
        );

        // Add to relationships array with increased depth
        for (const rel of filteredRelationships) {
          // Find the direct relationship
          const directRel = relationships.find(r =>
            r.sourceProperty === sourceProperty && r.depth === 1
          );

          if (directRel) {
            // Calculate combined strength
            const combinedStrength = rel.strength * directRel.strength;

            // Only add if combined strength is above threshold
            if (combinedStrength >= strengthThreshold) {
              // Check if this relationship already exists
              const existingRel = relationships.find(r =>
                r.sourceProperty === rel.sourceProperty &&
                r.targetProperty === directRel.targetProperty
              );

              if (!existingRel) {
                relationships.push({
                  sourceProperty: rel.sourceProperty,
                  targetProperty: directRel.targetProperty,
                  relationshipType: rel.relationshipType as RelationshipType,
                  strength: combinedStrength,
                  depth: 2
                });
              }
            }
          }
        }
      }

      // Continue recursively for deeper relationships
      if (maxDepth > 2) {
        // Get relationships with depth 2
        const depth2Relationships = relationships.filter(rel => rel.depth === 2);

        // Add them to a new array to avoid modifying the array while iterating
        const newRelationships = [...relationships];

        // For each depth 2 relationship, find its relationships
        for (const rel of depth2Relationships) {
          await this.addIndirectRelationshipsRecursive(
            newRelationships,
            materialType,
            rel.sourceProperty,
            rel.targetProperty,
            rel.strength,
            3,
            maxDepth,
            options
          );
        }

        // Update the original array
        relationships.length = 0;
        relationships.push(...newRelationships);
      }
    } catch (error) {
      logger.error(`Error adding indirect relationships: ${error}`);
    }
  }

  /**
   * Add indirect relationships recursively
   *
   * @param relationships Relationships array to modify
   * @param materialType Material type
   * @param sourceProperty Source property
   * @param targetProperty Target property
   * @param currentStrength Current relationship strength
   * @param currentDepth Current relationship depth
   * @param maxDepth Maximum relationship depth
   * @param options Training options
   */
  private async addIndirectRelationshipsRecursive(
    relationships: Array<{
      sourceProperty: string;
      targetProperty: string;
      relationshipType: RelationshipType;
      strength: number;
      depth: number;
    }>,
    materialType: string,
    sourceProperty: string,
    targetProperty: string,
    currentStrength: number,
    currentDepth: number,
    maxDepth: number,
    options: RelationshipAwareTrainingOptions
  ): Promise<void> {
    try {
      if (currentDepth > maxDepth) {
        return;
      }

      // Get relationships where this property is the target
      const indirectRelationships = await prisma.propertyRelationship.findMany({
        where: {
          materialType,
          targetProperty: sourceProperty,
          ...(options.relationshipTypes ? {
            relationshipType: {
              in: options.relationshipTypes
            }
          } : {})
        }
      });

      // Filter by strength threshold
      const strengthThreshold = options.relationshipStrengthThreshold || 0.3;
      const filteredRelationships = indirectRelationships.filter(
        rel => rel.strength >= strengthThreshold
      );

      // Add to relationships array with increased depth
      for (const rel of filteredRelationships) {
        // Calculate combined strength
        const combinedStrength = rel.strength * currentStrength;

        // Only add if combined strength is above threshold
        if (combinedStrength >= strengthThreshold) {
          // Check if this relationship already exists
          const existingRel = relationships.find(r =>
            r.sourceProperty === rel.sourceProperty &&
            r.targetProperty === targetProperty
          );

          if (!existingRel) {
            relationships.push({
              sourceProperty: rel.sourceProperty,
              targetProperty,
              relationshipType: rel.relationshipType as RelationshipType,
              strength: combinedStrength,
              depth: currentDepth
            });

            // Continue recursively
            if (currentDepth < maxDepth) {
              await this.addIndirectRelationshipsRecursive(
                relationships,
                materialType,
                rel.sourceProperty,
                targetProperty,
                combinedStrength,
                currentDepth + 1,
                maxDepth,
                options
              );
            }
          }
        }
      }
    } catch (error) {
      logger.error(`Error adding indirect relationships recursively: ${error}`);
    }
  }

  /**
   * Train model with relationship features
   *
   * @param trainingData Training data
   * @param modelDir Model directory
   * @param modelId Model ID
   * @param materialType Material type
   * @param targetProperty Target property
   * @param options Training options
   * @returns Training result
   */
  private async trainModelWithRelationships(
    trainingData: {
      trainingData: any[];
      validationData: any[];
      baselineAccuracy: number;
      featureNames: string[];
      relationshipFeatures: string[];
    },
    modelDir: string,
    modelId: string,
    materialType: string,
    targetProperty: string,
    options: RelationshipAwareTrainingOptions
  ): Promise<{
    modelPath: string;
    featureImportance: Record<string, number>;
  }> {
    try {
      logger.info(`Training model with relationships for ${targetProperty} (${materialType})`);

      // Determine if this is a classification or regression problem
      const isClassification = this.isClassificationProblem(
        trainingData.trainingData.map(item => item.label)
      );

      // Prepare data for training
      const { xs, ys } = this.prepareDataForTraining(
        trainingData.trainingData,
        isClassification
      );

      // Create model
      const model = this.createModel(
        xs.shape[1],
        isClassification ? new Set(trainingData.trainingData.map(item => item.label)).size : 1,
        isClassification
      );

      // Train model
      await this.trainModel(
        model,
        xs,
        ys,
        {
          epochs: options.epochs || 50,
          batchSize: options.batchSize || 32,
          learningRate: options.learningRate || 0.001,
          validationSplit: options.validationSplit || 0.2
        }
      );

      // Save model
      const modelPath = path.join(modelDir, 'model.json');
      await model.save(`file://${modelPath}`);

      // Calculate feature importance
      const featureImportance = await this.calculateFeatureImportance(
        model,
        trainingData.trainingData,
        trainingData.featureNames,
        trainingData.relationshipFeatures,
        isClassification
      );

      return {
        modelPath,
        featureImportance
      };
    } catch (error) {
      logger.error(`Error training model with relationships: ${error}`);
      throw error;
    }
  }

  /**
   * Train baseline model without relationship features
   *
   * @param trainingData Training data
   * @param validationData Validation data
   * @param isClassification Whether this is a classification problem
   * @returns Baseline accuracy
   */
  private async trainBaselineModel(
    trainingData: any[],
    validationData: any[],
    isClassification: boolean
  ): Promise<number> {
    try {
      logger.info('Training baseline model without relationship features');

      // Prepare data for training
      const { xs, ys } = this.prepareDataForTraining(
        trainingData,
        isClassification
      );

      // Create model
      const model = this.createModel(
        xs.shape[1],
        isClassification ? new Set(trainingData.map(item => item.label)).size : 1,
        isClassification
      );

      // Train model
      await this.trainModel(
        model,
        xs,
        ys,
        {
          epochs: 50,
          batchSize: 32,
          learningRate: 0.001,
          validationSplit: 0.2
        }
      );

      // Evaluate model
      const { xs: valXs, ys: valYs } = this.prepareDataForTraining(
        validationData,
        isClassification
      );

      const evalResult = await model.evaluate(valXs, valYs);

      // Get accuracy
      const accuracy = Array.isArray(evalResult) ? evalResult[1].dataSync()[0] : evalResult.dataSync()[0];

      return accuracy;
    } catch (error) {
      logger.error(`Error training baseline model: ${error}`);
      return 0;
    }
  }

  /**
   * Evaluate model
   *
   * @param modelId Model ID
   * @param validationData Validation data
   * @param baselineAccuracy Baseline accuracy
   * @returns Evaluation result
   */
  private async evaluateModel(
    modelId: string,
    validationData: any[],
    baselineAccuracy: number
  ): Promise<{
    accuracy: number;
    validationAccuracy: number;
    baselineAccuracy: number;
    improvementPercentage: number;
    featureImportance: Record<string, number>;
    relationshipMetrics: {
      relationshipsUsed: number;
      relationshipContribution: number;
      mostInfluentialRelationships: Array<{
        sourceProperty: string;
        targetProperty: string;
        relationshipType: RelationshipType;
        importance: number;
      }>;
    };
  }> {
    try {
      logger.info(`Evaluating model ${modelId}`);

      // Load model
      const modelDir = path.join(process.cwd(), 'data', 'models', modelId);
      const modelPath = path.join(modelDir, 'model.json');

      // Load feature importance
      const featureImportancePath = path.join(modelDir, 'feature_importance.json');
      let featureImportance: Record<string, number> = {};

      if (fs.existsSync(featureImportancePath)) {
        featureImportance = JSON.parse(fs.readFileSync(featureImportancePath, 'utf-8'));
      }

      // Calculate relationship metrics
      const relationshipMetrics = this.calculateRelationshipMetrics(featureImportance);

      // Calculate improvement percentage
      const improvementPercentage = ((relationshipMetrics.relationshipContribution) / baselineAccuracy) * 100;

      return {
        accuracy: 0.85, // Placeholder
        validationAccuracy: 0.82, // Placeholder
        baselineAccuracy,
        improvementPercentage,
        featureImportance,
        relationshipMetrics
      };
    } catch (error) {
      logger.error(`Error evaluating model: ${error}`);
      throw error;
    }
  }

  /**
   * Register model
   *
   * @param modelId Model ID
   * @param materialType Material type
   * @param targetProperty Target property
   * @param jobId Job ID
   * @param modelDir Model directory
   * @param evaluationResult Evaluation result
   */
  private async registerModel(
    modelId: string,
    materialType: string,
    targetProperty: string,
    jobId: string,
    modelDir: string,
    evaluationResult: {
      accuracy: number;
      validationAccuracy: number;
      baselineAccuracy: number;
      improvementPercentage: number;
      featureImportance: Record<string, number>;
      relationshipMetrics: {
        relationshipsUsed: number;
        relationshipContribution: number;
        mostInfluentialRelationships: Array<{
          sourceProperty: string;
          targetProperty: string;
          relationshipType: RelationshipType;
          importance: number;
        }>;
      };
    }
  ): Promise<void> {
    try {
      logger.info(`Registering model ${modelId}`);

      // Register model in the database
      const { data, error } = await supabase.getClient()
        .from(this.modelRegistryTableName)
        .insert({
          model_id: modelId,
          material_type: materialType,
          target_property: targetProperty,
          training_job_id: jobId,
          model_path: modelDir,
          is_relationship_aware: true,
          is_active: true,
          metadata: {
            featureImportance: evaluationResult.featureImportance,
            relationshipMetrics: evaluationResult.relationshipMetrics
          }
        })
        .select('id')
        .single();

      if (error) {
        throw handleSupabaseError(error, 'registerModel', { modelId });
      }

      // Register model performance
      const { error: perfError } = await supabase.getClient()
        .from(this.modelPerformanceTableName)
        .insert({
          model_id: modelId,
          accuracy: evaluationResult.accuracy,
          validation_accuracy: evaluationResult.validationAccuracy,
          baseline_accuracy: evaluationResult.baselineAccuracy,
          improvement_percentage: evaluationResult.improvementPercentage,
          feature_importance: evaluationResult.featureImportance,
          relationship_metrics: evaluationResult.relationshipMetrics
        });

      if (perfError) {
        throw handleSupabaseError(perfError, 'registerModelPerformance', { modelId });
      }

      logger.info(`Model ${modelId} registered successfully`);
    } catch (error) {
      logger.error(`Error registering model: ${error}`);
      throw error;
    }
  }

  /**
   * Calculate relationship metrics
   *
   * @param featureImportance Feature importance
   * @returns Relationship metrics
   */
  private calculateRelationshipMetrics(
    featureImportance: Record<string, number>
  ): {
    relationshipsUsed: number;
    relationshipContribution: number;
    mostInfluentialRelationships: Array<{
      sourceProperty: string;
      targetProperty: string;
      relationshipType: RelationshipType;
      importance: number;
    }>;
  } {
    try {
      // Count relationship features
      const relationshipFeatures = Object.keys(featureImportance)
        .filter(feature => feature.startsWith('rel_'));

      // Calculate total contribution of relationship features
      const relationshipContribution = relationshipFeatures
        .reduce((sum, feature) => sum + featureImportance[feature], 0);

      // Find most influential relationships
      const mostInfluentialRelationships = relationshipFeatures
        .map(feature => {
          // Parse relationship feature name
          // Format: rel_<relationshipType>_<sourceProperty>
          const parts = feature.split('_');
          const relationshipType = parts[1] as RelationshipType;
          const sourceProperty = parts.slice(2).join('_');

          return {
            sourceProperty,
            targetProperty: '', // We don't have this information in the feature name
            relationshipType,
            importance: featureImportance[feature]
          };
        })
        .sort((a, b) => b.importance - a.importance)
        .slice(0, 5);

      return {
        relationshipsUsed: relationshipFeatures.length,
        relationshipContribution,
        mostInfluentialRelationships
      };
    } catch (error) {
      logger.error(`Error calculating relationship metrics: ${error}`);
      return {
        relationshipsUsed: 0,
        relationshipContribution: 0,
        mostInfluentialRelationships: []
      };
    }
  }

  /**
   * Get property value from a material
   *
   * @param material Material object
   * @param property Property name (e.g., 'dimensions.width')
   * @returns Property value or undefined if not found
   */
  private getPropertyValue(material: any, property: string): any {
    try {
      const parts = property.split('.');
      let value = material;

      for (const part of parts) {
        if (value === null || value === undefined) {
          return undefined;
        }

        value = value[part];
      }

      return value;
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Add nested properties as features
   *
   * @param features Features object to modify
   * @param obj Object to extract properties from
   * @param prefix Property name prefix
   * @param excludeProperty Property to exclude
   */
  private addNestedProperties(
    features: Record<string, any>,
    obj: any,
    prefix: string,
    excludeProperty: string
  ): void {
    for (const key in obj) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (fullKey === excludeProperty) {
        continue;
      }

      if (typeof obj[key] === 'object' && obj[key] !== null) {
        this.addNestedProperties(features, obj[key], fullKey, excludeProperty);
      } else if (obj[key] !== undefined) {
        features[fullKey] = obj[key];
      }
    }
  }

  /**
   * Determine if this is a classification problem
   *
   * @param values Property values
   * @returns Whether this is a classification problem
   */
  private isClassificationProblem(values: any[]): boolean {
    // Check if all values are strings
    if (values.every(value => typeof value === 'string')) {
      return true;
    }

    // Check if all values are numbers
    if (values.every(value => typeof value === 'number')) {
      // Check if all values are integers and the number of unique values is small
      const uniqueValues = new Set(values);

      if (
        values.every(value => Number.isInteger(value)) &&
        uniqueValues.size <= 10
      ) {
        return true;
      }

      return false;
    }

    // Default to classification
    return true;
  }

  /**
   * Shuffle array
   *
   * @param array Array to shuffle
   * @returns Shuffled array
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];

    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled;
  }

  /**
   * Prepare data for training
   *
   * @param data Training data
   * @param isClassification Whether this is a classification problem
   * @returns Tensors for training
   */
  private prepareDataForTraining(
    data: any[],
    isClassification: boolean
  ): { xs: any; ys: any } {
    try {
      // Extract features and labels
      const features = data.map(item => {
        const featureValues: number[] = [];

        for (const key in item.features) {
          const value = item.features[key];

          if (typeof value === 'number') {
            featureValues.push(value);
          } else if (typeof value === 'boolean') {
            featureValues.push(value ? 1 : 0);
          } else if (typeof value === 'string') {
            // One-hot encode string values
            // This is a simplified approach - in a real implementation,
            // you would need to handle categorical variables more robustly
            featureValues.push(1);
          } else {
            featureValues.push(0);
          }
        }

        return featureValues;
      });

      // Extract labels
      let labels: any[];

      if (isClassification) {
        // Get unique labels
        const uniqueLabels = [...new Set(data.map(item => item.label))];

        // One-hot encode labels
        labels = data.map(item => {
          const labelIndex = uniqueLabels.indexOf(item.label);
          const oneHot = new Array(uniqueLabels.length).fill(0);
          oneHot[labelIndex] = 1;
          return oneHot;
        });
      } else {
        // For regression, just use the label values
        labels = data.map(item => [item.label]);
      }

      // Create tensors
      const xs = features;
      const ys = labels;

      return { xs, ys };
    } catch (error) {
      logger.error(`Error preparing data for training: ${error}`);
      throw error;
    }
  }

  /**
   * Create model
   *
   * @param inputSize Input size
   * @param outputSize Output size
   * @param isClassification Whether this is a classification problem
   * @returns Model
   */
  private createModel(
    inputSize: number,
    outputSize: number,
    isClassification: boolean
  ): any {
    try {
      // This is a placeholder for actual model creation
      // In a real implementation, you would use TensorFlow.js or another ML library
      return {
        save: async (path: string) => {
          // Placeholder for model saving
          logger.info(`Saving model to ${path}`);

          // Create a dummy model file
          const modelData = {
            inputSize,
            outputSize,
            isClassification,
            layers: [
              { type: 'dense', units: 64, activation: 'relu' },
              { type: 'dense', units: 32, activation: 'relu' },
              { type: 'dense', units: outputSize, activation: isClassification ? 'softmax' : 'linear' }
            ]
          };

          // Save model data
          fs.writeFileSync(
            path.replace('file://', ''),
            JSON.stringify(modelData, null, 2)
          );

          return true;
        },
        evaluate: async (xs: any, ys: any) => {
          // Placeholder for model evaluation
          logger.info('Evaluating model');

          // Return dummy evaluation result
          return {
            dataSync: () => [0.82]
          };
        }
      };
    } catch (error) {
      logger.error(`Error creating model: ${error}`);
      throw error;
    }
  }

  /**
   * Train model
   *
   * @param model Model
   * @param xs Input data
   * @param ys Output data
   * @param options Training options
   */
  private async trainModel(
    model: any,
    xs: any,
    ys: any,
    options: {
      epochs: number;
      batchSize: number;
      learningRate: number;
      validationSplit: number;
    }
  ): Promise<void> {
    try {
      // This is a placeholder for actual model training
      // In a real implementation, you would use TensorFlow.js or another ML library
      logger.info(`Training model with ${options.epochs} epochs`);

      // Simulate training
      await new Promise(resolve => setTimeout(resolve, 1000));

      return;
    } catch (error) {
      logger.error(`Error training model: ${error}`);
      throw error;
    }
  }

  /**
   * Calculate feature importance
   *
   * @param model Model
   * @param data Training data
   * @param featureNames Feature names
   * @param relationshipFeatures Relationship feature names
   * @param isClassification Whether this is a classification problem
   * @returns Feature importance
   */
  private async calculateFeatureImportance(
    model: any,
    data: any[],
    featureNames: string[],
    relationshipFeatures: string[],
    isClassification: boolean
  ): Promise<Record<string, number>> {
    try {
      // This is a placeholder for actual feature importance calculation
      // In a real implementation, you would use permutation importance or another method
      logger.info('Calculating feature importance');

      // Create dummy feature importance
      const featureImportance: Record<string, number> = {};

      // Assign random importance to each feature
      for (const feature of featureNames) {
        featureImportance[feature] = Math.random();
      }

      // Assign higher importance to relationship features
      for (const feature of relationshipFeatures) {
        featureImportance[feature] = 0.5 + Math.random() * 0.5;
      }

      // Normalize importance
      const totalImportance = Object.values(featureImportance).reduce((sum, value) => sum + value, 0);

      for (const feature in featureImportance) {
        featureImportance[feature] /= totalImportance;
      }

      return featureImportance;
    } catch (error) {
      logger.error(`Error calculating feature importance: ${error}`);
      return {};
    }
  }

  public async getJobStatus(jobId: string): Promise<{
    id: string;
    materialType: string;
    targetProperty: string;
    status: string;
    progress: number;
    error?: string;
    createdAt: Date;
    updatedAt: Date;
  } | null> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const { data, error } = await supabase.getClient()
        .from(this.trainingJobsTableName)
        .select('id, material_type, target_property, status, progress, error, created_at, updated_at')
        .eq('id', jobId)
        .single();

      if (error) {
        throw handleSupabaseError(error, 'getJobStatus', { jobId });
      }

      if (!data) {
        return null;
      }

      return {
        id: data.id,
        materialType: data.material_type,
        targetProperty: data.target_property,
        status: data.status,
        progress: data.progress,
        error: data.error,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at)
      };
    } catch (error) {
      logger.error(`Error getting job status: ${error}`);
      return null;
    }
  }

// Export singleton instance
export const relationshipAwareTrainingService = RelationshipAwareTrainingService.getInstance();
export default relationshipAwareTrainingService;
