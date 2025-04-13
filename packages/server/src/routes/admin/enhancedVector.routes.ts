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
import { logger } from '../../utils/logger';

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
router.get('/stats', analyticsMiddleware(), asyncHandler(async (_req: Request, res: Response) => {
  try {
    // Get actual stats from the service
    // Using type assertion to fix TypeScript error
    const stats = await (enhancedVectorService as any).getPerformanceStats();

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
router.get('/configs', analyticsMiddleware(), asyncHandler(async (_req: Request, res: Response) => {
  try {
    // Get actual configurations from the service
    // Using type assertion to fix TypeScript error
    const configs = await (enhancedVectorService as any).getSearchConfigs();

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
router.put('/configs/:name', analyticsMiddleware(), asyncHandler(async (req: Request, res: Response) => {
  const { name } = req.params;
  const configData = req.body;

  if (!name) {
    throw new ApiError(400, 'Configuration name is required');
  }

  try {
    // Update the configuration using the service
    // Using type assertion to fix TypeScript error
    const config = await (enhancedVectorService as any).updateSearchConfig({
      name,
      ...configData
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
router.delete('/configs/:name', analyticsMiddleware(), asyncHandler(async (req: Request, res: Response) => {
  const { name } = req.params;

  if (!name) {
    throw new ApiError(400, 'Configuration name is required');
  }

  try {
    // Delete the configuration using the service
    // Using type assertion to fix TypeScript error
    const deleted = await (enhancedVectorService as any).deleteSearchConfig(name);

    if (deleted) {
      logger.info(`Deleted vector search configuration: ${name}`);

      res.status(200).json({
        success: true,
        message: `Vector search configuration "${name}" deleted successfully`
      });
    } else {
      throw new ApiError(500, `Failed to delete configuration "${name}"`);
    }
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
router.post('/refresh-views', analyticsMiddleware(), asyncHandler(async (_req: Request, res: Response) => {
  try {
    // Refresh views using the service
    // Using type assertion to fix TypeScript error
    const success = await (enhancedVectorService as any).refreshVectorViews();

    if (success) {
      res.status(200).json({
        success: true,
        message: 'Vector materialized views refreshed successfully'
      });
    } else {
      throw new ApiError(500, 'Failed to refresh vector materialized views');
    }
  } catch (error) {
    logger.error(`Error refreshing vector views: ${error}`);
    throw error;
  }
}));

/**
 * @route   GET /api/admin/enhanced-vector/access
 * @desc    Get access permissions for enhanced vector features
 * @access  Private (Admin)
 */
router.get('/access', analyticsMiddleware(), asyncHandler(async (_req: Request, res: Response) => {
  try {
    // Import subscription tier model functions
    const subscriptionTierModel = await import('../../models/subscriptionTier.model');
    const { supabaseClient } = await import('../../services/supabase/supabaseClient');

    // Get all subscription tiers including non-public ones
    const tiers = await subscriptionTierModel.getAllSubscriptionTiers(true);

    // Get access permissions from database
    const query = supabaseClient.getClient()
      .from('network_access_control')
      .select('*')
      .eq('category', 'enhanced_vector');

    const { data: features, error } = await query;

    if (error) {
      throw error;
    }

    // Format permissions based on features and tiers
    const accessPermissions: Record<string, any> = {};

    if (features && features.length > 0) {
      for (const feature of features) {
        accessPermissions[feature.feature_key] = {
          public: feature.is_public,
          restricted_to_tiers: feature.allowed_tiers || [],
          rate_limits: feature.rate_limits || {}
        };
      }
    } else {
      // If no features found, provide defaults for backward compatibility
      accessPermissions['enhanced_vector_search'] = {
        public: true,
        restricted_to_tiers: tiers.map(tier => tier.name),
        rate_limits: tiers.reduce((acc: Record<string, number>, tier) => {
          acc[tier.name] = tier.name === 'enterprise' ? 2000 : (tier.name === 'premium' ? 500 : 100);
          return acc;
        }, {})
      };
    }

    res.status(200).json({
      success: true,
      data: accessPermissions
    });
  } catch (error) {
    logger.error(`Error retrieving access permissions: ${error}`);
    throw error;
  }
}));

/**
 * @route   PUT /api/admin/enhanced-vector/access
 * @desc    Update access permissions for enhanced vector features
 * @access  Private (Admin)
 */
router.put('/access', analyticsMiddleware(), asyncHandler(async (req: Request, res: Response) => {
  const { feature, public: isPublic, tiers, rateLimits } = req.body;

  if (!feature) {
    throw new ApiError(400, 'Feature name is required');
  }

  try {
    // Import required dependencies
    const { supabaseClient } = await import('../../services/supabase/supabaseClient');

    // Check if feature exists
    const query = supabaseClient.getClient()
      .from('network_access_control')
      .select('*')
      .eq('feature_key', feature)
      .eq('category', 'enhanced_vector')
      .maybeSingle();

    const { data: existingFeature, error: checkError } = await query;

    if (checkError) {
      throw checkError;
    }

    let result;
    if (existingFeature) {
      // Update existing feature
      const updateQuery = supabaseClient.getClient()
        .from('network_access_control')
        .update({
          is_public: isPublic,
          allowed_tiers: tiers,
          rate_limits: rateLimits,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingFeature.id)
        .select()
        .single();

      const { data, error } = await updateQuery;

      if (error) {
        throw error;
      }

      result = data;
    } else {
      // Create new feature
      const insertQuery = supabaseClient.getClient()
        .from('network_access_control')
        .insert({
          feature_key: feature,
          category: 'enhanced_vector',
          is_public: isPublic,
          allowed_tiers: tiers,
          rate_limits: rateLimits,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      const { data, error } = await insertQuery;

      if (error) {
        throw error;
      }

      result = data;
    }

    logger.info(`Updated access permissions for ${feature}`);

    res.status(200).json({
      success: true,
      message: `Access permissions updated for ${feature}`,
      data: {
        feature: result.feature_key,
        public: result.is_public,
        restricted_to_tiers: result.allowed_tiers,
        rate_limits: result.rate_limits
      }
    });
  } catch (error) {
    logger.error(`Error updating access permissions for ${feature}: ${error}`);
    throw error;
  }
}));

/**
 * @route   GET /api/admin/enhanced-vector/usage
 * @desc    Get usage metrics for enhanced vector endpoints
 * @access  Private (Admin)
 */
router.get('/usage', analyticsMiddleware(), asyncHandler(async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, feature } = req.query;

    // Prepare date parameters
    let startDateObj: Date = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default to 30 days ago
    let endDateObj: Date = new Date(); // Default to now

    if (startDate && typeof startDate === 'string') {
      startDateObj = new Date(startDate);
    }

    if (endDate && typeof endDate === 'string') {
      endDateObj = new Date(endDate);
    }

    // Import required dependencies
    const { supabaseClient } = await import('../../services/supabase/supabaseClient');

    // Get API usage metrics from the analytics table
    const pathPattern = feature ?
      `/api/vector/enhanced/${feature}%` :
      '/api/vector/enhanced%';

    // Build query
    const analyticsQuery = supabaseClient.getClient()
      .from('api_analytics')
      .select('path, response_time, status_code, user_id, created_at')
      .gte('created_at', startDateObj.toISOString())
      .lte('created_at', endDateObj.toISOString())
      .ilike('path', pathPattern);

    const { data: apiCalls, error } = await analyticsQuery;

    if (error) {
      throw error;
    }

    // Process the raw data into a structured format
    const endpoints: Record<string, { total_calls: number, average_response_time: number, error_rate: number }> = {};
    const userCounts: Record<string, number> = {};
    const tierCounts: Record<string, number> = { basic: 0, premium: 0, enterprise: 0 };

    // Process each API call
    for (const call of apiCalls || []) {
      // Track endpoint metrics
      if (!endpoints[call.path]) {
        endpoints[call.path] = {
          total_calls: 0,
          average_response_time: 0,
          error_rate: 0
        };
      }

      if (call.path && endpoints[call.path]) {
        const endpoint = endpoints[call.path];
        if (endpoint) {
          endpoint.total_calls++;

          // Sum response times (we'll calculate average later)
          endpoint.average_response_time += call.response_time || 0;

          // Count errors (status >= 400)
          if (call.status_code >= 400) {
            endpoint.error_rate++;
          }
        }
      }

      // Track unique users
      if (call.user_id) {
        userCounts[call.user_id] = (userCounts[call.user_id] || 0) + 1;
      }
    }

    // Calculate averages and convert error counts to rates
    Object.keys(endpoints).forEach((path: string) => {
      const endpoint = endpoints[path];

      // Calculate average response time
      if (endpoint && endpoint.total_calls > 0) {
        endpoint.average_response_time = Math.round(endpoint.average_response_time / endpoint.total_calls);
        endpoint.error_rate = Number((endpoint.error_rate / endpoint.total_calls).toFixed(4));
      }
    });

    // Get user subscription data to fill in tier counts
    if (Object.keys(userCounts).length > 0) {
      const userIds = Object.keys(userCounts);

      const subscriptionsQuery = supabaseClient.getClient()
        .from('user_subscriptions')
        .select('user_id, tier_id')
        .in('user_id', userIds);

      const { data: subscriptions } = await subscriptionsQuery;

      if (subscriptions) {
        // Get tier names
        const { data: tiers } = await supabaseClient.getClient()
          .from('subscription_tiers')
          .select('id, name');

        const tierMap: Record<string, string> = {};
        if (tiers) {
          tiers.forEach((tier: { id: string, name: string }) => {
            tierMap[tier.id] = tier.name;
          });
        }

        // Count users by tier
        subscriptions.forEach((sub: { user_id: string, tier_id: string }) => {
          const tierName = tierMap[sub.tier_id] || 'basic';
          tierCounts[tierName] = (tierCounts[tierName] || 0) + 1;
        });
      }
    }

    // Create final result structure
    const usageMetrics = {
      period: {
        start: startDateObj.toISOString(),
        end: endDateObj.toISOString()
      },
      endpoints,
      users: {
        total_active: Object.keys(userCounts).length,
        by_tier: tierCounts
      }
    };

    res.status(200).json({
      success: true,
      data: usageMetrics
    });
  } catch (error) {
    logger.error(`Error retrieving usage metrics: ${error}`);
    throw error;
  }
}));

/**
 * @route   GET /api/admin/enhanced-vector/health
 * @desc    Get health status of enhanced vector system
 * @access  Private (Admin)
 */
router.get('/health', analyticsMiddleware(), asyncHandler(async (_req: Request, res: Response) => {
  try {
    // Import required modules
    const os = require('os');
    const { supabaseClient } = await import('../../services/supabase/supabaseClient');

    // Get memory utilization to help determine status
    const memoryUsagePercent = (os.totalmem() - os.freemem()) / os.totalmem() * 100;
    let systemStatus = 'healthy';

    if (memoryUsagePercent > 90) {
      systemStatus = 'unhealthy';
    } else if (memoryUsagePercent > 75) {
      systemStatus = 'degraded';
    }

    // Check vector database health by measuring response time
    let vectorDbStatus = 'healthy';
    let vectorDbResponseTime = 0;

    const dbCheckStart = Date.now();
    try {
      // Get vector index health from a simple check
      const queryResponse = await supabaseClient.getClient()
        .from('vector_search_config')
        .select('id, index_type, name');

      const { data, error } = queryResponse;

      if (!data || data.length === 0 || error) {
        throw new Error(error?.message || 'No vector configurations found');
      }

      vectorDbResponseTime = Date.now() - dbCheckStart;

      if (error) {
        vectorDbStatus = 'unhealthy';
      } else if (vectorDbResponseTime > 1000) {
        vectorDbStatus = 'degraded';
      }
    } catch (dbError) {
      vectorDbStatus = 'unhealthy';
      logger.error(`Database health check failed: ${dbError}`);
    }

    // Check Python services by attempting to ping the hybrid_retriever module
    let pythonServicesStatus = 'unknown';
    const pythonServicesDetails: Record<string, any> = {};

    try {
      // Attempt to invoke the Python module in a controlled way
      const hybridRetrieverResult = await (enhancedVectorService as any).invokePythonModule(
        'hybrid_retriever.py',
        'health_check',
        {}
      );

      if (hybridRetrieverResult) {
        pythonServicesStatus = hybridRetrieverResult.status || 'healthy';

        // Add each service status
        if (hybridRetrieverResult.services) {
          Object.keys(hybridRetrieverResult.services).forEach(service => {
            pythonServicesDetails[service] = hybridRetrieverResult.services[service];
          });
        }
      }
    } catch (pythonError) {
      pythonServicesStatus = 'degraded';
      logger.error(`Python services health check failed: ${pythonError}`);

      // Provide default details on services even if health check fails
      pythonServicesDetails.hybrid_retriever = {
        status: 'unknown',
        last_checked: new Date().toISOString()
      };

      pythonServicesDetails.context_assembler = {
        status: 'unknown',
        last_checked: new Date().toISOString()
      };
    }

    // Get index statistics
    const indexStats = await (async () => {
      try {
        // Get index stats using a direct query
        const { data } = await supabaseClient.getClient()
          .from('vector_index_stats')
          .select('*');

        // Format into a map by index name
        const stats: Record<string, any> = {};
        if (data && data.length > 0) {
          data.forEach((indexStat: { index_name: string, status: string, vector_count: number, last_optimized: string }) => {
            stats[indexStat.index_name] = {
              status: indexStat.status,
              vector_count: indexStat.vector_count,
              last_optimized: indexStat.last_optimized
            };
          });
          return stats;
        }

        // Return default stats if no data
        return {
          materials: { status: 'unknown' },
          knowledge_entries: { status: 'unknown' }
        };
      } catch (err) {
        logger.error(`Failed to get index stats: ${err}`);
        return {
          materials: { status: 'unknown' },
          knowledge_entries: { status: 'unknown' }
        };
      }
    })();

    // Create health status object
    const healthStatus = {
      status: systemStatus,
      last_checked: new Date().toISOString(),
      components: {
        vector_database: {
          status: vectorDbStatus,
          response_time: vectorDbResponseTime,
          indexes: indexStats
        },
        python_services: {
          status: pythonServicesStatus,
          ...pythonServicesDetails
        }
      }
    };

    res.status(200).json({
      success: true,
      data: healthStatus
    });
  } catch (error) {
    logger.error(`Error checking health status: ${error}`);
    throw error;
  }
}));

export default router;