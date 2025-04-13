/**
 * Type declarations for Hugging Face client extensions
 */

import { HuggingFaceClient } from './huggingFaceClient';

// Extend the HuggingFaceClient interface with additional methods
declare module './huggingFaceClient' {
  interface HuggingFaceClient {
    // Dataset structure methods
    getDatasetStructure(datasetId: string): Promise<any | null>;
    getDatasetSplit(datasetId: string, splitName: string): Promise<any | null>;
    getDatasetRow(datasetId: string, splitName: string, rowIndex: number): Promise<any | null>;
    downloadRow(datasetId: string, splitName: string, rowIndex: number, field?: string): Promise<Buffer | null>;
    
    // Additional dataset methods
    getDatasetConfig(datasetId: string): Promise<any | null>;
    getDatasetSamples(datasetId: string, filters?: Record<string, any>, limit?: number): Promise<any[] | null>;
    getDatasetSampleImage(datasetId: string, imagePath: string): Promise<Buffer | null>;
  }
}