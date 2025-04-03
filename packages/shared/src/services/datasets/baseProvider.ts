import { logger } from '../../utils/logger';
import {
  Dataset,
  DatasetClass,
  DatasetImage,
  DatasetSearchOptions,
  DatasetError,
  DatasetProvider,
  DatasetStats
} from './types';

/**
 * Abstract base class for dataset providers
 */
export abstract class BaseDatasetProvider implements DatasetProvider {
  protected readonly logger = logger;

  protected constructor() {
    logger.info(`${this.constructor.name} initialized`);
  }

  /**
   * Create a new dataset
   */
  public async createDataset(data: Partial<Dataset>): Promise<Dataset> {
    try {
      this.validateDatasetData(data);
      return await this.createDatasetImpl(data);
    } catch (error) {
      logger.error('Failed to create dataset', { error, data });
      throw this.wrapError(error, 'Failed to create dataset');
    }
  }

  /**
   * Get a dataset by ID
   */
  public async getDatasetById(id: string): Promise<Dataset | null> {
    try {
      this.validateId(id);
      return await this.getDatasetImpl(id);
    } catch (error) {
      logger.error('Failed to get dataset', { error, id });
      throw this.wrapError(error, 'Failed to get dataset');
    }
  }

  /**
   * Update a dataset
   */
  public async updateDataset(id: string, data: Partial<Dataset>): Promise<Dataset | null> {
    try {
      this.validateId(id);
      this.validateDatasetData(data);
      return await this.updateDatasetImpl(id, data);
    } catch (error) {
      logger.error('Failed to update dataset', { error, id, data });
      throw this.wrapError(error, 'Failed to update dataset');
    }
  }

  /**
   * Delete a dataset
   */
  public async deleteDataset(id: string): Promise<Dataset | null> {
    try {
      this.validateId(id);
      const dataset = await this.getDatasetImpl(id);
      if (!dataset) {
        return null;
      }
      await this.deleteDatasetImpl(id);
      return dataset;
    } catch (error) {
      logger.error('Failed to delete dataset', { error, id });
      throw this.wrapError(error, 'Failed to delete dataset');
    }
  }

  /**
   * Search datasets
   */
  public async searchDatasets(options: DatasetSearchOptions = {}): Promise<{
    datasets: Dataset[];
    total: number;
  }> {
    try {
      this.validateSearchOptions(options);
      return await this.searchDatasetsImpl(options);
    } catch (error) {
      logger.error('Failed to search datasets', { error, options });
      throw this.wrapError(error, 'Failed to search datasets');
    }
  }

  /**
   * Create a dataset class
   */
  public async createDatasetClass(data: Partial<DatasetClass>): Promise<DatasetClass> {
    try {
      const { datasetId, ...classData } = data;
      if (!datasetId) {
        throw new DatasetError('Dataset ID is required', 'INVALID_DATA');
      }
      this.validateId(datasetId);
      this.validateClassData(classData);
      return await this.createClassImpl(datasetId, classData);
    } catch (error) {
      logger.error('Failed to create dataset class', { error, data });
      throw this.wrapError(error, 'Failed to create dataset class');
    }
  }

  /**
   * Get classes for a dataset
   */
  public async getDatasetClasses(datasetId: string): Promise<DatasetClass[]> {
    try {
      this.validateId(datasetId);
      return await this.getClassesImpl(datasetId);
    } catch (error) {
      logger.error('Failed to get dataset classes', { error, datasetId });
      throw this.wrapError(error, 'Failed to get dataset classes');
    }
  }

  /**
   * Delete a dataset class
   */
  public async deleteDatasetClass(classId: string): Promise<DatasetClass | null> {
    try {
      this.validateId(classId);
      const classes = await this.getClassesImpl(classId);
      if (!classes || !classes.length) {
        return null;
      }
      await this.deleteClassImpl(classId);
      return classes[0] || null;
    } catch (error) {
      logger.error('Failed to delete dataset class', { error, classId });
      throw this.wrapError(error, 'Failed to delete dataset class');
    }
  }

  /**
   * Create a dataset image
   */
  public async createDatasetImage(data: Partial<DatasetImage>): Promise<DatasetImage> {
    try {
      const { classId, file, metadata } = data;
      if (!classId || !file) {
        throw new DatasetError('Class ID and file are required', 'INVALID_DATA');
      }
      this.validateId(classId);
      this.validateFile(file);
      return await this.addImageImpl(classId, file, metadata);
    } catch (error) {
      logger.error('Failed to add dataset image', { error, data });
      throw this.wrapError(error, 'Failed to add dataset image');
    }
  }

  /**
   * Get images for a dataset class
   */
  public async getDatasetClassImages(classId: string, limit = 100, offset = 0): Promise<DatasetImage[]> {
    try {
      this.validateId(classId);
      this.validatePagination(limit, offset);
      return await this.getImagesImpl(classId, limit, offset);
    } catch (error) {
      logger.error('Failed to get dataset images', { error, classId });
      throw this.wrapError(error, 'Failed to get dataset images');
    }
  }

  /**
   * Delete a dataset image
   */
  public async deleteDatasetImage(imageId: string): Promise<DatasetImage | null> {
    try {
      this.validateId(imageId);
      const images = await this.getImagesImpl(imageId, 1, 0);
      if (!images || !images.length) {
        return null;
      }
      await this.deleteImageImpl(imageId);
      return images[0] || null;
    } catch (error) {
      logger.error('Failed to delete dataset image', { error, imageId });
      throw this.wrapError(error, 'Failed to delete dataset image');
    }
  }

  /**
   * Get a signed URL for a dataset image
   */
  public abstract getSignedImageUrl(storagePath: string, expiresIn?: number): Promise<string>;

  /**
   * Get dataset statistics
   */
  public abstract getDatasetStats(): Promise<DatasetStats>;

  // Abstract methods that must be implemented by providers

  protected abstract createDatasetImpl(data: Partial<Dataset>): Promise<Dataset>;
  protected abstract getDatasetImpl(id: string): Promise<Dataset | null>;
  protected abstract updateDatasetImpl(id: string, data: Partial<Dataset>): Promise<Dataset>;
  protected abstract deleteDatasetImpl(id: string): Promise<void>;
  protected abstract searchDatasetsImpl(options: DatasetSearchOptions): Promise<{
    datasets: Dataset[];
    total: number;
  }>;
  protected abstract createClassImpl(datasetId: string, data: Partial<DatasetClass>): Promise<DatasetClass>;
  protected abstract getClassesImpl(datasetId: string): Promise<DatasetClass[]>;
  protected abstract deleteClassImpl(classId: string): Promise<void>;
  protected abstract addImageImpl(
    classId: string,
    file: File | Blob,
    metadata?: Record<string, any>
  ): Promise<DatasetImage>;
  protected abstract getImagesImpl(classId: string, limit: number, offset: number): Promise<DatasetImage[]>;
  protected abstract deleteImageImpl(imageId: string): Promise<void>;

  // Helper methods for validation and error handling

  protected validateId(id: string): void {
    if (!id || typeof id !== 'string') {
      throw new DatasetError('Invalid ID', 'INVALID_DATA');
    }
  }

  protected validateDatasetData(data: Partial<Dataset>): void {
    if (!data || typeof data !== 'object') {
      throw new DatasetError('Invalid dataset data', 'INVALID_DATA');
    }

    if (data.name && typeof data.name !== 'string') {
      throw new DatasetError('Invalid dataset name', 'INVALID_DATA');
    }

    if (data.description && typeof data.description !== 'string') {
      throw new DatasetError('Invalid dataset description', 'INVALID_DATA');
    }

    if (data.status && !['created', 'processing', 'ready', 'error'].includes(data.status)) {
      throw new DatasetError('Invalid dataset status', 'INVALID_DATA');
    }
  }

  protected validateClassData(data: Partial<DatasetClass>): void {
    if (!data || typeof data !== 'object') {
      throw new DatasetError('Invalid class data', 'INVALID_DATA');
    }

    if (data.name && typeof data.name !== 'string') {
      throw new DatasetError('Invalid class name', 'INVALID_DATA');
    }

    if (data.description && typeof data.description !== 'string') {
      throw new DatasetError('Invalid class description', 'INVALID_DATA');
    }
  }

  protected validateFile(file: File | Blob): void {
    if (!file || !(file instanceof Blob)) {
      throw new DatasetError('Invalid file', 'INVALID_DATA');
    }
  }

  protected validateSearchOptions(options: DatasetSearchOptions): void {
    if (options.limit !== undefined && (typeof options.limit !== 'number' || options.limit < 0)) {
      throw new DatasetError('Invalid limit', 'INVALID_DATA');
    }

    if (options.offset !== undefined && (typeof options.offset !== 'number' || options.offset < 0)) {
      throw new DatasetError('Invalid offset', 'INVALID_DATA');
    }

    if (options.sort) {
      if (typeof options.sort.field !== 'string') {
        throw new DatasetError('Invalid sort field', 'INVALID_DATA');
      }
      if (!['asc', 'desc'].includes(options.sort.direction)) {
        throw new DatasetError('Invalid sort direction', 'INVALID_DATA');
      }
    }
  }

  protected validatePagination(limit: number, offset: number): void {
    if (typeof limit !== 'number' || limit < 0) {
      throw new DatasetError('Invalid limit', 'INVALID_DATA');
    }

    if (typeof offset !== 'number' || offset < 0) {
      throw new DatasetError('Invalid offset', 'INVALID_DATA');
    }
  }

  protected wrapError(error: unknown, message: string): DatasetError {
    if (error instanceof DatasetError) {
      return error;
    }
    return new DatasetError(
      `${message}: ${error instanceof Error ? error.message : String(error)}`,
      'UNKNOWN',
      error instanceof Error ? error : undefined
    );
  }
}