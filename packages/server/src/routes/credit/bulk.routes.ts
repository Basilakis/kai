/**
 * Bulk Credit Routes
 * 
 * This file defines the routes for bulk credit purchases,
 * including package management and volume discounts.
 */

import express from 'express';
import { asyncHandler } from '../../middleware/error.middleware';
import { authMiddleware, authorizeRoles } from '../../middleware/auth.middleware';
import { requireModuleAccess } from '../../middleware/module-access.middleware';
import bulkController from '../../controllers/credit/bulk.controller';

const router = express.Router();

/**
 * @route   GET /api/credits/bulk/packages
 * @desc    Get all bulk credit packages
 * @access  Public
 */
router.get(
  '/packages',
  asyncHandler(bulkController.getBulkCreditPackages)
);

/**
 * @route   POST /api/credits/bulk/packages
 * @desc    Create a bulk credit package
 * @access  Admin
 */
router.post(
  '/packages',
  authMiddleware,
  requireModuleAccess('credits'),
  authorizeRoles(['admin']),
  asyncHandler(bulkController.createBulkCreditPackage)
);

/**
 * @route   PUT /api/credits/bulk/packages/:packageId
 * @desc    Update a bulk credit package
 * @access  Admin
 */
router.put(
  '/packages/:packageId',
  authMiddleware,
  requireModuleAccess('credits'),
  authorizeRoles(['admin']),
  asyncHandler(bulkController.updateBulkCreditPackage)
);

/**
 * @route   DELETE /api/credits/bulk/packages/:packageId
 * @desc    Delete a bulk credit package
 * @access  Admin
 */
router.delete(
  '/packages/:packageId',
  authMiddleware,
  requireModuleAccess('credits'),
  authorizeRoles(['admin']),
  asyncHandler(bulkController.deleteBulkCreditPackage)
);

/**
 * @route   GET /api/credits/bulk/calculate-price
 * @desc    Calculate price for a credit amount
 * @access  Public
 */
router.get(
  '/calculate-price',
  asyncHandler(bulkController.calculateCreditPrice)
);

/**
 * @route   POST /api/credits/bulk/purchase
 * @desc    Purchase credits
 * @access  Private
 */
router.post(
  '/purchase',
  authMiddleware,
  requireModuleAccess('credits'),
  asyncHandler(bulkController.purchaseCredits)
);

/**
 * @route   POST /api/credits/bulk/purchase-package
 * @desc    Purchase a credit package
 * @access  Private
 */
router.post(
  '/purchase-package',
  authMiddleware,
  requireModuleAccess('credits'),
  asyncHandler(bulkController.purchaseCreditPackage)
);

export default router;
