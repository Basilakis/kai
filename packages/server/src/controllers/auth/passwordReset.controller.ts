/**
 * Password Reset Controller
 * 
 * This controller handles API endpoints for password reset functionality,
 * including requesting a reset token and resetting the password.
 */

import { Request, Response } from 'express';
import { logger } from '../../utils/logger';
import { ApiError } from '../../middleware/error.middleware';
import { supabaseClient } from '../../services/supabase/supabaseClient';
import { emailService } from '../../services/email/email.service';
import crypto from 'crypto';

/**
 * Request a password reset
 * @route POST /api/auth/password-reset/request
 * @access Public
 */
export const requestPasswordReset = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      throw new ApiError(400, 'Email is required');
    }
    
    // Check if the user exists
    const { data: user, error: userError } = await supabaseClient.getClient().auth.admin.getUserByEmail(email);
    
    if (userError || !user) {
      // Don't reveal whether the email exists for security reasons
      res.status(200).json({
        success: true,
        message: 'If your email is registered, you will receive a password reset link shortly.'
      });
      return;
    }
    
    // Generate a reset token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // Token expires in 1 hour
    
    // Store the reset token
    const { error: tokenError } = await supabaseClient.getClient()
      .from('password_reset_tokens')
      .insert([{
        userId: user.id,
        token,
        expiresAt,
        isUsed: false
      }]);
    
    if (tokenError) {
      logger.error(`Error storing reset token: ${tokenError.message}`);
      throw new ApiError(500, 'Failed to process password reset request');
    }
    
    // Send the reset email
    const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${token}`;
    
    await emailService.sendEmail({
      to: email,
      subject: 'Password Reset Request',
      text: `You requested a password reset. Please use the following link to reset your password: ${resetUrl}. This link will expire in 1 hour.`,
      html: `
        <p>You requested a password reset.</p>
        <p>Please click the link below to reset your password:</p>
        <p><a href="${resetUrl}">Reset Password</a></p>
        <p>This link will expire in 1 hour.</p>
        <p>If you did not request this reset, please ignore this email.</p>
      `
    });
    
    res.status(200).json({
      success: true,
      message: 'If your email is registered, you will receive a password reset link shortly.'
    });
  } catch (error) {
    logger.error(`Error requesting password reset: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to process password reset request');
  }
};

/**
 * Validate a password reset token
 * @route GET /api/auth/password-reset/validate/:token
 * @access Public
 */
export const validateResetToken = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    
    if (!token) {
      throw new ApiError(400, 'Token is required');
    }
    
    // Check if the token exists and is valid
    const now = new Date();
    
    const { data, error } = await supabaseClient.getClient()
      .from('password_reset_tokens')
      .select('*')
      .eq('token', token)
      .eq('isUsed', false)
      .gt('expiresAt', now.toISOString())
      .single();
    
    if (error || !data) {
      throw new ApiError(400, 'Invalid or expired token');
    }
    
    res.status(200).json({
      success: true,
      message: 'Token is valid'
    });
  } catch (error) {
    logger.error(`Error validating reset token: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to validate reset token');
  }
};

/**
 * Reset password with token
 * @route POST /api/auth/password-reset/reset
 * @access Public
 */
export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;
    
    if (!token) {
      throw new ApiError(400, 'Token is required');
    }
    
    if (!newPassword) {
      throw new ApiError(400, 'New password is required');
    }
    
    if (newPassword.length < 8) {
      throw new ApiError(400, 'Password must be at least 8 characters long');
    }
    
    // Check if the token exists and is valid
    const now = new Date();
    
    const { data: tokenData, error: tokenError } = await supabaseClient.getClient()
      .from('password_reset_tokens')
      .select('*')
      .eq('token', token)
      .eq('isUsed', false)
      .gt('expiresAt', now.toISOString())
      .single();
    
    if (tokenError || !tokenData) {
      throw new ApiError(400, 'Invalid or expired token');
    }
    
    // Update the user's password
    const { error: updateError } = await supabaseClient.getClient().auth.admin.updateUserById(
      tokenData.userId,
      { password: newPassword }
    );
    
    if (updateError) {
      logger.error(`Error updating password: ${updateError.message}`);
      throw new ApiError(500, 'Failed to update password');
    }
    
    // Mark the token as used
    const { error: markError } = await supabaseClient.getClient()
      .from('password_reset_tokens')
      .update({ isUsed: true })
      .eq('id', tokenData.id);
    
    if (markError) {
      logger.error(`Error marking token as used: ${markError.message}`);
      // Continue anyway since the password was updated
    }
    
    res.status(200).json({
      success: true,
      message: 'Password has been reset successfully. You can now log in with your new password.'
    });
  } catch (error) {
    logger.error(`Error resetting password: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to reset password');
  }
};

export default {
  requestPasswordReset,
  validateResetToken,
  resetPassword
};
