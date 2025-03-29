/**
 * Real-Time Knowledge Base Service
 * 
 * This service provides real-time updates for knowledge base operations,
 * enhancing the system with WebSocket notifications when content changes,
 * better cross-referencing between materials, and bulk operations support.
 */

import { createMaterial, updateMaterial, deleteMaterial, getMaterialById, searchMaterials, MaterialDocument } from '../../models/material.model';
import { createMaterialRelationship, getMaterialRelationships } from '../../models/materialRelationship.model';
import { createCollection, updateCollection, deleteCollection, getCollection, getCollectionTree } from '../../models/collection.model';
import { getMembershipsForCollection, getMaterialsInCollection } from '../../models/collectionMembership.model';
import { entityLinkingService } from './entityLinking.service';
import { logger } from '../../utils/logger';
import { scalableMessageBroker, MessageType, QueueType } from '../messaging/scalableMessageBroker';

/**
 * Notification types for knowledge base events
 */
export enum KnowledgeBaseEventType {
  MATERIAL_CREATED = 'material.created',
  MATERIAL_UPDATED = 'material.updated',
  MATERIAL_DELETED = 'material.deleted',
  COLLECTION_CREATED = 'collection.created',
  COLLECTION_UPDATED = 'collection.updated',
  COLLECTION_DELETED = 'collection.deleted',
  RELATIONSHIP_CREATED = 'relationship.created',
  RELATIONSHIP_UPDATED = 'relationship.updated',
  RELATIONSHIP_DELETED = 'relationship.deleted',
  SEARCH_INDEX_UPDATED = 'searchIndex.updated',
  VERSION_CREATED = 'version.created',
  BULK_OPERATION_COMPLETED = 'bulk.completed'
}

/**
 * Enhanced knowledge base service with real-time updates
 */
export class RealTimeKnowledgeBaseService {
  private clientsSubscribed: number = 0;
  private static instance: RealTimeKnowledgeBaseService;
  
  /**
   * Get singleton instance
   */
  public static getInstance(): RealTimeKnowledgeBaseService {
    if (!RealTimeKnowledgeBaseService.instance) {
      RealTimeKnowledgeBaseService.instance = new RealTimeKnowledgeBaseService();
    }
    return RealTimeKnowledgeBaseService.instance;
  }
  
  constructor() {
    this.setupSubscriptionListener();
    logger.info('Real-time knowledge base service initialized with Supabase best practices');
  }
  
  /**
   * Set up listener for client subscriptions to track usage
   */
  private setupSubscriptionListener(): void {
    scalableMessageBroker.subscribeWithOptions(
      'system' as QueueType,
      async (message) => {
        if (message.type === 'client.connected') {
          this.clientsSubscribed++;
          logger.debug(`Knowledge base client connected. Active clients: ${this.clientsSubscribed}`);
        } else if (message.type === 'client.disconnected') {
          this.clientsSubscribed = Math.max(0, this.clientsSubscribed - 1);
          logger.debug(`Knowledge base client disconnected. Active clients: ${this.clientsSubscribed}`);
        }
      },
      {
        useAcknowledgment: true,
        autoAcknowledge: true,
        enableCache: true
      },
      'client.*'
    );
  }

  /**
   * Create a new material with real-time notification
   */
  public async createMaterial(materialData: any): Promise<MaterialDocument> {
    try {
      // Create material using model function
      const material = await createMaterial(materialData);
      
      // Send real-time notification
      await this.notifyKnowledgeBaseEvent(
        KnowledgeBaseEventType.MATERIAL_CREATED,
        { materialId: material.id, material }
      );
      
      // Check for entities in description for auto-linking
      if (material.description) {
        await this.processEntityLinking(material);
      }
      
      return material;
    } catch (err) {
      logger.error(`Failed to create material with real-time notification: ${err}`);
      throw err;
    }
  }
  
  /**
   * Update a material with real-time notification
   */
  public async updateMaterial(id: string, materialData: any): Promise<MaterialDocument | null> {
    try {
      // Update material using model function
      const updatedMaterial = await updateMaterial(id, materialData);
      
      if (updatedMaterial) {
        // Send real-time notification
        await this.notifyKnowledgeBaseEvent(
          KnowledgeBaseEventType.MATERIAL_UPDATED,
          { materialId: id, material: updatedMaterial }
        );
        
        // Check for new entities if description was updated
        if (materialData.description) {
          await this.processEntityLinking(updatedMaterial);
        }
      }
      
      return updatedMaterial;
    } catch (err) {
      logger.error(`Failed to update material with real-time notification: ${err}`);
      throw err;
    }
  }
  
  /**
   * Delete a material with real-time notification
   */
  public async deleteMaterial(id: string): Promise<boolean> {
    try {
      // Delete material using model function
      const deletedMaterial = await deleteMaterial(id);
      
      // Send real-time notification if material was found and deleted
      if (deletedMaterial) {
        await this.notifyKnowledgeBaseEvent(
          KnowledgeBaseEventType.MATERIAL_DELETED,
          { materialId: id }
        );
        return true;
      }
      
      return false;
    } catch (err) {
      logger.error(`Failed to delete material with real-time notification: ${err}`);
      throw err;
    }
  }
  
  /**
   * Create a new collection with real-time notification
   */
  public async createCollection(collectionData: any): Promise<any> {
    try {
      // Create collection using model function
      const collection = await createCollection(collectionData);
      
      // Send real-time notification
      await this.notifyKnowledgeBaseEvent(
        KnowledgeBaseEventType.COLLECTION_CREATED,
        { collectionId: collection.id, collection }
      );
      
      return collection;
    } catch (err) {
      logger.error(`Failed to create collection with real-time notification: ${err}`);
      throw err;
    }
  }
  
  /**
   * Update a collection with real-time notification
   */
  public async updateCollection(id: string, collectionData: any): Promise<any> {
    try {
      // Update collection using model function
      const updatedCollection = await updateCollection(id, collectionData);
      
      if (updatedCollection) {
        // Send real-time notification
        await this.notifyKnowledgeBaseEvent(
          KnowledgeBaseEventType.COLLECTION_UPDATED,
          { collectionId: id, collection: updatedCollection }
        );
      }
      
      return updatedCollection;
    } catch (err) {
      logger.error(`Failed to update collection with real-time notification: ${err}`);
      throw err;
    }
  }
  
  /**
   * Delete a collection with real-time notification
   */
  public async deleteCollection(id: string): Promise<boolean> {
    try {
      // Delete collection using model function
      const deletedCollection = await deleteCollection(id);
      
      // Send real-time notification if collection was found and deleted
      if (deletedCollection) {
        await this.notifyKnowledgeBaseEvent(
          KnowledgeBaseEventType.COLLECTION_DELETED,
          { collectionId: id }
        );
        return true;
      }
      
      return false;
    } catch (err) {
      logger.error(`Failed to delete collection with real-time notification: ${err}`);
      throw err;
    }
  }
  
  /**
   * Create a relationship between materials with real-time notification
   */
  public async createRelationship(relationshipData: {
    sourceMaterialId: string;
    targetMaterialId: string;
    relationType: string;
    strength?: number;
    metadata?: any;
  }): Promise<any> {
    try {
      // Create the relationship using model function
      const relationship = await createMaterialRelationship({
        ...relationshipData,
        // Default createdBy if not provided
        createdBy: relationshipData.metadata?.userId || 'system'
      });
      
      // Send real-time notification
      await this.notifyKnowledgeBaseEvent(
        KnowledgeBaseEventType.RELATIONSHIP_CREATED,
        { relationship }
      );
      
      return relationship;
    } catch (err) {
      logger.error(`Failed to create relationship with real-time notification: ${err}`);
      throw err;
    }
  }
  
  /**
   * Update search index with real-time notification
   */
  public async updateSearchIndex(collectionId?: string): Promise<boolean> {
    try {
      // For now, just notify about the update
      // In a real implementation, this would update some search index
      
      // Send real-time notification
      await this.notifyKnowledgeBaseEvent(
        KnowledgeBaseEventType.SEARCH_INDEX_UPDATED,
        { collectionId }
      );
      
      return true;
    } catch (err) {
      logger.error(`Failed to update search index with real-time notification: ${err}`);
      throw err;
    }
  }
  
  /**
   * Process entity linking for a material
   */
  private async processEntityLinking(material: MaterialDocument): Promise<void> {
    try {
      // Skip if no description
      if (!material.description) return;
      
      // Identify entities in the description using the entity linking service
      const entities = await entityLinkingService.detectEntities(material.description, {
        detectMaterials: true,
        detectCollections: true,
        detectProperties: false,
        minConfidence: 0.7
      });
      
      // For each entity, find relevant materials and create relationships
      for (const entity of entities) {
        // Skip if confidence is too low
        if (entity.confidence < 0.7) continue;
        
        // Search for materials related to this entity
        const searchResult = await searchMaterials({
          query: entity.text,
          limit: 5
        });
        
        // Create relationships to found materials
        for (const relatedMaterial of searchResult.materials) {
          // Skip self-relationships
          if (relatedMaterial.id === material.id) continue;
          
          // Create relationship with confidence as strength
          await this.createRelationship({
            sourceMaterialId: material.id,
            targetMaterialId: relatedMaterial.id,
            relationType: 'entity-reference',
            strength: entity.confidence,
            metadata: {
              entityType: entity.type,
              mentionedText: entity.text,
              detectionMethod: 'automatic',
              userId: 'system'
            }
          });
        }
      }
    } catch (err) {
      logger.error(`Error in entity linking for material ${material.id}: ${err}`);
      // Don't throw - this is a background enhancement that shouldn't fail the main operation
    }
  }
  
  /**
   * Send notification for knowledge base events
   */
  private async notifyKnowledgeBaseEvent(
    eventType: KnowledgeBaseEventType,
    payload: any
  ): Promise<void> {
    // Skip notification if no clients are subscribed
    if (this.clientsSubscribed === 0) {
      logger.debug(`Skipping knowledge base event notification as no clients are subscribed: ${eventType}`);
      return;
    }
    
    try {
      await scalableMessageBroker.publish(
        'system' as QueueType,
        MessageType.KNOWLEDGE_BASE_EVENT,
        {
          eventType,
          timestamp: Date.now(),
          payload
        },
        'knowledge-base-service',
        9 // High priority for real-time updates
      );
    } catch (err) {
      logger.error(`Failed to publish knowledge base event: ${err}`);
    }
  }
  
  /**
   * Bulk import materials with real-time notification
   */
  public async bulkImportMaterials(materials: any[]): Promise<MaterialDocument[]> {
    try {
      // Process materials in batches to avoid overwhelming the database
      const importedMaterials: MaterialDocument[] = [];
      const batchSize = 50;
      
      for (let i = 0; i < materials.length; i += batchSize) {
        const batch = materials.slice(i, i + batchSize);
        
        // Process each material in the batch
        const batchResults = await Promise.all(
          batch.map(async (materialData) => {
            try {
              return await createMaterial(materialData);
            } catch (err) {
              logger.error(`Error importing material in batch: ${err}`);
              return null;
            }
          })
        );
        
        // Filter out nulls and add to results
        const validResults = batchResults.filter((result): result is MaterialDocument => result !== null);
        importedMaterials.push(...validResults);
      }
      
      // Send bulk operation completed notification
      await this.notifyKnowledgeBaseEvent(
        KnowledgeBaseEventType.BULK_OPERATION_COMPLETED,
        {
          operationType: 'import',
          count: importedMaterials.length,
          totalRequested: materials.length
        }
      );
      
      return importedMaterials;
    } catch (err) {
      logger.error(`Failed to bulk import materials: ${err}`);
      throw err;
    }
  }
  
  /**
   * Bulk update materials with real-time notification
   */
  public async bulkUpdateMaterials(updates: Array<{ id: string, data: any }>): Promise<MaterialDocument[]> {
    try {
      const updatedMaterials: MaterialDocument[] = [];
      const batchSize = 50;
      
      for (let i = 0; i < updates.length; i += batchSize) {
        const batch = updates.slice(i, i + batchSize);
        
        // Process each update in the batch
        const batchResults = await Promise.all(
          batch.map(async (update) => {
            try {
              return await updateMaterial(update.id, update.data);
            } catch (err) {
              logger.error(`Error updating material in batch: ${err}`);
              return null;
            }
          })
        );
        
        // Filter out nulls and add to results
        const validResults = batchResults.filter((result): result is MaterialDocument => result !== null);
        updatedMaterials.push(...validResults);
      }
      
      // Send bulk operation completed notification
      await this.notifyKnowledgeBaseEvent(
        KnowledgeBaseEventType.BULK_OPERATION_COMPLETED,
        {
          operationType: 'update',
          count: updatedMaterials.length,
          totalRequested: updates.length
        }
      );
      
      return updatedMaterials;
    } catch (err) {
      logger.error(`Failed to bulk update materials: ${err}`);
      throw err;
    }
  }
  
  /**
   * Bulk delete materials with real-time notification
   */
  public async bulkDeleteMaterials(ids: string[]): Promise<{ success: string[]; failed: string[] }> {
    try {
      const results: { success: string[]; failed: string[] } = { success: [], failed: [] };
      const batchSize = 50;
      
      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        
        // Process each deletion in the batch
        const batchResults = await Promise.all(
          batch.map(async (id) => {
            try {
              const deleted = await deleteMaterial(id);
              return { id, success: !!deleted };
            } catch (err) {
              logger.error(`Error deleting material in batch: ${err}`);
              return { id, success: false };
            }
          })
        );
        
        // Categorize results
        for (const result of batchResults) {
          if (result.success) {
            results.success.push(result.id);
          } else {
            results.failed.push(result.id);
          }
        }
      }
      
      // Send bulk operation completed notification
      await this.notifyKnowledgeBaseEvent(
        KnowledgeBaseEventType.BULK_OPERATION_COMPLETED,
        {
          operationType: 'delete',
          count: results.success.length,
          totalRequested: ids.length,
          failed: results.failed.length
        }
      );
      
      return results;
    } catch (err) {
      logger.error(`Failed to bulk delete materials: ${err}`);
      throw err;
    }
  }
  
  /**
   * Bulk export materials with format options
   */
  public async bulkExportMaterials(
    options: {
      collectionId?: string;
      ids?: string[];
      format?: 'json' | 'csv';
      includeVersions?: boolean;
      includeRelationships?: boolean;
    }
  ): Promise<any> {
    try {
      // Determine which materials to export
      let materialsToExport: MaterialDocument[] = [];
      
      if (options.collectionId) {
        // Export by collection
        const materialIds = await getMaterialsInCollection(options.collectionId, true);
        const materialsPromises = materialIds.map(id => getMaterialById(id));
        const materials = await Promise.all(materialsPromises);
        materialsToExport = materials.filter((m): m is MaterialDocument => m !== null);
      } else if (options.ids && options.ids.length > 0) {
        // Export specific materials
        const materialsPromises = options.ids.map(id => getMaterialById(id));
        const materials = await Promise.all(materialsPromises);
        materialsToExport = materials.filter((m): m is MaterialDocument => m !== null);
      } else {
        throw new Error('Either collectionId or ids must be provided for export');
      }
      
      // Get relationships if requested
      if (options.includeRelationships) {
        for (const material of materialsToExport) {
          // Use type assertion since relationships isn't in the MaterialDocument interface
          (material as any).relationships = await getMaterialRelationships(material.id);
        }
      }
      
      // Format data according to requested format
      let formattedData;
      
      if (options.format === 'csv') {
        formattedData = this.formatMaterialsAsCSV(materialsToExport, options);
      } else {
        // Default to JSON
        formattedData = {
          materials: materialsToExport,
          count: materialsToExport.length,
          exportDate: new Date().toISOString(),
          options
        };
      }
      
      // No need for real-time notification for exports as they don't change data
      
      return formattedData;
    } catch (err) {
      logger.error(`Failed to bulk export materials: ${err}`);
      throw err;
    }
  }
  
  /**
   * Format materials as CSV for export
   */
  private formatMaterialsAsCSV(materials: MaterialDocument[], options: any): string {
    // Create header row based on first material and options
    const headerFields = ['id', 'name', 'description', 'manufacturer', 'materialType', 'finish', 'createdAt', 'updatedAt'];
    
    if (options.includeRelationships) {
      headerFields.push('relationshipCount');
    }
    
    // Create CSV content
    let csv = headerFields.join(',') + '\n';
    
    // Add material rows
    for (const material of materials) {
      const row = [
        material.id,
        `"${(material.name || '').replace(/"/g, '""')}"`,
        `"${(material.description || '').replace(/"/g, '""')}"`,
        `"${(material.manufacturer || '').replace(/"/g, '""')}"`,
        material.materialType || '',
        `"${(material.finish || '').replace(/"/g, '""')}"`,
        // Handle timestamp properties safely with type assertions
        (material as any).createdAt instanceof Date ? (material as any).createdAt.toISOString() : '',
        (material as any).updatedAt instanceof Date ? (material as any).updatedAt.toISOString() : ''
      ];
      
      if (options.includeRelationships) {
        row.push(((material as any).relationships || []).length.toString());
      }
      
      csv += row.join(',') + '\n';
    }
    
    return csv;
  }
  
  /**
   * Bulk create relationships between materials
   */
  public async bulkCreateRelationships(
    relationships: Array<{
      sourceMaterialId: string;
      targetMaterialId: string;
      relationType: string;
      strength?: number;
      metadata?: any;
    }>,
    userId = 'system'
  ): Promise<any[]> {
    try {
      const createdRelationships: any[] = [];
      const batchSize = 50;
      
      for (let i = 0; i < relationships.length; i += batchSize) {
        const batch = relationships.slice(i, i + batchSize);
        
        // Process each relationship in the batch
        const batchResults = await Promise.all(
          batch.map(async (relationshipData) => {
            try {
              return await createMaterialRelationship({
                ...relationshipData,
                createdBy: userId
              });
            } catch (err) {
              logger.error(`Error creating relationship in batch: ${err}`);
              return null;
            }
          })
        );
        
        // Filter out nulls and add to results
        const validResults = batchResults.filter(result => result !== null);
        createdRelationships.push(...validResults);
      }
      
      // Send bulk operation completed notification
      await this.notifyKnowledgeBaseEvent(
        KnowledgeBaseEventType.BULK_OPERATION_COMPLETED,
        {
          operationType: 'createRelationships',
          count: createdRelationships.length,
          totalRequested: relationships.length
        }
      );
      
      return createdRelationships;
    } catch (err) {
      logger.error(`Failed to bulk create relationships: ${err}`);
      throw err;
    }
  }
  
  /**
   * Get complete hierarchical tree of collections with deep nesting support
   */
  public async getDeepCollectionTree(): Promise<any[]> {
    try {
      // Get all collections with the model function
      const rootCollections = await getCollectionTree();
      
      // Get all collection memberships to enhance with material counts
      for (const collection of this.flattenCollectionTree(rootCollections)) {
        const memberships = await getMembershipsForCollection(collection.id);
        collection.materialCount = memberships.length;
      }
      
      return rootCollections;
    } catch (err) {
      logger.error(`Failed to get deep collection tree: ${err}`);
      throw err;
    }
  }
  
  /**
   * Flatten a collection tree into an array
   */
  private flattenCollectionTree(collections: any[]): any[] {
    const result: any[] = [];
    
    for (const collection of collections) {
      result.push(collection);
      
      if (collection.children && collection.children.length > 0) {
        result.push(...this.flattenCollectionTree(collection.children));
      }
    }
    
    return result;
  }
}

// Create and export singleton instance
export const realTimeKnowledgeBaseService = RealTimeKnowledgeBaseService.getInstance();
export default realTimeKnowledgeBaseService;