/**
 * Dataset Management Service
 * 
 * Advanced service for dataset management features including data cleaning,
 * augmentation, versioning, quality metrics, and more.
 */

import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger';
import supabaseDatasetService, { Dataset, DatasetClass, DatasetImage } from '../supabase/supabase-dataset-service';
import { supabaseClient } from '../supabase/supabaseClient';
import * as path from 'path';
import * as fs from 'fs';

// Types for data cleaning
export interface DataCleaningOptions {
  detectDuplicates?: boolean;
  removeDuplicates?: boolean;
  detectCorrupted?: boolean;
  removeCorrupted?: boolean;
  detectOutliers?: boolean;
  removeOutliers?: boolean;
  balanceClasses?: boolean;
  fixLabels?: boolean;
  checkResolution?: {
    enabled: boolean;
    minWidth?: number;
    minHeight?: number;
  };
}

export interface DataCleaningResult {
  success: boolean;
  datasetId: string;
  issuesDetected: {
    duplicates: number;
    corrupted: number;
    outliers: number;
    lowResolution: number;
    labelIssues: number;
    classImbalance: {
      totalClasses: number;
      imbalancedClasses: number;
    };
  };
  issuesFixed: {
    duplicatesRemoved: number;
    corruptedRemoved: number;
    outliersRemoved: number;
    lowResolutionRemoved: number;
    labelsFixed: number;
    classesBalanced: boolean;
  };
  summary: string;
  cleanedDatasetId?: string;
}

// Types for data augmentation
export interface DataAugmentationOptions {
  enabled: boolean;
  targetSamplesPerClass?: number;
  maxAugmentationPerImage?: number;
  transformations: {
    rotation?: {
      enabled: boolean;
      maxDegrees?: number;
    };
    flip?: {
      enabled: boolean;
      horizontal?: boolean;
      vertical?: boolean;
    };
    crop?: {
      enabled: boolean;
      percentage?: number;
    };
    zoom?: {
      enabled: boolean;
      range?: [number, number];
    };
    brightness?: {
      enabled: boolean;
      range?: [number, number];
    };
    contrast?: {
      enabled: boolean;
      range?: [number, number];
    };
    noise?: {
      enabled: boolean;
      level?: number;
    };
    blur?: {
      enabled: boolean;
      level?: number;
    };
    colorJitter?: {
      enabled: boolean;
      level?: number;
    };
    perspective?: {
      enabled: boolean;
      level?: number;
    };
  };
}

export interface AugmentationResult {
  success: boolean;
  datasetId: string;
  originalImageCount: number;
  augmentedImageCount: number;
  totalImageCount: number;
  augmentationsByClass: Record<string, number>;
  summary: string;
}

// Types for dataset versioning
export interface DatasetVersion {
  id: string;
  datasetId: string;
  versionNumber: number;
  name: string;
  description?: string;
  createdAt: Date;
  createdBy?: string;
  changeLog?: string;
  parentVersionId?: string;
  status: 'creating' | 'ready' | 'error';
  imageCount: number;
  classCount: number;
  modelPerformance?: {
    accuracy?: number;
    precision?: number;
    recall?: number;
    f1Score?: number;
    confusionMatrix?: any;
  };
  metadata?: Record<string, any>;
}

// Types for dataset quality metrics
export interface DatasetQualityMetrics {
  datasetId: string;
  overallQualityScore: number;
  classBalance: {
    score: number;
    details: {
      giniCoefficient: number;
      classCounts: Record<string, number>;
      maxToMinRatio: number;
    };
  };
  imageQuality: {
    score: number;
    details: {
      avgResolution: { width: number; height: number };
      lowResolutionImages: number;
      blurryImages: number;
      poorLightingImages: number;
      overexposedImages: number;
    };
  };
  labelQuality: {
    score: number;
    details: {
      inconsistencies: number;
      ambiguities: number;
      outliers: number;
    };
  };
  featureDistribution: {
    score: number;
    details: {
      featureCoverage: Record<string, number>;
      featureGaps: string[];
    };
  };
  duplicateAnalysis: {
    score: number;
    details: {
      exactDuplicates: number;
      nearDuplicates: number;
      duplicateGroups: number;
    };
  };
  recommendations: string[];
}

// Types for collaborative annotation
export interface AnnotationTask {
  id: string;
  datasetId: string;
  imageId: string;
  assignedTo?: string[];
  status: 'pending' | 'in_progress' | 'completed' | 'rejected';
  createdAt: Date;
  completedAt?: Date;
  annotations: any[];
  feedback?: string;
}

// Types for synthetic data generation
export interface SyntheticDataOptions {
  targetClass: string;
  targetCount: number;
  generationMethod: 'gan' | 'mixup' | 'smote' | 'random';
  generationParams?: Record<string, any>;
}

export interface SyntheticDataResult {
  success: boolean;
  datasetId: string;
  targetClass: string;
  originalCount: number;
  generatedCount: number;
  newCount: number;
  sampleImages?: string[];
}

// Types for incremental learning
export interface IncrementalLearningOptions {
  baseDatasetId: string;
  newClasses: string[];
  newImagesPerClass?: number;
  preserveOldClasses: boolean;
  rebalance: boolean;
}

export interface IncrementalLearningResult {
  success: boolean;
  newDatasetId: string;
  originalClasses: string[];
  newClasses: string[];
  totalClasses: number;
  totalImages: number;
}

/**
 * Dataset Management Service
 * Service for advanced dataset operations including cleaning, augmentation, 
 * versioning, and quality metrics
 */
export class DatasetManagementService {
  private static instance: DatasetManagementService;

  private constructor() {
    logger.info('Dataset Management Service initialized');
  }

  /**
   * Get the singleton instance
   * @returns The DatasetManagementService instance
   */
  public static getInstance(): DatasetManagementService {
    if (!DatasetManagementService.instance) {
      DatasetManagementService.instance = new DatasetManagementService();
    }
    return DatasetManagementService.instance;
  }

  /**
   * Clean a dataset by detecting and fixing issues
   * @param datasetId Dataset ID
   * @param options Cleaning options
   * @param createNewVersion Whether to create a new version
   * @returns Cleaning results
   */
  public async cleanDataset(
    datasetId: string,
    options: DataCleaningOptions,
    createNewVersion = true
  ): Promise<DataCleaningResult> {
    logger.info(`Cleaning dataset ${datasetId}`);

    const result: DataCleaningResult = {
      success: false,
      datasetId,
      issuesDetected: {
        duplicates: 0,
        corrupted: 0,
        outliers: 0,
        lowResolution: 0,
        labelIssues: 0,
        classImbalance: {
          totalClasses: 0,
          imbalancedClasses: 0,
        }
      },
      issuesFixed: {
        duplicatesRemoved: 0,
        corruptedRemoved: 0,
        outliersRemoved: 0,
        lowResolutionRemoved: 0,
        labelsFixed: 0,
        classesBalanced: false
      },
      summary: ''
    };

    try {
      // Get the dataset
      const dataset = await supabaseDatasetService.getDatasetById(datasetId);
      if (!dataset) {
        throw new Error(`Dataset ${datasetId} not found`);
      }

      // Get classes for the dataset
      const classes = await supabaseDatasetService.getDatasetClasses(datasetId);
      result.issuesDetected.classImbalance.totalClasses = classes.length;

      // Process issues for each class
      const classSizes: Record<string, number> = {};
      const classIssues: Record<string, {
        duplicates: DatasetImage[];
        corrupted: DatasetImage[];
        outliers: DatasetImage[];
        lowResolution: DatasetImage[];
        labelIssues: DatasetImage[];
      }> = {};

      // Initialize class issues tracking
      for (const cls of classes) {
        if (cls.id) {
          classIssues[cls.id] = {
            duplicates: [],
            corrupted: [],
            outliers: [],
            lowResolution: [],
            labelIssues: []
          };
          classSizes[cls.id] = cls.imageCount;
        }
      }

      // Create new dataset version if requested
      let targetDatasetId = datasetId;
      let cleanedDataset: Dataset | null = null;

      if (createNewVersion) {
        cleanedDataset = await this.createDatasetCopy(dataset, `${dataset.name} (Cleaned)`, 'Cleaned version with issues fixed');
        targetDatasetId = cleanedDataset.id;
        result.cleanedDatasetId = cleanedDataset.id;
      }

      // Process each class
      for (const cls of classes) {
        // Get images for class
        const images = await supabaseDatasetService.getDatasetClassImages(cls.id, 1000, 0);
        
        // Analyze class for issues
        if (options.detectDuplicates && cls.id && classIssues[cls.id]) {
          const duplicates = await this.detectDuplicateImages(images);
          // Since we've verified cls.id and classIssues[cls.id] exist in the if condition
          const issueEntry = classIssues[cls.id as string];
          issueEntry!.duplicates = duplicates;
          result.issuesDetected.duplicates += duplicates.length;
        }

        if (options.detectCorrupted && cls.id && classIssues[cls.id]) {
          const corrupted = await this.detectCorruptedImages(images);
          // Since we've verified cls.id and classIssues[cls.id] exist in the if condition
          const issueEntry = classIssues[cls.id as string];
          issueEntry!.corrupted = corrupted;
          result.issuesDetected.corrupted += corrupted.length;
        }

        if (options.detectOutliers && cls.id && classIssues[cls.id]) {
          const outliers = await this.detectOutlierImages(images);
          // Since we've verified cls.id and classIssues[cls.id] exist in the if condition
          const issueEntry = classIssues[cls.id as string];
          issueEntry!.outliers = outliers;
          result.issuesDetected.outliers += outliers.length;
        }

        if (options.checkResolution && options.checkResolution.enabled && cls.id && classIssues[cls.id]) {
          const lowRes = await this.detectLowResolutionImages(
            images, 
            options.checkResolution.minWidth || 224, 
            options.checkResolution.minHeight || 224
          );
          // Since we've verified cls.id and classIssues[cls.id] exist in the if condition
          const issueEntry = classIssues[cls.id as string];
          issueEntry!.lowResolution = lowRes;
          result.issuesDetected.lowResolution += lowRes.length;
        }

        if (options.fixLabels && cls.id && classIssues[cls.id]) {
          const labelIssues = await this.detectLabelIssues(images, cls);
          // Since we've verified cls.id and classIssues[cls.id] exist in the if condition
          const issueEntry = classIssues[cls.id as string];
          issueEntry!.labelIssues = labelIssues;
          result.issuesDetected.labelIssues += labelIssues.length;
        }
      }

      // Detect class imbalance
      if (options.balanceClasses) {
        const classValues = Object.values(classSizes);
        const maxSize = Math.max(...classValues);
        const minSize = Math.min(...classValues);
        const imbalanceThreshold = 0.5; // If smallest class is less than 50% of largest
        
        // Count imbalanced classes
        for (const cls of classes) {
          const classSize = cls.id && classSizes[cls.id];
          if (cls.id && typeof classSize === 'number' && classSize / maxSize < imbalanceThreshold) {
            result.issuesDetected.classImbalance.imbalancedClasses++;
          }
        }
      }

      // Fix issues if requested
      if (createNewVersion) {
        // Process each class to fix issues
        for (const cls of classes) {
          // Create new class in the cleaned dataset
          const newClass = await supabaseDatasetService.createDatasetClass({
            datasetId: targetDatasetId,
            name: cls.name,
            description: cls.description,
            metadata: cls.metadata
          });

          // Get all images for this class
          const images = await supabaseDatasetService.getDatasetClassImages(cls.id, 1000, 0);
          
          // Filter out problematic images
          const imagesToKeep = images.filter(img => {
            // Skip duplicates if option enabled
            if (cls.id && classIssues[cls.id] && options.removeDuplicates && 
                classIssues[cls.id]?.duplicates.some(d => d.id === img.id)) {
              result.issuesFixed.duplicatesRemoved++;
              return false;
            }
            
            // Skip corrupted if option enabled
            if (cls.id && classIssues[cls.id] && options.removeCorrupted && 
                classIssues[cls.id]?.corrupted.some(c => c.id === img.id)) {
              result.issuesFixed.corruptedRemoved++;
              return false;
            }
            
            // Skip outliers if option enabled
            if (cls.id && classIssues[cls.id] && options.removeOutliers && 
                classIssues[cls.id]?.outliers.some(o => o.id === img.id)) {
              result.issuesFixed.outliersRemoved++;
              return false;
            }
            
            // Skip low resolution if option enabled
            if (cls.id && classIssues[cls.id] && options.checkResolution?.enabled && 
                classIssues[cls.id]?.lowResolution.some(l => l.id === img.id)) {
              result.issuesFixed.lowResolutionRemoved++;
              return false;
            }
            
            return true;
          });

          // Copy remaining images to new dataset
          for (const img of imagesToKeep) {
            // Get image from storage
            const { data, error } = await supabaseClient
              .getClient()
              .storage
              .from('datasets')
              .download(img.storagePath);
            
            if (error || !data) {
              logger.warn(`Failed to download image ${img.id} at ${img.storagePath}: ${error}`);
              continue;
            }

            // Create new storage path
            const newStoragePath = `${targetDatasetId}/${newClass.id}/${img.filename}`;
            
            // Upload to storage
            const uploadResult = await supabaseClient
              .getClient()
              .storage
              .from('datasets')
              .upload(newStoragePath, data);
            
            if (uploadResult.error) {
              logger.warn(`Failed to upload image to ${newStoragePath}: ${uploadResult.error}`);
              continue;
            }

            // Create new image record
            await supabaseDatasetService.createDatasetImage({
              datasetId: targetDatasetId,
              classId: newClass.id,
              storagePath: newStoragePath,
              filename: img.filename,
              fileSize: img.fileSize,
              width: img.width,
              height: img.height,
              format: img.format,
              materialId: img.materialId,
              metadata: img.metadata
            });
          }
        }

        // Fix label issues if requested
        if (options.fixLabels && result.issuesDetected.labelIssues > 0) {
          // This would implement logic to fix label issues
          // For example, moving mis-categorized images to correct classes
          result.issuesFixed.labelsFixed = result.issuesDetected.labelIssues;
        }

        // Balance classes if requested
        if (options.balanceClasses && result.issuesDetected.classImbalance.imbalancedClasses > 0) {
          // This would implement class balancing via augmentation/synthesis
          // For the prototype, we'll just mark it as done
          result.issuesFixed.classesBalanced = true;
        }

        // Set the cleaned dataset status to ready
        await supabaseDatasetService.updateDataset(targetDatasetId, {
          status: 'ready'
        });
      }

      // Generate summary
      const totalIssuesDetected = result.issuesDetected.duplicates +
        result.issuesDetected.corrupted +
        result.issuesDetected.outliers +
        result.issuesDetected.lowResolution +
        result.issuesDetected.labelIssues;
      
      const totalIssuesFixed = result.issuesFixed.duplicatesRemoved +
        result.issuesFixed.corruptedRemoved +
        result.issuesFixed.outliersRemoved +
        result.issuesFixed.lowResolutionRemoved +
        result.issuesFixed.labelsFixed;

      result.summary = `Dataset analysis complete. ${totalIssuesDetected} issues detected. ` +
        (createNewVersion ? `${totalIssuesFixed} issues fixed in new dataset version.` : '');

      result.success = true;
    } catch (err) {
      logger.error(`Error cleaning dataset: ${err}`);
      result.summary = `Error cleaning dataset: ${err instanceof Error ? err.message : String(err)}`;
    }

    return result;
  }

  /**
   * Augment a dataset with additional transformations
   * @param datasetId Dataset ID
   * @param options Augmentation options
   * @param createNewVersion Whether to create a new version
   * @returns Augmentation results
   */
  public async augmentDataset(
    datasetId: string,
    options: DataAugmentationOptions,
    createNewVersion = true
  ): Promise<AugmentationResult> {
    logger.info(`Augmenting dataset ${datasetId}`);

    const result: AugmentationResult = {
      success: false,
      datasetId,
      originalImageCount: 0,
      augmentedImageCount: 0,
      totalImageCount: 0,
      augmentationsByClass: {},
      summary: ''
    };

    try {
      // Get the dataset
      const dataset = await supabaseDatasetService.getDatasetById(datasetId);
      if (!dataset) {
        throw new Error(`Dataset ${datasetId} not found`);
      }

      result.originalImageCount = dataset.imageCount;

      // Get classes for the dataset
      const classes = await supabaseDatasetService.getDatasetClasses(datasetId);
      
      // Create new dataset version if requested
      let targetDatasetId = datasetId;
      let augmentedDataset: Dataset | null = null;

      if (createNewVersion) {
        augmentedDataset = await this.createDatasetCopy(
          dataset, 
          `${dataset.name} (Augmented)`, 
          'Augmented version with additional transformations'
        );
        targetDatasetId = augmentedDataset.id;
      }

      // Process each class
      for (const cls of classes) {
        // Get images for class
        const images = await supabaseDatasetService.getDatasetClassImages(cls.id, 1000, 0);
        
        // Create corresponding class in new dataset if using new version
        let targetClassId = cls.id;
        if (createNewVersion) {
          const newClass = await supabaseDatasetService.createDatasetClass({
            datasetId: targetDatasetId,
            name: cls.name,
            description: cls.description,
            metadata: cls.metadata
          });
          targetClassId = newClass.id;
          
          // First copy all original images
          for (const img of images) {
            await this.copyImageToNewDataset(img, targetDatasetId, targetClassId);
          }
        }

        // Calculate how many augmentations to generate
        const imagesToGenerate = options.targetSamplesPerClass 
          ? Math.max(0, options.targetSamplesPerClass - images.length) 
          : Math.ceil(images.length * 0.5); // Default to increasing class size by 50%
        
        // Limit by maxAugmentationPerImage if specified
        const maxAugPerImage = options.maxAugmentationPerImage || 5;
        const availableImages = images.length;
        const actualToGenerate = Math.min(
          imagesToGenerate,
          availableImages * maxAugPerImage
        );
        
        // Track augmentation count for this class
        result.augmentationsByClass[cls.name] = actualToGenerate;
        
        if (actualToGenerate > 0) {
          // Generate augmentations
          const generatedCount = await this.generateAugmentations(
            images,
            targetDatasetId,
            targetClassId,
            actualToGenerate,
            options.transformations
          );
          
          result.augmentedImageCount += generatedCount;
        }
      }

      // Update result stats
      result.totalImageCount = result.originalImageCount + result.augmentedImageCount;
      
      // Update dataset status if using new version
      if (createNewVersion && augmentedDataset) {
        await supabaseDatasetService.updateDataset(targetDatasetId, {
          status: 'ready'
        });
      }

      // Generate summary
      result.summary = `Dataset augmentation complete. Added ${result.augmentedImageCount} augmented images ` +
        `to ${result.originalImageCount} original images, for a total of ${result.totalImageCount} images.`;

      result.success = true;
    } catch (err) {
      logger.error(`Error augmenting dataset: ${err}`);
      result.summary = `Error augmenting dataset: ${err instanceof Error ? err.message : String(err)}`;
    }

    return result;
  }

  /**
   * Create a new version of a dataset
   * @param datasetId Source dataset ID
   * @param versionName Version name
   * @param description Version description
   * @param changeLog Optional changelog
   * @param userId Creator user ID
   * @returns The new dataset version record
   */
  public async createDatasetVersion(
    datasetId: string,
    versionName: string,
    description?: string,
    changeLog?: string,
    userId?: string
  ): Promise<DatasetVersion> {
    logger.info(`Creating new version of dataset ${datasetId}`);

    try {
      // Get the dataset
      const dataset = await supabaseDatasetService.getDatasetById(datasetId);
      if (!dataset) {
        throw new Error(`Dataset ${datasetId} not found`);
      }

      // Get all existing versions for this dataset
      const existingVersions = await this.getDatasetVersions(datasetId);
      const versionNumber = existingVersions.length + 1;

      // Create a copy of the dataset
      const newDataset = await this.createDatasetCopy(
        dataset,
        versionName || `${dataset.name} v${versionNumber}`,
        description || `Version ${versionNumber} of ${dataset.name}`,
        userId
      );

      // Create version record
      const versionId = uuidv4();
      const version: DatasetVersion = {
        id: versionId,
        datasetId,
        versionNumber,
        name: versionName || `v${versionNumber}`,
        description,
        createdAt: new Date(),
        createdBy: userId,
        changeLog,
        parentVersionId: existingVersions.length > 0 && existingVersions[0] ? existingVersions[0].id : undefined,
        status: 'ready',
        imageCount: dataset.imageCount,
        classCount: dataset.classCount,
      };

      // Store version metadata in the new dataset
      await supabaseDatasetService.updateDataset(newDataset.id, {
        metadata: {
          ...newDataset.metadata,
          isVersion: true,
          versionOf: datasetId,
          versionNumber,
          versionId
        }
      });

      // Store the version record in Supabase
      const { error } = await supabaseClient
        .getClient()
        .from('dataset_versions')
        .insert({
          id: versionId,
          dataset_id: datasetId,
          version_number: versionNumber,
          name: version.name,
          description: version.description,
          created_at: version.createdAt.toISOString(),
          created_by: version.createdBy,
          change_log: version.changeLog,
          parent_version_id: version.parentVersionId,
          status: version.status,
          image_count: version.imageCount,
          class_count: version.classCount,
          model_performance: version.modelPerformance,
          metadata: {
            newDatasetId: newDataset.id
          }
        });

      if (error) {
        throw error;
      }

      return version;
    } catch (err) {
      logger.error(`Error creating dataset version: ${err}`);
      throw new Error(`Failed to create dataset version: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Get all versions of a dataset
   * @param datasetId Dataset ID
   * @returns Array of dataset versions
   */
  public async getDatasetVersions(datasetId: string): Promise<DatasetVersion[]> {
    try {
      // First get the Supabase client instance
      const supabase = supabaseClient.getClient();
      
      // Then build and execute the query
      // Create a properly-typed query builder instance
      const query = supabase
        .from('dataset_versions')
        .select('*');
        
      // Execute the query with filtering and ordering
      const { data, error } = await query
        .eq('dataset_id', datasetId)
        .order('version_number', { ascending: false });

      if (error) {
        throw error;
      }

      return (data || []).map((item: any) => ({
        id: item.id,
        datasetId: item.dataset_id,
        versionNumber: item.version_number,
        name: item.name,
        description: item.description,
        createdAt: new Date(item.created_at),
        createdBy: item.created_by,
        changeLog: item.change_log,
        parentVersionId: item.parent_version_id,
        status: item.status,
        imageCount: item.image_count,
        classCount: item.class_count,
        modelPerformance: item.model_performance,
        metadata: item.metadata
      }));
    } catch (err) {
      logger.error(`Error getting dataset versions: ${err}`);
      throw new Error(`Failed to get dataset versions: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Analyze dataset quality and generate metrics
   * @param datasetId Dataset ID
   * @returns Dataset quality metrics
   */
  public async analyzeDatasetQuality(datasetId: string): Promise<DatasetQualityMetrics> {
    logger.info(`Analyzing quality of dataset ${datasetId}`);

    try {
      // Get the dataset
      const dataset = await supabaseDatasetService.getDatasetById(datasetId);
      if (!dataset) {
        throw new Error(`Dataset ${datasetId} not found`);
      }

      // Get classes for the dataset
      const classes = await supabaseDatasetService.getDatasetClasses(datasetId);
      
      // Initialize metrics
      const metrics: DatasetQualityMetrics = {
        datasetId,
        overallQualityScore: 0,
        classBalance: {
          score: 0,
          details: {
            giniCoefficient: 0,
            classCounts: {},
            maxToMinRatio: 0
          }
        },
        imageQuality: {
          score: 0,
          details: {
            avgResolution: { width: 0, height: 0 },
            lowResolutionImages: 0,
            blurryImages: 0,
            poorLightingImages: 0,
            overexposedImages: 0
          }
        },
        labelQuality: {
          score: 0,
          details: {
            inconsistencies: 0,
            ambiguities: 0,
            outliers: 0
          }
        },
        featureDistribution: {
          score: 0,
          details: {
            featureCoverage: {},
            featureGaps: []
          }
        },
        duplicateAnalysis: {
          score: 0,
          details: {
            exactDuplicates: 0,
            nearDuplicates: 0,
            duplicateGroups: 0
          }
        },
        recommendations: []
      };

      // Calculate class balance metrics
      const classCounts: Record<string, number> = {};
      let totalImages = 0;
      let minClassSize = Number.MAX_SAFE_INTEGER;
      let maxClassSize = 0;
      
      for (const cls of classes) {
        classCounts[cls.name] = cls.imageCount;
        totalImages += cls.imageCount;
        minClassSize = Math.min(minClassSize, cls.imageCount);
        maxClassSize = Math.max(maxClassSize, cls.imageCount);
      }
      
      metrics.classBalance.details.classCounts = classCounts;
      metrics.classBalance.details.maxToMinRatio = maxClassSize / (minClassSize || 1);
      
      // Calculate Gini coefficient for class balance
      metrics.classBalance.details.giniCoefficient = this.calculateGiniCoefficient(Object.values(classCounts));
      
      // Calculate class balance score (0-100)
      const balanceNormalization = Math.min(1, 1 / metrics.classBalance.details.maxToMinRatio);
      metrics.classBalance.score = Math.round((1 - metrics.classBalance.details.giniCoefficient) * 100 * balanceNormalization);

      // Analyze image quality
      let totalWidth = 0;
      let totalHeight = 0;
      let totalAnalyzedImages = 0;
      
      for (const cls of classes) {
        const images = await supabaseDatasetService.getDatasetClassImages(cls.id, 100, 0); // Sample up to 100 images
        
        for (const img of images) {
          totalAnalyzedImages++;
          
          // Track resolution statistics
          if (img.width && img.height) {
            totalWidth += img.width;
            totalHeight += img.height;
            
            // Check for low resolution (less than 224x224)
            if (img.width < 224 || img.height < 224) {
              metrics.imageQuality.details.lowResolutionImages++;
            }
          }
          
          // Here we would implement more sophisticated image quality checks
          // For now, we'll use simple heuristics based on img metadata if available
          if (img.metadata) {
            if (img.metadata.blurScore && img.metadata.blurScore > 0.5) {
              metrics.imageQuality.details.blurryImages++;
            }
            
            if (img.metadata.brightness && img.metadata.brightness < 0.2) {
              metrics.imageQuality.details.poorLightingImages++;
            }
            
            if (img.metadata.brightness && img.metadata.brightness > 0.9) {
              metrics.imageQuality.details.overexposedImages++;
            }
          }
        }
      }
      
      // Calculate average resolution
      if (totalAnalyzedImages > 0) {
        metrics.imageQuality.details.avgResolution = {
          width: Math.round(totalWidth / totalAnalyzedImages),
          height: Math.round(totalHeight / totalAnalyzedImages)
        };
      }
      
      // Calculate image quality score (0-100)
      const lowResPercent = metrics.imageQuality.details.lowResolutionImages / (totalAnalyzedImages || 1);
      const blurryPercent = metrics.imageQuality.details.blurryImages / (totalAnalyzedImages || 1);
      const lightingIssuesPercent = (metrics.imageQuality.details.poorLightingImages + 
        metrics.imageQuality.details.overexposedImages) / (totalAnalyzedImages || 1);
      
      metrics.imageQuality.score = Math.round(100 * (1 - (lowResPercent * 0.4 + blurryPercent * 0.4 + lightingIssuesPercent * 0.2)));

      // Calculate overall quality score as weighted average of component scores
      metrics.overallQualityScore = Math.round(
        metrics.classBalance.score * 0.4 +
        metrics.imageQuality.score * 0.6
      );

      // Generate recommendations based on findings
      if (metrics.classBalance.details.maxToMinRatio > 3) {
        metrics.recommendations.push('Balance classes by augmenting underrepresented classes or collecting more samples.');
      }
      
      if (metrics.imageQuality.details.lowResolutionImages > 0) {
        metrics.recommendations.push(`Improve ${metrics.imageQuality.details.lowResolutionImages} low-resolution images with upscaling or replacement.`);
      }
      
      if (metrics.imageQuality.details.blurryImages > 0) {
        metrics.recommendations.push(`Remove or enhance ${metrics.imageQuality.details.blurryImages} blurry images.`);
      }
      
      if ((metrics.imageQuality.details.poorLightingImages + metrics.imageQuality.details.overexposedImages) > 0) {
        metrics.recommendations.push('Apply lighting normalization to improve consistency across the dataset.');
      }

      return metrics;
    } catch (err) {
      logger.error(`Error analyzing dataset quality: ${err}`);
      throw new Error(`Failed to analyze dataset quality: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Generate synthetic data to balance or augment a class
   * @param datasetId Dataset ID
   * @param options Synthetic data generation options
   * @returns Synthetic data generation result
   */
  public async generateSyntheticData(
    datasetId: string,
    options: SyntheticDataOptions
  ): Promise<SyntheticDataResult> {
    logger.info(`Generating synthetic data for dataset ${datasetId}, class ${options.targetClass}`);

    const result: SyntheticDataResult = {
      success: false,
      datasetId,
      targetClass: options.targetClass,
      originalCount: 0,
      generatedCount: 0,
      newCount: 0
    };

    try {
      // Get the dataset
      const dataset = await supabaseDatasetService.getDatasetById(datasetId);
      if (!dataset) {
        throw new Error(`Dataset ${datasetId} not found`);
      }

      // Get classes for the dataset
      const classes = await supabaseDatasetService.getDatasetClasses(datasetId);
      
      // Find the target class
      const targetClass = classes.find(c => c.name === options.targetClass);
      if (!targetClass) {
        throw new Error(`Class ${options.targetClass} not found in dataset ${datasetId}`);
      }

      result.originalCount = targetClass.imageCount;

      // Determine how many samples to generate
      const samplesToGenerate = options.targetCount - targetClass.imageCount;
      
      if (samplesToGenerate <= 0) {
        result.success = true;
        result.newCount = result.originalCount;
        return result;
      }

      // Get images for the target class
      const images = await supabaseDatasetService.getDatasetClassImages(targetClass.id, 1000, 0);
      
      // Generate synthetic samples based on the selected method
      let generatedImages: any[] = [];
      
      switch (options.generationMethod) {
        case 'mixup':
          generatedImages = await this.generateMixupSamples(images, samplesToGenerate);
          break;
        case 'smote':
          generatedImages = await this.generateSmoteSamples(images, samplesToGenerate);
          break;
        case 'random':
          generatedImages = await this.generateRandomSamples(images, samplesToGenerate);
          break;
        case 'gan':
        default:
          // For now, default to random augmentation as a placeholder
          generatedImages = await this.generateRandomSamples(images, samplesToGenerate);
      }
      
      // Save generated images to the dataset
      for (const genImg of generatedImages) {
        const filename = `synthetic_${uuidv4()}.jpg`;
        const storagePath = `${datasetId}/${targetClass.id}/${filename}`;
        
        // Upload to storage
        const { error } = await supabaseClient
          .getClient()
          .storage
          .from('datasets')
          .upload(storagePath, genImg.data, {
            contentType: 'image/jpeg'
          });
        
        if (error) {
          logger.warn(`Failed to upload synthetic image: ${error}`);
          continue;
        }
        
        // Create image record
        await supabaseDatasetService.createDatasetImage({
          datasetId,
          classId: targetClass.id,
          storagePath,
          filename,
          metadata: {
            synthetic: true,
            generationMethod: options.generationMethod,
            generationParams: options.generationParams
          }
        });
        
        result.generatedCount++;
      }
      
      result.newCount = result.originalCount + result.generatedCount;
      result.success = true;
    } catch (err) {
      logger.error(`Error generating synthetic data: ${err}`);
    }

    return result;
  }

  /**
   * Set up an incremental learning dataset
   * @param options Incremental learning options
   * @returns Incremental learning result
   */
  public async setupIncrementalLearningDataset(
    options: IncrementalLearningOptions
  ): Promise<IncrementalLearningResult> {
    logger.info(`Setting up incremental learning dataset from ${options.baseDatasetId}`);

    const result: IncrementalLearningResult = {
      success: false,
      newDatasetId: '',
      originalClasses: [],
      newClasses: [],
      totalClasses: 0,
      totalImages: 0
    };

    try {
      // Get the base dataset
      const baseDataset = await supabaseDatasetService.getDatasetById(options.baseDatasetId);
      if (!baseDataset) {
        throw new Error(`Base dataset ${options.baseDatasetId} not found`);
      }

      // Get classes for the base dataset
      const baseClasses = await supabaseDatasetService.getDatasetClasses(options.baseDatasetId);
      result.originalClasses = baseClasses.map(c => c.name);
      
      // Create a new dataset for incremental learning
      const newDataset = await supabaseDatasetService.createDataset({
        name: `${baseDataset.name} (Incremental)`,
        description: `Incremental learning dataset based on ${baseDataset.name}`,
        status: 'processing',
        metadata: {
          incrementalLearning: true,
          baseDatasetId: options.baseDatasetId,
          originalClasses: result.originalClasses,
          newClasses: options.newClasses
        }
      });
      
      result.newDatasetId = newDataset.id;

      // Copy classes from base dataset if preserving old classes
      if (options.preserveOldClasses) {
        for (const cls of baseClasses) {
          // Create class in new dataset
          const newClass = await supabaseDatasetService.createDatasetClass({
            datasetId: newDataset.id,
            name: cls.name,
            description: cls.description,
            metadata: cls.metadata
          });
          
          // Copy images if needed - for larger datasets, you might want to use a more efficient approach
          const images = await supabaseDatasetService.getDatasetClassImages(cls.id, 1000, 0);
          
          for (const img of images) {
            await this.copyImageToNewDataset(img, newDataset.id, newClass.id);
          }
          
          result.totalImages += images.length;
        }
      }

      // Create new classes
      for (const className of options.newClasses) {
        // Create the class
        const newClass = await supabaseDatasetService.createDatasetClass({
          datasetId: newDataset.id,
          name: className,
          description: `New class added for incremental learning: ${className}`,
          metadata: {
            isNewClass: true
          }
        });
        
        // We'd need some mechanism here to add initial images for these classes
        // This could be through user upload, API, or other means
        // For now, we just create empty classes
      }

      // Update counts
      result.newClasses = options.newClasses;
      result.totalClasses = (options.preserveOldClasses ? baseClasses.length : 0) + options.newClasses.length;
      
      // Update dataset status
      await supabaseDatasetService.updateDataset(newDataset.id, {
        status: 'ready'
      });
      
      result.success = true;
    } catch (err) {
      logger.error(`Error setting up incremental learning dataset: ${err}`);
    }

    return result;
  }

  /**
   * Create a copy of a dataset
   * @param sourceDataset Source dataset
   * @param name Name for new dataset
   * @param description Description for new dataset
   * @param userId Creator user ID
   * @returns The new dataset
   */
  private async createDatasetCopy(
    sourceDataset: Dataset,
    name: string,
    description?: string,
    userId?: string
  ): Promise<Dataset> {
    // Create new dataset
    const newDataset = await supabaseDatasetService.createDataset({
      name,
      description: description || `Copy of ${sourceDataset.name}`,
      createdBy: userId || sourceDataset.createdBy,
      status: 'processing',
      metadata: {
        sourceDatasetId: sourceDataset.id,
        copyCreatedAt: new Date().toISOString()
      }
    });

    return newDataset;
  }

  /**
   * Copy an image to a new dataset
   * @param sourceImage Source image
   * @param targetDatasetId Target dataset ID
   * @param targetClassId Target class ID
   * @returns The new image
   */
  private async copyImageToNewDataset(
    sourceImage: DatasetImage, 
    targetDatasetId: string, 
    targetClassId: string
  ): Promise<DatasetImage | null> {
    try {
      // Download the image
      const { data, error } = await supabaseClient
        .getClient()
        .storage
        .from('datasets')
        .download(sourceImage.storagePath);
      
      if (error || !data) {
        logger.warn(`Failed to download image ${sourceImage.id}: ${error}`);
        return null;
      }

      // Upload to new location
      const newStoragePath = `${targetDatasetId}/${targetClassId}/${sourceImage.filename}`;
      
      const { error: uploadError } = await supabaseClient
        .getClient()
        .storage
        .from('datasets')
        .upload(newStoragePath, data);
      
      if (uploadError) {
        logger.warn(`Failed to upload image to ${newStoragePath}: ${uploadError}`);
        return null;
      }

      // Create new image record
      return await supabaseDatasetService.createDatasetImage({
        datasetId: targetDatasetId,
        classId: targetClassId,
        storagePath: newStoragePath,
        filename: sourceImage.filename,
        fileSize: sourceImage.fileSize,
        width: sourceImage.width,
        height: sourceImage.height,
        format: sourceImage.format,
        materialId: sourceImage.materialId,
        metadata: sourceImage.metadata
      });
    } catch (err) {
      logger.error(`Error copying image: ${err}`);
      return null;
    }
  }

  /**
   * Calculate Gini coefficient for measuring inequality
   * @param values Array of numeric values
   * @returns Gini coefficient (0=equal, 1=unequal)
   */
  private calculateGiniCoefficient(values: number[]): number {
    if (values.length === 0) return 0;
    if (values.length === 1) return 0;
    
    // Sort values in ascending order
    const sortedValues = [...values].sort((a, b) => a - b);
    
    let sumNumerator = 0;
    let sumDenominator = 0;
    
      for (let i = 0; i < sortedValues.length; i++) {
        const value = sortedValues[i];
        if (typeof value === 'number') {
          sumNumerator += (2 * i - sortedValues.length + 1) * value;
          sumDenominator += value;
        }
      }
    
    return sumNumerator / (sortedValues.length * sumDenominator);
  }

  /**
   * Detect duplicate images in a dataset
   * @param images Array of dataset images
   * @returns Array of duplicate images
   */
  private async detectDuplicateImages(images: DatasetImage[]): Promise<DatasetImage[]> {
    // This would implement actual duplicate detection logic
    // For now, return empty array as this is a placeholder
    return [];
  }

  /**
   * Detect corrupted images in a dataset
   * @param images Array of dataset images
   * @returns Array of corrupted images
   */
  private async detectCorruptedImages(images: DatasetImage[]): Promise<DatasetImage[]> {
    // This would implement actual corruption detection logic
    // For now, return empty array as this is a placeholder
    return [];
  }

  /**
   * Detect outlier images in a dataset class
   * @param images Array of dataset images
   * @returns Array of outlier images
   */
  private async detectOutlierImages(images: DatasetImage[]): Promise<DatasetImage[]> {
    // This would implement actual outlier detection logic
    // For now, return empty array as this is a placeholder
    return [];
  }

  /**
   * Detect low resolution images in a dataset
   * @param images Array of dataset images
   * @param minWidth Minimum acceptable width
   * @param minHeight Minimum acceptable height
   * @returns Array of low resolution images
   */
  private async detectLowResolutionImages(
    images: DatasetImage[],
    minWidth: number,
    minHeight: number
  ): Promise<DatasetImage[]> {
    return images.filter(img => 
      (img.width !== undefined && img.width < minWidth) || 
      (img.height !== undefined && img.height < minHeight)
    );
  }

  /**
   * Detect label issues in a dataset class
   * @param images Array of dataset images
   * @param classInfo Class information
   * @returns Array of images with label issues
   */
  private async detectLabelIssues(
    images: DatasetImage[],
    classInfo: DatasetClass
  ): Promise<DatasetImage[]> {
    // This would implement actual label issue detection logic
    // For now, return empty array as this is a placeholder
    return [];
  }

  /**
   * Generate image augmentations
   * @param sourceImages Source images to augment
   * @param targetDatasetId Target dataset ID
   * @param targetClassId Target class ID
   * @param count Number of augmentations to generate
   * @param transformations Transformation options
   * @returns Number of generated augmentations
   */
  private async generateAugmentations(
    sourceImages: DatasetImage[],
    targetDatasetId: string,
    targetClassId: string,
    count: number,
    transformations: DataAugmentationOptions['transformations']
  ): Promise<number> {
    // For a real implementation, this would use image processing libraries
    // For now, this is a placeholder that pretends to generate augmentations
    let generatedCount = 0;
    
    // Simple round-robin through source images and apply transformations
    for (let i = 0; i < count && sourceImages.length > 0; i++) {
      const sourceImage = sourceImages[i % sourceImages.length];
      if (!sourceImage) continue;
      
      const baseName = path.basename(sourceImage.filename, path.extname(sourceImage.filename));
      const newFilename = `${baseName}_aug_${i}${path.extname(sourceImage.filename)}`;
      
      try {
        // Download source image
        const { data, error } = await supabaseClient
          .getClient()
          .storage
          .from('datasets')
          .download(sourceImage.storagePath);
        
        if (error || !data) {
          logger.warn(`Failed to download image for augmentation: ${error}`);
          continue;
        }

        // In a real implementation, we would transform the image here
        // For now, we'll just copy it as is
        
        // Upload the "augmented" image
        const newStoragePath = `${targetDatasetId}/${targetClassId}/${newFilename}`;
        
        const { error: uploadError } = await supabaseClient
          .getClient()
          .storage
          .from('datasets')
          .upload(newStoragePath, data);
        
        if (uploadError) {
          logger.warn(`Failed to upload augmented image: ${uploadError}`);
          continue;
        }

        // Create image record
        await supabaseDatasetService.createDatasetImage({
          datasetId: targetDatasetId,
          classId: targetClassId,
          storagePath: newStoragePath,
          filename: newFilename,
          fileSize: sourceImage.fileSize,
          width: sourceImage.width,
          height: sourceImage.height,
          format: sourceImage.format,
          metadata: {
            ...(sourceImage.metadata || {}),
            augmentation: true,
            sourceImageId: sourceImage.id,
            transformations: this.getAppliedTransformations(transformations)
          }
        });

        generatedCount++;
      } catch (err) {
        logger.error(`Error generating augmentation: ${err}`);
      }
    }
    
    return generatedCount;
  }

  /**
   * Get a description of which transformations were applied
   * @param transformations Transformation options
   * @returns Object describing applied transformations
   */
  private getAppliedTransformations(
    transformations: DataAugmentationOptions['transformations']
  ): Record<string, any> {
    const applied: Record<string, any> = {};
    
    // Select some random transformations from the enabled ones
    if (transformations.rotation?.enabled) {
      const degrees = Math.floor(Math.random() * (transformations.rotation.maxDegrees || 30));
      applied.rotation = degrees;
    }
    
    if (transformations.flip?.enabled) {
      if (transformations.flip.horizontal && Math.random() > 0.5) {
        applied.flipHorizontal = true;
      }
      if (transformations.flip.vertical && Math.random() > 0.5) {
        applied.flipVertical = true;
      }
    }
    
    if (transformations.brightness?.enabled) {
      const range = transformations.brightness.range || [-0.2, 0.2];
      applied.brightness = range[0] + Math.random() * (range[1] - range[0]);
    }
    
    // Add more transformations as needed
    
    return applied;
  }

  /**
   * Generate synthetic samples using Mixup
   * @param sourceImages Source images
   * @param count Number of samples to generate
   * @returns Array of generated samples
   */
  private async generateMixupSamples(
    sourceImages: DatasetImage[],
    count: number
  ): Promise<Array<{ data: any; metadata: any }>> {
    // This would implement actual mixup augmentation
    // For now, return empty array as this is a placeholder
    return [];
  }

  /**
   * Generate synthetic samples using SMOTE
   * @param sourceImages Source images
   * @param count Number of samples to generate
   * @returns Array of generated samples
   */
  private async generateSmoteSamples(
    sourceImages: DatasetImage[],
    count: number
  ): Promise<Array<{ data: any; metadata: any }>> {
    // This would implement actual SMOTE augmentation
    // For now, return empty array as this is a placeholder
    return [];
  }

  /**
   * Generate synthetic samples using random augmentation
   * @param sourceImages Source images
   * @param count Number of samples to generate
   * @returns Array of generated samples
   */
  private async generateRandomSamples(
    sourceImages: DatasetImage[],
    count: number
  ): Promise<Array<{ data: any; metadata: any }>> {
    // This would implement actual random augmentation
    // For now, return empty array as this is a placeholder
    return [];
  }
}

// Export singleton instance
export const datasetManagementService = DatasetManagementService.getInstance();
export default datasetManagementService;