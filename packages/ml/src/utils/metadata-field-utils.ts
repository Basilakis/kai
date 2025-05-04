/**
 * Metadata Field Utilities
 * 
 * This module provides utilities for working with metadata fields in ML training and processing.
 * It ensures that only metadata fields relevant to specific material types are used.
 */

import axios from 'axios';
import { logger } from '../utils/logger';

/**
 * Interface for metadata field
 */
export interface MetadataField {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  fieldType: 'text' | 'textarea' | 'number' | 'dropdown' | 'boolean' | 'date';
  isRequired: boolean;
  order: number;
  defaultValue?: any;
  validation?: {
    min?: number;
    max?: number;
    regex?: string;
    minLength?: number;
    maxLength?: number;
    step?: number;
    customMessage?: string;
  };
  options?: Array<{
    value: string;
    label: string;
  }>;
  unit?: string;
  hint?: string;
  extractionPatterns?: string[];
  extractionExamples?: string[];
  categories: string[];
  isActive: boolean;
}

/**
 * Get metadata fields for a specific material type
 * 
 * @param materialType The material type to get fields for
 * @param apiBaseUrl The base URL for the API
 * @param apiKey Optional API key for authentication
 * @returns Promise with array of metadata fields
 */
export async function getMetadataFieldsByMaterialType(
  materialType: string,
  apiBaseUrl: string = process.env.API_BASE_URL || 'http://localhost:3000/api',
  apiKey?: string
): Promise<MetadataField[]> {
  try {
    // Set up request headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
    
    // Make API request to get metadata fields
    const response = await axios.get(`${apiBaseUrl}/admin/metadata-field`, {
      headers,
      params: {
        isActive: true
      }
    });
    
    if (!response.data || !response.data.fields) {
      logger.warn('No metadata fields found or unexpected API response format');
      return [];
    }
    
    // Filter fields by material type
    // Include fields that are either specific to this material type or common to all types
    const fields = response.data.fields.filter((field: MetadataField) => {
      return field.categories.includes(materialType) || field.categories.includes('all');
    });
    
    logger.info(`Found ${fields.length} metadata fields for material type: ${materialType}`);
    return fields;
  } catch (error) {
    logger.error(`Error fetching metadata fields for material type ${materialType}: ${error}`);
    throw new Error(`Failed to fetch metadata fields: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Group metadata fields by category
 * 
 * @param fields Array of metadata fields
 * @returns Object with fields grouped by category
 */
export function groupFieldsByCategory(fields: MetadataField[]): Record<string, MetadataField[]> {
  const groupedFields: Record<string, MetadataField[]> = {};
  
  for (const field of fields) {
    for (const category of field.categories) {
      if (!groupedFields[category]) {
        groupedFields[category] = [];
      }
      
      groupedFields[category].push(field);
    }
  }
  
  return groupedFields;
}

/**
 * Extract field names from metadata fields
 * 
 * @param fields Array of metadata fields
 * @returns Array of field names
 */
export function getFieldNames(fields: MetadataField[]): string[] {
  return fields.map(field => field.name);
}

/**
 * Create training data structure based on metadata fields
 * 
 * @param materialType Material type
 * @param fields Array of metadata fields
 * @returns Object with training data structure
 */
export function createTrainingDataStructure(materialType: string, fields: MetadataField[]): Record<string, any> {
  // Create a structure for training data based on the fields
  const structure: Record<string, any> = {
    materialType,
    fields: getFieldNames(fields),
    fieldTypes: {},
    validationRules: {},
    extractionPatterns: {}
  };
  
  // Add field-specific information
  for (const field of fields) {
    structure.fieldTypes[field.name] = field.fieldType;
    
    if (field.validation) {
      structure.validationRules[field.name] = field.validation;
    }
    
    if (field.extractionPatterns && field.extractionPatterns.length > 0) {
      structure.extractionPatterns[field.name] = field.extractionPatterns;
    }
  }
  
  return structure;
}

/**
 * Prepare training configuration for a specific material type
 * 
 * @param materialType Material type to prepare training for
 * @param apiBaseUrl The base URL for the API
 * @param apiKey Optional API key for authentication
 * @returns Promise with training configuration
 */
export async function prepareTrainingConfigForMaterialType(
  materialType: string,
  apiBaseUrl?: string,
  apiKey?: string
): Promise<{
  materialType: string;
  fields: string[];
  fieldTypes: Record<string, string>;
  validationRules: Record<string, any>;
  extractionPatterns: Record<string, string[]>;
}> {
  // Get metadata fields for this material type
  const fields = await getMetadataFieldsByMaterialType(materialType, apiBaseUrl, apiKey);
  
  // Create training data structure
  return createTrainingDataStructure(materialType, fields);
}
