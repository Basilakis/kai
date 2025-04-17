import express, { Request, Response } from 'express';
import { asyncHandler } from '../middleware/error.middleware';
import { authMiddleware, authorizeRoles } from '../middleware/auth.middleware';
import * as userController from '../controllers/user.controller';

const router = express.Router();

/**
 * @route   GET /api/users/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile', authMiddleware, asyncHandler(userController.getUserProfile));

/**
 * @route   PUT /api/users/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/profile', authMiddleware, asyncHandler(userController.updateUserProfile));

/**
 * @route   PUT /api/users/password
 * @desc    Update password
 * @access  Private
 */
router.put('/password', authMiddleware, asyncHandler(userController.updatePassword));

/**
 * @route   GET /api/users/preferences
 * @desc    Get user preferences
 * @access  Private
 */
router.get('/preferences', authMiddleware, asyncHandler(userController.getUserPreferences));

/**
 * @route   PUT /api/users/preferences
 * @desc    Update user preferences
 * @access  Private
 */
router.put('/preferences', authMiddleware, asyncHandler(userController.updateUserPreferences));

/**
 * @route   GET /api/users/saved-searches
 * @desc    Get user saved searches
 * @access  Private
 */
router.get('/saved-searches', authMiddleware, asyncHandler(userController.getSavedSearches));

/**
 * @route   POST /api/users/saved-searches
 * @desc    Create a saved search
 * @access  Private
 */
router.post('/saved-searches', authMiddleware, asyncHandler(userController.createSavedSearch));

/**
 * @route   DELETE /api/users/saved-searches/:id
 * @desc    Delete a saved search
 * @access  Private
 */
router.delete('/saved-searches/:id', authMiddleware, asyncHandler(userController.deleteSavedSearch));

/**
 * @route   GET /api/users/favorites
 * @desc    Get user favorite materials
 * @access  Private
 */
router.get('/favorites', authMiddleware, asyncHandler(userController.getFavorites));

/**
 * @route   POST /api/users/favorites/:materialId
 * @desc    Add a material to favorites
 * @access  Private
 */
router.post('/favorites/:materialId', authMiddleware, asyncHandler(userController.addFavorite));

/**
 * @route   DELETE /api/users/favorites/:materialId
 * @desc    Remove a material from favorites
 * @access  Private
 */
router.delete('/favorites/:materialId', authMiddleware, asyncHandler(userController.removeFavorite));

// Admin routes for user management
// These routes are protected by the authorizeRoles middleware

/**
 * @route   GET /api/users
 * @desc    Get all users (admin only)
 * @access  Private/Admin
 */
router.get('/', authorizeRoles(['admin']), asyncHandler(userController.getUsers));

/**
 * @route   GET /api/users/:id
 * @desc    Get user by ID (admin only)
 * @access  Private/Admin
 */
router.get('/:id', authorizeRoles(['admin']), asyncHandler(userController.getUserById));

/**
 * @route   PUT /api/users/:id
 * @desc    Update user (admin only)
 * @access  Private/Admin
 */
router.put('/:id', authorizeRoles(['admin']), asyncHandler(userController.updateUser));

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete user (admin only)
 * @access  Private/Admin
 */
router.delete('/:id', authorizeRoles(['admin']), asyncHandler(userController.deleteUser));

export default router;