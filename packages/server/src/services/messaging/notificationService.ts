/**
 * Notification Service
 *
 * A centralized service for sending notifications through various channels
 * including email, SMS, and webhooks. This service provides a unified interface
 * for all notification needs and supports template-based message generation.
 */

import { logger } from '../../utils/logger';
import { emailProvider } from './providers/emailProvider';
import { smsProvider } from './providers/smsProvider';
import { webhookProvider } from './providers/webhookProvider';
import { pushProvider, PushNotificationOptions } from './providers/pushProvider';
import { supabaseClient } from '../supabase/supabaseClient';
import mcpClientService, { MCPServiceKey } from '../mcp/mcpClientService';
import creditService from '../credit/creditService';

/**
 * Notification types supported by the system
 */
export enum NotificationType {
  EMAIL = 'email',
  SMS = 'sms',
  WEBHOOK = 'webhook',
  PUSH = 'push',
  IN_APP = 'in_app'
}

/**
 * Notification priority levels
 */
export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Base notification options
 */
export interface BaseNotificationOptions {
  userId?: string;
  priority?: NotificationPriority;
  metadata?: Record<string, any>;
  eventType?: string;
}

/**
 * Email notification options
 */
export interface EmailNotificationOptions extends BaseNotificationOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    contentType?: string;
  }>;
}

/**
 * SMS notification options
 */
export interface SMSNotificationOptions extends BaseNotificationOptions {
  to: string | string[];
  message: string;
}

/**
 * Webhook notification options
 */
export interface WebhookNotificationOptions extends BaseNotificationOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  payload: any;
  retryCount?: number;
}

/**
 * Push notification options
 */
export interface PushNotificationOptions extends BaseNotificationOptions {
  to: string | string[]; // Expo push token(s)
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: string;
  badge?: number;
  channelId?: string; // Android notification channel
  priority?: 'default' | 'normal' | 'high';
}

/**
 * In-app notification options
 */
export interface InAppNotificationOptions extends BaseNotificationOptions {
  userId: string; // Required for in-app notifications
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  actionUrl?: string;
}

/**
 * Notification result
 */
export interface NotificationResult {
  success: boolean;
  notificationType: NotificationType;
  timestamp: number;
  error?: Error;
  metadata?: any;
}

/**
 * Notification service class
 */
class NotificationService {
  /**
   * Send an email notification
   * @param options Email notification options
   * @returns Notification result
   */
  async sendEmail(options: EmailNotificationOptions): Promise<NotificationResult> {
    try {
      logger.debug(`Sending email notification to ${Array.isArray(options.to) ? options.to.join(', ') : options.to}`);

      const result = await emailProvider.sendEmail(options);

      // Log the notification in the database if userId is provided
      if (options.userId) {
        await this.logNotification({
          userId: options.userId,
          type: NotificationType.EMAIL,
          content: {
            to: options.to,
            subject: options.subject,
            text: options.text,
            html: options.html ? true : false
          },
          metadata: options.metadata || {},
          eventType: options.eventType
        });
      }

      return {
        success: true,
        notificationType: NotificationType.EMAIL,
        timestamp: Date.now(),
        metadata: result
      };
    } catch (error) {
      logger.error(`Failed to send email notification: ${error}`);
      return {
        success: false,
        notificationType: NotificationType.EMAIL,
        timestamp: Date.now(),
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  /**
   * Send an SMS notification
   * @param options SMS notification options
   * @returns Notification result
   */
  async sendSMS(options: SMSNotificationOptions): Promise<NotificationResult> {
    try {
      logger.debug(`Sending SMS notification to ${Array.isArray(options.to) ? options.to.join(', ') : options.to}`);

      const result = await smsProvider.sendSMS(options);

      // Log the notification in the database if userId is provided
      if (options.userId) {
        await this.logNotification({
          userId: options.userId,
          type: NotificationType.SMS,
          content: {
            to: options.to,
            message: options.message
          },
          metadata: options.metadata || {},
          eventType: options.eventType
        });
      }

      return {
        success: true,
        notificationType: NotificationType.SMS,
        timestamp: Date.now(),
        metadata: result
      };
    } catch (error) {
      logger.error(`Failed to send SMS notification: ${error}`);
      return {
        success: false,
        notificationType: NotificationType.SMS,
        timestamp: Date.now(),
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  /**
   * Send a webhook notification
   * @param options Webhook notification options
   * @returns Notification result
   */
  async sendWebhook(options: WebhookNotificationOptions): Promise<NotificationResult> {
    try {
      logger.debug(`Sending webhook notification to ${options.url}`);

      const result = await webhookProvider.sendWebhook(options);

      // Log the notification in the database if userId is provided
      if (options.userId) {
        await this.logNotification({
          userId: options.userId,
          type: NotificationType.WEBHOOK,
          content: {
            url: options.url,
            method: options.method || 'POST',
            payloadSize: JSON.stringify(options.payload).length
          },
          metadata: options.metadata || {},
          eventType: options.eventType
        });
      }

      return {
        success: true,
        notificationType: NotificationType.WEBHOOK,
        timestamp: Date.now(),
        metadata: result
      };
    } catch (error) {
      logger.error(`Failed to send webhook notification: ${error}`);
      return {
        success: false,
        notificationType: NotificationType.WEBHOOK,
        timestamp: Date.now(),
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  /**
   * Send a push notification
   * @param options Push notification options
   * @returns Notification result
   */
  async sendPushNotification(options: PushNotificationOptions): Promise<NotificationResult> {
    try {
      logger.debug(`Sending push notification to ${Array.isArray(options.to) ? options.to.join(', ') : options.to}`);

      // Check if MCP is available and user has enough credits
      if (options.userId && await mcpClientService.isMCPAvailable()) {
        const hasCredits = await creditService.hasEnoughCreditsForService(
          options.userId,
          MCPServiceKey.PUSH_NOTIFICATION,
          1
        );

        if (hasCredits) {
          // Send via MCP
          const result = await mcpClientService.sendPushNotification(
            options.userId,
            {
              to: options.to,
              title: options.title,
              body: options.body,
              data: options.data,
              sound: options.sound,
              badge: options.badge,
              channelId: options.channelId,
              priority: options.priority
            }
          );

          // Track credit usage
          await creditService.useServiceCredits(
            options.userId,
            MCPServiceKey.PUSH_NOTIFICATION,
            1,
            'push_notification',
            { to: options.to }
          );

          // Log the notification if userId is provided
          if (options.userId) {
            await this.logNotification({
              userId: options.userId,
              type: NotificationType.PUSH,
              content: {
                to: options.to,
                title: options.title,
                body: options.body
              },
              metadata: options.metadata || {},
              eventType: options.eventType
            });
          }

          return {
            success: true,
            notificationType: NotificationType.PUSH,
            timestamp: Date.now(),
            metadata: result
          };
        }
      }

      // Send directly via push provider
      const result = await pushProvider.sendPushNotification(options);

      // Log the notification if userId is provided
      if (options.userId) {
        await this.logNotification({
          userId: options.userId,
          type: NotificationType.PUSH,
          content: {
            to: options.to,
            title: options.title,
            body: options.body
          },
          metadata: options.metadata || {},
          eventType: options.eventType
        });
      }

      return {
        success: true,
        notificationType: NotificationType.PUSH,
        timestamp: Date.now(),
        metadata: result
      };
    } catch (error) {
      logger.error(`Failed to send push notification: ${error}`);
      return {
        success: false,
        notificationType: NotificationType.PUSH,
        timestamp: Date.now(),
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  /**
   * Send an in-app notification
   * @param options In-app notification options
   * @returns Notification result
   */
  async sendInAppNotification(options: InAppNotificationOptions): Promise<NotificationResult> {
    try {
      logger.debug(`Sending in-app notification to user ${options.userId}`);

      // Create notification in the database
      const notification = {
        userId: options.userId,
        type: options.type || 'info',
        title: options.title,
        message: options.message,
        isRead: false,
        actionUrl: options.actionUrl,
        data: options.metadata || {},
        createdAt: new Date()
      };

      const { error } = await supabaseClient.getClient()
        .from('notifications')
        .insert([notification]);

      if (error) {
        throw new Error(`Failed to create notification: ${error.message}`);
      }

      // Log the notification
      await this.logNotification({
        userId: options.userId,
        type: NotificationType.IN_APP,
        content: {
          title: options.title,
          message: options.message,
          type: options.type || 'info'
        },
        metadata: options.metadata || {},
        eventType: options.eventType
      });

      return {
        success: true,
        notificationType: NotificationType.IN_APP,
        timestamp: Date.now()
      };
    } catch (error) {
      logger.error(`Failed to send in-app notification: ${error}`);
      return {
        success: false,
        notificationType: NotificationType.IN_APP,
        timestamp: Date.now(),
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  /**
   * Log a notification in the database
   * @param data Notification data
   */
  private async logNotification(data: {
    userId: string;
    type: NotificationType;
    content: any;
    metadata: Record<string, any>;
    eventType?: string;
  }): Promise<void> {
    try {
      const logEntry = {
        userId: data.userId,
        notificationType: data.type,
        content: data.content,
        metadata: data.metadata,
        eventType: data.eventType || 'general',
        timestamp: new Date()
      };

      const { error } = await supabaseClient.getClient()
        .from('notification_logs')
        .insert([logEntry]);

      if (error) {
        logger.warn(`Failed to log notification: ${error.message}`);
      }
    } catch (error) {
      logger.warn(`Error logging notification: ${error}`);
    }
  }

  /**
   * Get notification preferences for a user
   * @param userId User ID
   * @returns User notification preferences
   */
  async getUserNotificationPreferences(userId: string): Promise<Record<string, any>> {
    try {
      const { data, error } = await supabaseClient.getClient()
        .from('user_notification_preferences')
        .select('*')
        .eq('userId', userId)
        .single();

      if (error) {
        logger.warn(`Failed to get notification preferences for user ${userId}: ${error.message}`);
        return {};
      }

      return data || {};
    } catch (error) {
      logger.warn(`Error getting notification preferences: ${error}`);
      return {};
    }
  }

  /**
   * Update notification preferences for a user
   * @param userId User ID
   * @param preferences Notification preferences
   * @returns Success indicator
   */
  async updateUserNotificationPreferences(
    userId: string,
    preferences: Record<string, any>
  ): Promise<boolean> {
    try {
      const { error } = await supabaseClient.getClient()
        .from('user_notification_preferences')
        .upsert([{
          userId,
          ...preferences,
          updatedAt: new Date()
        }]);

      if (error) {
        logger.error(`Failed to update notification preferences: ${error.message}`);
        return false;
      }

      return true;
    } catch (error) {
      logger.error(`Error updating notification preferences: ${error}`);
      return false;
    }
  }
}

// Create and export the notification service instance
export const notificationService = new NotificationService();
