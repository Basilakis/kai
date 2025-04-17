/**
 * Session Controller
 * 
 * This controller handles API endpoints for managing user sessions,
 * including listing, revoking, and device invalidation.
 */

import { Request, Response } from 'express';
import { logger } from '../../utils/logger';
import { ApiError } from '../../middleware/error.middleware';
import { getUserSessions } from '../../models/userSession.model';
import sessionManager from '../../services/auth/sessionManager.service';

/**
 * Get all sessions for the current user
 * @route GET /api/auth/sessions
 * @access Private
 */
export const getUserSessionsHandler = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    
    // Get all sessions for the user
    const sessions = await getUserSessions(userId);
    
    // Remove sensitive data
    const sanitizedSessions = sessions.map(session => ({
      id: session.id,
      deviceInfo: session.deviceInfo,
      isActive: session.isActive,
      lastActiveAt: session.lastActiveAt,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      invalidatedAt: session.invalidatedAt,
      invalidatedReason: session.invalidatedReason,
      isCurrent: session.token === req.token
    }));
    
    res.status(200).json({
      success: true,
      data: sanitizedSessions
    });
  } catch (error) {
    logger.error(`Error getting user sessions: ${error}`);
    throw new ApiError(500, 'Failed to get user sessions');
  }
};

/**
 * Revoke a specific session
 * @route DELETE /api/auth/sessions/:sessionId
 * @access Private
 */
export const revokeSession = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const { sessionId } = req.params;
    
    // Get all sessions for the user
    const sessions = await getUserSessions(userId);
    
    // Find the session
    const session = sessions.find(s => s.id === sessionId);
    
    if (!session) {
      throw new ApiError(404, 'Session not found');
    }
    
    // Check if trying to revoke current session
    if (session.token === req.token) {
      throw new ApiError(400, 'Cannot revoke current session. Use logout instead.');
    }
    
    // Invalidate the session
    await sessionManager.invalidateUserSession(session.token, 'Manually revoked by user');
    
    res.status(200).json({
      success: true,
      message: 'Session revoked successfully'
    });
  } catch (error) {
    logger.error(`Error revoking session: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to revoke session');
  }
};

/**
 * Revoke all sessions except the current one
 * @route DELETE /api/auth/sessions
 * @access Private
 */
export const revokeAllSessions = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    
    // Invalidate all sessions except the current one
    const count = await sessionManager.invalidateAllSessions(
      userId,
      req.token,
      'Manually revoked by user'
    );
    
    res.status(200).json({
      success: true,
      message: `Successfully revoked ${count} sessions`,
      data: { count }
    });
  } catch (error) {
    logger.error(`Error revoking all sessions: ${error}`);
    throw new ApiError(500, 'Failed to revoke sessions');
  }
};

/**
 * Refresh the current session token
 * @route POST /api/auth/sessions/refresh
 * @access Public (with refresh token)
 */
export const refreshSession = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      throw new ApiError(400, 'Refresh token is required');
    }
    
    // Refresh the session token
    const result = await sessionManager.refreshSessionToken(refreshToken, req);
    
    if (!result) {
      throw new ApiError(401, 'Invalid or expired refresh token');
    }
    
    res.status(200).json({
      success: true,
      data: {
        token: result.token,
        refreshToken: result.refreshToken
      }
    });
  } catch (error) {
    logger.error(`Error refreshing session: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to refresh session');
  }
};

export default {
  getUserSessionsHandler,
  revokeSession,
  revokeAllSessions,
  refreshSession
};
