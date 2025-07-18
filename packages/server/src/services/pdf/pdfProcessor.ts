/**
 * PDF Processing Service
 *
 * This service is responsible for extracting images and text from PDF catalogs.
 * It uses the ML package's PDF extraction functionality for PDF parsing and image extraction,
 * and Tesseract OCR for text extraction from images.
 */

import { extractFromPDF, PDFExtractionResult, PDFExtractionOptions, PDFExtractedImage } from '@kai/ml';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { ApiError } from '../../middleware/error.middleware';
import { uploadToS3, getS3Url } from '../storage/supabaseStorageService';
import { createCatalog, updateCatalog } from '../../models/catalog.model';
import { createMaterial } from '../../models/material.model';
import { extractTextFromImage } from './ocrService';
import { logger } from '../../utils/logger';
import { STORAGE } from '@kai/shared';
import mcpClientService, { MCPServiceKey } from '../mcp/mcpClientService';
import creditService from '../credit/creditService';

// Types
interface ExtractedImage {
  id: string;
  pageNumber: number;
  fileName: string;
  filePath: string;
  width: number;
  height: number;
  coordinates: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  s3Key?: string;
  s3Url?: string;
}

interface ExtractedText {
  text: string;
  confidence: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

interface ProcessedPage {
  pageNumber: number;
  images: ExtractedImage[];
  texts: ExtractedText[];
  associations: {
    imageId: string;
    textIds: string[];
  }[];
}

interface ProcessingResult {
  catalogId: string;
  totalPages: number;
  processedPages: ProcessedPage[];
  materials: any[]; // Will be populated with created material documents
  errors: any[];
}

/**
 * Check if MCP is available for PDF processing
 * @returns True if MCP is available
 */
async function isMCPAvailable(): Promise<boolean> {
  try {
    return await mcpClientService.isMCPAvailable();
  } catch (error) {
    logger.error(`Error checking MCP availability: ${error}`);
    return false;
  }
}

/**
 * Process a PDF catalog
 *
 * @param filePath Path to the PDF file
 * @param options Processing options
 * @returns Processing result
 */
export async function processPdfCatalog(
  filePath: string,
  options: {
    userId: string;
    catalogName: string;
    manufacturer?: string;
    factoryId: string; // Made factoryId mandatory
    extractImages?: boolean;
    extractText?: boolean;
    associateTextWithImages?: boolean;
    deleteOriginalAfterProcessing?: boolean;
  }
): Promise<ProcessingResult> {
  logger.info(`Starting PDF processing for ${filePath}`);

  // Default options
  const processingOptions = {
    extractImages: true,
    extractText: true,
    associateTextWithImages: true,
    deleteOriginalAfterProcessing: true,
    ...options
  };

  try {
    // Validate factory selection is provided
    if (!options.factoryId || options.factoryId.trim() === '') {
      throw new ApiError(400, 'Factory selection is required for catalog import');
    }

    // Validate file exists
    if (!fs.existsSync(filePath)) {
      throw new ApiError(404, `PDF file not found: ${filePath}`);
    }

    // Create a unique ID for this catalog
    const catalogId = uuidv4();

    // Create temporary directory for extracted files
    // Using relative path instead of process.cwd() to avoid Node.js type issues
    const tempDir = path.join('./temp', catalogId); // Relative to server root
    fs.mkdirSync(tempDir, { recursive: true });

    // Check if MCP is available and user ID is provided
    const mcpAvailable = await isMCPAvailable();
    const userId = processingOptions.userId;

    if (mcpAvailable && userId) {
      try {
        // Check if user has enough credits
        const hasEnoughCredits = await creditService.hasEnoughCreditsForService(
          userId,
          MCPServiceKey.PDF_PROCESSING,
          5 // Estimate 5 credits for PDF processing
        );

        if (!hasEnoughCredits) {
          throw new Error('Insufficient credits');
        }

        logger.info(`Using MCP for PDF processing: ${filePath}`);

        // Create catalog record in database
        const catalog = await createCatalog({
          id: catalogId,
          name: processingOptions.catalogName,
          manufacturer: processingOptions.manufacturer,
          factoryId: processingOptions.factoryId, // Add factoryId
          originalFilePath: filePath,
          status: 'processing',
          totalPages: 0,
          processedPages: 0,
          createdBy: processingOptions.userId,
          createdAt: new Date(),
          updatedAt: new Date()
        });

        // Use MCP for PDF processing
        const mcpResult = await mcpClientService.processPdf(
          userId,
          filePath,
          {
            extractImages: processingOptions.extractImages,
            extractText: processingOptions.extractText,
            associateTextWithImages: processingOptions.associateTextWithImages,
            outputDir: tempDir
          }
        );

        // Track credit usage
        await creditService.useServiceCredits(
          userId,
          MCPServiceKey.PDF_PROCESSING,
          5, // Use 5 credits for PDF processing
          'PDF processing',
          {
            catalogId,
            fileName: path.basename(filePath),
            pageCount: mcpResult.totalPages
          }
        );

        // Update catalog with results
        await updateCatalog(catalogId, {
          totalPages: mcpResult.totalPages,
          processedPages: mcpResult.totalPages,
          materialsExtracted: mcpResult.materials?.length || 0,
          status: 'completed',
          completedAt: new Date()
        });

        // Clean up if requested
        if (processingOptions.deleteOriginalAfterProcessing) {
          try {
            fs.unlinkSync(filePath);
          } catch (err) {
            logger.warn(`Failed to delete original PDF: ${err}`);
          }
        }

        return {
          catalogId,
          totalPages: mcpResult.totalPages,
          processedPages: mcpResult.processedPages || [],
          materials: mcpResult.materials || [],
          errors: mcpResult.errors || []
        };
      } catch (mcpError: any) {
        // If MCP fails with insufficient credits, rethrow the error
        if (mcpError.message === 'Insufficient credits') {
          throw new ApiError(402, 'Insufficient credits', 'You do not have enough credits to process this PDF. Please purchase more credits.');
        }

        // For other MCP errors, log and fall back to direct implementation
        logger.warn(`MCP PDF processing failed, falling back to direct implementation: ${mcpError.message}`);
      }
    }

    // Fall back to direct implementation if MCP is not available or failed
    // Create catalog record in database
    const catalog = await createCatalog({
      id: catalogId,
      name: processingOptions.catalogName,
      manufacturer: processingOptions.manufacturer,
      factoryId: processingOptions.factoryId, // Add factoryId
      originalFilePath: filePath,
      status: 'processing',
      totalPages: 0,
      processedPages: 0,
      createdBy: processingOptions.userId,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Extract images from PDF using Python script
    const extractedImages = await extractImagesFromPdf(filePath, tempDir);

    // Update catalog with total pages
    await updateCatalog(catalogId, {
      totalPages: extractedImages.reduce((max, img) => Math.max(max, img.pageNumber), 0),
      status: 'extracting_images'
    });

    // Process each extracted image
    const processedPages: ProcessedPage[] = [];
    const materials: any[] = [];
    const errors: any[] = [];

    // Group images by page
    const imagesByPage = extractedImages.reduce((acc, img) => {
      // Initialize array if it doesn't exist
      if (!acc[img.pageNumber]) {
        acc[img.pageNumber] = [];
      }

      // We know acc[img.pageNumber] exists now because we just created it
      acc[img.pageNumber]!.push(img);
      return acc;
    }, {} as Record<number, ExtractedImage[]>);

    // Process each page
    for (const [pageNumber, images] of Object.entries(imagesByPage)) {
      const pageNum = parseInt(pageNumber);

    // Update catalog progress
    await updateCatalog(catalogId, {
      processedPages: pageNum,
      status: 'processing_text' // Using a valid status from the union type
    });

      const processedPage: ProcessedPage = {
        pageNumber: pageNum,
        images: [],
        texts: [],
        associations: []
      };

      // Process each image on the page
      for (const image of images) {
        try {
          // Upload image to S3
          // Fix: CATALOG_IMAGES doesn't exist, use CATALOGS instead
          const s3Key = `${STORAGE.FOLDERS.CATALOGS}/images/${catalogId}/${image.fileName}`;
          await uploadToS3(image.filePath, s3Key);

          // Get S3 URL - await the Promise since Supabase Storage returns URLs asynchronously
          const s3Url = await getS3Url(s3Key);

          // Update image with S3 info
          image.s3Key = s3Key;
          image.s3Url = s3Url;

          // Extract text from image if enabled
          let extractedTexts: ExtractedText[] = [];
          if (processingOptions.extractText) {
            extractedTexts = await extractTextFromImage(image.filePath);
          }

          // Add image and texts to processed page
          processedPage.images.push(image);
          processedPage.texts.push(...extractedTexts);

          // Associate text with image if enabled
          if (processingOptions.associateTextWithImages && extractedTexts.length > 0) {
            const textIds = extractedTexts.map((_, index) => `${image.id}_text_${index}`);
            processedPage.associations.push({
              imageId: image.id,
              textIds
            });

            // Create material record from image and associated text
            const material = await createMaterialFromImageAndText(image, extractedTexts, {
              catalogId,
              pageNumber: pageNum,
              manufacturer: processingOptions.manufacturer,
              userId: processingOptions.userId
            });

            materials.push(material);
          }
        } catch (err) {
          logger.error(`Error processing image ${image.fileName}: ${err}`);
          errors.push({
            type: 'image_processing',
            imageId: image.id,
            error: err instanceof Error ? err.message : String(err)
          });
        }
      }

      processedPages.push(processedPage);
    }

    // Clean up temporary files if enabled
    if (processingOptions.deleteOriginalAfterProcessing) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
        if (filePath !== options.catalogName) { // Don't delete if filePath is just the name
          fs.unlinkSync(filePath);
        }
      } catch (err) {
        logger.warn(`Error cleaning up temporary files: ${err}`);
      }
    }

    // Update catalog status to completed
    await updateCatalog(catalogId, {
      status: errors.length > 0 ? 'completed_with_errors' : 'completed',
      processedPages: processedPages.length,
      materialsExtracted: materials.length,
      errorsCount: errors.length,
      completedAt: new Date()
    });

    return {
      catalogId,
      totalPages: processedPages.length,
      processedPages,
      materials,
      errors
    };
  } catch (err) {
    logger.error(`PDF processing failed: ${err}`);
    throw new ApiError(500, `PDF processing failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Extract images from PDF using ML package's PDF extraction functionality
 *
 * @param pdfPath Path to the PDF file
 * @param outputDir Directory to save extracted images
 * @returns Array of extracted images
 */
async function extractImagesFromPdf(pdfPath: string, outputDir: string): Promise<ExtractedImage[]> {
  try {
    logger.info(`Extracting images from PDF: ${pdfPath} to ${outputDir}`);

    // Ensure output directory exists
    fs.mkdirSync(outputDir, { recursive: true });

    // Use ML package's PDF extraction functionality
    // Create options object with the correct structure
    const extractOptions = {
      outputDir,
      extractText: true,
      extractImages: true,
      imageFormat: 'jpg',
      imageQuality: 90
    };

    // Pass options to extractFromPDF function
    const extractionResult = await extractFromPDF(pdfPath, extractOptions);

    // Convert the extraction result to the expected format
    const extractedImages: ExtractedImage[] = extractionResult.images.map((img: PDFExtractedImage) => {
      // Create default coordinates if they don't exist
      const defaultCoords = { x: 0, y: 0, width: 100, height: 100 };

      return {
        id: uuidv4(),
        pageNumber: img.page,
        fileName: path.basename(img.path),
        filePath: img.path,
        // Provide default values for width and height if they're undefined
        width: img.width ?? 0,
        height: img.height ?? 0,
        coordinates: {
          x: img.coordinates?.x ?? defaultCoords.x,
          y: img.coordinates?.y ?? defaultCoords.y,
          width: img.coordinates?.width ?? defaultCoords.width,
          height: img.coordinates?.height ?? defaultCoords.height
        }
      };
    });

    logger.info(`Extracted ${extractedImages.length} images from PDF: ${pdfPath}`);
    return extractedImages;
  } catch (err) {
    logger.error(`Failed to extract images from PDF: ${err}`);
    throw new Error(`Failed to extract images from PDF: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Create a material record from an image and associated text
 *
 * @param image Extracted image
 * @param texts Extracted texts
 * @param options Additional options
 * @returns Created material
 */
async function createMaterialFromImageAndText(
  image: ExtractedImage,
  texts: ExtractedText[],
  options: {
    catalogId: string;
    pageNumber: number;
    manufacturer?: string;
    userId: string;
  }
): Promise<any> {
  // Combine all extracted texts
  const combinedText = texts.map(t => t.text).join(' ');

  // Extract material properties from text using NLP (simplified for now)
  const materialProperties = extractMaterialProperties(combinedText);

  // Create material record
  const material = await createMaterial({
    id: uuidv4(),
    name: materialProperties.name || `Material from page ${options.pageNumber}`,
    description: materialProperties.description,
    manufacturer: options.manufacturer,
    collection: materialProperties.collection,
    series: materialProperties.series,

    // Physical properties
    dimensions: materialProperties.dimensions || {
      width: 0,
      height: 0,
      unit: 'mm'
    },
    color: materialProperties.color || {
      name: 'Unknown',
      primary: true
    },
    materialType: materialProperties.materialType || 'tile',
    finish: materialProperties.finish || 'unknown',
    pattern: materialProperties.pattern,
    texture: materialProperties.texture,

    // Technical specifications
    technicalSpecs: materialProperties.technicalSpecs || {},

    // Images
    images: [{
      id: image.id,
      url: image.s3Url!,
      type: 'primary',
      width: image.width,
      height: image.height,
      extractedFrom: {
        catalogId: options.catalogId,
        page: options.pageNumber,
        coordinates: image.coordinates
      }
    }],

    // Metadata
    tags: materialProperties.tags || [],
    catalogId: options.catalogId,
    catalogPage: options.pageNumber,
    extractedAt: new Date(),
    updatedAt: new Date(),
    createdBy: options.userId
  });

  return material;
}

/**
 * Extract material properties from text using NLP
 * This is a simplified version - in a real implementation, this would use
 * more sophisticated NLP techniques or a trained model
 *
 * @param text Text to extract properties from
 * @returns Extracted material properties
 */
function extractMaterialProperties(text: string): any {
  // This is a simplified implementation
  // In a real application, this would use NLP techniques or a trained model

  const properties: any = {
    tags: []
  };

  // Extract name (first line or first sentence)
  const firstLine = text.split('\n')[0]?.trim() || '';
  const firstSentence = text.split('.')[0]?.trim() || '';
  properties.name = firstLine || firstSentence || 'Unknown Material';

  // Extract dimensions
  const dimensionMatch = text.match(/(\d+)\s*[xX]\s*(\d+)(?:\s*[xX]\s*(\d+))?\s*(mm|cm|inch)?/);
  if (dimensionMatch) {
    properties.dimensions = {
      width: parseInt(dimensionMatch[1] || '0'),
      height: parseInt(dimensionMatch[2] || '0'),
      depth: dimensionMatch[3] ? parseInt(dimensionMatch[3]) : undefined,
      unit: (dimensionMatch[4] || 'mm').toLowerCase()
    };
  }

  // Use NLP matching service for intelligent tag extraction
  try {
    const { tagMatchingService } = await import('../nlp/tagMatchingService');
    
    // Find matching tags across all categories using NLP
    const tagMatches = await tagMatchingService.findTagsForAllCategories(text,
      ['colors', 'material_types', 'finishes', 'collections', 'technical_specs'],
      {
        minConfidence: 0.7,
        enableFuzzyMatching: true,
        enableSynonymMatching: true
      }
    );

    // Process color matches
    if (tagMatches.colors && tagMatches.colors.length > 0) {
      const bestColorMatch = tagMatches.colors[0];
      properties.color = {
        name: bestColorMatch.tagName,
        primary: true
      };
      properties.tags.push(bestColorMatch.tagName.toLowerCase());
      
      // Log the tag matching for analytics
      await tagMatchingService.logTagMatching({
        extractedText: text.substring(0, 200), // Limit text length for logging
        matchedTagId: bestColorMatch.tagId,
        confidenceScore: bestColorMatch.confidenceScore,
        matchingMethod: bestColorMatch.matchingMethod,
        categoryName: 'colors'
      });
    }

    // Process material type matches
    if (tagMatches.material_types && tagMatches.material_types.length > 0) {
      const bestMaterialMatch = tagMatches.material_types[0];
      properties.materialType = bestMaterialMatch.tagName.toLowerCase();
      properties.tags.push(bestMaterialMatch.tagName.toLowerCase());
      
      await tagMatchingService.logTagMatching({
        extractedText: text.substring(0, 200),
        matchedTagId: bestMaterialMatch.tagId,
        confidenceScore: bestMaterialMatch.confidenceScore,
        matchingMethod: bestMaterialMatch.matchingMethod,
        categoryName: 'material_types'
      });
    }

    // Process finish matches
    if (tagMatches.finishes && tagMatches.finishes.length > 0) {
      const bestFinishMatch = tagMatches.finishes[0];
      properties.finish = bestFinishMatch.tagName.toLowerCase();
      properties.tags.push(bestFinishMatch.tagName.toLowerCase());
      
      await tagMatchingService.logTagMatching({
        extractedText: text.substring(0, 200),
        matchedTagId: bestFinishMatch.tagId,
        confidenceScore: bestFinishMatch.confidenceScore,
        matchingMethod: bestFinishMatch.matchingMethod,
        categoryName: 'finishes'
      });
    }

    // Process collection matches
    if (tagMatches.collections && tagMatches.collections.length > 0) {
      const bestCollectionMatch = tagMatches.collections[0];
      properties.collection = bestCollectionMatch.tagName;
      properties.tags.push(bestCollectionMatch.tagName.toLowerCase());
      
      await tagMatchingService.logTagMatching({
        extractedText: text.substring(0, 200),
        matchedTagId: bestCollectionMatch.tagId,
        confidenceScore: bestCollectionMatch.confidenceScore,
        matchingMethod: bestCollectionMatch.matchingMethod,
        categoryName: 'collections'
      });
    }

    // Process technical specifications matches
    if (tagMatches.technical_specs && tagMatches.technical_specs.length > 0) {
      // Add all technical specs as tags (they don't map to specific properties)
      for (const techMatch of tagMatches.technical_specs) {
        properties.tags.push(techMatch.tagName.toLowerCase());
        
        await tagMatchingService.logTagMatching({
          extractedText: text.substring(0, 200),
          matchedTagId: techMatch.tagId,
          confidenceScore: techMatch.confidenceScore,
          matchingMethod: techMatch.matchingMethod,
          categoryName: 'technical_specs'
        });
      }
    }

  } catch (error) {
    console.error('Error using NLP tag matching service:', error);
    
    // Fallback to basic pattern matching if NLP service fails
    const colorMatch = text.match(/colou?r:?\s*([a-zA-Z\s]+)/i);
    if (colorMatch) {
      properties.color = {
        name: colorMatch[1]?.trim() || 'Unknown',
        primary: true
      };
      properties.tags.push(colorMatch[1]?.trim().toLowerCase() || 'unknown');
    }

    // Basic material type fallback
    const materialTypes = ['ceramic', 'porcelain', 'natural stone', 'glass', 'metal', 'concrete', 'terrazzo', 'mosaic'];
    for (const type of materialTypes) {
      if (text.toLowerCase().includes(type)) {
        properties.materialType = type === 'natural stone' ? 'stone' : type;
        properties.tags.push(type);
        break;
      }
    }

    // Basic finish fallback
    const finishes = ['matte', 'glossy', 'polished', 'honed', 'textured', 'brushed', 'lappato', 'satin'];
    for (const finish of finishes) {
      if (text.toLowerCase().includes(finish)) {
        properties.finish = finish;
        properties.tags.push(finish);
        break;
      }
    }
  }

  // Extract technical specifications
  properties.technicalSpecs = {};

  // Water absorption
  const waterAbsorptionMatch = text.match(/water\s+absorption:?\s*([\d.]+)%?/i);
  if (waterAbsorptionMatch) {
    properties.technicalSpecs.waterAbsorption = parseFloat(waterAbsorptionMatch[1] || '0');
  }

  // Slip resistance
  const slipResistanceMatch = text.match(/slip\s+resistance:?\s*([a-zA-Z0-9\s]+)/i);
  if (slipResistanceMatch) {
    properties.technicalSpecs.slipResistance = slipResistanceMatch[1]?.trim() || '';
  }

  // Frost resistance
  if (text.toLowerCase().includes('frost resistant') || text.toLowerCase().includes('frost resistance')) {
    properties.technicalSpecs.frostResistance = true;
  }

  return properties;
}

/**
 * Queue a PDF for processing
 *
 * @param filePath Path to the PDF file
 * @param options Processing options
 * @returns Job ID
 */
export async function queuePdfForProcessing(
  filePath: string,
  options: {
    userId: string;
    catalogName: string;
    manufacturer?: string;
    priority?: 'low' | 'normal' | 'high';
    extractImages?: boolean;
    extractText?: boolean;
    associateTextWithImages?: boolean;
    deleteOriginalAfterProcessing?: boolean;
  }
): Promise<string> {
  // Import here to avoid circular dependency
  const { pdfQueue } = await import('./pdfQueue');

  // Add job to queue
  const jobId = await pdfQueue.add(filePath, options);

  return jobId;
}

/**
 * Queue multiple PDFs for batch processing
 *
 * @param files Array of PDF files to process
 * @returns Array of job IDs
 */
export async function batchProcessPdfCatalogs(
  files: Array<{
    filePath: string;
    options: {
      userId: string;
      catalogName: string;
      manufacturer?: string;
      priority?: 'low' | 'normal' | 'high';
      extractImages?: boolean;
      extractText?: boolean;
      associateTextWithImages?: boolean;
      deleteOriginalAfterProcessing?: boolean;
    }
  }>
): Promise<string[]> {
  // Import here to avoid circular dependency
  const { pdfQueue } = await import('./pdfQueue');

  // Add batch to queue
  const jobIds = await pdfQueue.addBatch(files);

  return jobIds;
}

/**
 * Get PDF processing job status
 *
 * @param jobId Job ID
 * @returns Job status or null if not found
 */
export async function getPdfProcessingStatus(jobId: string): Promise<any | null> {
  // Import here to avoid circular dependency
  const { pdfQueue } = await import('./pdfQueue');

  // Get job from queue
  return pdfQueue.get(jobId);
}

/**
 * Get all PDF processing jobs
 *
 * @param status Optional status filter
 * @returns Array of jobs
 */
export async function getAllPdfProcessingJobs(status?: string): Promise<any[]> {
  // Import here to avoid circular dependency
  const { pdfQueue } = await import('./pdfQueue');

  // Get jobs from queue
  return pdfQueue.getAll(status as any);
}

/**
 * Valid catalog status values
 */
type CatalogStatus =
  | 'pending'
  | 'processing'
  | 'extracting_images'
  | 'processing_text'
  | 'completed'
  | 'completed_with_errors'
  | 'failed';

/**
 * Update processing progress for a catalog
 *
 * @param catalogId Catalog ID
 * @param progress Progress data
 */
async function updateProcessingProgress(
  catalogId: string,
  progress: {
    status: CatalogStatus;
    processedPages?: number;
    totalPages?: number;
    extractedImages?: number;
    processedImages?: number;
    materialsExtracted?: number;
    errorsCount?: number;
    completedAt?: Date;
  }
): Promise<void> {
  try {
    // Update catalog record in database
    await updateCatalog(catalogId, progress);
  } catch (err) {
    logger.error(`Failed to update catalog progress: ${err}`);
  }
}