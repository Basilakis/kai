/**
 * Domain-Specific Search Routes
 * 
 * This file defines routes for domain-specific search functionality,
 * allowing users to search with optimizations for different domains.
 */

import express from 'express';
import { asyncHandler } from '../middleware/error.middleware';
import domainSearchController from '../controllers/domain-search.controller';
import { 
  authMiddleware, 
  tokenRefreshMiddleware, 
  rateLimitMiddleware 
} from '../middleware/auth.middleware';

const router = express.Router();

/**
 * @route   POST /api/search/domain
 * @desc    Perform domain-specific search
 * @access  Authenticated
 */
router.post(
  '/domain',
  authMiddleware,
  tokenRefreshMiddleware,
  rateLimitMiddleware(10, 60), // 10 requests per minute
  asyncHandler(domainSearchController.performDomainSearch)
);

/**
 * @route   GET /api/search/domain/available
 * @desc    Get available domains
 * @access  Authenticated
 */
router.get(
  '/domain/available',
  authMiddleware,
  tokenRefreshMiddleware,
  rateLimitMiddleware(20, 60), // 20 requests per minute
  asyncHandler(domainSearchController.getAvailableDomains)
);

/**
 * @route   GET /api/search/domain/:domain/ontology
 * @desc    Get domain ontology
 * @access  Authenticated
 */
router.get(
  '/domain/:domain/ontology',
  authMiddleware,
  tokenRefreshMiddleware,
  rateLimitMiddleware(20, 60), // 20 requests per minute
  asyncHandler(domainSearchController.getDomainOntology)
);

export default router;
