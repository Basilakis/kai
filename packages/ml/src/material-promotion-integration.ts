/**
 * Material Promotion Integration for 3D Model Generation
 * 
 * This module integrates the material promotion system with the 3D model generation process.
 * It provides functionality to select promoted materials for 3D models based on user prompts.
 */

import materialPromotionService from '../../server/src/services/promotion/materialPromotionService';
import { MaterialService, VectorService } from './types/services';

export class MaterialPromotionIntegration {
  constructor(
    private materialService: MaterialService,
    private vectorService: VectorService
  ) {}

  /**
   * Select materials for 3D model generation with promotion support
   * @param materialTypes Array of material types needed for the model
   * @param prompt User prompt for the 3D model
   * @param userId Optional user ID for analytics
   * @returns Array of selected materials
   */
  async selectMaterialsForModel(
    materialTypes: string[],
    prompt: string,
    userId?: string
  ): Promise<any[]> {
    // Array to store all selected materials
    const selectedMaterials: any[] = [];
    
    // Process each material type
    for (const materialType of materialTypes) {
      // Try to get a promoted material first
      const promotedMaterial = await materialPromotionService.selectMaterialFor3DGeneration(
        materialType,
        prompt
      );
      
      if (promotedMaterial) {
        try {
          // Get the promoted material details
          const material = await this.materialService.getMaterial(promotedMaterial.materialId);
          
          if (material) {
            // Record that the promoted material was used
            if (promotedMaterial.promotionId) {
              await materialPromotionService.recordPromotedMaterialUsage(promotedMaterial.promotionId);
            }
            
            // Add to our materials list with promotion flag
            selectedMaterials.push({
              ...material,
              isPromoted: true,
              promotionId: promotedMaterial.promotionId
            });
            continue;
          }
        } catch (error) {
          console.error(`Error fetching promoted material: ${error}`);
          // Fall back to regular search if there's an error
        }
      }
      
      // If no promoted material was selected or there was an error, use regular search
      try {
        // Create a type-specific query
        const typeQuery = `type:${materialType}`;
        
        // Search for materials of this specific type
        const searchResult = await this.vectorService.searchMaterials({
          query: typeQuery,
          filters: {
            type: [materialType],
            confidence: { min: 0.7 }
          }
        });
        
        // Get detailed information for the top result
        if (searchResult.materials && searchResult.materials.length > 0) {
          const material = await this.materialService.getMaterial(searchResult.materials[0].id);
          if (material) {
            selectedMaterials.push({
              ...material,
              isPromoted: false
            });
          }
        }
      } catch (error) {
        console.error(`Error in regular material search: ${error}`);
      }
    }
    
    return selectedMaterials;
  }

  /**
   * Extract material types from a 3D scene
   * @param scene 3D scene object
   * @returns Array of material types
   */
  extractMaterialTypes(scene: any): string[] {
    // Extract material types from scene
    const materialTypes = scene?.materials?.map(
      (m: any) => m.type
    ) || [];
    
    // If no material types found, return a default
    if (materialTypes.length === 0) {
      return ['tile', 'wood', 'stone']; // Default material types
    }
    
    return materialTypes;
  }
}

export default MaterialPromotionIntegration;
