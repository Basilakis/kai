/**
 * Push Notification Provider
 * 
 * Provides functionality for sending push notifications using Supabase.
 * Supports both direct API calls and Supabase Edge Functions.
 */

import { logger } from '../../../utils/logger';
import { supabaseClient } from '../../supabase/supabaseClient';
import axios from 'axios';

/**
 * Push notification options
 */
export interface PushNotificationOptions {
  to: string | string[]; // Expo push token(s)
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: string;
  badge?: number;
  channelId?: string; // Android notification channel
  categoryId?: string; // iOS notification category
  priority?: 'default' | 'normal' | 'high';
  ttl?: number; // Time to live in seconds
  expiration?: number; // Expiration time in seconds
  subtitle?: string; // iOS only
  userId?: string; // For tracking
  metadata?: Record<string, any>;
  eventType?: string;
}

/**
 * Push notification result
 */
export interface PushNotificationResult {
  id: string;
  status: 'ok' | 'error';
  message?: string;
  details?: any;
}

/**
 * Push provider configuration
 */
interface PushProviderConfig {
  provider: 'expo' | 'mock'; // Removed 'firebase'
  expoAccessToken?: string;
  // Removed firebaseCredentials
  useEdgeFunction: boolean;
  edgeFunctionUrl?: string;
}

/**
 * Push provider class
 */
class PushProvider {
  private config: PushProviderConfig;
  
  constructor() {
    // Load configuration from environment variables
    this.config = {
      provider: (process.env.PUSH_PROVIDER || 'expo') as 'expo' | 'mock', // Removed 'firebase'
      expoAccessToken: process.env.EXPO_ACCESS_TOKEN,
      // Removed firebaseCredentials
      useEdgeFunction: process.env.USE_SUPABASE_EDGE_FUNCTION === 'true',
      edgeFunctionUrl: process.env.SUPABASE_PUSH_FUNCTION_URL
    };
    
    logger.info(`Push provider initialized with provider: ${this.config.provider}`);
    logger.info(`Using Supabase Edge Function: ${this.config.useEdgeFunction}`);
  }
  
  /**
   * Send a push notification
   * @param options Push notification options
   * @returns Push notification result
   */
  async sendPushNotification(options: PushNotificationOptions): Promise<PushNotificationResult[]> {
    try {
      // Convert to array if single token
      const recipients = Array.isArray(options.to) ? options.to : [options.to];
      
      if (recipients.length === 0) {
        throw new Error('No recipients specified');
      }
      
      // Use Supabase Edge Function if configured
      if (this.config.useEdgeFunction) {
        return this.sendViaEdgeFunction(options);
      }
      
      // Otherwise use direct API calls
      switch (this.config.provider) {
        case 'expo':
          return this.sendViaExpo(options);
        // Removed 'firebase' case
        case 'mock':
        default:
          return this.sendViaMock(options);
      }
    } catch (error) {
      logger.error(`Failed to send push notification: ${error}`);
      throw error;
    }
  }
  
  /**
   * Send push notification via Supabase Edge Function
   * @param options Push notification options
   * @returns Push notification result
   */
  private async sendViaEdgeFunction(options: PushNotificationOptions): Promise<PushNotificationResult[]> {
    try {
      if (!this.config.edgeFunctionUrl) {
        throw new Error('Supabase Edge Function URL not configured');
      }
      
      // Get Supabase auth token for the function call
      const { data: authData } = await supabaseClient.getClient().auth.session(); // Changed getSession to session
      
      if (!authData.session) {
        throw new Error('No active Supabase session');
      }
      
      // Call the Edge Function
      const response = await axios.post(
        this.config.edgeFunctionUrl,
        {
          to: options.to,
          title: options.title,
          body: options.body,
          data: options.data || {},
          sound: options.sound || 'default',
          badge: options.badge,
          channelId: options.channelId,
          priority: options.priority || 'high',
          ttl: options.ttl,
          expiration: options.expiration,
          subtitle: options.subtitle
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authData.session.access_token}`
          }
        }
      );
      
      return response.data.data || [];
    } catch (error) {
      logger.error(`Failed to send push notification via Edge Function: ${error}`);
      throw error;
    }
  }
  
  /**
   * Send push notification via Expo Push API
   * @param options Push notification options
   * @returns Push notification result
   */
  private async sendViaExpo(options: PushNotificationOptions): Promise<PushNotificationResult[]> {
    try {
      if (!this.config.expoAccessToken) {
        throw new Error('Expo access token not configured');
      }
      
      const recipients = Array.isArray(options.to) ? options.to : [options.to];
      
      // Prepare messages for Expo API
      const messages = recipients.map(token => ({
        to: token,
        title: options.title,
        body: options.body,
        data: options.data || {},
        sound: options.sound || 'default',
        badge: options.badge,
        channelId: options.channelId,
        categoryId: options.categoryId,
        priority: options.priority || 'high',
        ttl: options.ttl,
        expiration: options.expiration,
        subtitle: options.subtitle
      }));
      
      // Send to Expo Push API
      const response = await axios.post(
        'https://exp.host/--/api/v2/push/send',
        messages,
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip, deflate',
            'Authorization': `Bearer ${this.config.expoAccessToken}`
          }
        }
      );
      
      // Map response to our result format
      return (response.data.data || []).map((item: any, index: number) => ({
        id: item.id || `expo-${Date.now()}-${index}`,
        status: item.status === 'ok' ? 'ok' : 'error',
        message: item.message,
        details: item
      }));
    } catch (error) {
      logger.error(`Failed to send push notification via Expo: ${error}`);
      throw error;
    }
  }

  // Removed sendViaFirebase method
  
  /**
   * Send push notification via mock provider (for development)
   * @param options Push notification options
   * @returns Push notification result
   */
  private async sendViaMock(options: PushNotificationOptions): Promise<PushNotificationResult[]> {
    try {
      const recipients = Array.isArray(options.to) ? options.to : [options.to];
      
      // Log the notification but don't actually send it
      logger.info(`[MOCK PUSH] Title: ${options.title}, Body: ${options.body}`);
      logger.info(`[MOCK PUSH] Recipients: ${recipients.join(', ')}`);
      
      if (options.data) {
        logger.info(`[MOCK PUSH] Data: ${JSON.stringify(options.data)}`);
      }
      
      return recipients.map((token, index) => ({
        id: `mock-${Date.now()}-${index}`,
        status: 'ok',
        message: 'Sent via mock provider',
        details: { token }
      }));
    } catch (error) {
      logger.error(`Failed to send mock push notification: ${error}`);
      throw error;
    }
  }
  
  /**
   * Verify push notification configuration
   * @returns Verification result
   */
  async verifyConfiguration(): Promise<boolean> {
    try {
      switch (this.config.provider) {
        case 'expo':
          if (!this.config.expoAccessToken) {
            return false;
          }
          
          // Verify Expo configuration
          const response = await axios.get('https://exp.host/--/api/v2/push/getReceipts', {
            headers: {
              'Authorization': `Bearer ${this.config.expoAccessToken}`
            }
          });
          
          return response.status === 200;

        // Removed 'firebase' case
          
        case 'mock':
        default:
          return true;
      }
    } catch (error) {
      logger.error(`Push provider verification failed: ${error}`);
      return false;
    }
  }
}

// Create and export the push provider instance
export const pushProvider = new PushProvider();
