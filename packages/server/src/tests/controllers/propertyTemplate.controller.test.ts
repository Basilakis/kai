/**
 * Tests for Property Template Controller
 */

import { Request, Response } from 'express';
import {
  createPropertyTemplateHandler,
  getPropertyTemplateHandler,
  updatePropertyTemplateHandler,
  deletePropertyTemplateHandler,
  getPropertyTemplatesHandler,
  applyPropertyTemplateHandler
} from '../../controllers/propertyTemplate.controller';
import { propertyInheritanceService } from '../../services/propertyInheritance/propertyInheritanceService';
import PropertyTemplate, {
  PropertyTemplateDocument,
  createPropertyTemplate,
  getPropertyTemplateById,
  updatePropertyTemplate,
  deletePropertyTemplate,
  getPropertyTemplates
} from '../../models/propertyTemplate.model';

// Mock dependencies
jest.mock('../../services/propertyInheritance/propertyInheritanceService', () => ({
  propertyInheritanceService: {
    applyInheritance: jest.fn()
  }
}));

jest.mock('../../models/propertyTemplate.model', () => ({
  createPropertyTemplate: jest.fn(),
  getPropertyTemplateById: jest.fn(),
  updatePropertyTemplate: jest.fn(),
  deletePropertyTemplate: jest.fn(),
  getPropertyTemplates: jest.fn()
}));

describe('Property Template Controller', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let responseObject: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup response mock
    responseObject = {};
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockImplementation(result => {
        responseObject = result;
        return mockResponse;
      })
    };
  });

  describe('createPropertyTemplateHandler', () => {
    it('should create a property template', async () => {
      // Arrange
      const templateData = {
        name: 'Test Template',
        materialType: 'tile',
        properties: {
          finish: 'matte'
        }
      };

      const createdTemplate = {
        id: 'template-123',
        ...templateData,
        createdBy: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockRequest = {
        body: templateData,
        user: { id: 'user-123' }
      };

      (createPropertyTemplate as jest.Mock).mockResolvedValue(createdTemplate);

      // Act
      await createPropertyTemplateHandler(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(createPropertyTemplate).toHaveBeenCalledWith({
        ...templateData,
        createdBy: 'user-123'
      });
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(responseObject).toEqual({
        success: true,
        data: createdTemplate
      });
    });

    it('should handle errors when creating a property template', async () => {
      // Arrange
      mockRequest = {
        body: {},
        user: { id: 'user-123' }
      };

      const error = new Error('Validation error');
      (createPropertyTemplate as jest.Mock).mockRejectedValue(error);

      // Act
      await createPropertyTemplateHandler(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(responseObject).toEqual({
        success: false,
        error: 'Failed to create property template: Validation error'
      });
    });
  });

  describe('getPropertyTemplateHandler', () => {
    it('should get a property template by ID', async () => {
      // Arrange
      const template = {
        id: 'template-123',
        name: 'Test Template',
        materialType: 'tile',
        properties: {
          finish: 'matte'
        },
        createdBy: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockRequest = {
        params: { id: 'template-123' }
      };

      (getPropertyTemplateById as jest.Mock).mockResolvedValue(template);

      // Act
      await getPropertyTemplateHandler(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(getPropertyTemplateById).toHaveBeenCalledWith('template-123');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(responseObject).toEqual({
        success: true,
        data: template
      });
    });

    it('should return 404 if template does not exist', async () => {
      // Arrange
      mockRequest = {
        params: { id: 'non-existent-id' }
      };

      (getPropertyTemplateById as jest.Mock).mockResolvedValue(null);

      // Act
      await getPropertyTemplateHandler(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(getPropertyTemplateById).toHaveBeenCalledWith('non-existent-id');
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(responseObject).toEqual({
        success: false,
        error: 'Property template not found: non-existent-id'
      });
    });
  });

  describe('updatePropertyTemplateHandler', () => {
    it('should update a property template', async () => {
      // Arrange
      const updateData = {
        name: 'Updated Template',
        properties: {
          finish: 'polished'
        }
      };

      const updatedTemplate = {
        id: 'template-123',
        ...updateData,
        materialType: 'tile',
        createdBy: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockRequest = {
        params: { id: 'template-123' },
        body: updateData
      };

      (updatePropertyTemplate as jest.Mock).mockResolvedValue(updatedTemplate);

      // Act
      await updatePropertyTemplateHandler(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(updatePropertyTemplate).toHaveBeenCalledWith('template-123', updateData);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(responseObject).toEqual({
        success: true,
        data: updatedTemplate
      });
    });

    it('should return 404 if template does not exist', async () => {
      // Arrange
      mockRequest = {
        params: { id: 'non-existent-id' },
        body: { name: 'Updated Template' }
      };

      (updatePropertyTemplate as jest.Mock).mockResolvedValue(null);

      // Act
      await updatePropertyTemplateHandler(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(updatePropertyTemplate).toHaveBeenCalledWith('non-existent-id', { name: 'Updated Template' });
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(responseObject).toEqual({
        success: false,
        error: 'Property template not found: non-existent-id'
      });
    });
  });

  describe('deletePropertyTemplateHandler', () => {
    it('should delete a property template', async () => {
      // Arrange
      const deletedTemplate = {
        id: 'template-123',
        name: 'Test Template',
        materialType: 'tile',
        properties: {
          finish: 'matte'
        },
        createdBy: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockRequest = {
        params: { id: 'template-123' }
      };

      (deletePropertyTemplate as jest.Mock).mockResolvedValue(deletedTemplate);

      // Act
      await deletePropertyTemplateHandler(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(deletePropertyTemplate).toHaveBeenCalledWith('template-123');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(responseObject).toEqual({
        success: true,
        data: deletedTemplate
      });
    });

    it('should return 404 if template does not exist', async () => {
      // Arrange
      mockRequest = {
        params: { id: 'non-existent-id' }
      };

      (deletePropertyTemplate as jest.Mock).mockResolvedValue(null);

      // Act
      await deletePropertyTemplateHandler(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(deletePropertyTemplate).toHaveBeenCalledWith('non-existent-id');
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(responseObject).toEqual({
        success: false,
        error: 'Property template not found: non-existent-id'
      });
    });
  });

  describe('getPropertyTemplatesHandler', () => {
    it('should get property templates with filters', async () => {
      // Arrange
      const templates = [
        {
          id: 'template-1',
          name: 'Tile Template',
          materialType: 'tile',
          properties: {},
          createdBy: 'user-123',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'template-2',
          name: 'Stone Template',
          materialType: 'stone',
          properties: {},
          createdBy: 'user-123',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockRequest = {
        query: {
          materialType: 'tile',
          limit: '10',
          skip: '0',
          sort: 'priority:-1,name:1'
        }
      };

      (getPropertyTemplates as jest.Mock).mockResolvedValue({
        templates,
        total: 2
      });

      // Act
      await getPropertyTemplatesHandler(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(getPropertyTemplates).toHaveBeenCalledWith({
        materialType: 'tile',
        limit: 10,
        skip: 0,
        sort: { priority: -1, name: 1 }
      });
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(responseObject).toEqual({
        success: true,
        data: templates,
        meta: {
          total: 2,
          limit: 10,
          skip: 0
        }
      });
    });
  });

  describe('applyPropertyTemplateHandler', () => {
    it('should apply a property template to a material', async () => {
      // Arrange
      const material = {
        id: 'material-123',
        name: 'Test Material',
        materialType: 'tile'
      };

      const options = {
        applyDefaults: true,
        overrideExisting: false
      };

      const template = {
        id: 'template-123',
        name: 'Test Template',
        materialType: 'tile',
        properties: {
          finish: 'matte'
        },
        createdBy: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const materialWithTemplate = {
        ...material,
        finish: 'matte'
      };

      mockRequest = {
        params: { id: 'template-123' },
        body: {
          material,
          options
        }
      };

      (getPropertyTemplateById as jest.Mock).mockResolvedValue(template);
      (propertyInheritanceService.applyInheritance as jest.Mock).mockResolvedValue(materialWithTemplate);

      // Act
      await applyPropertyTemplateHandler(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(getPropertyTemplateById).toHaveBeenCalledWith('template-123');
      expect(propertyInheritanceService.applyInheritance).toHaveBeenCalledWith(material, options);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(responseObject).toEqual({
        success: true,
        data: materialWithTemplate
      });
    });

    it('should return 404 if template does not exist', async () => {
      // Arrange
      mockRequest = {
        params: { id: 'non-existent-id' },
        body: {
          material: {},
          options: {}
        }
      };

      (getPropertyTemplateById as jest.Mock).mockResolvedValue(null);

      // Act
      await applyPropertyTemplateHandler(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(getPropertyTemplateById).toHaveBeenCalledWith('non-existent-id');
      expect(propertyInheritanceService.applyInheritance).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(responseObject).toEqual({
        success: false,
        error: 'Property template not found: non-existent-id'
      });
    });
  });
});
