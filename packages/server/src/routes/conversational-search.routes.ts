/**
 * Conversational Search Routes
 * 
 * This file defines routes for conversational search functionality,
 * allowing users to maintain context across multiple search queries.
 */

import express from 'express';
import { asyncHandler } from '../middleware/error.middleware';
import conversationalSearchController from '../controllers/conversational-search.controller';
import { 
  authMiddleware, 
  tokenRefreshMiddleware, 
  rateLimitMiddleware 
} from '../middleware/auth.middleware';

const router = express.Router();

/**
 * @route   POST /api/search/conversational
 * @desc    Perform conversational search
 * @access  Authenticated
 */
router.post(
  '/conversational',
  authMiddleware,
  tokenRefreshMiddleware,
  rateLimitMiddleware(10, 60), // 10 requests per minute
  asyncHandler(conversationalSearchController.performConversationalSearch)
);

/**
 * @route   GET /api/search/conversational/history/:sessionId
 * @desc    Get conversation history
 * @access  Authenticated
 */
router.get(
  '/conversational/history/:sessionId',
  authMiddleware,
  tokenRefreshMiddleware,
  rateLimitMiddleware(20, 60), // 20 requests per minute
  asyncHandler(conversationalSearchController.getConversationHistory)
);

/**
 * @route   DELETE /api/search/conversational/history/:sessionId
 * @desc    Clear conversation history
 * @access  Authenticated
 */
router.delete(
  '/conversational/history/:sessionId',
  authMiddleware,
  tokenRefreshMiddleware,
  rateLimitMiddleware(10, 60), // 10 requests per minute
  asyncHandler(conversationalSearchController.clearConversationHistory)
);

export default router;
