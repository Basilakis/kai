/**
 * Credentials Routes
 * 
 * API routes for managing crawler service credentials
 */

import { Router } from 'express';
import { getCredentialsStatus, setCredentials, testCredentials, deleteCredentials } from '../controllers/credentials.controller';
import { authMiddleware, authorizeRoles } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';

const router = Router();

/**
 * @route   GET /api/credentials
 * @desc    Get status of all crawler service credentials
 * @access  Private (Admin)
 */
router.get(
  '/',
  authMiddleware,
  authorizeRoles(['admin']),
  asyncHandler(getCredentialsStatus)
);

/**
 * @route   POST /api/credentials/:provider
 * @desc    Set credentials for a specific provider
 * @access  Private (Admin)
 */
router.post(
  '/:provider',
  authMiddleware,
  authorizeRoles(['admin']),
  asyncHandler(setCredentials)
);

/**
 * @route   POST /api/credentials/:provider/test
 * @desc    Test credentials for a specific provider
 * @access  Private (Admin)
 */
router.post(
  '/:provider/test',
  authMiddleware,
  authorizeRoles(['admin']),
  asyncHandler(testCredentials)
);

/**
 * @route   DELETE /api/credentials/:provider
 * @desc    Delete credentials for a specific provider
 * @access  Private (Admin)
 */
router.delete(
  '/:provider',
  authMiddleware,
  authorizeRoles(['admin']),
  asyncHandler(deleteCredentials)
);

export default router;