/**
 * Property Template Model
 * 
 * This model represents property templates for materials in the system.
 * It supports inheritance based on material type hierarchies.
 */

import mongoose from 'mongoose';
import { Document, Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

/**
 * Property Template document interface
 */
export interface PropertyTemplateDocument extends Document {
  id: string;
  name: string;
  description?: string;
  materialType?: string;
  categoryId?: string;
  parentTemplateId?: string;
  isActive: boolean;
  priority: number;
  properties: Record<string, any>;
  overrideRules: {
    field: string;
    condition?: string;
    value?: any;
  }[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Property Template schema
 */
const propertyTemplateSchema = new Schema<PropertyTemplateDocument>(
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
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    materialType: {
      type: String,
      enum: [
        'tile',
        'stone',
        'wood',
        'laminate',
        'vinyl',
        'carpet',
        'metal',
        'glass',
        'concrete',
        'ceramic',
        'porcelain',
        'other'
      ]
    },
    categoryId: {
      type: String,
      ref: 'Category'
    },
    parentTemplateId: {
      type: String,
      ref: 'PropertyTemplate'
    },
    isActive: {
      type: Boolean,
      default: true
    },
    priority: {
      type: Number,
      default: 0
    },
    properties: {
      type: Schema.Types.Mixed,
      required: true,
      default: {}
    },
    overrideRules: [
      {
        field: {
          type: String,
          required: true
        },
        condition: {
          type: String
        },
        value: {
          type: Schema.Types.Mixed
        }
      }
    ],
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
propertyTemplateSchema.index({ id: 1 }, { unique: true });
propertyTemplateSchema.index({ materialType: 1 });
propertyTemplateSchema.index({ categoryId: 1 });
propertyTemplateSchema.index({ parentTemplateId: 1 });
propertyTemplateSchema.index({ priority: 1 });

/**
 * Property Template model
 */
const PropertyTemplate = mongoose.model<PropertyTemplateDocument>('PropertyTemplate', propertyTemplateSchema);

/**
 * Create a new property template
 * 
 * @param templateData Property template data
 * @returns Created property template document
 */
export async function createPropertyTemplate(templateData: Partial<PropertyTemplateDocument>): Promise<PropertyTemplateDocument> {
  try {
    const template = new PropertyTemplate(templateData);
    await template.save();
    return template;
  } catch (err) {
    logger.error(`Failed to create property template: ${err}`);
    throw new Error(`Failed to create property template: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Get a property template by ID
 * 
 * @param id Property template ID
 * @returns Property template document
 */
export async function getPropertyTemplateById(id: string): Promise<PropertyTemplateDocument | null> {
  try {
    return await PropertyTemplate.findOne({ id });
  } catch (err) {
    logger.error(`Failed to get property template: ${err}`);
    throw new Error(`Failed to get property template: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Update a property template
 * 
 * @param id Property template ID
 * @param updateData Update data
 * @returns Updated property template document
 */
export async function updatePropertyTemplate(id: string, updateData: Partial<PropertyTemplateDocument>): Promise<PropertyTemplateDocument | null> {
  try {
    const template = await PropertyTemplate.findOneAndUpdate(
      { id },
      { $set: updateData },
      { new: true }
    );
    return template;
  } catch (err) {
    logger.error(`Failed to update property template: ${err}`);
    throw new Error(`Failed to update property template: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Delete a property template
 * 
 * @param id Property template ID
 * @returns Deleted property template document
 */
export async function deletePropertyTemplate(id: string): Promise<PropertyTemplateDocument | null> {
  try {
    return await PropertyTemplate.findOneAndDelete({ id });
  } catch (err) {
    logger.error(`Failed to delete property template: ${err}`);
    throw new Error(`Failed to delete property template: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Get property templates
 * 
 * @param options Query options
 * @returns Array of property template documents
 */
export async function getPropertyTemplates(options: {
  materialType?: string;
  categoryId?: string;
  parentTemplateId?: string;
  isActive?: boolean;
  limit?: number;
  skip?: number;
  sort?: Record<string, 1 | -1>;
} = {}): Promise<{
  templates: PropertyTemplateDocument[];
  total: number;
}> {
  try {
    const { 
      materialType,
      categoryId,
      parentTemplateId,
      isActive,
      limit = 100, 
      skip = 0, 
      sort = { priority: -1, name: 1 } 
    } = options;
    
    // Build filter
    const filter: Record<string, any> = {};
    if (materialType !== undefined) {
      filter.materialType = materialType;
    }
    if (categoryId !== undefined) {
      filter.categoryId = categoryId;
    }
    if (parentTemplateId !== undefined) {
      filter.parentTemplateId = parentTemplateId;
    }
    if (isActive !== undefined) {
      filter.isActive = isActive;
    }
    
    const templates = await PropertyTemplate.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit);
    
    const total = await PropertyTemplate.countDocuments(filter);
    
    return {
      templates,
      total
    };
  } catch (err) {
    logger.error(`Failed to get property templates: ${err}`);
    throw new Error(`Failed to get property templates: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Get property templates for a material
 * 
 * @param materialType Material type
 * @param categoryId Category ID
 * @returns Array of property template documents
 */
export async function getPropertyTemplatesForMaterial(
  materialType: string,
  categoryId?: string
): Promise<PropertyTemplateDocument[]> {
  try {
    // Build filter for templates that apply to this material
    const filter: Record<string, any> = {
      isActive: true,
      $or: [
        { materialType },
        { materialType: { $exists: false } }
      ]
    };
    
    // Add category filter if provided
    if (categoryId) {
      filter.$or.push({ categoryId });
    }
    
    // Get templates sorted by priority (higher priority first)
    const templates = await PropertyTemplate.find(filter)
      .sort({ priority: -1, materialType: -1 });
    
    return templates;
  } catch (err) {
    logger.error(`Failed to get property templates for material: ${err}`);
    throw new Error(`Failed to get property templates for material: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export default PropertyTemplate;
