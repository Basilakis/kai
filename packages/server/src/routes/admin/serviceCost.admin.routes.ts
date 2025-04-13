/**
 * Service Cost Admin Routes
 * 
 * These routes handle admin APIs for managing service costs.
 */

import express from 'express';
import serviceCostAdminController from '../../controllers/admin/serviceCost.admin.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { adminMiddleware } from '../../middleware/admin.middleware';
import { asyncHandler } from '../../utils/asyncHandler';

const router = express.Router();

// Apply auth and admin middleware to all routes
router.use(authMiddleware, adminMiddleware);

/**
 * @route   GET /api/admin/service-costs
 * @desc    Get all service costs
 * @access  Admin
 */
router.get(
  '/',
  asyncHandler(serviceCostAdminController.getAllServiceCosts)
);

/**
 * @route   GET /api/admin/service-costs/:id
 * @desc    Get service cost by ID
 * @access  Admin
 */
router.get(
  '/:id',
  asyncHandler(serviceCostAdminController.getServiceCostById)
);

/**
 * @route   POST /api/admin/service-costs
 * @desc    Create a new service cost
 * @access  Admin
 */
router.post(
  '/',
  asyncHandler(serviceCostAdminController.createServiceCost)
);

/**
 * @route   PUT /api/admin/service-costs/:id
 * @desc    Update a service cost
 * @access  Admin
 */
router.put(
  '/:id',
  asyncHandler(serviceCostAdminController.updateServiceCost)
);

/**
 * @route   DELETE /api/admin/service-costs/:id
 * @desc    Delete a service cost
 * @access  Admin
 */
router.delete(
  '/:id',
  asyncHandler(serviceCostAdminController.deleteServiceCost)
);

export default router;
