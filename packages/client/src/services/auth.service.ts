/**
 * Authentication Service
 * 
 * Handles token management and authentication state
 */

// Token storage key
const TOKEN_KEY = 'kai_auth_token';
const USER_KEY = 'kai_auth_user';

/**
 * User information type
 */
export interface User {
  id: string;
  username: string;
  email: string;
  role: string;
}

/**
 * Get the authentication token from storage
 * @returns The authentication token or null if not found
 */
export const getAuthToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY);
};

/**
 * Set the authentication token in storage
 * @param token The token to store
 */
export const setAuthToken = (token: string): void => {
  localStorage.setItem(TOKEN_KEY, token);
};

/**
 * Clear the authentication token from storage
 */
export const clearAuthToken = (): void => {
  localStorage.removeItem(TOKEN_KEY);
};

/**
 * Get the authenticated user from storage
 * @returns The authenticated user or null if not found
 */
export const getAuthUser = (): User | null => {
  const userJson = localStorage.getItem(USER_KEY);
  if (!userJson) return null;
  
  try {
    return JSON.parse(userJson) as User;
  } catch (error) {
    console.error('Failed to parse user JSON', error);
    clearAuthUser();
    return null;
  }
};

/**
 * Set the authenticated user in storage
 * @param user The user to store
 */
export const setAuthUser = (user: User): void => {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

/**
 * Clear the authenticated user from storage
 */
export const clearAuthUser = (): void => {
  localStorage.removeItem(USER_KEY);
};

/**
 * Check if the user is authenticated
 * @returns Whether the user is authenticated
 */
export const isAuthenticated = (): boolean => {
  const token = getAuthToken();
  return !!token && !isTokenExpired(token);
};

/**
 * Check if a token is expired
 * @param token The token to check
 * @returns Whether the token is expired
 */
export const isTokenExpired = (token: string): boolean => {
  try {
    // Split the token
    const parts = token.split('.');
    
    // Check if we have a valid token with 3 parts (header.payload.signature)
    if (parts.length !== 3) {
      console.error('Invalid token format');
      return true;
    }
    
    // Get the payload part (index 1)
    const base64Payload = parts[1];
    if (!base64Payload) {
      console.error('Token payload is missing');
      return true;
    }
    
    // Parse the token payload
    const payload = JSON.parse(atob(base64Payload));
    
    // Check if the token is expired
    return payload.exp * 1000 < Date.now();
  } catch (error) {
    console.error('Failed to check token expiration', error);
    return true;
  }
};

/**
 * Get the user's role from the token
 * @returns The user's role or null if not authenticated
 */
export const getUserRole = (): string | null => {
  const user = getAuthUser();
  return user?.role || null;
};

/**
 * Check if the user has a specific role
 * @param role The role to check for
 * @returns Whether the user has the role
 */
export const hasRole = (role: string): boolean => {
  const userRole = getUserRole();
  return userRole === role;
};

/**
 * Check if the user is an admin
 * @returns Whether the user is an admin
 */
export const isAdmin = (): boolean => {
  return hasRole('admin');
};

/**
 * Log out the user
 */
export const logout = (): void => {
  clearAuthToken();
  clearAuthUser();
  
  // You might want to redirect to login page or refresh the page here
  // window.location.href = '/login';
};