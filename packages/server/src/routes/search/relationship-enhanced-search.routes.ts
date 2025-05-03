/**
 * Relationship Enhanced Search Routes
 * 
 * API routes for search functionality enhanced with the Property Relationship Graph.
 */

import express from 'express';
import { asyncHandler } from '../../middleware/error.middleware';
import { authMiddleware } from '../../middleware/auth.middleware';
import { relationshipEnhancedSearch } from '../../services/search/relationshipEnhancedSearch';
import { logger } from '../../utils/logger';

const router = express.Router();

/**
 * @route   POST /api/search/relationship-enhanced
 * @desc    Perform a search with relationship-based query expansion and reranking
 * @access  Private
 */
router.post(
  '/relationship-enhanced',
  authMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const { materialType, query, results } = req.body;
      
      if (!materialType || !query || !results) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: materialType, query, results'
        });
      }
      
      // Rerank results using relationship data
      const rerankedResults = await relationshipEnhancedSearch.rerankResults(
        materialType,
        query,
        results
      );
      
      // Generate related search suggestions
      const relatedSearches = await relationshipEnhancedSearch.generateRelatedSearches(
        materialType,
        query
      );
      
      res.json({
        success: true,
        results: rerankedResults,
        relatedSearches
      });
    } catch (error) {
      logger.error('Error performing relationship-enhanced search', { error });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   POST /api/search/expand-query
 * @desc    Expand a search query using relationship data
 * @access  Private
 */
router.post(
  '/expand-query',
  authMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const { materialType, query } = req.body;
      
      if (!materialType || !query) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: materialType, query'
        });
      }
      
      // Expand query using relationship data
      const expandedQuery = await relationshipEnhancedSearch.expandQuery(
        materialType,
        query
      );
      
      res.json({
        success: true,
        originalQuery: query,
        expandedQuery
      });
    } catch (error) {
      logger.error('Error expanding search query', { error });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   POST /api/search/related-searches
 * @desc    Generate related search suggestions based on the current query
 * @access  Private
 */
router.post(
  '/related-searches',
  authMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const { materialType, query } = req.body;
      
      if (!materialType || !query) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: materialType, query'
        });
      }
      
      // Generate related search suggestions
      const relatedSearches = await relationshipEnhancedSearch.generateRelatedSearches(
        materialType,
        query
      );
      
      res.json({
        success: true,
        relatedSearches
      });
    } catch (error) {
      logger.error('Error generating related searches', { error });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

export default router;
