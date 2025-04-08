/**
 * Recognition Service
 * 
 * Provides API methods for material recognition and similar material search
 */
import axios from 'axios';

// Base API URL - should be configured from environment
const API_BASE_URL = process.env.GATSBY_API_URL || 'http://localhost:8000/api';

export interface RecognitionOptions {
  modelType?: 'hybrid' | 'feature-based' | 'ml-based';
  confidenceThreshold?: number;
  maxResults?: number;
  useFusion?: boolean;
  fusionMethod?: 'weighted' | 'adaptive' | 'max' | 'product';
  fusionAlpha?: number;
}

export interface MaterialSpecs {
  material: string;
  size: string;
  color: string;
  finish: string;
  [key: string]: string; // Allow additional properties
}

export interface RecognitionResult {
  id: string;
  name: string;
  manufacturer: string;
  confidence: number;
  image: string;
  specs: MaterialSpecs;
}

export interface SimilaritySearchOptions {
  limit?: number;
  threshold?: number;
  materialType?: string;
}

export interface VectorSearchOptions {
  indexPath?: string;
  numResults?: number;
  threshold?: number;
}

/**
 * Upload an image and identify the material
 * 
 * @param image The image file to upload
 * @param options Recognition options
 * @returns Promise with recognition results
 */
export const identifyMaterial = async (
  image: File, 
  options: RecognitionOptions = {}
): Promise<RecognitionResult[]> => {
  try {
    const formData = new FormData();
    formData.append('image', image);
    
    // Add options to form data
    if (options.modelType) formData.append('modelType', options.modelType);
    if (options.confidenceThreshold !== undefined) formData.append('confidenceThreshold', options.confidenceThreshold.toString());
    if (options.maxResults !== undefined) formData.append('maxResults', options.maxResults.toString());
    if (options.useFusion !== undefined) formData.append('useFusion', options.useFusion.toString());
    if (options.fusionMethod) formData.append('fusionMethod', options.fusionMethod);
    if (options.fusionAlpha !== undefined) formData.append('fusionAlpha', options.fusionAlpha.toString());
    
    const response = await axios.post(`${API_BASE_URL}/recognition/identify`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response.data.data;
  } catch (error) {
    console.error('Error identifying material:', error);
    throw error;
  }
};

/**
 * Find materials similar to an uploaded image
 * 
 * @param image The image file to upload
 * @param options Similarity search options
 * @returns Promise with similar materials
 */
export const findSimilarMaterials = async (
  image: File,
  options: SimilaritySearchOptions = {}
): Promise<RecognitionResult[]> => {
  try {
    const formData = new FormData();
    formData.append('image', image);
    
    // Add options to form data
    if (options.limit !== undefined) formData.append('limit', options.limit.toString());
    if (options.threshold !== undefined) formData.append('threshold', options.threshold.toString());
    if (options.materialType) formData.append('materialType', options.materialType);
    
    const response = await axios.post(`${API_BASE_URL}/recognition/similar-image`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response.data.data;
  } catch (error) {
    console.error('Error finding similar materials:', error);
    throw error;
  }
};

/**
 * Perform vector search for similar materials
 * 
 * @param image The image file to upload
 * @param options Vector search options
 * @returns Promise with vector search results
 */
export const performVectorSearch = async (
  image: File,
  options: VectorSearchOptions = {}
): Promise<{
  query: string;
  results: RecognitionResult[];
  searchTime: number;
  totalTime: number;
}> => {
  try {
    const formData = new FormData();
    formData.append('image', image);
    
    // Add options to form data
    if (options.indexPath) formData.append('indexPath', options.indexPath);
    if (options.numResults !== undefined) formData.append('numResults', options.numResults.toString());
    if (options.threshold !== undefined) formData.append('threshold', options.threshold.toString());
    
    const response = await axios.post(`${API_BASE_URL}/recognition/vector-search`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return {
      query: response.data.query,
      results: response.data.results,
      searchTime: response.data.searchTime,
      totalTime: response.data.totalTime
    };
  } catch (error) {
    console.error('Error performing vector search:', error);
    throw error;
  }
};

/**
 * Create a visualization of search results
 * 
 * @param image The image file to upload
 * @param numResults Number of results to include in visualization
 * @returns Promise with visualization Blob URL
 */
export const createVisualization = async (
  image: File,
  numResults: number = 5
): Promise<string> => {
  try {
    const formData = new FormData();
    formData.append('image', image);
    formData.append('numResults', numResults.toString());
    
    // Use type assertion to handle axios config with responseType
    const config: any = {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      responseType: 'blob'
    };
    
    const response = await axios.post(`${API_BASE_URL}/recognition/visualize`, formData, config);
    
    // Create a blob URL for the visualization image
    const blob = new Blob([response.data], { type: 'image/jpeg' });
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error('Error creating visualization:', error);
    throw error;
  }
};

/**
 * Identify materials from multiple images in batch
 * 
 * @param images Array of image files to upload
 * @param options Recognition options
 * @returns Promise with batch results
 */
export const identifyMaterialsBatch = async (
  images: File[],
  options: RecognitionOptions = {}
): Promise<{
  processed: number;
  failed: number;
  results: Array<{
    originalName: string;
    fileName: string;
    result: RecognitionResult[];
  }>;
  errors: Array<{
    originalName: string;
    fileName: string;
    error: string;
  }>;
}> => {
  try {
    if (!images.length) {
      throw new Error('No images provided for batch processing');
    }
    
    const formData = new FormData();
    
    // Add all images to form data
    images.forEach(image => {
      formData.append('images', image);
    });
    
    // Add options to form data
    if (options.modelType) formData.append('modelType', options.modelType);
    if (options.confidenceThreshold !== undefined) formData.append('confidenceThreshold', options.confidenceThreshold.toString());
    if (options.maxResults !== undefined) formData.append('maxResults', options.maxResults.toString());
    if (options.useFusion !== undefined) formData.append('useFusion', options.useFusion.toString());
    if (options.fusionMethod) formData.append('fusionMethod', options.fusionMethod);
    if (options.fusionAlpha !== undefined) formData.append('fusionAlpha', options.fusionAlpha.toString());
    
    const response = await axios.post(`${API_BASE_URL}/recognition/batch`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return {
      processed: response.data.processed,
      failed: response.data.failed,
      results: response.data.results,
      errors: response.data.errors
    };
  } catch (error) {
    console.error('Error in batch identification:', error);
    throw error;
  }
};

// Export default object with all methods
export default {
  identifyMaterial,
  findSimilarMaterials,
  performVectorSearch,
  createVisualization,
  identifyMaterialsBatch
};