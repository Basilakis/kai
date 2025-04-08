/**
 * Analytics Routes
 * 
 * This file contains routes for tracking analytics data from various sources
 * including crewAI agents, API calls, and internal system processes.
 */

import express from 'express';
import { asyncHandler } from '../middleware/error.middleware';
import analyticsController from '../controllers/analytics.controller';

const router = express.Router();

/**
 * @route   POST /api/analytics/agent-activity
 * @desc    Track agent activity events
 * @access  Authenticated
 */
router.post('/agent-activity', asyncHandler(analyticsController.trackAgentActivity));

/**
 * @route   POST /api/analytics/agent-search
 * @desc    Track search events from agents
 * @access  Authenticated
 */
router.post('/agent-search', asyncHandler(analyticsController.trackAgentSearch));

/**
 * @route   POST /api/analytics/agent-api-request
 * @desc    Track API request events from agents
 * @access  Authenticated
 */
router.post('/agent-api-request', asyncHandler(analyticsController.trackAgentApiRequest));

export default router;