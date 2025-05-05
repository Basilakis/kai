/**
 * Factory Routes
 *
 * Main router for factory-specific functionality.
 */

import express from 'express';
import { asyncHandler } from '../middleware/error.middleware';
import { authMiddleware } from '../middleware/auth.middleware';
import { authorize } from '../middleware/auth.middleware';
import { NetworkAccessType } from '../services/networkAccess/networkAccessTypes';
import { requireModuleAccess } from '../middleware/module-access.middleware';

// Import factory routes
import materialPromotionRoutes from './factory/materialPromotion.routes';

const router = express.Router();

// Apply factory authentication and module access to all routes in this file
router.use(
  authMiddleware,
  authorize({
    userTypes: ['factory'],
    accessType: NetworkAccessType.AUTHENTICATED
  }),
  requireModuleAccess('materialPromotion')
);

// Basic factory info endpoint
router.get('/', asyncHandler(async (req, res) => {
  res.json({
    success: true,
    message: 'Factory API',
    user: {
      id: req.user!.id,
      email: req.user!.email,
      userType: req.user!.userType
    }
  });
}));

// Mount the submodule routes
router.use('/', materialPromotionRoutes);

export default router;
