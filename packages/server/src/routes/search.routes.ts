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
import { 
  authMiddleware, 
  tokenRefreshMiddleware, 
  rateLimitMiddleware 
} from '../middleware/auth.middleware';

// TypeScript has an issue with express.Router in this project's config
// @ts-ignore: Suppress TypeScript error while maintaining the project's pattern
const router = express.Router();

/**
 * @openapi
 * /search:
 *   get:
 *     tags:
 *       - Search
 *     summary: Unified search endpoint for all resource types
 *     description: |
 *       A single unified search endpoint that can search across any resource type
 *       based on the 'type' parameter value. This simplifies API integration by
 *       providing a consistent interface for developers.
 *     parameters:
 *       - in: query
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [materials, collections, models, catalogs, history, datasets]
 *         description: Resource type to search
 *       - in: query
 *         name: query
 *         schema:
 *           type: string
 *         description: Search query text
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Maximum number of results to return
 *       - in: query
 *         name: skip
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Number of results to skip (for pagination)
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Alternative to skip (for pagination)
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *         description: Comma-separated list of fields to sort by (field:asc|desc)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successful search operation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 count:
 *                   type: integer
 *                   example: 15
 *                 total:
 *                   type: integer
 *                   example: 120
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *                 data:
 *                   type: array
 *                   items:
 *                     oneOf:
 *                       - $ref: '#/components/schemas/Material'
 *                       - type: object
 *                         description: Other resource types based on 'type' parameter
 *       400:
 *         description: Bad request - missing required fields or invalid parameters
 *       401:
 *         description: Not authenticated
 *       429:
 *         description: Too many requests - rate limit exceeded
 *       500:
 *         description: Server error
 */
router.get('/', 
  authMiddleware,
  tokenRefreshMiddleware,
  rateLimitMiddleware({ windowMs: 60 * 1000, maxRequests: 30 }), // 30 requests per minute
  asyncHandler(searchController.unifiedSearch)
);

/**
 * @openapi
 * /search:
 *   post:
 *     tags:
 *       - Search
 *     summary: Advanced search with complex filters via request body
 *     description: |
 *       Unified search endpoint that accepts a request body for complex search
 *       criteria and advanced filtering options. Supports the same functionality
 *       as the GET endpoint but allows for more complex query structures.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [materials, collections, models, catalogs, history, datasets]
 *                 description: Resource type to search
 *               query:
 *                 type: string
 *                 description: Search query text
 *               filter:
 *                 type: object
 *                 description: Complex filter object for advanced filtering
 *                 example: {"manufacturer":"Carrara", "color.name":"White"}
 *               limit:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 100
 *                 default: 20
 *                 description: Maximum number of results to return
 *               offset:
 *                 type: integer
 *                 minimum: 0
 *                 default: 0
 *                 description: Number of results to skip (for pagination)
 *               sort:
 *                 type: object
 *                 description: Sort specification with field names as keys and sort direction as values
 *                 example: {"createdAt":"desc", "name":"asc"}
 *               fields:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Specific fields to include in the results
 *                 example: ["name", "manufacturer", "color"]
 *     responses:
 *       200:
 *         description: Successful search operation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 count:
 *                   type: integer
 *                   example: 15
 *                 total:
 *                   type: integer
 *                   example: 120
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *                 data:
 *                   type: array
 *                   items:
 *                     oneOf:
 *                       - $ref: '#/components/schemas/Material'
 *                       - type: object
 *                         description: Other resource types based on 'type' parameter
 *       400:
 *         description: Bad request - missing required fields or invalid parameters
 *       401:
 *         description: Not authenticated
 *       429:
 *         description: Too many requests - rate limit exceeded
 *       500:
 *         description: Server error
 */
router.post('/', 
  authMiddleware,
  tokenRefreshMiddleware,
  rateLimitMiddleware({ windowMs: 60 * 1000, maxRequests: 20 }), // 20 requests per minute
  asyncHandler(async (req: Request, res: Response) => {
  // Move body parameters to query for consistent handling
  req.query = { ...req.query, ...req.body };
  return searchController.unifiedSearch(req, res);
}));

export default router;