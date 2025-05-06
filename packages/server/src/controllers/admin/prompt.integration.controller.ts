/**
 * Admin Prompt Integration Controller
 * 
 * Handles admin operations for prompt integration with external systems.
 */

import { Request, Response } from 'express';
import { logger } from '../../utils/logger';
import { PromptIntegrationService } from '../../services/ai/promptIntegrationService';
import { ApiError } from '../../utils/errors';

// Initialize integration service
const integrationService = new PromptIntegrationService();

/**
 * Get integrations
 */
export async function getIntegrations(req: Request, res: Response): Promise<void> {
  try {
    const { systemType, isActive } = req.query;
    
    const integrations = await integrationService.getIntegrations(
      systemType as string,
      isActive === 'true' ? true : isActive === 'false' ? false : undefined
    );
    
    res.status(200).json({
      success: true,
      data: integrations
    });
  } catch (error) {
    logger.error(`Error in getIntegrations: ${error}`);
    
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: `Failed to get integrations: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }
}

/**
 * Create integration
 */
export async function createIntegration(req: Request, res: Response): Promise<void> {
  try {
    const integration = req.body;
    
    if (!integration || !integration.name || !integration.systemType || !integration.connectionParameters) {
      throw new ApiError(400, 'Integration name, system type, and connection parameters are required');
    }
    
    // Set created by from user
    integration.createdBy = req.user?.id;
    
    const integrationId = await integrationService.createIntegration(integration);
    
    res.status(201).json({
      success: true,
      message: 'Integration created successfully',
      data: { id: integrationId }
    });
  } catch (error) {
    logger.error(`Error in createIntegration: ${error}`);
    
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: `Failed to create integration: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }
}

/**
 * Test integration connection
 */
export async function testIntegrationConnection(req: Request, res: Response): Promise<void> {
  try {
    const { integrationId } = req.params;
    
    if (!integrationId) {
      throw new ApiError(400, 'Integration ID is required');
    }
    
    const result = await integrationService.testIntegrationConnection(integrationId);
    
    res.status(200).json({
      success: result.success,
      message: result.message
    });
  } catch (error) {
    logger.error(`Error in testIntegrationConnection: ${error}`);
    
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: `Failed to test integration connection: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }
}

/**
 * Create data export
 */
export async function createDataExport(req: Request, res: Response): Promise<void> {
  try {
    const exportData = req.body;
    
    if (!exportData || !exportData.integrationId || !exportData.exportType || !exportData.exportParameters) {
      throw new ApiError(400, 'Integration ID, export type, and export parameters are required');
    }
    
    const exportId = await integrationService.createDataExport(exportData);
    
    res.status(201).json({
      success: true,
      message: 'Data export created successfully',
      data: { id: exportId }
    });
  } catch (error) {
    logger.error(`Error in createDataExport: ${error}`);
    
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: `Failed to create data export: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }
}

/**
 * Execute pending exports
 */
export async function executePendingExports(req: Request, res: Response): Promise<void> {
  try {
    const exportsExecuted = await integrationService.executePendingExports();
    
    res.status(200).json({
      success: true,
      message: `Successfully executed pending exports`,
      data: { exportsExecuted }
    });
  } catch (error) {
    logger.error(`Error in executePendingExports: ${error}`);
    
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: `Failed to execute pending exports: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }
}
