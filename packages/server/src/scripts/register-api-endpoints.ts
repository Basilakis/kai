/**
 * Register API Endpoints Script
 *
 * This script registers all API endpoints with the network access control system.
 * It ensures that all endpoints are properly listed in the admin panel.
 */

import { logger } from '../utils/logger';
import { supabase } from '../config/supabase';
import { NetworkAccessType } from '../utils/network';

// Define the endpoints to register
const endpointsToRegister = [
  // Response Quality Analytics Endpoints
  {
    path: '/api/analytics/response-quality/metrics',
    method: 'GET',
    description: 'Get response quality metrics',
    accessType: NetworkAccessType.ANY
  },
  {
    path: '/api/analytics/response-quality/problematic',
    method: 'GET',
    description: 'Get problematic responses',
    accessType: NetworkAccessType.ANY
  },
  {
    path: '/api/analytics/response-quality/feedback',
    method: 'POST',
    description: 'Record response feedback',
    accessType: NetworkAccessType.ANY
  },
  {
    path: '/api/analytics/response-quality/response',
    method: 'POST',
    description: 'Record model response with feedback',
    accessType: NetworkAccessType.ANY
  },

  // Model Improvement Endpoints
  {
    path: '/api/analytics/model-improvement/fine-tuning/jobs',
    method: 'GET',
    description: 'Get fine-tuning jobs',
    accessType: NetworkAccessType.ANY
  },
  {
    path: '/api/analytics/model-improvement/fine-tuning/jobs/:jobId',
    method: 'GET',
    description: 'Get fine-tuning job by ID',
    accessType: NetworkAccessType.ANY
  },
  {
    path: '/api/analytics/model-improvement/fine-tuning/check',
    method: 'POST',
    description: 'Check if model should be fine-tuned',
    accessType: NetworkAccessType.ANY
  },
  {
    path: '/api/analytics/model-improvement/fine-tuning/jobs',
    method: 'POST',
    description: 'Create fine-tuning job',
    accessType: NetworkAccessType.INTERNAL_ONLY
  },
  {
    path: '/api/analytics/model-improvement/fine-tuning/jobs/:jobId/start',
    method: 'POST',
    description: 'Start fine-tuning job',
    accessType: NetworkAccessType.INTERNAL_ONLY
  },
  {
    path: '/api/analytics/model-improvement/fine-tuning/jobs/:jobId/cancel',
    method: 'POST',
    description: 'Cancel fine-tuning job',
    accessType: NetworkAccessType.INTERNAL_ONLY
  },
  {
    path: '/api/analytics/model-improvement/error-patterns',
    method: 'GET',
    description: 'Analyze error patterns',
    accessType: NetworkAccessType.ANY
  },
  {
    path: '/api/analytics/model-improvement/error-trends',
    method: 'GET',
    description: 'Get error trends',
    accessType: NetworkAccessType.ANY
  },
  {
    path: '/api/analytics/model-improvement/improvement-suggestions',
    method: 'POST',
    description: 'Generate improvement suggestions',
    accessType: NetworkAccessType.ANY
  },
  {
    path: '/api/analytics/model-improvement/error-patterns',
    method: 'POST',
    description: 'Store error pattern',
    accessType: NetworkAccessType.INTERNAL_ONLY
  },
  {
    path: '/api/analytics/model-improvement/stored-error-patterns',
    method: 'GET',
    description: 'Get stored error patterns',
    accessType: NetworkAccessType.ANY
  },
  {
    path: '/api/analytics/model-improvement/error-patterns/:patternId/status',
    method: 'PATCH',
    description: 'Update error pattern status',
    accessType: NetworkAccessType.INTERNAL_ONLY
  },
  {
    path: '/api/analytics/model-improvement/improvement-suggestions',
    method: 'GET',
    description: 'Get improvement suggestions',
    accessType: NetworkAccessType.ANY
  },
  {
    path: '/api/analytics/model-improvement/improvement-suggestions/:suggestionId/status',
    method: 'PATCH',
    description: 'Update improvement suggestion status',
    accessType: NetworkAccessType.INTERNAL_ONLY
  }
];

/**
 * Register API endpoints with the network access control system
 */
async function registerApiEndpoints() {
  logger.info('Registering API endpoints with network access control system...');

  try {
    // Get existing endpoints
    const { data: existingEndpoints, error: fetchError } = await supabase
      .from('network_access_endpoints')
      .select('path, method');

    if (fetchError) {
      logger.error('Error fetching existing endpoints:', fetchError);
      throw fetchError;
    }

    // Create a map of existing endpoints for quick lookup
    const existingEndpointMap = new Map();
    existingEndpoints?.forEach(endpoint => {
      const key = `${endpoint.method}:${endpoint.path}`;
      existingEndpointMap.set(key, true);
    });

    // Register new endpoints
    let registered = 0;
    let skipped = 0;
    const registeredEndpoints = [];
    const skippedEndpoints = [];

    for (const endpoint of endpointsToRegister) {
      const key = `${endpoint.method}:${endpoint.path}`;

      // Skip if endpoint already exists
      if (existingEndpointMap.has(key)) {
        logger.debug(`Skipping existing endpoint: ${endpoint.method} ${endpoint.path}`);
        skippedEndpoints.push(`${endpoint.method} ${endpoint.path}`);
        skipped++;
        continue;
      }

      // Convert NetworkAccessType to database format
      const allowInternal = endpoint.accessType !== 'external-allowed';
      const allowExternal = endpoint.accessType !== 'internal-only';

      // Insert new endpoint
      const { error: insertError } = await supabase
        .from('network_access_endpoints')
        .insert({
          path: endpoint.path,
          method: endpoint.method,
          description: endpoint.description,
          allow_internal: allowInternal,
          allow_external: allowExternal
        });

      if (insertError) {
        logger.error(`Error registering endpoint ${endpoint.method} ${endpoint.path}:`, insertError);
        continue;
      }

      logger.info(`Registered endpoint: ${endpoint.method} ${endpoint.path}`);
      registeredEndpoints.push(`${endpoint.method} ${endpoint.path}`);
      registered++;
    }

    logger.info(`Endpoint registration complete. Registered: ${registered}, Skipped: ${skipped}`);

    return {
      registered,
      skipped,
      registeredEndpoints,
      skippedEndpoints
    };
  } catch (error) {
    logger.error('Error registering API endpoints:', error);
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    await registerApiEndpoints();
    logger.info('API endpoint registration completed successfully');
  } catch (error) {
    logger.error('Unhandled error:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    logger.error('Unhandled error:', error);
    process.exit(1);
  });
}

export default main;
