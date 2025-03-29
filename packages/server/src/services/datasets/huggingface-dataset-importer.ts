/// <reference path="../../types/globals.d.ts" />
/// <reference path="../../types/node-extensions.d.ts" />
/// <reference path="../../types/huggingface-extensions.d.ts" />

/**
 * Hugging Face Dataset Importer
 * 
 * A flexible importer for Hugging Face datasets with configurable field mapping.
 * Supports automatic recognition of common dataset structures and material types.
 */

import { logger } from '../../utils/logger';
import huggingFaceClient from '../huggingface/huggingFaceClientExtension';
import { datasetManagementService } from './dataset-management.service';
import DatasetFieldMapper, { FieldMapping } from './dataset-field-mapper';
import supabaseDatasetService, { Dataset, DatasetClass } from '../supabase/supabase-dataset-service';
import { supabaseClient } from '../supabase/supabaseClient';
import * as path from 'path';
import * as fs from 'fs';
import { promisify } from 'util';
import * as os from 'os';

// Import options for Hugging Face datasets
export interface HuggingFaceImportOptions {
  datasetId: string;  // Hugging Face dataset ID (e.g., "mcimpoi/minc-2500_split_1")
  name?: string;      // Custom name for the dataset
  description?: string; 
  createdBy?: string;
  materialType?: string; // Default material type for unknown types
  fieldMappings?: FieldMapping[]; // Custom field mappings
  categoryMappings?: Record<string, string>; // Map dataset categories to our material types
  includeMetadata?: boolean; // Whether to include metadata from the dataset
  selectedClasses?: string[]; // Specific classes to import (if empty, import all)
  maxImagesPerClass?: number; // Limit images per class (for large datasets)
  tempDir?: string; // Temporary directory for downloaded files
}

// Structure of a material category mapping
interface MaterialCategoryMapping {
  datasetCategory: string;   // Original category name in the dataset (e.g., "leather")
  materialType: string;      // Our system's material type (e.g., "fabric", "wood")
  description?: string;      // Description of this material category
  defaultFieldMappings?: FieldMapping[]; // Default field mappings for this category
}

// Dataset structure definition to support different dataset formats
interface DatasetStructureDefinition {
  id: string;                // Dataset identifier (e.g., "minc-2500")
  name: string;              // Human-readable name for this dataset format
  description: string;       // Description of this dataset format
  detectPattern: RegExp;     // Pattern to recognize this dataset format
  categoryPath?: string;     // Path to category field in sample data
  imagePath?: string;        // Path to image data in sample data
  defaultMappings: MaterialCategoryMapping[]; // Default category mappings
  structureDetector: (structure: any) => boolean; // Function to detect this structure
}

/**
 * Hugging Face Dataset Importer
 * 
 * Handles importing datasets from Hugging Face with field mapping
 */
export class HuggingFaceDatasetImporter {
  private static instance: HuggingFaceDatasetImporter;
  
  // Known dataset structure definitions
  private datasetStructures: DatasetStructureDefinition[] = [
    {
      id: 'minc-2500',
      name: 'Materials in Context (MINC-2500)',
      description: 'Materials categorization dataset with 2,500 images across 10 categories',
      detectPattern: /minc-2500/i,
      categoryPath: 'category',
      imagePath: 'image_path',
      defaultMappings: [
        { datasetCategory: 'fabric', materialType: 'fabric', description: 'Fabric materials' },
        { datasetCategory: 'leather', materialType: 'fabric', description: 'Leather materials' },
        { datasetCategory: 'wood', materialType: 'wood', description: 'Wood materials' },
        { datasetCategory: 'metal', materialType: 'metal', description: 'Metal materials' },
        { datasetCategory: 'paper', materialType: 'paper', description: 'Paper materials' },
        { datasetCategory: 'stone', materialType: 'stone', description: 'Stone materials' },
        { datasetCategory: 'plastic', materialType: 'plastic', description: 'Plastic materials' },
        { datasetCategory: 'glass', materialType: 'glass', description: 'Glass materials' },
        { datasetCategory: 'water', materialType: 'other', description: 'Water surfaces' },
        { datasetCategory: 'foliage', materialType: 'other', description: 'Foliage and plants' }
      ],
      structureDetector: (structure) => {
        return structure?.directories?.some((dir: string) => 
          ['fabric', 'leather', 'wood', 'metal', 'paper'].includes(dir)
        ) || false;
      }
    },
    {
      id: 'dtd',
      name: 'Describable Textures Dataset',
      description: 'Texture classification dataset with 47 categories',
      detectPattern: /dtd|describable-textures/i,
      categoryPath: 'texture',
      imagePath: 'image',
      defaultMappings: [
        { datasetCategory: 'banded', materialType: 'fabric', description: 'Banded texture' },
        { datasetCategory: 'braided', materialType: 'fabric', description: 'Braided texture' },
        { datasetCategory: 'bubbly', materialType: 'other', description: 'Bubbly texture' },
        { datasetCategory: 'bumpy', materialType: 'other', description: 'Bumpy texture' },
        { datasetCategory: 'marbled', materialType: 'stone', description: 'Marbled texture' },
        { datasetCategory: 'metallic', materialType: 'metal', description: 'Metallic texture' },
        { datasetCategory: 'knitted', materialType: 'fabric', description: 'Knitted texture' },
        { datasetCategory: 'woven', materialType: 'fabric', description: 'Woven texture' },
        { datasetCategory: 'wrinkled', materialType: 'fabric', description: 'Wrinkled texture' },
        { datasetCategory: 'wood', materialType: 'wood', description: 'Wood texture' }
      ],
      structureDetector: (structure) => {
        return structure?.directories?.some((dir: string) => 
          ['braided', 'knitted', 'woven', 'marbled'].includes(dir)
        ) || false;
      }
    }
  ];
  
  // Material category mappings generated from dataset structures
  private materialCategoryMappings: Record<string, MaterialCategoryMapping[]> = {};
  
  private constructor() {
    logger.info('Hugging Face Dataset Importer initialized');
    
    // Initialize material category mappings from dataset structures
    this.datasetStructures.forEach(structure => {
      this.materialCategoryMappings[structure.id] = structure.defaultMappings;
    });
  }

  /**
   * Get the singleton instance
   * @returns The HuggingFaceDatasetImporter instance
   */
  public static getInstance(): HuggingFaceDatasetImporter {
    if (!HuggingFaceDatasetImporter.instance) {
      HuggingFaceDatasetImporter.instance = new HuggingFaceDatasetImporter();
    }
    return HuggingFaceDatasetImporter.instance;
  }

  /**
   * Import a dataset from Hugging Face
   * @param options Import options
   * @returns Imported dataset
   */
  public async importDataset(options: HuggingFaceImportOptions): Promise<Dataset> {
    try {
      logger.info(`Importing dataset ${options.datasetId} from Hugging Face`);

      // Get dataset info from Hugging Face
      const datasetInfo = await huggingFaceClient.getDatasetInfo(options.datasetId);
      if (!datasetInfo) {
        throw new Error(`Dataset ${options.datasetId} not found on Hugging Face`);
      }

      // Create a new dataset in our system
      const dataset = await supabaseDatasetService.createDataset({
        name: options.name || datasetInfo.name || options.datasetId,
        description: options.description || datasetInfo.description || `Imported from Hugging Face: ${options.datasetId}`,
        createdBy: options.createdBy,
        status: 'processing',
        metadata: {
          importedFrom: 'huggingface',
          sourceDatasetId: options.datasetId,
          importedAt: new Date().toISOString(),
          huggingfaceInfo: datasetInfo
        }
      });

      // Detect dataset structure
      const datasetStructure = await this.detectDatasetStructure(options.datasetId);
      logger.info(`Detected dataset structure: ${datasetStructure ? datasetStructure.name : 'Unknown'}`);
      
      // Process the dataset based on detected structure or generic approach
      if (datasetStructure) {
        await this.processStructuredDataset(dataset, options, datasetStructure);
      } else {
        // Generic processing for unknown dataset structure
        await this.processGenericDataset(dataset, options);
      }

      // Mark dataset as ready
      await supabaseDatasetService.updateDataset(dataset.id, {
        status: 'ready'
      });

      return dataset;
    } catch (err) {
      logger.error(`Failed to import dataset from Hugging Face: ${err}`);
      throw new Error(`Failed to import dataset from Hugging Face: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Detect the structure of a Hugging Face dataset
   * @param datasetId Hugging Face dataset ID
   * @returns Detected dataset structure or null if unknown
   */
  private async detectDatasetStructure(datasetId: string): Promise<DatasetStructureDefinition | null> {
    try {
      // First try to match by ID pattern
      const matchByPattern = this.datasetStructures.find(structure => 
        structure.detectPattern.test(datasetId)
      );
      
      if (matchByPattern) {
        return matchByPattern;
      }
      
      // If no match by ID, try to analyze the structure
      const structure = await huggingFaceClient.getDatasetStructure(datasetId);
      
      if (!structure) {
        return null;
      }
      
      // Try to detect using structure detectors
      for (const detector of this.datasetStructures) {
        if (detector.structureDetector(structure)) {
          return detector;
        }
      }
      
      return null;
    } catch (err) {
      logger.warn(`Error detecting dataset structure: ${err}`);
      return null;
    }
  }

  /**
   * Process a dataset with known structure
   * @param dataset Created dataset
   * @param options Import options
   * @param structure Detected dataset structure
   */
  private async processStructuredDataset(
    dataset: Dataset, 
    options: HuggingFaceImportOptions, 
    structure: DatasetStructureDefinition
  ): Promise<void> {
    logger.info(`Processing ${structure.name} dataset for ${dataset.id}`);

    try {
      // Create temporary directory for downloads
      const tempDir = options.tempDir || path.join(os.tmpdir(), `huggingface-import-${Date.now()}`);
      await promisify(fs.mkdir)(tempDir, { recursive: true } as fs.MakeDirectoryOptions);

      // Download dataset details from Hugging Face
      const config = await huggingFaceClient.getDatasetConfig(options.datasetId);
      
      if (!config) {
        throw new Error('Failed to get dataset configuration');
      }

      // Get category mappings from options, structure default mappings, or empty object
      const categoryMappings = options.categoryMappings || 
        (structure.defaultMappings.reduce((acc, mapping) => {
          acc[mapping.datasetCategory] = mapping.materialType;
          return acc;
        }, {} as Record<string, string>) || {});

      // Get available categories from the dataset
      let categories = Object.keys(categoryMappings);
      
      // Filter categories if specific classes are requested
      if (options.selectedClasses && options.selectedClasses.length > 0) {
        categories = categories.filter(cat => options.selectedClasses!.includes(cat));
      }

      // Process each material category
      for (const category of categories) {
        // Get material type for this category
        const materialType = categoryMappings[category] || options.materialType || 'other';
        
        // Create field mapper for this material type
        const fieldMapper = new DatasetFieldMapper(materialType);
        
        // Create class in our dataset
        const classData: DatasetClass = await supabaseDatasetService.createDatasetClass({
          datasetId: dataset.id,
          name: category,
          description: `Imported from ${structure.name}: ${category}`,
          metadata: {
            sourceCategory: category,
            materialType: materialType,
            datasetId: options.datasetId
          }
        });

        // Make API request to get samples for this category
        const samples = await huggingFaceClient.getDatasetSamples(
          options.datasetId, 
          { category: category }, 
          options.maxImagesPerClass || 500
        );

        if (!samples || samples.length === 0) {
          logger.warn(`No samples found for category ${category}`);
          continue;
        }

        logger.info(`Processing ${samples.length} samples for category ${category}`);
        
        // Process each sample
        for (const sample of samples) {
          try {
            // Download image
            const imagePath = sample.image_path || sample.path || sample.image || '';
            const imageBuffer = await huggingFaceClient.getDatasetSampleImage(
              options.datasetId, 
              imagePath
            );
            
            if (!imageBuffer) {
              logger.warn(`Failed to download image: ${imagePath}`);
              continue;
            }

            // Generate filename
            const filename = path.basename(imagePath);
            const storagePath = `${dataset.id}/${classData.id}/${filename}`;
            
            // Upload to storage
            const { error } = await supabaseClient
              .getClient()
              .storage
              .from('datasets')
              .upload(storagePath, imageBuffer);
            
            if (error) {
              logger.warn(`Failed to upload image to ${storagePath}: ${error}`);
              continue;
            }

            // Apply field mappings to create metadata
            const metadata = options.includeMetadata 
              ? fieldMapper.applyMappings(sample)
              : {};

            // Create image record
            await supabaseDatasetService.createDatasetImage({
              datasetId: dataset.id,
              classId: classData.id,
              storagePath,
              filename,
              metadata: {
                ...metadata,
                sourceDataset: options.datasetId,
                sourceCategory: category,
                materialType
              }
            });
          } catch (err) {
            logger.error(`Error processing sample: ${err}`);
            // Continue with next sample
          }
        }

        logger.info(`Completed processing for category ${category}`);
      }

      // Clean up temporary directory
      try {
        // For compatibility with older Node.js versions that don't have fs.rm
        const rimraf = require('rimraf');
        await promisify(rimraf)(tempDir);
      } catch (cleanupErr) {
        logger.warn(`Failed to clean up temp directory: ${cleanupErr}`);
        // Falling back to fs.rmdir (recursive option might not be available in all versions)
        await promisify(fs.rmdir)(tempDir);
      }

    } catch (err) {
      logger.error(`Error processing structured dataset: ${err}`);
      throw err;
    }
  }

  /**
   * Process a generic dataset with unknown structure
   * @param dataset Created dataset
   * @param options Import options
   */
  private async processGenericDataset(dataset: Dataset, options: HuggingFaceImportOptions): Promise<void> {
    logger.info(`Processing dataset ${options.datasetId} with generic handling for ${dataset.id}`);

    try {
      // Get dataset structure - this is a simplified implementation
      // In a full implementation, we would analyze the dataset structure more thoroughly
      const structure = await huggingFaceClient.getDatasetStructure(options.datasetId);
      
      if (!structure) {
        throw new Error('Failed to get dataset structure');
      }

      // Analyze dataset samples to identify potential categories
      const samples = await huggingFaceClient.getDatasetSamples(
        options.datasetId,
        {},
        Math.min(options.maxImagesPerClass || 1000, 100) // Get a sample to analyze structure
      );
      
      if (!samples || samples.length === 0) {
        logger.warn(`No samples found for dataset ${options.datasetId}`);
        throw new Error(`Unable to retrieve samples from dataset ${options.datasetId}`);
      }
      
      // Attempt to automatically detect categories in the dataset
      const categoriesMap = this.detectCategoriesFromSamples(samples);
      logger.info(`Detected ${Object.keys(categoriesMap).length} potential categories in dataset`);
      
      // Create classes for each detected category
      for (const [category, images] of Object.entries(categoriesMap)) {
        // Skip if no images for this category
        if (images.length === 0) continue;
        
        // Create class
        const classData = await supabaseDatasetService.createDatasetClass({
          datasetId: dataset.id,
          name: category,
          description: `Auto-detected from ${options.datasetId}`,
          metadata: {
            sourceDataset: options.datasetId,
            autoDetected: true,
            sampleCount: images.length
          }
        });
        
        logger.info(`Created class for category '${category}' with ${images.length} samples`);
        
        // Process images in this category (limit per class)
        const imagesToProcess = images.slice(0, options.maxImagesPerClass || 100);
        await this.processImagesForClass(dataset, classData, imagesToProcess, options);
      }
    } catch (err) {
      logger.error(`Error processing generic dataset: ${err}`);
      throw err;
    }
  }

  /**
   * Detect categories from dataset samples
   * @param samples Array of samples from the dataset
   * @returns Map of categories to arrays of sample images
   */
  private detectCategoriesFromSamples(samples: any[]): Record<string, any[]> {
    const categoriesMap: Record<string, any[]> = {};
    const categoryFields = ['category', 'label', 'class', 'type', 'material', 'texture'];
    
    for (const sample of samples) {
      let category = 'default';
      
      // Try to detect category from common fields
      for (const field of categoryFields) {
        if (sample[field]) {
          category = String(sample[field]);
          break;
        }
      }
      
      // Try to detect from path (common in image datasets)
      if (category === 'default' && (sample.path || sample.image_path)) {
        const path = sample.path || sample.image_path;
        const pathParts = path.split('/');
        if (pathParts.length > 1) {
          // Often the parent directory indicates the category
          category = pathParts[0];
        }
      }
      
      // Add to category map
      if (!categoriesMap[category]) {
        categoriesMap[category] = [];
      }
      
      // Using non-null assertion since we just checked and initialized above
      categoriesMap[category]!.push(sample);
    }
    
    return categoriesMap;
  }
  
  /**
   * Process images for a specific class
   */
  private async processImagesForClass(
    dataset: Dataset, 
    classData: DatasetClass, 
    samples: any[], 
    options: HuggingFaceImportOptions
  ): Promise<void> {
    // Create field mapper
    const fieldMapper = new DatasetFieldMapper(options.materialType || 'other');
    
    // Process samples
    for (const sample of samples) {
      try {
        // Check if sample has an image
        if (!sample.image && !sample.image_path && !sample.path) {
          logger.warn('Sample does not contain an image path');
          continue;
        }

        // Get image path
        const imagePath = sample.image_path || sample.path || sample.image || '';
        
        // Download image
        const imageBuffer = await huggingFaceClient.getDatasetSampleImage(
          options.datasetId, 
          imagePath
        );
        
        if (!imageBuffer) {
          logger.warn(`Failed to download image: ${imagePath}`);
          continue;
        }

        // Generate filename
        const filename = path.basename(imagePath);
        const storagePath = `${dataset.id}/${classData.id}/${filename}`;
        
        // Upload to storage
        const { error } = await supabaseClient
          .getClient()
          .storage
          .from('datasets')
          .upload(storagePath, imageBuffer);
        
        if (error) {
          logger.warn(`Failed to upload image to ${storagePath}: ${error}`);
          continue;
        }

        // Apply field mappings to create metadata
        const metadata = options.includeMetadata 
          ? fieldMapper.applyMappings(sample)
          : {};

        // Create image record
        await supabaseDatasetService.createDatasetImage({
          datasetId: dataset.id,
          classId: classData.id,
          storagePath,
          filename,
          metadata: {
            ...metadata,
            sourceDataset: options.datasetId,
            originalCategory: classData.name
          }
        });
      } catch (err) {
        logger.error(`Error processing sample: ${err}`);
        // Continue with next sample
      }
    }
  }

  /**
   * Get all supported dataset structures
   * @returns Array of supported dataset structure definitions
   */
  public getSupportedDatasetStructures(): DatasetStructureDefinition[] {
    return this.datasetStructures;
  }
  
  /**
   * Get predefined material category mappings for a dataset
   * @param datasetId Hugging Face dataset ID or structure ID
   * @returns Material category mappings or empty array if not found
   */
  public getMaterialCategoryMappings(datasetId: string): MaterialCategoryMapping[] {
    // Try to match by ID
    if (this.materialCategoryMappings[datasetId]) {
      return this.materialCategoryMappings[datasetId];
    }
    
    // Try to match by pattern
    for (const structure of this.datasetStructures) {
      if (structure.detectPattern.test(datasetId)) {
        return structure.defaultMappings;
      }
    }
    
    return [];
  }

  /**
   * Check if a dataset is supported with specialized handling
   * @param datasetId Hugging Face dataset ID
   * @returns Whether the dataset has specialized handling
   */
  public async isKnownDataset(datasetId: string): Promise<boolean> {
    // Check direct match
    if (Object.keys(this.materialCategoryMappings).includes(datasetId)) {
      return true;
    }
    
    // Check pattern match
    for (const structure of this.datasetStructures) {
      if (structure.detectPattern.test(datasetId)) {
        return true;
      }
    }
    
    // Try to detect structure
    const structure = await this.detectDatasetStructure(datasetId);
    return structure !== null;
  }
}

// Export singleton instance
export const huggingFaceDatasetImporter = HuggingFaceDatasetImporter.getInstance();
export default huggingFaceDatasetImporter;