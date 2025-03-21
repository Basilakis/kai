/**
 * Metadata Field Model
 * 
 * This model represents customizable metadata fields for materials.
 * Each field includes hint information to guide AI extraction from images and documents.
 */

import mongoose from 'mongoose';
import { Document, Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

/**
 * Metadata field document interface
 */
export interface MetadataFieldDocument extends Document {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  fieldType: 'text' | 'textarea' | 'number' | 'dropdown' | 'boolean' | 'date';
  isRequired: boolean;
  order: number;
  defaultValue?: any;
  
  // Validation rules
  validation?: {
    min?: number;
    max?: number;
    regex?: string;
    minLength?: number;
    maxLength?: number;
    step?: number;
    customMessage?: string;
  };
  
  // Options for dropdown fields
  options?: Array<{
    value: string;
    label: string;
  }>;
  
  // For number fields
  unit?: string;
  
  // AI extraction hints
  hint?: string;
  extractionPatterns?: string[];
  extractionExamples?: string[];
  
  // Category associations
  categories: string[];
  
  // Status
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Metadata field schema
 */
const metadataFieldSchema = new Schema<MetadataFieldDocument>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      default: uuidv4
    },
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true
    },
    displayName: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    fieldType: {
      type: String,
      required: true,
      enum: ['text', 'textarea', 'number', 'dropdown', 'boolean', 'date']
    },
    isRequired: {
      type: Boolean,
      default: false
    },
    order: {
      type: Number,
      default: 0
    },
    defaultValue: {
      type: Schema.Types.Mixed
    },
    
    // Validation rules
    validation: {
      min: {
        type: Number
      },
      max: {
        type: Number
      },
      regex: {
        type: String
      },
      minLength: {
        type: Number
      },
      maxLength: {
        type: Number
      },
      step: {
        type: Number
      },
      customMessage: {
        type: String
      }
    },
    
    // Options for dropdown fields
    options: [
      {
        value: {
          type: String,
          required: true
        },
        label: {
          type: String,
          required: true
        }
      }
    ],
    
    // For number fields
    unit: {
      type: String
    },
    
    // AI extraction hints
    hint: {
      type: String
    },
    extractionPatterns: {
      type: [String]
    },
    extractionExamples: {
      type: [String]
    },
    
    // Category associations
    categories: {
      type: [String],
      required: true,
      default: []
    },
    
    // Status
    isActive: {
      type: Boolean,
      default: true
    },
    createdBy: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// Create indexes
metadataFieldSchema.index({ id: 1 }, { unique: true });
metadataFieldSchema.index({ name: 1 }, { unique: true });
metadataFieldSchema.index({ fieldType: 1 });
metadataFieldSchema.index({ categories: 1 });
metadataFieldSchema.index({ isActive: 1 });

/**
 * Pre-validation middleware to ensure field type specific requirements
 */
metadataFieldSchema.pre('validate', function(this: any, next: any) {
  // Validate dropdown fields have options
  if (this.fieldType === 'dropdown' && (!this.options || this.options.length === 0)) {
    this.invalidate('options', 'Dropdown fields must have at least one option');
  }
  
  // Validate number fields with validation rules
  if (this.fieldType === 'number') {
    if (this.validation?.min !== undefined && this.validation?.max !== undefined) {
      if (this.validation.min > this.validation.max) {
        this.invalidate('validation.min', 'Minimum value cannot be greater than maximum');
      }
    }
  }
  
  // Validate text fields with length constraints
  if (this.fieldType === 'text' || this.fieldType === 'textarea') {
    if (this.validation?.minLength !== undefined && this.validation?.maxLength !== undefined) {
      if (this.validation.minLength > this.validation.maxLength) {
        this.invalidate('validation.minLength', 'Minimum length cannot be greater than maximum');
      }
    }
  }
  
  next();
});

/**
 * Metadata field model
 */
const MetadataField = mongoose.model<MetadataFieldDocument>('MetadataField', metadataFieldSchema);

/**
 * Create a new metadata field
 * 
 * @param fieldData Metadata field data
 * @returns Created metadata field document
 */
export async function createMetadataField(fieldData: Partial<MetadataFieldDocument>): Promise<MetadataFieldDocument> {
  try {
    const field = new MetadataField(fieldData);
    await field.save();
    return field;
  } catch (err) {
    logger.error(`Failed to create metadata field: ${err}`);
    throw new Error(`Failed to create metadata field: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Get a metadata field by ID
 * 
 * @param id Metadata field ID
 * @returns Metadata field document
 */
export async function getMetadataFieldById(id: string): Promise<MetadataFieldDocument | null> {
  try {
    return await MetadataField.findOne({ id });
  } catch (err) {
    logger.error(`Failed to get metadata field: ${err}`);
    throw new Error(`Failed to get metadata field: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Get a metadata field by name
 * 
 * @param name Metadata field name
 * @returns Metadata field document
 */
export async function getMetadataFieldByName(name: string): Promise<MetadataFieldDocument | null> {
  try {
    return await MetadataField.findOne({ name });
  } catch (err) {
    logger.error(`Failed to get metadata field by name: ${err}`);
    throw new Error(`Failed to get metadata field by name: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Update a metadata field
 * 
 * @param id Metadata field ID
 * @param updateData Update data
 * @returns Updated metadata field document
 */
export async function updateMetadataField(id: string, updateData: Partial<MetadataFieldDocument>): Promise<MetadataFieldDocument | null> {
  try {
    return await MetadataField.findOneAndUpdate(
      { id },
      { ...updateData, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
  } catch (err) {
    logger.error(`Failed to update metadata field: ${err}`);
    throw new Error(`Failed to update metadata field: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Delete a metadata field
 * 
 * @param id Metadata field ID
 * @returns Deleted metadata field document
 */
export async function deleteMetadataField(id: string): Promise<MetadataFieldDocument | null> {
  try {
    return await MetadataField.findOneAndDelete({ id });
  } catch (err) {
    logger.error(`Failed to delete metadata field: ${err}`);
    throw new Error(`Failed to delete metadata field: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Get all metadata fields
 * 
 * @param options Query options
 * @returns Array of metadata field documents
 */
export async function getMetadataFields(options: {
  fieldType?: string | string[];
  categoryId?: string;
  isActive?: boolean;
  limit?: number;
  skip?: number;
  sort?: Record<string, 1 | -1>;
} = {}): Promise<{
  fields: MetadataFieldDocument[];
  total: number;
}> {
  try {
    const {
      fieldType,
      categoryId,
      isActive = true,
      limit = 100,
      skip = 0,
      sort = { order: 1, name: 1 }
    } = options;
    
    // Build filter
    const filter: Record<string, any> = { isActive };
    
    if (fieldType) {
      filter.fieldType = Array.isArray(fieldType) ? { $in: fieldType } : fieldType;
    }
    
    if (categoryId) {
      filter.categories = categoryId;
    }
    
    const fields = await MetadataField.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit);
    
    const total = await MetadataField.countDocuments(filter);
    
    return { fields, total };
  } catch (err) {
    logger.error(`Failed to get metadata fields: ${err}`);
    throw new Error(`Failed to get metadata fields: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Get metadata fields for a specific category
 * 
 * @param categoryId Category ID
 * @param options Query options
 * @returns Array of metadata field documents
 */
export async function getMetadataFieldsByCategory(categoryId: string, options: {
  isActive?: boolean;
  limit?: number;
  skip?: number;
  sort?: Record<string, 1 | -1>;
} = {}): Promise<{
  fields: MetadataFieldDocument[];
  total: number;
}> {
  try {
    return await getMetadataFields({
      ...options,
      categoryId
    });
  } catch (err) {
    logger.error(`Failed to get metadata fields by category: ${err}`);
    throw new Error(`Failed to get metadata fields by category: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Validate value against metadata field constraints
 * 
 * @param field Metadata field document
 * @param value Value to validate
 * @returns Validation result with success flag and error message if applicable
 */
export function validateFieldValue(field: MetadataFieldDocument, value: any): { 
  isValid: boolean; 
  message?: string;
} {
  // Required validation
  if (field.isRequired && (value === undefined || value === null || value === '')) {
    return { isValid: false, message: `${field.displayName} is required` };
  }
  
  // Skip validation for undefined values if field is not required
  if (!field.isRequired && (value === undefined || value === null || value === '')) {
    return { isValid: true };
  }
  
  // Type-specific validations
  switch (field.fieldType) {
    case 'number':
      // Parse number
      const numValue = parseFloat(value);
      if (isNaN(numValue)) {
        return { isValid: false, message: `${field.displayName} must be a number` };
      }
      
      // Min/max validations
      if (field.validation?.min !== undefined && numValue < field.validation.min) {
        return { 
          isValid: false, 
          message: field.validation.customMessage || `${field.displayName} must be at least ${field.validation.min}` 
        };
      }
      
      if (field.validation?.max !== undefined && numValue > field.validation.max) {
        return { 
          isValid: false, 
          message: field.validation.customMessage || `${field.displayName} must be at most ${field.validation.max}` 
        };
      }
      
      // Step validation
      if (field.validation?.step !== undefined && field.validation.step > 0) {
        const remainder = numValue % field.validation.step;
        if (remainder !== 0) {
          return { 
            isValid: false, 
            message: field.validation.customMessage || `${field.displayName} must be a multiple of ${field.validation.step}` 
          };
        }
      }
      break;
      
    case 'text':
    case 'textarea':
      // Type validation
      if (typeof value !== 'string') {
        return { isValid: false, message: `${field.displayName} must be a string` };
      }
      
      // Length validations
      if (field.validation?.minLength !== undefined && value.length < field.validation.minLength) {
        return { 
          isValid: false, 
          message: field.validation.customMessage || `${field.displayName} must be at least ${field.validation.minLength} characters` 
        };
      }
      
      if (field.validation?.maxLength !== undefined && value.length > field.validation.maxLength) {
        return { 
          isValid: false, 
          message: field.validation.customMessage || `${field.displayName} must be at most ${field.validation.maxLength} characters` 
        };
      }
      
      // Regex validation
      if (field.validation?.regex) {
        const pattern = new RegExp(field.validation.regex);
        if (!pattern.test(value)) {
          return { 
            isValid: false, 
            message: field.validation.customMessage || `${field.displayName} has an invalid format` 
          };
        }
      }
      break;
      
    case 'dropdown':
      // Check value is in options
      const validOption = field.options?.some(option => option.value === value);
      if (!validOption) {
        return { isValid: false, message: `${field.displayName} has an invalid option` };
      }
      break;
      
    case 'boolean':
      // Check value is boolean
      if (typeof value !== 'boolean' && value !== 'true' && value !== 'false' && value !== 1 && value !== 0) {
        return { isValid: false, message: `${field.displayName} must be a boolean value` };
      }
      break;
      
    case 'date':
      // Check value is valid date
      const dateValue = new Date(value);
      if (isNaN(dateValue.getTime())) {
        return { isValid: false, message: `${field.displayName} must be a valid date` };
      }
      break;
  }
  
  return { isValid: true };
}

/**
 * Convert field value to the correct type based on field definition
 * 
 * @param field Metadata field document
 * @param value Raw value
 * @returns Typed value
 */
export function convertFieldValue(field: MetadataFieldDocument, value: any): any {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  
  switch (field.fieldType) {
    case 'number':
      return parseFloat(value);
      
    case 'boolean':
      if (typeof value === 'boolean') return value;
      if (value === 'true' || value === 1) return true;
      if (value === 'false' || value === 0) return false;
      return undefined;
      
    case 'date':
      return new Date(value);
      
    default:
      return value;
  }
}

/**
 * Extract hint for a specific field from OCR text
 * 
 * @param field Metadata field document
 * @param ocrText Extracted text from OCR
 * @returns Extracted value based on hint patterns
 */
export function extractValueFromOCR(field: MetadataFieldDocument, ocrText: string): any {
  if (!field.hint && (!field.extractionPatterns || field.extractionPatterns.length === 0)) {
    return undefined;
  }
  
  // Try extraction patterns if available
  if (field.extractionPatterns && field.extractionPatterns.length > 0) {
    for (const pattern of field.extractionPatterns) {
      try {
        const regex = new RegExp(pattern, 'i');
        const match = ocrText.match(regex);
        if (match && match[1]) {
          return convertFieldValue(field, match[1]);
        }
      } catch (err) {
        logger.warn(`Invalid extraction pattern ${pattern} for field ${field.name}: ${err}`);
      }
    }
  }
  
  // Use hint-based extraction if patterns don't match
  if (field.hint) {
    // This would implement more sophisticated logic based on the hint
    // For now, a simple example implementation
    const lines = ocrText.split('\n');
    for (const line of lines) {
      if (line.toLowerCase().includes(field.displayName.toLowerCase()) || 
          line.toLowerCase().includes(field.name.toLowerCase())) {
        // Extract value after the field name or display name
        const parts = line.split(':');
        if (parts.length > 1 && parts[1] !== undefined) {
          return convertFieldValue(field, parts[1].trim());
        }
      }
    }
  }
  
  return undefined;
}

export default MetadataField;