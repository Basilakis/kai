/**
 * User Type Admin Controller
 * 
 * This controller handles admin operations for managing user types
 * (user, factory, b2b, admin)
 */

import { Request, Response } from 'express';
import { supabaseClient } from '../../services/supabase/supabaseClient';
import { logger } from '../../utils/logger';
import { ApiError } from '../../utils/apiError';

/**
 * Get all users with their types
 * @route GET /api/admin/user-types
 * @access Admin
 */
export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;
    const search = req.query.search as string || '';
    const userType = req.query.userType as string || '';
    
    // Build query
    let query = (supabaseClient.getClient()
      .from('users') as any)
      .select(`
        id,
        email,
        first_name,
        last_name,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        last_sign_in_at
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    // Add search filter if provided
    if (search) {
      query = query.or(`email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`);
    }
    
    // Add user type filter if provided
    if (userType) {
      query = query.filter('raw_app_meta_data->user_type', 'eq', userType);
    }
    
    const { data, error, count } = await query;
    
    if (error) {
      throw new Error(`Error fetching users: ${error.message}`);
    }
    
    // Format the response
    const users = data.map(user => ({
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      userType: user.raw_app_meta_data?.user_type || 'user',
      role: user.raw_app_meta_data?.role || 'user',
      createdAt: user.created_at,
      lastSignInAt: user.last_sign_in_at
    }));
    
    res.status(200).json({
      success: true,
      data: users,
      pagination: {
        total: count || 0,
        limit,
        offset
      }
    });
  } catch (error) {
    logger.error(`Error in getAllUsers: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, `Failed to get users: ${error}`);
  }
};

/**
 * Get a user by ID
 * @route GET /api/admin/user-types/:id
 * @access Admin
 */
export const getUserById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const { data, error } = await (supabaseClient.getClient()
      .from('users') as any)
      .select(`
        id,
        email,
        first_name,
        last_name,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        last_sign_in_at
      `)
      .eq('id', id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        throw new ApiError(404, 'User not found');
      }
      throw new Error(`Error fetching user: ${error.message}`);
    }
    
    // Format the response
    const user = {
      id: data.id,
      email: data.email,
      firstName: data.first_name,
      lastName: data.last_name,
      userType: data.raw_app_meta_data?.user_type || 'user',
      role: data.raw_app_meta_data?.role || 'user',
      createdAt: data.created_at,
      lastSignInAt: data.last_sign_in_at
    };
    
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    logger.error(`Error in getUserById: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, `Failed to get user: ${error}`);
  }
};

/**
 * Update a user's type
 * @route PUT /api/admin/user-types/:id
 * @access Admin
 */
export const updateUserType = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { userType } = req.body;
    
    // Validate user type
    if (!userType || !['user', 'factory', 'b2b', 'admin'].includes(userType)) {
      throw new ApiError(400, 'Invalid user type. Must be one of: user, factory, b2b, admin');
    }
    
    // Call the set_user_type function
    const { data, error } = await (supabaseClient.getClient()
      .rpc('set_user_type', {
        user_id: id,
        new_type: userType
      }) as any);
    
    if (error) {
      throw new Error(`Error updating user type: ${error.message}`);
    }
    
    if (!data) {
      throw new ApiError(404, 'User not found or update failed');
    }
    
    res.status(200).json({
      success: true,
      message: `User type updated to ${userType}`,
      data: { userType }
    });
  } catch (error) {
    logger.error(`Error in updateUserType: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, `Failed to update user type: ${error}`);
  }
};

export default {
  getAllUsers,
  getUserById,
  updateUserType
};
