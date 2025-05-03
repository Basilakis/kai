/**
 * Tests for Property Inheritance Service
 */

import { propertyInheritanceService } from '../../../services/propertyInheritance/propertyInheritanceService';
import PropertyTemplate, {
  PropertyTemplateDocument,
  createPropertyTemplate,
  getPropertyTemplateById,
  getPropertyTemplatesForMaterial
} from '../../../models/propertyTemplate.model';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Material } from '../../../../../shared/src/types/material';

// Mock dependencies
jest.mock('../../../models/propertyTemplate.model', () => {
  const original = jest.requireActual('../../../models/propertyTemplate.model');
  return {
    ...original,
    getPropertyTemplatesForMaterial: jest.fn()
  };
});

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

// Clear mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
});

describe('Property Inheritance Service', () => {
  describe('applyInheritance', () => {
    it('should apply template properties to a material', async () => {
      // Arrange
      const material: Partial<Material> = {
        id: 'material-123',
        name: 'Test Material',
        materialType: 'tile',
        categoryId: 'category-123'
      };

      const templates: PropertyTemplateDocument[] = [
        {
          id: 'template-1',
          name: 'Tile Template',
          materialType: 'tile',
          isActive: true,
          priority: 10,
          properties: {
            finish: 'matte',
            waterAbsorption: 0.5
          },
          overrideRules: [],
          createdBy: 'test-user',
          createdAt: new Date(),
          updatedAt: new Date()
        } as PropertyTemplateDocument,
        {
          id: 'template-2',
          name: 'Category Template',
          categoryId: 'category-123',
          isActive: true,
          priority: 20,
          properties: {
            finish: 'polished', // Should override the tile template
            slipResistance: 'R9'
          },
          overrideRules: [],
          createdBy: 'test-user',
          createdAt: new Date(),
          updatedAt: new Date()
        } as PropertyTemplateDocument
      ];

      // Mock getPropertyTemplatesForMaterial to return our test templates
      (getPropertyTemplatesForMaterial as jest.Mock).mockResolvedValue(templates);

      // Act
      const result = await propertyInheritanceService.applyInheritance(material);

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe('material-123');
      expect(result.name).toBe('Test Material');
      expect(result.finish).toBe('polished'); // From the higher priority template
      expect(result.waterAbsorption).toBe(0.5); // From the tile template
      expect(result.slipResistance).toBe('R9'); // From the category template
    });

    it('should not override existing properties when overrideExisting is false', async () => {
      // Arrange
      const material: Partial<Material> = {
        id: 'material-123',
        name: 'Test Material',
        materialType: 'tile',
        finish: 'textured' // Existing property
      };

      const templates: PropertyTemplateDocument[] = [
        {
          id: 'template-1',
          name: 'Tile Template',
          materialType: 'tile',
          isActive: true,
          priority: 10,
          properties: {
            finish: 'matte', // Should not override existing
            waterAbsorption: 0.5
          },
          overrideRules: [],
          createdBy: 'test-user',
          createdAt: new Date(),
          updatedAt: new Date()
        } as PropertyTemplateDocument
      ];

      // Mock getPropertyTemplatesForMaterial to return our test templates
      (getPropertyTemplatesForMaterial as jest.Mock).mockResolvedValue(templates);

      // Act
      const result = await propertyInheritanceService.applyInheritance(material, {
        overrideExisting: false
      });

      // Assert
      expect(result).toBeDefined();
      expect(result.finish).toBe('textured'); // Should keep existing value
      expect(result.waterAbsorption).toBe(0.5); // Should add new property
    });

    it('should apply override rules when conditions are met', async () => {
      // Arrange
      const material: Partial<Material> = {
        id: 'material-123',
        name: 'Test Material',
        materialType: 'porcelain',
        finish: 'textured'
      };

      const templates: PropertyTemplateDocument[] = [
        {
          id: 'template-1',
          name: 'Porcelain Template',
          materialType: 'porcelain',
          isActive: true,
          priority: 10,
          properties: {
            slipResistance: 'R9',
            waterAbsorption: 0.1
          },
          overrideRules: [
            {
              field: 'slipResistance',
              condition: 'finish=textured',
              value: 'R11'
            }
          ],
          createdBy: 'test-user',
          createdAt: new Date(),
          updatedAt: new Date()
        } as PropertyTemplateDocument
      ];

      // Mock getPropertyTemplatesForMaterial to return our test templates
      (getPropertyTemplatesForMaterial as jest.Mock).mockResolvedValue(templates);

      // Act
      const result = await propertyInheritanceService.applyInheritance(material);

      // Assert
      expect(result).toBeDefined();
      expect(result.slipResistance).toBe('R11'); // Should apply override rule
      expect(result.waterAbsorption).toBe(0.1);
    });

    it('should handle technicalSpecs properties correctly', async () => {
      // Arrange
      const material: Partial<Material> = {
        id: 'material-123',
        name: 'Test Material',
        materialType: 'tile',
        technicalSpecs: {
          thickness: 10 // Existing technical spec
        }
      };

      const templates: PropertyTemplateDocument[] = [
        {
          id: 'template-1',
          name: 'Tile Template',
          materialType: 'tile',
          isActive: true,
          priority: 10,
          properties: {
            technicalSpecs: {
              density: 2.3,
              hardness: 7
            }
          },
          overrideRules: [],
          createdBy: 'test-user',
          createdAt: new Date(),
          updatedAt: new Date()
        } as PropertyTemplateDocument
      ];

      // Mock getPropertyTemplatesForMaterial to return our test templates
      (getPropertyTemplatesForMaterial as jest.Mock).mockResolvedValue(templates);

      // Act
      const result = await propertyInheritanceService.applyInheritance(material);

      // Assert
      expect(result).toBeDefined();
      expect(result.technicalSpecs).toBeDefined();
      expect(result.technicalSpecs?.thickness).toBe(10); // Should keep existing value
      expect(result.technicalSpecs?.density).toBe(2.3); // Should add new property
      expect(result.technicalSpecs?.hardness).toBe(7); // Should add new property
    });

    it('should return the original material if no templates are found', async () => {
      // Arrange
      const material: Partial<Material> = {
        id: 'material-123',
        name: 'Test Material',
        materialType: 'unknown-type'
      };

      // Mock getPropertyTemplatesForMaterial to return empty array
      (getPropertyTemplatesForMaterial as jest.Mock).mockResolvedValue([]);

      // Act
      const result = await propertyInheritanceService.applyInheritance(material);

      // Assert
      expect(result).toBe(material); // Should return the original material
    });

    it('should return the original material if materialType is not defined', async () => {
      // Arrange
      const material: Partial<Material> = {
        id: 'material-123',
        name: 'Test Material'
        // No materialType
      };

      // Act
      const result = await propertyInheritanceService.applyInheritance(material);

      // Assert
      expect(result).toBe(material); // Should return the original material
      expect(getPropertyTemplatesForMaterial).not.toHaveBeenCalled(); // Should not call getPropertyTemplatesForMaterial
    });
  });

  describe('Template CRUD operations', () => {
    it('should create a template', async () => {
      // Arrange
      const templateData = {
        name: 'Test Template',
        materialType: 'tile',
        properties: {
          finish: 'matte'
        },
        createdBy: 'test-user'
      };

      // Act
      const template = await propertyInheritanceService.createTemplate(templateData);

      // Assert
      expect(template).toBeDefined();
      expect(template.id).toBeDefined();
      expect(template.name).toBe('Test Template');
      expect(template.materialType).toBe('tile');
      expect(template.properties).toEqual({
        finish: 'matte'
      });
    });

    it('should update a template', async () => {
      // Arrange
      const templateData = {
        name: 'Test Template',
        materialType: 'tile',
        properties: {
          finish: 'matte'
        },
        createdBy: 'test-user'
      };
      const createdTemplate = await propertyInheritanceService.createTemplate(templateData);

      // Act
      const updatedTemplate = await propertyInheritanceService.updateTemplate(createdTemplate.id, {
        name: 'Updated Template',
        properties: {
          finish: 'polished'
        }
      });

      // Assert
      expect(updatedTemplate).toBeDefined();
      expect(updatedTemplate?.id).toBe(createdTemplate.id);
      expect(updatedTemplate?.name).toBe('Updated Template');
      expect(updatedTemplate?.properties).toEqual({
        finish: 'polished'
      });
    });

    it('should delete a template', async () => {
      // Arrange
      const templateData = {
        name: 'Test Template',
        materialType: 'tile',
        properties: {
          finish: 'matte'
        },
        createdBy: 'test-user'
      };
      const createdTemplate = await propertyInheritanceService.createTemplate(templateData);

      // Act
      const deletedTemplate = await propertyInheritanceService.deleteTemplate(createdTemplate.id);
      const template = await propertyInheritanceService.getTemplateById(createdTemplate.id);

      // Assert
      expect(deletedTemplate).toBeDefined();
      expect(deletedTemplate?.id).toBe(createdTemplate.id);
      expect(template).toBeNull();
    });

    it('should get templates with filters', async () => {
      // Arrange
      await propertyInheritanceService.createTemplate({
        name: 'Tile Template',
        materialType: 'tile',
        priority: 10,
        properties: {},
        createdBy: 'test-user'
      });
      await propertyInheritanceService.createTemplate({
        name: 'Stone Template',
        materialType: 'stone',
        priority: 20,
        properties: {},
        createdBy: 'test-user'
      });

      // Act
      const result = await propertyInheritanceService.getTemplates({
        materialType: 'tile'
      });

      // Assert
      expect(result.templates).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.templates[0].name).toBe('Tile Template');
    });
  });
});
