/**
 * Material Model
 * 
 * This model represents materials in the system, including tiles, stone, wood, etc.
 * It stores material specifications, images, and metadata extracted from catalogs.
 */

import mongoose from 'mongoose';
// Get Schema from mongoose instance
const { Schema } = mongoose;
// Use type augmentation approach for TypeScript types
import type { Document as MongooseDocument } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

/**
 * Base material schema definition
 */
const materialSchema = new Schema(
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
    // Collection organization
    collectionId: {
      type: String,
      ref: 'Collection'
    },
    seriesId: {
      type: String,
      ref: 'Collection'
    },
    
    // Physical properties
    dimensions: {
      width: {
        type: Number,
        required: true
      },
      height: {
        type: Number,
        required: true
      },
      depth: {
        type: Number
      },
      unit: {
        type: String,
        required: true,
        enum: ['mm', 'cm', 'inch', 'm', 'ft'],
        default: 'mm'
      }
    },
    
    color: {
      name: {
        type: String,
        required: true
      },
      hex: {
        type: String,
        match: /^#[0-9A-Fa-f]{6}$/
      },
      rgb: {
        r: {
          type: Number,
          min: 0,
          max: 255
        },
        g: {
          type: Number,
          min: 0,
          max: 255
        },
        b: {
          type: Number,
          min: 0,
          max: 255
        }
      },
      primary: {
        type: Boolean,
        default: true
      },
      secondary: [String]
    },
    
    // Category and material type
    categoryId: {
      type: String,
      ref: 'Category'
    },
    materialType: {
      type: String,
      required: true,
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
    
    // Surface properties
    finish: {
      type: String,
      required: true
    },
    pattern: {
      type: String
    },
    texture: {
      type: String
    },
    
    // Technical specifications - varies by material type
    technicalSpecs: {
      type: Schema.Types.Mixed
    },
    
    // Images
    images: [
      {
        id: {
          type: String,
          required: true
        },
        url: {
          type: String,
          required: true
        },
        type: {
          type: String,
          required: true,
          enum: ['primary', 'secondary', 'detail', 'room-scene'],
          default: 'primary'
        },
        width: {
          type: Number,
          required: true
        },
        height: {
          type: Number,
          required: true
        },
        fileSize: {
          type: Number
        },
        extractedFrom: {
          catalogId: {
            type: String,
            required: true
          },
          page: {
            type: Number,
            required: true
          },
          coordinates: {
            x: {
              type: Number
            },
            y: {
              type: Number
            },
            width: {
              type: Number
            },
            height: {
              type: Number
            }
          }
        }
      }
    ],
    
    // Metadata
    tags: {
      type: [String],
      default: []
    },
    catalogId: {
      type: String,
      required: true
    },
    catalogPage: {
      type: Number
    },
    extractedAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    },
    createdBy: {
      type: String
    },
    
    // Vector representation for similarity search
    vectorRepresentation: [Number],
    
    // Structured metadata with field definitions
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    },
    
    // Metadata extraction confidence scores
    metadataConfidence: {
      type: Map,
      of: Number,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

// Create indexes
materialSchema.index({ id: 1 }, { unique: true });
materialSchema.index({ name: 1 });
materialSchema.index({ manufacturer: 1 });
materialSchema.index({ materialType: 1 });
materialSchema.index({ 'color.name': 1 });
materialSchema.index({ finish: 1 });
materialSchema.index({ tags: 1 });
materialSchema.index({ catalogId: 1 });
materialSchema.index({ collectionId: 1 });
materialSchema.index({ seriesId: 1 });

/**
 * Material document type
 */
export type MaterialType = MongooseDocument & {
  id: string;
  name: string;
  description?: string;
  manufacturer?: string;
  
  // Collection organization
  collectionId?: string;
  seriesId?: string;
  
  // Physical properties
  dimensions: {
    width: number;
    height: number;
    depth?: number;
    unit: 'mm' | 'cm' | 'inch' | 'm' | 'ft';
  };
  
  color: {
    name: string;
    hex?: string;
    rgb?: {
      r: number;
      g: number;
      b: number;
    };
    primary: boolean;
    secondary?: string[];
  };
  
  // Category and material type
  categoryId?: string;
  materialType: 'tile' | 'stone' | 'wood' | 'laminate' | 'vinyl' | 'carpet' | 'metal' | 'glass' | 'concrete' | 'ceramic' | 'porcelain' | 'other';
  
  // Surface properties
  finish: string;
  pattern?: string;
  texture?: string;
  
  // Technical specifications - varies by material type
  technicalSpecs?: Record<string, any>;
  
  // Images
  images: Array<{
    id: string;
    url: string;
    type: 'primary' | 'secondary' | 'detail' | 'room-scene';
    width: number;
    height: number;
    fileSize?: number;
    extractedFrom?: {
      catalogId: string;
      page: number;
      coordinates?: {
        x: number;
        y: number;
        width: number;
        height: number;
      };
    };
  }>;
  
  // Metadata
  tags: string[];
  catalogId: string;
  catalogPage?: number;
  extractedAt: Date;
  updatedAt: Date;
  createdBy?: string;
  
  // Vector representation for similarity search
  vectorRepresentation?: number[];
  
  // Structured metadata with field definitions
  metadata?: Record<string, any>;
  
  // Metadata extraction confidence scores
  metadataConfidence?: Record<string, number>;
};

/**
 * Material model
 */
const Material = mongoose.model<MaterialType>('Material', materialSchema);

/**
 * Create a new material
 * 
 * @param materialData Material data
 * @returns Created material document
 */
export async function createMaterial(materialData: Partial<MaterialType>): Promise<MaterialType> {
  try {
    const material = new Material(materialData);
    await material.save();
    return material;
  } catch (err) {
    logger.error(`Failed to create material: ${err}`);
    throw new Error(`Failed to create material: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Get a material by ID
 * 
 * @param id Material ID
 * @returns Material document
 */
export async function getMaterialById(id: string): Promise<MaterialType | null> {
  try {
    return await Material.findOne({ id });
  } catch (err) {
    logger.error(`Failed to get material: ${err}`);
    throw new Error(`Failed to get material: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Update a material
 * 
 * @param id Material ID
 * @param updateData Update data
 * @returns Updated material document
 */
export async function updateMaterial(id: string, updateData: Partial<MaterialType>): Promise<MaterialType | null> {
  try {
    return await Material.findOneAndUpdate(
      { id },
      { ...updateData, updatedAt: new Date() },
      { new: true }
    );
  } catch (err) {
    logger.error(`Failed to update material: ${err}`);
    throw new Error(`Failed to update material: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Delete a material
 * 
 * @param id Material ID
 * @returns Deleted material document
 */
export async function deleteMaterial(id: string): Promise<MaterialType | null> {
  try {
    return await Material.findOneAndDelete({ id });
  } catch (err) {
    logger.error(`Failed to delete material: ${err}`);
    throw new Error(`Failed to delete material: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Search for materials
 * 
 * @param options Search options
 * @returns Array of material documents
 */
export async function searchMaterials(options: {
  query?: string;
  materialType?: string | string[];
  manufacturer?: string | string[];
  color?: string | string[];
  finish?: string | string[];
  dimensions?: {
    width?: { min?: number; max?: number };
    height?: { min?: number; max?: number };
    depth?: { min?: number; max?: number };
    unit?: string;
  };
  tags?: string[];
  limit?: number;
  skip?: number;
  sort?: Record<string, 1 | -1>;
}): Promise<{
  materials: MaterialType[];
  total: number;
}> {
  try {
    const {
      query,
      materialType,
      manufacturer,
      color,
      finish,
      dimensions,
      tags,
      limit = 10,
      skip = 0,
      sort = { updatedAt: -1 }
    } = options;
    
    // Build query
    const filter: any = {};
    
    // Text search
    if (query) {
      filter.$or = [
        { name: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
        { tags: { $in: [new RegExp(query, 'i')] } }
      ];
    }
    
    // Material type filter
    if (materialType) {
      filter.materialType = Array.isArray(materialType)
        ? { $in: materialType }
        : materialType;
    }
    
    // Manufacturer filter
    if (manufacturer) {
      filter.manufacturer = Array.isArray(manufacturer)
        ? { $in: manufacturer }
        : manufacturer;
    }
    
    // Color filter
    if (color) {
      filter['color.name'] = Array.isArray(color)
        ? { $in: color.map(c => new RegExp(c, 'i')) }
        : new RegExp(color, 'i');
    }
    
    // Finish filter
    if (finish) {
      filter.finish = Array.isArray(finish)
        ? { $in: finish.map(f => new RegExp(f, 'i')) }
        : new RegExp(finish, 'i');
    }
    
    // Dimensions filter
    if (dimensions) {
      if (dimensions.width) {
        if (dimensions.width.min !== undefined) {
          filter['dimensions.width'] = { $gte: dimensions.width.min };
        }
        if (dimensions.width.max !== undefined) {
          filter['dimensions.width'] = { ...filter['dimensions.width'], $lte: dimensions.width.max };
        }
      }
      
      if (dimensions.height) {
        if (dimensions.height.min !== undefined) {
          filter['dimensions.height'] = { $gte: dimensions.height.min };
        }
        if (dimensions.height.max !== undefined) {
          filter['dimensions.height'] = { ...filter['dimensions.height'], $lte: dimensions.height.max };
        }
      }
      
      if (dimensions.depth) {
        if (dimensions.depth.min !== undefined) {
          filter['dimensions.depth'] = { $gte: dimensions.depth.min };
        }
        if (dimensions.depth.max !== undefined) {
          filter['dimensions.depth'] = { ...filter['dimensions.depth'], $lte: dimensions.depth.max };
        }
      }
      
      if (dimensions.unit) {
        filter['dimensions.unit'] = dimensions.unit;
      }
    }
    
    // Tags filter
    if (tags && tags.length > 0) {
      filter.tags = { $all: tags };
    }
    
    // Execute query
    const materials = await Material.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit);
    
    const total = await Material.countDocuments(filter);
    
    return { materials, total };
  } catch (err) {
    logger.error(`Failed to search materials: ${err}`);
    throw new Error(`Failed to search materials: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Find similar materials based on vector representation
 * 
 * @param materialId Material ID or vector representation
 * @param options Search options
 * @returns Array of similar materials with similarity scores
 */
export async function findSimilarMaterials(
  materialId: string | number[],
  options: {
    limit?: number;
    threshold?: number;
    materialType?: string | string[];
  } = {}
): Promise<Array<{
  material: MaterialType;
  similarity: number;
}>> {
  try {
    const { limit = 10, threshold = 0.7, materialType } = options;
    
    let vectorRepresentation: number[];
    
    // If materialId is a string, get the vector representation from the database
    if (typeof materialId === 'string') {
      const material = await Material.findOne({ id: materialId });
      if (!material || !material.vectorRepresentation || material.vectorRepresentation.length === 0) {
        throw new Error(`Material not found or has no vector representation: ${materialId}`);
      }
      vectorRepresentation = material.vectorRepresentation;
    } else {
      vectorRepresentation = materialId;
    }
    
    // Build query
    const filter: any = {
      vectorRepresentation: { $exists: true, $ne: [] }
    };
    
    // Material type filter
    if (materialType) {
      filter.materialType = Array.isArray(materialType)
        ? { $in: materialType }
        : materialType;
    }
    
    // Get all materials with vector representations
    const materials = await Material.find(filter);
    
    // Calculate similarity scores
    const similarMaterials = materials
      .map((material: MaterialType) => {
        if (!material.vectorRepresentation || material.vectorRepresentation.length === 0) {
          return { material, similarity: 0 };
        }
        
        // Calculate cosine similarity
        const similarity = calculateCosineSimilarity(
          vectorRepresentation,
          material.vectorRepresentation
        );
        
        return { material, similarity };
      })
      .filter(({ similarity }: { similarity: number }) => similarity >= threshold)
      .sort((a: any, b: any) => b.similarity - a.similarity)
      .slice(0, limit);
    
    return similarMaterials;
  } catch (err) {
    logger.error(`Failed to find similar materials: ${err}`);
    throw new Error(`Failed to find similar materials: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Calculate cosine similarity between two vectors
 * 
 * @param a First vector
 * @param b Second vector
 * @returns Cosine similarity (0-1)
 */
function calculateCosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimensions do not match: ${a.length} vs ${b.length}`);
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    // Add null/undefined checks to prevent "object is possibly undefined" errors
    const aVal = a[i] || 0;
    const bVal = b[i] || 0;
    dotProduct += aVal * bVal;
    normA += aVal * aVal;
    normB += bVal * bVal;
  }
  
  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);
  
  if (normA === 0 || normB === 0) {
    return 0;
  }
  
  return dotProduct / (normA * normB);
}

/**
 * Material information type
 */
type ExtractedMaterialInfo = {
  name?: string;
  description?: string;
  materialType?: 'tile' | 'stone' | 'wood' | 'laminate' | 'vinyl' | 'carpet' | 'metal' | 'glass' | 'concrete' | 'ceramic' | 'porcelain' | 'other';
  dimensions?: {
    width?: number;
    height?: number;
    depth?: number;
    unit?: 'mm' | 'cm' | 'inch' | 'm' | 'ft';
  };
  color?: {
    name?: string;
    hex?: string;
    rgb?: {
      r: number;
      g: number;
      b: number;
    };
  };
  finish?: string;
  pattern?: string;
  texture?: string;
  technicalSpecs?: Record<string, any>;
  tags?: string[];
  // Add these fields to match what's used in the function
  metadata?: Record<string, any>;
  metadataConfidence?: Record<string, number>;
};

/**
 * Create a material from an extracted image and associated text
 * 
 * @param image Extracted image
 * @param texts Extracted texts
 * @param options Additional options
 * @returns Created material document
 */
export async function createMaterialFromImageAndText(
  image: {
    id: string;
    fileName: string;
    filePath: string;
    width: number;
    height: number;
    s3Key?: string;
    s3Url?: string;
    coordinates: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    pageNumber: number;
  },
  texts: Array<{
    text: string;
    confidence: number;
    boundingBox?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }>,
  options: {
    catalogId: string;
    pageNumber: number;
    manufacturer?: string;
    userId?: string;
  }
): Promise<MaterialType> {
  try {
    // Extract material information from texts
    const extractedInfo = await extractMaterialInfoFromTexts(texts);
    
    // Create material data
    const materialData: Partial<MaterialType> = {
      id: uuidv4(),
      name: extractedInfo.name || `Material from ${options.manufacturer || 'Unknown'} - ${image.fileName}`,
      description: extractedInfo.description,
      manufacturer: options.manufacturer,
      materialType: extractedInfo.materialType || 'tile', // Default to tile if not detected
      
      dimensions: {
        width: extractedInfo.dimensions?.width || 300, // Default values if not detected
        height: extractedInfo.dimensions?.height || 300,
        depth: extractedInfo.dimensions?.depth,
        unit: extractedInfo.dimensions?.unit || 'mm'
      },
      
      color: {
        name: extractedInfo.color?.name || 'Unknown',
        hex: extractedInfo.color?.hex,
        rgb: extractedInfo.color?.rgb,
        primary: true
      },
      
      finish: extractedInfo.finish || 'Unknown',
      pattern: extractedInfo.pattern,
      texture: extractedInfo.texture,
      
      technicalSpecs: extractedInfo.technicalSpecs || {},
      
      images: [
        {
          id: image.id,
          url: image.s3Url || '',
          type: 'primary',
          width: image.width,
          height: image.height,
          extractedFrom: {
            catalogId: options.catalogId,
            page: options.pageNumber,
            coordinates: image.coordinates
          }
        }
      ],
      
      tags: extractedInfo.tags || [],
      catalogId: options.catalogId,
      catalogPage: options.pageNumber,
      extractedAt: new Date(),
      updatedAt: new Date(),
      createdBy: options.userId
    };
    
    // Create material
    return await createMaterial(materialData);
  } catch (err) {
    logger.error(`Failed to create material from image and text: ${err}`);
    throw new Error(`Failed to create material from image and text: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Extract material information from OCR texts using metadata field hints
 * 
 * @param texts Array of extracted texts
 * @param categoryId Optional category ID to apply specific extraction rules
 * @returns Extracted material information
 */
async function extractMaterialInfoFromTexts(
  texts: Array<{
    text: string;
    confidence: number;
    boundingBox?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }>, 
  categoryId?: string
): Promise<ExtractedMaterialInfo> {
  // This is a simplified implementation
  // In a real-world scenario, this would use NLP and more sophisticated text analysis
  
  let combinedText = '';
  
  try {
    // Get metadata fields for the category if provided
    let metadataFields = [];
    const MetadataField = mongoose.model('MetadataField');
    
    // Provide categoryId parameter explicitly
    if (categoryId) {
      metadataFields = await MetadataField.find({ categories: categoryId });
    } else {
      metadataFields = await MetadataField.find();
    }
    
    // Combine all texts into a single string for basic extraction
    combinedText = texts
      .filter(t => t.confidence > 0.7) // Filter out low-confidence texts
      .map(t => t.text)
      .join(' ');
  
    // Extract material type
    const materialTypePatterns = {
      tile: /\b(tile|tiles|ceramic|porcelain|mosaic)\b/i,
      stone: /\b(stone|marble|granite|travertine|limestone|slate|quartzite)\b/i,
      wood: /\b(wood|hardwood|timber|oak|maple|walnut|pine)\b/i,
      laminate: /\b(laminate|laminated)\b/i,
      vinyl: /\b(vinyl|lvt|luxury vinyl)\b/i,
      carpet: /\b(carpet|rug|carpeting)\b/i,
      metal: /\b(metal|steel|aluminum|copper|brass|bronze)\b/i,
      glass: /\b(glass|mosaic glass)\b/i,
      concrete: /\b(concrete|cement)\b/i
    };
    
    let materialType: string | undefined = undefined;
    for (const [type, pattern] of Object.entries(materialTypePatterns)) {
      if (pattern.test(combinedText)) {
        materialType = type as any;
        break;
      }
    }
    
    // Extract dimensions
    const dimensionsPattern = /\b(\d+(?:\.\d+)?)\s*[xX]\s*(\d+(?:\.\d+)?)\s*(?:x\s*(\d+(?:\.\d+)?))?\s*(mm|cm|inch|in|m|ft)?\b/;
    const dimensionsMatch = combinedText.match(dimensionsPattern);
    
    const dimensions = dimensionsMatch ? {
      width: parseFloat(dimensionsMatch[1] || '0'),
      height: parseFloat(dimensionsMatch[2] || '0'),
      depth: dimensionsMatch[3] ? parseFloat(dimensionsMatch[3]) : undefined,
      unit: dimensionsMatch[4] ? 
        (dimensionsMatch[4] === 'in' ? 'inch' : dimensionsMatch[4]) as 'mm' | 'cm' | 'inch' | 'm' | 'ft' : 
        'mm'
    } : undefined;
    
    // Extract color
    const colorPattern = /\b(white|black|gray|grey|beige|brown|red|blue|green|yellow|orange|purple|pink|ivory|cream|tan|gold|silver|bronze|multicolor)\b/i;
    const colorMatch = combinedText.match(colorPattern);
    
    const color = colorMatch ? {
      name: colorMatch[1]
    } : undefined;
    
    // Extract finish
    const finishPattern = /\b(matte|glossy|polished|honed|textured|brushed|lappato|satin|natural|semi-polished)\b/i;
    const finishMatch = combinedText.match(finishPattern);
    
    // Extract name (use the first line or first few words)
    const lines = combinedText.split('\n');
    const name = lines[0]?.trim() || combinedText.split(' ').slice(0, 5).join(' ');
    
    // Extract technical specs
    const technicalSpecs: Record<string, any> = {};
    
    // Water absorption
    const waterAbsorptionPattern = /water\s*absorption\s*(?:rate|value)?:?\s*(<|>|≤|≥)?\s*(\d+(?:\.\d+)?)\s*%?/i;
    const waterAbsorptionMatch = combinedText.match(waterAbsorptionPattern);
    if (waterAbsorptionMatch && waterAbsorptionMatch[2]) {
      technicalSpecs.waterAbsorption = parseFloat(waterAbsorptionMatch[2]);
    }
    
    // Slip resistance
    const slipResistancePattern = /slip\s*resistance:?\s*(R\d+|A\+B\+C|[A-C]|[0-9]+)/i;
    const slipResistanceMatch = combinedText.match(slipResistancePattern);
    if (slipResistanceMatch) {
      technicalSpecs.slipResistance = slipResistanceMatch[1];
    }
    
    // Frost resistance
    const frostResistancePattern = /frost\s*resistance:?\s*(yes|no|resistant|not\s*resistant)/i;
    const frostResistanceMatch = combinedText.match(frostResistancePattern);
    if (frostResistanceMatch && frostResistanceMatch[1]) {
      technicalSpecs.frostResistance = /yes|resistant/i.test(frostResistanceMatch[1]);
    }
    
    // Extract tags
    const tags = new Set<string>();
    
    // Add material type as tag
    if (materialType) {
      tags.add(materialType);
    }
    
    // Add color as tag
    if (color?.name) {
      tags.add(color.name.toLowerCase());
    }
    
    // Add finish as tag
    if (finishMatch && finishMatch[1]) {
      tags.add(finishMatch[1].toLowerCase());
    }
    
    // Add size as tag
    if (dimensions) {
      const sizeTag = `${dimensions.width}x${dimensions.height}${dimensions.depth ? 'x' + dimensions.depth : ''}${dimensions.unit}`;
      tags.add(sizeTag);
    }
    
    // Initialize extraction result
    const result: ExtractedMaterialInfo = {
      name,
      description: lines.slice(1, 3).join(' ').trim() || undefined,
      materialType: materialType as any,
      dimensions,
      color,
      finish: finishMatch ? finishMatch[1] : undefined,
      technicalSpecs: Object.keys(technicalSpecs).length > 0 ? technicalSpecs : undefined,
      tags: Array.from(tags)
    };
    
    // Initialize metadata and confidence
    const metadata: Record<string, any> = {};
    const metadataConfidence: Record<string, number> = {};
    
    // Apply metadata field hints for extraction if available
    for (const field of metadataFields) {
      if (field.hint) {
        const extractedValue = extractFieldValueUsingHint(combinedText, texts, field);
        if (extractedValue.value !== undefined) {
          metadata[field.name] = extractedValue.value;
          metadataConfidence[field.name] = extractedValue.confidence;
        }
      }
    }
    
    // Add metadata if any fields were extracted
    if (Object.keys(metadata).length > 0) {
      result.metadata = metadata;
      result.metadataConfidence = metadataConfidence as any;
    }
    
    return result;
  } catch (err) {
    logger.error(`Error in extractMaterialInfoFromTexts: ${err}`);
    
    // Return basic extraction if advanced extraction fails
    const localLines = combinedText ? combinedText.split('\n') : [];
    // Add null check to avoid potential undefined access
    const localName = localLines.length > 0 && localLines[0] ? localLines[0].trim() : '';
    
    return {
      name: localName,
      description: localLines.slice(1, 3).join(' ').trim() || undefined,
      materialType: undefined,
      dimensions: undefined,
      color: undefined,
      finish: undefined,
      technicalSpecs: {},
      tags: []
    };
  }
}

/**
 * Extract a field value using its hint
 * 
 * @param combinedText Combined OCR text
 * @param texts Array of individual OCR results
 * @param field Metadata field with hint
 * @returns Extracted value and confidence
 */
function extractFieldValueUsingHint(
  combinedText: string,
  texts: Array<{
    text: string;
    confidence: number;
    boundingBox?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }>,
  field: any
): { value: any; confidence: number } {
  try {
    // Skip if no hint
    if (!field.hint) {
      return { value: undefined, confidence: 0 };
    }
    
    // Parse the hint
    const hint = field.hint;
    let value: any = undefined;
    let confidence = 0;
    
    // Apply different extraction strategies based on field type
    switch (field.fieldType) {
      case 'number':
        // Extract numeric values
        if (hint.includes('dimension') || hint.includes('size')) {
          // Extract dimensions
          const dimensionRegex = new RegExp(`\\b(\\d+(?:\\.\\d+)?)\\s*(?:${hint.includes('unit') ? '(?:mm|cm|m|inch|in|ft)' : ''})\\b`, 'i');
          const match = combinedText.match(dimensionRegex);
          if (match && match[1]) {
            value = parseFloat(match[1]);
            confidence = 0.8;
          }
        } else {
          // Generic number extraction
          const numberRegex = /\b(\d+(?:\.\d+)?)\b/;
          const match = combinedText.match(numberRegex);
          if (match && match[1]) {
            value = parseFloat(match[1]);
            confidence = 0.7;
          }
        }
        break;
        
      case 'dropdown':
        // Find which option in the dropdown matches
        if (field.options && field.options.length > 0) {
          // Create a regex that matches any of the dropdown options
          const optionsPattern = field.options
            .map((opt: any) => opt.value.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'))
            .join('|');
          const dropdownRegex = new RegExp(`\\b(${optionsPattern})\\b`, 'i');
          const match = combinedText.match(dropdownRegex);
          
          if (match && match[1]) {
            value = match[1];
            // Find exact match in options for correct casing
            const exactOption = field.options.find((opt: any) => 
              opt.value.toLowerCase() === value.toLowerCase()
            );
            if (exactOption) {
              value = exactOption.value;
            }
            confidence = 0.9; // High confidence for exact matches
          }
        }
        break;
        
      case 'text':
      case 'textarea':
      default:
        // Extract text based on context clues in the hint
        if (hint.includes('near')) {
          // Extract text near a keyword
          const keywordMatch = /near ['"]([^'"]+)['"]/.exec(hint);
          if (keywordMatch && keywordMatch[1]) {
            const keyword = keywordMatch[1];
            const keywordRegex = new RegExp(`${keyword}\\s*(?::)?\\s*([^\\n\\.,]+)`, 'i');
            const match = combinedText.match(keywordRegex);
            if (match && match[1]) {
              value = match[1].trim();
              confidence = 0.75;
            }
          }
        } else if (hint.includes('pattern')) {
          // Extract text matching a pattern
          const patternMatch = /pattern ['"]([^'"]+)['"]/.exec(hint);
          if (patternMatch && patternMatch[1]) {
            const pattern = patternMatch[1];
            try {
              const customRegex = new RegExp(pattern, 'i');
              const match = combinedText.match(customRegex);
              if (match && match[1]) {
                value = match[1].trim();
                confidence = 0.85;
              }
            } catch (e) {
              logger.error(`Invalid regex pattern in hint: ${pattern || 'undefined'}`);
            }
          }
        } else {
          // Generic text extraction - look for field name in the text
          const fieldNameRegex = new RegExp(`${field.displayName}\\s*(?::)?\\s*([^\\n\\.,]+)`, 'i');
          const match = combinedText.match(fieldNameRegex);
          if (match && match[1]) {
            value = match[1].trim();
            confidence = 0.6;
          }
        }
        break;
    }
    
    return { value, confidence };
  } catch (err) {
    logger.error(`Error extracting field using hint: ${err}`);
    return { value: undefined, confidence: 0 };
  }
}

export default Material;