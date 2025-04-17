import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { authenticator } from 'otplib';
import twoFactorController from '../../controllers/auth/twoFactor.controller';
import { asyncHandler } from '../../middleware/error.middleware';

// Mock dependencies
jest.mock('../../services/supabase/supabaseClient', () => ({
  getClient: jest.fn().mockReturnValue({
    auth: {
      admin: {
        getUserById: jest.fn().mockResolvedValue({
          data: {
            id: 'test-user-id',
            email: 'test@example.com'
          },
          error: null
        })
      }
    }
  })
}));

jest.mock('../../models/twoFactorAuth.model', () => ({
  getUserTwoFactorSettings: jest.fn().mockResolvedValue(null),
  createTwoFactorSettings: jest.fn().mockResolvedValue({
    id: 'test-2fa-id',
    userId: 'test-user-id',
    method: 'totp',
    isEnabled: false,
    secret: 'test-secret',
    createdAt: new Date(),
    updatedAt: new Date()
  }),
  updateTwoFactorSettings: jest.fn().mockResolvedValue({
    id: 'test-2fa-id',
    userId: 'test-user-id',
    method: 'totp',
    isEnabled: true,
    secret: 'test-secret',
    createdAt: new Date(),
    updatedAt: new Date()
  }),
  generateBackupCodes: jest.fn().mockResolvedValue(['code1', 'code2', 'code3']),
  getBackupCodes: jest.fn().mockResolvedValue(['code1', 'code2', 'code3']),
  verifyTOTP: jest.fn().mockResolvedValue(true)
}));

jest.mock('otplib', () => ({
  authenticator: {
    generateSecret: jest.fn().mockReturnValue('test-secret'),
    keyuri: jest.fn().mockReturnValue('otpauth://totp/test@example.com?secret=test-secret&issuer=KAI')
  }
}));

jest.mock('../../services/sms/sms.service', () => ({
  sendSMS: jest.fn().mockResolvedValue(true)
}));

jest.mock('../../services/email/email.service', () => ({
  sendEmail: jest.fn().mockResolvedValue(true)
}));

// Setup Express app for testing
const app = express();
app.use(express.json());

// Mock auth middleware
app.use((req, res, next) => {
  req.user = { id: 'test-user-id', email: 'test@example.com' };
  next();
});

// Routes
app.get('/api/auth/2fa/methods', asyncHandler(twoFactorController.getAvailableMethods));
app.get('/api/auth/2fa/status', asyncHandler(twoFactorController.getTwoFactorStatus));
app.post('/api/auth/2fa/setup/totp', asyncHandler(twoFactorController.setupTOTP));
app.post('/api/auth/2fa/verify', asyncHandler(twoFactorController.verifyTwoFactor));
app.post('/api/auth/2fa/enable', asyncHandler(twoFactorController.enableTwoFactor));
app.get('/api/auth/2fa/backup-codes', asyncHandler(twoFactorController.getBackupCodes));

describe('Two-Factor Authentication Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/auth/2fa/methods', () => {
    it('should return available 2FA methods', async () => {
      const response = await request(app).get('/api/auth/2fa/methods');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.methods).toContain('totp');
    });
  });

  describe('GET /api/auth/2fa/status', () => {
    it('should return 2FA status', async () => {
      const response = await request(app).get('/api/auth/2fa/status');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('isEnabled');
    });
  });

  describe('POST /api/auth/2fa/setup/totp', () => {
    it('should setup TOTP authentication', async () => {
      const response = await request(app).post('/api/auth/2fa/setup/totp');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('secret');
      expect(response.body.data).toHaveProperty('qrCodeUrl');
    });
  });

  describe('POST /api/auth/2fa/verify', () => {
    it('should verify TOTP code', async () => {
      const response = await request(app)
        .post('/api/auth/2fa/verify')
        .send({ method: 'totp', code: '123456' });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return error for invalid code', async () => {
      // Mock verification to fail
      require('../../models/twoFactorAuth.model').verifyTOTP.mockResolvedValueOnce(false);
      
      const response = await request(app)
        .post('/api/auth/2fa/verify')
        .send({ method: 'totp', code: 'invalid' });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/2fa/enable', () => {
    it('should enable 2FA', async () => {
      const response = await request(app)
        .post('/api/auth/2fa/enable')
        .send({ method: 'totp' });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.isEnabled).toBe(true);
    });
  });

  describe('GET /api/auth/2fa/backup-codes', () => {
    it('should return backup codes', async () => {
      const response = await request(app).get('/api/auth/2fa/backup-codes');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.codes).toHaveLength(3);
      expect(response.body.data.codes).toContain('code1');
    });
  });
});
