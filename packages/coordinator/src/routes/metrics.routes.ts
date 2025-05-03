/**
 * Metrics Routes
 * 
 * Exposes metrics in Prometheus format for scraping.
 */

import express, { Request, Response } from 'express';
import { MetricsService } from '../services/metrics.service';

const router = express.Router();

/**
 * @route GET /metrics
 * @description Get metrics in Prometheus format
 * @access Public
 */
export const setupMetricsRoutes = (metricsService: MetricsService) => {
  router.get('/', (_req: Request, res: Response) => {
    res.set('Content-Type', 'text/plain');
    res.send(metricsService.getMetrics());
  });

  return router;
};

export default setupMetricsRoutes;
