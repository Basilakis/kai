/**
 * Setup API Access Control Script
 * 
 * This script sets up the API access control system by:
 * 1. Checking for unregistered endpoints
 * 2. Registering all endpoints
 * 3. Verifying that all endpoints are properly registered
 */

import { logger } from '../utils/logger';
import checkUnregisteredEndpoints from './check-unregistered-endpoints';
import registerApiEndpoints from './register-api-endpoints';

/**
 * Main function
 */
async function main() {
  try {
    logger.info('Setting up API access control...');

    // Step 1: Check for unregistered endpoints
    logger.info('Step 1: Checking for unregistered endpoints...');
    const unregisteredEndpoints = await checkUnregisteredEndpoints();
    
    if (unregisteredEndpoints.length > 0) {
      logger.info(`Found ${unregisteredEndpoints.length} unregistered endpoints. Registering them...`);
      
      // Step 2: Register all endpoints
      logger.info('Step 2: Registering all endpoints...');
      await registerApiEndpoints();
      
      // Step 3: Verify that all endpoints are properly registered
      logger.info('Step 3: Verifying that all endpoints are properly registered...');
      const remainingUnregistered = await checkUnregisteredEndpoints();
      
      if (remainingUnregistered.length > 0) {
        logger.warn(`There are still ${remainingUnregistered.length} unregistered endpoints.`);
        logger.warn('Please check the logs and register them manually if needed.');
      } else {
        logger.info('All endpoints are now properly registered!');
      }
    } else {
      logger.info('All endpoints are already properly registered!');
    }
    
    logger.info('API access control setup complete!');
  } catch (error) {
    logger.error('Error setting up API access control:', error);
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
