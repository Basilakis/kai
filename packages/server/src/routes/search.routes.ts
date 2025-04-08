/**
 * Unified Search Routes
 * 
 * Defines a single unified search endpoint that can search across all resource types
 * based on the 'type' parameter. This significantly simplifies API integration by
 * providing a consistent interface for third-party developers.
 */

import express, { Request, Response } from 'express';
import { searchController } from '../controllers/search.controller';
import { asyncHandler } from '../middleware/error.middleware';
import { defaultLimiter } from '../middleware/rate-limit.middleware';

// TypeScript has an issue with express.Router in this project's config
// @ts-ignore: Suppress TypeScript error while maintaining the project's pattern
const router = express.Router();

/**
 * @route   GET /api/search
 * @desc    Unified search endpoint for all resource types
 * @access  Public/Private (depends on resource)
 * @params  
 *    - type: (required) Resource type to search (materials, collections, models, history, etc.)
 *    - query: (optional) Search query text
 *    - limit: (optional) Maximum number of results to return
 *    - skip/offset: (optional) Number of results to skip (for pagination)
 *    - sort: (optional) Comma-separated list of fields to sort by (field:asc|desc)
 *    - [additional resource-specific parameters]
 */
router.get('/', defaultLimiter, asyncHandler(searchController.unifiedSearch));

/**
 * @route   POST /api/search
 * @desc    Unified search endpoint with request body for complex filters
 * @access  Public/Private (depends on resource)
 * @body    
 *    - type: (required) Resource type to search
 *    - query: (optional) Search query text
 *    - filter: (optional) Complex filter object
 *    - limit: (optional) Maximum number of results
 *    - offset: (optional) Number of results to skip
 *    - sort: (optional) Sort specification
 *    - [additional resource-specific parameters]
 */
router.post('/', defaultLimiter, asyncHandler(async (req: Request, res: Response) => {
  // Move body parameters to query for consistent handling
  req.query = { ...req.query, ...req.body };
  return searchController.unifiedSearch(req, res);
}));

export default router;