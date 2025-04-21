/**
 * Check MCP Endpoints Script
 * 
 * This script checks if the MCP server supports the required endpoints
 * for model fine-tuning and other features.
 */

import axios from 'axios';
import { logger } from '../utils/logger';
import { env } from '../../shared/src/utils/environment';

// MCP server configuration
const MCP_SERVER_URL = env.ml?.mcpServerUrl || process.env.MCP_SERVER_URL || 'http://localhost:8000';
const MCP_TIMEOUT = env.ml?.mcpTimeout || 30000;

// Required endpoints
const requiredEndpoints = [
  { method: 'POST', path: '/api/v1/model/fine-tune', description: 'Fine-tune a model' },
  { method: 'GET', path: '/api/v1/model/fine-tune/{jobId}', description: 'Get fine-tuning job status' },
  { method: 'POST', path: '/api/v1/model/fine-tune/{jobId}/cancel', description: 'Cancel a fine-tuning job' }
];

/**
 * Check if MCP server is available
 */
async function isMCPAvailable(): Promise<boolean> {
  try {
    const response = await axios.get(`${MCP_SERVER_URL}/health`, {
      timeout: MCP_TIMEOUT
    });
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

/**
 * Check if MCP server supports required endpoints
 */
async function checkMCPEndpoints() {
  logger.info('Checking MCP server endpoints...');

  try {
    // Check if MCP server is available
    const mcpAvailable = await isMCPAvailable();
    if (!mcpAvailable) {
      logger.error(`MCP server is not available at ${MCP_SERVER_URL}`);
      return false;
    }

    logger.info(`MCP server is available at ${MCP_SERVER_URL}`);

    // Get API documentation
    try {
      const response = await axios.get(`${MCP_SERVER_URL}/api/docs`, {
        timeout: MCP_TIMEOUT
      });

      // Check if response contains API documentation
      if (response.status !== 200 || !response.data) {
        logger.warn('Could not get API documentation from MCP server');
        logger.warn('Cannot automatically check if required endpoints are supported');
        logger.warn('Required endpoints:');
        requiredEndpoints.forEach(endpoint => {
          logger.warn(`- ${endpoint.method} ${endpoint.path}: ${endpoint.description}`);
        });
        return false;
      }

      // Parse API documentation
      const apiDocs = response.data;
      const paths = apiDocs.paths || {};

      // Check if required endpoints are supported
      const missingEndpoints = [];
      for (const endpoint of requiredEndpoints) {
        const path = endpoint.path.replace(/{([^}]+)}/g, '{$1}'); // Normalize path parameters
        const method = endpoint.method.toLowerCase();
        
        if (!paths[path] || !paths[path][method]) {
          missingEndpoints.push(endpoint);
        }
      }

      if (missingEndpoints.length > 0) {
        logger.warn('MCP server does not support the following required endpoints:');
        missingEndpoints.forEach(endpoint => {
          logger.warn(`- ${endpoint.method} ${endpoint.path}: ${endpoint.description}`);
        });
        return false;
      }

      logger.info('MCP server supports all required endpoints');
      return true;
    } catch (error) {
      logger.warn('Could not get API documentation from MCP server:', error);
      logger.warn('Cannot automatically check if required endpoints are supported');
      logger.warn('Required endpoints:');
      requiredEndpoints.forEach(endpoint => {
        logger.warn(`- ${endpoint.method} ${endpoint.path}: ${endpoint.description}`);
      });
      return false;
    }
  } catch (error) {
    logger.error('Error checking MCP endpoints:', error);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    // Check MCP endpoints
    const endpointsSupported = await checkMCPEndpoints();

    if (!endpointsSupported) {
      logger.warn('MCP server does not support all required endpoints for model fine-tuning');
      logger.warn('Please update the MCP server to support the required endpoints');
    } else {
      logger.info('MCP server supports all required endpoints for model fine-tuning');
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
