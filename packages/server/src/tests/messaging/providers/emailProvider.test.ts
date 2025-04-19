/**
 * Unit Tests for Email Provider
 * 
 * These tests verify the functionality of the email provider
 * and its ability to send emails using different email services.
 */

import { emailProvider } from '../../../services/messaging/providers/emailProvider';
import nodemailer from 'nodemailer';

// Mock nodemailer
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({
      messageId: 'test-message-id',
      envelope: { from: 'test@example.com', to: ['recipient@example.com'] }
    }),
    verify: jest.fn().mockResolvedValue(true)
  }),
  createTestAccount: jest.fn().mockResolvedValue({
    user: 'test-user',
    pass: 'test-pass'
  }),
  getTestMessageUrl: jest.fn().mockReturnValue('https://ethereal.email/message/test')
}));

// Mock environment variables
const originalEnv = process.env;

describe('Email Provider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('initialization', () => {
    it('should initialize with SMTP configuration', () => {
      process.env.EMAIL_SERVICE = 'smtp';
      process.env.EMAIL_HOST = 'smtp.example.com';
      process.env.EMAIL_PORT = '587';
      process.env.EMAIL_SECURE = 'false';
      process.env.EMAIL_USER = 'test-user';
      process.env.EMAIL_PASSWORD = 'test-password';
      process.env.EMAIL_FROM = 'test@example.com';

      // Re-initialize the provider with new env vars
      jest.isolateModules(() => {
        require('../../../services/messaging/providers/emailProvider');
      });

      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        auth: {
          user: 'test-user',
          pass: 'test-password'
        }
      });
    });

    it('should initialize with SendGrid configuration', () => {
      process.env.EMAIL_SERVICE = 'sendgrid';
      process.env.EMAIL_USER = 'test-user';
      process.env.EMAIL_PASSWORD = 'test-password';
      process.env.EMAIL_FROM = 'test@example.com';

      // Re-initialize the provider with new env vars
      jest.isolateModules(() => {
        require('../../../services/messaging/providers/emailProvider');
      });

      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        service: 'SendGrid',
        auth: {
          user: 'test-user',
          pass: 'test-password'
        }
      });
    });

    it('should create a test account if initialization fails in development', () => {
      process.env.NODE_ENV = 'development';
      process.env.EMAIL_SERVICE = 'smtp';
      process.env.EMAIL_HOST = 'invalid-host';

      // Mock createTransport to throw an error on first call
      const mockCreateTransport = jest.fn()
        .mockImplementationOnce(() => { throw new Error('Connection error'); })
        .mockImplementationOnce(() => ({
          sendMail: jest.fn().mockResolvedValue({
            messageId: 'test-message-id'
          }),
          verify: jest.fn().mockResolvedValue(true)
        }));

      (nodemailer.createTransport as jest.Mock).mockImplementation(mockCreateTransport);

      // Re-initialize the provider with new env vars
      jest.isolateModules(() => {
        require('../../../services/messaging/providers/emailProvider');
      });

      expect(nodemailer.createTestAccount).toHaveBeenCalled();
      expect(nodemailer.createTransport).toHaveBeenCalledTimes(2);
      expect(nodemailer.createTransport).toHaveBeenLastCalledWith({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: 'test-user',
          pass: 'test-pass'
        }
      });
    });
  });

  describe('sendEmail', () => {
    it('should send an email successfully', async () => {
      const options = {
        to: 'recipient@example.com',
        subject: 'Test Email',
        text: 'This is a test email',
        html: '<p>This is a test email</p>'
      };

      const result = await emailProvider.sendEmail(options);

      expect(nodemailer.createTransport().sendMail).toHaveBeenCalledWith({
        from: expect.any(String),
        to: 'recipient@example.com',
        subject: 'Test Email',
        text: 'This is a test email',
        html: '<p>This is a test email</p>',
        cc: undefined,
        bcc: undefined,
        attachments: undefined
      });

      expect(result).toEqual({
        messageId: 'test-message-id',
        envelope: { from: 'test@example.com', to: ['recipient@example.com'] }
      });
    });

    it('should send an email with CC, BCC, and attachments', async () => {
      const options = {
        to: 'recipient@example.com',
        cc: 'cc@example.com',
        bcc: 'bcc@example.com',
        subject: 'Test Email',
        text: 'This is a test email',
        html: '<p>This is a test email</p>',
        attachments: [
          {
            filename: 'test.txt',
            content: 'Hello World'
          }
        ]
      };

      const result = await emailProvider.sendEmail(options);

      expect(nodemailer.createTransport().sendMail).toHaveBeenCalledWith({
        from: expect.any(String),
        to: 'recipient@example.com',
        cc: 'cc@example.com',
        bcc: 'bcc@example.com',
        subject: 'Test Email',
        text: 'This is a test email',
        html: '<p>This is a test email</p>',
        attachments: [
          {
            filename: 'test.txt',
            content: 'Hello World'
          }
        ]
      });

      expect(result).toEqual({
        messageId: 'test-message-id',
        envelope: { from: 'test@example.com', to: ['recipient@example.com'] }
      });
    });

    it('should handle errors when sending an email', async () => {
      const error = new Error('Failed to send email');
      (nodemailer.createTransport().sendMail as jest.Mock).mockRejectedValueOnce(error);

      const options = {
        to: 'recipient@example.com',
        subject: 'Test Email',
        text: 'This is a test email'
      };

      await expect(emailProvider.sendEmail(options)).rejects.toThrow('Failed to send email');
      expect(nodemailer.createTransport().sendMail).toHaveBeenCalled();
    });

    it('should log preview URL in development environment', async () => {
      process.env.NODE_ENV = 'development';

      const options = {
        to: 'recipient@example.com',
        subject: 'Test Email',
        text: 'This is a test email'
      };

      const result = await emailProvider.sendEmail(options);

      expect(nodemailer.getTestMessageUrl).toHaveBeenCalled();
      expect(result).toEqual({
        messageId: 'test-message-id',
        envelope: { from: 'test@example.com', to: ['recipient@example.com'] }
      });
    });
  });

  describe('verifyConnection', () => {
    it('should verify connection successfully', async () => {
      const result = await emailProvider.verifyConnection();

      expect(nodemailer.createTransport().verify).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should handle errors when verifying connection', async () => {
      const error = new Error('Connection error');
      (nodemailer.createTransport().verify as jest.Mock).mockRejectedValueOnce(error);

      const result = await emailProvider.verifyConnection();

      expect(nodemailer.createTransport().verify).toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it('should return false if transporter is not initialized', async () => {
      // Mock the transporter to be null
      Object.defineProperty(emailProvider, 'transporter', {
        get: jest.fn().mockReturnValue(null)
      });

      const result = await emailProvider.verifyConnection();

      expect(result).toBe(false);
    });
  });
});
