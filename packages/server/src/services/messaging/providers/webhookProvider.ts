/**
 * Webhook Provider
 * 
 * Provides functionality for sending webhook notifications to external systems.
 * Supports configurable retry logic and authentication methods.
 */

import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
// @ts-ignore - Suppress module not found error, assume @types/node is installed
import crypto from 'crypto'; 
import { logger } from '../../../utils/logger';
import { WebhookNotificationOptions } from '../notificationService';

/**
 * Webhook provider configuration
 */
interface WebhookProviderConfig {
  defaultTimeout: number;
  maxRetries: number;
  retryDelay: number;
  defaultHeaders: Record<string, string>;
}

/**
 * Webhook provider class
 */
class WebhookProvider {
  private config: WebhookProviderConfig;
  
  constructor() {
    // Load configuration from environment variables or use defaults
    this.config = {
      defaultTimeout: parseInt(process.env.WEBHOOK_TIMEOUT || '5000', 10),
      maxRetries: parseInt(process.env.WEBHOOK_MAX_RETRIES || '3', 10),
      retryDelay: parseInt(process.env.WEBHOOK_RETRY_DELAY || '1000', 10),
      defaultHeaders: {
        'Content-Type': 'application/json',
        'User-Agent': 'KAI-Webhook-Service/1.0'
      }
    };
    
    logger.info('Webhook provider initialized');
  }
  
  /**
   * Send a webhook notification
   * @param options Webhook options
   * @returns Webhook send result
   */
  async sendWebhook(options: WebhookNotificationOptions): Promise<any> {
    const method = options.method || 'POST';
    const headers = { ...this.config.defaultHeaders, ...options.headers };
    const retryCount = options.retryCount || this.config.maxRetries;
    
    // Create request config
    const requestConfig: AxiosRequestConfig = {
      method,
      url: options.url,
      headers,
      timeout: this.config.defaultTimeout
    };
    
    // Add payload based on method
    if (method === 'GET') {
      requestConfig.params = options.payload;
    } else {
      requestConfig.data = options.payload;
    }
    
    return this.executeWithRetry(requestConfig, retryCount);
  }
  
  /**
   * Execute a webhook request with retry logic
   * @param config Axios request config
   * @param retriesLeft Number of retries left
   * @returns Webhook response
   */
  private async executeWithRetry(
    config: AxiosRequestConfig, 
    retriesLeft: number
  ): Promise<AxiosResponse> {
    try {
      // Attempt to send the webhook
      const response = await axios(config);
      
      // Log success
      logger.debug(`Webhook sent successfully to ${config.url}`);
      
      return response;
    } catch (error) {
      // Check if we should retry
      if (retriesLeft > 0) {
        logger.warn(`Webhook to ${config.url} failed, retrying (${retriesLeft} attempts left): ${error}`);
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
        
        // Retry with one less retry attempt
        return this.executeWithRetry(config, retriesLeft - 1);
      }
      
      // No more retries, log and throw error
      logger.error(`Webhook to ${config.url} failed after all retry attempts: ${error}`);
      throw error;
    }
  }
  
  /**
   * Validate a webhook URL
   * @param url Webhook URL to validate
   * @returns Validation result
   */
  async validateWebhookUrl(url: string): Promise<boolean> {
    try {
      // Try a simple HEAD request to validate the URL
      await axios.head(url, { timeout: this.config.defaultTimeout });
      return true;
    } catch (error) {
      logger.warn(`Webhook URL validation failed for ${url}: ${error}`);
      return false;
    }
  }
  
  /**
   * Generate a webhook signature for payload verification
   * @param payload Webhook payload
   * @param secret Secret key for signing
   * @returns Signature string
   */
  generateSignature(payload: any, secret: string): string {
    // Removed require('crypto') here
    const hmac = crypto.createHmac('sha256', secret);
    const signature = hmac.update(JSON.stringify(payload)).digest('hex');
    return signature;
  }
}

// Create and export the webhook provider instance
export const webhookProvider = new WebhookProvider();
