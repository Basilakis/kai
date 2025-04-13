import React, { useState, useEffect, ChangeEvent } from 'react';
import { navigate } from 'gatsby';
import Layout from '../../components/Layout';
import SEO from '../../components/SEO';
import { updatePassword } from '../../services/supabaseAuth.service';
import { supabaseClient } from '../../services/supabaseClient';

/**
 * Password Reset Page
 * 
 * Handles the actual password reset after user clicks link in email
 * Validates token and allows setting a new password
 */
const ResetPasswordPage: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [passwordStrength, setPasswordStrength] = useState<{
    score: number;
    feedback: string;
  }>({ score: 0, feedback: '' });

  // Check if we have a valid reset token on page load
  useEffect(() => {
    const checkResetToken = async () => {
      try {
        // Get the current session, which should include the reset token
        // if the user came from the password reset email link
        const { data, error } = await supabaseClient.getClient().auth.getSession();
        
        if (error || !data.session) {
          console.error('Error validating reset token:', error || 'No session found');
          setTokenValid(false);
          setMessage({
            type: 'error',
            text: 'Invalid or expired password reset link. Please request a new password reset.'
          });
          return;
        }

        // If we have a session, the token is valid
        setTokenValid(true);
      } catch (err) {
        console.error('Error checking reset token:', err);
        setTokenValid(false);
        setMessage({
          type: 'error',
          text: 'Error validating your reset link. Please try again or request a new reset link.'
        });
      }
    };

    checkResetToken();
  }, []);

  // Check password strength
  const checkPasswordStrength = (pass: string) => {
    // Basic password strength check
    const hasLowercase = /[a-z]/.test(pass);
    const hasUppercase = /[A-Z]/.test(pass);
    const hasNumber = /[0-9]/.test(pass);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(pass);
    const isLongEnough = pass.length >= 8;

    // Calculate score (0-4)
    const criteria = [hasLowercase, hasUppercase, hasNumber, hasSpecial, isLongEnough];
    const score = criteria.filter(Boolean).length;

    // Generate feedback
    let feedback = '';
    if (score < 3) {
      feedback = 'Weak password. Please include uppercase, lowercase, numbers, and special characters.';
    } else if (score < 5) {
      feedback = 'Moderate password. For best security, include all character types.';
    } else {
      feedback = 'Strong password!';
    }

    setPasswordStrength({ score, feedback });
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    
    if (!password) {
      setMessage({ type: 'error', text: 'Please enter a new password' });
      return;
    }

    if (password !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }

    if (passwordStrength.score < 3) {
      setMessage({ 
        type: 'error', 
        text: 'Please choose a stronger password. ' + passwordStrength.feedback 
      });
      return;
    }

    try {
      setIsSubmitting(true);
      setMessage(null);

      // Update the password
      const { error } = await updatePassword(password);

      if (error) {
        throw error;
      }

      // Show success message
      setMessage({ 
        type: 'success', 
        text: 'Your password has been successfully reset! Redirecting to login...' 
      });

      // Clear form
      setPassword('');
      setConfirmPassword('');
      
      // Redirect to login after a delay
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (error: any) {
      console.error('Error resetting password:', error);
      setMessage({ 
        type: 'error', 
        text: error.message || 'Failed to reset password. Please try again.' 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newPassword = e.target.value;
    setPassword(newPassword);
    checkPasswordStrength(newPassword);
  };

  // If we're still checking token validity, show loading state
  if (tokenValid === null) {
    return (
      <Layout>
        <SEO title="Reset Password" />
        <div className="max-w-md mx-auto my-10 px-4">
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
            <p className="text-gray-600 mt-4">Validating your reset link...</p>
          </div>
        </div>
      </Layout>
    );
  }

  // If token is invalid, show error message and link to request new reset
  if (tokenValid === false) {
    return (
      <Layout>
        <SEO title="Invalid Reset Link" />
        <div className="max-w-md mx-auto my-10 px-4">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-center mb-6">
              <svg className="h-16 w-16 text-red-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h1 className="text-2xl font-bold text-gray-800">Invalid Reset Link</h1>
              <p className="text-gray-600 mt-2">
                {message?.text || 'This password reset link is invalid or has expired.'}
              </p>
            </div>
            <div className="mt-6">
              <button
                onClick={() => navigate('/forgot-password')}
                className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Request New Reset Link
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // Normal form view when token is valid
  return (
    <Layout>
      <SEO title="Reset Password" />
      
      <div className="max-w-md mx-auto my-10 px-4">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800">Reset Your Password</h1>
            <p className="text-gray-600 mt-2">
              Enter your new password below
            </p>
          </div>

          {message && (
            <div 
              className={`mb-6 p-4 rounded ${
                message.type === 'success' 
                  ? 'bg-green-50 text-green-800 border border-green-200' 
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {message.text}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                New Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={handlePasswordChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter new password"
                required
                minLength={8}
              />
              
              {/* Password strength indicator */}
              {password && (
                <div className="mt-2">
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className={`h-2.5 rounded-full ${
                        passwordStrength.score < 3 ? 'bg-red-500' : 
                        passwordStrength.score < 5 ? 'bg-yellow-500' : 'bg-green-500'
                      }`} 
                      style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                    ></div>
                  </div>
                  <p className={`text-xs mt-1 ${
                    passwordStrength.score < 3 ? 'text-red-600' : 
                    passwordStrength.score < 5 ? 'text-yellow-600' : 'text-green-600'
                  }`}>
                    {passwordStrength.feedback}
                  </p>
                </div>
              )}
            </div>

            <div className="mb-6">
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Confirm New Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                  confirmPassword && password !== confirmPassword
                    ? 'border-red-500'
                    : 'border-gray-300'
                }`}
                placeholder="Confirm new password"
                required
              />
              {confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-red-600 mt-1">Passwords do not match</p>
              )}
            </div>

            <div className="flex flex-col space-y-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                  isSubmitting ? 'opacity-70 cursor-not-allowed' : ''
                }`}
              >
                {isSubmitting ? 'Resetting Password...' : 'Reset Password'}
              </button>

              <button
                type="button"
                onClick={() => navigate('/login')}
                className="w-full py-2 px-4 text-sm font-medium text-blue-600 hover:text-blue-800 focus:outline-none"
              >
                Back to Login
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
};

export default ResetPasswordPage;