/**
 * Enhanced Image Preprocessing for OCR
 * 
 * This module provides advanced image preprocessing techniques to improve OCR accuracy,
 * particularly for text adjacent to images in material catalogs.
 */

import * as cp from 'child_process';
const { spawn } = cp;
import * as path from 'path';
import * as fs from 'fs';
import { logger } from '../../utils/logger';

/**
 * Preprocessing options
 */
export interface PreprocessingOptions {
  /** Apply grayscale conversion */
  grayscale?: boolean;
  /** Apply noise reduction */
  denoise?: boolean;
  /** Apply contrast enhancement */
  enhanceContrast?: boolean;
  /** Apply sharpening */
  sharpen?: boolean;
  /** Apply thresholding to binarize the image */
  threshold?: boolean;
  /** Apply deskewing to straighten text */
  deskew?: boolean;
  /** Apply dilation to make text thicker */
  dilate?: boolean;
  /** Apply methods specifically optimized for small text */
  enhanceSmallText?: boolean;
  /** Scale factor to increase image resolution */
  scaleFactorPercent?: number;
  /** Border to add around the image to prevent text cutting */
  borderSizePx?: number;
}

/**
 * Preprocess an image to improve OCR accuracy, with specialized techniques for catalog text
 * 
 * @param imagePath Path to the input image
 * @param options Preprocessing options
 * @returns Path to the preprocessed image
 */
export async function enhancedPreprocessImage(
  imagePath: string,
  options: PreprocessingOptions = {}
): Promise<string> {
  logger.info(`Enhanced preprocessing for image: ${imagePath}`);
  
  // Merge with default options
  const preprocessOptions = {
    grayscale: true,
    denoise: true,
    enhanceContrast: true,
    sharpen: true,
    threshold: true,
    deskew: true,
    dilate: false,
    enhanceSmallText: true,
    scaleFactorPercent: 200, // Double the resolution
    borderSizePx: 5,
    ...options
  };
  
  // Create output path
  const outputPath = `${imagePath.substring(0, imagePath.lastIndexOf('.'))}_enhanced.png`;
  
  try {
    // Check if the Python script exists
    const pythonScript = path.join(process.cwd(), 'scripts', 'enhance_image_for_ocr.py');
    
    if (!fs.existsSync(pythonScript)) {
      logger.warn(`Enhanced preprocessing script not found: ${pythonScript}. Creating script...`);
      
      // Create the script directory if it doesn't exist
      const scriptDir = path.join(process.cwd(), 'scripts');
      if (!fs.existsSync(scriptDir)) {
        fs.mkdirSync(scriptDir, { recursive: true });
      }
      
      // Create the Python script
      fs.writeFileSync(pythonScript, generatePythonScript());
      logger.info(`Created preprocessing script: ${pythonScript}`);
    }
    
    // Execute Python script with options
    return new Promise((resolve, reject) => {
      const args = [
        pythonScript,
        imagePath,
        outputPath,
        '--grayscale', preprocessOptions.grayscale ? '1' : '0',
        '--denoise', preprocessOptions.denoise ? '1' : '0',
        '--enhance-contrast', preprocessOptions.enhanceContrast ? '1' : '0',
        '--sharpen', preprocessOptions.sharpen ? '1' : '0',
        '--threshold', preprocessOptions.threshold ? '1' : '0',
        '--deskew', preprocessOptions.deskew ? '1' : '0',
        '--dilate', preprocessOptions.dilate ? '1' : '0',
        '--enhance-small-text', preprocessOptions.enhanceSmallText ? '1' : '0',
        '--scale', preprocessOptions.scaleFactorPercent.toString(),
        '--border', preprocessOptions.borderSizePx.toString()
      ];
      
      const pythonProcess = spawn('python', args);
      
      let errorOutput = '';
      let standardOutput = '';
      
      pythonProcess.stdout.on('data', (data: Buffer) => {
        standardOutput += data.toString();
      });
      
      pythonProcess.stderr.on('data', (data: Buffer) => {
        errorOutput += data.toString();
      });
      
      pythonProcess.on('close', (code: number) => {
        if (code !== 0) {
          logger.error(`Image preprocessing failed with code ${code}: ${errorOutput}`);
          return resolve(imagePath); // Fall back to original image
        }
        
        if (!fs.existsSync(outputPath)) {
          logger.warn(`Preprocessed image not found: ${outputPath}. Using original image.`);
          return resolve(imagePath);
        }
        
        logger.info(`Image enhanced successfully: ${outputPath}`);
        resolve(outputPath);
      });
    });
  } catch (err) {
    logger.error(`Error in enhanced preprocessing: ${err}`);
    return imagePath; // Fall back to original image
  }
}

/**
 * Generate the Python script for enhanced image preprocessing
 * 
 * @returns Python script content as string
 */
function generatePythonScript(): string {
  return `#!/usr/bin/env python3
# Enhanced Image Preprocessing for OCR
# This script applies various image processing techniques to improve OCR accuracy.

import argparse
import cv2
import numpy as np
import os
import math
from PIL import Image, ImageEnhance

def parse_args():
    parser = argparse.ArgumentParser(description='Enhance image for OCR')
    parser.add_argument('input_path', help='Path to input image')
    parser.add_argument('output_path', help='Path to save enhanced image')
    parser.add_argument('--grayscale', type=int, default=1, help='Apply grayscale conversion')
    parser.add_argument('--denoise', type=int, default=1, help='Apply noise reduction')
    parser.add_argument('--enhance-contrast', type=int, default=1, help='Apply contrast enhancement')
    parser.add_argument('--sharpen', type=int, default=1, help='Apply sharpening')
    parser.add_argument('--threshold', type=int, default=1, help='Apply adaptive thresholding')
    parser.add_argument('--deskew', type=int, default=1, help='Apply deskewing')
    parser.add_argument('--dilate', type=int, default=0, help='Apply dilation')
    parser.add_argument('--enhance-small-text', type=int, default=1, help='Apply methods optimized for small text')
    parser.add_argument('--scale', type=int, default=200, help='Scale factor percentage (100 = original size)')
    parser.add_argument('--border', type=int, default=5, help='Border size in pixels')
    
    return parser.parse_args()

def deskew(image):
    # Convert to grayscale if not already
    if len(image.shape) == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    else:
        gray = image.copy()
    
    # Apply threshold to get binary image
    thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[1]
    
    # Find all contours
    contours, _ = cv2.findContours(thresh, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    
    # Find largest contour
    max_area = 0
    max_contour = None
    for contour in contours:
        area = cv2.contourArea(contour)
        if area > max_area:
            max_area = area
            max_contour = contour
    
    if max_contour is None:
        return image
    
    # Find minimum area rectangle and its angle
    rect = cv2.minAreaRect(max_contour)
    angle = rect[2]
    
    # Determine if the angle needs to be adjusted
    if angle < -45:
        angle = -(90 + angle)
    else:
        angle = -angle
    
    # Only deskew if angle is significant
    if abs(angle) < 0.1:
        return image
    
    # Get rotation matrix and apply transformation
    h, w = image.shape[:2]
    center = (w // 2, h // 2)
    M = cv2.getRotationMatrix2D(center, angle, 1.0)
    rotated = cv2.warpAffine(image, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
    
    return rotated

def enhance_small_text(image):
    # Convert to PIL Image for some operations
    if len(image.shape) == 3:
        pil_img = Image.fromarray(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
    else:
        pil_img = Image.fromarray(image)
    
    # Enhance sharpness
    enhancer = ImageEnhance.Sharpness(pil_img)
    pil_img = enhancer.enhance(2.0)  # Increase sharpness
    
    # Enhance contrast
    enhancer = ImageEnhance.Contrast(pil_img)
    pil_img = enhancer.enhance(1.5)  # Increase contrast
    
    # Convert back to OpenCV format
    if len(image.shape) == 3:
        return cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
    else:
        return np.array(pil_img)

def main():
    args = parse_args()
    
    # Check if input file exists
    if not os.path.exists(args.input_path):
        print(f"Error: Input file {args.input_path} not found.")
        return 1
    
    # Create output directory if it doesn't exist
    output_dir = os.path.dirname(args.output_path)
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    # Read image
    image = cv2.imread(args.input_path)
    if image is None:
        print(f"Error: Could not read image {args.input_path}")
        return 1
    
    # Add border to prevent text from being cut off
    if args.border > 0:
        image = cv2.copyMakeBorder(
            image, args.border, args.border, args.border, args.border,
            cv2.BORDER_CONSTANT, value=[255, 255, 255]
        )
    
    # Scale image to improve resolution
    if args.scale != 100:
        scale_factor = args.scale / 100.0
        image = cv2.resize(
            image, 
            None, 
            fx=scale_factor, 
            fy=scale_factor, 
            interpolation=cv2.INTER_CUBIC
        )
    
    # Convert to grayscale
    if args.grayscale:
        image = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    # Apply deskewing to straighten text
    if args.deskew:
        image = deskew(image)
    
    # Apply denoising
    if args.denoise:
        if len(image.shape) == 3:
            image = cv2.fastNlMeansDenoisingColored(image, None, 10, 10, 7, 21)
        else:
            image = cv2.fastNlMeansDenoising(image, None, 10, 7, 21)
    
    # Apply methods specifically for small text
    if args.enhance_small_text:
        image = enhance_small_text(image)
    
    # Convert to grayscale if not already (for subsequent operations)
    if len(image.shape) == 3 and args.threshold:
        image = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    # Apply contrast enhancement
    if args.enhance_contrast and len(image.shape) == 2:
        # Apply CLAHE (Contrast Limited Adaptive Histogram Equalization)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        image = clahe.apply(image)
    
    # Apply sharpening
    if args.sharpen and len(image.shape) == 2:
        kernel = np.array([[-1, -1, -1], 
                           [-1,  9, -1], 
                           [-1, -1, -1]])
        image = cv2.filter2D(image, -1, kernel)
    
    # Apply adaptive thresholding
    if args.threshold and len(image.shape) == 2:
        image = cv2.adaptiveThreshold(
            image, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
            cv2.THRESH_BINARY, 11, 2
        )
    
    # Apply dilation to make text thicker
    if args.dilate and len(image.shape) == 2:
        kernel = np.ones((2, 2), np.uint8)
        image = cv2.dilate(image, kernel, iterations=1)
    
    # Save enhanced image
    cv2.imwrite(args.output_path, image)
    print(f"Enhanced image saved to {args.output_path}")
    
    return 0

if __name__ == "__main__":
    exit(main())
`;
}

/**
 * Extract regions from an image for targeted OCR
 * 
 * @param imagePath Path to the image
 * @returns Paths to image regions optimized for different content types
 */
export async function extractRegionsFromImage(
  imagePath: string
): Promise<{
  fullImage: string;
  textRegions: string[];
  specificationRegions: string[];
}> {
  // For now, just return the full image. In a future implementation,
  // this would use computer vision to identify different regions.
  return {
    fullImage: imagePath,
    textRegions: [imagePath],
    specificationRegions: [imagePath]
  };
}