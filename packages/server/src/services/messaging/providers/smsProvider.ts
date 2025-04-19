/**
 * SMS Provider
 * 
 * Provides functionality for sending SMS messages using configurable SMS services.
 * Supports Twilio and a mock provider.
 */

import { logger } from '../../../utils/logger';
import { SMSNotificationOptions } from '../notificationService';
// @ts-ignore - Suppress module not found error, assume twilio is installed
import twilio from 'twilio'; 

/**
 * SMS provider configuration
 */
interface SMSProviderConfig {
  provider: 'twilio' | 'mock'; // Removed 'sns'
  accountSid?: string;
  authToken?: string;
  phoneNumber?: string;
  // Removed region
}

/**
 * SMS provider class
 */
class SMSProvider {
  private config: SMSProviderConfig;
  private twilioClient: twilio.Twilio | null = null;
  
  constructor() {
    // Load configuration from environment variables
    this.config = {
      provider: (process.env.SMS_PROVIDER || 'mock') as 'twilio' | 'mock', // Removed 'sns'
      accountSid: process.env.TWILIO_ACCOUNT_SID,
      authToken: process.env.TWILIO_AUTH_TOKEN,
      phoneNumber: process.env.TWILIO_PHONE_NUMBER
      // Removed region
    };
    
    // Initialize the SMS client
    this.initializeClient();
  }
  
  /**
   * Initialize the SMS client
   */
  private initializeClient(): void {
    try {
      // Create client based on configuration
      switch (this.config.provider) {
        case 'twilio':
          if (!this.config.accountSid || !this.config.authToken) {
            throw new Error('Twilio credentials not configured');
          }
          this.twilioClient = twilio(this.config.accountSid, this.config.authToken);
          logger.info('Twilio SMS provider initialized');
          break;
          
        // Removed 'sns' case
          
        case 'mock':
        default:
          logger.info('Mock SMS provider initialized (messages will be logged but not sent)');
          break;
      }
    } catch (error) {
      logger.error(`Failed to initialize SMS provider: ${error}`);
    }
  }
  
  /**
   * Send an SMS message
   * @param options SMS options
   * @returns SMS send result
   */
  async sendSMS(options: SMSNotificationOptions): Promise<any> {
    try {
      const recipients = Array.isArray(options.to) ? options.to : [options.to];
      
      // Send to each recipient
      const results = await Promise.all(
        recipients.map(recipient => this.sendSingleSMS(recipient, options.message))
      );
      
      return results;
    } catch (error) {
      logger.error(`Failed to send SMS: ${error}`);
      throw error;
    }
  }
  
  /**
   * Send an SMS to a single recipient
   * @param to Recipient phone number
   * @param message Message content
   * @returns SMS send result
   */
  private async sendSingleSMS(to: string, message: string): Promise<any> {
    try {
      switch (this.config.provider) {
        case 'twilio':
          if (!this.twilioClient) {
            throw new Error('Twilio client not initialized');
          }
          
          if (!this.config.phoneNumber) {
            throw new Error('Twilio phone number not configured');
          }
          
          return await this.twilioClient.messages.create({
            body: message,
            from: this.config.phoneNumber,
            to
          });

        // Removed 'sns' case
          
        case 'mock':
        default:
          // Log the message but don't actually send it
          logger.info(`[MOCK SMS] To: ${to}, Message: ${message}`);
          return { messageId: `mock-${Date.now()}`, status: 'sent' };
      }
    } catch (error) {
      logger.error(`Failed to send SMS to ${to}: ${error}`);
      throw error;
    }
  }
  
  /**
   * Verify the SMS provider configuration
   * @returns Verification result
   */
  async verifyConfiguration(): Promise<boolean> {
    try {
      switch (this.config.provider) {
        case 'twilio':
          if (!this.twilioClient) {
            return false;
          }
          
          // Check if we can fetch account info
          await this.twilioClient.api.accounts(this.config.accountSid).fetch();
          return true;

        // Removed 'sns' case
          
        case 'mock':
        default:
          return true;
      }
    } catch (error) {
      logger.error(`SMS provider verification failed: ${error}`);
      return false;
    }
  }
}

// Create and export the SMS provider instance
export const smsProvider = new SMSProvider();
