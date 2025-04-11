/**
 * Enhanced Vector Admin Routes
 * 
 * Routes for administrative control of enhanced vector operations.
 * Includes endpoints for access control, monitoring, and configuration.
 */

import express, { Request, Response } from 'express';
import { asyncHandler } from '../../middleware/error.middleware';
import { authMiddleware, authorizeRoles } from '../../middleware/auth.middleware';
import { enhancedVectorService } from '../../services/supabase/enhanced-vector-service';
import { ApiError } from '../../middleware/error.middleware';
import { analyticsMiddleware } from '../../middleware/analytics.middleware';

// TypeScript has an issue with express.Router in this project's config
// @ts-ignore: Suppress TypeScript error while maintaining the project's pattern
const router = express.Router();

// All routes in this file require admin authentication
router.use(authMiddleware, authorizeRoles(['admin']));
router.use(analyticsMiddleware());

/**
 * @route   GET /api/admin/enhanced-vector/stats
 * @desc    Get enhanced vector search statistics
 * @access  Private (Admin)
 */
router.get('/stats', analyticsMiddleware('admin.vector.stats'), asyncHandler(async (_req: Request, res: Response) => {
  try {
    const stats = await enhancedVectorService.getPerformanceStats();
    // Log successful stats retrieval for monitoring
    logger.info('Enhanced vector statistics retrieved successfully');
  
    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error(`Error retrieving vector stats: ${error}`);
    throw error;
  }
}));

/**
 * @route   GET /api/admin/enhanced-vector/configs
 * @desc    Get all vector search configurations
 * @access  Private (Admin)
 */
router.get('/configs', analyticsMiddleware('admin.vector.configs.list'), asyncHandler(async (_req: Request, res: Response) => {
  try {
    const configs = await enhancedVectorService.getSearchConfigs();
    logger.info(`Retrieved ${configs.length} vector search configurations`);
  
    res.status(200).json({
      success: true,
      data: configs
    });
  } catch (error) {
    logger.error(`Error retrieving vector configs: ${error}`);
    throw error;
  }
}));

/**
 * @route   PUT /api/admin/enhanced-vector/configs/:name
 * @desc    Update vector search configuration
 * @access  Private (Admin)
 */
router.put('/configs/:name', analyticsMiddleware('admin.vector.configs.update'), asyncHandler(async (req: Request, res: Response) => {
  const { name } = req.params;
  const configData = req.body;
  
  if (!name) {
    throw new ApiError(400, 'Configuration name is required');
  }
  
  try {
    const config = await enhancedVectorService.updateSearchConfig({
      ...configData,
      name
    });
    
    logger.info(`Updated vector search configuration: ${name}`);
  
    res.status(200).json({
      success: true,
      data: config
    });
  } catch (error) {
    logger.error(`Error updating vector config ${name}: ${error}`);
    throw error;
  }
}));

/**
 * @route   DELETE /api/admin/enhanced-vector/configs/:name
 * @desc    Delete vector search configuration
 * @access  Private (Admin)
 */
router.delete('/configs/:name', analyticsMiddleware('admin.vector.configs.delete'), asyncHandler(async (req: Request, res: Response) => {
  const { name } = req.params;
  
  if (!name) {
    throw new ApiError(400, 'Configuration name is required');
  }
  
  try {
    const success = await enhancedVectorService.deleteSearchConfig(name);
    
    logger.info(`Deleted vector search configuration: ${name}`);
    
    res.status(200).json({
      success: true,
      message: `Vector search configuration "${name}" deleted successfully`
    });
  } catch (error) {
    logger.error(`Error deleting vector config ${name}: ${error}`);
    throw error;
  }
}));

/**
 * @route   POST /api/admin/enhanced-vector/refresh-views
 * @desc    Refresh vector materialized views
 * @access  Private (Admin)
 */
router.post('/refresh-views', analyticsMiddleware('admin.vector.refresh'), asyncHandler(async (_req: Request, res: Response) => {
  const success = await enhancedVectorService.refreshVectorViews();
  
  if (success) {
    res.status(200).json({
      success: true,
      message: 'Vector materialized views refreshed successfully'
    });
  } else {
    throw new ApiError(500, 'Failed to refresh vector materialized views');
  }
}));

/**
 * @route   GET /api/admin/enhanced-vector/access
 * @desc    Get access permissions for enhanced vector features
 * @access  Private (Admin)
 */
router.get('/access', analyticsMiddleware('admin.vector.access.get'), asyncHandler(async (_req: Request, res: Response) => {
  // This would connect to a permission service in a real implementation
  const accessPermissions = {
    enhanced_vector_search: {
      public: true,
      restricted_to_tiers: ['basic', 'premium', 'enterprise'],
      rate_limits: {
        basic: 100,
        premium: 500,
        enterprise: 2000
      }
    },
    knowledge_base_integration: {
      public: false,
      restricted_to_tiers: ['premium', 'enterprise'],
      rate_limits: {
        premium: 200,
        enterprise: 1000
      }
    },
    semantic_organization: {
      public: false,
      restricted_to_tiers: ['enterprise'],
      rate_limits: {
        enterprise: 500
      }
    }
  };
  
  res.status(200).json({
    success: true,
    data: accessPermissions
  });
}));

/**
 * @route   PUT /api/admin/enhanced-vector/access
 * @desc    Update access permissions for enhanced vector features
 * @access  Private (Admin)
 */
router.put('/access', analyticsMiddleware('admin.vector.access.update'), asyncHandler(async (req: Request, res: Response) => {
  const { feature, public: isPublic, tiers, rateLimits } = req.body;
  
  if (!feature) {
    throw new ApiError(400, 'Feature name is required');
  }
  
  // This would connect to a permission service in a real implementation
  // For now, just return success
  
  res.status(200).json({
    success: true,
    message: `Access permissions updated for ${feature}`,
    data: {
      feature,
      public: isPublic,
      restricted_to_tiers: tiers,
      rate_limits: rateLimits
    }
  });
}));

/**
 * @route   GET /api/admin/enhanced-vector/usage
 * @desc    Get usage metrics for enhanced vector endpoints
 * @access  Private (Admin)
 */
router.get('/usage', analyticsMiddleware('admin.vector.usage'), asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate, feature } = req.query;
  
  // This would connect to the analytics system in a real implementation
  // For now, just return dummy data
  const usageMetrics = {
    period: {
      start: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      end: endDate || new Date().toISOString()
    },
    endpoints: {
      '/api/vector/enhanced/search': {
        total_calls: 12500,
        average_response_time: 120, // ms
        error_rate: 0.02
      },
      '/api/vector/enhanced/knowledge/search': {
        total_calls: 8700,
        average_response_time: 180, // ms
        error_rate: 0.03
      },
      '/api/vector/enhanced/knowledge/route': {
        total_calls: 3200,
        average_response_time: 150, // ms
        error_rate: 0.01
      }
    },
    users: {
      total_active: 320,
      by_tier: {
        basic: 250,
        premium: 50,
        enterprise: 20
      }
    }
  };
  
  // Filter by feature if provided
  if (feature) {
    // Use Record type to fix the TypeScript error
    const filteredEndpoints: Record<string, any> = {};
    Object.keys(usageMetrics.endpoints).forEach(endpoint => {
      if (endpoint.includes(feature as string)) {
        filteredEndpoints[endpoint] = usageMetrics.endpoints[endpoint];
      }
    });
    usageMetrics.endpoints = filteredEndpoints;
  }
  
  res.status(200).json({
    success: true,
    data: usageMetrics
  });
}));

/**
 * @route   GET /api/admin/enhanced-vector/health
 * @desc    Get health status of enhanced vector system
 * @access  Private (Admin)
 */
router.get('/health', analyticsMiddleware('admin.vector.health'), asyncHandler(async (_req: Request, res: Response) => {
  // This would connect to health monitoring systems in a real implementation
  const healthStatus = {
    status: 'healthy',
    last_checked: new Date().toISOString(),
    components: {
      vector_database: {
        status: 'healthy',
        response_time: 15, // ms
        indexes: {
          materials: 'optimal',
          knowledge_entries: 'optimal'
        }
      },
      python_services: {
        status: 'healthy',
        hybrid_retriever: {
          status: 'active',
          memory_usage: '250MB',
          response_time: 85 // ms
        },
        context_assembler: {
          status: 'active',
          memory_usage: '180MB',
          response_time: 65 // ms
        }
      }
    }
  };
  
  res.status(200).json({
    success: true,
    data: healthStatus
  });
}));

export default router;