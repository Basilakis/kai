/**
 * Dataset Field Mapper
 * 
 * Handles mapping fields from external datasets to our system's metadata structure.
 * This allows importing datasets while preserving their metadata and mapping it to
 * our standardized material metadata schema.
 */

import { logger } from '../../utils/logger';

// Field mapping types
export interface FieldMapping {
  sourceField: string;
  targetField: string;
  transformFn?: (value: any) => any;
  defaultValue?: any;
}

export interface MaterialFieldGroup {
  name: string;
  fields: FieldDefinition[];
}

export interface FieldDefinition {
  id: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description?: string;
  required?: boolean;
  defaultValue?: any;
}

/**
 * Dataset Field Mapper
 * Maps fields from external datasets to our system's metadata structure
 */
export class DatasetFieldMapper {
  private mappings: FieldMapping[] = [];
  private materialType: string;
  private fieldDefinitions: Record<string, FieldDefinition> = {};

  /**
   * Create a new DatasetFieldMapper
   * @param materialType The type of material this dataset represents
   * @param initialMappings Optional initial field mappings
   */
  constructor(materialType: string, initialMappings: FieldMapping[] = []) {
    this.materialType = materialType;
    this.mappings = initialMappings;
    this.initializeFieldDefinitions();
  }

  /**
   * Initialize field definitions based on material type
   */
  private initializeFieldDefinitions() {
    // Common fields across all material types
    const commonFields: FieldDefinition[] = [
      {
        id: 'name',
        name: 'Name',
        type: 'string',
        description: 'Material name',
        required: true
      },
      {
        id: 'description',
        name: 'Description',
        type: 'string',
        description: 'Material description'
      },
      {
        id: 'manufacturer',
        name: 'Manufacturer',
        type: 'string',
        description: 'Manufacturer name'
      }
    ];

    // Material-specific fields
    let specificFields: FieldDefinition[] = [];

    switch (this.materialType) {
      case 'tile':
        specificFields = [
          {
            id: 'size',
            name: 'Size',
            type: 'string',
            description: 'Tile size (e.g., 60x60)'
          },
          {
            id: 'thickness',
            name: 'Thickness',
            type: 'number',
            description: 'Tile thickness in mm'
          },
          {
            id: 'finish',
            name: 'Finish',
            type: 'string',
            description: 'Surface finish (e.g., matte, polished)'
          },
          {
            id: 'vRating',
            name: 'V-Rating',
            type: 'string',
            description: 'Variation rating (V1-V4)'
          },
          {
            id: 'rRating',
            name: 'R-Rating',
            type: 'string',
            description: 'Slip resistance (R9-R13)'
          },
          {
            id: 'waterAbsorption',
            name: 'Water Absorption',
            type: 'number',
            description: 'Water absorption percentage'
          },
          {
            id: 'frostResistant',
            name: 'Frost Resistant',
            type: 'boolean',
            description: 'Whether the tile is frost resistant'
          },
          {
            id: 'peiRating',
            name: 'PEI Rating',
            type: 'string',
            description: 'PEI wear rating'
          },
          {
            id: 'rectified',
            name: 'Rectified',
            type: 'boolean',
            description: 'Whether the tile has rectified edges'
          },
          {
            id: 'usageArea',
            name: 'Usage Area',
            type: 'string',
            description: 'Recommended usage area'
          }
        ];
        break;
      case 'wood':
        specificFields = [
          {
            id: 'woodType',
            name: 'Wood Type',
            type: 'string',
            description: 'Type of wood'
          },
          {
            id: 'construction',
            name: 'Construction',
            type: 'string',
            description: 'Construction method'
          },
          {
            id: 'thickness',
            name: 'Thickness',
            type: 'number',
            description: 'Thickness in mm'
          },
          {
            id: 'width',
            name: 'Width',
            type: 'number',
            description: 'Width in mm'
          },
          {
            id: 'length',
            name: 'Length',
            type: 'number',
            description: 'Length in mm'
          },
          {
            id: 'grade',
            name: 'Grade',
            type: 'string',
            description: 'Wood grade'
          },
          {
            id: 'hardness',
            name: 'Hardness',
            type: 'number',
            description: 'Hardness rating'
          },
          {
            id: 'finish',
            name: 'Finish',
            type: 'string',
            description: 'Surface finish'
          }
        ];
        break;
      case 'fabric':
        specificFields = [
          {
            id: 'material',
            name: 'Material',
            type: 'string',
            description: 'Fabric material'
          },
          {
            id: 'pattern',
            name: 'Pattern',
            type: 'string',
            description: 'Fabric pattern'
          },
          {
            id: 'weight',
            name: 'Weight',
            type: 'number',
            description: 'Weight in g/m²'
          },
          {
            id: 'width',
            name: 'Width',
            type: 'number',
            description: 'Width in mm'
          },
          {
            id: 'washable',
            name: 'Washable',
            type: 'boolean',
            description: 'Whether the fabric is washable'
          }
        ];
        break;
      case 'metal':
        specificFields = [
          {
            id: 'metalType',
            name: 'Metal Type',
            type: 'string',
            description: 'Type of metal'
          },
          {
            id: 'thickness',
            name: 'Thickness',
            type: 'number',
            description: 'Thickness in mm'
          },
          {
            id: 'finish',
            name: 'Finish',
            type: 'string',
            description: 'Surface finish'
          },
          {
            id: 'hardness',
            name: 'Hardness',
            type: 'number',
            description: 'Hardness rating'
          }
        ];
        break;
      case 'stone':
        specificFields = [
          {
            id: 'stoneType',
            name: 'Stone Type',
            type: 'string',
            description: 'Type of stone'
          },
          {
            id: 'finish',
            name: 'Finish',
            type: 'string',
            description: 'Surface finish'
          },
          {
            id: 'porosity',
            name: 'Porosity',
            type: 'number',
            description: 'Porosity percentage'
          },
          {
            id: 'waterAbsorption',
            name: 'Water Absorption',
            type: 'number',
            description: 'Water absorption percentage'
          }
        ];
        break;
      case 'glass':
        specificFields = [
          {
            id: 'thickness',
            name: 'Thickness',
            type: 'number',
            description: 'Thickness in mm'
          },
          {
            id: 'transparency',
            name: 'Transparency',
            type: 'string',
            description: 'Transparency level'
          },
          {
            id: 'tempered',
            name: 'Tempered',
            type: 'boolean',
            description: 'Whether the glass is tempered'
          }
        ];
        break;
      case 'plastic':
        specificFields = [
          {
            id: 'plasticType',
            name: 'Plastic Type',
            type: 'string',
            description: 'Type of plastic'
          },
          {
            id: 'thickness',
            name: 'Thickness',
            type: 'number',
            description: 'Thickness in mm'
          },
          {
            id: 'flexibility',
            name: 'Flexibility',
            type: 'string',
            description: 'Flexibility level'
          }
        ];
        break;
      case 'paper':
        specificFields = [
          {
            id: 'paperType',
            name: 'Paper Type',
            type: 'string',
            description: 'Type of paper'
          },
          {
            id: 'weight',
            name: 'Weight',
            type: 'number',
            description: 'Weight in g/m²'
          },
          {
            id: 'thickness',
            name: 'Thickness',
            type: 'number',
            description: 'Thickness in mm'
          }
        ];
        break;
      default:
        // For unknown material types, use a generic set of fields
        specificFields = [
          {
            id: 'material',
            name: 'Material',
            type: 'string',
            description: 'Material type'
          },
          {
            id: 'color',
            name: 'Color',
            type: 'string',
            description: 'Material color'
          },
          {
            id: 'texture',
            name: 'Texture',
            type: 'string',
            description: 'Material texture'
          }
        ];
    }

    // Combine common and specific fields
    const allFields = [...commonFields, ...specificFields];
    
    // Create field definitions lookup
    this.fieldDefinitions = allFields.reduce((acc, field) => {
      acc[field.id] = field;
      return acc;
    }, {} as Record<string, FieldDefinition>);
  }

  /**
   * Get field definitions grouped by category
   * @returns Material field groups
   */
  public getFieldGroups(): MaterialFieldGroup[] {
    // Common fields group
    const commonGroup: MaterialFieldGroup = {
      name: 'General Information',
      fields: [
        this.fieldDefinitions['name'],
        this.fieldDefinitions['description'],
        this.fieldDefinitions['manufacturer']
      ].filter(Boolean) as FieldDefinition[]
    };

    // Physical properties group
    const physicalFields = [
      'size', 'thickness', 'width', 'length', 'weight', 'material',
      'woodType', 'stoneType', 'metalType', 'plasticType', 'paperType'
    ].map(id => this.fieldDefinitions[id]).filter(Boolean) as FieldDefinition[];

    // Technical properties group
    const technicalFields = [
      'vRating', 'rRating', 'waterAbsorption', 'frostResistant', 'peiRating',
      'hardness', 'porosity', 'transparency', 'tempered', 'flexibility'
    ].map(id => this.fieldDefinitions[id]).filter(Boolean) as FieldDefinition[];

    // Appearance group
    const appearanceFields = [
      'finish', 'rectified', 'color', 'pattern', 'texture'
    ].map(id => this.fieldDefinitions[id]).filter(Boolean) as FieldDefinition[];

    // Create groups based on available fields
    const groups: MaterialFieldGroup[] = [commonGroup];
    
    if (physicalFields.length > 0) {
      groups.push({
        name: 'Physical Properties',
        fields: physicalFields
      });
    }

    if (technicalFields.length > 0) {
      groups.push({
        name: 'Technical Properties',
        fields: technicalFields
      });
    }

    if (appearanceFields.length > 0) {
      groups.push({
        name: 'Appearance',
        fields: appearanceFields
      });
    }

    return groups;
  }

  /**
   * Get all field definitions as a flat array
   * @returns Array of field definitions
   */
  public getAllFields(): FieldDefinition[] {
    return Object.values(this.fieldDefinitions);
  }

  /**
   * Add or update a field mapping
   * @param mapping Field mapping to add
   * @returns The DatasetFieldMapper instance for chaining
   */
  public addMapping(mapping: FieldMapping): DatasetFieldMapper {
    // Check if this source field is already mapped
    const existingIndex = this.mappings.findIndex(m => m.sourceField === mapping.sourceField);
    
    if (existingIndex >= 0) {
      // Update existing mapping
      this.mappings[existingIndex] = mapping;
    } else {
      // Add new mapping
      this.mappings.push(mapping);
    }
    
    return this;
  }

  /**
   * Remove a field mapping
   * @param sourceField Source field to remove mapping for
   * @returns The DatasetFieldMapper instance for chaining
   */
  public removeMapping(sourceField: string): DatasetFieldMapper {
    this.mappings = this.mappings.filter(m => m.sourceField !== sourceField);
    return this;
  }

  /**
   * Clear all field mappings
   * @returns The DatasetFieldMapper instance for chaining
   */
  public clearMappings(): DatasetFieldMapper {
    this.mappings = [];
    return this;
  }

  /**
   * Get all current field mappings
   * @returns Array of field mappings
   */
  public getMappings(): FieldMapping[] {
    return [...this.mappings];
  }

  /**
   * Apply mappings to transform source data to our system's format
   * @param sourceData Source data object with fields to be mapped
   * @returns Transformed data object with our system's field structure
   */
  public applyMappings(sourceData: Record<string, any>): Record<string, any> {
    try {
      const result: Record<string, any> = {};

      // Apply each mapping
      for (const mapping of this.mappings) {
        const { sourceField, targetField, transformFn, defaultValue } = mapping;
        
        // Get source value
        const sourceValue = sourceData[sourceField];
        
        // If source value exists, transform if needed and assign to target
        if (sourceValue !== undefined) {
          result[targetField] = transformFn ? transformFn(sourceValue) : sourceValue;
        } 
        // Otherwise use default value if provided
        else if (defaultValue !== undefined) {
          result[targetField] = defaultValue;
        }
      }

      return result;
    } catch (err) {
      logger.error(`Error applying field mappings: ${err}`);
      throw new Error(`Failed to apply field mappings: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Apply mappings to a batch of source data items
   * @param sourceBatch Array of source data objects
   * @returns Array of transformed data objects
   */
  public applyMappingsBatch(sourceBatch: Record<string, any>[]): Record<string, any>[] {
    return sourceBatch.map(sourceItem => this.applyMappings(sourceItem));
  }

  /**
   * Guess appropriate mappings from source data sample
   * @param sampleData Sample of source data to analyze
   * @returns The DatasetFieldMapper instance with updated mappings
   */
  public guessMappings(sampleData: Record<string, any>): DatasetFieldMapper {
    if (!sampleData || Object.keys(sampleData).length === 0) {
      logger.warn('Cannot guess mappings: empty sample data provided');
      return this;
    }

    const newMappings: FieldMapping[] = [];
    const sourceFields = Object.keys(sampleData);
    
    // Get all our field definitions
    const targetFields = this.getAllFields();
    
    // Try to match source fields to our target fields based on name similarity
    for (const sourceField of sourceFields) {
      // Normalize the source field name for comparison
      const normalizedSourceField = sourceField.toLowerCase().replace(/[_\s-]/g, '');
      
      // Find the best matching target field
      let bestMatch: FieldDefinition | null = null;
      let bestScore = 0;
      
      for (const targetField of targetFields) {
        // Normalize the target field name for comparison
        const normalizedTargetName = targetField.name.toLowerCase().replace(/[_\s-]/g, '');
        const normalizedTargetId = targetField.id.toLowerCase().replace(/[_\s-]/g, '');
        
        // Check for exact matches first
        if (
          normalizedSourceField === normalizedTargetName || 
          normalizedSourceField === normalizedTargetId
        ) {
          bestMatch = targetField;
          bestScore = 1;
          break;
        }
        
        // Check for partial matches
        if (
          normalizedTargetName.includes(normalizedSourceField) || 
          normalizedSourceField.includes(normalizedTargetName) ||
          normalizedTargetId.includes(normalizedSourceField) || 
          normalizedSourceField.includes(normalizedTargetId)
        ) {
          // Calculate similarity score (simple approach)
          const score1 = normalizedSourceField.length / normalizedTargetName.length;
          const score2 = normalizedTargetName.length / normalizedSourceField.length;
          const score = Math.min(score1, score2);
          
          if (score > bestScore) {
            bestMatch = targetField;
            bestScore = score;
          }
        }
      }
      
      // If we found a match with reasonable confidence, add the mapping
      if (bestMatch && bestScore > 0.5) {
        newMappings.push({
          sourceField,
          targetField: bestMatch.id
        });
      }
    }
    
    // Update mappings
    this.mappings = newMappings;
    
    return this;
  }

  /**
   * Generate default transform function for a specific field type
   * @param targetFieldId Target field ID
   * @returns Transform function for the field
   */
  public getDefaultTransformForField(targetFieldId: string): ((value: any) => any) | undefined {
    const fieldDef = this.fieldDefinitions[targetFieldId];
    
    if (!fieldDef) {
      return undefined;
    }
    
    switch (fieldDef.type) {
      case 'number':
        return (value: any) => {
          if (typeof value === 'number') return value;
          if (typeof value === 'string') {
            // Extract numeric part from string (e.g., "12 mm" -> 12)
            const numMatch = value.match(/(-?\d+(\.\d+)?)/);
            return numMatch ? parseFloat(numMatch[0]) : null;
          }
          return null;
        };
      
      case 'boolean':
        return (value: any) => {
          if (typeof value === 'boolean') return value;
          if (typeof value === 'string') {
            const lowercased = value.toLowerCase();
            return lowercased === 'yes' || lowercased === 'true' || lowercased === '1';
          }
          if (typeof value === 'number') {
            return value !== 0;
          }
          return false;
        };
      
      case 'string':
        return (value: any) => {
          if (value === null || value === undefined) return '';
          return String(value);
        };
      
      case 'array':
        return (value: any) => {
          if (Array.isArray(value)) return value;
          if (typeof value === 'string') {
            // Try to parse comma-separated or JSON array
            if (value.startsWith('[') && value.endsWith(']')) {
              try {
                return JSON.parse(value);
              } catch {
                // Fall back to splitting by comma
                return value.split(',').map(v => v.trim());
              }
            }
            return value.split(',').map(v => v.trim());
          }
          return [value];
        };
      
      default:
        return undefined;
    }
  }
}

// Export types and class
export default DatasetFieldMapper;