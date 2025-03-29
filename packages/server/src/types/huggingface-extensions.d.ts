/**
 * Type declarations for Hugging Face client extensions
 */

// Extend the HuggingFaceClient interface to include our added methods
import { HuggingFaceClient } from '../services/huggingface/huggingFaceClient';

declare module '../services/huggingface/huggingFaceClient' {
  interface HuggingFaceClient {
    /**
     * Get detailed dataset configuration
     */
    getDatasetConfig(datasetId: string): Promise<any | null>;

    /**
     * Get samples from a dataset with optional filtering
     */
    getDatasetSamples(
      datasetId: string, 
      filters?: Record<string, any>,
      limit?: number
    ): Promise<any[] | null>;

    /**
     * Get a sample image from a dataset
     */
    getDatasetSampleImage(
      datasetId: string,
      imagePath: string
    ): Promise<Buffer | null>;

    /**
     * Get the structure of a dataset
     */
    getDatasetStructure(
      datasetId: string
    ): Promise<any | null>;
  }
}

// Make this a module
export {};