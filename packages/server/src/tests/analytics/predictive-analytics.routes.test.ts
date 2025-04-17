/**
 * Tests for the Predictive Analytics Routes
 */

import request from 'supertest';
import express from 'express';
import { json } from 'body-parser';
import predictiveAnalyticsRoutes from '../../routes/predictive-analytics.routes';
import predictiveAnalyticsController from '../../controllers/predictive-analytics.controller';
import { authMiddleware, tokenRefreshMiddleware, rateLimitMiddleware, authorizeRoles } from '../../middleware/auth.middleware';

// Mock dependencies
jest.mock('../../controllers/predictive-analytics.controller', () => ({
  generateForecast: jest.fn(),
  detectAnomalies: jest.fn(),
  predictUserBehavior: jest.fn()
}));

jest.mock('../../middleware/auth.middleware', () => ({
  authMiddleware: jest.fn((req, res, next) => {
    req.user = { id: 'user-123', role: 'admin' };
    next();
  }),
  tokenRefreshMiddleware: jest.fn((req, res, next) => next()),
  rateLimitMiddleware: jest.fn(() => (req, res, next) => next()),
  authorizeRoles: jest.fn(() => (req, res, next) => next())
}));

jest.mock('../../middleware/error.middleware', () => ({
  asyncHandler: (fn) => (req, res, next) => fn(req, res, next).catch(next)
}));

describe('Predictive Analytics Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create Express app
    app = express();
    app.use(json());
    app.use('/api/analytics', predictiveAnalyticsRoutes);
    
    // Mock controller responses
    (predictiveAnalyticsController.generateForecast as jest.Mock).mockImplementation((req, res) => {
      res.status(200).json({
        success: true,
        data: {
          id: 'forecast-123',
          historical: [],
          forecast: [],
          parameters: req.body,
          modelInfo: { name: 'TestModel', version: '1.0' }
        }
      });
    });
    
    (predictiveAnalyticsController.detectAnomalies as jest.Mock).mockImplementation((req, res) => {
      res.status(200).json({
        success: true,
        data: {
          id: 'anomaly-123',
          timeSeries: [],
          anomalies: [],
          statistics: { mean: 10, stdDev: 2, threshold: 2 },
          parameters: req.body
        }
      });
    });
    
    (predictiveAnalyticsController.predictUserBehavior as jest.Mock).mockImplementation((req, res) => {
      res.status(200).json({
        success: true,
        data: {
          id: 'prediction-123',
          userId: req.body.userId,
          predictionType: req.body.predictionType,
          predictions: [],
          userInsights: { activityLevel: 'medium', interests: [], patterns: [] },
          modelInfo: { name: 'TestModel', version: '1.0' }
        }
      });
    });
  });

  describe('POST /api/analytics/predictive/forecast', () => {
    it('should call the generateForecast controller', async () => {
      const response = await request(app)
        .post('/api/analytics/predictive/forecast')
        .send({
          eventType: 'search',
          resourceType: 'material',
          startDate: '2023-01-01T00:00:00Z',
          endDate: '2023-01-10T00:00:00Z',
          forecastPeriods: 5,
          interval: 'day'
        });
      
      // Verify response
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('forecast-123');
      
      // Verify middleware was used
      expect(authMiddleware).toHaveBeenCalled();
      expect(tokenRefreshMiddleware).toHaveBeenCalled();
      expect(rateLimitMiddleware).toHaveBeenCalled();
      
      // Verify controller was called
      expect(predictiveAnalyticsController.generateForecast).toHaveBeenCalled();
    });
  });

  describe('POST /api/analytics/predictive/anomalies', () => {
    it('should call the detectAnomalies controller', async () => {
      const response = await request(app)
        .post('/api/analytics/predictive/anomalies')
        .send({
          eventType: 'search',
          resourceType: 'material',
          startDate: '2023-01-01T00:00:00Z',
          endDate: '2023-01-10T00:00:00Z',
          interval: 'day',
          threshold: 2.5
        });
      
      // Verify response
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('anomaly-123');
      
      // Verify middleware was used
      expect(authMiddleware).toHaveBeenCalled();
      expect(tokenRefreshMiddleware).toHaveBeenCalled();
      expect(rateLimitMiddleware).toHaveBeenCalled();
      
      // Verify controller was called
      expect(predictiveAnalyticsController.detectAnomalies).toHaveBeenCalled();
    });
  });

  describe('POST /api/analytics/predictive/user-behavior', () => {
    it('should call the predictUserBehavior controller', async () => {
      const response = await request(app)
        .post('/api/analytics/predictive/user-behavior')
        .send({
          userId: 'target-user-123',
          predictionType: 'next_action',
          lookbackDays: 30,
          includeUserProfile: true
        });
      
      // Verify response
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('prediction-123');
      expect(response.body.data.userId).toBe('target-user-123');
      
      // Verify middleware was used
      expect(authMiddleware).toHaveBeenCalled();
      expect(tokenRefreshMiddleware).toHaveBeenCalled();
      expect(rateLimitMiddleware).toHaveBeenCalled();
      expect(authorizeRoles).toHaveBeenCalled();
      
      // Verify controller was called
      expect(predictiveAnalyticsController.predictUserBehavior).toHaveBeenCalled();
    });
  });
});
