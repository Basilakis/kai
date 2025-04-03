import { ModelEndpoints } from './types';
import { BaseThreeDProvider } from './baseProvider';
import { NeRFProvider } from './nerfProvider';
import { ArchitecturalProvider } from './architecturalProvider';
import { HouseGenerationProvider } from './houseGenerationProvider';

// Export all types
export * from './types';

// Export providers
export { BaseThreeDProvider } from './baseProvider';
export { NeRFProvider } from './nerfProvider';
export { ArchitecturalProvider } from './architecturalProvider';
export { HouseGenerationProvider } from './houseGenerationProvider';

/**
 * Create a 3D provider instance
 */
export function createProvider(
  type: '3d' | 'nerf' | 'architectural' | 'house',
  modelEndpoints: ModelEndpoints
): BaseThreeDProvider {
  switch (type) {
    case 'nerf':
      return new NeRFProvider(modelEndpoints);
    case 'architectural':
      return new ArchitecturalProvider(modelEndpoints);
    case 'house':
      return new HouseGenerationProvider(modelEndpoints);
    case '3d':
    default:
      // Default to NeRF provider as it's the most basic
      return new NeRFProvider(modelEndpoints);
  }
}

// Re-export logger for convenience
export { logger } from '../../utils/logger';