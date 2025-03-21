/**
 * OCR Service
 * 
 * This service is responsible for extracting text from images using Tesseract OCR.
 * It provides functionality to extract text from images and associate it with
 * the corresponding material images.
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { logger } from '../../utils/logger';

/**
 * Interface for simple OCR result used by region-based OCR
 */
export interface SimpleOCRResult {
  text: string;
  confidence: number;
}

/**
 * Interface for OCR result with detailed position information
 */
export interface OCRResult {
  text: string;
  confidence: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * Simple OCR function for region-based extraction
 * 
 * This function provides a simplified interface for the regionBasedOCR module
 * and returns a basic SimpleOCRResult with just text and confidence.
 * 
 * @param imagePath Path to the image file
 * @param options Optional OCR settings
 * @returns Promise with SimpleOCRResult containing extracted text and confidence
 */
export async function performOCR(
  imagePath: string,
  options: {
    language?: string;
    ocrEngine?: number;
    preprocess?: boolean;
  } = {}
): Promise<SimpleOCRResult> {
  try {
    // Use the more detailed extractTextFromImage function
    const results = await extractTextFromImage(imagePath, options);
    
    // If no results, return empty text with zero confidence
    if (!results || results.length === 0) {
      return {
        text: '',
        confidence: 0
      };
    }
    
    // Combine all text from results
    const combinedText = results.map(result => result.text).join('\n');
    
    // Calculate average confidence
    const avgConfidence = results.reduce((sum, result) => sum + result.confidence, 0) / results.length;
    
    return {
      text: combinedText,
      confidence: avgConfidence
    };
  } catch (error) {
    logger.error(`Error performing OCR on ${imagePath}: ${error}`);
    return {
      text: '',
      confidence: 0
    };
  }
}

/**
 * Extract text from an image using Tesseract OCR
 * 
 * @param imagePath Path to the image file
 * @param options OCR options
 * @returns Array of extracted text with confidence scores and bounding boxes
 */
export async function extractTextFromImage(
  imagePath: string,
  options: {
    language?: string;
    ocrEngine?: number;
    preprocess?: boolean;
  } = {}
): Promise<OCRResult[]> {
  logger.info(`Extracting text from image: ${imagePath}`);
  
  // Default options
  const ocrOptions = {
    language: 'eng',
    ocrEngine: 3, // Default to LSTM engine
    preprocess: true,
    ...options
  };
  
  try {
    // Validate file exists
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Image file not found: ${imagePath}`);
    }
    
    // If preprocessing is enabled, preprocess the image
    let processedImagePath = imagePath;
    if (ocrOptions.preprocess) {
      processedImagePath = await preprocessImage(imagePath);
    }
    
    // Run Tesseract OCR
    const ocrResults = await runTesseractOCR(processedImagePath, ocrOptions);
    
    // Clean up preprocessed image if it's different from the original
    if (ocrOptions.preprocess && processedImagePath !== imagePath) {
      try {
        fs.unlinkSync(processedImagePath);
      } catch (err) {
        logger.warn(`Failed to clean up preprocessed image: ${err}`);
      }
    }
    
    return ocrResults;
  } catch (err) {
    logger.error(`OCR processing failed: ${err}`);
    throw err;
  }
}

/**
 * Preprocess an image to improve OCR accuracy
 * 
 * @param imagePath Path to the image file
 * @returns Path to the preprocessed image
 */
async function preprocessImage(imagePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Create output path for preprocessed image
    const outputPath = `${imagePath.substring(0, imagePath.lastIndexOf('.'))}_preprocessed.png`;
    
    // Run Python script for image preprocessing
    const pythonScript = path.join(process.cwd(), 'scripts', 'preprocess_image.py');
    
    // Ensure the Python script exists
    if (!fs.existsSync(pythonScript)) {
      logger.warn(`Python preprocessing script not found: ${pythonScript}. Using original image.`);
      return resolve(imagePath);
    }
    
    const pythonProcess = spawn('python', [pythonScript, imagePath, outputPath]);
    
    let errorData = '';
    
    pythonProcess.stderr.on('data', (data: Buffer) => {
      errorData += data.toString();
    });
    
    pythonProcess.on('close', (code: number) => {
      if (code !== 0) {
        logger.warn(`Image preprocessing failed with code ${code}: ${errorData}. Using original image.`);
        return resolve(imagePath);
      }
      
      if (!fs.existsSync(outputPath)) {
        logger.warn(`Preprocessed image not found at ${outputPath}. Using original image.`);
        return resolve(imagePath);
      }
      
      logger.info(`Image preprocessed successfully: ${outputPath}`);
      resolve(outputPath);
    });
  });
}

/**
 * Run Tesseract OCR on an image
 * 
 * @param imagePath Path to the image file
 * @param options OCR options
 * @returns Array of OCR results
 */
async function runTesseractOCR(
  imagePath: string,
  options: {
    language: string;
    ocrEngine: number;
  }
): Promise<OCRResult[]> {
  return new Promise((resolve, reject) => {
    // Create temporary output directory for Tesseract
    const outputDir = path.join(path.dirname(imagePath), 'ocr_output');
    const outputBase = path.join(outputDir, 'output');
    
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Run Tesseract OCR
    const tesseractProcess = spawn('tesseract', [
      imagePath,
      outputBase,
      '-l', options.language,
      '--oem', options.ocrEngine.toString(),
      '--psm', '6', // Assume a single uniform block of text
      '-c', 'preserve_interword_spaces=1',
      'hocr' // Output format (HTML + OCR)
    ]);
    
    let errorData = '';
    
    tesseractProcess.stderr.on('data', (data: Buffer) => {
      errorData += data.toString();
    });
    
    tesseractProcess.on('close', (code: number) => {
      if (code !== 0) {
        return reject(new Error(`Tesseract OCR failed with code ${code}: ${errorData}`));
      }
      
      // Read the HOCR output file
      const hocrFile = `${outputBase}.hocr`;
      if (!fs.existsSync(hocrFile)) {
        return reject(new Error(`Tesseract output file not found: ${hocrFile}`));
      }
      
      try {
        // Parse HOCR file to extract text, confidence, and bounding boxes
        const hocrContent = fs.readFileSync(hocrFile, 'utf8');
        const ocrResults = parseHOCR(hocrContent);
        
        // Clean up temporary files
        try {
          fs.unlinkSync(hocrFile);
          fs.rmdirSync(outputDir);
        } catch (err) {
          logger.warn(`Failed to clean up Tesseract output files: ${err}`);
        }
        
        resolve(ocrResults);
      } catch (err) {
        reject(new Error(`Failed to parse Tesseract output: ${err}`));
      }
    });
  });
}

/**
 * Parse HOCR output to extract text, confidence, and bounding boxes
 * 
 * @param hocrContent HOCR content as string
 * @returns Array of OCR results
 */
function parseHOCR(hocrContent: string): OCRResult[] {
  const results: OCRResult[] = [];
  
  // Simple regex-based parsing for demonstration
  // In a production environment, use a proper HTML/XML parser
  const wordRegex = /<span class=['"]ocrx_word['"][^>]*title=['"]bbox (\d+) (\d+) (\d+) (\d+); conf: ([\d.-]+)['"][^>]*>(.*?)<\/span>/g;
  
  let match;
  while ((match = wordRegex.exec(hocrContent)) !== null) {
    const [, x1, y1, x2, y2, confidence, text] = match;
    
    if (text && text.trim()) {
      results.push({
        text: text.trim(),
        confidence: parseFloat(confidence || '0') / 100, // Convert to 0-1 range
        boundingBox: {
          x: parseInt(x1 || '0'),
          y: parseInt(y1 || '0'),
          width: parseInt(x2 || '0') - parseInt(x1 || '0'),
          height: parseInt(y2 || '0') - parseInt(y1 || '0')
        }
      });
    }
  }
  
  // Group words into lines based on y-coordinate proximity
  const groupedResults = groupWordsIntoLines(results);
  
  return groupedResults;
}

/**
 * Group words into lines based on y-coordinate proximity
 * 
 * @param words Array of word-level OCR results
 * @returns Array of line-level OCR results
 */
function groupWordsIntoLines(words: OCRResult[]): OCRResult[] {
  if (words.length === 0) {
    return [];
  }
  
  // Sort words by y-coordinate (top to bottom)
  words.sort((a, b) => {
    if (!a.boundingBox || !b.boundingBox) return 0;
    return a.boundingBox.y - b.boundingBox.y;
  });
  
  const lines: OCRResult[][] = [];
  // Handle the case when words[0] might be undefined
  let currentLine: OCRResult[] = [];
  if (words.length > 0 && words[0]) {
    currentLine = [words[0]];
  }
  
  // Group words into lines
  for (let i = 1; i < words.length; i++) {
    const currentWord = words[i];
    // Skip undefined words
    if (!currentWord) continue;
    
    const lastWord = currentLine.length > 0 ? currentLine[currentLine.length - 1] : null;
    
    // If there's no last word or either word doesn't have a bounding box, 
    // just add to current line
    if (!lastWord || !currentWord.boundingBox || !lastWord.boundingBox) {
      currentLine.push(currentWord);
      continue;
    }
    
    // If the word is on the same line (y-coordinate within threshold)
    const yDiff = Math.abs(currentWord.boundingBox.y - lastWord.boundingBox.y);
    const heightThreshold = Math.max(
      currentWord.boundingBox.height, 
      lastWord.boundingBox.height
    ) * 0.5;
    
    if (yDiff < heightThreshold) {
      currentLine.push(currentWord);
    } else {
      // Only add non-empty lines
      if (currentLine.length > 0) {
        lines.push(currentLine);
      }
      currentLine = [currentWord];
    }
  }
  
  // Add the last line
  if (currentLine.length > 0) {
    lines.push(currentLine);
  }
  
  // Sort words within each line by x-coordinate (left to right)
  lines.forEach(line => {
    line.sort((a, b) => {
      if (!a.boundingBox || !b.boundingBox) return 0;
      return a.boundingBox.x - b.boundingBox.x;
    });
  });
  
  // Combine words in each line into a single result
  return lines.map(line => {
    // Calculate average confidence
    const avgConfidence = line.reduce((sum, word) => sum + word.confidence, 0) / line.length;
    
    // Combine text with spaces
    const text = line.map(word => word.text).join(' ');
    
    // Calculate bounding box for the entire line
    const boundingBox = line.reduce(
      (box, word) => {
        if (!word.boundingBox) return box;
        
        return {
          x: Math.min(box.x, word.boundingBox.x),
          y: Math.min(box.y, word.boundingBox.y),
          width: Math.max(box.x + box.width, word.boundingBox.x + word.boundingBox.width) - Math.min(box.x, word.boundingBox.x),
          height: Math.max(box.y + box.height, word.boundingBox.y + word.boundingBox.height) - Math.min(box.y, word.boundingBox.y)
        };
      },
      {
        x: Number.MAX_SAFE_INTEGER,
        y: Number.MAX_SAFE_INTEGER,
        width: 0,
        height: 0
      }
    );
    
    return {
      text,
      confidence: avgConfidence,
      boundingBox
    };
  });
}

/**
 * Extract text from multiple images
 * 
 * @param imagePaths Array of paths to image files
 * @param options OCR options
 * @returns Array of OCR results for each image
 */
export async function batchExtractTextFromImages(
  imagePaths: string[],
  options: {
    language?: string;
    ocrEngine?: number;
    preprocess?: boolean;
    concurrency?: number;
  } = {}
): Promise<Record<string, OCRResult[]>> {
  const concurrency = options.concurrency || 4;
  const results: Record<string, OCRResult[]> = {};
  
  // Process images in batches to control concurrency
  for (let i = 0; i < imagePaths.length; i += concurrency) {
    const batch = imagePaths.slice(i, i + concurrency);
    const batchPromises = batch.map(imagePath => 
      extractTextFromImage(imagePath, options)
        .then(ocrResults => {
          results[imagePath] = ocrResults;
        })
        .catch(err => {
          logger.error(`Failed to extract text from ${imagePath}: ${err}`);
          results[imagePath] = [];
        })
    );
    
    await Promise.all(batchPromises);
  }
  
  return results;
}