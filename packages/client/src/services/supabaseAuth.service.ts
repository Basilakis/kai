/**
 * Supabase Authentication Service
 * 
 * Provides authentication functions using Supabase Auth
 * including social login providers (Google, Facebook, X/Twitter)
 */

import { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { supabaseClient } from './supabaseClient';
import { setAuthToken, setAuthUser, clearAuthToken, clearAuthUser } from './auth.service';

/**
 * Supabase user interface
 */
export interface SupabaseUser {
  id: string;
  email: string;
  username?: string;
  full_name?: string;
  avatar_url?: string;
  provider?: string;
  role?: string;
}

/**
 * Authentication error type
 */
export interface AuthError {
  message: string;
  status?: number;
}

/**
 * Signup with email/password
 * @param email User's email
 * @param password User's password
 * @returns The user or null if error
 */
export const signUp = async (
  email: string,
  password: string
): Promise<{ user: SupabaseUser | null; error: AuthError | null }> => {
  try {
    const { data, error } = await supabaseClient.getClient().auth.signUp({
      email,
      password
    });

    if (error) {
      return { user: null, error: { message: error.message } };
    }

    if (!data?.user) {
      return { user: null, error: { message: 'Signup successful. Please check your email to confirm your account.' } };
    }

    // Convert Supabase user to our user format
    const user: SupabaseUser = {
      id: data.user.id,
      email: data.user.email || '',
      username: data.user.email?.split('@')[0] || '',
      avatar_url: data.user.user_metadata?.avatar_url,
      provider: 'email',
      role: 'user'
    };

    // Store session
    if (data.session) {
      handleSession(data.session, user);
    }

    return { user, error: null };
  } catch (err) {
    console.error('Signup error:', err);
    return { 
      user: null, 
      error: { message: err instanceof Error ? err.message : 'An unknown error occurred during signup' }
    };
  }
};

/**
 * Login with email/password
 * @param email User's email
 * @param password User's password
 * @param rememberMe Whether to persist session across browser restarts
 * @returns The user or null if error
 */
export const signIn = async (
  email: string,
  password: string,
  rememberMe: boolean = false
): Promise<{ user: SupabaseUser | null; error: AuthError | null }> => {
  try {
    // Set the session persistence based on remember me option
    const persistenceSettings: { persistSession: boolean } = {
      persistSession: rememberMe
    };

    const { data, error } = await supabaseClient.getClient().auth.signInWithPassword({
      email,
      password,
      options: persistenceSettings
    });

    if (error) {
      return { user: null, error: { message: error.message } };
    }

    if (!data?.user) {
      return { user: null, error: { message: 'Login failed' } };
    }

    // Convert Supabase user to our user format
    const user: SupabaseUser = {
      id: data.user.id,
      email: data.user.email || '',
      username: data.user.email?.split('@')[0] || '',
      avatar_url: data.user.user_metadata?.avatar_url,
      full_name: data.user.user_metadata?.full_name,
      provider: 'email',
      role: data.user.app_metadata?.role || 'user'
    };

    // Store session
    if (data.session) {
      handleSession(data.session, user);
    }

    return { user, error: null };
  } catch (err) {
    console.error('Login error:', err);
    return { 
      user: null, 
      error: { message: err instanceof Error ? err.message : 'An unknown error occurred during login' }
    };
  }
};

/**
 * Sign in with a social provider
 * @param provider The provider to use ('google', 'facebook', or 'twitter')
 * @param rememberMe Whether to persist session across browser restarts
 * @returns Void - redirects to provider auth page
 */
export const signInWithSocialProvider = async (
  provider: 'google' | 'facebook' | 'twitter',
  rememberMe: boolean = false
): Promise<void> => {
  // Check if rememberMe was stored in localStorage before redirect
  const storedRememberMe = localStorage.getItem('auth_remember_me');
  if (storedRememberMe) {
    rememberMe = storedRememberMe === 'true';
    // Clear the stored preference
    localStorage.removeItem('auth_remember_me');
  }

  const { error } = await supabaseClient.getClient().auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      persistSession: rememberMe
    }
  });

  if (error) {
    console.error(`${provider} login error:`, error);
    throw new Error(error.message);
  }
};

/**
 * Sign out the current user
 */
export const signOut = async (): Promise<{ error: AuthError | null }> => {
  try {
    const { error } = await supabaseClient.getClient().auth.signOut();
    
    if (error) {
      return { error: { message: error.message } };
    }

    // Clear local auth
    clearAuthToken();
    clearAuthUser();

    return { error: null };
  } catch (err) {
    console.error('Logout error:', err);
    return { 
      error: { message: err instanceof Error ? err.message : 'An unknown error occurred during logout' }
    };
  }
};

/**
 * Get the current session
 * @returns The current session if any
 */
export const getCurrentSession = async (): Promise<Session | null> => {
  const { data, error } = await supabaseClient.getClient().auth.getSession();
  
  if (error) {
    console.error('Error getting session:', error);
    return null;
  }

  return data.session;
};

/**
 * Get the current user from Supabase
 * @returns The current user if logged in
 */
export const getCurrentUser = async (): Promise<SupabaseUser | null> => {
  const { data, error } = await supabaseClient.getClient().auth.getUser();
  
  if (error || !data?.user) {
    return null;
  }

  // Convert Supabase user to our user format
  const user: SupabaseUser = {
    id: data.user.id,
    email: data.user.email || '',
    username: data.user.email?.split('@')[0] || '',
    avatar_url: data.user.user_metadata?.avatar_url,
    full_name: data.user.user_metadata?.full_name,
    provider: data.user.app_metadata?.provider || 'email',
    role: data.user.app_metadata?.role || 'user'
  };

  return user;
};

/**
 * Send a password reset email
 * @param email User's email
 */
export const resetPassword = async (email: string): Promise<{ error: AuthError | null }> => {
  try {
    const { error } = await supabaseClient.getClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`
    });

    if (error) {
      return { error: { message: error.message } };
    }

    return { error: null };
  } catch (err) {
    console.error('Password reset error:', err);
    return { 
      error: { message: err instanceof Error ? err.message : 'An unknown error occurred during password reset' }
    };
  }
};

/**
 * Update the user's password
 * @param newPassword The new password
 */
export const updatePassword = async (newPassword: string): Promise<{ error: AuthError | null }> => {
  try {
    const { error } = await supabaseClient.getClient().auth.updateUser({
      password: newPassword
    });

    if (error) {
      return { error: { message: error.message } };
    }

    return { error: null };
  } catch (err) {
    console.error('Password update error:', err);
    return { 
      error: { message: err instanceof Error ? err.message : 'An unknown error occurred during password update' }
    };
  }
};

/**
 * Handle the auth session and store the token and user
 * @param session The Supabase session
 * @param user The user data
 */
const handleSession = (session: Session, user: SupabaseUser) => {
  // Store the token and user data
  setAuthToken(session.access_token);
  setAuthUser({
    id: user.id,
    username: user.username || user.email.split('@')[0] || '',
    email: user.email,
    role: user.role || 'user'
  });
};

/**
 * Set up automatic token refresh
 * This will attempt to refresh the token before it expires
 * @returns Cleanup function to remove event listeners
 */
export const setupTokenRefresh = (): (() => void) => {
  // Check token validity every 5 minutes
  const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds
  
  const refreshToken = async () => {
    try {
      const session = await getCurrentSession();
      
      if (session) {
        // Calculate time until token expires (in seconds)
        const expiresIn = session.expires_at ? 
          session.expires_at - Math.floor(Date.now() / 1000) : 
          0;
        
        // If token expires in less than 10 minutes, refresh it
        if (expiresIn < 600) {
          const { error } = await supabaseClient.getClient().auth.refreshSession();
          if (error) {
            console.error('Error refreshing token:', error);
          }
        }
      }
    } catch (err) {
      console.error('Token refresh error:', err);
    }
  };
  
  // Set up interval to check and refresh token
  const intervalId = setInterval(refreshToken, REFRESH_INTERVAL);
  
  // Also refresh on page focus
  window.addEventListener('focus', refreshToken);
  
  // Provide cleanup function if needed
  return () => {
    clearInterval(intervalId);
    window.removeEventListener('focus', refreshToken);
  };
};

/**
 * Initialize auth listener for session changes
 * @param onAuthStateChange Callback for auth state changes
 */
export const initAuthListener = (
  onAuthStateChange: (user: SupabaseUser | null) => void
) => {
  const { data } = supabaseClient.getClient().auth.onAuthStateChange(
    async (event: AuthChangeEvent, session: Session | null) => {
      if (event === 'SIGNED_IN' && session) {
        const user = await getCurrentUser();
        if (user) {
          handleSession(session, user);
          onAuthStateChange(user);
        }
      } else if (event === 'SIGNED_OUT') {
        clearAuthToken();
        clearAuthUser();
        onAuthStateChange(null);
      } else if (event === 'TOKEN_REFRESHED' && session) {
        const user = await getCurrentUser();
        if (user) {
          handleSession(session, user);
          onAuthStateChange(user);
        }
      }
    }
  );

  // Return the unsubscribe function
  return data.subscription.unsubscribe;
};