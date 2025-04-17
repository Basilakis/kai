/**
 * Credit Routes Index
 * 
 * This file exports all credit-related routes.
 */

import express from 'express';
import bulkRoutes from './bulk.routes';
import topupRoutes from './topup.routes';
import alertRoutes from './alert.routes';
import transferRoutes from './transfer.routes';

const router = express.Router();

// Mount the credit sub-routes
router.use('/bulk', bulkRoutes);
router.use('/topup', topupRoutes);
router.use('/alerts', alertRoutes);
router.use('/transfer', transferRoutes);

export default router;
