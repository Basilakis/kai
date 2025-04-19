/**
 * Integration Tests for Messaging Service
 * 
 * These tests verify the integration between the notification service
 * and its providers, as well as the database interactions.
 */

import { notificationService, NotificationType } from '../../services/messaging/notificationService';
import { emailProvider } from '../../services/messaging/providers/emailProvider';
import { smsProvider } from '../../services/messaging/providers/smsProvider';
import { webhookProvider } from '../../services/messaging/providers/webhookProvider';
import { supabaseClient } from '../../services/supabase/supabaseClient';
import { eventNotificationService, EventType } from '../../services/messaging/eventNotificationService';
import { templateService } from '../../services/messaging/templates/templateService';

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
    sendWebhook: jest.fn().mockResolvedValue({ status: 200 }),
    generateSignature: jest.fn().mockReturnValue('test-signature')
  }
}));

jest.mock('../../services/messaging/templates/templateService', () => ({
  templateService: {
    renderTemplate: jest.fn().mockResolvedValue('Rendered template content')
  }
}));

jest.mock('../../services/supabase/supabaseClient', () => {
  const mockFrom = jest.fn().mockReturnThis();
  const mockSelect = jest.fn().mockReturnThis();
  const mockEq = jest.fn().mockReturnThis();
  const mockIn = jest.fn().mockReturnThis();
  const mockSingle = jest.fn().mockResolvedValue({ data: null, error: null });
  const mockInsert = jest.fn().mockResolvedValue({ data: { id: 'test-id' }, error: null });
  const mockUpdate = jest.fn().mockResolvedValue({ data: null, error: null });
  const mockUpsert = jest.fn().mockResolvedValue({ data: null, error: null });
  const mockDelete = jest.fn().mockResolvedValue({ data: null, error: null });
  
  return {
    supabaseClient: {
      getClient: jest.fn().mockReturnValue({
        from: mockFrom,
        select: mockSelect,
        eq: mockEq,
        in: mockIn,
        single: mockSingle,
        insert: mockInsert,
        update: mockUpdate,
        upsert: mockUpsert,
        delete: mockDelete,
        auth: {
          admin: {
            getUserById: jest.fn().mockResolvedValue({
              data: {
                user: {
                  id: 'test-user-id',
                  email: 'test@example.com',
                  phone: '+1234567890'
                }
              },
              error: null
            })
          }
        }
      })
    }
  };
});

describe('Messaging Service Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('End-to-end notification flow', () => {
    it('should send an email notification and log it', async () => {
      const options = {
        to: 'test@example.com',
        subject: 'Test Email',
        text: 'This is a test email',
        html: '<p>This is a test email</p>',
        userId: 'test-user-id'
      };

      const result = await notificationService.sendEmail(options);

      // Check that email provider was called
      expect(emailProvider.sendEmail).toHaveBeenCalledWith(options);
      
      // Check that notification was logged
      expect(supabaseClient.getClient().from).toHaveBeenCalledWith('notification_logs');
      expect(supabaseClient.getClient().from().insert).toHaveBeenCalledWith([
        expect.objectContaining({
          userId: 'test-user-id',
          notificationType: NotificationType.EMAIL,
          content: expect.objectContaining({
            to: 'test@example.com',
            subject: 'Test Email'
          })
        })
      ]);
      
      // Check result
      expect(result.success).toBe(true);
      expect(result.notificationType).toBe(NotificationType.EMAIL);
    });

    it('should send an SMS notification and log it', async () => {
      const options = {
        to: '+1234567890',
        message: 'This is a test SMS',
        userId: 'test-user-id'
      };

      const result = await notificationService.sendSMS(options);

      // Check that SMS provider was called
      expect(smsProvider.sendSMS).toHaveBeenCalledWith(options);
      
      // Check that notification was logged
      expect(supabaseClient.getClient().from).toHaveBeenCalledWith('notification_logs');
      expect(supabaseClient.getClient().from().insert).toHaveBeenCalledWith([
        expect.objectContaining({
          userId: 'test-user-id',
          notificationType: NotificationType.SMS,
          content: expect.objectContaining({
            to: '+1234567890',
            message: 'This is a test SMS'
          })
        })
      ]);
      
      // Check result
      expect(result.success).toBe(true);
      expect(result.notificationType).toBe(NotificationType.SMS);
    });

    it('should send a webhook notification and log it', async () => {
      const options = {
        url: 'https://example.com/webhook',
        payload: { event: 'test', data: { foo: 'bar' } },
        userId: 'test-user-id'
      };

      const result = await notificationService.sendWebhook(options);

      // Check that webhook provider was called
      expect(webhookProvider.sendWebhook).toHaveBeenCalledWith(options);
      
      // Check that notification was logged
      expect(supabaseClient.getClient().from).toHaveBeenCalledWith('notification_logs');
      expect(supabaseClient.getClient().from().insert).toHaveBeenCalledWith([
        expect.objectContaining({
          userId: 'test-user-id',
          notificationType: NotificationType.WEBHOOK,
          content: expect.objectContaining({
            url: 'https://example.com/webhook',
            method: 'POST'
          })
        })
      ]);
      
      // Check result
      expect(result.success).toBe(true);
      expect(result.notificationType).toBe(NotificationType.WEBHOOK);
    });

    it('should send an in-app notification and log it', async () => {
      const options = {
        userId: 'test-user-id',
        title: 'Test Notification',
        message: 'This is a test notification',
        type: 'info' as const
      };

      const result = await notificationService.sendInAppNotification(options);

      // Check that notification was created in database
      expect(supabaseClient.getClient().from).toHaveBeenCalledWith('notifications');
      expect(supabaseClient.getClient().from().insert).toHaveBeenCalledWith([
        expect.objectContaining({
          userId: 'test-user-id',
          title: 'Test Notification',
          message: 'This is a test notification',
          type: 'info'
        })
      ]);
      
      // Check that notification was logged
      expect(supabaseClient.getClient().from).toHaveBeenCalledWith('notification_logs');
      expect(supabaseClient.getClient().from().insert).toHaveBeenCalledWith([
        expect.objectContaining({
          userId: 'test-user-id',
          notificationType: NotificationType.IN_APP,
          content: expect.objectContaining({
            title: 'Test Notification',
            message: 'This is a test notification'
          })
        })
      ]);
      
      // Check result
      expect(result.success).toBe(true);
      expect(result.notificationType).toBe(NotificationType.IN_APP);
    });
  });

  describe('Event-based notification flow', () => {
    it('should process an event and send notifications', async () => {
      // Mock notification rules
      const mockRules = [
        {
          id: 'rule-1',
          eventType: EventType.USER_REGISTERED,
          channels: [NotificationType.EMAIL, NotificationType.IN_APP],
          enabled: true,
          templateId: 'template-1',
          priority: 'high'
        }
      ];
      
      // Set up rules in the service
      (eventNotificationService as any).rules.set(EventType.USER_REGISTERED, mockRules);
      
      // Mock template rendering to return JSON
      (templateService.renderTemplate as jest.Mock).mockResolvedValueOnce(JSON.stringify({
        to: 'test@example.com',
        subject: 'Welcome to our platform',
        text: 'Thank you for registering',
        html: '<p>Thank you for registering</p>',
        title: 'Welcome',
        message: 'Thank you for joining our platform'
      }));
      
      // Create event data
      const event = {
        eventType: EventType.USER_REGISTERED,
        userId: 'test-user-id',
        data: {
          name: 'Test User',
          email: 'test@example.com'
        }
      };
      
      // Process the event
      const result = await eventNotificationService.processEvent(event);
      
      // Check that event was logged
      expect(supabaseClient.getClient().from).toHaveBeenCalledWith('event_logs');
      expect(supabaseClient.getClient().from().insert).toHaveBeenCalledWith([
        expect.objectContaining({
          eventType: EventType.USER_REGISTERED,
          userId: 'test-user-id',
          data: event.data
        })
      ]);
      
      // Check that template was rendered
      expect(templateService.renderTemplate).toHaveBeenCalledWith({
        templateId: 'template-1',
        data: expect.objectContaining({
          name: 'Test User',
          email: 'test@example.com',
          eventType: EventType.USER_REGISTERED,
          userId: 'test-user-id'
        })
      });
      
      // Check that notifications were sent
      expect(emailProvider.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@example.com',
          subject: 'Welcome to our platform',
          text: 'Thank you for registering',
          html: '<p>Thank you for registering</p>',
          userId: 'test-user-id',
          eventType: EventType.USER_REGISTERED
        })
      );
      
      expect(supabaseClient.getClient().from).toHaveBeenCalledWith('notifications');
      expect(supabaseClient.getClient().from().insert).toHaveBeenCalledWith([
        expect.objectContaining({
          userId: 'test-user-id',
          title: 'Welcome',
          message: 'Thank you for joining our platform'
        })
      ]);
      
      // Check result
      expect(result).toBe(true);
    });

    it('should respect user preferences when processing events', async () => {
      // Mock notification rules
      const mockRules = [
        {
          id: 'rule-1',
          eventType: EventType.SUBSCRIPTION_PAYMENT_FAILED,
          channels: [NotificationType.EMAIL, NotificationType.SMS],
          enabled: true,
          templateName: 'payment-failed'
        }
      ];
      
      // Set up rules in the service
      (eventNotificationService as any).rules.set(EventType.SUBSCRIPTION_PAYMENT_FAILED, mockRules);
      
      // Mock user preferences
      (supabaseClient.getClient().from().select().eq().single as jest.Mock).mockResolvedValueOnce({
        data: {
          [`${EventType.SUBSCRIPTION_PAYMENT_FAILED}_${NotificationType.EMAIL}`]: false,
          [`${EventType.SUBSCRIPTION_PAYMENT_FAILED}_${NotificationType.SMS}`]: true
        },
        error: null
      });
      
      // Mock template rendering
      (templateService.renderTemplate as jest.Mock).mockResolvedValueOnce(JSON.stringify({
        to: 'test@example.com',
        subject: 'Payment Failed',
        text: 'Your payment has failed',
        message: 'Your subscription payment has failed'
      }));
      
      // Create event data
      const event = {
        eventType: EventType.SUBSCRIPTION_PAYMENT_FAILED,
        userId: 'test-user-id',
        data: {
          subscriptionId: 'sub-123',
          failureReason: 'insufficient_funds'
        }
      };
      
      // Process the event
      const result = await eventNotificationService.processEvent(event);
      
      // Check that event was logged
      expect(supabaseClient.getClient().from).toHaveBeenCalledWith('event_logs');
      
      // Check that user preferences were checked
      expect(supabaseClient.getClient().from).toHaveBeenCalledWith('user_notification_preferences');
      
      // Check that template was rendered
      expect(templateService.renderTemplate).toHaveBeenCalledWith({
        templateName: 'payment-failed',
        data: expect.objectContaining({
          subscriptionId: 'sub-123',
          failureReason: 'insufficient_funds',
          eventType: EventType.SUBSCRIPTION_PAYMENT_FAILED,
          userId: 'test-user-id'
        })
      });
      
      // Check that only SMS was sent (email was disabled in preferences)
      expect(emailProvider.sendEmail).not.toHaveBeenCalled();
      expect(smsProvider.sendSMS).toHaveBeenCalledWith(
        expect.objectContaining({
          to: expect.any(String),
          message: 'Your subscription payment has failed',
          userId: 'test-user-id',
          eventType: EventType.SUBSCRIPTION_PAYMENT_FAILED
        })
      );
      
      // Check result
      expect(result).toBe(true);
    });
  });

  describe('User notification preferences', () => {
    it('should get user notification preferences', async () => {
      const userId = 'test-user-id';
      const mockPreferences = {
        email_enabled: true,
        sms_enabled: true,
        push_enabled: false,
        in_app_enabled: true
      };
      
      (supabaseClient.getClient().from().select().eq().single as jest.Mock).mockResolvedValueOnce({
        data: mockPreferences,
        error: null
      });
      
      const preferences = await notificationService.getUserNotificationPreferences(userId);
      
      expect(supabaseClient.getClient().from).toHaveBeenCalledWith('user_notification_preferences');
      expect(supabaseClient.getClient().from().select).toHaveBeenCalledWith('*');
      expect(supabaseClient.getClient().from().select().eq).toHaveBeenCalledWith('userId', userId);
      expect(preferences).toEqual(mockPreferences);
    });

    it('should update user notification preferences', async () => {
      const userId = 'test-user-id';
      const preferences = {
        email_enabled: true,
        sms_enabled: false,
        push_enabled: true,
        in_app_enabled: true
      };
      
      const success = await notificationService.updateUserNotificationPreferences(userId, preferences);
      
      expect(supabaseClient.getClient().from).toHaveBeenCalledWith('user_notification_preferences');
      expect(supabaseClient.getClient().from().upsert).toHaveBeenCalledWith([
        expect.objectContaining({
          userId,
          ...preferences,
          updatedAt: expect.any(Date)
        })
      ]);
      expect(success).toBe(true);
    });
  });
});
