/**
 * Material Type Detector
 * 
 * This utility detects the material type from text or images.
 * It's used as the first step in OCR processing to determine which
 * metadata fields should be used for extraction.
 */

import axios from 'axios';
import { logger } from './logger';

// Define material types
export type MaterialType = 'tile' | 'wood' | 'lighting' | 'furniture' | 'decoration' | 'all';

// Keywords for material type detection
const MATERIAL_TYPE_KEYWORDS: Record<MaterialType, string[]> = {
  'tile': [
    'tile', 'tiles', 'ceramic', 'porcelain', 'mosaic', 'floor tile', 'wall tile',
    'glazed', 'unglazed', 'rectified', 'grout', 'pei rating', 'r-rating'
  ],
  'wood': [
    'wood', 'wooden', 'hardwood', 'timber', 'oak', 'maple', 'pine', 'walnut', 'cherry',
    'flooring', 'plank', 'veneer', 'solid wood', 'engineered wood', 'laminate'
  ],
  'lighting': [
    'light', 'lighting', 'lamp', 'chandelier', 'pendant', 'sconce', 'fixture',
    'bulb', 'led', 'lumens', 'brightness', 'illumination', 'ceiling light'
  ],
  'furniture': [
    'furniture', 'chair', 'table', 'sofa', 'couch', 'desk', 'cabinet', 'shelf',
    'bookcase', 'bed', 'dresser', 'nightstand', 'ottoman', 'stool', 'bench'
  ],
  'decoration': [
    'decoration', 'decor', 'ornament', 'vase', 'artwork', 'painting', 'sculpture',
    'mirror', 'rug', 'carpet', 'curtain', 'pillow', 'cushion', 'throw', 'blanket'
  ],
  'all': [] // Common fields applicable to all material types
};

/**
 * Interface for material type detection result
 */
export interface MaterialTypeDetectionResult {
  materialType: MaterialType;
  confidence: number;
  keywords?: string[];
  alternativeTypes?: Array<{
    materialType: MaterialType;
    confidence: number;
  }>;
}

/**
 * Detect material type from text
 * 
 * @param text Text to analyze
 * @returns Detection result with material type and confidence
 */
export function detectMaterialTypeFromText(text: string): MaterialTypeDetectionResult {
  logger.info('Detecting material type from text');
  
  // Convert text to lowercase for case-insensitive matching
  const lowerText = text.toLowerCase();
  
  // Count keyword occurrences for each material type
  const scores: Record<MaterialType, { count: number; keywords: string[] }> = {
    'tile': { count: 0, keywords: [] },
    'wood': { count: 0, keywords: [] },
    'lighting': { count: 0, keywords: [] },
    'furniture': { count: 0, keywords: [] },
    'decoration': { count: 0, keywords: [] },
    'all': { count: 0, keywords: [] }
  };
  
  // Check for explicit material type declarations
  const materialTypeMatch = lowerText.match(/material\s+type:?\s*(\w+)/i);
  if (materialTypeMatch && materialTypeMatch[1]) {
    const declaredType = materialTypeMatch[1].toLowerCase();
    
    // Check if the declared type matches a known material type
    for (const [materialType, keywords] of Object.entries(MATERIAL_TYPE_KEYWORDS)) {
      if (materialType === declaredType || keywords.includes(declaredType)) {
        logger.info(`Explicit material type declaration found: ${materialType}`);
        return {
          materialType: materialType as MaterialType,
          confidence: 0.9,
          keywords: [declaredType]
        };
      }
    }
  }
  
  // Count keyword occurrences
  for (const [materialType, keywords] of Object.entries(MATERIAL_TYPE_KEYWORDS)) {
    if (materialType === 'all') continue; // Skip 'all' type for keyword matching
    
    for (const keyword of keywords) {
      // Use word boundary to match whole words
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = lowerText.match(regex);
      
      if (matches) {
        scores[materialType as MaterialType].count += matches.length;
        scores[materialType as MaterialType].keywords.push(keyword);
      }
    }
  }
  
  // Find material type with highest score
  let maxScore = 0;
  let detectedType: MaterialType = 'all';
  let detectedKeywords: string[] = [];
  
  for (const [materialType, score] of Object.entries(scores)) {
    if (score.count > maxScore) {
      maxScore = score.count;
      detectedType = materialType as MaterialType;
      detectedKeywords = [...new Set(score.keywords)]; // Remove duplicates
    }
  }
  
  // Calculate confidence based on score
  // Higher score = higher confidence, with a maximum of 0.95
  const confidence = Math.min(0.5 + (maxScore * 0.05), 0.95);
  
  // If no keywords were found or confidence is too low, default to 'all'
  if (maxScore === 0 || confidence < 0.6) {
    logger.info('No clear material type detected, defaulting to "all"');
    return {
      materialType: 'all',
      confidence: 0.5
    };
  }
  
  // Get alternative types (those with at least 50% of the max score)
  const alternatives: Array<{ materialType: MaterialType; confidence: number }> = [];
  for (const [materialType, score] of Object.entries(scores)) {
    if (materialType !== detectedType && score.count >= maxScore * 0.5) {
      alternatives.push({
        materialType: materialType as MaterialType,
        confidence: Math.min(0.5 + (score.count * 0.05), 0.9)
      });
    }
  }
  
  logger.info(`Detected material type: ${detectedType} with confidence ${confidence}`);
  
  return {
    materialType: detectedType,
    confidence,
    keywords: detectedKeywords,
    alternativeTypes: alternatives.length > 0 ? alternatives : undefined
  };
}

/**
 * Detect material type from image using ML model
 * 
 * @param imagePath Path to the image file
 * @param apiBaseUrl Base URL for the API
 * @param apiKey Optional API key for authentication
 * @returns Promise with detection result
 */
export async function detectMaterialTypeFromImage(
  imagePath: string,
  apiBaseUrl: string = process.env.API_BASE_URL || 'http://localhost:3000/api',
  apiKey?: string
): Promise<MaterialTypeDetectionResult> {
  logger.info(`Detecting material type from image: ${imagePath}`);
  
  try {
    // Set up request headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
    
    // Make API request to material type classifier
    const response = await axios.post(`${apiBaseUrl}/ml/classify-material-type`, {
      imagePath
    }, { headers });
    
    if (response.data && response.data.materialType) {
      logger.info(`Detected material type from image: ${response.data.materialType} with confidence ${response.data.confidence}`);
      return response.data as MaterialTypeDetectionResult;
    }
    
    // Default to 'all' if no clear result
    logger.warn('No clear material type detected from image, defaulting to "all"');
    return {
      materialType: 'all',
      confidence: 0.5
    };
  } catch (error) {
    logger.error(`Error detecting material type from image: ${error}`);
    
    // Default to 'all' on error
    return {
      materialType: 'all',
      confidence: 0.5
    };
  }
}

/**
 * Detect material type from both text and image
 * 
 * @param text Text to analyze
 * @param imagePath Optional path to the image file
 * @param apiBaseUrl Base URL for the API
 * @param apiKey Optional API key for authentication
 * @returns Promise with detection result
 */
export async function detectMaterialType(
  text: string,
  imagePath?: string,
  apiBaseUrl?: string,
  apiKey?: string
): Promise<MaterialTypeDetectionResult> {
  // Detect from text
  const textResult = detectMaterialTypeFromText(text);
  
  // If text detection is confident enough, use it
  if (textResult.confidence >= 0.8) {
    return textResult;
  }
  
  // If image path is provided, try image detection
  if (imagePath) {
    try {
      const imageResult = await detectMaterialTypeFromImage(imagePath, apiBaseUrl, apiKey);
      
      // If image detection is more confident, use it
      if (imageResult.confidence > textResult.confidence) {
        return imageResult;
      }
    } catch (error) {
      logger.warn(`Error in image-based material type detection: ${error}`);
      // Continue with text result on error
    }
  }
  
  // Default to text result
  return textResult;
}
