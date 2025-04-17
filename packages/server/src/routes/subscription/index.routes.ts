/**
 * Subscription Routes Index
 * 
 * This file exports all subscription-related routes.
 */

import express from 'express';
import prorationRoutes from './proration.routes';
import pauseRoutes from './pause.routes';
import teamRoutes from './team.routes';

const router = express.Router();

// Mount the subscription sub-routes
router.use('/proration', prorationRoutes);
router.use('/pause', pauseRoutes);
router.use('/teams', teamRoutes);

export default router;
