/**
 * Material Promotion Routes
 * 
 * Routes for factory users to manage material promotions in 3D model generation.
 */

import express from 'express';
import { asyncHandler } from '../../middleware/error.middleware';
import { authMiddleware } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/auth.middleware';
import { NetworkAccessType } from '../../services/networkAccess/networkAccessTypes';
import materialPromotionController from '../../controllers/factory/materialPromotion.controller';

const router = express.Router();

// Apply factory authentication to all routes in this file
router.use(authMiddleware, authorize({ 
  userTypes: ['factory'], 
  accessType: NetworkAccessType.AUTHENTICATED 
}));

/**
 * @route   GET /api/factory/promotions
 * @desc    Get all promotions for the authenticated factory
 * @access  Factory
 */
router.get('/promotions', asyncHandler(materialPromotionController.getFactoryPromotions));

/**
 * @route   GET /api/factory/promotions/:id
 * @desc    Get a promotion by ID
 * @access  Factory
 */
router.get('/promotions/:id', asyncHandler(materialPromotionController.getPromotionById));

/**
 * @route   POST /api/factory/promotions
 * @desc    Allocate credits to promote a material
 * @access  Factory
 */
router.post('/promotions', asyncHandler(materialPromotionController.allocatePromotionCredits));

/**
 * @route   PUT /api/factory/promotions/:id/status
 * @desc    Update a promotion's status
 * @access  Factory
 */
router.put('/promotions/:id/status', asyncHandler(materialPromotionController.updatePromotionStatus));

/**
 * @route   GET /api/factory/materials
 * @desc    Get factory materials that can be promoted
 * @access  Factory
 */
router.get('/materials', asyncHandler(materialPromotionController.getFactoryMaterials));

/**
 * @route   GET /api/factory/promotions/analytics
 * @desc    Get promotion analytics
 * @access  Factory
 */
router.get('/promotions/analytics', asyncHandler(materialPromotionController.getPromotionAnalytics));

export default router;
