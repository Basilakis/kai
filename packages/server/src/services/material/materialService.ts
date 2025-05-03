/**
 * Material Service
 * 
 * This service provides an interface for material-related operations with property inheritance support.
 */

import { logger } from '../../utils/logger';
import { Material } from '../../../../shared/src/types/material';
import { createMaterial, updateMaterial, getMaterialById } from '../../models/material.model';
import { propertyInheritanceService } from '../propertyInheritance/propertyInheritanceService';

/**
 * Material Service
 */
export class MaterialService {
  /**
   * Create a new material with property inheritance
   * 
   * @param materialData Material data
   * @param options Options for property inheritance
   * @returns Created material
   */
  public async createMaterial(
    materialData: Partial<Material>,
    options: {
      applyInheritance?: boolean;
      applyDefaults?: boolean;
      overrideExisting?: boolean;
    } = {}
  ): Promise<Material> {
    try {
      const { applyInheritance = true, applyDefaults = true, overrideExisting = false } = options;
      
      // Apply property inheritance if requested
      let processedData = { ...materialData };
      
      if (applyInheritance && materialData.materialType) {
        processedData = await propertyInheritanceService.applyInheritance(
          materialData,
          { applyDefaults, overrideExisting }
        );
      }
      
      // Create material
      const material = await createMaterial(processedData);
      
      return material;
    } catch (err) {
      logger.error(`Failed to create material: ${err}`);
      throw new Error(`Failed to create material: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  
  /**
   * Update a material with property inheritance
   * 
   * @param id Material ID
   * @param updateData Update data
   * @param options Options for property inheritance
   * @returns Updated material
   */
  public async updateMaterial(
    id: string,
    updateData: Partial<Material>,
    options: {
      applyInheritance?: boolean;
      applyDefaults?: boolean;
      overrideExisting?: boolean;
    } = {}
  ): Promise<Material | null> {
    try {
      const { applyInheritance = true, applyDefaults = true, overrideExisting = false } = options;
      
      // Get current material
      const currentMaterial = await getMaterialById(id);
      
      if (!currentMaterial) {
        return null;
      }
      
      // Merge update data with current material
      const mergedData = {
        ...currentMaterial,
        ...updateData
      };
      
      // Apply property inheritance if requested
      let processedData = { ...mergedData };
      
      if (applyInheritance && mergedData.materialType) {
        processedData = await propertyInheritanceService.applyInheritance(
          mergedData,
          { applyDefaults, overrideExisting }
        );
      }
      
      // Update material
      const material = await updateMaterial(id, processedData);
      
      return material;
    } catch (err) {
      logger.error(`Failed to update material: ${err}`);
      throw new Error(`Failed to update material: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  
  /**
   * Apply property inheritance to a material
   * 
   * @param id Material ID
   * @param options Options for property inheritance
   * @returns Updated material
   */
  public async applyInheritance(
    id: string,
    options: {
      applyDefaults?: boolean;
      overrideExisting?: boolean;
    } = {}
  ): Promise<Material | null> {
    try {
      // Get current material
      const currentMaterial = await getMaterialById(id);
      
      if (!currentMaterial) {
        return null;
      }
      
      // Apply property inheritance
      const processedData = await propertyInheritanceService.applyInheritance(
        currentMaterial,
        options
      );
      
      // Update material
      const material = await updateMaterial(id, processedData);
      
      return material;
    } catch (err) {
      logger.error(`Failed to apply property inheritance: ${err}`);
      throw new Error(`Failed to apply property inheritance: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

// Export singleton instance
export const materialService = new MaterialService();
