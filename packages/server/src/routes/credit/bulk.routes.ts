/**
 * Bulk Credit Routes
 * 
 * This file defines the routes for bulk credit purchases,
 * including package management and volume discounts.
 */

import express from 'express';
import { asyncHandler } from '../../middleware/error.middleware';
import { authMiddleware } from '../../middleware/auth.middleware';
import { adminMiddleware } from '../../middleware/admin.middleware';
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
  adminMiddleware,
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
  adminMiddleware,
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
  adminMiddleware,
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
  asyncHandler(bulkController.purchaseCreditPackage)
);

export default router;
