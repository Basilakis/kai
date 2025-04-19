/**
 * Event Notification Service
 * 
 * Provides functionality for sending notifications based on system events.
 * Supports configurable notification rules and user preferences.
 */

import { logger } from '../../utils/logger';
import { supabaseClient } from '../supabase/supabaseClient';
import { notificationService, NotificationType } from './notificationService';
import { templateService } from './templates/templateService';
import { webhookProvider } from './providers/webhookProvider'; // Added import

/**
 * Event types
 */
export enum EventType {
  // User events
  USER_REGISTERED = 'user.registered',
  USER_VERIFIED = 'user.verified',
  USER_PASSWORD_RESET = 'user.password_reset',
  USER_LOGIN = 'user.login',
  USER_PROFILE_UPDATED = 'user.profile_updated',
  
  // Subscription events
  SUBSCRIPTION_CREATED = 'subscription.created',
  SUBSCRIPTION_UPDATED = 'subscription.updated',
  SUBSCRIPTION_CANCELLED = 'subscription.cancelled',
  SUBSCRIPTION_PAYMENT_FAILED = 'subscription.payment_failed',
  SUBSCRIPTION_PAYMENT_SUCCEEDED = 'subscription.payment_succeeded',
  
  // Credit events
  CREDIT_BALANCE_LOW = 'credit.balance_low',
  CREDIT_ADDED = 'credit.added',
  CREDIT_USED = 'credit.used',
  
  // Content events
  CONTENT_CREATED = 'content.created',
  CONTENT_UPDATED = 'content.updated',
  CONTENT_DELETED = 'content.deleted',
  CONTENT_SHARED = 'content.shared',
  
  // System events
  SYSTEM_MAINTENANCE = 'system.maintenance',
  SYSTEM_ALERT = 'system.alert',
  
  // Custom events
  CUSTOM_EVENT = 'custom.event'
}

/**
 * Notification rule
 */
export interface NotificationRule {
  id: string;
  eventType: EventType;
  channels: NotificationType[];
  enabled: boolean;
  templateId?: string;
  templateName?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  conditions?: Record<string, any>;
  metadata?: Record<string, any>;
}

/**
 * Webhook Configuration type (matching DB schema)
 */
interface WebhookConfiguration {
  id: string;
  user_id: string;
  name: string;
  url: string;
  events: string[]; // Assuming events are stored as an array of strings
  headers?: Record<string, string>;
  is_active: boolean;
  secret: string;
  created_at: string;
  updated_at: string;
}

/**
 * Event data
 */
export interface EventData {
  eventType: EventType;
  userId?: string;
  data: Record<string, any>;
  metadata?: Record<string, any>;
  secret?: string; // Added for webhook config type
}

/**
 * Event notification service class
 */
class EventNotificationService {
  private rules: Map<EventType, NotificationRule[]> = new Map();
  
  constructor() {
    // Load notification rules
    this.loadNotificationRules();
    
    logger.info('Event notification service initialized');
  }
  
  /**
   * Load notification rules from the database
   */
  private async loadNotificationRules(): Promise<void> {
    try {
      const { data, error } = await supabaseClient.getClient()
        .from('notification_rules')
        .select('*')
        .eq('enabled', true);
      
      if (error) {
        logger.error(`Failed to load notification rules: ${error.message}`);
        return;
      }
      
      // Group rules by event type
      this.rules.clear();
      
      for (const rule of data) {
        const eventType = rule.eventType as EventType;
        
        if (!this.rules.has(eventType)) {
          this.rules.set(eventType, []);
        }
        
        this.rules.get(eventType)?.push(rule);
      }
      
      logger.info(`Loaded ${data.length} notification rules`);
    } catch (error) {
      logger.error(`Failed to load notification rules: ${error}`);
    }
  }
  
  /**
   * Process an event and send notifications
   * @param event Event data
   * @returns Success indicator
   */
  async processEvent(event: EventData): Promise<boolean> {
    try {
      logger.debug(`Processing event: ${event.eventType}`);
      
      // Log the event
      await this.logEvent(event);
      
      // Get rules for this event type
      const rules = this.rules.get(event.eventType) || [];
      
      if (rules.length === 0) {
        logger.debug(`No notification rules found for event: ${event.eventType}`);
        return true;
      }
      
      // Process each rule
      for (const rule of rules) {
        // Check if rule conditions match
        if (rule.conditions && !this.evaluateConditions(rule.conditions, event.data)) {
          continue;
        }
        
        // Process rule for each channel
        for (const channel of rule.channels) {
          await this.processRuleForChannel(rule, channel, event);
        }
      }
      
      return true;
    } catch (error) {
      logger.error(`Failed to process event: ${error}`);
      return false;
    }
  }
  
  /**
   * Process a rule for a specific notification channel
   * @param rule Notification rule
   * @param channel Notification channel
   * @param event Event data
   */
  private async processRuleForChannel(
    rule: NotificationRule,
    channel: NotificationType,
    event: EventData
  ): Promise<void> {
    try {
      // Check user preferences if userId is provided
      if (event.userId) {
        const userPrefs = await notificationService.getUserNotificationPreferences(event.userId);
        
        // Skip if user has disabled this notification type
        if (userPrefs[`${event.eventType}_${channel}`] === false) {
          logger.debug(`User ${event.userId} has disabled ${channel} notifications for ${event.eventType}`);
          return;
        }
      }
      
      // Render template if needed
      let content: any = {};
      
      if (rule.templateId || rule.templateName) {
        // Get template content
        const renderedContent = await templateService.renderTemplate({
          templateId: rule.templateId,
          templateName: rule.templateName,
          data: {
            ...event.data,
            eventType: event.eventType,
            userId: event.userId,
            timestamp: new Date()
          }
        });
        
        // Parse content if it's JSON
        try {
          content = JSON.parse(renderedContent);
        } catch {
          // Not JSON, use as is
          content = { message: renderedContent };
        }
      } else {
        // No template, use event data directly
        content = event.data;
      }
      
      // Send notification based on channel
      switch (channel) {
        case NotificationType.EMAIL:
          await this.sendEmailNotification(event, content);
          break;
          
        case NotificationType.SMS:
          await this.sendSMSNotification(event, content);
          break;
          
        case NotificationType.WEBHOOK:
          // Replaced direct call with user webhook processing
          await this.processUserWebhooks(event);
          break;
          
        case NotificationType.IN_APP:
          await this.sendInAppNotification(event, content);
          break;
      }
    } catch (error) {
      logger.error(`Failed to process rule for channel ${channel}: ${error}`);
    }
  }

  /**
   * Process and send notifications to user-configured webhooks for an event
   * @param event Event data
   */
  private async processUserWebhooks(event: EventData): Promise<void> {
    if (!event.userId) {
      logger.debug(`Skipping user webhooks for event ${event.eventType}: No user ID provided.`);
      return;
    }

    try {
      // Find active webhook configurations for this user and event type
      // Add explicit type annotation for configs
      const { data: configs, error: fetchError } = await supabaseClient.getClient()
        .from('webhook_configurations')
        .select('*')
        .eq('user_id', event.userId)
        .eq('is_active', true);
        // .contains('events', [event.eventType]); // Use contains for array check

      if (fetchError) {
        logger.error(`Failed to fetch webhook configurations for user ${event.userId}: ${fetchError.message}`);
        return;
      }

      if (!configs || configs.length === 0) {
        logger.debug(`No active webhook configurations found for user ${event.userId} and event ${event.eventType}.`);
        return;
      }

      // Filter configs that subscribe to the specific event
      // Add type annotation for config parameter in filter
      const relevantConfigs = configs.filter((config: WebhookConfiguration) => config.events?.includes(event.eventType));

      if (relevantConfigs.length === 0) {
        logger.debug(`No relevant webhook configurations found for user ${event.userId} and event ${event.eventType} after filtering.`);
        return;
      }

      logger.debug(`Found ${relevantConfigs.length} relevant webhook(s) for user ${event.userId}, event ${event.eventType}.`);

      // Prepare the base payload
      const payload = {
        event: event.eventType,
        timestamp: new Date().toISOString(),
        data: event.data || {},
        metadata: event.metadata || {}
      };

      // Send to each configured webhook
      for (const config of relevantConfigs) {
        if (!config.url || !config.secret) {
          logger.warn(`Skipping webhook ${config.id} due to missing URL or secret.`);
          continue;
        }

        try {
          // Generate signature
          const signature = webhookProvider.generateSignature(payload, config.secret);

          // Prepare headers
          const headers = {
            ...(config.headers || {}),
            'X-Webhook-Signature': signature,
            'Content-Type': 'application/json' // Ensure content type
          };

          // Send webhook via notificationService
          await notificationService.sendWebhook({
            url: config.url,
            method: 'POST', // User webhooks are typically POST
            headers,
            payload,
            userId: event.userId, // Include userId for logging context
            metadata: { webhookId: config.id, ...(event.metadata || {}) },
            eventType: event.eventType
          });

          logger.debug(`Successfully sent webhook for event ${event.eventType} to ${config.url} (Webhook ID: ${config.id})`);

        } catch (webhookError) {
          logger.error(`Failed to send webhook for config ${config.id} to ${config.url}: ${webhookError}`);
          // Log delivery failure? (webhook_delivery_logs might be handled by webhookProvider/notificationService)
        }
      }

    } catch (error) {
      logger.error(`Error processing user webhooks for event ${event.eventType}, user ${event.userId}: ${error}`);
    }
  }
  
  /**
   * Send an email notification
   * @param event Event data
   * @param content Rendered content
   */
  private async sendEmailNotification(event: EventData, content: any): Promise<void> {
    try {
      // Skip if no recipient
      if (!event.userId && !content.to) {
        logger.warn('Email notification skipped: No recipient specified');
        return;
      }
      
      // Get user email if userId is provided but no explicit recipient
      let to = content.to;
      
      if (!to && event.userId) {
        const user = await this.getUserById(event.userId);
        to = user?.email;
      }
      
      if (!to) {
        logger.warn('Email notification skipped: Could not determine recipient');
        return;
      }
      
      // Send email
      await notificationService.sendEmail({
        to,
        subject: content.subject || `Notification: ${event.eventType}`,
        text: content.text || content.message,
        html: content.html,
        userId: event.userId,
        metadata: event.metadata,
        eventType: event.eventType
      });
    } catch (error) {
      logger.error(`Failed to send email notification: ${error}`);
    }
  }
  
  /**
   * Send an SMS notification
   * @param event Event data
   * @param content Rendered content
   */
  private async sendSMSNotification(event: EventData, content: any): Promise<void> {
    try {
      // Skip if no recipient
      if (!event.userId && !content.to) {
        logger.warn('SMS notification skipped: No recipient specified');
        return;
      }
      
      // Get user phone if userId is provided but no explicit recipient
      let to = content.to;
      
      if (!to && event.userId) {
        const user = await this.getUserById(event.userId);
        to = user?.phone;
      }
      
      if (!to) {
        logger.warn('SMS notification skipped: Could not determine recipient');
        return;
      }
      
      // Send SMS
      await notificationService.sendSMS({
        to,
        message: content.message || content.text,
        userId: event.userId,
        metadata: event.metadata,
        eventType: event.eventType
      });
    } catch (error) {
      logger.error(`Failed to send SMS notification: ${error}`);
    }
  }

  // Removed the old sendWebhookNotification method as it's replaced by processUserWebhooks
  
  /**
   * Send an in-app notification
   * @param event Event data
   * @param content Rendered content
   */
  private async sendInAppNotification(event: EventData, content: any): Promise<void> {
    try {
      // Skip if no user ID
      if (!event.userId) {
        logger.warn('In-app notification skipped: No user ID specified');
        return;
      }
      
      // Send in-app notification
      await notificationService.sendInAppNotification({
        userId: event.userId,
        title: content.title || `Notification: ${event.eventType}`,
        message: content.message || content.text,
        type: content.type || 'info',
        actionUrl: content.actionUrl,
        metadata: event.metadata,
        eventType: event.eventType
      });
    } catch (error) {
      logger.error(`Failed to send in-app notification: ${error}`);
    }
  }
  
  /**
   * Log an event in the database
   * @param event Event data
   */
  private async logEvent(event: EventData): Promise<void> {
    try {
      const { error } = await supabaseClient.getClient()
        .from('event_logs')
        .insert([{
          eventType: event.eventType,
          userId: event.userId,
          data: event.data,
          metadata: event.metadata,
          timestamp: new Date()
        }]);
      
      if (error) {
        logger.warn(`Failed to log event: ${error.message}`);
      }
    } catch (error) {
      logger.warn(`Error logging event: ${error}`);
    }
  }
  
  /**
   * Evaluate conditions against event data
   * @param conditions Conditions to evaluate
   * @param data Event data
   * @returns Whether conditions match
   */
  private evaluateConditions(conditions: Record<string, any>, data: Record<string, any>): boolean {
    try {
      // Simple condition evaluation
      for (const [key, value] of Object.entries(conditions)) {
        const parts = key.split('.');
        let current = data;
        
        // Navigate nested properties
        for (let i = 0; i < parts.length - 1; i++) {
          const part = parts[i];
          // Ensure part is valid and current is an object before indexing
          if (part === undefined || typeof current !== 'object' || current === null || !Object.prototype.hasOwnProperty.call(current, part)) {
             return false; // Invalid part or property path doesn't exist
          }
          current = current[part];
          
          if (current === undefined) { // Check value after assignment
             return false;
          }
        }
        
        // Check final property
        const finalProp = parts[parts.length - 1];

        // Ensure finalProp is valid and current is an object before indexing
        if (finalProp === undefined || typeof current !== 'object' || current === null || !Object.prototype.hasOwnProperty.call(current, finalProp)) {
           return false; // Invalid finalProp or final property doesn't exist
        }
        
        if (current[finalProp] !== value) {
           return false;
        }
      }
      
      return true;
    } catch (error) {
      logger.warn(`Error evaluating conditions: ${error}`);
      return false;
    }
  }
  
  /**
   * Get a user by ID
   * @param userId User ID
   * @returns User data
    */
   private async getUserById(userId: string): Promise<{ email?: string; phone?: string } | null> {
     try {
       // Cast auth to 'any' to bypass potential type issue with '.admin'
       const { data, error } = await (supabaseClient.getClient().auth as any).admin.getUserById(userId);
       
       if (error || !data.user) {
         // Log the error if fetching user failed
         if (error) {
           logger.warn(`Failed to get user by ID ${userId}: ${error.message}`);
         }
         return null;
      }
      
      return {
        email: data.user.email,
        phone: data.user.phone
      };
    } catch (error) {
      logger.warn(`Error getting user by ID: ${error}`);
      return null;
    }
  }
  
  /**
   * Reload notification rules from the database
   */
  async reloadRules(): Promise<void> {
    await this.loadNotificationRules();
  }
}

// Create and export the event notification service instance
export const eventNotificationService = new EventNotificationService();
