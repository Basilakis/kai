/**
 * Email Provider
 * 
 * Provides functionality for sending emails using configurable email services.
 * Supports multiple email service providers with fallback capabilities.
 */

import nodemailer from 'nodemailer';
import { logger } from '../../../utils/logger';
import { EmailNotificationOptions } from '../notificationService';

/**
 * Email provider configuration
 */
interface EmailProviderConfig {
  service: 'smtp' | 'sendgrid' | 'mailgun' | 'ses';
  host?: string;
  port?: number;
  secure?: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
}

/**
 * Email provider class
 */
class EmailProvider {
  private transporter: nodemailer.Transporter;
  private config: EmailProviderConfig;
  private defaultFrom: string;
  
  constructor() {
    // Load configuration from environment variables
    this.config = {
      service: (process.env.EMAIL_SERVICE || 'smtp') as 'smtp' | 'sendgrid' | 'mailgun' | 'ses',
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT ? parseInt(process.env.EMAIL_PORT, 10) : undefined,
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER || '',
        pass: process.env.EMAIL_PASSWORD || ''
      },
      from: process.env.EMAIL_FROM || 'noreply@example.com'
    };
    
    this.defaultFrom = this.config.from;
    
    // Initialize the email transporter
    this.initializeTransporter();
  }
  
  /**
   * Initialize the email transporter
   */
  private initializeTransporter(): void {
    try {
      // Create transporter based on configuration
      switch (this.config.service) {
        case 'sendgrid':
          this.transporter = nodemailer.createTransport({
            service: 'SendGrid',
            auth: {
              user: this.config.auth.user,
              pass: this.config.auth.pass
            }
          });
          break;
          
        case 'mailgun':
          this.transporter = nodemailer.createTransport({
            service: 'Mailgun',
            auth: {
              user: this.config.auth.user,
              pass: this.config.auth.pass
            }
          });
          break;
          
        case 'ses':
          this.transporter = nodemailer.createTransport({
            service: 'SES',
            auth: {
              user: this.config.auth.user,
              pass: this.config.auth.pass
            }
          });
          break;
          
        case 'smtp':
        default:
          this.transporter = nodemailer.createTransport({
            host: this.config.host,
            port: this.config.port,
            secure: this.config.secure,
            auth: {
              user: this.config.auth.user,
              pass: this.config.auth.pass
            }
          });
          break;
      }
      
      logger.info(`Email provider initialized with service: ${this.config.service}`);
    } catch (error) {
      logger.error(`Failed to initialize email provider: ${error}`);
      
      // Create a preview transporter for development if regular initialization fails
      if (process.env.NODE_ENV !== 'production') {
        logger.warn('Using ethereal email for development');
        this.createTestAccount();
      }
    }
  }
  
  /**
   * Create a test account for development
   */
  private async createTestAccount(): Promise<void> {
    try {
      const testAccount = await nodemailer.createTestAccount();
      
      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });
      
      logger.info(`Created test email account: ${testAccount.user}`);
    } catch (error) {
      logger.error(`Failed to create test email account: ${error}`);
    }
  }
  
  /**
   * Send an email
   * @param options Email options
   * @returns Email send result
   */
  async sendEmail(options: EmailNotificationOptions): Promise<any> {
    try {
      if (!this.transporter) {
        throw new Error('Email transporter not initialized');
      }
      
      // Prepare email data
      const mailOptions = {
        from: this.defaultFrom,
        to: options.to,
        cc: options.cc,
        bcc: options.bcc,
        subject: options.subject,
        text: options.text,
        html: options.html,
        attachments: options.attachments
      };
      
      // Send the email
      const info = await this.transporter.sendMail(mailOptions);
      
      // Log preview URL in development
      if (process.env.NODE_ENV !== 'production' && info.messageId) {
        logger.info(`Email preview URL: ${nodemailer.getTestMessageUrl(info)}`);
      }
      
      return info;
    } catch (error) {
      logger.error(`Failed to send email: ${error}`);
      throw error;
    }
  }
  
  /**
   * Verify the email transporter connection
   * @returns Connection verification result
   */
  async verifyConnection(): Promise<boolean> {
    try {
      if (!this.transporter) {
        return false;
      }
      
      await this.transporter.verify();
      return true;
    } catch (error) {
      logger.error(`Email connection verification failed: ${error}`);
      return false;
    }
  }
}

// Create and export the email provider instance
export const emailProvider = new EmailProvider();
