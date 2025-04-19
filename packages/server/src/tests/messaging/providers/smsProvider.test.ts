/**
 * Unit Tests for SMS Provider
 * 
 * These tests verify the functionality of the SMS provider
 * and its ability to send SMS messages using different SMS services.
 */

import { smsProvider } from '../../../services/messaging/providers/smsProvider';
import twilio from 'twilio';

// Mock twilio
jest.mock('twilio', () => {
  const mockMessages = {
    create: jest.fn().mockResolvedValue({
      sid: 'test-message-sid',
      status: 'sent',
      to: '+1234567890'
    })
  };
  
  const mockAccounts = {
    fetch: jest.fn().mockResolvedValue({
      sid: 'test-account-sid',
      status: 'active'
    })
  };
  
  const mockApi = {
    accounts: jest.fn().mockReturnValue(mockAccounts)
  };
  
  return jest.fn().mockReturnValue({
    messages: mockMessages,
    api: mockApi
  });
});

// Mock environment variables
const originalEnv = process.env;

describe('SMS Provider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('initialization', () => {
    it('should initialize with Twilio configuration', () => {
      process.env.SMS_PROVIDER = 'twilio';
      process.env.TWILIO_ACCOUNT_SID = 'test-account-sid';
      process.env.TWILIO_AUTH_TOKEN = 'test-auth-token';
      process.env.TWILIO_PHONE_NUMBER = '+1987654321';

      // Re-initialize the provider with new env vars
      jest.isolateModules(() => {
        require('../../../services/messaging/providers/smsProvider');
      });

      expect(twilio).toHaveBeenCalledWith('test-account-sid', 'test-auth-token');
    });

    it('should initialize with mock provider if no provider specified', () => {
      process.env.SMS_PROVIDER = 'mock';

      // Re-initialize the provider with new env vars
      jest.isolateModules(() => {
        require('../../../services/messaging/providers/smsProvider');
      });

      expect(twilio).not.toHaveBeenCalled();
    });

    it('should handle initialization errors', () => {
      process.env.SMS_PROVIDER = 'twilio';
      process.env.TWILIO_ACCOUNT_SID = 'test-account-sid';
      process.env.TWILIO_AUTH_TOKEN = 'test-auth-token';

      // Mock twilio to throw an error
      (twilio as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Initialization error');
      });

      // Re-initialize the provider with new env vars
      jest.isolateModules(() => {
        require('../../../services/messaging/providers/smsProvider');
      });

      // Should not throw an error
      expect(twilio).toHaveBeenCalled();
    });
  });

  describe('sendSMS', () => {
    it('should send an SMS successfully with Twilio', async () => {
      process.env.SMS_PROVIDER = 'twilio';
      process.env.TWILIO_ACCOUNT_SID = 'test-account-sid';
      process.env.TWILIO_AUTH_TOKEN = 'test-auth-token';
      process.env.TWILIO_PHONE_NUMBER = '+1987654321';

      // Re-initialize the provider with new env vars
      jest.isolateModules(() => {
        require('../../../services/messaging/providers/smsProvider');
      });

      const options = {
        to: '+1234567890',
        message: 'This is a test SMS'
      };

      const result = await smsProvider.sendSMS(options);

      expect(twilio().messages.create).toHaveBeenCalledWith({
        body: 'This is a test SMS',
        from: '+1987654321',
        to: '+1234567890'
      });

      expect(result).toEqual([{
        sid: 'test-message-sid',
        status: 'sent',
        to: '+1234567890'
      }]);
    });

    it('should send SMS to multiple recipients', async () => {
      process.env.SMS_PROVIDER = 'twilio';
      process.env.TWILIO_ACCOUNT_SID = 'test-account-sid';
      process.env.TWILIO_AUTH_TOKEN = 'test-auth-token';
      process.env.TWILIO_PHONE_NUMBER = '+1987654321';

      // Re-initialize the provider with new env vars
      jest.isolateModules(() => {
        require('../../../services/messaging/providers/smsProvider');
      });

      const options = {
        to: ['+1234567890', '+0987654321'],
        message: 'This is a test SMS'
      };

      const result = await smsProvider.sendSMS(options);

      expect(twilio().messages.create).toHaveBeenCalledTimes(2);
      expect(twilio().messages.create).toHaveBeenCalledWith({
        body: 'This is a test SMS',
        from: '+1987654321',
        to: '+1234567890'
      });
      expect(twilio().messages.create).toHaveBeenCalledWith({
        body: 'This is a test SMS',
        from: '+1987654321',
        to: '+0987654321'
      });

      expect(result).toEqual([
        {
          sid: 'test-message-sid',
          status: 'sent',
          to: '+1234567890'
        },
        {
          sid: 'test-message-sid',
          status: 'sent',
          to: '+1234567890'
        }
      ]);
    });

    it('should use mock provider when configured', async () => {
      process.env.SMS_PROVIDER = 'mock';

      // Re-initialize the provider with new env vars
      jest.isolateModules(() => {
        require('../../../services/messaging/providers/smsProvider');
      });

      const options = {
        to: '+1234567890',
        message: 'This is a test SMS'
      };

      const result = await smsProvider.sendSMS(options);

      expect(twilio().messages.create).not.toHaveBeenCalled();
      expect(result).toEqual([
        {
          messageId: expect.stringMatching(/^mock-\d+$/),
          status: 'sent'
        }
      ]);
    });

    it('should handle errors when sending an SMS', async () => {
      process.env.SMS_PROVIDER = 'twilio';
      process.env.TWILIO_ACCOUNT_SID = 'test-account-sid';
      process.env.TWILIO_AUTH_TOKEN = 'test-auth-token';
      process.env.TWILIO_PHONE_NUMBER = '+1987654321';

      // Re-initialize the provider with new env vars
      jest.isolateModules(() => {
        require('../../../services/messaging/providers/smsProvider');
      });

      const error = new Error('Failed to send SMS');
      (twilio().messages.create as jest.Mock).mockRejectedValueOnce(error);

      const options = {
        to: '+1234567890',
        message: 'This is a test SMS'
      };

      await expect(smsProvider.sendSMS(options)).rejects.toThrow('Failed to send SMS');
      expect(twilio().messages.create).toHaveBeenCalled();
    });

    it('should throw an error if Twilio client is not initialized', async () => {
      process.env.SMS_PROVIDER = 'twilio';
      process.env.TWILIO_ACCOUNT_SID = 'test-account-sid';
      process.env.TWILIO_AUTH_TOKEN = 'test-auth-token';

      // Mock the twilioClient to be null
      Object.defineProperty(smsProvider, 'twilioClient', {
        get: jest.fn().mockReturnValue(null)
      });

      const options = {
        to: '+1234567890',
        message: 'This is a test SMS'
      };

      await expect(smsProvider.sendSMS(options)).rejects.toThrow('Twilio client not initialized');
    });

    it('should throw an error if Twilio phone number is not configured', async () => {
      process.env.SMS_PROVIDER = 'twilio';
      process.env.TWILIO_ACCOUNT_SID = 'test-account-sid';
      process.env.TWILIO_AUTH_TOKEN = 'test-auth-token';
      process.env.TWILIO_PHONE_NUMBER = '';

      // Re-initialize the provider with new env vars
      jest.isolateModules(() => {
        require('../../../services/messaging/providers/smsProvider');
      });

      const options = {
        to: '+1234567890',
        message: 'This is a test SMS'
      };

      await expect(smsProvider.sendSMS(options)).rejects.toThrow('Twilio phone number not configured');
    });
  });

  describe('verifyConfiguration', () => {
    it('should verify Twilio configuration successfully', async () => {
      process.env.SMS_PROVIDER = 'twilio';
      process.env.TWILIO_ACCOUNT_SID = 'test-account-sid';
      process.env.TWILIO_AUTH_TOKEN = 'test-auth-token';

      // Re-initialize the provider with new env vars
      jest.isolateModules(() => {
        require('../../../services/messaging/providers/smsProvider');
      });

      const result = await smsProvider.verifyConfiguration();

      expect(twilio().api.accounts).toHaveBeenCalledWith('test-account-sid');
      expect(twilio().api.accounts().fetch).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should handle errors when verifying Twilio configuration', async () => {
      process.env.SMS_PROVIDER = 'twilio';
      process.env.TWILIO_ACCOUNT_SID = 'test-account-sid';
      process.env.TWILIO_AUTH_TOKEN = 'test-auth-token';

      // Re-initialize the provider with new env vars
      jest.isolateModules(() => {
        require('../../../services/messaging/providers/smsProvider');
      });

      const error = new Error('Verification error');
      (twilio().api.accounts().fetch as jest.Mock).mockRejectedValueOnce(error);

      const result = await smsProvider.verifyConfiguration();

      expect(twilio().api.accounts).toHaveBeenCalledWith('test-account-sid');
      expect(twilio().api.accounts().fetch).toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it('should return false if Twilio client is not initialized', async () => {
      process.env.SMS_PROVIDER = 'twilio';

      // Mock the twilioClient to be null
      Object.defineProperty(smsProvider, 'twilioClient', {
        get: jest.fn().mockReturnValue(null)
      });

      const result = await smsProvider.verifyConfiguration();

      expect(result).toBe(false);
    });

    it('should return true for mock provider', async () => {
      process.env.SMS_PROVIDER = 'mock';

      // Re-initialize the provider with new env vars
      jest.isolateModules(() => {
        require('../../../services/messaging/providers/smsProvider');
      });

      const result = await smsProvider.verifyConfiguration();

      expect(result).toBe(true);
    });
  });
});
