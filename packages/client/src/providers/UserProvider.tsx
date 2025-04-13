import * as React from 'react';
import { 
  signIn, 
  signUp, 
  signOut, 
  getCurrentUser,
  initAuthListener,
  setupTokenRefresh,
  SupabaseUser
} from '../services/supabaseAuth.service';
import { supabaseClient } from '../services/supabaseClient';

// User interface definition
export interface UserProfile {
  id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  company?: string;
  role?: string;
  preferences: {
    theme: 'light' | 'dark' | 'system';
    notificationsEnabled: boolean;
    emailFrequency: 'daily' | 'weekly' | 'monthly' | 'never';
    defaultView: 'grid' | 'list';
  };
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

// Context state interface
interface UserContextState {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  updateUserPreference: <T extends keyof UserProfile['preferences']>(
    key: T,
    value: UserProfile['preferences'][T]
  ) => Promise<void>;
}

// Create context with default values
// @ts-ignore - React.createContext exists at runtime but TypeScript doesn't recognize it
const UserContext = React.createContext<UserContextState>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  login: async () => {},
  register: async () => {},
  logout: () => {},
  updateProfile: async () => {},
  updateUserPreference: async () => {},
});

// Provider props
interface UserProviderProps {
  children: React.ReactNode;
}

/**
 * UserProvider Component
 * 
 * This provider handles user authentication, profile management, and personalization.
 * It provides user data and authentication methods to all child components.
 */
export const UserProvider: React.FC<UserProviderProps> = ({ children }) => {
  // State
  const [user, setUser] = React.useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);

  // Convert Supabase user to our UserProfile format
  const convertSupabaseUser = (supabaseUser: SupabaseUser): UserProfile => {
    return {
      id: supabaseUser.id,
      // Use a default username if email is undefined
      username: supabaseUser.username || 
                (supabaseUser.email ? supabaseUser.email.split('@')[0] : 'user') as string,
      email: supabaseUser.email,
      firstName: supabaseUser.full_name?.split(' ')[0] || '',
      lastName: supabaseUser.full_name?.split(' ').slice(1).join(' ') || '',
      avatarUrl: supabaseUser.avatar_url || '',
      role: supabaseUser.role || 'user',
      preferences: {
        theme: 'light',
        notificationsEnabled: true,
        emailFrequency: 'weekly',
        defaultView: 'grid',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  };

  // Initialize auth listener, token refresh, and load user on mount
  React.useEffect(() => {
    let isMounted = true;
    let tokenRefreshCleanup: (() => void) | null = null;
    
    const loadUser = async () => {
      try {
        setIsLoading(true);
        
        // Get current user from Supabase
        const supabaseUser = await getCurrentUser();
        
        if (supabaseUser && isMounted) {
          // Convert to our UserProfile format
          const userProfile = convertSupabaseUser(supabaseUser);
          setUser(userProfile);
          
          // Setup token refresh when user is authenticated
          tokenRefreshCleanup = setupTokenRefresh();
        }
      } catch (error) {
        console.error('Failed to load user data:', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    // Setup auth state listener
    const unsubscribe = initAuthListener((supabaseUser) => {
      if (isMounted) {
        if (supabaseUser) {
          setUser(convertSupabaseUser(supabaseUser));
          
          // Setup token refresh when user is authenticated
          if (!tokenRefreshCleanup) {
            tokenRefreshCleanup = setupTokenRefresh();
          }
        } else {
          setUser(null);
          
          // Cleanup token refresh when user logs out
          if (tokenRefreshCleanup) {
            tokenRefreshCleanup();
            tokenRefreshCleanup = null;
          }
        }
        setIsLoading(false);
      }
    });

    // Load initial user
    loadUser();

    // Cleanup
    return () => {
      isMounted = false;
      unsubscribe();
      
      // Clean up token refresh
      if (tokenRefreshCleanup) {
        tokenRefreshCleanup();
      }
    };
  }, []);

  // Login function
  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      
      // Use real Supabase auth
      const { user: supabaseUser, error } = await signIn(email, password);
      
      if (error) {
        throw new Error(error.message);
      }
      
      if (supabaseUser) {
        // Convert to our user format
        const userProfile = convertSupabaseUser(supabaseUser);
        setUser(userProfile);
      }
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Register function
  const register = async (username: string, email: string, password: string) => {
    try {
      setIsLoading(true);
      
      // Use real Supabase auth
      const { user: supabaseUser, error } = await signUp(email, password);
      
      if (error) {
        throw new Error(error.message);
      }
      
      if (supabaseUser) {
        // Update user metadata with username
        // Cast to any to workaround type checking issue
        const auth = supabaseClient.getClient().auth as any;
        await auth.updateUser({
          data: { username }
        });
        
        // Convert to our user format
        const userProfile = convertSupabaseUser(supabaseUser);
        userProfile.username = username;
        setUser(userProfile);
      }
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Logout function
  const logout = async () => {
    try {
      setIsLoading(true);
      
      // Use real Supabase auth
      const { error } = await signOut();
      
      if (error) {
        console.error('Logout error:', error);
      }
      
      setUser(null);
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Update profile
  const updateProfile = async (data: Partial<UserProfile>) => {
    try {
      setIsLoading(true);
      
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      // Use real Supabase auth and profile service
      const userData: any = {};
      
      // Map our profile fields to Supabase user metadata
      if (data.firstName || data.lastName) {
        const firstName = data.firstName || user.firstName || '';
        const lastName = data.lastName || user.lastName || '';
        userData.full_name = [firstName, lastName].filter(Boolean).join(' ');
      }
      
      if (data.avatarUrl) {
        userData.avatar_url = data.avatarUrl;
      }
      
      if (data.username) {
        userData.username = data.username;
      }
      
      // Update the Supabase user metadata
      // Cast to any to workaround type checking issue
      const auth = supabaseClient.getClient().auth as any;
      const { error } = await auth.updateUser({
        data: userData
      });
      
      if (error) {
        throw new Error(error.message);
      }
      
      // Update local user state
      const updatedUser = {
        ...user,
        ...data,
        updatedAt: new Date().toISOString(),
      } as UserProfile;
      
      setUser(updatedUser);
    } catch (error) {
      console.error('Profile update failed:', error);
      throw new Error('Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  // Update user preference
  const updateUserPreference = async <T extends keyof UserProfile['preferences']>(
    key: T,
    value: UserProfile['preferences'][T]
  ) => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      
      // Update preference locally
      const updatedPreferences = {
        ...user.preferences,
        [key]: value,
      };
      
      const updatedUser = {
        ...user,
        preferences: updatedPreferences,
        updatedAt: new Date().toISOString(),
      };
      
      // Store preferences in Supabase user metadata
      // Cast to any to workaround type checking issue
      const auth = supabaseClient.getClient().auth as any;
      const { error } = await auth.updateUser({
        data: {
          preferences: updatedPreferences
        }
      });
      
      if (error) {
        throw new Error(error.message);
      }
      
      setUser(updatedUser);
    } catch (error) {
      console.error('Preference update failed:', error);
      throw new Error('Failed to update preference');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <UserContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        updateProfile,
        updateUserPreference,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

// Custom hook for using the user context
// @ts-ignore - React.useContext exists at runtime but TypeScript doesn't recognize it
export const useUser = (): UserContextState => React.useContext(UserContext);

export default UserProvider;