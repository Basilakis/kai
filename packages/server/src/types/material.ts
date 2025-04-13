/**
 * Server Material Types
 *
 * Extended material type definitions specific to the server package,
 * building on the shared base material definitions.
 * 
 * This file utilizes the extension mechanisms provided by the shared types
 * to ensure consistency across packages while adding server-specific fields.
 */

import mongoose from 'mongoose';
import { 
  Material, 
  validateMaterial,
  MaterialCore,
  ServerMaterialBase,
  MaterialWithRelations
} from '../../../shared/src/types/material';
import { formatDate } from '../../../shared/src/utils/formatting';

const { Schema, model } = mongoose;

/**
 * MongoDB document fields
 * Standard fields added by Mongoose
 */
interface MongoDBFields {
  _id?: string;
  __v?: number;
}

/**
 * Server-specific processing fields
 */
interface ProcessingFields {
  indexStatus?: 'pending' | 'indexed' | 'failed';
  searchScore?: number;
  processingHistory?: {
    action: string;
    timestamp: Date;
    details?: string;
  }[];
}

/**
 * Access control fields
 */
interface AccessControlFields {
  accessControl?: {
    visibility: 'public' | 'private' | 'organization';
    accessList?: string[];
    owner?: string;
  };
}

/**
 * Storage and persistence fields
 */
interface StorageFields {
  storageDetails?: {
    location: string;
    size?: number;
    backupStatus?: 'none' | 'pending' | 'completed';
    lastBackup?: Date;
  };
}

/**
 * Audit and history tracking fields
 */
interface AuditFields {
  auditLog?: {
    action: string;
    performedBy: string;
    timestamp: Date;
    previousValues?: Partial<MaterialCore>;
  }[];
}

/**
 * Server-specific Material interface
 * Extends the ServerMaterialBase from shared package with additional server-specific fields
 * 
 * Using the ServerMaterialBase ensures we're building on the foundation
 * defined in the shared package.
 */
export interface ServerMaterial extends ServerMaterialBase, 
  MongoDBFields,
  ProcessingFields,
  AccessControlFields,
  StorageFields,
  AuditFields {}

/**
 * Server Material Document
 * For use with Mongoose ODM
 */
export interface MaterialDocument extends mongoose.Document, ServerMaterial {
  // Explicitly add mongoose document properties that are used in code
  isNew: boolean;
  updatedAt: Date;
}

/**
 * Mongoose schema for Material
 */
const MaterialSchema = new Schema({
  // Core fields from shared Material type
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: { type: String },
  type: { type: String, required: true },
  manufacturer: { type: String },
  collectionId: { type: Schema.Types.ObjectId, ref: 'Collection' },
  categoryId: { type: Schema.Types.ObjectId, ref: 'Category' },
  tags: [{ type: String }],
  images: [{
    id: { type: String, required: true },
    url: { type: String, required: true },
    type: { type: String, default: 'primary' },
    width: { type: Number },
    height: { type: Number },
    fileSize: { type: Number },
    extractedFrom: {
      catalogId: String,
      page: Number,
      coordinates: {
        x: Number,
        y: Number,
        width: Number,
        height: Number
      }
    }
  }],
  metadata: { type: Schema.Types.Mixed },
  metadataConfidence: { type: Map, of: Number },
  dimensions: {
    width: { type: Number },
    height: { type: Number },
    depth: { type: Number },
    unit: { type: String, default: 'mm' }
  },
  color: {
    name: { type: String },
    hex: { type: String },
    rgb: {
      r: { type: Number, min: 0, max: 255 },
      g: { type: Number, min: 0, max: 255 },
      b: { type: Number, min: 0, max: 255 }
    },
    primary: { type: Boolean, default: true },
    secondary: [{ type: String }]
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  createdBy: { type: String },
  vectorRepresentation: [{ type: Number }],
  
  // Additional server-specific fields
  materialType: { type: String, enum: ['tile', 'stone', 'wood', 'laminate', 'vinyl', 'carpet', 'metal', 'glass', 'concrete', 'ceramic', 'porcelain', 'other'] },
  finish: { type: String },
  pattern: { type: String },
  texture: { type: String },
  catalogId: { type: String },
  catalogPage: { type: Number },
  extractedAt: { type: Date },
  technicalSpecs: { type: Map, of: Schema.Types.Mixed },
  
  // Server implementation specific fields
  indexStatus: { 
    type: String, 
    enum: ['pending', 'indexed', 'failed'],
    default: 'pending'
  },
  searchScore: { type: Number },
  processingHistory: [{
    action: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    details: { type: String }
  }],
  accessControl: {
    visibility: { 
      type: String, 
      enum: ['public', 'private', 'organization'],
      default: 'public'
    },
    accessList: [{ type: String }],
    owner: { type: String }
  },
  storageDetails: {
    location: { type: String, required: true },
    size: { type: Number },
    backupStatus: { 
      type: String,
      enum: ['none', 'pending', 'completed'],
      default: 'none'
    },
    lastBackup: { type: Date }
  },
  auditLog: [{
    action: { type: String, required: true },
    performedBy: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    previousValues: { type: Schema.Types.Mixed }
  }]
});

// Define indexes for better search performance
MaterialSchema.index({ name: 'text', description: 'text', 'metadata.keywords': 'text' });
MaterialSchema.index({ type: 1 });
MaterialSchema.index({ manufacturer: 1 });
MaterialSchema.index({ categoryId: 1 });
MaterialSchema.index({ collectionId: 1 });
MaterialSchema.index({ tags: 1 });
MaterialSchema.index({ 'color.name': 1 });
MaterialSchema.index({ indexStatus: 1 });
MaterialSchema.index({ 'accessControl.visibility': 1 });

// Middleware
MaterialSchema.pre('save', function(this: MaterialDocument, next: any) {
  this.updatedAt = new Date();
  
  // Add to processing history
  if (!this.isNew) {
    this.processingHistory = this.processingHistory || [];
    this.processingHistory.push({
      action: 'update',
      timestamp: new Date(),
      details: `Updated material properties on ${formatDate(new Date())}`
    });
  }
  
  next();
});

// Methods

// Convert to API response format
MaterialSchema.methods.toResponseObject = function(): ServerMaterial {
  const obj = this.toObject();
  
  // Ensure ID is always available as 'id'
  obj.id = obj.id || obj._id.toString();
  
  return obj;
};

// Validate against shared schema
MaterialSchema.methods.validateAgainstSharedSchema = function() {
  return validateMaterial(this.toObject());
};

// Static methods

// Search functionality
MaterialSchema.statics.searchByText = async function(query: string, options: any = {}) {
  const limit = options.limit || 20;
  const skip = options.skip || 0;
  
  return this.find(
    { $text: { $search: query } },
    { score: { $meta: "textScore" } }
  )
  .sort({ score: { $meta: "textScore" } })
  .limit(limit)
  .skip(skip)
  .exec();
};

// Vector search
MaterialSchema.statics.searchByVector = async function(_vectorQuery: number[], options: any = {}) {
  // This is a simplified example - real implementation would use a 
  // vector similarity search from a vector DB like Pinecone, Weaviate, etc.
  const limit = options.limit || 20;
  const skip = options.skip || 0;
  
  return this.find({ 
    vectorRepresentation: { $exists: true },
    'accessControl.visibility': options.visibility || 'public'
  })
    .limit(limit)
    .skip(skip)
    .exec();
};

// Hybrid search combining text and vector
MaterialSchema.statics.hybridSearch = async function(
  query: string, 
  vectorQuery: number[],
  options: any = {}
) {
  const textResults = await this.searchByText(query, options);
  const vectorResults = await this.searchByVector(vectorQuery, options);
  
  // In a real implementation, you'd combine and re-rank results
  // based on both text and vector similarity scores
  return [...new Set([...textResults, ...vectorResults])].slice(0, options.limit || 20);
};

// Convert from shared Material to ServerMaterial
MaterialSchema.statics.fromSharedMaterial = function(material: Material): Partial<ServerMaterial> {
  // Material from shared package includes createdBy as defined in MaterialCoreSchema
  // Use type assertion to help TypeScript recognize the property
  const createdByValue = (material as any).createdBy || 'system';
  
  return {
    ...material,
    indexStatus: 'pending',
    accessControl: {
      visibility: 'public',
      owner: createdByValue // Use extracted value to satisfy TypeScript
    },
    storageDetails: {
      location: 'default-storage',
    },
    processingHistory: [{
      action: 'import',
      timestamp: new Date(),
      details: 'Imported from shared Material format'
    }]
  };
};

// Export the model
export const MaterialModel = model<MaterialDocument>('Material', MaterialSchema);

// Helper function to convert between types
export function toServerMaterial(material: Material): ServerMaterial {
  // Material from shared package includes createdBy as defined in MaterialCoreSchema
  // Use type assertion to help TypeScript recognize the property
  const createdByValue = (material as any).createdBy || 'system';
  
  return {
    ...material,
    indexStatus: 'pending',
    accessControl: {
      visibility: 'public',
      owner: createdByValue // Use extracted value to satisfy TypeScript
    },
    storageDetails: {
      location: 'default-storage',
    }
  };
}

/**
 * Server Material With Relations
 * Extends both ServerMaterial and MaterialWithRelations
 * Ensures compatibility with the shared package's relation structure
 */
export interface ServerMaterialWithRelations extends ServerMaterial, MaterialWithRelations {
  // Maintain the relatedMaterials structure from MaterialWithRelations
  relatedMaterials?: {
    similar?: string[];
    complementary?: string[];
    alternatives?: string[];
    // Additional server-specific relations can be added here
  };
  
  // Additional server-specific relation data
  collection?: {
    id: string;
    name: string;
    description?: string;
  };
  category?: {
    id: string;
    name: string;
    path?: string;
    parentId?: string;
  };
  creator?: {
    id: string;
    username: string;
    email?: string;
  };
  
  // Reference to full material objects (can be used alongside IDs in relatedMaterials)
  relatedMaterialObjects?: ServerMaterial[];
}