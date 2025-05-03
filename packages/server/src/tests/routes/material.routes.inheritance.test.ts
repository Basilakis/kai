/**
 * Tests for Material Routes with Property Inheritance
 */

import request from 'supertest';
import express from 'express';
import materialRoutes from '../../routes/material.routes';
import { materialService } from '../../services/material/materialService';
import { getMaterialById } from '../../models/material.model';
import { authMiddleware, authorizeRoles } from '../../middleware/auth.middleware';

// Mock dependencies
jest.mock('../../services/material/materialService', () => ({
  materialService: {
    createMaterial: jest.fn(),
    updateMaterial: jest.fn(),
    applyInheritance: jest.fn()
  }
}));

jest.mock('../../models/material.model', () => ({
  getMaterialById: jest.fn(),
  searchMaterials: jest.fn(),
  findSimilarMaterials: jest.fn(),
  deleteMaterial: jest.fn()
}));

jest.mock('../../middleware/auth.middleware', () => ({
  authMiddleware: jest.fn((req, res, next) => {
    req.user = { id: 'test-user-id' };
    next();
  }),
  authorizeRoles: jest.fn(() => (req, res, next) => next()),
  tokenRefreshMiddleware: jest.fn((req, res, next) => next()),
  rateLimitMiddleware: jest.fn((req, res, next) => next())
}));

// Create express app for testing
const app = express();
app.use(express.json());
app.use('/api/materials', materialRoutes);

describe('Material Routes with Property Inheritance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/materials', () => {
    it('should create a material with property inheritance', async () => {
      // Arrange
      const materialData = {
        name: 'Test Material',
        materialType: 'tile'
      };

      const createdMaterial = {
        id: 'material-123',
        ...materialData,
        finish: 'matte', // Inherited property
        waterAbsorption: 0.5, // Inherited property
        type: 'material',
        createdBy: 'test-user-id',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      (materialService.createMaterial as jest.Mock).mockResolvedValue(createdMaterial);

      // Act
      const response = await request(app)
        .post('/api/materials')
        .send(materialData);

      // Assert
      expect(authMiddleware).toHaveBeenCalled();
      expect(authorizeRoles).toHaveBeenCalled();
      expect(materialService.createMaterial).toHaveBeenCalledWith(
        {
          ...materialData,
          createdBy: 'test-user-id'
        },
        {
          applyInheritance: true,
          applyDefaults: true,
          overrideExisting: false
        }
      );
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(createdMaterial);
    });
  });

  describe('PUT /api/materials/:id', () => {
    it('should update a material with property inheritance', async () => {
      // Arrange
      const materialId = 'material-123';
      const updateData = {
        finish: 'polished'
      };

      const currentMaterial = {
        id: materialId,
        name: 'Test Material',
        materialType: 'tile',
        finish: 'matte',
        type: 'material',
        createdBy: 'test-user-id',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const updatedMaterial = {
        ...currentMaterial,
        finish: 'polished',
        waterAbsorption: 0.5, // Inherited property
        updatedAt: new Date()
      };

      (getMaterialById as jest.Mock).mockResolvedValue(currentMaterial);
      (materialService.updateMaterial as jest.Mock).mockResolvedValue(updatedMaterial);

      // Act
      const response = await request(app)
        .put(`/api/materials/${materialId}`)
        .send(updateData);

      // Assert
      expect(authMiddleware).toHaveBeenCalled();
      expect(authorizeRoles).toHaveBeenCalled();
      expect(getMaterialById).toHaveBeenCalledWith(materialId);
      expect(materialService.updateMaterial).toHaveBeenCalledWith(
        materialId,
        {
          ...updateData,
          updatedAt: expect.any(Date)
        },
        {
          applyInheritance: true,
          applyDefaults: true,
          overrideExisting: false
        }
      );
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(updatedMaterial);
    });

    it('should return 404 if material does not exist', async () => {
      // Arrange
      const materialId = 'non-existent-id';
      const updateData = {
        finish: 'polished'
      };

      (getMaterialById as jest.Mock).mockResolvedValue(null);

      // Act
      const response = await request(app)
        .put(`/api/materials/${materialId}`)
        .send(updateData);

      // Assert
      expect(getMaterialById).toHaveBeenCalledWith(materialId);
      expect(materialService.updateMaterial).not.toHaveBeenCalled();
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/materials/:id/apply-inheritance', () => {
    it('should apply property inheritance to a material', async () => {
      // Arrange
      const materialId = 'material-123';
      const options = {
        applyDefaults: true,
        overrideExisting: true
      };

      const currentMaterial = {
        id: materialId,
        name: 'Test Material',
        materialType: 'tile',
        finish: 'matte',
        type: 'material',
        createdBy: 'test-user-id',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const updatedMaterial = {
        ...currentMaterial,
        finish: 'polished', // Inherited property
        waterAbsorption: 0.5, // Inherited property
        updatedAt: new Date()
      };

      (getMaterialById as jest.Mock).mockResolvedValue(currentMaterial);
      (materialService.applyInheritance as jest.Mock).mockResolvedValue(updatedMaterial);

      // Act
      const response = await request(app)
        .post(`/api/materials/${materialId}/apply-inheritance`)
        .send(options);

      // Assert
      expect(authMiddleware).toHaveBeenCalled();
      expect(authorizeRoles).toHaveBeenCalled();
      expect(getMaterialById).toHaveBeenCalledWith(materialId);
      expect(materialService.applyInheritance).toHaveBeenCalledWith(materialId, options);
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(updatedMaterial);
    });

    it('should return 404 if material does not exist', async () => {
      // Arrange
      const materialId = 'non-existent-id';
      const options = {
        applyDefaults: true,
        overrideExisting: true
      };

      (getMaterialById as jest.Mock).mockResolvedValue(null);

      // Act
      const response = await request(app)
        .post(`/api/materials/${materialId}/apply-inheritance`)
        .send(options);

      // Assert
      expect(getMaterialById).toHaveBeenCalledWith(materialId);
      expect(materialService.applyInheritance).not.toHaveBeenCalled();
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });
});
