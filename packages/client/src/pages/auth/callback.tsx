import React, { useEffect, useState } from 'react';
import { navigate } from 'gatsby';
import Layout from '../../components/Layout';
import SEO from '../../components/SEO';
import { supabaseClient } from '../../services/supabaseClient';

/**
 * Authentication Callback Page
 * 
 * This page handles OAuth redirects from social authentication providers.
 * It's the page that users are redirected to after signing in with
 * Google, Facebook, or Twitter.
 */
const AuthCallbackPage: React.FC = () => {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Process the auth callback from OAuth provider
    const processAuthCallback = async () => {
      try {
        // Get the auth code from the URL
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const queryParams = new URLSearchParams(window.location.search);
        
        // Check for errors
        const errorParam = hashParams.get('error') || queryParams.get('error');
        if (errorParam) {
          const errorDescription = hashParams.get('error_description') || 
                                  queryParams.get('error_description') || 
                                  'An error occurred during authentication';
          throw new Error(errorDescription);
        }
        
        // Create a callback handler for getting session after OAuth redirect
        const { data, error } = await supabaseClient.getClient().auth.getSession();
        
        if (error) {
          throw error;
        }
        
        if (data?.session) {
          // Successfully authenticated, redirect to home page
          navigate('/');
        } else {
          // No session found, show error
          throw new Error('No session found. Authentication may have failed.');
        }
      } catch (err) {
        console.error('Auth callback error:', err);
        setError(err instanceof Error ? err.message : 'Authentication failed');
      } finally {
        setLoading(false);
      }
    };

    processAuthCallback();
  }, []);

  return (
    <Layout>
      <SEO title="Authentication" />
      
      <div className="max-w-md mx-auto my-10 px-4 text-center">
        {loading ? (
          <div>
            <h2 className="text-2xl font-bold mb-4">Completing Authentication</h2>
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
            <p className="mt-4 text-gray-600">Please wait while we complete your authentication...</p>
          </div>
        ) : error ? (
          <div>
            <h2 className="text-2xl font-bold text-red-600 mb-4">Authentication Error</h2>
            <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              <p>{error}</p>
            </div>
            <button
              onClick={() => navigate('/login')}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Return to Login
            </button>
          </div>
        ) : (
          <div>
            <h2 className="text-2xl font-bold text-green-600 mb-4">Authentication Successful</h2>
            <p className="mb-4">You are now signed in. Redirecting you to the home page...</p>
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-500"></div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AuthCallbackPage;