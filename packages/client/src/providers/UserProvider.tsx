import * as React from 'react';
import {
  auth,
  User as AuthUser,
  createLogger
} from '../services';

const logger = createLogger('UserProvider');

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

  // Convert auth user to our UserProfile format
  const convertAuthUser = (authUser: AuthUser): UserProfile => {
    return {
      id: authUser.id,
      // Use a default username if email is undefined
      username: authUser.username ||
                (authUser.email ? authUser.email.split('@')[0] : 'user') as string,
      email: authUser.email || '',
      firstName: authUser.fullName?.split(' ')[0] || '',
      lastName: authUser.fullName?.split(' ').slice(1).join(' ') || '',
      avatarUrl: authUser.avatarUrl || '',
      role: authUser.roles?.[0] || 'user',
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

  // Initialize auth and load user on mount
  React.useEffect(() => {
    let isMounted = true;

    const loadUser = async () => {
      try {
        setIsLoading(true);

        // Get current user from unified auth service
        const authUser = await auth.getUser();

        if (authUser && isMounted) {
          // Convert to our UserProfile format
          const userProfile = convertAuthUser(authUser);
          setUser(userProfile);
        }
      } catch (error) {
        logger.error('Failed to load user data', error as Error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    // Load initial user
    loadUser();

    // Cleanup
    return () => {
      isMounted = false;
    };
  }, []);

  // Login function
  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);

      // Use unified auth service
      const result = await auth.login({
        email,
        password
      });

      if (result.error) {
        throw result.error;
      }

      if (result.user) {
        // Convert to our user format
        const userProfile = convertAuthUser(result.user);
        setUser(userProfile);
      }
    } catch (error) {
      logger.error('Login failed', error as Error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Register function
  const register = async (username: string, email: string, password: string) => {
    try {
      setIsLoading(true);

      // Use unified auth service
      const result = await auth.register({
        username,
        email,
        password
      });

      if (result.error) {
        throw result.error;
      }

      if (result.user) {
        // Convert to our user format
        const userProfile = convertAuthUser(result.user);
        setUser(userProfile);
      }
    } catch (error) {
      logger.error('Registration failed', error as Error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Logout function
  const logout = async () => {
    try {
      setIsLoading(true);

      // Use unified auth service
      await auth.logout();

      // Clear user state
      setUser(null);
    } catch (error) {
      logger.error('Logout failed', error as Error);
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

      // Use unified auth service
      const authUser = await auth.getUser();

      if (!authUser) {
        throw new Error('User not found');
      }

      // Map our profile fields to auth user fields
      const updateData: Partial<AuthUser> = {};

      if (data.firstName || data.lastName) {
        const firstName = data.firstName || user.firstName || '';
        const lastName = data.lastName || user.lastName || '';
        updateData.fullName = [firstName, lastName].filter(Boolean).join(' ');
      }

      if (data.avatarUrl) {
        updateData.avatarUrl = data.avatarUrl;
      }

      if (data.username) {
        updateData.username = data.username;
      }

      // Update the auth user
      const updatedAuthUser = await auth.updateUser(updateData);

      // Update local user state
      const updatedUser = {
        ...user,
        ...data,
        updatedAt: new Date().toISOString(),
      } as UserProfile;

      setUser(updatedUser);
    } catch (error) {
      logger.error('Profile update failed', error as Error);
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
      // Update local state
      const updatedUser = {
        ...user,
        preferences: {
          ...user.preferences,
          [key]: value
        },
        updatedAt: new Date().toISOString()
      };

      setUser(updatedUser);

      // TODO: Sync with backend when preference storage is implemented
    } catch (error) {
      logger.error('Failed to update user preference', error as Error);
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
export const useUser = (): UserContextState => React.useContext(UserContext);

export default UserProvider;