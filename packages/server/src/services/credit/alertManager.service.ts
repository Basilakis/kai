/**
 * Credit Alert Manager Service
 * 
 * This service provides functionality for managing credit alerts,
 * including monitoring credit balances and sending alerts when thresholds are reached.
 */

import { logger } from '../../utils/logger';
import creditAlertModel, { 
  CreditAlertSetting, 
  CreditAlertHistory,
  AlertType 
} from '../../models/creditAlert.model';
import { getUserCreditBalance } from '../../models/userCredit.model';
import { emailService } from '../email/email.service';
import { smsService } from '../sms/sms.service';
import axios from 'axios';
import { supabaseClient } from '../supabase/supabaseClient';

/**
 * Get credit alert settings for a user
 * @param userId User ID
 * @returns Array of credit alert settings
 */
export async function getAlertSettings(userId: string): Promise<CreditAlertSetting[]> {
  try {
    return await creditAlertModel.getUserAlertSettings(userId);
  } catch (error) {
    logger.error(`Failed to get alert settings: ${error}`);
    throw error;
  }
}

/**
 * Create a credit alert setting
 * @param userId User ID
 * @param thresholdAmount Credit threshold to trigger alert
 * @param alertTypes Types of alerts to send
 * @param emailAddresses Email addresses for email alerts
 * @param phoneNumbers Phone numbers for SMS alerts
 * @param webhookUrls Webhook URLs for webhook alerts
 * @param metadata Additional metadata
 * @returns Created credit alert setting
 */
export async function createAlertSetting(
  userId: string,
  thresholdAmount: number,
  alertTypes: AlertType[],
  emailAddresses?: string[],
  phoneNumbers?: string[],
  webhookUrls?: string[],
  metadata?: Record<string, any>
): Promise<CreditAlertSetting> {
  try {
    // Validate input
    if (thresholdAmount < 0) {
      throw new Error('Threshold amount must be non-negative');
    }
    
    if (!alertTypes || alertTypes.length === 0) {
      throw new Error('At least one alert type is required');
    }
    
    // Validate alert types
    const validAlertTypes = Object.values(AlertType);
    const invalidTypes = alertTypes.filter(type => !validAlertTypes.includes(type));
    
    if (invalidTypes.length > 0) {
      throw new Error(`Invalid alert types: ${invalidTypes.join(', ')}`);
    }
    
    // Validate required fields based on alert types
    if (alertTypes.includes(AlertType.EMAIL) && (!emailAddresses || emailAddresses.length === 0)) {
      throw new Error('Email addresses are required for email alerts');
    }
    
    if (alertTypes.includes(AlertType.SMS) && (!phoneNumbers || phoneNumbers.length === 0)) {
      throw new Error('Phone numbers are required for SMS alerts');
    }
    
    if (alertTypes.includes(AlertType.WEBHOOK) && (!webhookUrls || webhookUrls.length === 0)) {
      throw new Error('Webhook URLs are required for webhook alerts');
    }
    
    // Create alert setting
    const setting = await creditAlertModel.createAlertSetting({
      userId,
      isEnabled: true,
      thresholdAmount,
      alertTypes,
      emailAddresses,
      phoneNumbers,
      webhookUrls,
      metadata
    });
    
    return setting;
  } catch (error) {
    logger.error(`Failed to create alert setting: ${error}`);
    throw error;
  }
}

/**
 * Update a credit alert setting
 * @param id Alert setting ID
 * @param updates Updates to apply
 * @returns Updated credit alert setting
 */
export async function updateAlertSetting(
  id: string,
  updates: Partial<CreditAlertSetting>
): Promise<CreditAlertSetting> {
  try {
    // Get current setting
    const currentSetting = await creditAlertModel.getAlertSettingById(id);
    
    if (!currentSetting) {
      throw new Error('Alert setting not found');
    }
    
    // Validate threshold amount
    if (updates.thresholdAmount !== undefined && updates.thresholdAmount < 0) {
      throw new Error('Threshold amount must be non-negative');
    }
    
    // Validate alert types
    if (updates.alertTypes) {
      if (updates.alertTypes.length === 0) {
        throw new Error('At least one alert type is required');
      }
      
      const validAlertTypes = Object.values(AlertType);
      const invalidTypes = updates.alertTypes.filter(type => !validAlertTypes.includes(type));
      
      if (invalidTypes.length > 0) {
        throw new Error(`Invalid alert types: ${invalidTypes.join(', ')}`);
      }
      
      // Validate required fields based on alert types
      const emailAddresses = updates.emailAddresses !== undefined ? updates.emailAddresses : currentSetting.emailAddresses;
      const phoneNumbers = updates.phoneNumbers !== undefined ? updates.phoneNumbers : currentSetting.phoneNumbers;
      const webhookUrls = updates.webhookUrls !== undefined ? updates.webhookUrls : currentSetting.webhookUrls;
      
      if (updates.alertTypes.includes(AlertType.EMAIL) && (!emailAddresses || emailAddresses.length === 0)) {
        throw new Error('Email addresses are required for email alerts');
      }
      
      if (updates.alertTypes.includes(AlertType.SMS) && (!phoneNumbers || phoneNumbers.length === 0)) {
        throw new Error('Phone numbers are required for SMS alerts');
      }
      
      if (updates.alertTypes.includes(AlertType.WEBHOOK) && (!webhookUrls || webhookUrls.length === 0)) {
        throw new Error('Webhook URLs are required for webhook alerts');
      }
    }
    
    // Update alert setting
    const setting = await creditAlertModel.updateAlertSetting(id, updates);
    
    return setting;
  } catch (error) {
    logger.error(`Failed to update alert setting: ${error}`);
    throw error;
  }
}

/**
 * Delete a credit alert setting
 * @param id Alert setting ID
 * @returns Whether the setting was deleted
 */
export async function deleteAlertSetting(id: string): Promise<boolean> {
  try {
    return await creditAlertModel.deleteAlertSetting(id);
  } catch (error) {
    logger.error(`Failed to delete alert setting: ${error}`);
    throw error;
  }
}

/**
 * Get credit alert history for a user
 * @param userId User ID
 * @param limit Maximum number of records to return
 * @param offset Offset for pagination
 * @returns Array of credit alert history records
 */
export async function getAlertHistory(
  userId: string,
  limit: number = 10,
  offset: number = 0
): Promise<CreditAlertHistory[]> {
  try {
    return await creditAlertModel.getUserAlertHistory(userId, limit, offset);
  } catch (error) {
    logger.error(`Failed to get alert history: ${error}`);
    throw error;
  }
}

/**
 * Send alerts for a user
 * @param userId User ID
 * @param settingId Setting ID
 * @param setting Alert setting
 * @param creditBalance Current credit balance
 * @returns Alert history record
 */
export async function sendAlerts(
  userId: string,
  settingId: string,
  setting: CreditAlertSetting,
  creditBalance: number
): Promise<CreditAlertHistory> {
  try {
    // Create history record
    const history = await creditAlertModel.createAlertHistory({
      userId,
      settingId,
      creditBalance,
      thresholdAmount: setting.thresholdAmount,
      alertTypes: setting.alertTypes,
      status: 'pending'
    });
    
    // Get user details
    const { data: user, error: userError } = await supabaseClient.getClient().auth.admin.getUserById(userId);
    
    if (userError || !user) {
      throw new Error(`Failed to get user details: ${userError?.message || 'User not found'}`);
    }
    
    const userName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';
    const userEmail = user.email;
    
    // Send alerts based on alert types
    const errors: string[] = [];
    
    // Send email alerts
    if (setting.alertTypes.includes(AlertType.EMAIL) && setting.emailAddresses && setting.emailAddresses.length > 0) {
      try {
        await sendEmailAlerts(
          setting.emailAddresses,
          userName,
          creditBalance,
          setting.thresholdAmount
        );
      } catch (error) {
        errors.push(`Email alert error: ${error.message}`);
      }
    }
    
    // Send SMS alerts
    if (setting.alertTypes.includes(AlertType.SMS) && setting.phoneNumbers && setting.phoneNumbers.length > 0) {
      try {
        await sendSMSAlerts(
          setting.phoneNumbers,
          userName,
          creditBalance,
          setting.thresholdAmount
        );
      } catch (error) {
        errors.push(`SMS alert error: ${error.message}`);
      }
    }
    
    // Send webhook alerts
    if (setting.alertTypes.includes(AlertType.WEBHOOK) && setting.webhookUrls && setting.webhookUrls.length > 0) {
      try {
        await sendWebhookAlerts(
          setting.webhookUrls,
          userId,
          userName,
          userEmail || '',
          creditBalance,
          setting.thresholdAmount
        );
      } catch (error) {
        errors.push(`Webhook alert error: ${error.message}`);
      }
    }
    
    // Send in-app alerts
    if (setting.alertTypes.includes(AlertType.IN_APP)) {
      try {
        await sendInAppAlert(
          userId,
          creditBalance,
          setting.thresholdAmount
        );
      } catch (error) {
        errors.push(`In-app alert error: ${error.message}`);
      }
    }
    
    // Update history record
    const status = errors.length === 0 ? 'sent' : 'failed';
    const errorMessage = errors.length > 0 ? errors.join('; ') : undefined;
    
    const updatedHistory = await creditAlertModel.updateAlertHistory(history.id, {
      status,
      errorMessage,
      sentAt: errors.length === 0 ? new Date() : undefined
    });
    
    // Update last triggered time
    await creditAlertModel.updateLastTriggeredTime(settingId);
    
    return updatedHistory;
  } catch (error) {
    logger.error(`Failed to send alerts: ${error}`);
    throw error;
  }
}

/**
 * Send email alerts
 * @param emailAddresses Email addresses
 * @param userName User name
 * @param creditBalance Current credit balance
 * @param thresholdAmount Threshold amount
 */
async function sendEmailAlerts(
  emailAddresses: string[],
  userName: string,
  creditBalance: number,
  thresholdAmount: number
): Promise<void> {
  try {
    const subject = 'Credit Balance Alert';
    const text = `Hello ${userName},\n\nYour credit balance has fallen below the threshold you set. Your current balance is ${creditBalance} credits, which is below your threshold of ${thresholdAmount} credits.\n\nPlease consider purchasing more credits to avoid any service interruptions.\n\nThank you,\nThe KAI Team`;
    const html = `
      <p>Hello ${userName},</p>
      <p>Your credit balance has fallen below the threshold you set.</p>
      <p>Your current balance is <strong>${creditBalance}</strong> credits, which is below your threshold of <strong>${thresholdAmount}</strong> credits.</p>
      <p>Please consider purchasing more credits to avoid any service interruptions.</p>
      <p>Thank you,<br>The KAI Team</p>
    `;
    
    // Send emails
    for (const email of emailAddresses) {
      await emailService.sendEmail({
        to: email,
        subject,
        text,
        html
      });
    }
  } catch (error) {
    logger.error(`Failed to send email alerts: ${error}`);
    throw error;
  }
}

/**
 * Send SMS alerts
 * @param phoneNumbers Phone numbers
 * @param userName User name
 * @param creditBalance Current credit balance
 * @param thresholdAmount Threshold amount
 */
async function sendSMSAlerts(
  phoneNumbers: string[],
  userName: string,
  creditBalance: number,
  thresholdAmount: number
): Promise<void> {
  try {
    const message = `KAI Alert: Hello ${userName}, your credit balance (${creditBalance}) has fallen below your threshold (${thresholdAmount}). Please consider purchasing more credits.`;
    
    // Send SMS messages
    for (const phoneNumber of phoneNumbers) {
      await smsService.sendSMS(phoneNumber, message);
    }
  } catch (error) {
    logger.error(`Failed to send SMS alerts: ${error}`);
    throw error;
  }
}

/**
 * Send webhook alerts
 * @param webhookUrls Webhook URLs
 * @param userId User ID
 * @param userName User name
 * @param userEmail User email
 * @param creditBalance Current credit balance
 * @param thresholdAmount Threshold amount
 */
async function sendWebhookAlerts(
  webhookUrls: string[],
  userId: string,
  userName: string,
  userEmail: string,
  creditBalance: number,
  thresholdAmount: number
): Promise<void> {
  try {
    const payload = {
      event: 'credit_alert',
      userId,
      userName,
      userEmail,
      creditBalance,
      thresholdAmount,
      timestamp: new Date().toISOString()
    };
    
    // Send webhook requests
    for (const url of webhookUrls) {
      await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 5000 // 5 second timeout
      });
    }
  } catch (error) {
    logger.error(`Failed to send webhook alerts: ${error}`);
    throw error;
  }
}

/**
 * Send in-app alert
 * @param userId User ID
 * @param creditBalance Current credit balance
 * @param thresholdAmount Threshold amount
 */
async function sendInAppAlert(
  userId: string,
  creditBalance: number,
  thresholdAmount: number
): Promise<void> {
  try {
    // Create notification in the database
    const notification = {
      userId,
      type: 'credit_alert',
      title: 'Credit Balance Alert',
      message: `Your credit balance (${creditBalance}) has fallen below your threshold (${thresholdAmount}).`,
      isRead: false,
      data: {
        creditBalance,
        thresholdAmount
      },
      createdAt: new Date()
    };
    
    const { error } = await supabaseClient.getClient()
      .from('notifications')
      .insert([notification]);
    
    if (error) {
      throw new Error(`Failed to create notification: ${error.message}`);
    }
  } catch (error) {
    logger.error(`Failed to send in-app alert: ${error}`);
    throw error;
  }
}

/**
 * Check if a user needs credit alerts
 * @param userId User ID
 * @returns Whether the user needs alerts and the settings if applicable
 */
export async function checkUserNeedsAlerts(userId: string): Promise<{ 
  needsAlerts: boolean; 
  settings: CreditAlertSetting[];
  creditBalance: number;
}> {
  try {
    // Get user's alert settings
    const settings = await creditAlertModel.getUserAlertSettings(userId);
    
    if (!settings || settings.length === 0 || !settings.some(s => s.isEnabled)) {
      return { needsAlerts: false, settings: [], creditBalance: 0 };
    }
    
    // Get user's credit balance
    const balance = await getUserCreditBalance(userId);
    
    // Find settings that need alerts
    const now = new Date();
    const alertSettings = settings.filter(setting => {
      // Check if setting is enabled
      if (!setting.isEnabled) {
        return false;
      }
      
      // Check if balance is below threshold
      if (balance > setting.thresholdAmount) {
        return false;
      }
      
      // Check if alert was triggered recently (within 24 hours)
      if (setting.lastTriggeredAt) {
        const lastTriggered = new Date(setting.lastTriggeredAt);
        const hoursSinceLastTriggered = (now.getTime() - lastTriggered.getTime()) / (1000 * 60 * 60);
        
        if (hoursSinceLastTriggered < 24) {
          return false;
        }
      }
      
      return true;
    });
    
    return { 
      needsAlerts: alertSettings.length > 0, 
      settings: alertSettings,
      creditBalance: balance
    };
  } catch (error) {
    logger.error(`Failed to check if user needs alerts: ${error}`);
    throw error;
  }
}

/**
 * Process all users who need credit alerts
 * @returns Number of users processed
 */
export async function processAllAlerts(): Promise<number> {
  try {
    // Get users who need alerts
    const users = await creditAlertModel.getUsersNeedingAlerts();
    
    if (!users || users.length === 0) {
      return 0;
    }
    
    let processedCount = 0;
    
    // Process each user
    for (const user of users) {
      try {
        await sendAlerts(user.userId, user.settingId, user.setting, user.creditBalance);
        processedCount++;
      } catch (error) {
        logger.error(`Failed to process alerts for user ${user.userId}: ${error}`);
      }
    }
    
    return processedCount;
  } catch (error) {
    logger.error(`Failed to process all alerts: ${error}`);
    throw error;
  }
}

/**
 * Schedule periodic checking for users who need credit alerts
 * @param intervalMinutes Interval in minutes
 */
export function scheduleAlertChecks(intervalMinutes: number = 60): void {
  setInterval(async () => {
    try {
      const count = await processAllAlerts();
      if (count > 0) {
        logger.info(`Processed credit alerts for ${count} users`);
      }
    } catch (error) {
      logger.error(`Failed to process scheduled alerts: ${error}`);
    }
  }, intervalMinutes * 60 * 1000);
}

/**
 * Test alert delivery
 * @param userId User ID
 * @param settingId Setting ID
 * @returns Alert history record
 */
export async function testAlertDelivery(userId: string, settingId: string): Promise<CreditAlertHistory> {
  try {
    // Get the alert setting
    const setting = await creditAlertModel.getAlertSettingById(settingId);
    
    if (!setting) {
      throw new Error('Alert setting not found');
    }
    
    // Check if the setting belongs to the user
    if (setting.userId !== userId) {
      throw new Error('Alert setting does not belong to the user');
    }
    
    // Get user's credit balance
    const balance = await getUserCreditBalance(userId);
    
    // Send test alerts
    const history = await sendAlerts(userId, settingId, setting, balance);
    
    return history;
  } catch (error) {
    logger.error(`Failed to test alert delivery: ${error}`);
    throw error;
  }
}

export default {
  getAlertSettings,
  createAlertSetting,
  updateAlertSetting,
  deleteAlertSetting,
  getAlertHistory,
  sendAlerts,
  checkUserNeedsAlerts,
  processAllAlerts,
  scheduleAlertChecks,
  testAlertDelivery,
  AlertType
};
