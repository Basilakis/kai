/**
 * Material Promotion Model
 * 
 * This model handles the promotion of materials by factories in 3D model generation.
 * Factories can allocate credits to promote their materials, which will then have
 * a higher chance of being selected when generating 3D models.
 */

import { supabaseClient } from '../services/supabase/supabaseClient';
import { logger } from '../utils/logger';
import { ApiError } from '../utils/apiError';

/**
 * Material promotion status
 */
export type MaterialPromotionStatus = 'active' | 'inactive' | 'completed' | 'pending';

/**
 * Material promotion interface
 */
export interface MaterialPromotion {
  id: string;
  materialId: string;
  factoryId: string;
  creditsAllocated: number;
  status: MaterialPromotionStatus;
  startDate: Date;
  endDate?: Date;
  usageCount: number;
  impressionCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Material promotion with material details
 */
export interface MaterialPromotionWithDetails extends MaterialPromotion {
  material?: {
    id: string;
    name: string;
    materialType: string;
    description?: string;
    manufacturer?: string;
    imageUrl?: string;
  };
}

/**
 * Get all promotions for a factory
 * @param factoryId Factory user ID
 * @returns Array of material promotions
 */
export async function getFactoryPromotions(factoryId: string): Promise<MaterialPromotionWithDetails[]> {
  try {
    const { data, error } = await supabaseClient.getClient()
      .from('material_promotions')
      .select(`
        *,
        material:material_id (
          id,
          name,
          material_type,
          description,
          manufacturer,
          images
        )
      `)
      .eq('factory_id', factoryId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error(`Error fetching factory promotions: ${error.message}`);
      throw new ApiError(500, `Failed to fetch factory promotions: ${error.message}`);
    }

    // Transform the data to match our interface
    return data.map(item => ({
      id: item.id,
      materialId: item.material_id,
      factoryId: item.factory_id,
      creditsAllocated: item.credits_allocated,
      status: item.status as MaterialPromotionStatus,
      startDate: new Date(item.start_date),
      endDate: item.end_date ? new Date(item.end_date) : undefined,
      usageCount: item.usage_count,
      impressionCount: item.impression_count,
      createdAt: new Date(item.created_at),
      updatedAt: new Date(item.updated_at),
      material: item.material ? {
        id: item.material.id,
        name: item.material.name,
        materialType: item.material.material_type,
        description: item.material.description,
        manufacturer: item.material.manufacturer,
        imageUrl: item.material.images && item.material.images.length > 0 
          ? item.material.images[0].url 
          : undefined
      } : undefined
    }));
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    logger.error(`Failed to get factory promotions: ${error}`);
    throw new ApiError(500, 'Failed to get factory promotions');
  }
}

/**
 * Get a promotion by ID
 * @param promotionId Promotion ID
 * @returns Material promotion or null if not found
 */
export async function getPromotionById(promotionId: string): Promise<MaterialPromotionWithDetails | null> {
  try {
    const { data, error } = await supabaseClient.getClient()
      .from('material_promotions')
      .select(`
        *,
        material:material_id (
          id,
          name,
          material_type,
          description,
          manufacturer,
          images
        )
      `)
      .eq('id', promotionId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      logger.error(`Error fetching promotion: ${error.message}`);
      throw new ApiError(500, `Failed to fetch promotion: ${error.message}`);
    }

    // Transform the data to match our interface
    return {
      id: data.id,
      materialId: data.material_id,
      factoryId: data.factory_id,
      creditsAllocated: data.credits_allocated,
      status: data.status as MaterialPromotionStatus,
      startDate: new Date(data.start_date),
      endDate: data.end_date ? new Date(data.end_date) : undefined,
      usageCount: data.usage_count,
      impressionCount: data.impression_count,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      material: data.material ? {
        id: data.material.id,
        name: data.material.name,
        materialType: data.material.material_type,
        description: data.material.description,
        manufacturer: data.material.manufacturer,
        imageUrl: data.material.images && data.material.images.length > 0 
          ? data.material.images[0].url 
          : undefined
      } : undefined
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    logger.error(`Failed to get promotion: ${error}`);
    throw new ApiError(500, 'Failed to get promotion');
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
export async function allocatePromotionCredits(
  factoryId: string,
  materialId: string,
  credits: number,
  description: string = 'Material promotion credit allocation'
): Promise<MaterialPromotion> {
  try {
    // Call the allocate_promotion_credits function
    const { data, error } = await supabaseClient.getClient()
      .rpc('allocate_promotion_credits', {
        p_user_id: factoryId,
        p_material_id: materialId,
        p_credits: credits,
        p_description: description
      });

    if (error) {
      logger.error(`Error allocating promotion credits: ${error.message}`);
      throw new ApiError(500, `Failed to allocate promotion credits: ${error.message}`);
    }

    // Get the promotion details
    const promotionId = data;
    const promotion = await getPromotionById(promotionId);

    if (!promotion) {
      throw new ApiError(500, 'Failed to retrieve created promotion');
    }

    return promotion;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    logger.error(`Failed to allocate promotion credits: ${error}`);
    throw new ApiError(500, 'Failed to allocate promotion credits');
  }
}

/**
 * Update a promotion's status
 * @param promotionId Promotion ID
 * @param status New status
 * @returns Updated promotion
 */
export async function updatePromotionStatus(
  promotionId: string,
  status: MaterialPromotionStatus
): Promise<MaterialPromotion> {
  try {
    const { data, error } = await supabaseClient.getClient()
      .from('material_promotions')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', promotionId)
      .select()
      .single();

    if (error) {
      logger.error(`Error updating promotion status: ${error.message}`);
      throw new ApiError(500, `Failed to update promotion status: ${error.message}`);
    }

    // Transform the data to match our interface
    return {
      id: data.id,
      materialId: data.material_id,
      factoryId: data.factory_id,
      creditsAllocated: data.credits_allocated,
      status: data.status as MaterialPromotionStatus,
      startDate: new Date(data.start_date),
      endDate: data.end_date ? new Date(data.end_date) : undefined,
      usageCount: data.usage_count,
      impressionCount: data.impression_count,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    logger.error(`Failed to update promotion status: ${error}`);
    throw new ApiError(500, 'Failed to update promotion status');
  }
}

/**
 * Track when a promoted material is used in a 3D model
 * @param promotionId Promotion ID
 * @returns Success status
 */
export async function trackPromotionUsage(promotionId: string): Promise<boolean> {
  try {
    const { data, error } = await supabaseClient.getClient()
      .rpc('track_promotion_usage', {
        p_promotion_id: promotionId
      });

    if (error) {
      logger.error(`Error tracking promotion usage: ${error.message}`);
      throw new ApiError(500, `Failed to track promotion usage: ${error.message}`);
    }

    return data;
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
export async function trackPromotionImpression(promotionId: string): Promise<boolean> {
  try {
    const { data, error } = await supabaseClient.getClient()
      .rpc('track_promotion_impression', {
        p_promotion_id: promotionId
      });

    if (error) {
      logger.error(`Error tracking promotion impression: ${error.message}`);
      throw new ApiError(500, `Failed to track promotion impression: ${error.message}`);
    }

    return data;
  } catch (error) {
    logger.error(`Failed to track promotion impression: ${error}`);
    return false;
  }
}

/**
 * Get active promotions for a specific material type
 * @param materialType Material type
 * @returns Array of active promotions
 */
export async function getActivePromotionsByMaterialType(materialType: string): Promise<any[]> {
  try {
    const { data, error } = await supabaseClient.getClient()
      .rpc('get_active_promotions_by_material_type', {
        p_material_type: materialType
      });

    if (error) {
      logger.error(`Error fetching active promotions: ${error.message}`);
      throw new ApiError(500, `Failed to fetch active promotions: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    logger.error(`Failed to get active promotions: ${error}`);
    throw new ApiError(500, 'Failed to get active promotions');
  }
}

/**
 * Get factory materials that can be promoted
 * @param factoryId Factory user ID
 * @returns Array of materials
 */
export async function getFactoryMaterials(factoryId: string): Promise<any[]> {
  try {
    // For now, we'll assume materials have a factory_id field
    // This may need to be adjusted based on your actual schema
    const { data, error } = await supabaseClient.getClient()
      .from('materials')
      .select(`
        id,
        name,
        material_type,
        description,
        manufacturer,
        images
      `)
      .eq('factory_id', factoryId);

    if (error) {
      logger.error(`Error fetching factory materials: ${error.message}`);
      throw new ApiError(500, `Failed to fetch factory materials: ${error.message}`);
    }

    // Transform the data to a more usable format
    return data.map(item => ({
      id: item.id,
      name: item.name,
      materialType: item.material_type,
      description: item.description,
      manufacturer: item.manufacturer,
      imageUrl: item.images && item.images.length > 0 ? item.images[0].url : undefined
    }));
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    logger.error(`Failed to get factory materials: ${error}`);
    throw new ApiError(500, 'Failed to get factory materials');
  }
}

export default {
  getFactoryPromotions,
  getPromotionById,
  allocatePromotionCredits,
  updatePromotionStatus,
  trackPromotionUsage,
  trackPromotionImpression,
  getActivePromotionsByMaterialType,
  getFactoryMaterials
};
