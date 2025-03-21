/**
 * Credentials Controller
 * Handles API credential management operations
 */

import { Request, Response } from 'express';
import { credentialsManager } from '../services/crawler/credentialsManager';
import { crawlerServiceFactory, CrawlerProvider } from '../services/crawler/crawlerServiceFactory';
import logger from '../utils/logger';

/**
 * Get credentials status for all providers
 */
export const getCredentialsStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    // Get all available providers
    const providers = crawlerServiceFactory.getAvailableProviders();
    
    // Build status object for each provider
    const status: Record<string, any> = {};
    
    for (const provider of providers) {
      const hasCredentials = credentialsManager.hasCredentials(provider);
      
      let isValid: boolean | undefined = undefined;
      let lastTested: number | undefined = undefined;
      
      if (hasCredentials) {
        // Get provider info
        const credentials = credentialsManager.getCredentials(provider);
        
        if (credentials) {
          lastTested = credentials.lastTested;
          isValid = credentials.isValid;
        }
      }
      
      status[provider] = {
        hasCredentials,
        isValid,
        lastTested
      };
    }
    
    res.status(200).json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error(`Failed to get credentials status: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve credentials status'
    });
  }
};

/**
 * Set credentials for a specific provider
 */
export const setCredentials = async (req: Request, res: Response): Promise<void> => {
  try {
    const { provider } = req.params;
    const credentials = req.body;
    
    // Validate provider
    if (!provider || !crawlerServiceFactory.isProviderSupported(provider)) {
      res.status(400).json({
        success: false,
        error: `Invalid provider: ${provider}`
      });
      return;
    }
    
    // Check for required fields (API key at minimum)
    if (!credentials.apiKey) {
      res.status(400).json({
        success: false,
        error: 'API key is required'
      });
      return;
    }
    
    // Extract API key and additional fields
    const { apiKey, ...additionalKeys } = credentials;
    
    // Store credentials
    const success = credentialsManager.setCredentials(
      provider as CrawlerProvider,
      apiKey,
      Object.keys(additionalKeys).length > 0 ? additionalKeys : undefined
    );
    
    if (!success) {
      res.status(500).json({
        success: false,
        error: 'Failed to save credentials'
      });
      return;
    }
    
    res.status(200).json({
      success: true,
      message: `Credentials for ${provider} saved successfully`
    });
  } catch (error) {
    logger.error(`Failed to set credentials: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Failed to save credentials'
    });
  }
};

/**
 * Test credentials for a specific provider
 */
export const testCredentials = async (req: Request, res: Response): Promise<void> => {
  try {
    const { provider } = req.params;
    
    // Validate provider
    if (!provider || !crawlerServiceFactory.isProviderSupported(provider)) {
      res.status(400).json({
        success: false,
        error: `Invalid provider: ${provider}`
      });
      return;
    }
    
    const typedProvider = provider as CrawlerProvider;
    
    // Check if credentials exist
    const hasCredentials = credentialsManager.hasCredentials(typedProvider);
    
    if (!hasCredentials) {
      res.status(400).json({
        success: false,
        error: `No credentials found for ${provider}`
      });
      return;
    }
    
    // Get credentials
    const credentials = credentialsManager.getFlattenedCredentials(typedProvider);
    
    if (!credentials) {
      res.status(500).json({
        success: false,
        error: `Failed to retrieve credentials for ${provider}`
      });
      return;
    }
    
    try {
      // Get service instance
      const service = await crawlerServiceFactory.getService(typedProvider);
      
      // Service initialization already sets credentials using credentialsManager
      // Test connection
      const initialized = await service.initialize(credentials);
      
      if (!initialized) {
        res.status(400).json({
          success: false,
          error: `Failed to initialize service with credentials for ${provider}`
        });
        return;
      }
      
      // For actual testing, we'll try a simple operation supported by the service
      // This varies by provider but most support a health check
      const isValid = initialized;
      
      // Update validation status
      credentialsManager.updateValidationStatus(typedProvider, isValid);
      
      res.status(200).json({
        success: true,
        data: {
          isValid,
          timestamp: Date.now()
        }
      });
    } catch (error) {
      logger.error(`Failed to test credentials: ${error}`);
      res.status(400).json({
        success: false,
        error: `Invalid credentials for ${provider}`
      });
    }
  } catch (error) {
    logger.error(`Failed to test credentials: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Failed to test credentials'
    });
  }
};

/**
 * Delete credentials for a specific provider
 */
export const deleteCredentials = async (req: Request, res: Response): Promise<void> => {
  try {
    const { provider } = req.params;
    
    // Validate provider
    if (!provider || !crawlerServiceFactory.isProviderSupported(provider)) {
      res.status(400).json({
        success: false,
        error: `Invalid provider: ${provider}`
      });
      return;
    }
    
    const typedProvider = provider as CrawlerProvider;
    
    // Check if credentials exist
    const hasCredentials = credentialsManager.hasCredentials(typedProvider);
    
    if (!hasCredentials) {
      res.status(400).json({
        success: false,
        error: `No credentials found for ${provider}`
      });
      return;
    }
    
    // Delete credentials
    const success = credentialsManager.removeCredentials(typedProvider);
    
    if (!success) {
      res.status(500).json({
        success: false,
        error: 'Failed to delete credentials'
      });
      return;
    }
    
    res.status(200).json({
      success: true,
      message: `Credentials for ${provider} deleted successfully`
    });
  } catch (error) {
    logger.error(`Failed to delete credentials: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Failed to delete credentials'
    });
  }
};