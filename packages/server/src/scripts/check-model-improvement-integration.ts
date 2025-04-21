/**
 * Check Model Improvement Integration Script
 * 
 * This script runs all the checks to ensure the model improvement
 * features are properly integrated with the system.
 */

import { logger } from '../utils/logger';
import checkDbTables from './check-db-tables';
import checkMcpEndpoints from './check-mcp-endpoints';
import checkCreditIntegration from './check-credit-integration';
import checkFeedbackIntegration from './check-feedback-integration';

/**
 * Main function
 */
async function main() {
  logger.info('Checking model improvement integration...');

  try {
    // Check database tables
    logger.info('=== Checking Database Tables ===');
    const dbTablesResult = await checkDbTables();
    logger.info('');

    // Check MCP endpoints
    logger.info('=== Checking MCP Endpoints ===');
    const mcpEndpointsResult = await checkMcpEndpoints();
    logger.info('');

    // Check credit integration
    logger.info('=== Checking Credit Integration ===');
    const creditIntegrationResult = await checkCreditIntegration();
    logger.info('');

    // Check feedback integration
    logger.info('=== Checking Feedback Integration ===');
    const feedbackIntegrationResult = await checkFeedbackIntegration();
    logger.info('');

    // Summary
    logger.info('=== Integration Check Summary ===');
    logger.info(`Database Tables: ${dbTablesResult ? '✅ OK' : '❌ Issues Found'}`);
    logger.info(`MCP Endpoints: ${mcpEndpointsResult ? '✅ OK' : '❌ Issues Found'}`);
    logger.info(`Credit Integration: ${creditIntegrationResult ? '✅ OK' : '❌ Issues Found'}`);
    logger.info(`Feedback Integration: ${feedbackIntegrationResult ? '✅ OK' : '❌ Issues Found'}`);

    if (dbTablesResult && mcpEndpointsResult && creditIntegrationResult && feedbackIntegrationResult) {
      logger.info('✅ All checks passed! Model improvement features are properly integrated.');
    } else {
      logger.warn('❌ Some checks failed. Please address the issues before using model improvement features.');
    }
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
