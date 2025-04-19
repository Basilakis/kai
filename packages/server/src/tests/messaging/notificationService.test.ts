/**
 * Unit Tests for Notification Service
 * 
 * These tests verify the functionality of the notification service
 * and its ability to send notifications through various channels.
 */

import { notificationService, NotificationType } from '../../services/messaging/notificationService';
import { emailProvider } from '../../services/messaging/providers/emailProvider';
import { smsProvider } from '../../services/messaging/providers/smsProvider';
import { webhookProvider } from '../../services/messaging/providers/webhookProvider';
import { supabaseClient } from '../../services/supabase/supabaseClient';

// Mock dependencies
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

jest.mock('../../services/supabase/supabaseClient', () => ({
  supabaseClient: {
    getClient: jest.fn().mockReturnValue({
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { email_enabled: true, sms_enabled: true } }),
      insert: jest.fn().mockResolvedValue({ error: null }),
      update: jest.fn().mockResolvedValue({ error: null }),
      upsert: jest.fn().mockResolvedValue({ error: null })
    })
  }
}));

describe('Notification Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sendEmail', () => {
    it('should send an email successfully', async () => {
      const options = {
        to: 'test@example.com',
        subject: 'Test Email',
        text: 'This is a test email',
        html: '<p>This is a test email</p>'
      };

      const result = await notificationService.sendEmail(options);

      expect(emailProvider.sendEmail).toHaveBeenCalledWith(options);
      expect(result.success).toBe(true);
      expect(result.notificationType).toBe(NotificationType.EMAIL);
    });

    it('should log the notification if userId is provided', async () => {
      const options = {
        to: 'test@example.com',
        subject: 'Test Email',
        text: 'This is a test email',
        html: '<p>This is a test email</p>',
        userId: 'user-123'
      };

      const result = await notificationService.sendEmail(options);

      expect(emailProvider.sendEmail).toHaveBeenCalledWith(options);
      expect(supabaseClient.getClient().from).toHaveBeenCalledWith('notification_logs');
      expect(supabaseClient.getClient().from().insert).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should handle errors when sending an email', async () => {
      const error = new Error('Failed to send email');
      (emailProvider.sendEmail as jest.Mock).mockRejectedValueOnce(error);

      const options = {
        to: 'test@example.com',
        subject: 'Test Email',
        text: 'This is a test email'
      };

      const result = await notificationService.sendEmail(options);

      expect(emailProvider.sendEmail).toHaveBeenCalledWith(options);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('sendSMS', () => {
    it('should send an SMS successfully', async () => {
      const options = {
        to: '+1234567890',
        message: 'This is a test SMS'
      };

      const result = await notificationService.sendSMS(options);

      expect(smsProvider.sendSMS).toHaveBeenCalledWith(options);
      expect(result.success).toBe(true);
      expect(result.notificationType).toBe(NotificationType.SMS);
    });

    it('should log the notification if userId is provided', async () => {
      const options = {
        to: '+1234567890',
        message: 'This is a test SMS',
        userId: 'user-123'
      };

      const result = await notificationService.sendSMS(options);

      expect(smsProvider.sendSMS).toHaveBeenCalledWith(options);
      expect(supabaseClient.getClient().from).toHaveBeenCalledWith('notification_logs');
      expect(supabaseClient.getClient().from().insert).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should handle errors when sending an SMS', async () => {
      const error = new Error('Failed to send SMS');
      (smsProvider.sendSMS as jest.Mock).mockRejectedValueOnce(error);

      const options = {
        to: '+1234567890',
        message: 'This is a test SMS'
      };

      const result = await notificationService.sendSMS(options);

      expect(smsProvider.sendSMS).toHaveBeenCalledWith(options);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('sendWebhook', () => {
    it('should send a webhook notification successfully', async () => {
      const options = {
        url: 'https://example.com/webhook',
        payload: { event: 'test', data: { foo: 'bar' } }
      };

      const result = await notificationService.sendWebhook(options);

      expect(webhookProvider.sendWebhook).toHaveBeenCalledWith(options);
      expect(result.success).toBe(true);
      expect(result.notificationType).toBe(NotificationType.WEBHOOK);
    });

    it('should log the notification if userId is provided', async () => {
      const options = {
        url: 'https://example.com/webhook',
        payload: { event: 'test', data: { foo: 'bar' } },
        userId: 'user-123'
      };

      const result = await notificationService.sendWebhook(options);

      expect(webhookProvider.sendWebhook).toHaveBeenCalledWith(options);
      expect(supabaseClient.getClient().from).toHaveBeenCalledWith('notification_logs');
      expect(supabaseClient.getClient().from().insert).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should handle errors when sending a webhook', async () => {
      const error = new Error('Failed to send webhook');
      (webhookProvider.sendWebhook as jest.Mock).mockRejectedValueOnce(error);

      const options = {
        url: 'https://example.com/webhook',
        payload: { event: 'test', data: { foo: 'bar' } }
      };

      const result = await notificationService.sendWebhook(options);

      expect(webhookProvider.sendWebhook).toHaveBeenCalledWith(options);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('sendInAppNotification', () => {
    it('should send an in-app notification successfully', async () => {
      const options = {
        userId: 'user-123',
        title: 'Test Notification',
        message: 'This is a test notification'
      };

      const result = await notificationService.sendInAppNotification(options);

      expect(supabaseClient.getClient().from).toHaveBeenCalledWith('notifications');
      expect(supabaseClient.getClient().from().insert).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.notificationType).toBe(NotificationType.IN_APP);
    });

    it('should handle errors when sending an in-app notification', async () => {
      const error = { message: 'Failed to create notification' };
      (supabaseClient.getClient().from().insert as jest.Mock).mockResolvedValueOnce({ error });

      const options = {
        userId: 'user-123',
        title: 'Test Notification',
        message: 'This is a test notification'
      };

      const result = await notificationService.sendInAppNotification(options);

      expect(supabaseClient.getClient().from).toHaveBeenCalledWith('notifications');
      expect(supabaseClient.getClient().from().insert).toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('getUserNotificationPreferences', () => {
    it('should get user notification preferences', async () => {
      const userId = 'user-123';
      const mockPreferences = { email_enabled: true, sms_enabled: true };
      (supabaseClient.getClient().from().select().eq().single as jest.Mock).mockResolvedValueOnce({ data: mockPreferences });

      const preferences = await notificationService.getUserNotificationPreferences(userId);

      expect(supabaseClient.getClient().from).toHaveBeenCalledWith('user_notification_preferences');
      expect(supabaseClient.getClient().from().select).toHaveBeenCalledWith('*');
      expect(supabaseClient.getClient().from().select().eq).toHaveBeenCalledWith('userId', userId);
      expect(preferences).toEqual(mockPreferences);
    });

    it('should return empty object if no preferences found', async () => {
      const userId = 'user-123';
      (supabaseClient.getClient().from().select().eq().single as jest.Mock).mockResolvedValueOnce({ data: null });

      const preferences = await notificationService.getUserNotificationPreferences(userId);

      expect(supabaseClient.getClient().from).toHaveBeenCalledWith('user_notification_preferences');
      expect(preferences).toEqual({});
    });

    it('should handle errors when getting preferences', async () => {
      const userId = 'user-123';
      const error = { message: 'Failed to get preferences' };
      (supabaseClient.getClient().from().select().eq().single as jest.Mock).mockResolvedValueOnce({ error });

      const preferences = await notificationService.getUserNotificationPreferences(userId);

      expect(supabaseClient.getClient().from).toHaveBeenCalledWith('user_notification_preferences');
      expect(preferences).toEqual({});
    });
  });

  describe('updateUserNotificationPreferences', () => {
    it('should update user notification preferences', async () => {
      const userId = 'user-123';
      const preferences = { email_enabled: true, sms_enabled: false };

      const success = await notificationService.updateUserNotificationPreferences(userId, preferences);

      expect(supabaseClient.getClient().from).toHaveBeenCalledWith('user_notification_preferences');
      expect(supabaseClient.getClient().from().upsert).toHaveBeenCalled();
      expect(success).toBe(true);
    });

    it('should handle errors when updating preferences', async () => {
      const userId = 'user-123';
      const preferences = { email_enabled: true, sms_enabled: false };
      const error = { message: 'Failed to update preferences' };
      (supabaseClient.getClient().from().upsert as jest.Mock).mockResolvedValueOnce({ error });

      const success = await notificationService.updateUserNotificationPreferences(userId, preferences);

      expect(supabaseClient.getClient().from).toHaveBeenCalledWith('user_notification_preferences');
      expect(supabaseClient.getClient().from().upsert).toHaveBeenCalled();
      expect(success).toBe(false);
    });
  });
});
