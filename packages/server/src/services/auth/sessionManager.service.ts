/**
 * Session Manager Service
 * 
 * This service provides functionality for managing user sessions,
 * including creation, validation, and invalidation.
 */

import { Request } from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger';
import { 
  UserSession,
  createSession,
  getSessionById,
  getSessionByToken,
  updateSession,
  invalidateSession,
  invalidateAllUserSessions,
  updateSessionActivity,
  cleanupExpiredSessions
} from '../../models/userSession.model';
import { supabaseClient } from '../supabase/supabaseClient';
import UAParser from 'ua-parser-js';
import geoip from 'geoip-lite';

/**
 * Extract device information from a request
 * @param req Express request
 * @returns Device information
 */
export function extractDeviceInfo(req: Request): UserSession['deviceInfo'] {
  const rawUserAgent = req.headers['user-agent'];
  const userAgentString = Array.isArray(rawUserAgent) ? rawUserAgent.join('; ') : rawUserAgent || '';
  const ip = req.ip || req.socket.remoteAddress || '';

  try {
    // Parse user agent
    const parser = new UAParser(userAgentString);
    const browser = parser.getBrowser();
    const os = parser.getOS();
    const device = parser.getDevice();
    
    // Get location from IP
    const geo = geoip.lookup(ip);
    
    return {
      browser: `${browser.name || 'Unknown'} ${browser.version || ''}`.trim(),
      os: `${os.name || 'Unknown'} ${os.version || ''}`.trim(),
      device: device.vendor ? `${device.vendor} ${device.model || ''}`.trim() : 'Unknown',
      ip,
      userAgent: userAgentString,
      location: geo ? {
        country: geo.country,
        region: geo.region,
        city: geo.city
      } : undefined
    };
  } catch (error) {
    logger.error(`Failed to extract device info: ${error}`);
    
    // Return basic info if parsing fails
    return {
      browser: 'Unknown',
      os: 'Unknown',
      device: 'Unknown',
      ip: ip, // Use the derived ip
      userAgent: userAgentString
    };
  }
}

/**
 * Create a new session for a user
 * @param userId User ID
 * @param req Express request
 * @param expiresIn Expiration time in seconds
 * @returns Created session and tokens
 */
export async function createUserSession(
  userId: string,
  req: Request,
  expiresIn: number = 86400 // 24 hours
): Promise<{ session: UserSession; token: string; refreshToken: string }> {
  try {
    // Extract device info
    const deviceInfo = extractDeviceInfo(req);

    if (!process.env.JWT_SECRET) {
      logger.error('JWT_SECRET is not defined. Cannot create session tokens.');
      throw new Error('JWT_SECRET is not defined.');
    }
    
    // Generate tokens
    const sessionId = uuidv4();
    const token = jwt.sign(
      {
        userId,
        sessionId,
        type: 'access'
      },
      process.env.JWT_SECRET,
      { expiresIn }
    );
    
    const refreshToken = jwt.sign(
      {
        userId,
        sessionId,
        type: 'refresh'
      },
      process.env.JWT_SECRET,
      { expiresIn: expiresIn * 2 } // Refresh token lasts twice as long
    );
    
    // Calculate expiration date
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiresIn * 1000);
    
    // Create session
    const session = await createSession({
      userId,
      token,
      refreshToken,
      deviceInfo,
      isActive: true,
      lastActiveAt: now,
      expiresAt
    });
    
    return { session, token, refreshToken };
  } catch (error) {
    logger.error(`Failed to create user session: ${error}`);
    throw error;
  }
}

/**
 * Validate a session token
 * @param token Session token
 * @returns User ID if valid, null otherwise
 */
export async function validateSessionToken(token: string): Promise<string | null> {
  try {
    // Verify the token
    if (!process.env.JWT_SECRET) {
      logger.error('JWT_SECRET is not defined. Cannot validate session token.');
      throw new Error('JWT_SECRET is not defined.');
    }
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    ) as { userId: string; sessionId: string; type: string };
    
    if (decoded.type !== 'access') {
      return null;
    }
    
    // Check if the session exists and is active
    const session = await getSessionByToken(token);
    
    if (!session || !session.isActive) {
      return null;
    }
    
    // Update session activity
    await updateSessionActivity(session.id);
    
    return decoded.userId;
  } catch (error) {
    logger.error(`Failed to validate session token: ${error}`);
    return null;
  }
}

/**
 * Refresh a session token
 * @param refreshToken Refresh token
 * @param req Express request
 * @param expiresIn Expiration time in seconds
 * @returns New tokens if valid, null otherwise
 */
export async function refreshSessionToken(
  refreshToken: string,
  req: Request,
  expiresIn: number = 86400 // 24 hours
): Promise<{ token: string; refreshToken: string } | null> {
  try {
    // Verify the refresh token
    if (!process.env.JWT_SECRET) {
      logger.error('JWT_SECRET is not defined. Cannot refresh session token.');
      throw new Error('JWT_SECRET is not defined.');
    }
    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_SECRET
    ) as { userId: string; sessionId: string; type: string };
    
    if (decoded.type !== 'refresh') {
      return null;
    }
    
    // Get the session
    const session = await getSessionById(decoded.sessionId);
    
    if (!session || !session.isActive || session.refreshToken !== refreshToken) {
      return null;
    }
    
    // Generate new tokens
    const token = jwt.sign(
      {
        userId: decoded.userId,
        sessionId: decoded.sessionId,
        type: 'access'
      },
      process.env.JWT_SECRET,
      { expiresIn }
    );
    
    const newRefreshToken = jwt.sign(
      {
        userId: decoded.userId,
        sessionId: decoded.sessionId,
        type: 'refresh'
      },
      process.env.JWT_SECRET,
      { expiresIn: expiresIn * 2 } // Refresh token lasts twice as long
    );
    
    // Calculate new expiration date
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiresIn * 1000);
    
    // Update session
    await updateSession(session.id, {
      token,
      refreshToken: newRefreshToken,
      lastActiveAt: now,
      expiresAt
    });
    
    return { token, refreshToken: newRefreshToken };
  } catch (error) {
    logger.error(`Failed to refresh session token: ${error}`);
    return null;
  }
}

/**
 * Invalidate a user session
 * @param token Session token
 * @param reason Reason for invalidation
 * @returns Whether the session was invalidated
 */
export async function invalidateUserSession(token: string, reason?: string): Promise<boolean> {
  try {
    // Get the session
    const session = await getSessionByToken(token);
    
    if (!session) {
      return false;
    }
    
    // Invalidate the session
    await invalidateSession(session.id, reason);
    
    return true;
  } catch (error) {
    logger.error(`Failed to invalidate user session: ${error}`);
    return false;
  }
}

/**
 * Invalidate all sessions for a user
 * @param userId User ID
 * @param exceptToken Token to exclude
 * @param reason Reason for invalidation
 * @returns Number of sessions invalidated
 */
export async function invalidateAllSessions(
  userId: string,
  exceptToken?: string,
  reason?: string
): Promise<number> {
  try {
    let exceptSessionId: string | undefined;
    
    if (exceptToken) {
      const session = await getSessionByToken(exceptToken);
      if (session) {
        exceptSessionId = session.id;
      }
    }
    
    return await invalidateAllUserSessions(userId, exceptSessionId, reason);
  } catch (error) {
    logger.error(`Failed to invalidate all user sessions: ${error}`);
    throw error;
  }
}

/**
 * Schedule periodic cleanup of expired sessions
 * @param intervalMinutes Interval in minutes
 */
export function scheduleSessionCleanup(intervalMinutes: number = 60): void {
  setInterval(async () => {
    try {
      const count = await cleanupExpiredSessions();
      if (count > 0) {
        logger.info(`Cleaned up ${count} expired sessions`);
      }
    } catch (error) {
      logger.error(`Failed to clean up expired sessions: ${error}`);
    }
  }, intervalMinutes * 60 * 1000);
}

export default {
  extractDeviceInfo,
  createUserSession,
  validateSessionToken,
  refreshSessionToken,
  invalidateUserSession,
  invalidateAllSessions,
  scheduleSessionCleanup
};
