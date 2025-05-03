/**
 * Predictive Scaling Routes
 * 
 * API endpoints for managing predictive scaling service load patterns.
 */

import { Router, Request, Response } from 'express';
import { PredictiveScalingService, ServiceLoadPattern } from '../services/predictive-scaling.service';
import { createLogger } from '../utils/logger';

const logger = createLogger('predictive-scaling-routes');

/**
 * Set up predictive scaling routes
 */
export function setupPredictiveScalingRoutes(predictiveScalingService: PredictiveScalingService): Router {
  const router = Router();
  
  /**
   * Get all service load patterns
   */
  router.get('/patterns', async (req: Request, res: Response) => {
    try {
      const patterns = await predictiveScalingService.getServiceLoadPatterns();
      res.status(200).json({ patterns });
    } catch (error) {
      logger.error('Error getting service load patterns', { error });
      res.status(500).json({ error: 'Failed to get service load patterns' });
    }
  });
  
  /**
   * Get service load pattern
   */
  router.get('/patterns/:service', async (req: Request, res: Response) => {
    try {
      const { service } = req.params;
      const pattern = await predictiveScalingService.getServiceLoadPattern(service);
      
      if (!pattern) {
        return res.status(404).json({ error: 'Service load pattern not found' });
      }
      
      res.status(200).json({ pattern });
    } catch (error) {
      logger.error('Error getting service load pattern', { error });
      res.status(500).json({ error: 'Failed to get service load pattern' });
    }
  });
  
  /**
   * Create or update service load pattern
   */
  router.post('/patterns/:service', async (req: Request, res: Response) => {
    try {
      const { service } = req.params;
      const { patternType, timeWindows } = req.body;
      
      if (!patternType || !timeWindows || !Array.isArray(timeWindows)) {
        return res.status(400).json({ error: 'Invalid request body' });
      }
      
      // Validate time windows
      for (const window of timeWindows) {
        if (typeof window.expectedLoad !== 'number' || window.expectedLoad < 0 || window.expectedLoad > 1) {
          return res.status(400).json({ error: 'Invalid expected load value' });
        }
      }
      
      const pattern: ServiceLoadPattern = {
        service,
        patternType,
        timeWindows,
        lastUpdated: Date.now()
      };
      
      await predictiveScalingService.setServiceLoadPattern(pattern);
      
      res.status(200).json({ pattern });
    } catch (error) {
      logger.error('Error setting service load pattern', { error });
      res.status(500).json({ error: 'Failed to set service load pattern' });
    }
  });
  
  /**
   * Delete service load pattern
   */
  router.delete('/patterns/:service', async (req: Request, res: Response) => {
    try {
      const { service } = req.params;
      await predictiveScalingService.deleteServiceLoadPattern(service);
      res.status(204).end();
    } catch (error) {
      logger.error('Error deleting service load pattern', { error });
      res.status(500).json({ error: 'Failed to delete service load pattern' });
    }
  });
  
  /**
   * Get recent predictions
   */
  router.get('/predictions', async (req: Request, res: Response) => {
    try {
      const predictions = await predictiveScalingService.getPendingPredictions();
      res.status(200).json({ predictions });
    } catch (error) {
      logger.error('Error getting predictions', { error });
      res.status(500).json({ error: 'Failed to get predictions' });
    }
  });
  
  return router;
}

export default setupPredictiveScalingRoutes;
