/**
 * ZIP Extractor Service
 * 
 * This service extracts and processes ZIP files containing dataset images.
 * It supports extracting class-organized files, validates them, 
 * and uploads them to the dataset storage structure.
 * It can also generate vector embeddings for extracted images for knowledge base and training.
 */

import * as fs from 'fs';
import * as path from 'path';
// Type declaration for os module
declare module 'os' {
  function tmpdir(): string;
  // Add other os functions as needed
}
import * as os from 'os';

// Type declaration for unzipper module
declare module 'unzipper' {
  export function Parse(): NodeJS.ReadWriteStream;
  export namespace Open {
    function file(path: string): Promise<Directory>;
  }
  export interface Directory {
    files: Array<{ path: string; type: string; buffer(): Promise<Buffer> }>;
    extract(options: { path: string }): Promise<void>;
  }
}
import * as unzipper from 'unzipper';

import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger';
import { Dataset, DatasetClass, DatasetImage } from '../supabase/supabase-dataset-service';
import supabaseDatasetService from '../supabase/supabase-dataset-service';
import { supabaseClient } from '../supabase/supabaseClient';
import { vectorSearch } from '../supabase/vector-search';
import axios from 'axios';

// Type declaration for form-data module
declare module 'form-data' {
  class FormData {
    append(key: string, value: any, options?: any): void;
    getHeaders(): Record<string, string>;
    getBoundary(): string;
    getBuffer(): Buffer;
  }
  export = FormData;
}
import FormData from 'form-data';

// Supported image formats
const SUPPORTED_FORMATS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

// Configuration constants
const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'http://localhost:8000';
const USE_MCP_SERVER = process.env.USE_MCP_SERVER === 'true';
const EMBEDDING_DIMENSIONS = 256; // Default embedding dimension size
const EMBEDDING_METHOD = 'hybrid'; // 'feature-based', 'ml-based', or 'hybrid'
const GENERATE_EMBEDDINGS = process.env.GENERATE_EMBEDDINGS !== 'false'; // Default to true

// Class directory metadata file name
const CLASS_METADATA_FILE = 'class.json';

interface ExtractedClass {
  name: string;
  path: string;
  images: Array<{
    filename: string;
    fullPath: string;
  }>;
  metadata?: Record<string, any>;
}

export interface ZipExtractionResult {
  success: boolean;
  dataset: Dataset | null;
  classCount: number;
  imageCount: number;
  errors: string[];
  embeddingsGenerated?: number;
}

export class ZipExtractorService {
  private static instance: ZipExtractorService;
  private generateEmbeddings: boolean;

  private constructor() {
    this.generateEmbeddings = GENERATE_EMBEDDINGS;
    logger.info(`ZIP Extractor Service initialized (embeddings: ${this.generateEmbeddings ? 'enabled' : 'disabled'})`);
  }

  /**
   * Get the singleton instance
   * @returns The ZipExtractorService instance
   */
  public static getInstance(): ZipExtractorService {
    if (!ZipExtractorService.instance) {
      ZipExtractorService.instance = new ZipExtractorService();
    }
    return ZipExtractorService.instance;
  }

  /**
   * Set whether to generate embeddings during extraction
   * @param enabled Whether to enable embedding generation
   */
  public setEmbeddingGeneration(enabled: boolean): void {
    this.generateEmbeddings = enabled;
    logger.info(`Embedding generation ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Process a ZIP file into a dataset
   * @param zipFilePath Path to the uploaded ZIP file
   * @param datasetName Name for the dataset (default: from ZIP filename)
   * @param description Optional description for the dataset
   * @param userId User ID who created the dataset
   * @param generateEmbeddings Whether to generate embeddings (overrides instance setting)
   * @returns Extraction result
   */
  public async processZipFile(
    zipFilePath: string, 
    datasetName?: string,
    description?: string,
    userId?: string,
    generateEmbeddings?: boolean
  ): Promise<ZipExtractionResult> {
    // Initialize result
    const result: ZipExtractionResult = {
      success: false,
      dataset: null,
      classCount: 0,
      imageCount: 0,
      errors: [],
      embeddingsGenerated: 0
    };

    // Determine whether to generate embeddings for this extraction
    const useEmbeddings = generateEmbeddings !== undefined ? generateEmbeddings : this.generateEmbeddings;
    
    // Create a temporary directory for extraction
    const extractDir = path.join(os.tmpdir(), `dataset-${uuidv4()}`);
    try {
      // Create extraction directory
      fs.mkdirSync(extractDir, { recursive: true });

      // Extract ZIP file
      logger.info(`Extracting ZIP file ${zipFilePath} to ${extractDir}`);
      await fs.createReadStream(zipFilePath)
        .pipe(unzipper.Extract({ path: extractDir }))
        .promise();

      // Determine dataset name if not provided
      if (!datasetName) {
        datasetName = path.basename(zipFilePath, '.zip');
      }

      // Create the dataset
      const dataset = await supabaseDatasetService.createDataset({
        name: datasetName,
        description,
        createdBy: userId,
        status: 'processing'
      });

      result.dataset = dataset;

      // Process the extracted files
      const classes = await this.scanForClasses(extractDir);
      
      // If no classes found, try to process as a flat directory of images
      if (classes.length === 0) {
        result.errors.push('No class directories found. Looking for images at root level.');
        const rootImages = await this.scanForImages(extractDir);
        
        if (rootImages.length > 0) {
          // Create a default class
          const defaultClass = await supabaseDatasetService.createDatasetClass({
            datasetId: dataset.id,
            name: 'default'
          });
          
          // Process all images into the default class
          const processResult = await this.processImagesIntoClass(
            rootImages, 
            defaultClass, 
            dataset.id,
            useEmbeddings
          );
          
          result.classCount = 1;
          result.imageCount = processResult.processedCount;
          
          // Track embeddings if they were generated
          if (useEmbeddings) {
            result.embeddingsGenerated = processResult.embeddingsGenerated;
          }
        } else {
          result.errors.push('No images found in the ZIP file.');
        }
      } else {
        let totalEmbeddingsGenerated = 0;
        
        // Process each class
        for (const classData of classes) {
          // Create the class
          const datasetClass = await supabaseDatasetService.createDatasetClass({
            datasetId: dataset.id,
            name: classData.name,
            metadata: classData.metadata
          });
          
          // Process images for this class
          const processResult = await this.processImagesIntoClass(
            classData.images, 
            datasetClass, 
            dataset.id,
            useEmbeddings
          );
          
          result.imageCount += processResult.processedCount;
          
          // Track embeddings if they were generated
          if (useEmbeddings) {
            totalEmbeddingsGenerated += processResult.embeddingsGenerated;
          }
        }
        
        result.classCount = classes.length;
        
        if (useEmbeddings) {
          result.embeddingsGenerated = totalEmbeddingsGenerated;
        }
      }

      // Update dataset status to 'ready'
      await supabaseDatasetService.updateDataset(dataset.id, {
        status: 'ready'
      });

      result.success = true;
    } catch (err) {
      logger.error(`Failed to process ZIP file: ${err}`);
      result.errors.push(`Failed to process ZIP file: ${err instanceof Error ? err.message : String(err)}`);
      
      // If dataset was created, mark it as error
      if (result.dataset) {
        await supabaseDatasetService.updateDataset(result.dataset.id, {
          status: 'error'
        });
      }
    } finally {
      // Clean up the temporary directory
      try {
        fs.rmSync(extractDir, { recursive: true, force: true });
      } catch (cleanupError) {
        logger.warn(`Failed to clean up temporary directory: ${cleanupError}`);
      }
    }

    return result;
  }

  /**
   * Scan the extracted directory for class directories
   * @param extractDir Extraction directory
   * @returns Array of extracted classes
   */
  private async scanForClasses(extractDir: string): Promise<ExtractedClass[]> {
    const classes: ExtractedClass[] = [];
    
    // Read the root directory entries
    const entries = fs.readdirSync(extractDir, { withFileTypes: true });
    
    // Look for directories - each directory represents a class
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const classPath = path.join(extractDir, entry.name);
        
        // Check for metadata file
        let metadata: Record<string, any> | undefined;
        const metadataPath = path.join(classPath, CLASS_METADATA_FILE);
        
        if (fs.existsSync(metadataPath)) {
          try {
            const metadataContent = fs.readFileSync(metadataPath, 'utf8');
            metadata = JSON.parse(metadataContent);
          } catch (err) {
            logger.warn(`Failed to parse class metadata file ${metadataPath}: ${err}`);
          }
        }
        
        // Scan for images in this class
        const images = await this.scanForImages(classPath);
        
        classes.push({
          name: entry.name,
          path: classPath,
          images,
          metadata
        });
      }
    }
    
    return classes;
  }

  /**
   * Scan a directory for images
   * @param directory Directory to scan
   * @returns Array of image information
   */
  private async scanForImages(directory: string): Promise<Array<{ filename: string; fullPath: string }>> {
    const images: Array<{ filename: string; fullPath: string }> = [];
    
    // Read the directory entries
    const entries = fs.readdirSync(directory, { withFileTypes: true });
    
    // Look for image files
    for (const entry of entries) {
      if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        
        if (SUPPORTED_FORMATS.includes(ext)) {
          images.push({
            filename: entry.name,
            fullPath: path.join(directory, entry.name)
          });
        }
      }
    }
    
    return images;
  }

  /**
   * Process images into a class
   * @param images Array of image information
   * @param datasetClass Dataset class
   * @param datasetId Dataset ID
   * @param generateEmbeddings Whether to generate embeddings for images
   * @returns Processed counts and embedding info
   */
  private async processImagesIntoClass(
    images: Array<{ filename: string; fullPath: string }>,
    datasetClass: DatasetClass,
    datasetId: string,
    generateEmbeddings: boolean = false
  ): Promise<{ processedCount: number; embeddingsGenerated: number }> {
    let processedCount = 0;
    let embeddingsGenerated = 0;
    
    for (const image of images) {
      try {
        // Read the image file
        const fileBuffer = fs.readFileSync(image.fullPath);
        
        // Determine storage path: datasets/{datasetId}/{classId}/{filename}
        const storagePath = `${datasetId}/${datasetClass.id}/${image.filename}`;
        
        // Upload file to Supabase storage
        const { error } = await supabaseClient
          .getClient()
          .storage
          .from('datasets')
          .upload(storagePath, fileBuffer, {
            contentType: this.getContentType(path.extname(image.filename))
          });
        
        if (error) {
          logger.error(`Failed to upload image ${image.filename}: ${error}`);
          continue;
        }
        
        // Create image entry in the database (with or without embedding)
        const datasetImage = await supabaseDatasetService.createDatasetImage({
          datasetId,
          classId: datasetClass.id,
          storagePath,
          filename: image.filename
        });
        
        // Generate and store vector embedding if enabled
        if (generateEmbeddings) {
          try {
            // Generate embedding
            const embedding = await this.generateEmbedding(image.fullPath);
            
            if (embedding && embedding.vector) {
              // Store embedding in vector_embeddings table
              const success = await this.storeEmbedding(embedding.vector, datasetImage.id);
              if (success) {
                embeddingsGenerated++;
              }
            }
          } catch (embeddingError) {
            logger.error(`Failed to generate embedding for ${image.filename}: ${embeddingError}`);
          }
        }
        
        processedCount++;
      } catch (err) {
        logger.error(`Failed to process image ${image.filename}: ${err}`);
      }
    }
    
    return { processedCount, embeddingsGenerated };
  }

  /**
   * Generate vector embedding for an image
   * @param imagePath Path to the image file
   * @returns Vector embedding and metadata
   */
  private async generateEmbedding(imagePath: string): Promise<{ vector: number[]; dimensions: number }> {
    try {
      if (USE_MCP_SERVER) {
        // Use MCP server for embedding generation
        return await this.generateEmbeddingWithMCP(imagePath);
      } else {
        // Use direct embedding generation (future implementation)
        // For now, use a placeholder embedding
        logger.warn('Direct embedding generation not implemented, using placeholder');
        return {
          vector: new Array(EMBEDDING_DIMENSIONS).fill(0).map(() => Math.random()),
          dimensions: EMBEDDING_DIMENSIONS
        };
      }
    } catch (error) {
      logger.error(`Error generating embedding: ${error}`);
      throw error;
    }
  }

  /**
   * Generate vector embedding using MCP server
   * @param imagePath Path to the image file
   * @returns Vector embedding and metadata
   */
  private async generateEmbeddingWithMCP(imagePath: string): Promise<{ vector: number[]; dimensions: number }> {
    try {
      // Create form data with image
      const formData = new FormData();
      formData.append('image', fs.createReadStream(imagePath));
      
      // Set options for embedding generation
      const options = {
        model_type: EMBEDDING_METHOD,
        include_features: true
      };
      formData.append('options', JSON.stringify(options));
      
      // Send request to MCP server
      const response = await axios.post(`${MCP_SERVER_URL}/api/v1/embeddings`, formData, {
        headers: {
          ...formData.getHeaders(),
        },
      });
      
      // Extract embedding from response
      const result = response.data;
      
      return {
        vector: result.vector,
        dimensions: result.dimensions || result.vector.length
      };
    } catch (error) {
      logger.error(`Error generating embedding with MCP: ${error}`);
      throw error;
    }
  }

  /**
   * Store embedding in vector_embeddings table
   * @param vector Embedding vector
   * @param datasetImageId Dataset image ID
   * @returns Success flag
   */
  private async storeEmbedding(vector: number[], datasetImageId: string): Promise<boolean> {
    try {
      // Store embedding using vector search service
      await vectorSearch.storeEmbedding(
        vector,
        { dataset_image_id: datasetImageId, created_at: new Date().toISOString() },
        'dataset_embeddings',
        'embedding'
      );
      
      return true;
    } catch (error) {
      logger.error(`Error storing embedding: ${error}`);
      return false;
    }
  }

  /**
   * Get content type for file extension
   * @param extension File extension
   * @returns Content type
   */
  private getContentType(extension: string): string {
    extension = extension.toLowerCase();
    
    switch (extension) {
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.png':
        return 'image/png';
      case '.gif':
        return 'image/gif';
      case '.webp':
        return 'image/webp';
      default:
        return 'application/octet-stream';
    }
  }
}

// Export singleton instance
export const zipExtractorService = ZipExtractorService.getInstance();
export default zipExtractorService;