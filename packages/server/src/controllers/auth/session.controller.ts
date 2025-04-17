/**
 * Session Controller
 * 
 * This controller handles API endpoints for managing user sessions,
 * including registration, login, logout, session management, and email verification.
 */

import { Request, Response, NextFunction } from 'express'; // Added NextFunction
import { logger } from '../../utils/logger';
import { ApiError } from '../../middleware/error.middleware';
import { getUserSessions } from '../../models/userSession.model';
import sessionManager from '../../services/auth/sessionManager.service';


// --- Registration, Login, Logout ---

/**
 * Register a new user
 * @route POST /api/auth/register
 * @access Public
 */
export const registerUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Extract user data from request
    const { name, email, password, confirmPassword } = req.body;
    
    // Basic validation
    if (!name || !email || !password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }
    
    // Validate password strength
    const passwordRegex = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[a-zA-Z]).{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters with at least 1 number, 1 uppercase and 1 lowercase letter'
      });
    }
    
    // Check if passwords match
    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match'
      });
    }
    
    // Check if user already exists
    // In a real implementation, this would query a database
    // For this implementation, we'll simulate a database check
    const existingUser = false; // Simulated check
    
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }
    
    // Create user in database
    // In a real implementation, this would hash the password and save the user
    // For this implementation, we'll simulate user creation
    const userId = 'usr_' + Math.random().toString(36).substring(2, 15);
    
    // Generate verification token
    const verificationToken = Math.random().toString(36).substring(2, 15);
    
    // Send verification email
    // In a real implementation, this would use an email service
    logger.info(`Verification email would be sent to ${email} with token ${verificationToken}`);
    
    // Return success response
    res.status(201).json({
      success: true,
      message: 'User registered successfully. Please check your email to verify your account.',
      data: {
        userId
      }
    });
  } catch (error) {
    logger.error(`Registration error: ${error}`);
    next(error);
  }
};

/**
 * Authenticate user & get token (Login)
 * @route POST /api/auth/login
 * @access Public
 */
export const loginUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Extract login credentials
    const { email, password } = req.body;
    
    // Basic validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }
    
    // In a real implementation, find user in database and validate credentials
    // For this implementation, we'll simulate user lookup and validation
    const userExists = true; // Simulated check
    const passwordIsCorrect = true; // Simulated check
    const userIsVerified = true; // Simulated check
    const userId = 'usr_' + Math.random().toString(36).substring(2, 15);
    
    // Check if user exists
    if (!userExists) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    // Check if password is correct
    if (!passwordIsCorrect) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    // Check if email is verified
    if (!userIsVerified) {
      return res.status(401).json({
        success: false,
        message: 'Email not verified. Please check your email for verification link.'
      });
    }
    
    // Check if 2FA is enabled for user
    const twoFactorEnabled = false; // Simulated check
    
    if (twoFactorEnabled) {
      // Generate and send 2FA code
      const tfaToken = Math.random().toString(36).substring(2, 8);
      
      // In a real implementation, this would send the code via SMS or email
      logger.info(`2FA code would be sent: ${tfaToken}`);
      
      return res.status(200).json({
        success: true,
        message: '2FA code sent. Please enter the code to complete login.',
        requiresTwoFactor: true
      });
    }
    
    // Create user session
    // In a real implementation, this would use sessionManager to create a token
    // For this implementation, we'll create a simulated token
    const token = 'JWT_' + Math.random().toString(36).substring(2, 15);
    const refreshToken = 'REFRESH_' + Math.random().toString(36).substring(2, 15);
    
    // Set token in cookie if appropriate
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000 // 1 day
    });
    
    // Return user data and tokens
    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        userId,
        token,
        refreshToken
      }
    });
  } catch (error) {
    logger.error(`Login error: ${error}`);
    next(error);
  }
};

/**
 * Logout user / invalidate session
 * @route POST /api/auth/logout
 * @access Private
 */
export const logoutUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.token;
    
    // Check if token exists
    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'No active session found'
      });
    }
    
    // Invalidate session using session manager
    // In a real implementation, this would invalidate the token in database
    await sessionManager.invalidateUserSession(token, 'User logout');
    
    // Clear token cookie
    res.clearCookie('token');
    
    // Return success
    res.status(200).json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    logger.error(`Logout error: ${error}`);
    next(error);
  }
};

// --- Email Verification ---

/**
 * Verify email address using token
 * @route GET /api/auth/verify-email/:verificationToken
 * @access Public
 */
export const verifyEmailHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { verificationToken } = req.params;
    
    if (!verificationToken) {
      return res.status(400).json({
        success: false,
        message: 'Verification token is required'
      });
    }
    
    // In a real implementation, find the token in database and validate it
    // For this implementation, we'll simulate token validation
    const isValidToken = true; // Simulated check
    const isExpired = false; // Simulated check
    
    // Check if token is valid
    if (!isValidToken) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification token'
      });
    }
    
    // Check if token is expired
    if (isExpired) {
      return res.status(400).json({
        success: false,
        message: 'Verification token has expired. Please request a new one.'
      });
    }
    
    // Update user's email verification status
    // In a real implementation, this would update the user record in database
    // For this implementation, we'll simulate database update
    logger.info(`User email would be verified with token: ${verificationToken}`);
    
    // Return success
    res.status(200).json({
      success: true,
      message: 'Email verified successfully. You can now log in.'
    });
  } catch (error) {
    logger.error(`Email verification error: ${error}`);
    next(error);
  }
};


// --- Session Management ---

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

// No default export needed when using named exports
