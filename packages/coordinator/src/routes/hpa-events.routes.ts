/**
 * HPA Events Routes
 * 
 * API endpoints for accessing HPA event logs.
 */

import { Router, Request, Response } from 'express';
import { HpaEventLoggerService } from '../services/hpa-event-logger.service';
import { createLogger } from '../utils/logger';

const logger = createLogger('hpa-events-routes');

/**
 * Set up HPA events routes
 */
export function setupHpaEventsRoutes(hpaEventLoggerService: HpaEventLoggerService): Router {
  const router = Router();
  
  /**
   * Get recent HPA events
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
      const events = await hpaEventLoggerService.getRecentEvents(undefined, limit);
      res.status(200).json({ events });
    } catch (error) {
      logger.error('Error getting recent HPA events', { error });
      res.status(500).json({ error: 'Failed to get recent HPA events' });
    }
  });
  
  /**
   * Get recent HPA events for a service
   */
  router.get('/:service', async (req: Request, res: Response) => {
    try {
      const { service } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
      const events = await hpaEventLoggerService.getRecentEvents(service, limit);
      res.status(200).json({ events });
    } catch (error) {
      logger.error('Error getting recent HPA events for service', { error });
      res.status(500).json({ error: 'Failed to get recent HPA events for service' });
    }
  });
  
  /**
   * Get scaling effectiveness for a service
   */
  router.get('/:service/effectiveness', async (req: Request, res: Response) => {
    try {
      const { service } = req.params;
      const effectiveness = await hpaEventLoggerService.getScalingEffectiveness(service);
      res.status(200).json({ service, effectiveness });
    } catch (error) {
      logger.error('Error getting scaling effectiveness for service', { error });
      res.status(500).json({ error: 'Failed to get scaling effectiveness for service' });
    }
  });
  
  return router;
}

export default setupHpaEventsRoutes;
