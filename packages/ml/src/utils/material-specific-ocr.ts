/**
 * Material-Specific OCR Extraction
 * 
 * This utility enhances OCR extraction by using material-specific patterns
 * and context-aware extraction for complex fields.
 */

import axios from 'axios';
import { logger } from './logger';
import { 
  getMetadataFieldsByMaterialType, 
  MetadataField 
} from './metadata-field-utils';
import { 
  detectMaterialType, 
  MaterialType, 
  MaterialTypeDetectionResult 
} from './material-type-detector';

/**
 * Interface for OCR extraction result
 */
export interface OcrExtractionResult {
  materialType: MaterialType;
  materialTypeConfidence: number;
  extractedFields: Record<string, any>;
  extractionConfidence: Record<string, number>;
  extractionMethods: Record<string, string>;
  rawText: string;
  processingTime: number;
}

/**
 * Interface for field extraction result
 */
interface FieldExtractionResult {
  value: any;
  confidence: number;
  method: string;
  pattern?: string;
}

/**
 * Extract value for a metadata field from OCR text
 * 
 * @param field Metadata field
 * @param ocrText OCR text
 * @returns Extraction result or null if not found
 */
export function extractValueFromOCR(
  field: MetadataField, 
  ocrText: string
): FieldExtractionResult | null {
  // Check if field has extraction patterns
  if (!field.extractionPatterns || field.extractionPatterns.length === 0) {
    return null;
  }
  
  // Try extraction patterns
  for (const pattern of field.extractionPatterns) {
    try {
      const regex = new RegExp(pattern, 'i');
      const match = ocrText.match(regex);
      
      if (match && match[1]) {
        const value = match[1].trim();
        
        // Convert value based on field type
        const convertedValue = convertFieldValue(field, value);
        
        return {
          value: convertedValue,
          confidence: 0.9, // High confidence for pattern match
          method: 'pattern',
          pattern
        };
      }
    } catch (error) {
      logger.warn(`Invalid extraction pattern ${pattern} for field ${field.name}: ${error}`);
    }
  }
  
  // If no pattern matched, try hint-based extraction
  if (field.hint) {
    const hintResult = extractValueUsingHint(field, ocrText);
    if (hintResult) {
      return hintResult;
    }
  }
  
  return null;
}

/**
 * Extract value using field hint
 * 
 * @param field Metadata field
 * @param ocrText OCR text
 * @returns Extraction result or null if not found
 */
function extractValueUsingHint(
  field: MetadataField, 
  ocrText: string
): FieldExtractionResult | null {
  // Split text into lines
  const lines = ocrText.split('\n');
  
  // Look for lines containing field name or display name
  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    const fieldName = field.name.toLowerCase();
    const displayName = field.displayName.toLowerCase();
    
    if (lowerLine.includes(fieldName) || lowerLine.includes(displayName)) {
      // Extract value after the field name or display name
      const parts = line.split(/[:：]/);
      
      if (parts.length > 1 && parts[1] !== undefined) {
        const value = parts[1].trim();
        const convertedValue = convertFieldValue(field, value);
        
        return {
          value: convertedValue,
          confidence: 0.7, // Medium confidence for hint-based extraction
          method: 'hint'
        };
      }
    }
  }
  
  return null;
}

/**
 * Convert field value based on field type
 * 
 * @param field Metadata field
 * @param value String value
 * @returns Converted value
 */
function convertFieldValue(field: MetadataField, value: string): any {
  switch (field.fieldType) {
    case 'number':
      // Extract numeric value
      const numMatch = value.match(/[\d.]+/);
      if (numMatch) {
        return parseFloat(numMatch[0]);
      }
      return null;
      
    case 'boolean':
      // Convert to boolean
      const lowerValue = value.toLowerCase();
      if (['yes', 'true', '1', 'y'].includes(lowerValue)) {
        return true;
      }
      if (['no', 'false', '0', 'n'].includes(lowerValue)) {
        return false;
      }
      return null;
      
    case 'dropdown':
      // Match with dropdown options
      if (field.options && field.options.length > 0) {
        // Try exact match first
        const exactMatch = field.options.find(option => 
          option.value.toLowerCase() === value.toLowerCase() || 
          option.label.toLowerCase() === value.toLowerCase()
        );
        
        if (exactMatch) {
          return exactMatch.value;
        }
        
        // Try partial match
        const partialMatch = field.options.find(option => 
          value.toLowerCase().includes(option.value.toLowerCase()) || 
          value.toLowerCase().includes(option.label.toLowerCase())
        );
        
        if (partialMatch) {
          return partialMatch.value;
        }
      }
      return value; // Return as is if no match
      
    default:
      return value;
  }
}

/**
 * Extract metadata from OCR text using material-specific fields
 * 
 * @param ocrText OCR text
 * @param imagePath Optional path to the image file
 * @param apiBaseUrl Base URL for the API
 * @param apiKey Optional API key for authentication
 * @returns Promise with extraction result
 */
export async function extractMetadataFromOCR(
  ocrText: string,
  imagePath?: string,
  apiBaseUrl?: string,
  apiKey?: string
): Promise<OcrExtractionResult> {
  const startTime = Date.now();
  
  logger.info('Extracting metadata from OCR text');
  
  // First, detect material type
  const materialTypeResult = await detectMaterialType(ocrText, imagePath, apiBaseUrl, apiKey);
  const materialType = materialTypeResult.materialType;
  
  logger.info(`Detected material type: ${materialType} with confidence ${materialTypeResult.confidence}`);
  
  // Get metadata fields for this material type
  const metadataFields = await getMetadataFieldsByMaterialType(materialType, apiBaseUrl, apiKey);
  
  logger.info(`Found ${metadataFields.length} metadata fields for material type ${materialType}`);
  
  // Extract values for each field
  const extractedFields: Record<string, any> = {};
  const extractionConfidence: Record<string, number> = {};
  const extractionMethods: Record<string, string> = {};
  
  for (const field of metadataFields) {
    const extractionResult = extractValueFromOCR(field, ocrText);
    
    if (extractionResult) {
      extractedFields[field.name] = extractionResult.value;
      extractionConfidence[field.name] = extractionResult.confidence;
      extractionMethods[field.name] = extractionResult.method;
      
      logger.debug(`Extracted ${field.name}: ${extractionResult.value} (confidence: ${extractionResult.confidence}, method: ${extractionResult.method})`);
    }
  }
  
  // Add context-aware extraction for complex fields
  await enhanceExtractionWithContext(
    extractedFields, 
    extractionConfidence, 
    extractionMethods, 
    ocrText, 
    materialType, 
    metadataFields
  );
  
  const processingTime = Date.now() - startTime;
  
  return {
    materialType,
    materialTypeConfidence: materialTypeResult.confidence,
    extractedFields,
    extractionConfidence,
    extractionMethods,
    rawText: ocrText,
    processingTime
  };
}

/**
 * Enhance extraction with context-aware processing
 * 
 * @param extractedFields Extracted fields
 * @param extractionConfidence Extraction confidence
 * @param extractionMethods Extraction methods
 * @param ocrText OCR text
 * @param materialType Material type
 * @param metadataFields Metadata fields
 */
async function enhanceExtractionWithContext(
  extractedFields: Record<string, any>,
  extractionConfidence: Record<string, number>,
  extractionMethods: Record<string, string>,
  ocrText: string,
  materialType: MaterialType,
  metadataFields: MetadataField[]
): Promise<void> {
  // Implement material-specific context-aware extraction
  
  // Example: For tiles, extract size from dimensions
  if (materialType === 'tile') {
    // If we have dimensions but not size, try to extract size
    if (extractedFields['dimensions'] && !extractedFields['size']) {
      const dimensions = extractedFields['dimensions'];
      const sizeMatch = dimensions.match(/(\d+)\s*[xX×]\s*(\d+)/);
      
      if (sizeMatch) {
        extractedFields['size'] = `${sizeMatch[1]}x${sizeMatch[2]}`;
        extractionConfidence['size'] = 0.8;
        extractionMethods['size'] = 'context';
        
        logger.debug(`Context-aware extraction: size = ${extractedFields['size']}`);
      }
    }
    
    // If we have size but not dimensions, use size as dimensions
    if (extractedFields['size'] && !extractedFields['dimensions']) {
      extractedFields['dimensions'] = extractedFields['size'];
      extractionConfidence['dimensions'] = extractionConfidence['size'];
      extractionMethods['dimensions'] = 'context';
      
      logger.debug(`Context-aware extraction: dimensions = ${extractedFields['dimensions']}`);
    }
  }
  
  // Example: For wood, extract width and length from dimensions
  if (materialType === 'wood') {
    // If we have dimensions but not width/length, try to extract them
    if (extractedFields['dimensions'] && (!extractedFields['width'] || !extractedFields['length'])) {
      const dimensions = extractedFields['dimensions'];
      const dimensionsMatch = dimensions.match(/(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)/);
      
      if (dimensionsMatch) {
        if (!extractedFields['width']) {
          extractedFields['width'] = parseFloat(dimensionsMatch[1]);
          extractionConfidence['width'] = 0.8;
          extractionMethods['width'] = 'context';
          
          logger.debug(`Context-aware extraction: width = ${extractedFields['width']}`);
        }
        
        if (!extractedFields['length']) {
          extractedFields['length'] = parseFloat(dimensionsMatch[2]);
          extractionConfidence['length'] = 0.8;
          extractionMethods['length'] = 'context';
          
          logger.debug(`Context-aware extraction: length = ${extractedFields['length']}`);
        }
      }
    }
  }
  
  // Add more material-specific context-aware extraction as needed
}
