/**
 * Material Promotion Controller
 * 
 * This controller handles API endpoints for factory users to manage
 * material promotions in 3D model generation.
 */

import { Request, Response } from 'express';
import { logger } from '../../utils/logger';
import { ApiError } from '../../utils/apiError';
import materialPromotionService from '../../services/promotion/materialPromotionService';
import userCreditModel from '../../models/userCredit.model';

/**
 * Get all promotions for the authenticated factory
 * @route GET /api/factory/promotions
 * @access Factory
 */
export const getFactoryPromotions = async (req: Request, res: Response) => {
  try {
    const factoryId = req.user!.id;
    
    const promotions = await materialPromotionService.getFactoryPromotions(factoryId);
    
    res.status(200).json({
      success: true,
      data: promotions
    });
  } catch (error) {
    logger.error(`Error in getFactoryPromotions: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to get factory promotions');
  }
};

/**
 * Get a promotion by ID
 * @route GET /api/factory/promotions/:id
 * @access Factory
 */
export const getPromotionById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const promotion = await materialPromotionService.getPromotionById(id);
    
    if (!promotion) {
      throw new ApiError(404, 'Promotion not found');
    }
    
    // Check if the promotion belongs to the authenticated factory
    if (promotion.factoryId !== req.user!.id) {
      throw new ApiError(403, 'Unauthorized access to promotion');
    }
    
    res.status(200).json({
      success: true,
      data: promotion
    });
  } catch (error) {
    logger.error(`Error in getPromotionById: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to get promotion');
  }
};

/**
 * Allocate credits to promote a material
 * @route POST /api/factory/promotions
 * @access Factory
 */
export const allocatePromotionCredits = async (req: Request, res: Response) => {
  try {
    const factoryId = req.user!.id;
    const { materialId, credits, description } = req.body;
    
    // Validate input
    if (!materialId) {
      throw new ApiError(400, 'Material ID is required');
    }
    
    if (!credits || credits <= 0) {
      throw new ApiError(400, 'Credits must be a positive number');
    }
    
    // Check if user has enough credits
    const userCredit = await userCreditModel.getUserCredit(factoryId);
    if (!userCredit || userCredit.balance < credits) {
      throw new ApiError(400, 'Insufficient credits for promotion');
    }
    
    // Allocate credits
    const promotion = await materialPromotionService.allocatePromotionCredits(
      factoryId,
      materialId,
      credits,
      description || 'Material promotion credit allocation'
    );
    
    res.status(201).json({
      success: true,
      message: `Successfully allocated ${credits} credits to promote material`,
      data: promotion
    });
  } catch (error) {
    logger.error(`Error in allocatePromotionCredits: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to allocate promotion credits');
  }
};

/**
 * Update a promotion's status
 * @route PUT /api/factory/promotions/:id/status
 * @access Factory
 */
export const updatePromotionStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    // Validate input
    if (!status || !['active', 'inactive', 'completed', 'pending'].includes(status)) {
      throw new ApiError(400, 'Invalid status. Must be one of: active, inactive, completed, pending');
    }
    
    // Check if promotion exists and belongs to the factory
    const existingPromotion = await materialPromotionService.getPromotionById(id);
    
    if (!existingPromotion) {
      throw new ApiError(404, 'Promotion not found');
    }
    
    if (existingPromotion.factoryId !== req.user!.id) {
      throw new ApiError(403, 'Unauthorized access to promotion');
    }
    
    // Update status
    const updatedPromotion = await materialPromotionService.updatePromotionStatus(id, status);
    
    res.status(200).json({
      success: true,
      message: `Successfully updated promotion status to ${status}`,
      data: updatedPromotion
    });
  } catch (error) {
    logger.error(`Error in updatePromotionStatus: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to update promotion status');
  }
};

/**
 * Get factory materials that can be promoted
 * @route GET /api/factory/materials
 * @access Factory
 */
export const getFactoryMaterials = async (req: Request, res: Response) => {
  try {
    const factoryId = req.user!.id;
    
    const materials = await materialPromotionService.getFactoryMaterials(factoryId);
    
    res.status(200).json({
      success: true,
      data: materials
    });
  } catch (error) {
    logger.error(`Error in getFactoryMaterials: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to get factory materials');
  }
};

/**
 * Get promotion analytics
 * @route GET /api/factory/promotions/analytics
 * @access Factory
 */
export const getPromotionAnalytics = async (req: Request, res: Response) => {
  try {
    const factoryId = req.user!.id;
    
    // Get all promotions for the factory
    const promotions = await materialPromotionService.getFactoryPromotions(factoryId);
    
    // Calculate analytics
    const totalCreditsAllocated = promotions.reduce((sum, p) => sum + p.creditsAllocated, 0);
    const totalUsageCount = promotions.reduce((sum, p) => sum + p.usageCount, 0);
    const totalImpressionCount = promotions.reduce((sum, p) => sum + p.impressionCount, 0);
    
    // Calculate usage rate (if impressions > 0)
    const usageRate = totalImpressionCount > 0 
      ? (totalUsageCount / totalImpressionCount) * 100 
      : 0;
    
    // Get active promotions
    const activePromotions = promotions.filter(p => p.status === 'active');
    const activeCredits = activePromotions.reduce((sum, p) => sum + p.creditsAllocated, 0);
    
    // Get top performing promotions (by usage count)
    const topPromotions = [...promotions]
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 5);
    
    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalCreditsAllocated,
          totalUsageCount,
          totalImpressionCount,
          usageRate: parseFloat(usageRate.toFixed(2)),
          activePromotions: activePromotions.length,
          activeCredits
        },
        topPromotions: topPromotions.map(p => ({
          id: p.id,
          materialId: p.materialId,
          materialName: p.material?.name || 'Unknown',
          creditsAllocated: p.creditsAllocated,
          usageCount: p.usageCount,
          impressionCount: p.impressionCount,
          usageRate: p.impressionCount > 0 
            ? parseFloat(((p.usageCount / p.impressionCount) * 100).toFixed(2)) 
            : 0
        }))
      }
    });
  } catch (error) {
    logger.error(`Error in getPromotionAnalytics: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to get promotion analytics');
  }
};

export default {
  getFactoryPromotions,
  getPromotionById,
  allocatePromotionCredits,
  updatePromotionStatus,
  getFactoryMaterials,
  getPromotionAnalytics
};
