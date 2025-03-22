/**
 * Dataset Service Factory
 * 
 * This factory provides a unified interface for working with datasets,
 * abstracting away the specific storage provider (Supabase or Hugging Face).
 */

import { logger } from '../../utils/logger';
import supabaseDatasetService, { 
  Dataset, 
  DatasetClass, 
  DatasetImage, 
  DatasetSearchOptions 
} from '../supabase/supabase-dataset-service';
import huggingFaceDatasetService from '../huggingface/huggingFaceDatasetService';

// Dataset provider type
export enum DatasetProvider {
  SUPABASE = 'supabase',
  HUGGINGFACE = 'huggingface'
}

// Dataset Service interface
export interface DatasetService {
  // Dataset operations
  createDataset(datasetData: Partial<Dataset>): Promise<Dataset>;
  getDatasetById(id: string): Promise<Dataset | null>;
  updateDataset(id: string, updateData: Partial<Dataset>): Promise<Dataset | null>;
  deleteDataset(id: string): Promise<Dataset | null>;
  searchDatasets(options?: DatasetSearchOptions): Promise<{
    datasets: Dataset[];
    total: number;
  }>;

  // Class operations
  createDatasetClass(classData: Partial<DatasetClass>): Promise<DatasetClass>;
  getDatasetClasses(datasetId: string): Promise<DatasetClass[]>;
  deleteDatasetClass(classId: string): Promise<DatasetClass | null>;

  // Image operations
  createDatasetImage(imageData: Partial<DatasetImage>): Promise<DatasetImage>;
  getDatasetClassImages(classId: string, limit?: number, offset?: number): Promise<DatasetImage[]>;
  deleteDatasetImage(imageId: string): Promise<DatasetImage | null>;
  getSignedImageUrl(storagePath: string, expiresIn?: number): Promise<string>;

  // Provider-specific operations
  importFromHuggingFace?(hfDatasetId: string, options?: any): Promise<Dataset>;
}

/**
 * Dataset Service Factory
 * Creates and provides the appropriate dataset service based on the requested provider
 */
class DatasetServiceFactory {
  private static instance: DatasetServiceFactory;
  private defaultProvider: DatasetProvider = DatasetProvider.SUPABASE;

  private constructor() {
    // Try to get default provider from environment variable
    const envProvider = process.env.DEFAULT_DATASET_PROVIDER?.toLowerCase();
    if (envProvider === 'huggingface') {
      this.defaultProvider = DatasetProvider.HUGGINGFACE;
      logger.info('Using Hugging Face as default dataset provider');
    } else {
      logger.info('Using Supabase as default dataset provider');
    }
  }

  /**
   * Get singleton instance
   * @returns The DatasetServiceFactory instance
   */
  public static getInstance(): DatasetServiceFactory {
    if (!DatasetServiceFactory.instance) {
      DatasetServiceFactory.instance = new DatasetServiceFactory();
    }
    return DatasetServiceFactory.instance;
  }

  /**
   * Set the default dataset provider
   * @param provider The provider to set as default
   */
  public setDefaultProvider(provider: DatasetProvider): void {
    this.defaultProvider = provider;
    logger.info(`Default dataset provider set to ${provider}`);
  }

  /**
   * Get the default dataset provider
   * @returns The current default provider
   */
  public getDefaultProvider(): DatasetProvider {
    return this.defaultProvider;
  }

  /**
   * Get a dataset service for the specified provider
   * @param provider (Optional) The dataset provider to use
   * @returns The appropriate dataset service
   */
  public getService(provider?: DatasetProvider): DatasetService {
    const selectedProvider = provider || this.defaultProvider;

    switch (selectedProvider) {
      case DatasetProvider.HUGGINGFACE:
        return huggingFaceDatasetService;
      case DatasetProvider.SUPABASE:
      default:
        return supabaseDatasetService;
    }
  }

  /**
   * Get a provider-specific dataset service instance
   * @param datasetId Dataset ID
   * @returns The appropriate dataset service for this dataset
   */
  public async getServiceForDataset(datasetId: string): Promise<DatasetService> {
    try {
      // First check with Supabase
      const supabaseDataset = await supabaseDatasetService.getDatasetById(datasetId);
      
      if (supabaseDataset) {
        return supabaseDatasetService;
      }
      
      // If not found in Supabase, check Hugging Face
      const hfDataset = await huggingFaceDatasetService.getDatasetById(datasetId);
      
      if (hfDataset) {
        return huggingFaceDatasetService;
      }
      
      // If not found anywhere, return default provider
      return this.getService();
    } catch (err) {
      logger.warn(`Error determining provider for dataset ${datasetId}: ${err}`);
      return this.getService();
    }
  }
}

// Export factory instance
export const datasetServiceFactory = DatasetServiceFactory.getInstance();
export default datasetServiceFactory;