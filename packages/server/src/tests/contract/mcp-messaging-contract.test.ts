/**
 * Contract Tests for MCP Messaging Integration
 * 
 * These tests verify the contract between the messaging service
 * and the MCP client, ensuring that the messaging service can
 * properly integrate with the MCP server.
 */

import mcpClientService, { MCPServiceKey } from '../../services/mcp/mcpClientService';
import { notificationService, NotificationType } from '../../services/messaging/notificationService';
import { emailProvider } from '../../services/messaging/providers/emailProvider';
import { smsProvider } from '../../services/messaging/providers/smsProvider';
import { webhookProvider } from '../../services/messaging/providers/webhookProvider';
import creditService from '../../services/credit/creditService';

// Mock dependencies
jest.mock('../../services/mcp/mcpClientService', () => ({
  __esModule: true,
  default: {
    isMCPAvailable: jest.fn().mockResolvedValue(true),
    getClient: jest.fn().mockReturnValue({
      callEndpoint: jest.fn().mockResolvedValue({
        success: true,
        messageId: 'mcp-message-id'
      })
    }),
    sendEmail: jest.fn().mockResolvedValue({
      success: true,
      messageId: 'mcp-email-id'
    }),
    sendSMS: jest.fn().mockResolvedValue({
      success: true,
      messageId: 'mcp-sms-id'
    }),
    sendWebhook: jest.fn().mockResolvedValue({
      success: true,
      status: 200
    }),
    sendPushNotification: jest.fn().mockResolvedValue({
      success: true,
      messageId: 'mcp-push-id'
    })
  },
  MCPServiceKey: {
    EMAIL_NOTIFICATION: 'email_notification',
    SMS_NOTIFICATION: 'sms_notification',
    WEBHOOK_NOTIFICATION: 'webhook_notification',
    PUSH_NOTIFICATION: 'push_notification'
  }
}));

jest.mock('../../services/credit/creditService', () => ({
  __esModule: true,
  default: {
    hasEnoughCreditsForService: jest.fn().mockResolvedValue(true),
    useServiceCredits: jest.fn().mockResolvedValue(true)
  }
}));

jest.mock('../../services/messaging/providers/emailProvider', () => ({
  emailProvider: {
    sendEmail: jest.fn().mockResolvedValue({ messageId: 'test-email-id' })
  }
}));

jest.mock('../../services/messaging/providers/smsProvider', () => ({
  smsProvider: {
    sendSMS: jest.fn().mockResolvedValue({ messageId: 'test-sms-id' })
  }
}));

jest.mock('../../services/messaging/providers/webhookProvider', () => ({
  webhookProvider: {
    sendWebhook: jest.fn().mockResolvedValue({ status: 200 })
  }
}));

describe('MCP Messaging Contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Email Notifications via MCP', () => {
    it('should send an email through MCP when available', async () => {
      // Create a spy on the notificationService.sendEmail method
      const sendEmailSpy = jest.spyOn(notificationService, 'sendEmail');
      
      // Set up the test data
      const userId = 'test-user-id';
      const emailOptions = {
        to: 'test@example.com',
        subject: 'Test Email',
        text: 'This is a test email',
        html: '<p>This is a test email</p>',
        userId
      };
      
      // Call the method
      await notificationService.sendEmail(emailOptions);
      
      // Verify MCP was checked
      expect(mcpClientService.isMCPAvailable).toHaveBeenCalled();
      
      // Verify credit check
      expect(creditService.hasEnoughCreditsForService).toHaveBeenCalledWith(
        userId,
        MCPServiceKey.EMAIL_NOTIFICATION,
        1
      );
      
      // Verify MCP was used
      expect(mcpClientService.sendEmail).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          to: 'test@example.com',
          subject: 'Test Email',
          text: 'This is a test email',
          html: '<p>This is a test email</p>'
        })
      );
      
      // Verify direct provider was not used
      expect(emailProvider.sendEmail).not.toHaveBeenCalled();
      
      // Verify credit usage was tracked
      expect(creditService.useServiceCredits).toHaveBeenCalledWith(
        userId,
        MCPServiceKey.EMAIL_NOTIFICATION,
        1,
        expect.any(String),
        expect.any(Object)
      );
      
      // Restore the spy
      sendEmailSpy.mockRestore();
    });

    it('should fall back to direct provider if MCP is not available', async () => {
      // Mock MCP as unavailable
      (mcpClientService.isMCPAvailable as jest.Mock).mockResolvedValueOnce(false);
      
      // Create a spy on the notificationService.sendEmail method
      const sendEmailSpy = jest.spyOn(notificationService, 'sendEmail');
      
      // Set up the test data
      const userId = 'test-user-id';
      const emailOptions = {
        to: 'test@example.com',
        subject: 'Test Email',
        text: 'This is a test email',
        html: '<p>This is a test email</p>',
        userId
      };
      
      // Call the method
      await notificationService.sendEmail(emailOptions);
      
      // Verify MCP was checked
      expect(mcpClientService.isMCPAvailable).toHaveBeenCalled();
      
      // Verify MCP was not used
      expect(mcpClientService.sendEmail).not.toHaveBeenCalled();
      
      // Verify direct provider was used
      expect(emailProvider.sendEmail).toHaveBeenCalledWith(emailOptions);
      
      // Restore the spy
      sendEmailSpy.mockRestore();
    });

    it('should fall back to direct provider if user has insufficient credits', async () => {
      // Mock insufficient credits
      (creditService.hasEnoughCreditsForService as jest.Mock).mockResolvedValueOnce(false);
      
      // Create a spy on the notificationService.sendEmail method
      const sendEmailSpy = jest.spyOn(notificationService, 'sendEmail');
      
      // Set up the test data
      const userId = 'test-user-id';
      const emailOptions = {
        to: 'test@example.com',
        subject: 'Test Email',
        text: 'This is a test email',
        html: '<p>This is a test email</p>',
        userId
      };
      
      // Call the method
      await notificationService.sendEmail(emailOptions);
      
      // Verify MCP was checked
      expect(mcpClientService.isMCPAvailable).toHaveBeenCalled();
      
      // Verify credit check
      expect(creditService.hasEnoughCreditsForService).toHaveBeenCalledWith(
        userId,
        MCPServiceKey.EMAIL_NOTIFICATION,
        1
      );
      
      // Verify MCP was not used
      expect(mcpClientService.sendEmail).not.toHaveBeenCalled();
      
      // Verify direct provider was used
      expect(emailProvider.sendEmail).toHaveBeenCalledWith(emailOptions);
      
      // Restore the spy
      sendEmailSpy.mockRestore();
    });
  });

  describe('SMS Notifications via MCP', () => {
    it('should send an SMS through MCP when available', async () => {
      // Create a spy on the notificationService.sendSMS method
      const sendSMSSpy = jest.spyOn(notificationService, 'sendSMS');
      
      // Set up the test data
      const userId = 'test-user-id';
      const smsOptions = {
        to: '+1234567890',
        message: 'This is a test SMS',
        userId
      };
      
      // Call the method
      await notificationService.sendSMS(smsOptions);
      
      // Verify MCP was checked
      expect(mcpClientService.isMCPAvailable).toHaveBeenCalled();
      
      // Verify credit check
      expect(creditService.hasEnoughCreditsForService).toHaveBeenCalledWith(
        userId,
        MCPServiceKey.SMS_NOTIFICATION,
        1
      );
      
      // Verify MCP was used
      expect(mcpClientService.sendSMS).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          to: '+1234567890',
          message: 'This is a test SMS'
        })
      );
      
      // Verify direct provider was not used
      expect(smsProvider.sendSMS).not.toHaveBeenCalled();
      
      // Verify credit usage was tracked
      expect(creditService.useServiceCredits).toHaveBeenCalledWith(
        userId,
        MCPServiceKey.SMS_NOTIFICATION,
        1,
        expect.any(String),
        expect.any(Object)
      );
      
      // Restore the spy
      sendSMSSpy.mockRestore();
    });

    it('should fall back to direct provider if MCP is not available', async () => {
      // Mock MCP as unavailable
      (mcpClientService.isMCPAvailable as jest.Mock).mockResolvedValueOnce(false);
      
      // Create a spy on the notificationService.sendSMS method
      const sendSMSSpy = jest.spyOn(notificationService, 'sendSMS');
      
      // Set up the test data
      const userId = 'test-user-id';
      const smsOptions = {
        to: '+1234567890',
        message: 'This is a test SMS',
        userId
      };
      
      // Call the method
      await notificationService.sendSMS(smsOptions);
      
      // Verify MCP was checked
      expect(mcpClientService.isMCPAvailable).toHaveBeenCalled();
      
      // Verify MCP was not used
      expect(mcpClientService.sendSMS).not.toHaveBeenCalled();
      
      // Verify direct provider was used
      expect(smsProvider.sendSMS).toHaveBeenCalledWith(smsOptions);
      
      // Restore the spy
      sendSMSSpy.mockRestore();
    });
  });

  describe('Webhook Notifications via MCP', () => {
    it('should send a webhook through MCP when available', async () => {
      // Create a spy on the notificationService.sendWebhook method
      const sendWebhookSpy = jest.spyOn(notificationService, 'sendWebhook');
      
      // Set up the test data
      const userId = 'test-user-id';
      const webhookOptions = {
        url: 'https://example.com/webhook',
        payload: { event: 'test', data: { foo: 'bar' } },
        userId
      };
      
      // Call the method
      await notificationService.sendWebhook(webhookOptions);
      
      // Verify MCP was checked
      expect(mcpClientService.isMCPAvailable).toHaveBeenCalled();
      
      // Verify credit check
      expect(creditService.hasEnoughCreditsForService).toHaveBeenCalledWith(
        userId,
        MCPServiceKey.WEBHOOK_NOTIFICATION,
        1
      );
      
      // Verify MCP was used
      expect(mcpClientService.sendWebhook).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          url: 'https://example.com/webhook',
          payload: { event: 'test', data: { foo: 'bar' } }
        })
      );
      
      // Verify direct provider was not used
      expect(webhookProvider.sendWebhook).not.toHaveBeenCalled();
      
      // Verify credit usage was tracked
      expect(creditService.useServiceCredits).toHaveBeenCalledWith(
        userId,
        MCPServiceKey.WEBHOOK_NOTIFICATION,
        1,
        expect.any(String),
        expect.any(Object)
      );
      
      // Restore the spy
      sendWebhookSpy.mockRestore();
    });

    it('should fall back to direct provider if MCP is not available', async () => {
      // Mock MCP as unavailable
      (mcpClientService.isMCPAvailable as jest.Mock).mockResolvedValueOnce(false);
      
      // Create a spy on the notificationService.sendWebhook method
      const sendWebhookSpy = jest.spyOn(notificationService, 'sendWebhook');
      
      // Set up the test data
      const userId = 'test-user-id';
      const webhookOptions = {
        url: 'https://example.com/webhook',
        payload: { event: 'test', data: { foo: 'bar' } },
        userId
      };
      
      // Call the method
      await notificationService.sendWebhook(webhookOptions);
      
      // Verify MCP was checked
      expect(mcpClientService.isMCPAvailable).toHaveBeenCalled();
      
      // Verify MCP was not used
      expect(mcpClientService.sendWebhook).not.toHaveBeenCalled();
      
      // Verify direct provider was used
      expect(webhookProvider.sendWebhook).toHaveBeenCalledWith(webhookOptions);
      
      // Restore the spy
      sendWebhookSpy.mockRestore();
    });
  });
});
