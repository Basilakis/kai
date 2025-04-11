/**
 * Enhanced Vector Routes
 * 
 * Routes for the enhanced vector search system with knowledge base integration.
 * These routes provide advanced vector operations including embeddings, semantic search,
 * similarity calculations, and knowledge base integration.
 */

import express from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { authorizeRoles } from '../middleware/auth.middleware';
import { analyticsMiddleware } from '../middleware/analytics.middleware';
import { mlProcessingLimiter } from '../middleware/rate-limit.middleware';
import { requireModuleAccess } from '../middleware/module-access.middleware';
import * as enhancedVectorController from '../controllers/enhancedVector.controller';

const router = express.Router();

// Apply common middleware
router.use(authMiddleware);
router.use(analyticsMiddleware());
router.use(mlProcessingLimiter);

// Apply module access control - ensure users have vector search capability in their subscription
router.use(requireModuleAccess('enhanced-vector-search'));

// Basic vector operations
router.get('/search', enhancedVectorController.searchMaterials);
router.get('/materials/:id/similar', enhancedVectorController.findSimilarMaterials);
router.post('/embeddings', enhancedVectorController.generateEmbeddings);
router.post('/materials/:id/embeddings', enhancedVectorController.storeEmbeddings);
router.post('/compare', enhancedVectorController.compareSimilarity);

// Knowledge base integration endpoints
router.get('/knowledge/search', enhancedVectorController.searchMaterialsWithKnowledge);
router.get('/knowledge/materials/:id/similar', enhancedVectorController.findSimilarMaterialsWithKnowledge);
router.post('/knowledge/route', enhancedVectorController.routeQuery);
router.get('/knowledge/materials/:id', enhancedVectorController.getMaterialKnowledge);
router.post('/knowledge/context', enhancedVectorController.assembleContext);
router.post('/knowledge/organize', enhancedVectorController.createSemanticOrganization);

// System administration endpoints - admin access only
router.use('/admin', authorizeRoles(['admin']));
router.post('/admin/refresh-views', enhancedVectorController.refreshVectorViews);
router.get('/admin/performance', enhancedVectorController.getPerformanceStats);
router.get('/admin/configs', enhancedVectorController.getSearchConfigs);
router.put('/admin/configs/:name', enhancedVectorController.updateSearchConfig);
router.delete('/admin/configs/:name', enhancedVectorController.deleteSearchConfig);

export default router;