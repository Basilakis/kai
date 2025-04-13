/**
 * Hugging Face Dataset Service
 * 
 * This service provides dataset management functionality using Hugging Face as the storage backend.
 * It follows a similar interface to the Supabase dataset service for compatibility.
 */

import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger';
import { huggingFaceClient } from './huggingFaceClient';
import * as path from 'path';

// Application model types (mirroring Supabase dataset service)
export interface Dataset {
  id: string;
  name: string;
  description?: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
  status: 'created' | 'processing' | 'ready' | 'error';
  classCount: number;
  imageCount: number;
  hfRepositoryId?: string; // Hugging Face specific
  metadata?: Record<string, any>;
}

export interface DatasetClass {
  id: string;
  datasetId: string;
  name: string;
  description?: string;
  imageCount: number;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface DatasetImage {
  id: string;
  datasetId: string;
  classId: string;
  storagePath: string;
  filename: string;
  fileSize?: number;
  width?: number;
  height?: number;
  format?: string;
  materialId?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// Search options
export interface DatasetSearchOptions {
  query?: string;
  status?: 'created' | 'processing' | 'ready' | 'error' | Array<'created' | 'processing' | 'ready' | 'error'>;
  limit?: number;
  skip?: number;
  sort?: {
    field: string;
    direction: 'asc' | 'desc';
  };
}

// Hugging Face specific metadata structure
interface HFDatasetMetadata {
  dataset: {
    id: string;
    name: string;
    description?: string;
    createdBy?: string;
    createdAt: string;
    updatedAt: string;
    status: string;
    classCount: number;
    imageCount: number;
    metadata?: Record<string, any>;
  };
  classes: Record<string, {
    id: string;
    name: string;
    description?: string;
    imageCount: number;
    metadata?: Record<string, any>;
    createdAt: string;
    updatedAt: string;
  }>;
}

// Dataset class structure used during import
export interface HFDatasetClass {
  name: string;
  description?: string;
  sourceClass: string; // Original identifier in Hugging Face
}

// Image metadata used during import
export interface HFDatasetImage {
  path: string;
  size?: number;
  width?: number;
  height?: number;
  format?: string;
}

/**
 * Hugging Face Dataset Service
 * Provides dataset management functionality using Hugging Face
 */
export class HuggingFaceDatasetService {
  private static instance: HuggingFaceDatasetService;
  private metadataFileName = 'dataset_metadata.json';
  private datasetCache: Map<string, Dataset> = new Map();
  private classCache: Map<string, Map<string, DatasetClass>> = new Map();
  // Use the unified huggingFaceClient
  private client = huggingFaceClient as any;

  private constructor() {
    logger.info('Hugging Face Dataset Service initialized');
  }

  /**
   * Get the singleton instance
   * @returns The HuggingFaceDatasetService instance
   */
  public static getInstance(): HuggingFaceDatasetService {
    if (!HuggingFaceDatasetService.instance) {
      HuggingFaceDatasetService.instance = new HuggingFaceDatasetService();
    }
    return HuggingFaceDatasetService.instance;
  }

  /**
   * Create a new dataset
   * @param datasetData Dataset data
   * @returns Created dataset
   */
  public async createDataset(datasetData: Partial<Dataset>): Promise<Dataset> {
    try {
      // Generate UUID if not provided
      const id = datasetData.id || uuidv4();
      const now = new Date();

      // Create dataset object
      const dataset: Dataset = {
        id,
        name: datasetData.name || `Dataset-${id.substring(0, 8)}`,
        description: datasetData.description,
        createdBy: datasetData.createdBy,
        createdAt: datasetData.createdAt || now,
        updatedAt: now,
        status: datasetData.status || 'created',
        classCount: datasetData.classCount || 0,
        imageCount: datasetData.imageCount || 0,
        metadata: datasetData.metadata || {}
      };

      // Create repository on Hugging Face
      const repoName = `dataset-${id.substring(0, 8)}`;
      const hfRepoId = await this.client.createDatasetRepository({
        name: repoName,
        description: dataset.description || `Dataset: ${dataset.name}`,
        visibility: 'private'
      });

      if (!hfRepoId) {
        throw new Error('Failed to create dataset repository on Hugging Face');
      }

      // Store Hugging Face repository ID
      dataset.hfRepositoryId = hfRepoId;

      // Create metadata structure
      const metadata: HFDatasetMetadata = {
        dataset: {
          id: dataset.id,
          name: dataset.name,
          description: dataset.description,
          createdBy: dataset.createdBy,
          createdAt: dataset.createdAt.toISOString(),
          updatedAt: dataset.updatedAt.toISOString(),
          status: dataset.status,
          classCount: dataset.classCount,
          imageCount: dataset.imageCount,
          metadata: dataset.metadata
        },
        classes: {}
      };

      // Upload metadata to repository
      const success = await this.client.uploadFile(
        hfRepoId,
        this.metadataFileName,
        metadata,
        'Initialize dataset repository'
      );

      if (!success) {
        throw new Error('Failed to upload dataset metadata to Hugging Face');
      }

      // Update cache
      this.datasetCache.set(id, dataset);
      this.classCache.set(id, new Map());

      return dataset;
    } catch (err) {
      logger.error(`Failed to create dataset: ${err}`);
      throw new Error(`Failed to create dataset: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Get a dataset by ID
   * @param id Dataset ID
   * @returns Dataset or null if not found
   */
  public async getDatasetById(id: string): Promise<Dataset | null> {
    try {
      // Check cache first
      if (this.datasetCache.has(id)) {
        return this.datasetCache.get(id) || null;
      }

      // Find dataset by looking up repositories on Hugging Face
      const datasets = await this.searchDatasets({ limit: 100 });
      const dataset = datasets.datasets.find(d => d.id === id);
      
      if (dataset) {
        // Cache and return dataset
        this.datasetCache.set(id, dataset);
        return dataset;
      }

      return null;
    } catch (err) {
      logger.error(`Failed to get dataset: ${err}`);
      throw new Error(`Failed to get dataset: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Get dataset metadata from Hugging Face repository
   * @param hfRepoId Hugging Face repository ID
   * @returns Dataset metadata or null if not found
   */
  private async getDatasetMetadata(hfRepoId: string): Promise<HFDatasetMetadata | null> {
    try {
      const metadataBuffer = await this.client.downloadFile(
        hfRepoId,
        this.metadataFileName
      );

      if (!metadataBuffer) {
        logger.warn(`Metadata file not found in repository ${hfRepoId}`);
        return null;
      }

      const metadata = JSON.parse(metadataBuffer.toString('utf-8')) as HFDatasetMetadata;
      return metadata;
    } catch (err) {
      logger.error(`Failed to get dataset metadata: ${err}`);
      return null;
    }
  }

  /**
   * Update dataset metadata in Hugging Face repository
   * @param hfRepoId Hugging Face repository ID
   * @param metadata Dataset metadata
   * @returns True if successful
   */
  private async updateDatasetMetadata(hfRepoId: string, metadata: HFDatasetMetadata): Promise<boolean> {
    try {
      const success = await this.client.uploadFile(
        hfRepoId,
        this.metadataFileName,
        metadata,
        'Update dataset metadata'
      );

      return success;
    } catch (err) {
      logger.error(`Failed to update dataset metadata: ${err}`);
      return false;
    }
  }

  /**
   * Update a dataset
   * @param id Dataset ID
   * @param updateData Update data
   * @returns Updated dataset or null if not found
   */
  public async updateDataset(id: string, updateData: Partial<Dataset>): Promise<Dataset | null> {
    try {
      // Get existing dataset
      const dataset = await this.getDatasetById(id);
      if (!dataset) {
        return null;
      }

      if (!dataset.hfRepositoryId) {
        throw new Error(`Dataset ${id} has no associated Hugging Face repository`);
      }

      // Get metadata from repository
      const metadata = await this.getDatasetMetadata(dataset.hfRepositoryId);
      if (!metadata) {
        throw new Error(`Failed to get metadata for dataset ${id}`);
      }

      // Update dataset fields
      if (updateData.name) dataset.name = updateData.name;
      if (updateData.description !== undefined) dataset.description = updateData.description;
      if (updateData.status) dataset.status = updateData.status;
      if (updateData.metadata) {
        dataset.metadata = {
          ...dataset.metadata,
          ...updateData.metadata
        };
      }
      
      // Always update updatedAt
      dataset.updatedAt = new Date();

      // Update metadata object
      metadata.dataset = {
        ...metadata.dataset,
        name: dataset.name,
        description: dataset.description,
        updatedAt: dataset.updatedAt.toISOString(),
        status: dataset.status,
        metadata: dataset.metadata
      };

      // Save metadata back to repository
      const success = await this.updateDatasetMetadata(dataset.hfRepositoryId, metadata);
      if (!success) {
        throw new Error(`Failed to update metadata for dataset ${id}`);
      }

      // Update cache
      this.datasetCache.set(id, dataset);

      return dataset;
    } catch (err) {
      logger.error(`Failed to update dataset: ${err}`);
      throw new Error(`Failed to update dataset: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Delete a dataset
   * @param id Dataset ID
   * @returns Deleted dataset or null if not found
   */
  public async deleteDataset(id: string): Promise<Dataset | null> {
    try {
      // Get existing dataset
      const dataset = await this.getDatasetById(id);
      if (!dataset) {
        return null;
      }

      if (!dataset.hfRepositoryId) {
        throw new Error(`Dataset ${id} has no associated Hugging Face repository`);
      }

      // Note: Hugging Face doesn't provide a direct API to delete repositories
      // We would mark it as deprecated or implement actual deletion differently
      // For now, we just mark it as deleted in the metadata

      // Get metadata from repository
      const metadata = await this.getDatasetMetadata(dataset.hfRepositoryId);
      if (!metadata) {
        throw new Error(`Failed to get metadata for dataset ${id}`);
      }

      // Mark dataset as deleted in metadata
      metadata.dataset = {
        ...metadata.dataset,
        status: 'deleted',
        updatedAt: new Date().toISOString(),
        metadata: {
          ...metadata.dataset.metadata,
          deleted: true,
          deletedAt: new Date().toISOString()
        }
      };

      // Save metadata back to repository
      const success = await this.updateDatasetMetadata(dataset.hfRepositoryId, metadata);
      if (!success) {
        throw new Error(`Failed to mark dataset ${id} as deleted`);
      }

      // Update cache and return
      this.datasetCache.delete(id);
      this.classCache.delete(id);
      
      return dataset;
    } catch (err) {
      logger.error(`Failed to delete dataset: ${err}`);
      throw new Error(`Failed to delete dataset: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Search for datasets
   * @param options Search options
   * @returns Array of datasets and total count
   */
  public async searchDatasets(options: DatasetSearchOptions = {}): Promise<{
    datasets: Dataset[];
    total: number;
  }> {
    try {
      const {
        query,
        status,
        limit = 10,
        skip = 0,
        sort = { field: 'createdAt', direction: 'desc' }
      } = options;

      // Get user to find their datasets
      const user = await this.client.getCurrentUser();
      
      // Get datasets from Hugging Face
      const hfResults = await this.client.searchDatasets({
        query: query || '',
        author: user?.id,
        limit: 100, // Get more to allow for filtering
        offset: 0
      });

      // Build dataset objects from search results
      let datasets: Dataset[] = [];

      for (const hfDataset of hfResults.datasets) {
        try {
          // Check if this is one of our datasets by trying to get metadata
          const metadata = await this.getDatasetMetadata(hfDataset.id);
          
          if (metadata && metadata.dataset && metadata.dataset.id) {
            // This is one of our datasets, use metadata
            const dataset: Dataset = {
              id: metadata.dataset.id,
              name: metadata.dataset.name,
              description: metadata.dataset.description,
              createdBy: metadata.dataset.createdBy,
              createdAt: new Date(metadata.dataset.createdAt),
              updatedAt: new Date(metadata.dataset.updatedAt),
              status: metadata.dataset.status as 'created' | 'processing' | 'ready' | 'error',
              classCount: metadata.dataset.classCount,
              imageCount: metadata.dataset.imageCount,
              hfRepositoryId: hfDataset.id,
              metadata: metadata.dataset.metadata
            };

            // If it's marked as deleted, skip it
            if (dataset.metadata?.deleted) {
              continue;
            }

            // Add to cache and results
            this.datasetCache.set(dataset.id, dataset);
            datasets.push(dataset);
          }
        } catch (err) {
          // Skip this dataset if metadata can't be parsed
          logger.warn(`Skipping dataset ${hfDataset.id}: ${err}`);
        }
      }

      // Apply status filtering if needed
      if (status) {
        const statusArray = Array.isArray(status) ? status : [status];
        datasets = datasets.filter(d => statusArray.includes(d.status));
      }

      // Apply sorting
      datasets.sort((a, b) => {
        const fieldA = a[sort.field as keyof Dataset];
        const fieldB = b[sort.field as keyof Dataset];
        
        if (fieldA instanceof Date && fieldB instanceof Date) {
          return sort.direction === 'desc' 
            ? fieldB.getTime() - fieldA.getTime() 
            : fieldA.getTime() - fieldB.getTime();
        }
        
        if (typeof fieldA === 'string' && typeof fieldB === 'string') {
          return sort.direction === 'desc'
            ? fieldB.localeCompare(fieldA)
            : fieldA.localeCompare(fieldB);
        }
        
        if (typeof fieldA === 'number' && typeof fieldB === 'number') {
          return sort.direction === 'desc' ? fieldB - fieldA : fieldA - fieldB;
        }
        
        return 0;
      });

      // Apply pagination
      const paginatedDatasets = datasets.slice(skip, skip + limit);
      
      return {
        datasets: paginatedDatasets,
        total: datasets.length
      };
    } catch (err) {
      logger.error(`Failed to search datasets: ${err}`);
      throw new Error(`Failed to search datasets: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Create a dataset class
   * @param classData Class data
   * @returns Created class
   */
  public async createDatasetClass(classData: Partial<DatasetClass>): Promise<DatasetClass> {
    try {
      if (!classData.datasetId) {
        throw new Error('Dataset ID is required');
      }

      // Get dataset
      const dataset = await this.getDatasetById(classData.datasetId);
      if (!dataset) {
        throw new Error(`Dataset ${classData.datasetId} not found`);
      }

      if (!dataset.hfRepositoryId) {
        throw new Error(`Dataset ${classData.datasetId} has no associated Hugging Face repository`);
      }

      // Generate UUID if not provided
      const id = classData.id || uuidv4();
      const now = new Date();

      // Create class object
      const newClass: DatasetClass = {
        id,
        datasetId: classData.datasetId,
        name: classData.name || `Class-${id.substring(0, 8)}`,
        description: classData.description,
        imageCount: classData.imageCount || 0,
        metadata: classData.metadata || {},
        createdAt: classData.createdAt || now,
        updatedAt: now
      };

      // Get metadata from repository
      const metadata = await this.getDatasetMetadata(dataset.hfRepositoryId);
      if (!metadata) {
        throw new Error(`Failed to get metadata for dataset ${classData.datasetId}`);
      }

      // Add class to metadata
      metadata.classes[id] = {
        id: newClass.id,
        name: newClass.name,
        description: newClass.description,
        imageCount: newClass.imageCount,
        metadata: newClass.metadata,
        createdAt: newClass.createdAt.toISOString(),
        updatedAt: newClass.updatedAt.toISOString()
      };

      // Update dataset class count
      metadata.dataset.classCount += 1;
      metadata.dataset.updatedAt = now.toISOString();

      // Save metadata
      const success = await this.updateDatasetMetadata(dataset.hfRepositoryId, metadata);
      if (!success) {
        throw new Error(`Failed to save class ${id} to dataset ${classData.datasetId}`);
      }

      // Create directory for this class
      await this.client.uploadFile(
        dataset.hfRepositoryId,
        `${id}/.gitkeep`,
        '',
        `Create directory for class ${newClass.name}`
      );

      // Update cache
      if (!this.classCache.has(classData.datasetId)) {
        this.classCache.set(classData.datasetId, new Map());
      }
      this.classCache.get(classData.datasetId)?.set(id, newClass);

      // Update dataset in cache
      dataset.classCount += 1;
      dataset.updatedAt = now;
      this.datasetCache.set(classData.datasetId, dataset);

      return newClass;
    } catch (err) {
      logger.error(`Failed to create dataset class: ${err}`);
      throw new Error(`Failed to create dataset class: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Get classes for a dataset
   * @param datasetId Dataset ID
   * @returns Array of dataset classes
   */
  public async getDatasetClasses(datasetId: string): Promise<DatasetClass[]> {
    try {
      // Get dataset
      const dataset = await this.getDatasetById(datasetId);
      if (!dataset) {
        throw new Error(`Dataset ${datasetId} not found`);
      }

      if (!dataset.hfRepositoryId) {
        throw new Error(`Dataset ${datasetId} has no associated Hugging Face repository`);
      }

      // Get metadata from repository
      const metadata = await this.getDatasetMetadata(dataset.hfRepositoryId);
      if (!metadata) {
        throw new Error(`Failed to get metadata for dataset ${datasetId}`);
      }

      // Transform metadata classes to class objects
      const classes: DatasetClass[] = [];
      
      for (const [id, classData] of Object.entries(metadata.classes)) {
        const cls: DatasetClass = {
          id,
          datasetId,
          name: classData.name,
          description: classData.description,
          imageCount: classData.imageCount,
          metadata: classData.metadata,
          createdAt: new Date(classData.createdAt),
          updatedAt: new Date(classData.updatedAt)
        };
        
        classes.push(cls);
        
        // Update cache
        if (!this.classCache.has(datasetId)) {
          this.classCache.set(datasetId, new Map());
        }
        this.classCache.get(datasetId)?.set(id, cls);
      }

      return classes;
    } catch (err) {
      logger.error(`Failed to get dataset classes: ${err}`);
      throw new Error(`Failed to get dataset classes: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Delete a dataset class
   * @param classId Class ID
   * @returns Deleted class or null if not found
   */
  public async deleteDatasetClass(classId: string): Promise<DatasetClass | null> {
    try {
      // Find the class in cache
      for (const [datasetId, classMap] of this.classCache.entries()) {
        if (classMap.has(classId)) {
          const cls = classMap.get(classId);
          if (cls) {
            return this.deleteDatasetClassById(datasetId, classId);
          }
        }
      }

      // If not in cache, search through datasets
      const datasets = await this.searchDatasets({ limit: 100 });
      
      for (const dataset of datasets.datasets) {
        const classes = await this.getDatasetClasses(dataset.id);
        const cls = classes.find(c => c.id === classId);
        
        if (cls) {
          return this.deleteDatasetClassById(dataset.id, classId);
        }
      }

      return null;
    } catch (err) {
      logger.error(`Failed to delete dataset class: ${err}`);
      throw new Error(`Failed to delete dataset class: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Delete a dataset class by ID
   * @param datasetId Dataset ID
   * @param classId Class ID
   * @returns Deleted class or null if not found
   */
  private async deleteDatasetClassById(datasetId: string, classId: string): Promise<DatasetClass | null> {
    try {
      // Get dataset
      const dataset = await this.getDatasetById(datasetId);
      if (!dataset) {
        throw new Error(`Dataset ${datasetId} not found`);
      }

      if (!dataset.hfRepositoryId) {
        throw new Error(`Dataset ${datasetId} has no associated Hugging Face repository`);
      }

      // Get class from cache or dataset
      let cls: DatasetClass | undefined;
      if (this.classCache.has(datasetId) && this.classCache.get(datasetId)?.has(classId)) {
        cls = this.classCache.get(datasetId)?.get(classId);
      } else {
        const classes = await this.getDatasetClasses(datasetId);
        cls = classes.find(c => c.id === classId);
      }

      if (!cls) {
        return null;
      }

      // Get metadata from repository
      const metadata = await this.getDatasetMetadata(dataset.hfRepositoryId);
      if (!metadata) {
        throw new Error(`Failed to get metadata for dataset ${datasetId}`);
      }

      // Remove class from metadata
      if (metadata.classes[classId]) {
        delete metadata.classes[classId];
      }

      // Update dataset class count and timestamp
      metadata.dataset.classCount = Math.max(0, metadata.dataset.classCount - 1);
      metadata.dataset.updatedAt = new Date().toISOString();

      // Save metadata
      const success = await this.updateDatasetMetadata(dataset.hfRepositoryId, metadata);
      if (!success) {
        throw new Error(`Failed to update metadata after deleting class ${classId}`);
      }

      // Update cache
      if (this.classCache.has(datasetId)) {
        this.classCache.get(datasetId)?.delete(classId);
      }

      // Update dataset in cache
      dataset.classCount = metadata.dataset.classCount;
      dataset.updatedAt = new Date(metadata.dataset.updatedAt);
      this.datasetCache.set(datasetId, dataset);

      return cls;
    } catch (err) {
      logger.error(`Failed to delete dataset class: ${err}`);
      throw new Error(`Failed to delete dataset class: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Create a dataset image
   * @param imageData Image data
   * @returns Created image
   */
  public async createDatasetImage(imageData: Partial<DatasetImage>): Promise<DatasetImage> {
    try {
      if (!imageData.datasetId) {
        throw new Error('Dataset ID is required');
      }

      if (!imageData.classId) {
        throw new Error('Class ID is required');
      }

      if (!imageData.storagePath) {
        throw new Error('Storage path is required');
      }

      // Get dataset
      const dataset = await this.getDatasetById(imageData.datasetId);
      if (!dataset) {
        throw new Error(`Dataset ${imageData.datasetId} not found`);
      }

      if (!dataset.hfRepositoryId) {
        throw new Error(`Dataset ${imageData.datasetId} has no associated Hugging Face repository`);
      }

      // Get class
      let classObj: DatasetClass | undefined;
      if (this.classCache.has(imageData.datasetId) && this.classCache.get(imageData.datasetId)?.has(imageData.classId)) {
        classObj = this.classCache.get(imageData.datasetId)?.get(imageData.classId);
      } else {
        const classes = await this.getDatasetClasses(imageData.datasetId);
        classObj = classes.find(c => c.id === imageData.classId);
      }

      if (!classObj) {
        throw new Error(`Class ${imageData.classId} not found in dataset ${imageData.datasetId}`);
      }

      // Generate UUID if not provided
      const id = imageData.id || uuidv4();
      const now = new Date();

      // If storage path refers to a file, we need to read it and upload to Hugging Face
      // For this implementation, assume storagePath is a local file or Supabase path
      // In a real implementation, we would handle different storage sources

      // Use filename or extract from storage path
      const filename = imageData.filename || path.basename(imageData.storagePath);
      
      // Target path in Hugging Face
      const hfImagePath = `${imageData.classId}/${filename}`;

      // Here, we would need to download the file from storagePath source
      // and upload it to Hugging Face, but for this example, we'll just create a record
      
      // Create image object
      const newImage: DatasetImage = {
        id,
        datasetId: imageData.datasetId,
        classId: imageData.classId,
        storagePath: hfImagePath, // New path in Hugging Face
        filename,
        fileSize: imageData.fileSize,
        width: imageData.width,
        height: imageData.height,
        format: imageData.format,
        materialId: imageData.materialId,
        metadata: imageData.metadata || {},
        createdAt: imageData.createdAt || now,
        updatedAt: now
      };

      // Create image JSON for metadata
      const imageMetadata = {
        id: newImage.id,
        filename: newImage.filename,
        fileSize: newImage.fileSize,
        width: newImage.width,
        height: newImage.height,
        format: newImage.format,
        materialId: newImage.materialId,
        metadata: newImage.metadata,
        createdAt: newImage.createdAt.toISOString(),
        updatedAt: newImage.updatedAt.toISOString()
      };

      // We would upload the image file here in a real implementation
      // await this.client.uploadFile(dataset.hfRepositoryId, hfImagePath, imageFileData);

      // Upload image metadata JSON
      const imageJsonPath = `${imageData.classId}/${id}.json`;
      await this.client.uploadFile(
        dataset.hfRepositoryId,
        imageJsonPath,
        imageMetadata,
        `Add image metadata for ${filename}`
      );

      // Get dataset metadata and update counts
      const metadata = await this.getDatasetMetadata(dataset.hfRepositoryId);
      if (!metadata) {
        throw new Error(`Failed to get metadata for dataset ${imageData.datasetId}`);
      }

      // Update class image count
      if (metadata.classes[imageData.classId]) {
        const classData = metadata.classes[imageData.classId];
        if (classData) {
          classData.imageCount += 1;
          classData.updatedAt = now.toISOString();
        }
      }

      // Update dataset image count and timestamp
      metadata.dataset.imageCount += 1;
      metadata.dataset.updatedAt = now.toISOString();

      // Save metadata
      const success = await this.updateDatasetMetadata(dataset.hfRepositoryId, metadata);
      if (!success) {
        throw new Error(`Failed to update metadata after adding image ${id}`);
      }

      // Update class in cache
      if (classObj) {
        classObj.imageCount += 1;
        classObj.updatedAt = now;
        if (this.classCache.has(imageData.datasetId)) {
          this.classCache.get(imageData.datasetId)?.set(imageData.classId, classObj);
        }
      }

      // Update dataset in cache
      dataset.imageCount += 1;
      dataset.updatedAt = now;
      this.datasetCache.set(imageData.datasetId, dataset);

      return newImage;
    } catch (err) {
      logger.error(`Failed to create dataset image: ${err}`);
      throw new Error(`Failed to create dataset image: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Get images for a dataset class
   * @param classId Class ID
   * @param limit Max number of images to return
   * @param offset Pagination offset
   * @returns Array of dataset images
   */
  public async getDatasetClassImages(classId: string, limit = 100, offset = 0): Promise<DatasetImage[]> {
    try {
      // Find the class in cache
      let datasetId: string | undefined;
      let classObj: DatasetClass | undefined;
      
      for (const [dsId, classMap] of this.classCache.entries()) {
        if (classMap.has(classId)) {
          datasetId = dsId;
          classObj = classMap.get(classId);
          break;
        }
      }

      if (!datasetId || !classObj) {
        // Search through datasets
        const datasets = await this.searchDatasets({ limit: 100 });
        
        for (const dataset of datasets.datasets) {
          const classes = await this.getDatasetClasses(dataset.id);
          const cls = classes.find(c => c.id === classId);
          
          if (cls) {
            datasetId = dataset.id;
            classObj = cls;
            break;
          }
        }
      }

      if (!datasetId || !classObj) {
        throw new Error(`Class ${classId} not found`);
      }

      // Get dataset
      const dataset = await this.getDatasetById(datasetId);
      if (!dataset || !dataset.hfRepositoryId) {
        throw new Error(`Dataset ${datasetId} not found or has no repository`);
      }

      // List files in class directory
      const files = await this.client.listFiles(
        dataset.hfRepositoryId,
        classId
      );

      if (!files) {
        return [];
      }

      // Filter to only JSON metadata files
      const jsonFiles = files.filter((file: { path?: string; size?: number }) => 
        typeof file.path === 'string' && 
        file.path.endsWith('.json') && 
        !file.path.endsWith(this.metadataFileName)
      );

      // Load image metadata
      const images: DatasetImage[] = [];
      
      for (const file of jsonFiles.slice(offset, offset + limit)) {
        try {
          const metadataBuffer = await this.client.downloadFile(
            dataset.hfRepositoryId,
            file.path
          );

          if (metadataBuffer) {
            const imageMetadata = JSON.parse(metadataBuffer.toString('utf-8'));
            
            // Create image object
            const image: DatasetImage = {
              id: imageMetadata.id,
              datasetId,
              classId,
              storagePath: `${classId}/${imageMetadata.filename}`,
              filename: imageMetadata.filename,
              fileSize: imageMetadata.fileSize,
              width: imageMetadata.width,
              height: imageMetadata.height,
              format: imageMetadata.format,
              materialId: imageMetadata.materialId,
              metadata: imageMetadata.metadata,
              createdAt: new Date(imageMetadata.createdAt),
              updatedAt: new Date(imageMetadata.updatedAt)
            };

            images.push(image);
          }
        } catch (err) {
          logger.warn(`Failed to parse image metadata from ${file.path}: ${err}`);
        }
      }

      return images;
    } catch (err) {
      logger.error(`Failed to get dataset class images: ${err}`);
      throw new Error(`Failed to get dataset class images: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Delete a dataset image
   * @param imageId Image ID
   * @returns Deleted image or null if not found
   */
  public async deleteDatasetImage(imageId: string): Promise<DatasetImage | null> {
    try {
      // We need to search through all classes to find the image
      // In a production implementation, we would have a more efficient lookup mechanism
      
      // Search through datasets
      const datasets = await this.searchDatasets({ limit: 100 });
      
      for (const dataset of datasets.datasets) {
        if (!dataset.hfRepositoryId) continue;
        
        const classes = await this.getDatasetClasses(dataset.id);
        
        for (const cls of classes) {
          const images = await this.getDatasetClassImages(cls.id);
          const image = images.find(img => img.id === imageId);
          
          if (image) {
            // Found the image, now delete it
            
            // Delete image file
            // Note: HF doesn't provide a direct API to delete files
            // We'd need to implement this differently in a real application
            
            // Delete metadata file
            const jsonPath = `${cls.id}/${imageId}.json`;
            
            // Here we could use a "dummy" file to mark it as deleted
            await this.client.uploadFile(
              dataset.hfRepositoryId,
              jsonPath,
              { deleted: true, deletedAt: new Date().toISOString() },
              `Mark image ${imageId} as deleted`
            );
            
            // Update metadata counts
            const metadata = await this.getDatasetMetadata(dataset.hfRepositoryId);
            if (metadata) {
              // Update class image count
              if (metadata.classes[cls.id]) {
                const classData = metadata.classes[cls.id];
                if (classData) {
                  classData.imageCount = Math.max(0, classData.imageCount - 1);
                  classData.updatedAt = new Date().toISOString();
                }
              }
              
              // Update dataset image count
              metadata.dataset.imageCount = Math.max(0, metadata.dataset.imageCount - 1);
              metadata.dataset.updatedAt = new Date().toISOString();
              
              // Save metadata
              await this.updateDatasetMetadata(dataset.hfRepositoryId, metadata);
              
              // Update caches
              if (this.classCache.has(dataset.id) && this.classCache.get(dataset.id)?.has(cls.id)) {
                const cachedClass = this.classCache.get(dataset.id)?.get(cls.id);
                if (cachedClass) {
                  cachedClass.imageCount = Math.max(0, cachedClass.imageCount - 1);
                  cachedClass.updatedAt = new Date();
                }
              }
              
              if (this.datasetCache.has(dataset.id)) {
                const cachedDataset = this.datasetCache.get(dataset.id);
                if (cachedDataset) {
                  cachedDataset.imageCount = Math.max(0, cachedDataset.imageCount - 1);
                  cachedDataset.updatedAt = new Date();
                }
              }
            }
            
            return image;
          }
        }
      }
      
      return null;
    } catch (err) {
      logger.error(`Failed to delete dataset image: ${err}`);
      throw new Error(`Failed to delete dataset image: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Get a signed URL for a dataset image
   * @param storagePath Storage path
   * @param expiresIn Expiration time in seconds
   * @returns Signed URL
   */
  public async getSignedImageUrl(storagePath: string, expiresIn = 3600): Promise<string> {
    try {
      // Parse storage path to determine dataset and file path
      const pathParts = storagePath.split('/');
      if (pathParts.length < 2) {
        throw new Error(`Invalid storage path: ${storagePath}`);
      }

      // Search for dataset with matching repository ID
      const datasets = await this.searchDatasets({ limit: 100 });
      
      for (const dataset of datasets.datasets) {
        if (dataset.hfRepositoryId) {
          // Check if file exists in this repository
          const fileExists = await this.client.listFiles(
            dataset.hfRepositoryId,
            storagePath
          );
          
          if (fileExists) {
            // Build URL for the file
            // Note: Hugging Face doesn't provide signed URLs directly
            // We'd construct a URL to the raw file in the repo
            return `https://huggingface.co/datasets/${dataset.hfRepositoryId}/resolve/main/${storagePath}`;
          }
        }
      }

      throw new Error(`File not found: ${storagePath}`);
    } catch (err) {
      logger.error(`Failed to get signed image URL: ${err}`);
      throw new Error(`Failed to get signed image URL: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Import a dataset from Hugging Face
   * @param hfDatasetId Hugging Face dataset ID
   * @param options Import options
   * @returns Imported dataset
   */
  public async importFromHuggingFace(
    hfDatasetId: string,
    options: {
      name?: string;
      description?: string;
      createdBy?: string;
    } = {}
  ): Promise<Dataset> {
    try {
      // Get dataset info from Hugging Face
      const datasetInfo = await this.client.getDatasetInfo(hfDatasetId);
      if (!datasetInfo) {
        throw new Error(`Dataset ${hfDatasetId} not found on Hugging Face`);
      }

      // Create a new dataset
      const dataset = await this.createDataset({
        name: options.name || datasetInfo.name || hfDatasetId,
        description: options.description || datasetInfo.description || `Imported from Hugging Face: ${hfDatasetId}`,
        createdBy: options.createdBy,
        status: 'processing',
        metadata: {
          importedFrom: 'huggingface',
          sourceDatasetId: hfDatasetId,
          importedAt: new Date().toISOString()
        }
      });

      try {
        // Update status to processing
        await this.updateDataset(dataset.id, {
          status: 'processing'
        });
        
        // Retrieve dataset structure
        logger.info(`Retrieving structure of dataset ${hfDatasetId}`);
        const structure = await this.client.getDatasetStructure(hfDatasetId);
        
        if (!structure) {
          throw new Error(`Failed to retrieve structure for dataset ${hfDatasetId}`);
        }
        
        // Process the dataset structure to identify classes
        // Class structure could be based on directories, metadata, or dataset splits
        const classes = await this.extractClassesFromStructure(structure, hfDatasetId);
        
        // Create classes in our dataset
        const createdClasses = new Map<string, DatasetClass>();
        let importedImageCount = 0;
        
        for (const cls of classes) {
          logger.info(`Creating class ${cls.name} in dataset ${dataset.id}`);
          const createdClass = await this.createDatasetClass({
            datasetId: dataset.id,
            name: cls.name,
            description: cls.description,
            metadata: {
              sourceClass: cls.sourceClass,
              importedFrom: 'huggingface'
            }
          });
          
          createdClasses.set(cls.sourceClass, createdClass);
        }
        
        // Import images for each class
        for (const [sourceClass, createdClass] of createdClasses.entries()) {
          // Get images for this class from Hugging Face
          logger.info(`Importing images for class ${createdClass.name} from ${sourceClass}`);
          
          const classImages = await this.getImagesForClass(hfDatasetId, sourceClass);
          logger.info(`Found ${classImages.length} images for class ${createdClass.name}`);
          
          // Process each image
          for (const img of classImages) {
            try {
              // Download image from Hugging Face
              const imageBuffer = await this.client.downloadFile(
                hfDatasetId,
                img.path
              );
              
              if (!imageBuffer) {
                logger.warn(`Failed to download image: ${img.path}`);
                continue;
              }
              
              // Upload image to our dataset
              await this.createDatasetImage({
                datasetId: dataset.id,
                classId: createdClass.id,
                storagePath: img.path,
                filename: path.basename(img.path),
                fileSize: img.size,
                format: this.getImageFormat(img.path),
                metadata: {
                  sourcePath: img.path,
                  importedFrom: 'huggingface'
                }
              });
              
              importedImageCount++;
              
              // Update progress periodically
              if (importedImageCount % 10 === 0) {
                await this.updateDataset(dataset.id, {
                  metadata: {
                    ...dataset.metadata,
                    importProgress: {
                      classesProcessed: createdClasses.size,
                      totalClasses: classes.length,
                      imagesImported: importedImageCount
                    }
                  }
                });
              }
            } catch (imgErr) {
              logger.error(`Error importing image ${img.path}: ${imgErr}`);
              // Continue with other images
            }
          }
        }
        
        // Update dataset with final stats
        logger.info(`Import completed with ${createdClasses.size} classes and ${importedImageCount} images`);
        await this.updateDataset(dataset.id, {
          status: 'ready',
          metadata: {
            ...dataset.metadata,
            importDetails: {
              completedAt: new Date().toISOString(),
              classCount: createdClasses.size,
              imageCount: importedImageCount
            }
          }
        });
      } catch (importErr) {
        logger.error(`Error during import process: ${importErr}`);
        
        // Mark dataset as error state
        await this.updateDataset(dataset.id, {
          status: 'error',
          metadata: {
            ...dataset.metadata,
            importError: importErr instanceof Error ? importErr.message : String(importErr)
          }
        });
        
        throw importErr;
      }

      return dataset;
    } catch (err) {
      logger.error(`Failed to import dataset from Hugging Face: ${err}`);
      throw new Error(`Failed to import dataset from Hugging Face: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Extract class information from dataset structure
   * @param structure Dataset structure from Hugging Face
   * @param hfDatasetId Hugging Face dataset ID
   * @returns Array of dataset classes
   */
  private async extractClassesFromStructure(
    structure: any,
    hfDatasetId: string
  ): Promise<HFDatasetClass[]> {
    try {
      logger.info(`Extracting classes from dataset structure for ${hfDatasetId}`);
      
      const classes: HFDatasetClass[] = [];
      
      // Check if structure has splits (common in HF datasets)
      if (structure.splits && Object.keys(structure.splits).length > 0) {
        // Use splits as classes (e.g., train, test, validation)
        for (const splitName of Object.keys(structure.splits)) {
          classes.push({
            name: splitName,
            description: `Split "${splitName}" from Hugging Face dataset`,
            sourceClass: splitName
          });
        }
        
        logger.info(`Found ${classes.length} classes based on splits`);
        return classes;
      }
      
      // Check if structure has a directory-based organization
      if (structure.files && Array.isArray(structure.files)) {
        // Look for directories that might represent classes
        const directories = structure.files
          .filter((file: any) => file.type === 'directory')
          .map((dir: any) => dir.path)
          .filter((path: string) => !path.startsWith('.') && path !== '__pycache__');
        
        if (directories.length > 0) {
          // Use directories as classes
          for (const dirPath of directories) {
            const dirName = dirPath.split('/').pop() || dirPath;
            classes.push({
              name: dirName,
              description: `Class "${dirName}" from Hugging Face dataset directory structure`,
              sourceClass: dirPath
            });
          }
          
          logger.info(`Found ${classes.length} classes based on directory structure`);
          return classes;
        }
      }
      
      // Check if structure has metadata with labels
      if (structure.metadata && structure.metadata.labels) {
        // Use labels as classes
        const labels = Array.isArray(structure.metadata.labels) 
          ? structure.metadata.labels 
          : Object.keys(structure.metadata.labels);
        
        for (const label of labels) {
          classes.push({
            name: label,
            description: `Class "${label}" from Hugging Face dataset metadata`,
            sourceClass: label
          });
        }
        
        logger.info(`Found ${classes.length} classes based on metadata labels`);
        return classes;
      }
      
      // Fallback: If no class structure is detected, create a single default class
      if (classes.length === 0) {
        classes.push({
          name: 'default',
          description: 'Default class for imported Hugging Face dataset',
          sourceClass: 'default'
        });
        
        logger.info('No class structure detected, using default class');
      }
      
      return classes;
    } catch (err) {
      logger.error(`Error extracting classes from structure: ${err}`);
      // Return a single default class as fallback
      return [{
        name: 'default',
        description: 'Default class for imported Hugging Face dataset',
        sourceClass: 'default'
      }];
    }
  }

  /**
   * Get images for a specific class in a Hugging Face dataset
   * @param hfDatasetId Hugging Face dataset ID
   * @param sourceClass Source class identifier
   * @returns Array of image metadata
   */
  private async getImagesForClass(
    hfDatasetId: string,
    sourceClass: string
  ): Promise<HFDatasetImage[]> {
    try {
      logger.info(`Getting images for class ${sourceClass} in dataset ${hfDatasetId}`);
      
      const images: HFDatasetImage[] = [];
      
      // Different strategies based on sourceClass format
      if (sourceClass === 'default') {
        // For default class, get all images in the dataset
        const files = await this.client.listFiles(hfDatasetId, '');
        
        if (files && Array.isArray(files)) {
          // Filter for image files
          const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff'];
          const imageFiles = files.filter((file: any) => {
            if (typeof file.path !== 'string') return false;
            const extension = file.path.toLowerCase().substring(file.path.lastIndexOf('.'));
            return imageExtensions.includes(extension);
          });
          
          for (const file of imageFiles) {
            images.push({
              path: file.path,
              size: file.size
            });
          }
        }
      } else if (sourceClass.includes('/')) {
        // If sourceClass is a directory path
        const files = await this.client.listFiles(hfDatasetId, sourceClass);
        
        if (files && Array.isArray(files)) {
          // Filter for image files
          const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff'];
          const imageFiles = files.filter((file: any) => {
            if (typeof file.path !== 'string') return false;
            const extension = file.path.toLowerCase().substring(file.path.lastIndexOf('.'));
            return imageExtensions.includes(extension);
          });
          
          for (const file of imageFiles) {
            images.push({
              path: file.path,
              size: file.size
            });
          }
        }
      } else {
        // If sourceClass is a label or split name
        try {
          // For datasets with splits structure
          const splitData = await this.client.getDatasetSplit(hfDatasetId, sourceClass);
          
          if (splitData && splitData.features && splitData.features.image) {
            // Dataset has image column in its features
            const sampleCount = Math.min(splitData.num_rows || 0, 100); // Limit to 100 samples
            
            for (let i = 0; i < sampleCount; i++) {
              try {
                const sample = await this.client.getDatasetRow(hfDatasetId, sourceClass, i);
                
                if (sample && sample.image) {
                  // Create a virtual path for this image
                  const path = `${sourceClass}/image_${i}.jpg`;
                  
                  // Download the image to get its size
                  const imageBuffer = await this.client.downloadRow(
                    hfDatasetId, 
                    sourceClass, 
                    i, 
                    'image'
                  );
                  
                  images.push({
                    path,
                    size: imageBuffer ? imageBuffer.length : undefined
                  });
                }
              } catch (sampleErr) {
                logger.warn(`Error getting sample ${i} from split ${sourceClass}: ${sampleErr}`);
                continue;
              }
            }
          }
        } catch (splitErr) {
          logger.warn(`Error getting split data for ${sourceClass}: ${splitErr}`);
          // Try alternative approach for label-based datasets
        }
      }
      
      logger.info(`Found ${images.length} images for class ${sourceClass}`);
      return images;
    } catch (err) {
      logger.error(`Error getting images for class ${sourceClass}: ${err}`);
      return [];
    }
  }

  /**
   * Determine image format from file path
   * @param filePath File path
   * @returns Image format string
   */
  private getImageFormat(filePath: string): string {
    try {
      const extension = filePath.toLowerCase().substring(filePath.lastIndexOf('.') + 1);
      
      switch (extension) {
        case 'jpg':
        case 'jpeg':
          return 'jpeg';
        case 'png':
          return 'png';
        case 'gif':
          return 'gif';
        case 'webp':
          return 'webp';
        case 'bmp':
          return 'bmp';
        case 'tiff':
        case 'tif':
          return 'tiff';
        default:
          return extension || 'unknown';
      }
    } catch (err) {
      logger.warn(`Could not determine image format for ${filePath}: ${err}`);
      return 'unknown';
    }
  }
}

// Export singleton instance
export const huggingFaceDatasetService = HuggingFaceDatasetService.getInstance();
export default huggingFaceDatasetService;