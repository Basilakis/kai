/**
 * Tests for Material Service
 */

import { materialService } from '../../../services/material/materialService';
import { propertyInheritanceService } from '../../../services/propertyInheritance/propertyInheritanceService';
import { createMaterial, updateMaterial, getMaterialById } from '../../../models/material.model';
import { Material } from '../../../../../shared/src/types/material';

// Mock dependencies
jest.mock('../../../services/propertyInheritance/propertyInheritanceService', () => ({
  propertyInheritanceService: {
    applyInheritance: jest.fn()
  }
}));

jest.mock('../../../models/material.model', () => ({
  createMaterial: jest.fn(),
  updateMaterial: jest.fn(),
  getMaterialById: jest.fn()
}));

describe('Material Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createMaterial', () => {
    it('should apply property inheritance when creating a material', async () => {
      // Arrange
      const materialData: Partial<Material> = {
        name: 'Test Material',
        materialType: 'tile'
      };

      const materialWithInheritance: Partial<Material> = {
        name: 'Test Material',
        materialType: 'tile',
        finish: 'matte',
        waterAbsorption: 0.5
      };

      const createdMaterial: Material = {
        id: 'material-123',
        name: 'Test Material',
        materialType: 'tile',
        finish: 'matte',
        waterAbsorption: 0.5,
        type: 'material',
        createdAt: new Date(),
        updatedAt: new Date()
      } as Material;

      // Mock dependencies
      (propertyInheritanceService.applyInheritance as jest.Mock).mockResolvedValue(materialWithInheritance);
      (createMaterial as jest.Mock).mockResolvedValue(createdMaterial);

      // Act
      const result = await materialService.createMaterial(materialData);

      // Assert
      expect(propertyInheritanceService.applyInheritance).toHaveBeenCalledWith(
        materialData,
        { applyDefaults: true, overrideExisting: false }
      );
      expect(createMaterial).toHaveBeenCalledWith(materialWithInheritance);
      expect(result).toBe(createdMaterial);
    });

    it('should not apply property inheritance when applyInheritance is false', async () => {
      // Arrange
      const materialData: Partial<Material> = {
        name: 'Test Material',
        materialType: 'tile'
      };

      const createdMaterial: Material = {
        id: 'material-123',
        name: 'Test Material',
        materialType: 'tile',
        type: 'material',
        createdAt: new Date(),
        updatedAt: new Date()
      } as Material;

      // Mock dependencies
      (createMaterial as jest.Mock).mockResolvedValue(createdMaterial);

      // Act
      const result = await materialService.createMaterial(materialData, {
        applyInheritance: false
      });

      // Assert
      expect(propertyInheritanceService.applyInheritance).not.toHaveBeenCalled();
      expect(createMaterial).toHaveBeenCalledWith(materialData);
      expect(result).toBe(createdMaterial);
    });
  });

  describe('updateMaterial', () => {
    it('should apply property inheritance when updating a material', async () => {
      // Arrange
      const materialId = 'material-123';
      const updateData: Partial<Material> = {
        finish: 'polished'
      };

      const currentMaterial: Material = {
        id: materialId,
        name: 'Test Material',
        materialType: 'tile',
        finish: 'matte',
        type: 'material',
        createdAt: new Date(),
        updatedAt: new Date()
      } as Material;

      const mergedData: Partial<Material> = {
        id: materialId,
        name: 'Test Material',
        materialType: 'tile',
        finish: 'polished',
        type: 'material',
        createdAt: currentMaterial.createdAt,
        updatedAt: currentMaterial.updatedAt
      };

      const materialWithInheritance: Partial<Material> = {
        id: materialId,
        name: 'Test Material',
        materialType: 'tile',
        finish: 'polished',
        waterAbsorption: 0.5,
        type: 'material',
        createdAt: currentMaterial.createdAt,
        updatedAt: currentMaterial.updatedAt
      };

      const updatedMaterial: Material = {
        id: materialId,
        name: 'Test Material',
        materialType: 'tile',
        finish: 'polished',
        waterAbsorption: 0.5,
        type: 'material',
        createdAt: currentMaterial.createdAt,
        updatedAt: new Date()
      } as Material;

      // Mock dependencies
      (getMaterialById as jest.Mock).mockResolvedValue(currentMaterial);
      (propertyInheritanceService.applyInheritance as jest.Mock).mockResolvedValue(materialWithInheritance);
      (updateMaterial as jest.Mock).mockResolvedValue(updatedMaterial);

      // Act
      const result = await materialService.updateMaterial(materialId, updateData);

      // Assert
      expect(getMaterialById).toHaveBeenCalledWith(materialId);
      expect(propertyInheritanceService.applyInheritance).toHaveBeenCalledWith(
        mergedData,
        { applyDefaults: true, overrideExisting: false }
      );
      expect(updateMaterial).toHaveBeenCalledWith(materialId, materialWithInheritance);
      expect(result).toBe(updatedMaterial);
    });

    it('should not apply property inheritance when applyInheritance is false', async () => {
      // Arrange
      const materialId = 'material-123';
      const updateData: Partial<Material> = {
        finish: 'polished'
      };

      const currentMaterial: Material = {
        id: materialId,
        name: 'Test Material',
        materialType: 'tile',
        finish: 'matte',
        type: 'material',
        createdAt: new Date(),
        updatedAt: new Date()
      } as Material;

      const mergedData: Partial<Material> = {
        id: materialId,
        name: 'Test Material',
        materialType: 'tile',
        finish: 'polished',
        type: 'material',
        createdAt: currentMaterial.createdAt,
        updatedAt: currentMaterial.updatedAt
      };

      const updatedMaterial: Material = {
        id: materialId,
        name: 'Test Material',
        materialType: 'tile',
        finish: 'polished',
        type: 'material',
        createdAt: currentMaterial.createdAt,
        updatedAt: new Date()
      } as Material;

      // Mock dependencies
      (getMaterialById as jest.Mock).mockResolvedValue(currentMaterial);
      (updateMaterial as jest.Mock).mockResolvedValue(updatedMaterial);

      // Act
      const result = await materialService.updateMaterial(materialId, updateData, {
        applyInheritance: false
      });

      // Assert
      expect(getMaterialById).toHaveBeenCalledWith(materialId);
      expect(propertyInheritanceService.applyInheritance).not.toHaveBeenCalled();
      expect(updateMaterial).toHaveBeenCalledWith(materialId, mergedData);
      expect(result).toBe(updatedMaterial);
    });

    it('should return null if material does not exist', async () => {
      // Arrange
      const materialId = 'non-existent-id';
      const updateData: Partial<Material> = {
        finish: 'polished'
      };

      // Mock dependencies
      (getMaterialById as jest.Mock).mockResolvedValue(null);

      // Act
      const result = await materialService.updateMaterial(materialId, updateData);

      // Assert
      expect(getMaterialById).toHaveBeenCalledWith(materialId);
      expect(propertyInheritanceService.applyInheritance).not.toHaveBeenCalled();
      expect(updateMaterial).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  describe('applyInheritance', () => {
    it('should apply property inheritance to an existing material', async () => {
      // Arrange
      const materialId = 'material-123';
      const options = {
        applyDefaults: true,
        overrideExisting: true
      };

      const currentMaterial: Material = {
        id: materialId,
        name: 'Test Material',
        materialType: 'tile',
        finish: 'matte',
        type: 'material',
        createdAt: new Date(),
        updatedAt: new Date()
      } as Material;

      const materialWithInheritance: Partial<Material> = {
        id: materialId,
        name: 'Test Material',
        materialType: 'tile',
        finish: 'polished',
        waterAbsorption: 0.5,
        type: 'material',
        createdAt: currentMaterial.createdAt,
        updatedAt: currentMaterial.updatedAt
      };

      const updatedMaterial: Material = {
        id: materialId,
        name: 'Test Material',
        materialType: 'tile',
        finish: 'polished',
        waterAbsorption: 0.5,
        type: 'material',
        createdAt: currentMaterial.createdAt,
        updatedAt: new Date()
      } as Material;

      // Mock dependencies
      (getMaterialById as jest.Mock).mockResolvedValue(currentMaterial);
      (propertyInheritanceService.applyInheritance as jest.Mock).mockResolvedValue(materialWithInheritance);
      (updateMaterial as jest.Mock).mockResolvedValue(updatedMaterial);

      // Act
      const result = await materialService.applyInheritance(materialId, options);

      // Assert
      expect(getMaterialById).toHaveBeenCalledWith(materialId);
      expect(propertyInheritanceService.applyInheritance).toHaveBeenCalledWith(
        currentMaterial,
        options
      );
      expect(updateMaterial).toHaveBeenCalledWith(materialId, materialWithInheritance);
      expect(result).toBe(updatedMaterial);
    });

    it('should return null if material does not exist', async () => {
      // Arrange
      const materialId = 'non-existent-id';
      const options = {
        applyDefaults: true,
        overrideExisting: true
      };

      // Mock dependencies
      (getMaterialById as jest.Mock).mockResolvedValue(null);

      // Act
      const result = await materialService.applyInheritance(materialId, options);

      // Assert
      expect(getMaterialById).toHaveBeenCalledWith(materialId);
      expect(propertyInheritanceService.applyInheritance).not.toHaveBeenCalled();
      expect(updateMaterial).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });
});
