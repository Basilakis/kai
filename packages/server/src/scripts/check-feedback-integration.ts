/**
 * Check Feedback Integration Script
 * 
 * This script checks if the feedback collection is properly integrated
 * with the UI and the database.
 */

import { logger } from '../utils/logger';
import { supabase } from '../config/supabase';
import fs from 'fs';
import path from 'path';

/**
 * Check if feedback components are properly integrated with the UI
 */
async function checkFeedbackComponents() {
  logger.info('Checking feedback component integration...');

  try {
    // Check if ResponseFeedback component exists
    const responseFeedbackPath = path.join(__dirname, '../../../client/src/components/feedback/ResponseFeedback.tsx');
    if (!fs.existsSync(responseFeedbackPath)) {
      logger.error('ResponseFeedback component does not exist');
      return false;
    }

    // Check if ResponseMessage component exists
    const responseMessagePath = path.join(__dirname, '../../../client/src/components/chat/ResponseMessage.tsx');
    if (!fs.existsSync(responseMessagePath)) {
      logger.error('ResponseMessage component does not exist');
      return false;
    }

    // Check if response-quality.service.ts exists
    const responseQualityServicePath = path.join(__dirname, '../../../client/src/services/response-quality.service.ts');
    if (!fs.existsSync(responseQualityServicePath)) {
      logger.error('response-quality.service.ts does not exist');
      return false;
    }

    logger.info('Feedback components exist');

    // Check if components are imported in chat components
    // This is a simple check that doesn't guarantee the components are actually used
    const chatComponentsDir = path.join(__dirname, '../../../client/src/components/chat');
    if (!fs.existsSync(chatComponentsDir)) {
      logger.warn('Chat components directory does not exist');
      return false;
    }

    let feedbackImported = false;
    const chatFiles = fs.readdirSync(chatComponentsDir);
    for (const file of chatFiles) {
      if (file.endsWith('.tsx') || file.endsWith('.jsx')) {
        const content = fs.readFileSync(path.join(chatComponentsDir, file), 'utf8');
        if (content.includes('ResponseFeedback') || content.includes('ResponseMessage')) {
          feedbackImported = true;
          break;
        }
      }
    }

    if (!feedbackImported) {
      logger.warn('Feedback components are not imported in any chat component');
      logger.warn('Make sure to integrate the ResponseFeedback or ResponseMessage components in your chat UI');
      return false;
    }

    logger.info('Feedback components are properly integrated with the UI');
    return true;
  } catch (error) {
    logger.error('Error checking feedback components:', error);
    return false;
  }
}

/**
 * Check if feedback API endpoints are properly configured
 */
async function checkFeedbackAPIEndpoints() {
  logger.info('Checking feedback API endpoints...');

  try {
    // Check if response-quality.routes.ts exists
    const responseQualityRoutesPath = path.join(__dirname, '../../routes/analytics/response-quality.routes.ts');
    if (!fs.existsSync(responseQualityRoutesPath)) {
      logger.error('response-quality.routes.ts does not exist');
      return false;
    }

    // Check if the routes are registered in the server
    const serverPath = path.join(__dirname, '../../server.ts');
    if (!fs.existsSync(serverPath)) {
      logger.error('server.ts does not exist');
      return false;
    }

    const serverContent = fs.readFileSync(serverPath, 'utf8');
    if (!serverContent.includes('analyticsEnhancedRoutes') && !serverContent.includes('analyticsRoutes')) {
      logger.warn('Analytics routes are not registered in the server');
      return false;
    }

    logger.info('Feedback API endpoints are properly configured');
    return true;
  } catch (error) {
    logger.error('Error checking feedback API endpoints:', error);
    return false;
  }
}

/**
 * Check if feedback database tables are properly configured
 */
async function checkFeedbackDatabaseTables() {
  logger.info('Checking feedback database tables...');

  try {
    // Check if model_responses table exists
    const { count: modelResponsesCount, error: modelResponsesError } = await supabase
      .from('model_responses')
      .select('*', { count: 'exact', head: true });

    if (modelResponsesError) {
      logger.error('Error checking model_responses table:', modelResponsesError);
      return false;
    }

    // Check if response_feedback table exists
    const { count: responseFeedbackCount, error: responseFeedbackError } = await supabase
      .from('response_feedback')
      .select('*', { count: 'exact', head: true });

    if (responseFeedbackError) {
      logger.error('Error checking response_feedback table:', responseFeedbackError);
      return false;
    }

    logger.info('Feedback database tables exist');
    logger.info(`model_responses table has ${modelResponsesCount || 0} rows`);
    logger.info(`response_feedback table has ${responseFeedbackCount || 0} rows`);

    return true;
  } catch (error) {
    logger.error('Error checking feedback database tables:', error);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    // Check feedback components
    const componentsIntegrated = await checkFeedbackComponents();
    if (!componentsIntegrated) {
      logger.warn('Feedback components are not properly integrated with the UI');
    }

    // Check feedback API endpoints
    const endpointsConfigured = await checkFeedbackAPIEndpoints();
    if (!endpointsConfigured) {
      logger.warn('Feedback API endpoints are not properly configured');
    }

    // Check feedback database tables
    const tablesConfigured = await checkFeedbackDatabaseTables();
    if (!tablesConfigured) {
      logger.warn('Feedback database tables are not properly configured');
    }

    if (componentsIntegrated && endpointsConfigured && tablesConfigured) {
      logger.info('Feedback collection is properly integrated with the UI and the database');
    } else {
      logger.warn('Feedback collection integration has issues that need to be addressed');
    }
  } catch (error) {
    logger.error('Unhandled error:', error);
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  logger.error('Unhandled error:', error);
  process.exit(1);
});

export default main;
