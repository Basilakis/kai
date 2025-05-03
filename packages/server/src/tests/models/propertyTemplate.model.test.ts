/**
 * Tests for Property Template Model
 */

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import PropertyTemplate, {
  PropertyTemplateDocument,
  createPropertyTemplate,
  getPropertyTemplateById,
  updatePropertyTemplate,
  deletePropertyTemplate,
  getPropertyTemplates,
  getPropertyTemplatesForMaterial
} from '../../models/propertyTemplate.model';

// Setup in-memory MongoDB server
let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

// Clear database between tests
beforeEach(async () => {
  await PropertyTemplate.deleteMany({});
});

describe('Property Template Model', () => {
  describe('createPropertyTemplate', () => {
    it('should create a new property template', async () => {
      // Arrange
      const templateData = {
        name: 'Test Template',
        description: 'Test Description',
        materialType: 'tile',
        isActive: true,
        priority: 10,
        properties: {
          finish: 'matte',
          waterAbsorption: 0.5
        },
        overrideRules: [
          {
            field: 'finish',
            condition: 'materialType=porcelain',
            value: 'polished'
          }
        ],
        createdBy: 'test-user'
      };

      // Act
      const template = await createPropertyTemplate(templateData);

      // Assert
      expect(template).toBeDefined();
      expect(template.id).toBeDefined();
      expect(template.name).toBe('Test Template');
      expect(template.description).toBe('Test Description');
      expect(template.materialType).toBe('tile');
      expect(template.isActive).toBe(true);
      expect(template.priority).toBe(10);
      expect(template.properties).toEqual({
        finish: 'matte',
        waterAbsorption: 0.5
      });
      expect(template.overrideRules).toHaveLength(1);
      expect(template.overrideRules[0].field).toBe('finish');
      expect(template.createdBy).toBe('test-user');
      expect(template.createdAt).toBeInstanceOf(Date);
      expect(template.updatedAt).toBeInstanceOf(Date);
    });

    it('should throw an error if required fields are missing', async () => {
      // Arrange
      const templateData = {
        description: 'Test Description',
        materialType: 'tile',
        isActive: true,
        priority: 10,
        properties: {},
        createdBy: 'test-user'
      };

      // Act & Assert
      await expect(createPropertyTemplate(templateData as any)).rejects.toThrow();
    });
  });

  describe('getPropertyTemplateById', () => {
    it('should get a property template by ID', async () => {
      // Arrange
      const templateData = {
        name: 'Test Template',
        properties: {},
        createdBy: 'test-user'
      };
      const createdTemplate = await createPropertyTemplate(templateData);

      // Act
      const template = await getPropertyTemplateById(createdTemplate.id);

      // Assert
      expect(template).toBeDefined();
      expect(template?.id).toBe(createdTemplate.id);
      expect(template?.name).toBe('Test Template');
    });

    it('should return null if template does not exist', async () => {
      // Act
      const template = await getPropertyTemplateById('non-existent-id');

      // Assert
      expect(template).toBeNull();
    });
  });

  describe('updatePropertyTemplate', () => {
    it('should update a property template', async () => {
      // Arrange
      const templateData = {
        name: 'Test Template',
        properties: {},
        createdBy: 'test-user'
      };
      const createdTemplate = await createPropertyTemplate(templateData);

      // Act
      const updatedTemplate = await updatePropertyTemplate(createdTemplate.id, {
        name: 'Updated Template',
        description: 'Updated Description',
        priority: 20
      });

      // Assert
      expect(updatedTemplate).toBeDefined();
      expect(updatedTemplate?.id).toBe(createdTemplate.id);
      expect(updatedTemplate?.name).toBe('Updated Template');
      expect(updatedTemplate?.description).toBe('Updated Description');
      expect(updatedTemplate?.priority).toBe(20);
    });

    it('should return null if template does not exist', async () => {
      // Act
      const updatedTemplate = await updatePropertyTemplate('non-existent-id', {
        name: 'Updated Template'
      });

      // Assert
      expect(updatedTemplate).toBeNull();
    });
  });

  describe('deletePropertyTemplate', () => {
    it('should delete a property template', async () => {
      // Arrange
      const templateData = {
        name: 'Test Template',
        properties: {},
        createdBy: 'test-user'
      };
      const createdTemplate = await createPropertyTemplate(templateData);

      // Act
      const deletedTemplate = await deletePropertyTemplate(createdTemplate.id);
      const template = await getPropertyTemplateById(createdTemplate.id);

      // Assert
      expect(deletedTemplate).toBeDefined();
      expect(deletedTemplate?.id).toBe(createdTemplate.id);
      expect(template).toBeNull();
    });

    it('should return null if template does not exist', async () => {
      // Act
      const deletedTemplate = await deletePropertyTemplate('non-existent-id');

      // Assert
      expect(deletedTemplate).toBeNull();
    });
  });

  describe('getPropertyTemplates', () => {
    it('should get property templates with filters', async () => {
      // Arrange
      await createPropertyTemplate({
        name: 'Tile Template',
        materialType: 'tile',
        priority: 10,
        properties: {},
        createdBy: 'test-user'
      });
      await createPropertyTemplate({
        name: 'Stone Template',
        materialType: 'stone',
        priority: 20,
        properties: {},
        createdBy: 'test-user'
      });
      await createPropertyTemplate({
        name: 'Inactive Template',
        materialType: 'tile',
        isActive: false,
        priority: 30,
        properties: {},
        createdBy: 'test-user'
      });

      // Act
      const result = await getPropertyTemplates({
        materialType: 'tile',
        isActive: true
      });

      // Assert
      expect(result.templates).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.templates[0].name).toBe('Tile Template');
    });

    it('should sort templates by priority', async () => {
      // Arrange
      await createPropertyTemplate({
        name: 'Low Priority',
        priority: 10,
        properties: {},
        createdBy: 'test-user'
      });
      await createPropertyTemplate({
        name: 'High Priority',
        priority: 30,
        properties: {},
        createdBy: 'test-user'
      });
      await createPropertyTemplate({
        name: 'Medium Priority',
        priority: 20,
        properties: {},
        createdBy: 'test-user'
      });

      // Act
      const result = await getPropertyTemplates({
        sort: { priority: -1 }
      });

      // Assert
      expect(result.templates).toHaveLength(3);
      expect(result.templates[0].name).toBe('High Priority');
      expect(result.templates[1].name).toBe('Medium Priority');
      expect(result.templates[2].name).toBe('Low Priority');
    });
  });

  describe('getPropertyTemplatesForMaterial', () => {
    it('should get templates for a material type', async () => {
      // Arrange
      await createPropertyTemplate({
        name: 'Tile Template',
        materialType: 'tile',
        priority: 10,
        properties: {},
        createdBy: 'test-user'
      });
      await createPropertyTemplate({
        name: 'Stone Template',
        materialType: 'stone',
        priority: 20,
        properties: {},
        createdBy: 'test-user'
      });
      await createPropertyTemplate({
        name: 'Generic Template',
        priority: 30,
        properties: {},
        createdBy: 'test-user'
      });

      // Act
      const templates = await getPropertyTemplatesForMaterial('tile');

      // Assert
      expect(templates).toHaveLength(2);
      expect(templates.some(t => t.name === 'Tile Template')).toBe(true);
      expect(templates.some(t => t.name === 'Generic Template')).toBe(true);
    });

    it('should get templates for a material type and category', async () => {
      // Arrange
      const categoryId = 'category-123';
      await createPropertyTemplate({
        name: 'Tile Template',
        materialType: 'tile',
        priority: 10,
        properties: {},
        createdBy: 'test-user'
      });
      await createPropertyTemplate({
        name: 'Category Template',
        categoryId,
        priority: 20,
        properties: {},
        createdBy: 'test-user'
      });
      await createPropertyTemplate({
        name: 'Tile Category Template',
        materialType: 'tile',
        categoryId,
        priority: 30,
        properties: {},
        createdBy: 'test-user'
      });

      // Act
      const templates = await getPropertyTemplatesForMaterial('tile', categoryId);

      // Assert
      expect(templates).toHaveLength(3);
      expect(templates.some(t => t.name === 'Tile Template')).toBe(true);
      expect(templates.some(t => t.name === 'Category Template')).toBe(true);
      expect(templates.some(t => t.name === 'Tile Category Template')).toBe(true);
    });
  });
});
