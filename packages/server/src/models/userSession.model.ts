/**
 * User Session Model
 * 
 * This model handles the storage and retrieval of user sessions,
 * including device information and login history.
 */

import { supabaseClient } from '../services/supabase/supabaseClient';
import { logger } from '../utils/logger';

/**
 * Represents a user session
 */
export interface UserSession {
  id: string;
  userId: string;
  token: string;
  refreshToken?: string;
  deviceInfo: {
    browser: string;
    os: string;
    device: string;
    ip: string;
    userAgent: string;
    location?: {
      country?: string;
      region?: string;
      city?: string;
    };
  };
  isActive: boolean;
  lastActiveAt: Date;
  createdAt: Date;
  expiresAt: Date;
  invalidatedAt?: Date;
  invalidatedReason?: string;
}

/**
 * Get all sessions for a user
 * @param userId User ID
 * @returns Array of user sessions
 */
export async function getUserSessions(userId: string): Promise<UserSession[]> {
  try {
    const { data, error } = await supabaseClient.getClient()
      .from('user_sessions')
      .select('*')
      .eq('userId', userId)
      .order('createdAt', { ascending: false });

    if (error) {
      logger.error(`Error getting user sessions: ${error.message}`);
      throw error;
    }

    return data || [];
  } catch (error) {
    logger.error(`Failed to get user sessions: ${error}`);
    throw error;
  }
}

/**
 * Get a session by ID
 * @param sessionId Session ID
 * @returns User session or null if not found
 */
export async function getSessionById(sessionId: string): Promise<UserSession | null> {
  try {
    const { data, error } = await supabaseClient.getClient()
      .from('user_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      logger.error(`Error getting session: ${error.message}`);
      throw error;
    }

    return data;
  } catch (error) {
    logger.error(`Failed to get session: ${error}`);
    throw error;
  }
}

/**
 * Get a session by token
 * @param token Session token
 * @returns User session or null if not found
 */
export async function getSessionByToken(token: string): Promise<UserSession | null> {
  try {
    const { data, error } = await supabaseClient.getClient()
      .from('user_sessions')
      .select('*')
      .eq('token', token)
      .eq('isActive', true)
      .gt('expiresAt', new Date().toISOString())
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      logger.error(`Error getting session by token: ${error.message}`);
      throw error;
    }

    return data;
  } catch (error) {
    logger.error(`Failed to get session by token: ${error}`);
    throw error;
  }
}

/**
 * Create a new user session
 * @param session Session data
 * @returns Created user session
 */
export async function createSession(session: Omit<UserSession, 'id' | 'createdAt'>): Promise<UserSession> {
  try {
    const now = new Date();
    const newSession = {
      ...session,
      createdAt: now
    };

    const { data, error } = await supabaseClient.getClient()
      .from('user_sessions')
      .insert([newSession])
      .select();

    if (error) {
      logger.error(`Error creating session: ${error.message}`);
      throw error;
    }

    return data[0];
  } catch (error) {
    logger.error(`Failed to create session: ${error}`);
    throw error;
  }
}

/**
 * Update a user session
 * @param sessionId Session ID
 * @param updates Updates to apply
 * @returns Updated user session
 */
export async function updateSession(
  sessionId: string,
  updates: Partial<Omit<UserSession, 'id' | 'userId' | 'token' | 'createdAt'>>
): Promise<UserSession> {
  try {
    const { data, error } = await supabaseClient.getClient()
      .from('user_sessions')
      .update(updates)
      .eq('id', sessionId)
      .select();

    if (error) {
      logger.error(`Error updating session: ${error.message}`);
      throw error;
    }

    return data[0];
  } catch (error) {
    logger.error(`Failed to update session: ${error}`);
    throw error;
  }
}

/**
 * Invalidate a session
 * @param sessionId Session ID
 * @param reason Reason for invalidation
 * @returns Updated user session
 */
export async function invalidateSession(sessionId: string, reason?: string): Promise<UserSession> {
  try {
    const now = new Date();
    const updates = {
      isActive: false,
      invalidatedAt: now,
      invalidatedReason: reason || 'User logged out'
    };

    return await updateSession(sessionId, updates);
  } catch (error) {
    logger.error(`Failed to invalidate session: ${error}`);
    throw error;
  }
}

/**
 * Invalidate all sessions for a user
 * @param userId User ID
 * @param exceptSessionId Session ID to exclude
 * @param reason Reason for invalidation
 * @returns Number of sessions invalidated
 */
export async function invalidateAllUserSessions(
  userId: string,
  exceptSessionId?: string,
  reason?: string
): Promise<number> {
  try {
    const now = new Date();
    const updates = {
      isActive: false,
      invalidatedAt: now,
      invalidatedReason: reason || 'User logged out from all devices'
    };

    let query = supabaseClient.getClient()
      .from('user_sessions')
      .update(updates)
      .eq('userId', userId)
      .eq('isActive', true);

    if (exceptSessionId) {
      query = query.neq('id', exceptSessionId);
    }

    const { data, error } = await query;

    if (error) {
      logger.error(`Error invalidating user sessions: ${error.message}`);
      throw error;
    }

    return data?.length || 0;
  } catch (error) {
    logger.error(`Failed to invalidate user sessions: ${error}`);
    throw error;
  }
}

/**
 * Update session activity
 * @param sessionId Session ID
 * @returns Updated user session
 */
export async function updateSessionActivity(sessionId: string): Promise<UserSession> {
  try {
    const now = new Date();
    return await updateSession(sessionId, { lastActiveAt: now });
  } catch (error) {
    logger.error(`Failed to update session activity: ${error}`);
    throw error;
  }
}

/**
 * Clean up expired sessions
 * @returns Number of sessions cleaned up
 */
export async function cleanupExpiredSessions(): Promise<number> {
  try {
    const now = new Date();
    const { data, error } = await supabaseClient.getClient()
      .from('user_sessions')
      .update({ isActive: false, invalidatedReason: 'Session expired' })
      .eq('isActive', true)
      .lt('expiresAt', now.toISOString());

    if (error) {
      logger.error(`Error cleaning up expired sessions: ${error.message}`);
      throw error;
    }

    return data?.length || 0;
  } catch (error) {
    logger.error(`Failed to clean up expired sessions: ${error}`);
    throw error;
  }
}

export default {
  getUserSessions,
  getSessionById,
  getSessionByToken,
  createSession,
  updateSession,
  invalidateSession,
  invalidateAllUserSessions,
  updateSessionActivity,
  cleanupExpiredSessions
};
