/**
 * Post-Deployment Script
 *
 * This script runs all necessary post-deployment tasks automatically.
 * It is executed as part of the CI/CD pipeline after the application is deployed.
 *
 * To add new post-deployment tasks:
 * 1. Import any required functions
 * 2. Add your task to the runPostDeploymentTasks function
 * 3. Handle any errors appropriately
 *
 * The script will be automatically executed during the deployment process.
 */

import { logger } from '../utils/logger';
import { supabaseClient } from '../services/supabase/supabaseClient';

// Import post-deployment task functions
import registerMaterialPromotionEndpoints from './register-material-promotion-endpoints';
import updateSubscriptionModules from './update-subscription-modules';

/**
 * Run all post-deployment tasks
 */
async function runPostDeploymentTasks() {
  logger.info('Starting post-deployment tasks...');

  try {
    // Initialize Supabase client
    // In CI/CD environment, we need to check for environment-specific variables
    const environment = (process.env.NODE_ENV || 'development') as string;
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
    // For development and test environments, use default values

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not found for environment: ' + environment);
    }

    // Initialize Supabase client
    supabaseClient.init({
      url: supabaseUrl,
      key: supabaseKey
    });

    // ===== Material Promotion System =====
    logger.info('Running post-deployment tasks for Material Promotion System...');

    // Register material promotion module
    logger.info('Registering material promotion module...');
    await updateSubscriptionModules();

    // Register material promotion API endpoints
    logger.info('Registering material promotion API endpoints...');
    await registerMaterialPromotionEndpoints();

    // ===== Add new feature post-deployment tasks below =====
    // Example:
    // logger.info('Running post-deployment tasks for Feature X...');
    // await featureXPostDeploymentTask();

    logger.info('Post-deployment tasks completed successfully');
    return true;
  } catch (error) {
    logger.error('Post-deployment tasks failed:', error);
    // Don't throw error to prevent deployment failure
    // Just log the error and continue
    return false;
  }
}

// If this script is run directly, execute the tasks
// @ts-ignore: TypeScript doesn't recognize Node.js module system properly
if (require.main === module) {
  runPostDeploymentTasks()
    .then(success => {
      if (success) {
        logger.info('Post-deployment script completed successfully');
        process.exit(0);
      } else {
        logger.warn('Post-deployment script completed with warnings');
        // Exit with success code to prevent deployment failure
        process.exit(0);
      }
    })
    .catch(error => {
      logger.error('Post-deployment script failed:', error);
      // Exit with success code to prevent deployment failure
      process.exit(0);
    });
}

export default runPostDeploymentTasks;
