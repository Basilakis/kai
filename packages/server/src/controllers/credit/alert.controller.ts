/**
 * Credit Alert Controller
 * 
 * This controller handles API endpoints for credit alert management,
 * including setting up alerts and viewing alert history.
 */

import { Request, Response } from 'express';
import { logger } from '../../utils/logger';
import { ApiError } from '../../middleware/error.middleware';
import alertManagerService from '../../services/credit/alertManager.service';
import { AlertType } from '../../models/creditAlert.model';
import { getUserCreditBalance } from '../../models/userCredit.model';

/**
 * Get credit alert settings for the current user
 * @route GET /api/credits/alerts/settings
 * @access Private
 */
export const getAlertSettings = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    
    // Get alert settings
    const settings = await alertManagerService.getAlertSettings(userId);
    
    // Get credit balance
    const balance = await getUserCreditBalance(userId);
    
    res.status(200).json({
      success: true,
      data: {
        settings,
        creditBalance: balance
      }
    });
  } catch (error) {
    logger.error(`Error getting alert settings: ${error}`);
    throw new ApiError(500, 'Failed to get alert settings');
  }
};

/**
 * Create a credit alert setting
 * @route POST /api/credits/alerts/settings
 * @access Private
 */
export const createAlertSetting = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const { 
      thresholdAmount, 
      alertTypes, 
      emailAddresses, 
      phoneNumbers, 
      webhookUrls,
      metadata 
    } = req.body;
    
    if (thresholdAmount === undefined || thresholdAmount < 0) {
      throw new ApiError(400, 'thresholdAmount is required and must be non-negative');
    }
    
    if (!alertTypes || !Array.isArray(alertTypes) || alertTypes.length === 0) {
      throw new ApiError(400, 'alertTypes is required and must be a non-empty array');
    }
    
    // Validate alert types
    const validAlertTypes = Object.values(AlertType);
    const invalidTypes = alertTypes.filter(type => !validAlertTypes.includes(type));
    
    if (invalidTypes.length > 0) {
      throw new ApiError(400, `Invalid alert types: ${invalidTypes.join(', ')}`);
    }
    
    // Validate required fields based on alert types
    if (alertTypes.includes(AlertType.EMAIL) && (!emailAddresses || emailAddresses.length === 0)) {
      throw new ApiError(400, 'emailAddresses is required for email alerts');
    }
    
    if (alertTypes.includes(AlertType.SMS) && (!phoneNumbers || phoneNumbers.length === 0)) {
      throw new ApiError(400, 'phoneNumbers is required for SMS alerts');
    }
    
    if (alertTypes.includes(AlertType.WEBHOOK) && (!webhookUrls || webhookUrls.length === 0)) {
      throw new ApiError(400, 'webhookUrls is required for webhook alerts');
    }
    
    // Create alert setting
    const setting = await alertManagerService.createAlertSetting(
      userId,
      thresholdAmount,
      alertTypes,
      emailAddresses,
      phoneNumbers,
      webhookUrls,
      metadata
    );
    
    res.status(201).json({
      success: true,
      message: 'Alert setting created successfully',
      data: setting
    });
  } catch (error) {
    logger.error(`Error creating alert setting: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to create alert setting');
  }
};

/**
 * Update a credit alert setting
 * @route PUT /api/credits/alerts/settings/:settingId
 * @access Private
 */
export const updateAlertSetting = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const { settingId } = req.params;
    const { 
      isEnabled,
      thresholdAmount, 
      alertTypes, 
      emailAddresses, 
      phoneNumbers, 
      webhookUrls,
      metadata 
    } = req.body;
    
    // Get the alert setting
    const settings = await alertManagerService.getAlertSettings(userId);
    const setting = settings.find(s => s.id === settingId);
    
    if (!setting) {
      throw new ApiError(404, 'Alert setting not found');
    }
    
    // Validate threshold amount
    if (thresholdAmount !== undefined && thresholdAmount < 0) {
      throw new ApiError(400, 'thresholdAmount must be non-negative');
    }
    
    // Validate alert types
    if (alertTypes) {
      if (!Array.isArray(alertTypes) || alertTypes.length === 0) {
        throw new ApiError(400, 'alertTypes must be a non-empty array');
      }
      
      const validAlertTypes = Object.values(AlertType);
      const invalidTypes = alertTypes.filter(type => !validAlertTypes.includes(type));
      
      if (invalidTypes.length > 0) {
        throw new ApiError(400, `Invalid alert types: ${invalidTypes.join(', ')}`);
      }
    }
    
    // Prepare updates
    const updates: any = {};
    
    if (isEnabled !== undefined) updates.isEnabled = isEnabled;
    if (thresholdAmount !== undefined) updates.thresholdAmount = thresholdAmount;
    if (alertTypes !== undefined) updates.alertTypes = alertTypes;
    if (emailAddresses !== undefined) updates.emailAddresses = emailAddresses;
    if (phoneNumbers !== undefined) updates.phoneNumbers = phoneNumbers;
    if (webhookUrls !== undefined) updates.webhookUrls = webhookUrls;
    if (metadata !== undefined) updates.metadata = metadata;
    
    // Update alert setting
    const updatedSetting = await alertManagerService.updateAlertSetting(settingId, updates);
    
    res.status(200).json({
      success: true,
      message: 'Alert setting updated successfully',
      data: updatedSetting
    });
  } catch (error) {
    logger.error(`Error updating alert setting: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to update alert setting');
  }
};

/**
 * Delete a credit alert setting
 * @route DELETE /api/credits/alerts/settings/:settingId
 * @access Private
 */
export const deleteAlertSetting = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const { settingId } = req.params;
    
    // Get the alert setting
    const settings = await alertManagerService.getAlertSettings(userId);
    const setting = settings.find(s => s.id === settingId);
    
    if (!setting) {
      throw new ApiError(404, 'Alert setting not found');
    }
    
    // Delete alert setting
    await alertManagerService.deleteAlertSetting(settingId);
    
    res.status(200).json({
      success: true,
      message: 'Alert setting deleted successfully'
    });
  } catch (error) {
    logger.error(`Error deleting alert setting: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to delete alert setting');
  }
};

/**
 * Get credit alert history for the current user
 * @route GET /api/credits/alerts/history
 * @access Private
 */
export const getAlertHistory = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
    
    const history = await alertManagerService.getAlertHistory(userId, limit, offset);
    
    res.status(200).json({
      success: true,
      data: history
    });
  } catch (error) {
    logger.error(`Error getting alert history: ${error}`);
    throw new ApiError(500, 'Failed to get alert history');
  }
};

/**
 * Test alert delivery
 * @route POST /api/credits/alerts/test/:settingId
 * @access Private
 */
export const testAlertDelivery = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const { settingId } = req.params;
    
    // Get the alert setting
    const settings = await alertManagerService.getAlertSettings(userId);
    const setting = settings.find(s => s.id === settingId);
    
    if (!setting) {
      throw new ApiError(404, 'Alert setting not found');
    }
    
    // Test alert delivery
    const result = await alertManagerService.testAlertDelivery(userId, settingId);
    
    res.status(200).json({
      success: true,
      message: 'Test alert sent successfully',
      data: result
    });
  } catch (error) {
    logger.error(`Error testing alert delivery: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to test alert delivery');
  }
};

/**
 * Check if the user needs alerts and process them if needed
 * @route POST /api/credits/alerts/check
 * @access Private
 */
export const checkAndProcessAlerts = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    
    // Check if user needs alerts
    const { needsAlerts, settings, creditBalance } = await alertManagerService.checkUserNeedsAlerts(userId);
    
    if (!needsAlerts || settings.length === 0) {
      res.status(200).json({
        success: true,
        needsAlerts: false,
        message: 'No alerts needed at this time'
      });
      return;
    }
    
    // Process alerts
    const results = [];
    
    for (const setting of settings) {
      const result = await alertManagerService.sendAlerts(userId, setting.id, setting, creditBalance);
      results.push(result);
    }
    
    res.status(200).json({
      success: true,
      needsAlerts: true,
      message: `Processed ${results.length} alerts`,
      data: results
    });
  } catch (error) {
    logger.error(`Error checking and processing alerts: ${error}`);
    throw new ApiError(500, 'Failed to check and process alerts');
  }
};

/**
 * Get available alert types
 * @route GET /api/credits/alerts/types
 * @access Private
 */
export const getAlertTypes = async (_req: Request, res: Response) => {
  try {
    const alertTypes = Object.values(AlertType);
    
    res.status(200).json({
      success: true,
      data: alertTypes
    });
  } catch (error) {
    logger.error(`Error getting alert types: ${error}`);
    throw new ApiError(500, 'Failed to get alert types');
  }
};

export default {
  getAlertSettings,
  createAlertSetting,
  updateAlertSetting,
  deleteAlertSetting,
  getAlertHistory,
  testAlertDelivery,
  checkAndProcessAlerts,
  getAlertTypes
};
