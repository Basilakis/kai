/**
 * Metadata Descriptions Utility
 * 
 * This utility provides functions for accessing and working with
 * metadata field descriptions across the application.
 */

import { tileFieldDescriptions } from '../docs/tile-field-descriptions';

/**
 * Get the description for a specific field
 * @param fieldName The name of the field
 * @param materialType The type of material (tile, wood, etc.)
 * @returns The description of the field or undefined if not found
 */
export function getFieldDescription(fieldName: string, materialType: string): string | undefined {
  if (materialType === 'tile' && fieldName in tileFieldDescriptions) {
    return tileFieldDescriptions[fieldName];
  }
  
  // Add support for other material types here as they are implemented
  
  return undefined;
}

/**
 * Get all field descriptions for a specific material type
 * @param materialType The type of material (tile, wood, etc.)
 * @returns An object mapping field names to descriptions
 */
export function getAllFieldDescriptions(materialType: string): Record<string, string> {
  if (materialType === 'tile') {
    return { ...tileFieldDescriptions };
  }
  
  // Add support for other material types here as they are implemented
  
  return {};
}

/**
 * Get field descriptions for a specific set of fields
 * @param fieldNames Array of field names
 * @param materialType The type of material (tile, wood, etc.)
 * @returns An object mapping the specified field names to descriptions
 */
export function getFieldDescriptions(fieldNames: string[], materialType: string): Record<string, string> {
  const result: Record<string, string> = {};
  
  if (materialType === 'tile') {
    for (const fieldName of fieldNames) {
      if (fieldName in tileFieldDescriptions) {
        result[fieldName] = tileFieldDescriptions[fieldName];
      }
    }
  }
  
  // Add support for other material types here as they are implemented
  
  return result;
}

/**
 * Get field descriptions formatted for OpenAPI documentation
 * @param materialType The type of material (tile, wood, etc.)
 * @returns An object formatted for use in OpenAPI schemas
 */
export function getOpenApiFieldDescriptions(materialType: string): Record<string, { description: string }> {
  const descriptions = getAllFieldDescriptions(materialType);
  const result: Record<string, { description: string }> = {};
  
  for (const [fieldName, description] of Object.entries(descriptions)) {
    result[fieldName] = { description };
  }
  
  return result;
}

/**
 * Get field descriptions formatted for AI model training
 * @param materialType The type of material (tile, wood, etc.)
 * @returns An array of objects with field name, description, and examples
 */
export function getAiTrainingFieldDescriptions(materialType: string): Array<{ 
  fieldName: string; 
  description: string;
  examples?: string[];
}> {
  const descriptions = getAllFieldDescriptions(materialType);
  const result = [];
  
  for (const [fieldName, description] of Object.entries(descriptions)) {
    result.push({
      fieldName,
      description,
      // Add examples here if available
    });
  }
  
  return result;
}
