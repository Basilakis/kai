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
  // Property Reference Endpoints
  {
    path: '/api/property-references',
    method: 'GET',
    description: 'Get property reference images',
    accessType: NetworkAccessType.ANY
  },
  {
    path: '/api/property-references',
    method: 'POST',
    description: 'Create a property reference image',
    accessType: NetworkAccessType.ANY
  },
  {
    path: '/api/property-references/:id',
    method: 'PUT',
    description: 'Update a property reference image',
    accessType: NetworkAccessType.ANY
  },
  {
    path: '/api/property-references/:id',
    method: 'DELETE',
    description: 'Delete a property reference image',
    accessType: NetworkAccessType.ANY
  },

  // Visual Reference Training Endpoints
  {
    path: '/api/ai/visual-reference/datasets',
    method: 'POST',
    description: 'Create a training dataset from visual references',
    accessType: NetworkAccessType.INTERNAL_ONLY
  },
  {
    path: '/api/ai/visual-reference/models',
    method: 'POST',
    description: 'Train a model using a visual reference dataset',
    accessType: NetworkAccessType.INTERNAL_ONLY
  },
  {
    path: '/api/ai/visual-reference/train',
    method: 'POST',
    description: 'Create a dataset and train a model in one step',
    accessType: NetworkAccessType.INTERNAL_ONLY
  },

  // Visual Reference OCR Endpoints
  {
    path: '/api/ocr/visual-reference/enhance',
    method: 'POST',
    description: 'Enhance OCR extraction with visual reference verification',
    accessType: NetworkAccessType.ANY
  },
  {
    path: '/api/ocr/visual-reference/enhance-multiple',
    method: 'POST',
    description: 'Enhance multiple OCR extractions with visual reference verification',
    accessType: NetworkAccessType.ANY
  },
  {
    path: '/api/ocr/visual-reference/patterns/:propertyName/:materialType',
    method: 'GET',
    description: 'Get extraction patterns for a property based on visual references',
    accessType: NetworkAccessType.ANY
  },

  // Property Relationship Endpoints
  {
    path: '/api/property-relationships',
    method: 'POST',
    description: 'Create a new property relationship',
    accessType: NetworkAccessType.ANY
  },
  {
    path: '/api/property-relationships/:id',
    method: 'GET',
    description: 'Get a property relationship by ID',
    accessType: NetworkAccessType.ANY
  },
  {
    path: '/api/property-relationships/material/:materialType',
    method: 'GET',
    description: 'Get property relationships by material type',
    accessType: NetworkAccessType.ANY
  },
  {
    path: '/api/property-relationships/source/:sourceProperty',
    method: 'GET',
    description: 'Get property relationships by source property',
    accessType: NetworkAccessType.ANY
  },
  {
    path: '/api/property-relationships/target/:targetProperty',
    method: 'GET',
    description: 'Get property relationships by target property',
    accessType: NetworkAccessType.ANY
  },
  {
    path: '/api/property-relationships/:id',
    method: 'PUT',
    description: 'Update a property relationship',
    accessType: NetworkAccessType.ANY
  },
  {
    path: '/api/property-relationships/:id',
    method: 'DELETE',
    description: 'Delete a property relationship',
    accessType: NetworkAccessType.ANY
  },
  {
    path: '/api/property-relationships/:relationshipId/correlations',
    method: 'POST',
    description: 'Create a new property value correlation',
    accessType: NetworkAccessType.ANY
  },
  {
    path: '/api/property-relationships/:relationshipId/correlations',
    method: 'GET',
    description: 'Get property value correlations by relationship ID',
    accessType: NetworkAccessType.ANY
  },
  {
    path: '/api/property-relationships/correlations/:id',
    method: 'PUT',
    description: 'Update a property value correlation',
    accessType: NetworkAccessType.ANY
  },
  {
    path: '/api/property-relationships/correlations/:id',
    method: 'DELETE',
    description: 'Delete a property value correlation',
    accessType: NetworkAccessType.ANY
  },
  {
    path: '/api/property-relationships/:relationshipId/compatibility',
    method: 'POST',
    description: 'Create a new property compatibility rule',
    accessType: NetworkAccessType.ANY
  },
  {
    path: '/api/property-relationships/:relationshipId/compatibility',
    method: 'GET',
    description: 'Get property compatibility rules by relationship ID',
    accessType: NetworkAccessType.ANY
  },
  {
    path: '/api/property-relationships/compatibility/:id',
    method: 'PUT',
    description: 'Update a property compatibility rule',
    accessType: NetworkAccessType.ANY
  },
  {
    path: '/api/property-relationships/compatibility/:id',
    method: 'DELETE',
    description: 'Delete a property compatibility rule',
    accessType: NetworkAccessType.ANY
  },
  {
    path: '/api/property-relationships/validate',
    method: 'POST',
    description: 'Validate a set of property values',
    accessType: NetworkAccessType.ANY
  },
  {
    path: '/api/property-relationships/recommend',
    method: 'POST',
    description: 'Get property recommendations',
    accessType: NetworkAccessType.ANY
  },
  {
    path: '/api/property-relationships/graph/:materialType',
    method: 'GET',
    description: 'Get property graph visualization data',
    accessType: NetworkAccessType.ANY
  },
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
