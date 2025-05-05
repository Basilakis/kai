/**
 * Material Promotion Service
 * 
 * This service manages the promotion of materials by factories in 3D model generation.
 * It provides functionality for allocating credits, tracking usage, and selecting
 * promoted materials for 3D models.
 */

import { logger } from '../../utils/logger';
import materialPromotionModel, { 
  MaterialPromotion, 
  MaterialPromotionWithDetails 
} from '../../models/materialPromotion.model';
import { ApiError } from '../../utils/apiError';
import userCreditModel from '../../models/userCredit.model';

class MaterialPromotionService {
  /**
   * Get all promotions for a factory
   * @param factoryId Factory user ID
   * @returns Array of material promotions
   */
  async getFactoryPromotions(factoryId: string): Promise<MaterialPromotionWithDetails[]> {
    try {
      return await materialPromotionModel.getFactoryPromotions(factoryId);
    } catch (error) {
      logger.error(`Failed to get factory promotions: ${error}`);
      throw error;
    }
  }

  /**
   * Get a promotion by ID
   * @param promotionId Promotion ID
   * @returns Material promotion or null if not found
   */
  async getPromotionById(promotionId: string): Promise<MaterialPromotionWithDetails | null> {
    try {
      return await materialPromotionModel.getPromotionById(promotionId);
    } catch (error) {
      logger.error(`Failed to get promotion: ${error}`);
      throw error;
    }
  }

  /**
   * Allocate credits to promote a material
   * @param factoryId Factory user ID
   * @param materialId Material ID
   * @param credits Number of credits to allocate
   * @param description Description for the credit transaction
   * @returns The created or updated promotion
   */
  async allocatePromotionCredits(
    factoryId: string,
    materialId: string,
    credits: number,
    description: string = 'Material promotion credit allocation'
  ): Promise<MaterialPromotion> {
    try {
      // Check if user has enough credits
      const userCredit = await userCreditModel.getUserCredit(factoryId);
      if (!userCredit || userCredit.balance < credits) {
        throw new ApiError(400, 'Insufficient credits for promotion');
      }

      return await materialPromotionModel.allocatePromotionCredits(
        factoryId,
        materialId,
        credits,
        description
      );
    } catch (error) {
      logger.error(`Failed to allocate promotion credits: ${error}`);
      throw error;
    }
  }

  /**
   * Update a promotion's status
   * @param promotionId Promotion ID
   * @param status New status
   * @returns Updated promotion
   */
  async updatePromotionStatus(
    promotionId: string,
    status: MaterialPromotion['status']
  ): Promise<MaterialPromotion> {
    try {
      return await materialPromotionModel.updatePromotionStatus(promotionId, status);
    } catch (error) {
      logger.error(`Failed to update promotion status: ${error}`);
      throw error;
    }
  }

  /**
   * Track when a promoted material is used in a 3D model
   * @param promotionId Promotion ID
   * @returns Success status
   */
  async trackPromotionUsage(promotionId: string): Promise<boolean> {
    try {
      return await materialPromotionModel.trackPromotionUsage(promotionId);
    } catch (error) {
      logger.error(`Failed to track promotion usage: ${error}`);
      return false;
    }
  }

  /**
   * Track when a promoted material is shown to a user
   * @param promotionId Promotion ID
   * @returns Success status
   */
  async trackPromotionImpression(promotionId: string): Promise<boolean> {
    try {
      return await materialPromotionModel.trackPromotionImpression(promotionId);
    } catch (error) {
      logger.error(`Failed to track promotion impression: ${error}`);
      return false;
    }
  }

  /**
   * Get factory materials that can be promoted
   * @param factoryId Factory user ID
   * @returns Array of materials
   */
  async getFactoryMaterials(factoryId: string): Promise<any[]> {
    try {
      return await materialPromotionModel.getFactoryMaterials(factoryId);
    } catch (error) {
      logger.error(`Failed to get factory materials: ${error}`);
      throw error;
    }
  }

  /**
   * Select a material for 3D model generation based on user prompt
   * This implements the 1/3 chance of selecting a promoted material
   * @param materialType Material type from the prompt
   * @param prompt User prompt
   * @returns Selected material ID or null if no match
   */
  async selectMaterialFor3DGeneration(
    materialType: string,
    prompt: string
  ): Promise<{ materialId: string; promotionId?: string } | null> {
    try {
      // Get active promotions for this material type
      const activePromotions = await materialPromotionModel.getActivePromotionsByMaterialType(materialType);
      
      if (!activePromotions || activePromotions.length === 0) {
        // No active promotions, return null to use random material
        return null;
      }

      // Determine if we should use a promoted material (1/3 chance)
      const usePromoted = Math.random() < 1/3;
      
      if (!usePromoted) {
        // 2/3 chance to use random material
        return null;
      }

      // Find promotions that match the prompt
      const matchingPromotions = activePromotions.filter(promotion => {
        // Simple matching logic - check if material name is in the prompt
        // This could be enhanced with more sophisticated matching
        return prompt.toLowerCase().includes(promotion.material_name.toLowerCase());
      });

      // If we have matching promotions, select one weighted by credits allocated
      if (matchingPromotions.length > 0) {
        const selectedPromotion = this.weightedRandomSelection(matchingPromotions);
        
        // Track impression
        await this.trackPromotionImpression(selectedPromotion.promotion_id);
        
        return {
          materialId: selectedPromotion.material_id,
          promotionId: selectedPromotion.promotion_id
        };
      }

      // If no specific matches, select a random promotion weighted by credits
      const selectedPromotion = this.weightedRandomSelection(activePromotions);
      
      // Track impression
      await this.trackPromotionImpression(selectedPromotion.promotion_id);
      
      return {
        materialId: selectedPromotion.material_id,
        promotionId: selectedPromotion.promotion_id
      };
    } catch (error) {
      logger.error(`Error selecting material for 3D generation: ${error}`);
      // In case of error, return null to use random material
      return null;
    }
  }

  /**
   * Select a random promotion weighted by credits allocated
   * @param promotions Array of promotions
   * @returns Selected promotion
   */
  private weightedRandomSelection(promotions: any[]): any {
    // Calculate total weight
    const totalCredits = promotions.reduce((sum, promotion) => sum + promotion.credits_allocated, 0);
    
    // Generate random value
    const random = Math.random() * totalCredits;
    
    // Select based on weight
    let cumulativeWeight = 0;
    for (const promotion of promotions) {
      cumulativeWeight += promotion.credits_allocated;
      if (random <= cumulativeWeight) {
        return promotion;
      }
    }
    
    // Fallback to first promotion (should not happen)
    return promotions[0];
  }

  /**
   * Record that a promoted material was used in a 3D model
   * @param promotionId Promotion ID
   * @returns Success status
   */
  async recordPromotedMaterialUsage(promotionId: string): Promise<boolean> {
    try {
      return await this.trackPromotionUsage(promotionId);
    } catch (error) {
      logger.error(`Failed to record promoted material usage: ${error}`);
      return false;
    }
  }
}

// Create singleton instance
const materialPromotionService = new MaterialPromotionService();

export default materialPromotionService;
