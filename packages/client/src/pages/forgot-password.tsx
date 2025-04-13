import React, { useState, ChangeEvent } from 'react';
import { navigate } from 'gatsby';
import Layout from '../components/Layout';
import SEO from '../components/SEO';
import { resetPassword } from '../services/supabaseAuth.service';

/**
 * Forgot Password Page
 *
 * Allows users to request a password reset via email
 */
const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    
    if (!email) {
      setMessage({ type: 'error', text: 'Please enter your email address' });
      return;
    }

    try {
      setIsSubmitting(true);
      setMessage(null);

      // Request password reset email
      const { error } = await resetPassword(email);

      if (error) {
        throw error;
      }

      // Show success message
      setMessage({ 
        type: 'success', 
        text: 'Password reset instructions have been sent to your email' 
      });

      // Clear form
      setEmail('');
    } catch (error: any) {
      console.error('Error requesting password reset:', error);
      setMessage({ 
        type: 'error', 
        text: error.message || 'Failed to send password reset email. Please try again.' 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      <SEO title="Forgot Password" />
      
      <div className="max-w-md mx-auto my-10 px-4">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800">Forgot Password</h1>
            <p className="text-gray-600 mt-2">
              Enter your email address and we'll send you instructions to reset your password.
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
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="your@email.com"
                required
              />
            </div>

            <div className="flex flex-col space-y-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                  isSubmitting ? 'opacity-70 cursor-not-allowed' : ''
                }`}
              >
                {isSubmitting ? 'Sending Email...' : 'Send Reset Instructions'}
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

export default ForgotPasswordPage;