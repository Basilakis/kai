/**
 * Authentication Routes Index
 * 
 * This file exports all authentication-related routes.
 */

import express from 'express';
import twoFactorRoutes from './twoFactor.routes';
import passwordResetRoutes from './passwordReset.routes';
import sessionRoutes from './session.routes';
import apiKeyRoutes from './apiKey.routes';

const router = express.Router();

// Mount the authentication sub-routes
router.use('/2fa', twoFactorRoutes);
router.use('/password-reset', passwordResetRoutes);
router.use('/sessions', sessionRoutes);
router.use('/api-keys', apiKeyRoutes);

export default router;
