/**
 * Catalog Model
 * 
 * This model represents a catalog of materials, typically uploaded as a PDF.
 * It tracks the processing status, extracted materials, and metadata.
 */

import mongoose, { Document, Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

/**
 * Catalog document interface
 */
export interface CatalogDocument extends Document {
  id: string;
  name: string;
  description?: string;
  manufacturer?: string;
  originalFilePath: string;
  s3Key?: string;
  s3Url?: string;
  fileSize?: number;
  fileType?: string;
  totalPages: number;
  processedPages: number;
  materialsExtracted?: number;
  status: 'pending' | 'processing' | 'extracting_images' | 'processing_text' | 'completed' | 'completed_with_errors' | 'failed';
  errorsCount?: number;
  errors?: Array<{
    type: string;
    message: string;
    page?: number;
    timestamp: Date;
  }>;
  processingStartedAt?: Date;
  completedAt?: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  tags?: string[];
  metadata?: Record<string, any>;
}

/**
 * Catalog schema
 */
const catalogSchema = new Schema<CatalogDocument>(
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
    manufacturer: {
      type: String,
      trim: true
    },
    originalFilePath: {
      type: String,
      required: true
    },
    s3Key: {
      type: String
    },
    s3Url: {
      type: String
    },
    fileSize: {
      type: Number
    },
    fileType: {
      type: String
    },
    totalPages: {
      type: Number,
      required: true,
      default: 0
    },
    processedPages: {
      type: Number,
      required: true,
      default: 0
    },
    materialsExtracted: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      required: true,
      enum: ['pending', 'processing', 'extracting_images', 'processing_text', 'completed', 'completed_with_errors', 'failed'],
      default: 'pending'
    },
    errorsCount: {
      type: Number,
      default: 0
    },
    errors: [
      {
        type: {
          type: String,
          required: true
        },
        message: {
          type: String,
          required: true
        },
        page: {
          type: Number
        },
        timestamp: {
          type: Date,
          default: Date.now
        }
      }
    ],
    processingStartedAt: {
      type: Date
    },
    completedAt: {
      type: Date
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
    },
    tags: [String],
    metadata: {
      type: Schema.Types.Mixed
    }
  },
  {
    timestamps: true
  }
);

// Create indexes
catalogSchema.index({ id: 1 }, { unique: true });
catalogSchema.index({ name: 1 });
catalogSchema.index({ manufacturer: 1 });
catalogSchema.index({ status: 1 });
catalogSchema.index({ createdBy: 1 });
catalogSchema.index({ createdAt: 1 });
catalogSchema.index({ tags: 1 });

/**
 * Catalog model
 */
const Catalog = mongoose.model<CatalogDocument>('Catalog', catalogSchema);

/**
 * Create a new catalog
 * 
 * @param catalogData Catalog data
 * @returns Created catalog document
 */
export async function createCatalog(catalogData: Partial<CatalogDocument>): Promise<CatalogDocument> {
  try {
    const catalog = new Catalog(catalogData);
    await catalog.save();
    return catalog;
  } catch (err) {
    throw new Error(`Failed to create catalog: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Get a catalog by ID
 * 
 * @param id Catalog ID
 * @returns Catalog document
 */
export async function getCatalogById(id: string): Promise<CatalogDocument | null> {
  try {
    return await Catalog.findOne({ id });
  } catch (err) {
    throw new Error(`Failed to get catalog: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Update a catalog
 * 
 * @param id Catalog ID
 * @param updateData Update data
 * @returns Updated catalog document
 */
export async function updateCatalog(id: string, updateData: Partial<CatalogDocument>): Promise<CatalogDocument | null> {
  try {
    return await Catalog.findOneAndUpdate(
      { id },
      { ...updateData, updatedAt: new Date() },
      { new: true }
    );
  } catch (err) {
    throw new Error(`Failed to update catalog: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Delete a catalog
 * 
 * @param id Catalog ID
 * @returns Deleted catalog document
 */
export async function deleteCatalog(id: string): Promise<CatalogDocument | null> {
  try {
    return await Catalog.findOneAndDelete({ id });
  } catch (err) {
    throw new Error(`Failed to delete catalog: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Get all catalogs
 * 
 * @param options Query options
 * @returns Array of catalog documents
 */
export async function getCatalogs(options: {
  limit?: number;
  skip?: number;
  sort?: Record<string, 1 | -1>;
  filter?: Record<string, any>;
} = {}): Promise<{
  catalogs: CatalogDocument[];
  total: number;
}> {
  try {
    const { limit = 10, skip = 0, sort = { createdAt: -1 }, filter = {} } = options;
    
    const catalogs = await Catalog.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit);
    
    const total = await Catalog.countDocuments(filter);
    
    return { catalogs, total };
  } catch (err) {
    throw new Error(`Failed to get catalogs: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Add an error to a catalog
 * 
 * @param id Catalog ID
 * @param error Error data
 * @returns Updated catalog document
 */
export async function addCatalogError(
  id: string,
  error: {
    type: string;
    message: string;
    page?: number;
  }
): Promise<CatalogDocument | null> {
  try {
    return await Catalog.findOneAndUpdate(
      { id },
      {
        $push: {
          errors: {
            ...error,
            timestamp: new Date()
          }
        },
        $inc: { errorsCount: 1 },
        updatedAt: new Date()
      },
      { new: true }
    );
  } catch (err) {
    throw new Error(`Failed to add catalog error: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export default Catalog;