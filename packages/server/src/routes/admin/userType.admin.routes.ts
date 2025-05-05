/**
 * User Type Admin Routes
 * 
 * Routes for managing user types (user, factory, b2b, admin)
 */

import express from 'express';
import { asyncHandler } from '../../middleware/error.middleware';
import { authMiddleware } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/auth.middleware';
import { NetworkAccessType } from '../../services/networkAccess/networkAccessTypes';
import userTypeAdminController from '../../controllers/admin/userType.admin.controller';

const router = express.Router();

// Apply admin authentication and network restriction to all routes in this file
router.use(authMiddleware, authorize({ 
  roles: ['admin'], 
  accessType: NetworkAccessType.INTERNAL_ONLY 
}));

/**
 * @route   GET /api/admin/user-types
 * @desc    Get all users with their types
 * @access  Admin
 */
router.get('/', asyncHandler(userTypeAdminController.getAllUsers));

/**
 * @route   GET /api/admin/user-types/:id
 * @desc    Get a user by ID
 * @access  Admin
 */
router.get('/:id', asyncHandler(userTypeAdminController.getUserById));

/**
 * @route   PUT /api/admin/user-types/:id
 * @desc    Update a user's type
 * @access  Admin
 */
router.put('/:id', asyncHandler(userTypeAdminController.updateUserType));

export default router;
