/**
 * Knowledge Base Routes
 * 
 * Defines REST API endpoints for managing the knowledge base system,
 * including materials, collections, versioning, and search indexes.
 * Also provides bulk operations for materials and relationships.
 */

import { Router } from 'express';
import { knowledgeBaseController } from '../../controllers/knowledgeBase.controller';
import { authMiddleware } from '../../middleware/auth.middleware';

const router = Router();

// All knowledge base routes require authentication
router.use(authMiddleware);

/**
 * Material routes
 */
// Search materials with optional filtering and pagination
router.get('/materials', knowledgeBaseController.searchMaterials);

// Create a new revision of a material
router.post('/materials/:materialId/revisions', knowledgeBaseController.createMaterialRevision);

// Revert a material to a previous version
router.post('/materials/:materialId/revert/:versionId', knowledgeBaseController.revertMaterialVersion);

// Get version history for a material
router.get('/materials/:materialId/versions', knowledgeBaseController.getMaterialVersionHistory);

/**
 * Bulk operations routes
 */
// Bulk import materials
router.post('/bulk/materials/import', knowledgeBaseController.bulkImportMaterials);

// Bulk update materials
router.post('/bulk/materials/update', knowledgeBaseController.bulkUpdateMaterials);

// Bulk delete materials
router.post('/bulk/materials/delete', knowledgeBaseController.bulkDeleteMaterials);

// Bulk export materials
router.post('/bulk/materials/export', knowledgeBaseController.bulkExportMaterials);

// Bulk create relationships
router.post('/bulk/relationships/create', knowledgeBaseController.bulkCreateRelationships);

/**
 * Collection routes
 */
// Get collections with pagination and filtering
router.get('/collections', knowledgeBaseController.getCollections);

/**
 * Search index routes
 */
// Create a new search index
router.post('/search-indexes', knowledgeBaseController.createSearchIndex);

// Get search indexes with pagination and filtering
router.get('/search-indexes', knowledgeBaseController.getSearchIndexes);

// Rebuild a search index
router.post('/search-indexes/:indexId/rebuild', knowledgeBaseController.rebuildSearchIndex);

/**
 * Statistics routes
 */
// Get knowledge base statistics
router.get('/stats', knowledgeBaseController.getKnowledgeBaseStats);

export default router;