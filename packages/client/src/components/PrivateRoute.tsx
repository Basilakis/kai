import React, { useEffect } from 'react';
import { navigate } from 'gatsby';
import { useUser } from '../providers/UserProvider';

interface PrivateRouteProps {
  children: React.ReactNode;
  location?: {
    pathname: string;
  };
}

/**
 * PrivateRoute Component
 * 
 * A wrapper component that protects routes from unauthorized access.
 * Redirects unauthenticated users to the login page, storing their 
 * intended destination for redirect after successful login.
 * 
 * @param {PrivateRouteProps} props - Component props
 * @returns {React.ReactNode} - The protected content or null during redirect
 */
const PrivateRoute: React.FC<PrivateRouteProps> = ({ children, location }) => {
  const { isAuthenticated, isLoading } = useUser();
  const currentPath = location?.pathname || '';

  useEffect(() => {
    // Wait until authentication state is loaded
    if (!isLoading && !isAuthenticated) {
      // Store the path the user was trying to access for redirect after login
      if (currentPath && currentPath !== '/login' && currentPath !== '/register') {
        sessionStorage.setItem('redirectAfterLogin', currentPath);
      }
      
      // Redirect to login page
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, isLoading, currentPath]);

  // Show nothing while loading or redirecting
  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // If authenticated, render the protected content
  return <>{children}</>;
};

export default PrivateRoute;