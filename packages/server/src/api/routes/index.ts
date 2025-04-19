/**
 * API Routes
 * 
 * This module exports all API routes for the application.
 */

import { Router } from 'express';
import authRoutes from './auth';
import userRoutes from './user';
import adminRoutes from './admin';
import notificationRoutes from './notifications';
import webhookRoutes from './webhooks';

const router = Router();

// Mount routes
router.use('/auth', authRoutes);
router.use('/user', userRoutes);
router.use('/admin', adminRoutes);
router.use('/notifications', notificationRoutes);
router.use('/webhooks', webhookRoutes);

export default router;
