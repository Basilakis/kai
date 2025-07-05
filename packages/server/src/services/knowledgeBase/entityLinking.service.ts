/**
 * Entity Linking Service
 *
 * This service detects and links entities (materials, collections, properties)
 * mentioned in material descriptions, allowing for automatic cross-referencing
 * and enhanced relationships between knowledge base entities.
 *
 * Migrated from MongoDB to Supabase/PostgreSQL.
 */

import { logger } from '../../utils/logger';
import { supabaseClient } from '../supabase/supabaseClient';

// Interface for entity detection results
interface DetectedEntity {
  id: string;
  type: 'material' | 'collection' | 'property';
  text: string;
  startPos: number;
  endPos: number;
  confidence: number;
}

// Interface for linking options
interface EntityLinkingOptions {
  linkMaterials?: boolean;
  linkCollections?: boolean;
  linkProperties?: boolean;
  minConfidence?: number;
  createRelationships?: boolean;
  relationshipType?: string;
  userId?: string;
}

/**
 * Entity Linking Service
 */
export class EntityLinkingService {
  private static instance: EntityLinkingService;
  
  // Cache known entity names for faster lookup
  private materialNamesCache: Map<string, string> = new Map();
  private collectionNamesCache: Map<string, string> = new Map();
  private propertyNamesCache: Map<string, string> = new Map();
  
  // Regular expressions for entity detection
  private materialRegexes: RegExp[] = [];
  private collectionRegexes: RegExp[] = [];
  private propertyRegexes: RegExp[] = [];
  
  private constructor() {
    logger.info('Entity Linking Service initialized');
    this.initializeRegexes();
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(): EntityLinkingService {
    if (!EntityLinkingService.instance) {
      EntityLinkingService.instance = new EntityLinkingService();
    }
    return EntityLinkingService.instance;
  }
  
  /**
   * Initialize regular expressions for entity detection
   */
  private initializeRegexes(): void {
    // Add basic regexes for common patterns
    this.materialRegexes = [
      // Match "Material Name" product/material
      /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,4})\b(?:\s+(?:tile|stone|wood|laminate|vinyl|carpet|metal|glass|ceramic|porcelain))/i,
      // Match quoted material names
      /"([^"]{2,30})"\s+(?:material|product|item|option)/i,
      // Match material codes (e.g., MT-123, TILE-456)
      /\b([A-Z]{2,4}-\d{3,6})\b/
    ];
    
    this.collectionRegexes = [
      // Match "Collection Name" collection/series
      /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,4})\b(?:\s+(?:collection|series|line))/i,
      // Match "from the X collection" pattern
      /from\s+the\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,4})\s+(?:collection|series|line)/i
    ];
    
    this.propertyNamesCache = new Map([
      ['color', 'color'],
      ['finish', 'finish'],
      ['texture', 'texture'],
      ['pattern', 'pattern'],
      ['size', 'dimensions'],
      ['dimensions', 'dimensions'],
      ['material', 'materialType'],
      ['manufacturer', 'manufacturer']
    ]);
  }
  
  /**
   * Refresh entity name caches
   */
  public async refreshCaches(): Promise<void> {
    try {
      await this.refreshMaterialNamesCache();
      await this.refreshCollectionNamesCache();
      logger.info('Entity name caches refreshed');
    } catch (err) {
      logger.error(`Failed to refresh entity name caches: ${err}`);
    }
  }
  
  /**
   * Refresh material names cache
   */
  private async refreshMaterialNamesCache(): Promise<void> {
    try {
      const client = supabaseClient.getClient();
      
      // Get all material names and IDs from Supabase
      const { data: materials, error } = await client
        .from('materials')
        .select('id, name')
        .not('name', 'is', null);
      
      if (error) {
        throw new Error(`Supabase error: ${error.message}`);
      }
      
      // Clear and rebuild cache
      this.materialNamesCache.clear();
      materials?.forEach((material: any) => {
        if (material.name && material.name.length > 2) {
          this.materialNamesCache.set(material.name.toLowerCase(), material.id);
        }
      });
      
      logger.info(`Cached ${this.materialNamesCache.size} material names`);
    } catch (err) {
      logger.error(`Failed to refresh material names cache: ${err}`);
    }
  }
  
  /**
   * Refresh collection names cache
   */
  private async refreshCollectionNamesCache(): Promise<void> {
    try {
      const client = supabaseClient.getClient();
      
      // Get all collection names and IDs from Supabase
      const { data: collections, error } = await client
        .from('collections')
        .select('id, name')
        .not('name', 'is', null);
      
      if (error) {
        throw new Error(`Supabase error: ${error.message}`);
      }
      
      // Clear and rebuild cache
      this.collectionNamesCache.clear();
      collections?.forEach((collection: any) => {
        if (collection.name && collection.name.length > 2) {
          this.collectionNamesCache.set(collection.name.toLowerCase(), collection.id);
        }
      });
      
      logger.info(`Cached ${this.collectionNamesCache.size} collection names`);
    } catch (err) {
      logger.error(`Failed to refresh collection names cache: ${err}`);
    }
  }
  
  /**
   * Detect entities in text
   * 
   * @param text Text to analyze
   * @param options Detection options
   * @returns Detected entities
   */
  public async detectEntities(
    text: string,
    options: {
      detectMaterials?: boolean;
      detectCollections?: boolean;
      detectProperties?: boolean;
      minConfidence?: number;
    } = {}
  ): Promise<DetectedEntity[]> {
    if (!text) {
      return [];
    }
    
    const {
      detectMaterials = true,
      detectCollections = true,
      detectProperties = true,
      minConfidence = 0.6
    } = options;
    
    const results: DetectedEntity[] = [];
    
    // Detect materials
    if (detectMaterials) {
      const materials = await this.detectMaterialsInText(text, minConfidence);
      results.push(...materials);
    }
    
    // Detect collections
    if (detectCollections) {
      const collections = await this.detectCollectionsInText(text, minConfidence);
      results.push(...collections);
    }
    
    // Detect properties
    if (detectProperties) {
      const properties = this.detectPropertiesInText(text, minConfidence);
      results.push(...properties);
    }
    
    return results;
  }
  
  /**
   * Detect materials mentioned in text
   * 
   * @param text Text to analyze
   * @param minConfidence Minimum confidence threshold
   * @returns Detected material entities
   */
  private async detectMaterialsInText(text: string, minConfidence: number): Promise<DetectedEntity[]> {
    const results: DetectedEntity[] = [];
    
    // If cache is empty, refresh it
    if (this.materialNamesCache.size === 0) {
      await this.refreshMaterialNamesCache();
    }
    
    // Check for exact material name matches first
    for (const [materialName, materialId] of this.materialNamesCache.entries()) {
      const regex = new RegExp(`\\b${this.escapeRegExp(materialName)}\\b`, 'i');
      const matches = [...text.matchAll(regex)];
      
      for (const match of matches) {
        if (match.index !== undefined) {
          results.push({
            id: materialId,
            type: 'material',
            text: match[0],
            startPos: match.index,
            endPos: match.index + match[0].length,
            confidence: 0.9 // High confidence for exact matches
          });
        }
      }
    }
    
    // Use pattern-based detection for materials not in the cache
    for (const regex of this.materialRegexes) {
      const matches = [...text.matchAll(regex)];
      
      for (const match of matches) {
        if (match.index !== undefined && match[1]) {
          // Check if this material name is already in the results
          const alreadyDetected = results.some(
            entity => entity.text.toLowerCase() === match[1]?.toLowerCase()
          );
          
          if (!alreadyDetected) {
            // Try to find the material ID
            const materialName = match[1].toLowerCase();
            const materialId = this.materialNamesCache.get(materialName);
            
            if (materialId) {
              results.push({
                id: materialId,
                type: 'material',
                text: match[1],
                startPos: match.index,
                endPos: match.index + match[1].length,
                confidence: 0.8 // Good confidence for pattern matches
              });
            } else {
              // Unknown material, but still detected
              results.push({
                id: '', // Empty ID since we don't know the material
                type: 'material',
                text: match[1],
                startPos: match.index,
                endPos: match.index + match[1].length,
                confidence: 0.7 // Lower confidence for unknown materials
              });
            }
          }
        }
      }
    }
    
    // Filter by minimum confidence threshold
    return results.filter(entity => entity.confidence >= minConfidence);
  }
  
  /**
   * Detect collections mentioned in text
   * 
   * @param text Text to analyze
   * @param minConfidence Minimum confidence threshold
   * @returns Detected collection entities
   */
  private async detectCollectionsInText(text: string, minConfidence: number): Promise<DetectedEntity[]> {
    const results: DetectedEntity[] = [];
    
    // If cache is empty, refresh it
    if (this.collectionNamesCache.size === 0) {
      await this.refreshCollectionNamesCache();
    }
    
    // Check for exact collection name matches first
    for (const [collectionName, collectionId] of this.collectionNamesCache.entries()) {
      const regex = new RegExp(`\\b${this.escapeRegExp(collectionName)}\\b`, 'i');
      const matches = [...text.matchAll(regex)];
      
      for (const match of matches) {
        if (match.index !== undefined) {
          results.push({
            id: collectionId,
            type: 'collection',
            text: match[0],
            startPos: match.index,
            endPos: match.index + match[0].length,
            confidence: 0.9 // High confidence for exact matches
          });
        }
      }
    }
    
    // Use pattern-based detection for collections not in the cache
    for (const regex of this.collectionRegexes) {
      const matches = [...text.matchAll(regex)];
      
      for (const match of matches) {
        if (match.index !== undefined && match[1]) {
          // Check if this collection name is already in the results
          const alreadyDetected = results.some(
            entity => entity.text.toLowerCase() === match[1]?.toLowerCase()
          );
          
          if (!alreadyDetected) {
            // Try to find the collection ID
            const collectionName = match[1].toLowerCase();
            const collectionId = this.collectionNamesCache.get(collectionName);
            
            if (collectionId) {
              results.push({
                id: collectionId,
                type: 'collection',
                text: match[1],
                startPos: match.index,
                endPos: match.index + match[1].length,
                confidence: 0.8 // Good confidence for pattern matches
              });
            } else {
              // Unknown collection, but still detected
              results.push({
                id: '', // Empty ID since we don't know the collection
                type: 'collection',
                text: match[1],
                startPos: match.index,
                endPos: match.index + match[1].length,
                confidence: 0.7 // Lower confidence for unknown collections
              });
            }
          }
        }
      }
    }
    
    // Filter by minimum confidence threshold
    return results.filter(entity => entity.confidence >= minConfidence);
  }
  
  /**
   * Detect properties mentioned in text
   * 
   * @param text Text to analyze
   * @param minConfidence Minimum confidence threshold
   * @returns Detected property entities
   */
  private detectPropertiesInText(text: string, minConfidence: number): DetectedEntity[] {
    const results: DetectedEntity[] = [];
    
    // Check for property mentions
    for (const [propertyName, fieldName] of this.propertyNamesCache.entries()) {
      const regex = new RegExp(`\\b${this.escapeRegExp(propertyName)}\\b\\s*(?::|is|are|=)\\s*([^,.;\\n]+)`, 'gi');
      const matches = [...text.matchAll(regex)];
      
      for (const match of matches) {
        if (match.index !== undefined && match[1]) {
          results.push({
            id: fieldName, // Use field name as ID
            type: 'property',
            text: match[1].trim(),
            startPos: match.index,
            endPos: match.index + match[0].length,
            confidence: 0.85 // Good confidence for property matches
          });
        }
      }
    }
    
    // Filter by minimum confidence threshold
    return results.filter(entity => entity.confidence >= minConfidence);
  }
  
  /**
   * Link entities in a material description
   * 
   * @param materialId Material ID
   * @param description Material description
   * @param options Linking options
   * @returns Linking results
   */
  public async linkEntitiesInDescription(
    materialId: string,
    description: string,
    options: EntityLinkingOptions = {}
  ): Promise<{
    detectedEntities: DetectedEntity[];
    relationships: Array<{
      sourceMaterialId: string;
      targetMaterialId: string;
      relationshipType: string;
      created: boolean;
    }>;
  }> {
    const {
      linkMaterials = true,
      linkCollections = true,
      linkProperties = false,
      minConfidence = 0.7,
      createRelationships = true,
      relationshipType = 'referenced',
      userId
    } = options;
    
    // Detect entities in the description
    const entities = await this.detectEntities(description, {
      detectMaterials: linkMaterials,
      detectCollections: linkCollections,
      detectProperties: linkProperties,
      minConfidence
    });
    
    // Track created relationships
    const relationships: Array<{
      sourceMaterialId: string;
      targetMaterialId: string;
      relationshipType: string;
      created: boolean;
    }> = [];
    
    // Create relationships for detected materials
    if (createRelationships && userId) {
      for (const entity of entities) {
        if (entity.type === 'material' && entity.id && entity.id !== materialId) {
          try {
            // Create a relationship between the materials using Supabase
            const client = supabaseClient.getClient();
            const { error } = await client
              .from('material_relationships')
              .insert({
                source_material_id: materialId,
                target_material_id: entity.id,
                relationship_type: relationshipType,
                strength: entity.confidence,
                bidirectional: true,
                created_by: userId,
                metadata: {
                  description: `Detected reference to ${entity.text} in material description`,
                  detectionConfidence: entity.confidence,
                  autoDetected: true
                }
              });
            
            if (error) {
              throw new Error(`Supabase error: ${error.message}`);
            }
            
            relationships.push({
              sourceMaterialId: materialId,
              targetMaterialId: entity.id,
              relationshipType,
              created: true
            });
          } catch (err) {
            logger.error(`Failed to create relationship between materials: ${err}`);
            relationships.push({
              sourceMaterialId: materialId,
              targetMaterialId: entity.id,
              relationshipType,
              created: false
            });
          }
        }
      }
    }
    
    return {
      detectedEntities: entities,
      relationships
    };
  }
  
  /**
   * Process all materials for entity linking
   * 
   * @param options Linking options
   * @returns Processing results
   */
  public async processAllMaterials(
    options: EntityLinkingOptions & {
      batchSize?: number;
      filter?: Record<string, any>;
    } = {}
  ): Promise<{
    processedCount: number;
    entitiesDetected: number;
    relationshipsCreated: number;
  }> {
    const {
      batchSize = 100,
      filter = {},
      userId,
      ...linkingOptions
    } = options;
    
    try {
      // Refresh entity caches for better detection
      await this.refreshCaches();
      
      // Initialize counters
      let processedCount = 0;
      let entitiesDetected = 0;
      let relationshipsCreated = 0;
      
      // Get Supabase client
      const client = supabaseClient.getClient();
      
      // Count total materials to process
      const { count: totalMaterials, error: countError } = await client
        .from('materials')
        .select('*', { count: 'exact', head: true });
      
      if (countError) {
        throw new Error(`Failed to count materials: ${countError.message}`);
      }
      
      // Process in batches
      for (let skip = 0; skip < (totalMaterials || 0); skip += batchSize) {
        // Get batch of materials from Supabase
        const { data: materials, error } = await client
          .from('materials')
          .select('id, description')
          .not('description', 'is', null)
          .range(skip, skip + batchSize - 1);
        
        if (error) {
          throw new Error(`Failed to fetch materials batch: ${error.message}`);
        }
        
        // Process each material
        for (const material of materials) {
          if (material.description) {
            const result = await this.linkEntitiesInDescription(
              material.id,
              material.description,
              { ...linkingOptions, userId }
            );
            
            // Update counters
            processedCount++;
            entitiesDetected += result.detectedEntities.length;
            relationshipsCreated += result.relationships.filter(r => r.created).length;
          }
        }
        
        logger.info(`Processed ${skip + materials.length} of ${totalMaterials} materials for entity linking`);
      }
      
      return {
        processedCount,
        entitiesDetected,
        relationshipsCreated
      };
    } catch (err) {
      logger.error(`Failed to process all materials for entity linking: ${err}`);
      throw new Error(`Failed to process all materials for entity linking: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  
  /**
   * Escape special characters in a string for use in a regular expression
   * 
   * @param string String to escape
   * @returns Escaped string
   */
  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

// Create singleton instance
export const entityLinkingService = EntityLinkingService.getInstance();
export default entityLinkingService;