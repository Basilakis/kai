/**
 * Unit Tests for Webhook Provider
 * 
 * These tests verify the functionality of the webhook provider
 * and its ability to send webhook notifications to external systems.
 */

import { webhookProvider } from '../../../services/messaging/providers/webhookProvider';
import axios from 'axios';

// Mock axios
jest.mock('axios', () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue({
    status: 200,
    data: { success: true }
  }),
  head: jest.fn().mockResolvedValue({
    status: 200
  })
}));

// Mock crypto for signature generation
jest.mock('crypto', () => ({
  createHmac: jest.fn().mockReturnValue({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn().mockReturnValue('mock-signature')
  })
}));

// Mock environment variables
const originalEnv = process.env;

describe('Webhook Provider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('initialization', () => {
    it('should initialize with default configuration', () => {
      // Re-initialize the provider with default env vars
      jest.isolateModules(() => {
        require('../../../services/messaging/providers/webhookProvider');
      });

      // Default config should be used
      expect(webhookProvider['config']).toEqual({
        defaultTimeout: 5000,
        maxRetries: 3,
        retryDelay: 1000,
        defaultHeaders: {
          'Content-Type': 'application/json',
          'User-Agent': 'KAI-Webhook-Service/1.0'
        }
      });
    });

    it('should initialize with custom configuration from environment variables', () => {
      process.env.WEBHOOK_TIMEOUT = '10000';
      process.env.WEBHOOK_MAX_RETRIES = '5';
      process.env.WEBHOOK_RETRY_DELAY = '2000';

      // Re-initialize the provider with new env vars
      jest.isolateModules(() => {
        require('../../../services/messaging/providers/webhookProvider');
      });

      // Custom config should be used
      expect(webhookProvider['config']).toEqual({
        defaultTimeout: 10000,
        maxRetries: 5,
        retryDelay: 2000,
        defaultHeaders: {
          'Content-Type': 'application/json',
          'User-Agent': 'KAI-Webhook-Service/1.0'
        }
      });
    });
  });

  describe('sendWebhook', () => {
    it('should send a POST webhook successfully', async () => {
      const options = {
        url: 'https://example.com/webhook',
        payload: { event: 'test', data: { foo: 'bar' } }
      };

      const result = await webhookProvider.sendWebhook(options);

      expect(axios).toHaveBeenCalledWith({
        method: 'POST',
        url: 'https://example.com/webhook',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'KAI-Webhook-Service/1.0'
        },
        data: { event: 'test', data: { foo: 'bar' } },
        timeout: 5000
      });

      expect(result).toEqual({
        status: 200,
        data: { success: true }
      });
    });

    it('should send a GET webhook successfully', async () => {
      const options = {
        url: 'https://example.com/webhook',
        method: 'GET',
        payload: { event: 'test', data: { foo: 'bar' } }
      };

      const result = await webhookProvider.sendWebhook(options);

      expect(axios).toHaveBeenCalledWith({
        method: 'GET',
        url: 'https://example.com/webhook',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'KAI-Webhook-Service/1.0'
        },
        params: { event: 'test', data: { foo: 'bar' } },
        timeout: 5000
      });

      expect(result).toEqual({
        status: 200,
        data: { success: true }
      });
    });

    it('should send a webhook with custom headers', async () => {
      const options = {
        url: 'https://example.com/webhook',
        headers: {
          'X-Custom-Header': 'custom-value',
          'Authorization': 'Bearer token'
        },
        payload: { event: 'test', data: { foo: 'bar' } }
      };

      const result = await webhookProvider.sendWebhook(options);

      expect(axios).toHaveBeenCalledWith({
        method: 'POST',
        url: 'https://example.com/webhook',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'KAI-Webhook-Service/1.0',
          'X-Custom-Header': 'custom-value',
          'Authorization': 'Bearer token'
        },
        data: { event: 'test', data: { foo: 'bar' } },
        timeout: 5000
      });

      expect(result).toEqual({
        status: 200,
        data: { success: true }
      });
    });

    it('should retry on failure', async () => {
      const error = new Error('Request failed');
      (axios as jest.Mock)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({
          status: 200,
          data: { success: true }
        });

      const options = {
        url: 'https://example.com/webhook',
        payload: { event: 'test', data: { foo: 'bar' } },
        retryCount: 1
      };

      const result = await webhookProvider.sendWebhook(options);

      expect(axios).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        status: 200,
        data: { success: true }
      });
    });

    it('should throw an error after all retries fail', async () => {
      const error = new Error('Request failed');
      (axios as jest.Mock).mockRejectedValue(error);

      const options = {
        url: 'https://example.com/webhook',
        payload: { event: 'test', data: { foo: 'bar' } },
        retryCount: 2
      };

      await expect(webhookProvider.sendWebhook(options)).rejects.toThrow('Request failed');
      expect(axios).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  describe('validateWebhookUrl', () => {
    it('should validate a webhook URL successfully', async () => {
      const url = 'https://example.com/webhook';

      const result = await webhookProvider.validateWebhookUrl(url);

      expect(axios.head).toHaveBeenCalledWith(url, { timeout: 5000 });
      expect(result).toBe(true);
    });

    it('should return false if validation fails', async () => {
      const url = 'https://example.com/webhook';
      const error = new Error('Validation failed');
      (axios.head as jest.Mock).mockRejectedValueOnce(error);

      const result = await webhookProvider.validateWebhookUrl(url);

      expect(axios.head).toHaveBeenCalledWith(url, { timeout: 5000 });
      expect(result).toBe(false);
    });
  });

  describe('generateSignature', () => {
    it('should generate a signature for payload verification', () => {
      const payload = { event: 'test', data: { foo: 'bar' } };
      const secret = 'test-secret';

      const signature = webhookProvider.generateSignature(payload, secret);

      expect(require('crypto').createHmac).toHaveBeenCalledWith('sha256', secret);
      expect(require('crypto').createHmac().update).toHaveBeenCalledWith(JSON.stringify(payload));
      expect(require('crypto').createHmac().digest).toHaveBeenCalledWith('hex');
      expect(signature).toBe('mock-signature');
    });
  });
});
