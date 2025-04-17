/**
 * Multi-Modal Search Routes
 * 
 * This file defines routes for multi-modal search functionality,
 * allowing users to search using a combination of text and image inputs.
 */

import express from 'express';
import { asyncHandler } from '../middleware/error.middleware';
import multiModalSearchController from '../controllers/multi-modal-search.controller';
import { 
  authMiddleware, 
  tokenRefreshMiddleware, 
  rateLimitMiddleware 
} from '../middleware/auth.middleware';

const router = express.Router();

/**
 * @route   POST /api/search/multi-modal
 * @desc    Perform multi-modal search with text and/or image
 * @access  Authenticated
 */
router.post(
  '/multi-modal',
  authMiddleware,
  tokenRefreshMiddleware,
  rateLimitMiddleware(10, 60), // 10 requests per minute
  multiModalSearchController.uploadMiddleware,
  asyncHandler(multiModalSearchController.performMultiModalSearch)
);

export default router;
