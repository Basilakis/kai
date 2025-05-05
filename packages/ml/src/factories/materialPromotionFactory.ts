/**
 * Material Promotion Integration Factory
 * 
 * This factory creates and configures the MaterialPromotionIntegration
 * for use with the 3D model generation process.
 */

import { MaterialPromotionIntegration } from '../material-promotion-integration';
import { MaterialService, VectorService } from '../types/services';

// Singleton instance
let instance: MaterialPromotionIntegration | null = null;

/**
 * Create or get the MaterialPromotionIntegration instance
 * @param materialService Material service instance
 * @param vectorService Vector service instance
 * @returns MaterialPromotionIntegration instance
 */
export function getMaterialPromotionIntegration(
  materialService: MaterialService,
  vectorService: VectorService
): MaterialPromotionIntegration {
  if (!instance) {
    instance = new MaterialPromotionIntegration(materialService, vectorService);
  }
  return instance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetMaterialPromotionIntegration(): void {
  instance = null;
}

export default {
  getMaterialPromotionIntegration,
  resetMaterialPromotionIntegration
};
