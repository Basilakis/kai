/**
 * Session Routes
 * 
 * This file defines the routes for session management,
 * including listing, revoking, and refreshing sessions.
 */

import express from 'express';
import { asyncHandler } from '../../middleware/error.middleware';
import { authMiddleware } from '../../middleware/auth.middleware';
import sessionController from '../../controllers/auth/session.controller';

const router = express.Router();

/**
 * @route   GET /api/auth/sessions
 * @desc    Get all sessions for the current user
 * @access  Private
 */
router.get(
  '/',
  authMiddleware,
  asyncHandler(sessionController.getUserSessionsHandler)
);

/**
 * @route   DELETE /api/auth/sessions/:sessionId
 * @desc    Revoke a specific session
 * @access  Private
 */
router.delete(
  '/:sessionId',
  authMiddleware,
  asyncHandler(sessionController.revokeSession)
);

/**
 * @route   DELETE /api/auth/sessions
 * @desc    Revoke all sessions except the current one
 * @access  Private
 */
router.delete(
  '/',
  authMiddleware,
  asyncHandler(sessionController.revokeAllSessions)
);

/**
 * @route   POST /api/auth/sessions/refresh
 * @desc    Refresh the current session token
 * @access  Public (with refresh token)
 */
router.post(
  '/refresh',
  asyncHandler(sessionController.refreshSession)
);

export default router;
