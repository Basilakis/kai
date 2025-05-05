/**
 * Register Material Promotion API Endpoints
 *
 * This script registers the material promotion API endpoints with the network access control system.
 */

import { supabaseClient } from '../services/supabase/supabaseClient';
import { logger } from '../utils/logger';
import { NetworkAccessType } from '../services/networkAccess/networkAccessTypes';

// Define the endpoints to register
const endpointsToRegister = [
  // Factory Material Promotion Endpoints
  {
    path: '/api/factory/materials',
    method: 'GET',
    description: 'Get factory materials that can be promoted',
    accessType: NetworkAccessType.AUTHENTICATED
  },
  {
    path: '/api/factory/promotions',
    method: 'GET',
    description: 'Get all promotions for the authenticated factory',
    accessType: NetworkAccessType.AUTHENTICATED
  },
  {
    path: '/api/factory/promotions/:id',
    method: 'GET',
    description: 'Get a promotion by ID',
    accessType: NetworkAccessType.AUTHENTICATED
  },
  {
    path: '/api/factory/promotions',
    method: 'POST',
    description: 'Allocate credits to promote a material',
    accessType: NetworkAccessType.AUTHENTICATED
  },
  {
    path: '/api/factory/promotions/:id/status',
    method: 'PUT',
    description: 'Update a promotion\'s status',
    accessType: NetworkAccessType.AUTHENTICATED
  },
  {
    path: '/api/factory/promotions/analytics',
    method: 'GET',
    description: 'Get promotion analytics',
    accessType: NetworkAccessType.AUTHENTICATED
  }
];

/**
 * Register API endpoints with the network access control system
 */
async function registerMaterialPromotionEndpoints() {
  logger.info('Registering material promotion API endpoints with network access control system...');

  // Initialize Supabase client
  const supabase = supabaseClient.getClient();

  // Track registration results
  let registered = 0;
  const registeredEndpoints: string[] = [];
  const failedEndpoints: string[] = [];

  for (const endpoint of endpointsToRegister) {
    try {
      // Check if endpoint already exists
      const { data: existingEndpoint, error: checkError } = await supabase
        .from('network_access_endpoints')
        .select('id')
        .eq('path', endpoint.path)
        .eq('method', endpoint.method)
        .maybeSingle();

      if (checkError) {
        logger.error(`Error checking if endpoint exists: ${checkError.message}`);
        failedEndpoints.push(`${endpoint.method} ${endpoint.path}`);
        continue;
      }

      if (existingEndpoint) {
        logger.info(`Endpoint already registered: ${endpoint.method} ${endpoint.path}`);
        registeredEndpoints.push(`${endpoint.method} ${endpoint.path} (already exists)`);
        continue;
      }

      // Convert NetworkAccessType to database format
      const allowInternal = endpoint.accessType !== NetworkAccessType.EXTERNAL_ALLOWED;
      const allowExternal = endpoint.accessType !== NetworkAccessType.INTERNAL_ONLY;

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
        failedEndpoints.push(`${endpoint.method} ${endpoint.path}`);
        continue;
      }

      logger.info(`Registered endpoint: ${endpoint.method} ${endpoint.path}`);
      registeredEndpoints.push(`${endpoint.method} ${endpoint.path}`);
      registered++;
    } catch (error) {
      logger.error(`Unexpected error registering endpoint ${endpoint.method} ${endpoint.path}:`, error);
      failedEndpoints.push(`${endpoint.method} ${endpoint.path}`);
    }
  }

  // Print summary
  logger.info(`Registration complete. Registered ${registered} endpoints.`);

  if (registeredEndpoints.length > 0) {
    logger.info('Successfully registered endpoints:');
    registeredEndpoints.forEach(endpoint => logger.info(`- ${endpoint}`));
  }

  if (failedEndpoints.length > 0) {
    logger.warn('Failed to register endpoints:');
    failedEndpoints.forEach(endpoint => logger.warn(`- ${endpoint}`));
  }

  return {
    registered,
    registeredEndpoints,
    failedEndpoints
  };
}

// If this script is run directly, execute the registration
if (require.main === module) {
  // Initialize Supabase client
  // In CI/CD environment, we need to check for environment-specific variables
  const environment = process.env.NODE_ENV || 'development';
  let supabaseUrl = process.env.SUPABASE_URL;
  let supabaseKey = process.env.SUPABASE_KEY;

  // Check for environment-specific variables (used in CI/CD)
  if (environment === 'production') {
    supabaseUrl = process.env.SUPABASE_URL_PRODUCTION || supabaseUrl;
    supabaseKey = process.env.SUPABASE_KEY_PRODUCTION || supabaseKey;
  } else if (environment === 'staging') {
    supabaseUrl = process.env.SUPABASE_URL_STAGING || supabaseUrl;
    supabaseKey = process.env.SUPABASE_KEY_STAGING || supabaseKey;
  }

  if (!supabaseUrl || !supabaseKey) {
    logger.error('Supabase credentials not found for environment: ' + environment);
    process.exit(1);
  }

  // Initialize Supabase client
  supabaseClient.init({
    url: supabaseUrl,
    key: supabaseKey
  });

  registerMaterialPromotionEndpoints()
    .then(() => {
      logger.info('Material promotion endpoint registration script completed');
      process.exit(0);
    })
    .catch(error => {
      logger.error('Material promotion endpoint registration script failed:', error);
      process.exit(1);
    });
}

export default registerMaterialPromotionEndpoints;
