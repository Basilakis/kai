/**
 * Domain-Specific Search Controller
 * 
 * This controller provides API endpoints for domain-specific search functionality,
 * allowing users to search with optimizations for different domains.
 */

import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { ApiError } from '../middleware/error.middleware';
import { domainSearchService, DomainType } from '../services/search/domain-search-service';

/**
 * Perform domain-specific search
 * 
 * @route POST /api/search/domain
 */
export const performDomainSearch = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    
    // Get search parameters from request body
    const { 
      query,
      domain,
      materialType,
      limit,
      skip,
      includeKnowledge,
      includeRelationships,
      filters,
      sortBy,
      sortDirection,
      userPreferences
    } = req.body;
    
    // Validate query
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      throw new ApiError(400, 'Query is required');
    }
    
    // Validate domain
    if (!domain || typeof domain !== 'string') {
      throw new ApiError(400, 'Domain is required');
    }
    
    // Perform domain-specific search
    const results = await domainSearchService.search(
      {
        query,
        domain: domain as DomainType,
        materialType,
        limit: limit ? parseInt(limit) : undefined,
        skip: skip ? parseInt(skip) : undefined,
        includeKnowledge: includeKnowledge !== 'false',
        includeRelationships: includeRelationships !== 'false',
        filters: filters ? (typeof filters === 'string' ? JSON.parse(filters) : filters) : undefined,
        sortBy,
        sortDirection,
        userPreferences: userPreferences ? (typeof userPreferences === 'string' ? JSON.parse(userPreferences) : userPreferences) : undefined
      },
      userId
    );
    
    res.status(200).json({
      success: true,
      data: results.materials,
      knowledgeEntries: results.knowledgeEntries,
      relationships: results.relationships,
      domainSpecificData: results.domainSpecificData,
      enhancedQuery: results.enhancedQuery,
      metadata: results.metadata
    });
  } catch (error: any) {
    logger.error(`Error in domain search: ${error}`);
    
    // Handle specific error cases
    if (error.message === 'Insufficient credits') {
      res.status(402).json({
        success: false,
        error: 'Insufficient credits',
        message: 'You do not have enough credits to perform this search'
      });
    } else if (error.message === 'MCP server is not available') {
      res.status(503).json({
        success: false,
        error: 'Service unavailable',
        message: 'The search service is currently unavailable'
      });
    } else {
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message || 'Internal server error',
        message: 'Failed to perform domain search'
      });
    }
  }
};

/**
 * Get available domains
 * 
 * @route GET /api/search/domain/available
 */
export const getAvailableDomains = async (req: Request, res: Response) => {
  try {
    // Get available domains
    const domains = domainSearchService.getAvailableDomains();
    
    res.status(200).json({
      success: true,
      data: domains
    });
  } catch (error: any) {
    logger.error(`Error getting available domains: ${error}`);
    
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Internal server error',
      message: 'Failed to get available domains'
    });
  }
};

/**
 * Get domain ontology
 * 
 * @route GET /api/search/domain/:domain/ontology
 */
export const getDomainOntology = async (req: Request, res: Response) => {
  try {
    const { domain } = req.params;
    
    // Validate domain
    if (!domain) {
      throw new ApiError(400, 'Domain is required');
    }
    
    // Get domain ontology
    const ontology = domainSearchService.getDomainOntology(domain as DomainType);
    
    if (!ontology) {
      throw new ApiError(404, `Domain ontology not found for ${domain}`);
    }
    
    res.status(200).json({
      success: true,
      data: ontology
    });
  } catch (error: any) {
    logger.error(`Error getting domain ontology: ${error}`);
    
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || 'Internal server error',
      message: 'Failed to get domain ontology'
    });
  }
};

export default {
  performDomainSearch,
  getAvailableDomains,
  getDomainOntology
};
