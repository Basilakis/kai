/**
 * Team Subscription Routes
 * 
 * This file defines the routes for team subscriptions,
 * including team management, member management, and billing.
 */

import express from 'express';
import { asyncHandler } from '../../middleware/error.middleware';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireModuleAccess } from '../../middleware/module-access.middleware';
import teamController from '../../controllers/subscription/team.controller';

const router = express.Router();

// All routes require authentication and team_subscriptions module access
router.use(authMiddleware, requireModuleAccess('team_subscriptions'));

/**
 * @route   GET /api/subscriptions/teams
 * @desc    Get all teams for the current user
 * @access  Private
 */
router.get(
  '/',
  asyncHandler(teamController.getUserTeams)
);

/**
 * @route   GET /api/subscriptions/teams/:teamId
 * @desc    Get a team by ID
 * @access  Private
 */
router.get(
  '/:teamId',
  asyncHandler(teamController.getTeam)
);

/**
 * @route   POST /api/subscriptions/teams
 * @desc    Create a new team
 * @access  Private
 */
router.post(
  '/',
  asyncHandler(teamController.createTeam)
);

/**
 * @route   PUT /api/subscriptions/teams/:teamId
 * @desc    Update a team
 * @access  Private
 */
router.put(
  '/:teamId',
  asyncHandler(teamController.updateTeam)
);

/**
 * @route   DELETE /api/subscriptions/teams/:teamId
 * @desc    Delete a team
 * @access  Private
 */
router.delete(
  '/:teamId',
  asyncHandler(teamController.deleteTeam)
);

/**
 * @route   GET /api/subscriptions/teams/:teamId/members
 * @desc    Get team members
 * @access  Private
 */
router.get(
  '/:teamId/members',
  asyncHandler(teamController.getTeamMembers)
);

/**
 * @route   POST /api/subscriptions/teams/:teamId/members
 * @desc    Invite a user to a team
 * @access  Private
 */
router.post(
  '/:teamId/members',
  asyncHandler(teamController.inviteTeamMember)
);

/**
 * @route   POST /api/subscriptions/teams/:teamId/members/accept
 * @desc    Accept a team invitation
 * @access  Private
 */
router.post(
  '/:teamId/members/accept',
  asyncHandler(teamController.acceptTeamInvitation)
);

/**
 * @route   PUT /api/subscriptions/teams/:teamId/members/:memberId
 * @desc    Update a team member's role
 * @access  Private
 */
router.put(
  '/:teamId/members/:memberId',
  asyncHandler(teamController.updateTeamMember)
);

/**
 * @route   DELETE /api/subscriptions/teams/:teamId/members/:memberId
 * @desc    Remove a team member
 * @access  Private
 */
router.delete(
  '/:teamId/members/:memberId',
  asyncHandler(teamController.removeTeamMember)
);

/**
 * @route   PUT /api/subscriptions/teams/:teamId/seats
 * @desc    Update team seats
 * @access  Private
 */
router.put(
  '/:teamId/seats',
  asyncHandler(teamController.updateTeamSeats)
);

/**
 * @route   PUT /api/subscriptions/teams/:teamId/tier
 * @desc    Change team subscription tier
 * @access  Private
 */
router.put(
  '/:teamId/tier',
  asyncHandler(teamController.changeTeamTier)
);

/**
 * @route   POST /api/subscriptions/teams/:teamId/cancel
 * @desc    Cancel team subscription
 * @access  Private
 */
router.post(
  '/:teamId/cancel',
  asyncHandler(teamController.cancelTeamSubscription)
);

/**
 * @route   GET /api/subscriptions/teams/:teamId/billing-preview
 * @desc    Get team billing preview
 * @access  Private
 */
router.get(
  '/:teamId/billing-preview',
  asyncHandler(teamController.getTeamBillingPreview)
);

export default router;
