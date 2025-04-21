/**
 * Analytics Routes Index
 *
 * This file exports all analytics-related routes.
 */

import express from 'express';
import responseQualityRoutes from './response-quality.routes';
import modelImprovementRoutes from './model-improvement.routes';

const router = express.Router();

// Mount the analytics sub-routes
router.use('/response-quality', responseQualityRoutes);
router.use('/model-improvement', modelImprovementRoutes);

export default router;
