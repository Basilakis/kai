/**
 * ZIP Extractor Service
 * 
 * This service extracts and processes ZIP files containing dataset images.
 * It supports extracting class-organized files, validates them, 
 * and uploads them to the dataset storage structure.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as unzipper from 'unzipper';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger';
import { Dataset, DatasetClass, DatasetImage } from '../supabase/supabase-dataset-service';
import supabaseDatasetService from '../supabase/supabase-dataset-service';
import { supabaseClient } from '../supabase/supabaseClient';

// Supported image formats
const SUPPORTED_FORMATS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

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
}

export class ZipExtractorService {
  private static instance: ZipExtractorService;

  private constructor() {
    logger.info('ZIP Extractor Service initialized');
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
   * Process a ZIP file into a dataset
   * @param zipFilePath Path to the uploaded ZIP file
   * @param datasetName Name for the dataset (default: from ZIP filename)
   * @param userId User ID who created the dataset
   * @returns Extraction result
   */
  public async processZipFile(
    zipFilePath: string, 
    datasetName?: string,
    description?: string,
    userId?: string
  ): Promise<ZipExtractionResult> {
    // Initialize result
    const result: ZipExtractionResult = {
      success: false,
      dataset: null,
      classCount: 0,
      imageCount: 0,
      errors: []
    };

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
          const processedCount = await this.processImagesIntoClass(rootImages, defaultClass, dataset.id);
          
          result.classCount = 1;
          result.imageCount = processedCount;
        } else {
          result.errors.push('No images found in the ZIP file.');
        }
      } else {
        // Process each class
        for (const classData of classes) {
          // Create the class
          const datasetClass = await supabaseDatasetService.createDatasetClass({
            datasetId: dataset.id,
            name: classData.name,
            metadata: classData.metadata
          });
          
          // Process images for this class
          const processedCount = await this.processImagesIntoClass(
            classData.images, 
            datasetClass, 
            dataset.id
          );
          
          result.imageCount += processedCount;
        }
        
        result.classCount = classes.length;
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
   * @returns Number of successfully processed images
   */
  private async processImagesIntoClass(
    images: Array<{ filename: string; fullPath: string }>,
    datasetClass: DatasetClass,
    datasetId: string
  ): Promise<number> {
    let processedCount = 0;
    
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
        
        // Create image entry in the database
        await supabaseDatasetService.createDatasetImage({
          datasetId,
          classId: datasetClass.id,
          storagePath,
          filename: image.filename
        });
        
        processedCount++;
      } catch (err) {
        logger.error(`Failed to process image ${image.filename}: ${err}`);
      }
    }
    
    return processedCount;
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