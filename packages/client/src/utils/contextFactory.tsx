/**
 * Context Factory
 * 
 * A utility for creating type-safe context patterns with proper error handling.
 * This implementation avoids using React's createContext directly to work
 * with different React versions and TypeScript configurations.
 */

import React from 'react';
import { logger } from './logger';
import { createError, ErrorCategory } from './errorHandling';

// Type for context provider props
export interface ContextProviderProps {
  children: JSX.Element | JSX.Element[] | string | null;
}

/**
 * Options for createContextStore
 */
export interface CreateContextOptions<T> {
  // Display name for the context (used in React DevTools)
  displayName: string;
  
  // Default value returned when used outside of provider
  // If not provided, an error will be thrown when context is used outside provider
  defaultValue?: T | undefined;
  
  // Error message when context is used outside of provider
  errorMessage?: string | undefined;
  
  // Whether to log errors when context is used outside of provider
  logErrors?: boolean | undefined;
}

/**
 * Create a simple context-like state management system
 */
export function createContextStore<T>(
  options: CreateContextOptions<T>
) {
  const {
    displayName,
    defaultValue,
    errorMessage = `${displayName} context used outside of provider`,
    logErrors = true
  } = options;
  
  // Internal store to hold the current value
  let _currentValue: T | undefined = defaultValue;
  let _listeners: Array<() => void> = [];
  
  // Add a listener to be notified of changes
  function subscribe(listener: () => void): () => void {
    _listeners.push(listener);
    return () => {
      _listeners = _listeners.filter(l => l !== listener);
    };
  }
  
  // Update the value and notify listeners
  function setValue(newValue: T): void {
    _currentValue = newValue;
    _listeners.forEach(listener => listener());
  }
  
  // Get the current value with error handling
  function getValue(): T {
    if (_currentValue === undefined && defaultValue === undefined) {
      if (logErrors) {
        logger.error(
          errorMessage,
          createError(errorMessage, ErrorCategory.RESOURCE, {
            context: { name: displayName }
          }),
          { contextName: displayName }
        );
      }
      
      throw new Error(errorMessage);
    }
    
    return (_currentValue !== undefined ? _currentValue : defaultValue) as T;
  }
  
  /**
   * Provider component
   */
  // Using any type for children to avoid React.ReactNode compatibility issues
  const Provider = ({ value, children }: { value: T; children?: any }) => {
    React.useEffect(() => {
      setValue(value);
      return () => {
        // If this is the only provider, reset the value
        if (_listeners.length <= 1) {
          _currentValue = defaultValue;
        }
      };
    }, [value]);
    
    return <>{children}</>;
  };
  
  Provider.displayName = `${displayName}Provider`;
  
  /**
   * Consumer component
   */
  const Consumer: React.FC<{ children: (value: T) => JSX.Element }> = ({ children }) => {
    const value = getValue();
    return <>{children(value)}</>;
  };
  
  Consumer.displayName = `${displayName}Consumer`;
  
  /**
   * Hook to use the context value
   */
  function useContextValue(): T {
    const [, forceUpdate] = React.useState({});
    
    React.useEffect(() => {
      // Subscribe to changes
      const unsubscribe = subscribe(() => {
        forceUpdate({});
      });
      
      return unsubscribe;
    }, []);
    
    return getValue();
  }
  
  /**
   * Create a provider with a state updater function
   */
  function createProvider<P extends ContextProviderProps>(
    ProviderComponent: React.FC<P & { setValue?: (value: T) => void }>
  ): React.FC<P> {
    const WrappedProvider: React.FC<P> = (props) => {
      const [value, setStateValue] = React.useState<T>(_currentValue as T);
      
      // Update both the state and the context value
      const updateValue = React.useCallback((newValue: T) => {
        setStateValue(newValue);
        setValue(newValue);
      }, []);
      
      return (
        <Provider value={value} children={
          <ProviderComponent 
            {...props} 
            setValue={updateValue} 
          />
        } />
      );
    };
    
    WrappedProvider.displayName = `${displayName}Provider`;
    return WrappedProvider;
  }
  
  /**
   * Create a simple provider with a fixed value
   */
  function createSimpleProvider(
    initialValue: T
  ): React.FC<ContextProviderProps> {
    const SimpleProvider: React.FC<ContextProviderProps> = ({ children }) => {
      return (
        <Provider value={initialValue} children={children} />
      );
    };
    
    SimpleProvider.displayName = `${displayName}SimpleProvider`;
    return SimpleProvider;
  }
  
  return {
    Provider,
    Consumer,
    useContext: useContextValue,
    createProvider,
    createSimpleProvider,
    getValue,
    setValue
  };
}

/**
 * Usage examples:
 * 
 * // Example 1: Simple user context
 * interface UserContextType {
 *   user: { name: string } | null;
 *   login: (username: string) => void;
 *   logout: () => void;
 * }
 * 
 * const userStore = createContextStore<UserContextType>({
 *   displayName: 'User',
 *   // No defaultValue, so it will throw if used outside provider
 * });
 * 
 * // Use with hooks in components
 * function UserProfile() {
 *   const { user, logout } = userStore.useContext();
 *   
 *   return (
 *     <div>
 *       {user ? (
 *         <>
 *           <p>Welcome, {user.name}</p>
 *           <button onClick={logout}>Logout</button>
 *         </>
 *       ) : (
 *         <p>Please log in</p>
 *       )}
 *     </div>
 *   );
 * }
 * 
 * // Use with provider
 * function UserProvider({ children }) {
 *   const [user, setUser] = React.useState(null);
 *   
 *   const login = (username) => {
 *     setUser({ name: username });
 *   };
 *   
 *   const logout = () => {
 *     setUser(null);
 *   };
 *   
 *   const contextValue = {
 *     user,
 *     login,
 *     logout
 *   };
 *   
 *   return (
 *     <userStore.Provider value={contextValue}>
 *       {children}
 *     </userStore.Provider>
 *   );
 * }
 */