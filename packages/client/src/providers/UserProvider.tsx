import * as React from 'react';

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

  // Load user from local storage on mount
  React.useEffect(() => {
    const loadUser = async () => {
      try {
        // Attempt to get user from local storage
        const savedUser = localStorage.getItem('user');
        if (savedUser) {
          setUser(JSON.parse(savedUser));
        }
      } catch (error) {
        console.error('Failed to load user data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();
  }, []);

  // Login function
  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      
      // In a real app, this would be an API call to authenticate
      // For demo, we'll simulate a successful login after a delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock user data
      const mockUser: UserProfile = {
        id: '1',
        username: email.includes('@') ? email.split('@')[0] || 'user' : email,
        email,
        firstName: 'Demo',
        lastName: 'User',
        avatarUrl: 'https://via.placeholder.com/150',
        preferences: {
          theme: 'light',
          notificationsEnabled: true,
          emailFrequency: 'weekly',
          defaultView: 'grid',
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      // Save to local storage
      localStorage.setItem('user', JSON.stringify(mockUser));
      
      setUser(mockUser);
    } catch (error) {
      console.error('Login failed:', error);
      throw new Error('Invalid credentials');
    } finally {
      setIsLoading(false);
    }
  };

  // Register function
  const register = async (username: string, email: string, password: string) => {
    try {
      setIsLoading(true);
      
      // In a real app, this would be an API call to register
      // For demo, we'll simulate a successful registration after a delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock user data
      const mockUser: UserProfile = {
        id: Math.random().toString(36).substr(2, 9),
        username,
        email,
        firstName: '',
        lastName: '',
        avatarUrl: 'https://via.placeholder.com/150',
        preferences: {
          theme: 'light',
          notificationsEnabled: true,
          emailFrequency: 'weekly',
          defaultView: 'grid',
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      // Save to local storage
      localStorage.setItem('user', JSON.stringify(mockUser));
      
      setUser(mockUser);
    } catch (error) {
      console.error('Registration failed:', error);
      throw new Error('Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Logout function
  const logout = () => {
    localStorage.removeItem('user');
    setUser(null);
  };

  // Update profile
  const updateProfile = async (data: Partial<UserProfile>) => {
    try {
      setIsLoading(true);
      
      // In a real app, this would be an API call to update
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Update user data
      const updatedUser = {
        ...user,
        ...data,
        updatedAt: new Date().toISOString(),
      } as UserProfile;
      
      // Save to local storage
      localStorage.setItem('user', JSON.stringify(updatedUser));
      
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
      
      // In a real app, this would be an API call
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Update preference
      const updatedPreferences = {
        ...user.preferences,
        [key]: value,
      };
      
      const updatedUser = {
        ...user,
        preferences: updatedPreferences,
        updatedAt: new Date().toISOString(),
      };
      
      // Save to local storage
      localStorage.setItem('user', JSON.stringify(updatedUser));
      
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
export const useUser = (): UserContextState => React.useContext(UserContext);

export default UserProvider;