/**
 * Scaling Dependencies Routes
 * 
 * API endpoints for managing scaling dependencies between services.
 */

import { Router, Request, Response } from 'express';
import { ScalingDependenciesService, ScalingDependency } from '../services/scaling-dependencies.service';
import { createLogger } from '../utils/logger';

const logger = createLogger('scaling-dependencies-routes');

/**
 * Set up scaling dependencies routes
 */
export function setupScalingDependenciesRoutes(scalingDependenciesService: ScalingDependenciesService): Router {
  const router = Router();
  
  /**
   * Get all scaling dependencies
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const dependencies = await scalingDependenciesService.getDependencies();
      res.status(200).json({ dependencies });
    } catch (error) {
      logger.error('Error getting scaling dependencies', { error });
      res.status(500).json({ error: 'Failed to get scaling dependencies' });
    }
  });
  
  /**
   * Get a specific scaling dependency
   */
  router.get('/:sourceService/:targetService', async (req: Request, res: Response) => {
    try {
      const { sourceService, targetService } = req.params;
      const dependency = await scalingDependenciesService.getDependency(sourceService, targetService);
      
      if (!dependency) {
        return res.status(404).json({ error: 'Scaling dependency not found' });
      }
      
      res.status(200).json({ dependency });
    } catch (error) {
      logger.error('Error getting scaling dependency', { error });
      res.status(500).json({ error: 'Failed to get scaling dependency' });
    }
  });
  
  /**
   * Create or update a scaling dependency
   */
  router.post('/:sourceService/:targetService', async (req: Request, res: Response) => {
    try {
      const { sourceService, targetService } = req.params;
      const { dependencyType, ratio, fixedReplicas, minReplicas, enabled } = req.body;
      
      if (!dependencyType) {
        return res.status(400).json({ error: 'Missing dependency type' });
      }
      
      // Validate dependency type
      if (!['proportional', 'fixed', 'minimum'].includes(dependencyType)) {
        return res.status(400).json({ error: 'Invalid dependency type' });
      }
      
      // Validate parameters based on dependency type
      if (dependencyType === 'proportional' && (typeof ratio !== 'number' || ratio <= 0)) {
        return res.status(400).json({ error: 'Invalid ratio for proportional dependency' });
      }
      
      if (dependencyType === 'fixed' && (typeof fixedReplicas !== 'number' || fixedReplicas <= 0)) {
        return res.status(400).json({ error: 'Invalid fixed replicas for fixed dependency' });
      }
      
      if (dependencyType === 'minimum' && (typeof minReplicas !== 'number' || minReplicas <= 0)) {
        return res.status(400).json({ error: 'Invalid minimum replicas for minimum dependency' });
      }
      
      // Create dependency object
      const dependency: ScalingDependency = {
        sourceService,
        targetService,
        dependencyType,
        ratio: dependencyType === 'proportional' ? ratio : undefined,
        fixedReplicas: dependencyType === 'fixed' ? fixedReplicas : undefined,
        minReplicas: dependencyType === 'minimum' ? minReplicas : undefined,
        enabled: enabled !== false, // Default to true if not specified
        lastUpdated: Date.now()
      };
      
      // Set dependency
      await scalingDependenciesService.setDependency(dependency);
      
      res.status(200).json({ dependency });
    } catch (error) {
      logger.error('Error setting scaling dependency', { error });
      res.status(500).json({ error: 'Failed to set scaling dependency' });
    }
  });
  
  /**
   * Delete a scaling dependency
   */
  router.delete('/:sourceService/:targetService', async (req: Request, res: Response) => {
    try {
      const { sourceService, targetService } = req.params;
      await scalingDependenciesService.deleteDependency(sourceService, targetService);
      res.status(204).end();
    } catch (error) {
      logger.error('Error deleting scaling dependency', { error });
      res.status(500).json({ error: 'Failed to delete scaling dependency' });
    }
  });
  
  /**
   * Enable a scaling dependency
   */
  router.post('/:sourceService/:targetService/enable', async (req: Request, res: Response) => {
    try {
      const { sourceService, targetService } = req.params;
      const dependency = await scalingDependenciesService.getDependency(sourceService, targetService);
      
      if (!dependency) {
        return res.status(404).json({ error: 'Scaling dependency not found' });
      }
      
      // Enable dependency
      dependency.enabled = true;
      dependency.lastUpdated = Date.now();
      
      await scalingDependenciesService.setDependency(dependency);
      
      res.status(200).json({ dependency });
    } catch (error) {
      logger.error('Error enabling scaling dependency', { error });
      res.status(500).json({ error: 'Failed to enable scaling dependency' });
    }
  });
  
  /**
   * Disable a scaling dependency
   */
  router.post('/:sourceService/:targetService/disable', async (req: Request, res: Response) => {
    try {
      const { sourceService, targetService } = req.params;
      const dependency = await scalingDependenciesService.getDependency(sourceService, targetService);
      
      if (!dependency) {
        return res.status(404).json({ error: 'Scaling dependency not found' });
      }
      
      // Disable dependency
      dependency.enabled = false;
      dependency.lastUpdated = Date.now();
      
      await scalingDependenciesService.setDependency(dependency);
      
      res.status(200).json({ dependency });
    } catch (error) {
      logger.error('Error disabling scaling dependency', { error });
      res.status(500).json({ error: 'Failed to disable scaling dependency' });
    }
  });
  
  return router;
}

export default setupScalingDependenciesRoutes;
