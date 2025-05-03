/**
 * Tests for Property Template Routes
 */

import request from 'supertest';
import express from 'express';
import propertyTemplateRoutes from '../../routes/propertyTemplate.routes';
import { authenticate } from '../../middleware/auth';
import { validateRequest } from '../../middleware/validation';
import * as propertyTemplateController from '../../controllers/propertyTemplate.controller';

// Mock dependencies
jest.mock('../../middleware/auth', () => ({
  authenticate: jest.fn((req, res, next) => {
    req.user = { id: 'test-user-id' };
    next();
  })
}));

jest.mock('../../middleware/validation', () => ({
  validateRequest: jest.fn(() => (req, res, next) => next())
}));

jest.mock('../../controllers/propertyTemplate.controller', () => ({
  createPropertyTemplateHandler: jest.fn(),
  getPropertyTemplateHandler: jest.fn(),
  updatePropertyTemplateHandler: jest.fn(),
  deletePropertyTemplateHandler: jest.fn(),
  getPropertyTemplatesHandler: jest.fn(),
  applyPropertyTemplateHandler: jest.fn()
}));

// Create express app for testing
const app = express();
app.use(express.json());
app.use('/api/property-templates', propertyTemplateRoutes);

describe('Property Template Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/property-templates', () => {
    it('should call createPropertyTemplateHandler', async () => {
      // Arrange
      const templateData = {
        name: 'Test Template',
        materialType: 'tile',
        properties: {
          finish: 'matte'
        }
      };

      (propertyTemplateController.createPropertyTemplateHandler as jest.Mock).mockImplementation((req, res) => {
        res.status(201).json({
          success: true,
          data: {
            id: 'template-123',
            ...templateData,
            createdBy: req.user.id,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
      });

      // Act
      const response = await request(app)
        .post('/api/property-templates')
        .send(templateData);

      // Assert
      expect(authenticate).toHaveBeenCalled();
      expect(validateRequest).toHaveBeenCalled();
      expect(propertyTemplateController.createPropertyTemplateHandler).toHaveBeenCalled();
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Test Template');
    });
  });

  describe('GET /api/property-templates/:id', () => {
    it('should call getPropertyTemplateHandler', async () => {
      // Arrange
      const templateId = 'template-123';
      const template = {
        id: templateId,
        name: 'Test Template',
        materialType: 'tile',
        properties: {
          finish: 'matte'
        },
        createdBy: 'test-user-id',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      (propertyTemplateController.getPropertyTemplateHandler as jest.Mock).mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: template
        });
      });

      // Act
      const response = await request(app)
        .get(`/api/property-templates/${templateId}`);

      // Assert
      expect(authenticate).toHaveBeenCalled();
      expect(propertyTemplateController.getPropertyTemplateHandler).toHaveBeenCalled();
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(templateId);
    });
  });

  describe('PUT /api/property-templates/:id', () => {
    it('should call updatePropertyTemplateHandler', async () => {
      // Arrange
      const templateId = 'template-123';
      const updateData = {
        name: 'Updated Template',
        properties: {
          finish: 'polished'
        }
      };

      (propertyTemplateController.updatePropertyTemplateHandler as jest.Mock).mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: {
            id: templateId,
            ...updateData,
            materialType: 'tile',
            createdBy: 'test-user-id',
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
      });

      // Act
      const response = await request(app)
        .put(`/api/property-templates/${templateId}`)
        .send(updateData);

      // Assert
      expect(authenticate).toHaveBeenCalled();
      expect(validateRequest).toHaveBeenCalled();
      expect(propertyTemplateController.updatePropertyTemplateHandler).toHaveBeenCalled();
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Template');
    });
  });

  describe('DELETE /api/property-templates/:id', () => {
    it('should call deletePropertyTemplateHandler', async () => {
      // Arrange
      const templateId = 'template-123';

      (propertyTemplateController.deletePropertyTemplateHandler as jest.Mock).mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: {
            id: templateId,
            name: 'Test Template',
            materialType: 'tile',
            properties: {
              finish: 'matte'
            },
            createdBy: 'test-user-id',
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
      });

      // Act
      const response = await request(app)
        .delete(`/api/property-templates/${templateId}`);

      // Assert
      expect(authenticate).toHaveBeenCalled();
      expect(propertyTemplateController.deletePropertyTemplateHandler).toHaveBeenCalled();
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(templateId);
    });
  });

  describe('GET /api/property-templates', () => {
    it('should call getPropertyTemplatesHandler', async () => {
      // Arrange
      const templates = [
        {
          id: 'template-1',
          name: 'Tile Template',
          materialType: 'tile',
          properties: {},
          createdBy: 'test-user-id',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'template-2',
          name: 'Stone Template',
          materialType: 'stone',
          properties: {},
          createdBy: 'test-user-id',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      (propertyTemplateController.getPropertyTemplatesHandler as jest.Mock).mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: templates,
          meta: {
            total: 2,
            limit: 10,
            skip: 0
          }
        });
      });

      // Act
      const response = await request(app)
        .get('/api/property-templates')
        .query({
          materialType: 'tile',
          limit: '10',
          skip: '0',
          sort: 'priority:-1,name:1'
        });

      // Assert
      expect(authenticate).toHaveBeenCalled();
      expect(propertyTemplateController.getPropertyTemplatesHandler).toHaveBeenCalled();
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.meta.total).toBe(2);
    });
  });

  describe('POST /api/property-templates/:id/apply', () => {
    it('should call applyPropertyTemplateHandler', async () => {
      // Arrange
      const templateId = 'template-123';
      const material = {
        id: 'material-123',
        name: 'Test Material',
        materialType: 'tile'
      };
      const options = {
        applyDefaults: true,
        overrideExisting: false
      };

      (propertyTemplateController.applyPropertyTemplateHandler as jest.Mock).mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: {
            ...material,
            finish: 'matte'
          }
        });
      });

      // Act
      const response = await request(app)
        .post(`/api/property-templates/${templateId}/apply`)
        .send({
          material,
          options
        });

      // Assert
      expect(authenticate).toHaveBeenCalled();
      expect(validateRequest).toHaveBeenCalled();
      expect(propertyTemplateController.applyPropertyTemplateHandler).toHaveBeenCalled();
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.finish).toBe('matte');
    });
  });
});
