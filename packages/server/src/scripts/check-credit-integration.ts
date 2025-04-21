/**
 * Check Credit Integration Script
 *
 * This script checks if the credit system is properly integrated with
 * the fine-tuning process and other MCP operations.
 */

import { logger } from '../utils/logger';
import { supabase } from '../config/supabase';
import { MCPServiceKey } from '../services/mcp/mcpClientService';
import creditService from '../services/credit/creditService';

/**
 * Check if credit service is properly configured
 */
async function checkCreditServiceConfiguration() {
  logger.info('Checking credit service configuration...');

  try {
    // Check if credit service is initialized
    if (!creditService) {
      logger.error('Credit service is not initialized');
      return false;
    }

    // Check if credit service has the required methods
    const requiredMethods = [
      'hasEnoughCreditsForService',
      'useServiceCredits',
      'getCreditBalance',
      'getCreditUsage'
    ];

    const missingMethods = requiredMethods.filter(method => !(method in creditService));
    if (missingMethods.length > 0) {
      logger.error(`Credit service is missing required methods: ${missingMethods.join(', ')}`);
      return false;
    }

    logger.info('Credit service is properly configured');
    return true;
  } catch (error) {
    logger.error('Error checking credit service configuration:', error);
    return false;
  }
}

/**
 * Check if credit costs are defined for MCP operations
 */
async function checkCreditCosts() {
  logger.info('Checking credit costs for MCP operations...');

  try {
    // Get credit costs from settings
    const { data: settings, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'credit_costs')
      .single();

    if (error) {
      logger.error('Error getting credit costs from settings:', error);
      return false;
    }

    if (!settings || !settings.value) {
      logger.warn('Credit costs are not defined in settings');
      logger.warn('Using default credit costs');
      return false;
    }

    const creditCosts = settings.value;

    // Check if credit costs are defined for model fine-tuning
    const requiredServiceKeys = [
      MCPServiceKey.MODEL_TRAINING,
      MCPServiceKey.TEXT_GENERATION,
      MCPServiceKey.TEXT_EMBEDDING,
      MCPServiceKey.IMAGE_GENERATION,
      MCPServiceKey.IMAGE_ANALYSIS
    ];

    const missingServiceKeys = requiredServiceKeys.filter(key => !(key in creditCosts));
    if (missingServiceKeys.length > 0) {
      logger.warn(`Credit costs are not defined for the following MCP operations: ${missingServiceKeys.join(', ')}`);
      logger.warn('Using default credit costs for these operations');
      return false;
    }

    logger.info('Credit costs are properly defined for all MCP operations');
    return true;
  } catch (error) {
    logger.error('Error checking credit costs:', error);
    return false;
  }
}

/**
 * Check if MCP integration is properly configured for fine-tuning
 */
async function checkMCPFineTuningIntegration() {
  logger.info('Checking MCP fine-tuning integration...');

  try {
    // Check if MODEL_TRAINING service key is defined
    if (!Object.values(MCPServiceKey).includes(MCPServiceKey.MODEL_TRAINING)) {
      logger.error('MODEL_TRAINING service key is not defined in MCPServiceKey enum');
      return false;
    }

    // Check if the MCP client service has the required methods
    const requiredMethods = [
      'fineTuneModel',
      'cancelFineTuningJob',
      'getFineTuningJobStatus'
    ];

    // Import the MCP client service
    const { mcpClientService } = require('../services/mcp/mcpClientService');

    const missingMethods = requiredMethods.filter(method => !(method in mcpClientService));
    if (missingMethods.length > 0) {
      logger.error(`MCP client service is missing required methods: ${missingMethods.join(', ')}`);
      return false;
    }

    logger.info('MCP fine-tuning integration is properly configured');
    return true;
  } catch (error) {
    logger.error('Error checking MCP fine-tuning integration:', error);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    // Check credit service configuration
    const creditServiceConfigured = await checkCreditServiceConfiguration();
    if (!creditServiceConfigured) {
      logger.warn('Credit service is not properly configured');
    }

    // Check credit costs
    const creditCostsDefined = await checkCreditCosts();
    if (!creditCostsDefined) {
      logger.warn('Credit costs are not properly defined');
    }

    // Check MCP fine-tuning integration
    const mcpFineTuningIntegrated = await checkMCPFineTuningIntegration();
    if (!mcpFineTuningIntegrated) {
      logger.warn('MCP fine-tuning integration is not properly configured');
    }

    if (creditServiceConfigured && creditCostsDefined) {
      logger.info('Credit system is properly configured');
    } else {
      logger.warn('Credit system configuration has issues that need to be addressed');
    }

    if (mcpFineTuningIntegrated) {
      logger.info('MCP fine-tuning integration is properly configured');
    } else {
      logger.warn('MCP fine-tuning integration has issues that need to be addressed');
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
