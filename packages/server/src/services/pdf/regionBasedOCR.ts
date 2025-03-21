/**
 * Region-Based OCR
 * 
 * This module provides specialized OCR functionality for extracting text from
 * specific regions of an image, with a focus on extracting material specifications
 * that are typically adjacent to product images in catalogs.
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { logger } from '../../utils/logger';
import { performOCR, OCRResult } from './ocrService';

// Type declaration for Node.js Buffer when @types/node isn't available
type NodeBuffer = any;

/**
 * Types of regions in an image
 */
export enum RegionType {
  /** Main heading or title */
  HEADING = 'heading',
  /** Technical specifications (dimensions, properties) */
  SPECIFICATIONS = 'specifications',
  /** General descriptive text */
  DESCRIPTION = 'description',
  /** Product code or reference */
  PRODUCT_CODE = 'product_code',
  /** Price or cost information */
  PRICE = 'price',
  /** Small print or footnotes */
  SMALL_PRINT = 'small_print'
}

/**
 * Text block type that's used by the textImageAssociation module
 */
export enum TextBlockType {
  /** Main heading or title */
  HEADING = 'heading',
  /** Technical specifications */
  SPECIFICATIONS = 'specifications',
  /** General description */
  DESCRIPTION = 'description',
  /** Product code */
  PRODUCT_CODE = 'product_code',
  /** Other text */
  OTHER = 'other'
}

/**
 * Text block representation for use with text-image association
 */
export interface TextBlock {
  /** Type of text block */
  type: TextBlockType;
  /** Text content */
  text: string;
  /** Position and dimensions */
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** Confidence score (0-1) */
  confidence: number;
}

/**
 * A region in an image that may contain text
 */
export interface TextRegion {
  /** Type of the region */
  type: RegionType;
  /** Coordinates of the region */
  coordinates: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** Extracted text from this region */
  text?: string;
  /** Confidence score (0-1) */
  confidence?: number;
  /** Processing options used for this region */
  options?: {
    psm?: number;  // Page segmentation mode
    oem?: number;  // OCR engine mode
    preprocessingLevel?: 'none' | 'basic' | 'advanced';
    customDictionary?: string[];
  };
}

/**
 * Result of a region-based OCR operation
 */
export interface RegionBasedOCRResult {
  /** Path to the processed image */
  imagePath: string;
  /** Image dimensions */
  imageDimensions?: {
    width: number;
    height: number;
  };
  /** Extracted regions with text */
  regions: TextRegion[];
  /** Overall processing time in ms */
  processingTime: number;
  /** Status of the operation */
  status: 'success' | 'partial' | 'failed';
  /** Any error message */
  errorMessage?: string;
}

/**
 * Image preprocessing options for region-based OCR
 */
interface PreprocessingOptions {
  /** Brightness adjustment (-100 to 100) */
  brightness?: number;
  /** Contrast adjustment (-100 to 100) */
  contrast?: number;
  /** Sharpening level (0-10) */
  sharpen?: number;
  /** Whether to binarize the image */
  binarize?: boolean;
  /** Threshold for binarization (0-255) */
  binaryThreshold?: number;
  /** Whether to remove noise */
  removeNoise?: boolean;
  /** Whether to deskew the image */
  deskew?: boolean;
  /** Scaling factor for the image */
  scale?: number;
  /** DPI for the image */
  dpi?: number;
}

/**
 * Get optimal preprocessing options based on region type
 * 
 * @param regionType Type of region to process
 * @returns Preprocessing options optimized for the region type
 */
function getOptimalPreprocessingOptions(regionType: RegionType): PreprocessingOptions {
  switch (regionType) {
    case RegionType.HEADING:
      return {
        brightness: 10,
        contrast: 20,
        sharpen: 2,
        binarize: false,
        removeNoise: true,
        deskew: true,
        scale: 2
      };
    case RegionType.SPECIFICATIONS:
      return {
        brightness: 0,
        contrast: 40, // Higher contrast for small text
        sharpen: 3,   // More sharpening for details
        binarize: true,
        binaryThreshold: 180,
        removeNoise: true,
        deskew: true,
        scale: 3,      // Higher scaling for small text
        dpi: 600       // Higher DPI for specifications
      };
    case RegionType.PRODUCT_CODE:
      return {
        brightness: 0,
        contrast: 30,
        sharpen: 4,    // Higher sharpening for product codes
        binarize: true,
        binaryThreshold: 160,
        removeNoise: true,
        deskew: true,
        scale: 2
      };
    case RegionType.SMALL_PRINT:
      return {
        brightness: 0,
        contrast: 50,  // Highest contrast for tiny text
        sharpen: 5,    // Maximum sharpening for small print
        binarize: true,
        binaryThreshold: 200,
        removeNoise: true,
        deskew: true,
        scale: 4,      // Maximum scaling for tiny text
        dpi: 900       // Highest DPI for small print
      };
    case RegionType.PRICE:
    case RegionType.DESCRIPTION:
    default:
      // Default options for general text
      return {
        brightness: 0,
        contrast: 20,
        sharpen: 2,
        binarize: false,
        removeNoise: true,
        deskew: true,
        scale: 1.5
      };
  }
}

/**
 * Get optimal Tesseract options based on region type
 * 
 * @param regionType Type of region to process
 * @returns Tesseract options optimized for the region type
 */
function getOptimalOCROptions(regionType: RegionType): { psm: number, oem: number } {
  switch (regionType) {
    case RegionType.HEADING:
      // Single line of text, usually larger font
      return { psm: 7, oem: 3 }; // PSM 7 = single line
    case RegionType.SPECIFICATIONS:
      // Usually structured text with measurements
      return { psm: 6, oem: 3 }; // PSM 6 = single uniform block
    case RegionType.PRODUCT_CODE:
      // Often alphanumeric codes
      return { psm: 7, oem: 3 }; // PSM 7 = single line
    case RegionType.PRICE:
      // Usually numerals with currency symbols
      return { psm: 7, oem: 3 }; // PSM 7 = single line
    case RegionType.SMALL_PRINT:
      // Dense small text
      return { psm: 6, oem: 3 }; // PSM 6 = single uniform block
    case RegionType.DESCRIPTION:
    default:
      // General text, possibly multiple paragraphs
      return { psm: 4, oem: 3 }; // PSM 4 = single column of text
  }
}

/**
 * Get custom dictionary words based on region type for improved recognition
 * 
 * @param regionType Type of region to process
 * @returns Array of domain-specific words for the region type
 */
function getCustomDictionary(regionType: RegionType): string[] {
  switch (regionType) {
    case RegionType.SPECIFICATIONS:
      // Common terms in tile specifications
      return [
        // Dimensions
        'mm', 'cm', 'inches', 'x', 'by',
        // Material types
        'porcelain', 'ceramic', 'marble', 'granite', 'stone', 'wood', 'metal', 'glass', 'mosaic',
        // Technical properties
        'PEI', 'R9', 'R10', 'R11', 'frost', 'resistant', 'slip', 'water', 'absorption',
        'matte', 'matt', 'polished', 'glossy', 'textured', 'structured', 'lappato', 'hammered',
        // Colors
        'beige', 'white', 'black', 'grey', 'gray', 'brown', 'cream'
      ];
    case RegionType.HEADING:
      // Common terms in tile product names
      return [
        'collection', 'series', 'tile', 'flooring', 'wall', 'floor', 'decor'
      ];
    case RegionType.PRODUCT_CODE:
      // No specific dictionary for product codes
      return [];
    default:
      return [];
  }
}

/**
 * Detect regions in an image that may contain text
 * 
 * @param imagePath Path to the image
 * @returns Promise resolving to detected regions
 */
export async function detectTextRegions(imagePath: string): Promise<TextRegion[]> {
  try {
    logger.info(`Detecting text regions in image: ${imagePath}`);
    
    // Run preliminary OCR to identify text areas
    const ocrResult = await performOCR(imagePath, {
      preprocess: true
    });
    
    if (!ocrResult.text) {
      logger.warn(`No text detected in image: ${imagePath}`);
      return [];
    }
    
    // Use Python script for advanced layout analysis (placeholder implementation)
    // In real implementation, this would use a Python script with OpenCV or a similar library
    const detectedRegions = await analyzeImageLayout(imagePath);
    
    // If no regions detected via advanced analysis, create a default one
    if (detectedRegions.length === 0) {
      logger.info(`No specific regions detected, using default region for entire image`);
      
      // Use OpenCV to get image dimensions
      const dimensions = await getImageDimensions(imagePath);
      
      if (dimensions) {
        return [{
          type: RegionType.SPECIFICATIONS,
          coordinates: {
            x: 0,
            y: 0,
            width: dimensions.width,
            height: dimensions.height
          }
        }];
      }
      
      logger.warn(`Failed to get image dimensions for ${imagePath}`);
      return [];
    }
    
    return detectedRegions;
  } catch (error) {
    logger.error(`Error detecting text regions: ${error}`);
    return [];
  }
}

/**
 * Process an image to extract text from specific regions
 * 
 * @param imagePath Path to the image
 * @param regions Regions to process (if not provided, regions will be auto-detected)
 * @returns Promise resolving to extraction results
 */
export async function processImageWithRegions(
  imagePath: string,
  regions?: TextRegion[]
): Promise<RegionBasedOCRResult> {
  const startTime = Date.now();
  
  try {
    logger.info(`Processing image with region-based OCR: ${imagePath}`);
    
    // Get image dimensions
    const dimensions = await getImageDimensions(imagePath);
    
    // If no regions provided, auto-detect them
    const textRegions = regions || await detectTextRegions(imagePath);
    
    if (textRegions.length === 0) {
      return {
        imagePath,
        imageDimensions: dimensions,
        regions: [],
        processingTime: Date.now() - startTime,
        status: 'failed',
        errorMessage: 'No text regions detected in image'
      };
    }
    
    // Process each region
    const processedRegions: TextRegion[] = [];
    for (const region of textRegions) {
      try {
        const processedRegion = await processRegion(imagePath, region);
        processedRegions.push(processedRegion);
      } catch (error) {
        logger.error(`Error processing region: ${error}`);
        processedRegions.push({
          ...region,
          text: '',
          confidence: 0
        });
      }
    }
    
    // Calculate overall status
    const anySuccess = processedRegions.some(r => r.text && r.confidence && r.confidence > 0.5);
    const anyFailed = processedRegions.some(r => !r.text || !r.confidence || r.confidence < 0.1);
    
    const status = anySuccess
      ? (anyFailed ? 'partial' : 'success')
      : 'failed';
    
    return {
      imagePath,
      imageDimensions: dimensions,
      regions: processedRegions,
      processingTime: Date.now() - startTime,
      status
    };
  } catch (error) {
    logger.error(`Error in region-based OCR: ${error}`);
    return {
      imagePath,
      regions: [],
      processingTime: Date.now() - startTime,
      status: 'failed',
      errorMessage: `Error in region-based OCR: ${error}`
    };
  }
}

/**
 * Process a specific region of an image
 * 
 * @param imagePath Path to the image
 * @param region Region to process
 * @returns Promise resolving to processed region with extracted text
 */
async function processRegion(imagePath: string, region: TextRegion): Promise<TextRegion> {
  logger.info(`Processing region of type ${region.type} in image ${path.basename(imagePath)}`);
  
  // Get optimal settings for this region type
  const preprocessingOptions = getOptimalPreprocessingOptions(region.type);
  const ocrOptions = getOptimalOCROptions(region.type);
  const customDictionary = getCustomDictionary(region.type);
  
  // Merge with any region-specific options provided
  const options = {
    psm: region.options?.psm || ocrOptions.psm,
    oem: region.options?.oem || ocrOptions.oem,
    preprocessingLevel: region.options?.preprocessingLevel || 
                        (preprocessingOptions.binarize ? 'advanced' : 'basic'),
    customDictionary: [
      ...(customDictionary || []),
      ...(region.options?.customDictionary || [])
    ]
  };
  
  try {
    // Extract the region from the image
    const regionImagePath = await extractRegionImage(
      imagePath,
      region.coordinates,
      preprocessingOptions
    );
    
    if (!regionImagePath) {
      throw new Error('Failed to extract region image');
    }
    
    // Perform OCR on the region with optimal settings
    const ocrResult = await performOCRWithOptions(regionImagePath, options);
    
    // Clean up the temporary region image
    try {
      fs.unlinkSync(regionImagePath);
    } catch (err) {
      logger.warn(`Failed to clean up region image: ${err}`);
    }
    
    // Post-process text based on region type
    const processedText = postProcessText(ocrResult.text, region.type);
    
    return {
      ...region,
      text: processedText,
      confidence: ocrResult.confidence,
      options
    };
  } catch (error) {
    logger.error(`Error processing region: ${error}`);
    return {
      ...region,
      text: '',
      confidence: 0,
      options
    };
  }
}

/**
 * Extract a region from an image and preprocess it for OCR
 * 
 * @param imagePath Path to the image
 * @param coordinates Region coordinates
 * @param options Preprocessing options
 * @returns Path to the extracted and preprocessed region image
 */
async function extractRegionImage(
  imagePath: string,
  coordinates: { x: number; y: number; width: number; height: number; },
  options: PreprocessingOptions
): Promise<string> {
  return new Promise((resolve, reject) => {
    const outputDir = path.join(path.dirname(imagePath), 'ocr_regions');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Generate unique output filename
    const timestamp = new Date().getTime();
    const basename = path.basename(imagePath, path.extname(imagePath));
    const outputPath = path.join(
      outputDir,
      `${basename}_${coordinates.x}_${coordinates.y}_${coordinates.width}_${coordinates.height}_${timestamp}.png`
    );
    
    // Run Python script for region extraction and preprocessing
    const pythonScript = path.join(process.cwd(), 'scripts', 'extract_region.py');
    
    // If Python script doesn't exist, use fallback approach
    if (!fs.existsSync(pythonScript)) {
      logger.warn(`Python region extraction script not found: ${pythonScript}. Using fallback approach.`);
      // In a real implementation, we'd have a fallback using Node.js image processing libraries
      // For this example, we'll just return the original image
      return resolve(imagePath);
    }
    
    // Build command arguments
    const args = [
      pythonScript,
      imagePath,
      outputPath,
      coordinates.x.toString(),
      coordinates.y.toString(),
      coordinates.width.toString(),
      coordinates.height.toString()
    ];
    
    // Add preprocessing options
    if (options.brightness !== undefined) args.push('--brightness', options.brightness.toString());
    if (options.contrast !== undefined) args.push('--contrast', options.contrast.toString());
    if (options.sharpen !== undefined) args.push('--sharpen', options.sharpen.toString());
    if (options.binarize) args.push('--binarize');
    if (options.binaryThreshold !== undefined) args.push('--threshold', options.binaryThreshold.toString());
    if (options.removeNoise) args.push('--remove-noise');
    if (options.deskew) args.push('--deskew');
    if (options.scale !== undefined) args.push('--scale', options.scale.toString());
    if (options.dpi !== undefined) args.push('--dpi', options.dpi.toString());
    
    // Execute Python script
    const pythonProcess = spawn('python', args) as any;
    
    let errorOutput = '';
    
    pythonProcess.stderr.on('data', (data: any) => {
      errorOutput += data.toString();
    });
    
    pythonProcess.on('close', (code: number) => {
      if (code !== 0) {
        logger.error(`Region extraction failed with code ${code}: ${errorOutput}`);
        return reject(new Error(`Region extraction failed: ${errorOutput}`));
      }
      
      if (!fs.existsSync(outputPath)) {
        logger.error(`Extracted region image not found at ${outputPath}`);
        return reject(new Error('Extracted region image not found'));
      }
      
      logger.info(`Region extracted successfully: ${outputPath}`);
      resolve(outputPath);
    });
  });
}

/**
 * Perform OCR with specific options
 * 
 * @param imagePath Path to the image
 * @param options OCR options
 * @returns Promise resolving to OCR result
 */
async function performOCRWithOptions(
  imagePath: string,
  options: {
    psm: number;
    oem: number;
    preprocessingLevel: 'none' | 'basic' | 'advanced';
    customDictionary?: string[];
  }
): Promise<{ text: string; confidence: number; }> {
  return new Promise((resolve, reject) => {
    // Create temporary directory for OCR files
    const outputDir = path.join(path.dirname(imagePath), 'ocr_output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Create user patterns file if custom dictionary is provided
    let userPatternFile: string | undefined;
    if (options.customDictionary && options.customDictionary.length > 0) {
      userPatternFile = path.join(outputDir, 'user-patterns.txt');
      fs.writeFileSync(userPatternFile, options.customDictionary.join('\n'));
    }
    
    // Prepare Tesseract command
    const args = [
      imagePath,
      path.join(outputDir, 'output'),
      '-l', 'eng',
      '--psm', options.psm.toString(),
      '--oem', options.oem.toString(),
      '-c', 'preserve_interword_spaces=1'
    ];
    
    // Add user patterns if available
    if (userPatternFile) {
      args.push('-c', `user_patterns_file=${userPatternFile}`);
    }
    
    // Add additional configurations for better specification recognition
    if (options.preprocessingLevel === 'advanced') {
      args.push('-c', 'textord_heavy_nr=1'); // Heavy noise removal
      args.push('-c', 'textord_min_linesize=2.5'); // Improve detection of small text
      args.push('-c', 'edges_max_children_per_outline=50'); // Better for complex layouts
    }
    
    // Run Tesseract
    const tesseractProcess = spawn('tesseract', args) as any;
    
    let errorData = '';
    
    tesseractProcess.stderr.on('data', (data: any) => {
      errorData += data.toString();
    });
    
    tesseractProcess.on('close', (code: number) => {
      // Clean up user pattern file if it was created
      if (userPatternFile && fs.existsSync(userPatternFile)) {
        try {
          fs.unlinkSync(userPatternFile);
        } catch (err) {
          logger.warn(`Failed to clean up user pattern file: ${err}`);
        }
      }
      
      if (code !== 0) {
        return reject(new Error(`Tesseract OCR failed with code ${code}: ${errorData}`));
      }
      
      // Read the output text file
      const outputFile = path.join(outputDir, 'output.txt');
      if (!fs.existsSync(outputFile)) {
        return reject(new Error('Tesseract output file not found'));
      }
      
      try {
        const text = fs.readFileSync(outputFile, 'utf8');
        
        // Clean up temp files
        try {
          fs.unlinkSync(outputFile);
          fs.rmdirSync(outputDir, { recursive: true });
        } catch (err) {
          logger.warn(`Failed to clean up temporary files: ${err}`);
        }
        
        // Estimate confidence based on text quality
        // (in a real implementation, we'd use Tesseract's confidence values)
        const cleanText = text.trim();
        let confidence = 0;
        
        if (cleanText) {
          // Simple heuristic for confidence:
          // - Higher ratio of alphanumeric chars = higher confidence
          // - Fewer 'weird' characters = higher confidence
          const alphanumericChars = cleanText.replace(/[^a-zA-Z0-9\s]/g, '').length;
          const totalChars = cleanText.length || 1;
          const alphanumericRatio = alphanumericChars / totalChars;
          
          // Detect common OCR errors
          const suspiciousPatterns = [
            /[Il1|]{3,}/,  // Repeated I, l, 1 or | characters
            /[0Oo]{3,}/,   // Repeated 0, O, or o characters
            /[@#%&]{2,}/,  // Repeated special characters
            /[^\x00-\x7F]{2,}/ // Repeated non-ASCII characters
          ];
          
          const hasOCRErrors = suspiciousPatterns.some(pattern => pattern.test(cleanText));
          
          confidence = alphanumericRatio * (hasOCRErrors ? 0.5 : 0.9);
        }
        
        resolve({
          text: cleanText,
          confidence
        });
      } catch (err) {
        reject(new Error(`Failed to read Tesseract output: ${err}`));
      }
    });
  });
}

/**
 * Post-process extracted text based on region type
 * 
 * @param text Text to process
 * @param regionType Type of region that the text came from
 * @returns Processed text
 */
function postProcessText(text: string, regionType: RegionType): string {
  if (!text) return '';
  
  // Remove excessive whitespace
  let processed = text.replace(/\s+/g, ' ').trim();
  
  switch (regionType) {
    case RegionType.SPECIFICATIONS:
      // Normalize dimensions
      processed = processed.replace(/(\d+)\s*[xX×]\s*(\d+)(\s*mm|\s*cm)?/g, '$1×$2$3');
      
      // Correct common OCR errors in specifications
      processed = processed.replace(/([RB])\s*(\d+)/g, '$1$2'); // Remove space between R/B and numbers
      processed = processed.replace(/PE\s*[l1Il|]\s*[l1Il|]/g, 'PEI I'); // Fix PEI I
      processed = processed.replace(/PE\s*[l1Il|]\s*[l1Il|]\s*[l1Il|]/g, 'PEI III'); // Fix PEI III
      
      // Fix common slip resistance ratings
      processed = processed.replace(/[B8]\s*[l1Il|][O0]?/g, 'R10');
      processed = processed.replace(/[B8]\s*[l1Il|][l1Il|]/g, 'R11');
      processed = processed.replace(/[B8]\s*9/g, 'R9');
      
      // Normalize units
      processed = processed.replace(/(\d+)(\s*)mm/g, '$1$2mm');
      processed = processed.replace(/(\d+)(\s*)cm/g, '$1$2cm');
      
      break;
      
    case RegionType.PRODUCT_CODE:
      // Remove spaces from product codes
      processed = processed.replace(/\s+/g, '');
      
      // Correct common confusions in product codes
      processed = processed.replace(/[oO0]/g, '0'); // Replace o/O with 0
      processed = processed.replace(/[l1I|]/g, '1'); // Replace l/I/| with 1
      
      break;
      
    case RegionType.PRICE:
      // Format prices and remove invalid characters
      processed = processed.replace(/[^0-9.,€$£¥\s]/g, '');
      break;
      
    case RegionType.HEADING:
      // Capitalize headings
      processed = processed.replace(/\b\w/g, c => c.toUpperCase());
      break;
      
    case RegionType.SMALL_PRINT:
    case RegionType.DESCRIPTION:
    default:
      // General text cleaning
      processed = processed.replace(/[\r\n]+/g, ' ');
      break;
  }
  
  return processed;
}

/**
 * Analyze image layout to detect regions
 * 
 * @param imagePath Path to the image
 * @returns Promise resolving to detected regions
 */
async function analyzeImageLayout(imagePath: string): Promise<TextRegion[]> {
  return new Promise((resolve, reject) => {
    // Run Python script for layout analysis
    const pythonScript = path.join(process.cwd(), 'scripts', 'analyze_layout.py');
    
    // If Python script doesn't exist, use fallback approach
    if (!fs.existsSync(pythonScript)) {
      logger.warn(`Python layout analysis script not found: ${pythonScript}. Using fallback approach.`);
      return resolve([]);
    }
    
    // Execute Python script
    const pythonProcess = spawn('python', [pythonScript, imagePath]) as any;
    
    let outputData = '';
    let errorOutput = '';
    
    pythonProcess.stdout.on('data', (data: any) => {
      outputData += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data: any) => {
      errorOutput += data.toString();
    });
    
    pythonProcess.on('close', (code: number) => {
      if (code !== 0) {
        logger.error(`Layout analysis failed with code ${code}: ${errorOutput}`);
        return resolve([]); // Return empty array instead of rejecting
      }
      
      try {
        // Parse JSON output from Python script
        const regions = JSON.parse(outputData) as TextRegion[];
        resolve(regions);
      } catch (err) {
        logger.error(`Failed to parse layout analysis output: ${err}`);
        resolve([]);
      }
    });
  });
}

/**
 * Get image dimensions using OpenCV
 * 
 * @param imagePath Path to the image
 * @returns Promise resolving to image dimensions
 */
async function getImageDimensions(imagePath: string): Promise<{ width: number; height: number; } | undefined> {
  return new Promise((resolve) => {
    // Run Python script to get image dimensions
    const pythonScript = path.join(process.cwd(), 'scripts', 'get_image_dimensions.py');
    
    // If Python script doesn't exist, use fallback approach
    if (!fs.existsSync(pythonScript)) {
      logger.warn(`Python script for image dimensions not found: ${pythonScript}. Using fallback.`);
      // In a real implementation, we'd use a Node.js library as fallback
      return resolve(undefined);
    }
    
    // Execute Python script
    const pythonProcess = spawn('python', [pythonScript, imagePath]) as any;
    
    let outputData = '';
    let errorOutput = '';
    
    pythonProcess.stdout.on('data', (data: any) => {
      outputData += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data: any) => {
      errorOutput += data.toString();
    });
    
    pythonProcess.on('close', (code: number) => {
      if (code !== 0) {
        logger.error(`Failed to get image dimensions: ${errorOutput}`);
        return resolve(undefined);
      }
      
      try {
        // Parse dimensions from output (expected format: "width,height")
        const [width, height] = outputData.trim().split(',').map(Number);
        if (width && height) {
          resolve({ width, height });
        } else {
          resolve(undefined);
        }
      } catch (err) {
        logger.error(`Failed to parse image dimensions: ${err}`);
        resolve(undefined);
      }
    });
  });
}

/**
 * Run region-based OCR on multiple images
 * 
 * @param imagePaths Array of paths to image files
 * @param options Options for processing
 * @returns Promise resolving to OCR results for each image
 */
export async function batchProcessImagesWithRegions(
  imagePaths: string[],
  options: {
    concurrency?: number;
    timeout?: number;
  } = {}
): Promise<Record<string, RegionBasedOCRResult>> {
  const concurrency = options.concurrency || 4;
  const results: Record<string, RegionBasedOCRResult> = {};
  
  // Process images in batches to control concurrency
  for (let i = 0; i < imagePaths.length; i += concurrency) {
    const batch = imagePaths.slice(i, i + concurrency);
    
    logger.info(`Processing batch ${Math.floor(i / concurrency) + 1} of ${Math.ceil(imagePaths.length / concurrency)}`);
    
    const batchPromises = batch.map(imagePath => {
      // Wrap in a timeout to prevent hanging
      return Promise.race([
        processImageWithRegions(imagePath),
        new Promise<RegionBasedOCRResult>((resolve) => {
          setTimeout(() => {
            resolve({
              imagePath,
              regions: [],
              processingTime: options.timeout || 60000,
              status: 'failed',
              errorMessage: 'Processing timed out'
            });
          }, options.timeout || 60000);
        })
      ])
      .then(result => {
        results[imagePath] = result;
        return result;
      })
      .catch(err => {
        logger.error(`Error processing image ${imagePath}: ${err}`);
        results[imagePath] = {
          imagePath,
          regions: [],
          processingTime: 0,
          status: 'failed',
          errorMessage: `Error: ${err}`
        };
        return results[imagePath];
      });
    });
    
    await Promise.all(batchPromises);
  }
  
  return results;
}

/**
 * Process an image and extract specifications text adjacent to the main product image
 * 
 * @param imagePath Path to the image
 * @returns Promise resolving to extracted specifications
 */
export async function extractSpecificationsText(imagePath: string): Promise<string> {
  try {
    logger.info(`Extracting specifications text from image: ${imagePath}`);
    
    // Process image with region-based OCR
    const result = await processImageWithRegions(imagePath);
    
    if (result.status === 'failed') {
      logger.warn(`Failed to extract specifications from image: ${result.errorMessage}`);
      return '';
    }
    
    // Find specification regions
    const specRegions = result.regions.filter(r => 
      r.type === RegionType.SPECIFICATIONS && r.text && r.confidence && r.confidence > 0.4
    );
    
    if (specRegions.length === 0) {
      logger.warn(`No specification regions found in image`);
      return '';
    }
    
    // Combine text from all specification regions
    return specRegions.map(r => r.text).join('\n\n');
  } catch (error) {
    logger.error(`Error extracting specifications text: ${error}`);
    return '';
  }
}