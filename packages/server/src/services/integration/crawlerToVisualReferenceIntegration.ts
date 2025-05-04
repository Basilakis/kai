/**
 * Crawler to Visual Reference Integration Service
 * 
 * This service integrates the existing crawler with the Visual Reference Library,
 * allowing crawled images to be imported as visual references.
 */

import { logger } from '../../utils/logger';
import { prisma } from '../prisma';
import { MaterialType } from '@kai/ml';
import * as path from 'path';
import * as fs from 'fs';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { imageAnalysisService } from '../ai/imageAnalysisService';

/**
 * Crawler to Visual Reference Integration Service
 */
export class CrawlerToVisualReferenceIntegration {
  /**
   * Import crawled images as visual references
   * 
   * @param crawlJobId The ID of the crawler job
   * @param options Import options
   * @returns The number of images imported
   */
  public async importCrawledImages(
    crawlJobId: string,
    options: {
      propertyName: string;
      materialType: MaterialType;
      propertyValues?: string[];
      autoClassify?: boolean;
      maxImages?: number;
    }
  ): Promise<{ imagesImported: number; errors: string[] }> {
    try {
      logger.info(`Importing crawled images from job ${crawlJobId} for ${options.propertyName} (${options.materialType})`);
      
      // Get the crawler job
      const crawlJob = await prisma.crawlerJob.findUnique({
        where: { id: crawlJobId }
      });
      
      if (!crawlJob) {
        throw new Error(`Crawler job not found: ${crawlJobId}`);
      }
      
      // Get the crawler results
      const crawlResults = await prisma.crawlerResult.findMany({
        where: { jobId: crawlJobId },
        include: {
          images: true
        }
      });
      
      if (!crawlResults || crawlResults.length === 0) {
        throw new Error(`No results found for crawler job: ${crawlJobId}`);
      }
      
      // Create the upload directory if it doesn't exist
      const uploadDir = path.join(process.cwd(), 'uploads', 'visual-references');
      fs.mkdirSync(uploadDir, { recursive: true });
      
      // Get or create the visual property reference
      let reference = await prisma.visualPropertyReference.findFirst({
        where: {
          propertyName: options.propertyName,
          materialType: options.materialType
        }
      });
      
      if (!reference) {
        reference = await prisma.visualPropertyReference.create({
          data: {
            propertyName: options.propertyName,
            materialType: options.materialType,
            displayName: options.propertyName,
            description: `Visual references for ${options.propertyName} (${options.materialType})`,
            previewImage: null,
            metadata: {
              importedFrom: 'crawler',
              crawlJobId
            }
          }
        });
      }
      
      // Process images
      let imagesImported = 0;
      const errors: string[] = [];
      const maxImages = options.maxImages || 100;
      
      // Collect all images from all results
      const allImages = crawlResults.flatMap(result => result.images || []);
      
      // Process each image
      for (const image of allImages) {
        // Skip if we've reached the maximum number of images
        if (imagesImported >= maxImages) {
          break;
        }
        
        try {
          // Download the image
          const response = await axios.get(image.url, { 
            responseType: 'arraybuffer',
            timeout: 10000 // 10 seconds timeout
          });
          
          const buffer = Buffer.from(response.data, 'binary');
          
          // Generate a unique filename
          const fileExt = path.extname(image.url) || '.jpg';
          const filename = `${uuidv4()}${fileExt}`;
          const filePath = path.join(uploadDir, filename);
          
          // Save the image
          fs.writeFileSync(filePath, buffer);
          
          // Determine the property value
          let propertyValue: string;
          
          if (options.autoClassify) {
            // Use image analysis to classify the image
            const analysisResult = await imageAnalysisService.analyzeImage(filePath);
            
            // Extract the property value from the analysis result
            if (options.propertyName === 'color') {
              propertyValue = analysisResult.dominantColor || 'unknown';
            } else if (options.propertyName === 'texture') {
              propertyValue = analysisResult.textureType || 'unknown';
            } else if (options.propertyName === 'finish') {
              propertyValue = analysisResult.surfaceFinish || 'unknown';
            } else if (options.propertyName === 'pattern') {
              propertyValue = analysisResult.patternType || 'unknown';
            } else {
              // For other properties, use the first property value from options
              propertyValue = options.propertyValues?.[0] || 'unknown';
            }
          } else if (options.propertyValues && options.propertyValues.length > 0) {
            // Use the first property value from options
            propertyValue = options.propertyValues[0];
          } else {
            // Use a default value
            propertyValue = 'unknown';
          }
          
          // Create the reference item
          await prisma.visualPropertyReferenceItem.create({
            data: {
              referenceId: reference.id,
              imagePath: filePath,
              propertyValue,
              metadata: {
                sourceUrl: image.url,
                sourcePage: image.pageUrl,
                sourceTitle: image.pageTitle,
                crawlJobId,
                importedAt: new Date()
              }
            }
          });
          
          // Update the preview image if not set
          if (!reference.previewImage) {
            await prisma.visualPropertyReference.update({
              where: { id: reference.id },
              data: { previewImage: filePath }
            });
          }
          
          imagesImported++;
        } catch (error) {
          const errorMessage = `Error processing image ${image.url}: ${error instanceof Error ? error.message : String(error)}`;
          logger.error(errorMessage);
          errors.push(errorMessage);
        }
      }
      
      // Update the reference with import information
      await prisma.visualPropertyReference.update({
        where: { id: reference.id },
        data: {
          metadata: {
            ...reference.metadata,
            lastImport: {
              crawlJobId,
              imagesImported,
              importedAt: new Date()
            }
          }
        }
      });
      
      logger.info(`Imported ${imagesImported} images for ${options.propertyName} (${options.materialType})`);
      
      return {
        imagesImported,
        errors
      };
    } catch (error) {
      logger.error(`Error importing crawled images: ${error}`);
      throw error;
    }
  }
}

// Create a singleton instance
export const crawlerToVisualReferenceIntegration = new CrawlerToVisualReferenceIntegration();
