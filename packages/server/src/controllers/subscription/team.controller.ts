/**
 * Team Subscription Controller
 * 
 * This controller handles API endpoints for managing team subscriptions,
 * including creation, member management, and billing.
 */

import { Request, Response } from 'express';
import { logger } from '../../utils/logger';
import { ApiError } from '../../middleware/error.middleware';
import teamSubscriptionModel, { TeamMemberRole, TeamMemberStatus } from '../../models/teamSubscription.model';
import teamBillingService from '../../services/subscription/teamBilling.service';
import { emailService } from '../../services/email/email.service';
import { supabaseClient } from '../../services/supabase/supabaseClient';

/**
 * Get all teams for the current user
 * @route GET /api/subscriptions/teams
 * @access Private
 */
export const getUserTeams = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    
    // Get all teams for the user
    const teams = await teamSubscriptionModel.getUserTeams(userId);
    
    // Get team memberships with roles
    const teamIds = teams.map(team => team.id);
    let memberships: any[] = [];
    
    if (teamIds.length > 0) {
      const { data, error } = await supabaseClient.getClient()
        .from('team_members')
        .select('teamId, role')
        .eq('userId', userId)
        .in('teamId', teamIds);
      
      if (error) {
        throw error;
      }
      
      memberships = data || [];
    }
    
    // Add role to each team
    const teamsWithRoles = teams.map(team => {
      const membership = memberships.find(m => m.teamId === team.id);
      return {
        ...team,
        userRole: membership ? membership.role : null
      };
    });
    
    res.status(200).json({
      success: true,
      data: teamsWithRoles
    });
  } catch (error) {
    logger.error(`Error getting user teams: ${error}`);
    throw new ApiError(500, 'Failed to get teams');
  }
};

/**
 * Get a team by ID
 * @route GET /api/subscriptions/teams/:teamId
 * @access Private
 */
export const getTeam = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const { teamId } = req.params;
    
    // Check if the user is a member of the team
    const isMember = await teamSubscriptionModel.isTeamMember(teamId, userId);
    
    if (!isMember) {
      throw new ApiError(403, 'You do not have permission to access this team');
    }
    
    // Get the team
    const team = await teamSubscriptionModel.getTeamById(teamId);
    
    if (!team) {
      throw new ApiError(404, 'Team not found');
    }
    
    // Get user's role in the team
    const member = await teamSubscriptionModel.getTeamMember(teamId, userId);
    
    res.status(200).json({
      success: true,
      data: {
        ...team,
        userRole: member?.role
      }
    });
  } catch (error) {
    logger.error(`Error getting team: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to get team');
  }
};

/**
 * Create a new team
 * @route POST /api/subscriptions/teams
 * @access Private
 */
export const createTeam = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const { name, tierId, seats, paymentMethodId, trialDays, metadata } = req.body;
    
    if (!name) {
      throw new ApiError(400, 'Team name is required');
    }
    
    if (!tierId) {
      throw new ApiError(400, 'Subscription tier ID is required');
    }
    
    if (!seats || seats < 1) {
      throw new ApiError(400, 'Number of seats is required and must be at least 1');
    }
    
    if (!paymentMethodId) {
      throw new ApiError(400, 'Payment method ID is required');
    }
    
    // Create the team
    const team = await teamBillingService.createTeamSubscription(
      userId,
      name,
      tierId,
      {
        seats,
        paymentMethodId,
        trialDays,
        metadata
      }
    );
    
    res.status(201).json({
      success: true,
      message: 'Team created successfully',
      data: team
    });
  } catch (error) {
    logger.error(`Error creating team: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to create team');
  }
};

/**
 * Update a team
 * @route PUT /api/subscriptions/teams/:teamId
 * @access Private
 */
export const updateTeam = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const { teamId } = req.params;
    const { name, metadata } = req.body;
    
    // Check if the user is an admin or owner of the team
    const hasPermission = await teamSubscriptionModel.hasTeamRole(
      teamId,
      userId,
      [TeamMemberRole.OWNER, TeamMemberRole.ADMIN]
    );
    
    if (!hasPermission) {
      throw new ApiError(403, 'You do not have permission to update this team');
    }
    
    // Get the team
    const team = await teamSubscriptionModel.getTeamById(teamId);
    
    if (!team) {
      throw new ApiError(404, 'Team not found');
    }
    
    // Prepare updates
    const updates: any = {};
    
    if (name) {
      updates.name = name;
    }
    
    if (metadata) {
      updates.metadata = {
        ...team.metadata,
        ...metadata
      };
    }
    
    // Update the team
    const updatedTeam = await teamSubscriptionModel.updateTeam(teamId, updates);
    
    res.status(200).json({
      success: true,
      message: 'Team updated successfully',
      data: updatedTeam
    });
  } catch (error) {
    logger.error(`Error updating team: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to update team');
  }
};

/**
 * Delete a team
 * @route DELETE /api/subscriptions/teams/:teamId
 * @access Private
 */
export const deleteTeam = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const { teamId } = req.params;
    
    // Check if the user is the owner of the team
    const hasPermission = await teamSubscriptionModel.hasTeamRole(
      teamId,
      userId,
      [TeamMemberRole.OWNER]
    );
    
    if (!hasPermission) {
      throw new ApiError(403, 'Only the team owner can delete the team');
    }
    
    // Get the team
    const team = await teamSubscriptionModel.getTeamById(teamId);
    
    if (!team) {
      throw new ApiError(404, 'Team not found');
    }
    
    // Cancel the subscription first
    if (team.stripeSubscriptionId) {
      await teamBillingService.cancelTeamSubscription(teamId, false);
    }
    
    // Delete the team
    await teamSubscriptionModel.deleteTeam(teamId);
    
    res.status(200).json({
      success: true,
      message: 'Team deleted successfully'
    });
  } catch (error) {
    logger.error(`Error deleting team: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to delete team');
  }
};

/**
 * Get team members
 * @route GET /api/subscriptions/teams/:teamId/members
 * @access Private
 */
export const getTeamMembers = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const { teamId } = req.params;
    
    // Check if the user is a member of the team
    const isMember = await teamSubscriptionModel.isTeamMember(teamId, userId);
    
    if (!isMember) {
      throw new ApiError(403, 'You do not have permission to access this team');
    }
    
    // Get team members
    const members = await teamSubscriptionModel.getTeamMembers(teamId);
    
    // Get user details for each member
    const userIds = members.map(member => member.userId);
    let userDetails: Record<string, any> = {};
    
    if (userIds.length > 0) {
      const { data, error } = await supabaseClient.getClient().auth.admin.listUsers();
      
      if (error) {
        throw error;
      }
      
      // Create a map of user details
      userDetails = data.users.reduce((acc, user) => {
        if (userIds.includes(user.id)) {
          acc[user.id] = {
            email: user.email,
            username: user.user_metadata?.username || user.email?.split('@')[0],
            fullName: user.user_metadata?.full_name,
            avatarUrl: user.user_metadata?.avatar_url
          };
        }
        return acc;
      }, {} as Record<string, any>);
    }
    
    // Combine member data with user details
    const membersWithDetails = members.map(member => ({
      ...member,
      user: userDetails[member.userId] || { email: member.email }
    }));
    
    res.status(200).json({
      success: true,
      data: membersWithDetails
    });
  } catch (error) {
    logger.error(`Error getting team members: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to get team members');
  }
};

/**
 * Invite a user to a team
 * @route POST /api/subscriptions/teams/:teamId/members
 * @access Private
 */
export const inviteTeamMember = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const { teamId } = req.params;
    const { email, role = TeamMemberRole.MEMBER } = req.body;
    
    if (!email) {
      throw new ApiError(400, 'Email is required');
    }
    
    // Check if the user is an admin or owner of the team
    const hasPermission = await teamSubscriptionModel.hasTeamRole(
      teamId,
      userId,
      [TeamMemberRole.OWNER, TeamMemberRole.ADMIN]
    );
    
    if (!hasPermission) {
      throw new ApiError(403, 'You do not have permission to invite members to this team');
    }
    
    // Get the team
    const team = await teamSubscriptionModel.getTeamById(teamId);
    
    if (!team) {
      throw new ApiError(404, 'Team not found');
    }
    
    // Check if the team has available seats
    const members = await teamSubscriptionModel.getTeamMembers(teamId);
    const activeMembers = members.filter(m => m.status === TeamMemberStatus.ACTIVE);
    
    if (activeMembers.length >= team.seats) {
      throw new ApiError(400, 'Team has reached its seat limit. Please upgrade to add more members.');
    }
    
    // Check if the user is already a member
    const existingMember = members.find(m => m.email.toLowerCase() === email.toLowerCase());
    
    if (existingMember) {
      if (existingMember.status === TeamMemberStatus.ACTIVE) {
        throw new ApiError(400, 'User is already a member of this team');
      } else if (existingMember.status === TeamMemberStatus.INVITED) {
        throw new ApiError(400, 'User has already been invited to this team');
      }
    }
    
    // Check if the user exists in the system
    const { data: userData, error: userError } = await supabaseClient.getClient().auth.admin.getUserByEmail(email);
    
    let invitedUserId: string | undefined;
    
    if (!userError && userData) {
      invitedUserId = userData.id;
    }
    
    // Create the invitation
    const now = new Date();
    const invitation = await teamSubscriptionModel.addTeamMember({
      teamId,
      userId: invitedUserId || '',
      email,
      role: role as TeamMemberRole,
      status: TeamMemberStatus.INVITED,
      invitedBy: userId,
      invitedAt: now
    });
    
    // Send invitation email
    const inviter = req.user.email || 'A team administrator';
    const inviteUrl = `${process.env.CLIENT_URL}/teams/join?teamId=${teamId}&inviteId=${invitation.id}`;
    
    await emailService.sendEmail({
      to: email,
      subject: `Invitation to join ${team.name}`,
      text: `${inviter} has invited you to join the team "${team.name}" on KAI. Click the following link to accept the invitation: ${inviteUrl}`,
      html: `
        <p>${inviter} has invited you to join the team "${team.name}" on KAI.</p>
        <p>Click the button below to accept the invitation:</p>
        <p><a href="${inviteUrl}" style="display: inline-block; padding: 10px 20px; background-color: #4a6cf7; color: white; text-decoration: none; border-radius: 4px;">Accept Invitation</a></p>
        <p>If the button doesn't work, copy and paste this URL into your browser:</p>
        <p>${inviteUrl}</p>
      `
    });
    
    res.status(200).json({
      success: true,
      message: `Invitation sent to ${email}`,
      data: invitation
    });
  } catch (error) {
    logger.error(`Error inviting team member: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to invite team member');
  }
};

/**
 * Accept a team invitation
 * @route POST /api/subscriptions/teams/:teamId/members/accept
 * @access Private
 */
export const acceptTeamInvitation = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const { teamId } = req.params;
    const { inviteId } = req.body;
    
    if (!inviteId) {
      throw new ApiError(400, 'Invitation ID is required');
    }
    
    // Get the invitation
    const { data: invitation, error: inviteError } = await supabaseClient.getClient()
      .from('team_members')
      .select('*')
      .eq('id', inviteId)
      .eq('teamId', teamId)
      .eq('status', TeamMemberStatus.INVITED)
      .single();
    
    if (inviteError || !invitation) {
      throw new ApiError(404, 'Invitation not found or has expired');
    }
    
    // Check if the invitation is for this user
    const userEmail = req.user.email?.toLowerCase();
    
    if (invitation.email.toLowerCase() !== userEmail) {
      throw new ApiError(403, 'This invitation is not for your account');
    }
    
    // Accept the invitation
    const now = new Date();
    const updatedMember = await teamSubscriptionModel.updateTeamMember(
      teamId,
      userId,
      {
        userId,
        status: TeamMemberStatus.ACTIVE,
        joinedAt: now
      }
    );
    
    res.status(200).json({
      success: true,
      message: 'Team invitation accepted',
      data: updatedMember
    });
  } catch (error) {
    logger.error(`Error accepting team invitation: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to accept team invitation');
  }
};

/**
 * Update a team member's role
 * @route PUT /api/subscriptions/teams/:teamId/members/:memberId
 * @access Private
 */
export const updateTeamMember = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const { teamId, memberId } = req.params;
    const { role } = req.body;
    
    if (!role) {
      throw new ApiError(400, 'Role is required');
    }
    
    // Check if the user is an admin or owner of the team
    const hasPermission = await teamSubscriptionModel.hasTeamRole(
      teamId,
      userId,
      [TeamMemberRole.OWNER, TeamMemberRole.ADMIN]
    );
    
    if (!hasPermission) {
      throw new ApiError(403, 'You do not have permission to update team members');
    }
    
    // Get the member to update
    const { data: member, error: memberError } = await supabaseClient.getClient()
      .from('team_members')
      .select('*')
      .eq('id', memberId)
      .eq('teamId', teamId)
      .single();
    
    if (memberError || !member) {
      throw new ApiError(404, 'Team member not found');
    }
    
    // Check if trying to change the owner's role
    if (member.role === TeamMemberRole.OWNER) {
      throw new ApiError(400, 'Cannot change the role of the team owner');
    }
    
    // Check if admin is trying to create another admin
    if (
      role === TeamMemberRole.ADMIN && 
      member.role !== TeamMemberRole.ADMIN &&
      await teamSubscriptionModel.hasTeamRole(teamId, userId, [TeamMemberRole.ADMIN])
    ) {
      // Check if the user is the owner
      const isOwner = await teamSubscriptionModel.hasTeamRole(teamId, userId, [TeamMemberRole.OWNER]);
      
      if (!isOwner) {
        throw new ApiError(403, 'Only the team owner can promote members to admin');
      }
    }
    
    // Update the member
    const updatedMember = await teamSubscriptionModel.updateTeamMember(
      teamId,
      member.userId,
      { role: role as TeamMemberRole }
    );
    
    res.status(200).json({
      success: true,
      message: 'Team member updated successfully',
      data: updatedMember
    });
  } catch (error) {
    logger.error(`Error updating team member: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to update team member');
  }
};

/**
 * Remove a team member
 * @route DELETE /api/subscriptions/teams/:teamId/members/:memberId
 * @access Private
 */
export const removeTeamMember = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const { teamId, memberId } = req.params;
    
    // Check if the user is an admin or owner of the team
    const hasPermission = await teamSubscriptionModel.hasTeamRole(
      teamId,
      userId,
      [TeamMemberRole.OWNER, TeamMemberRole.ADMIN]
    );
    
    // Users can remove themselves
    const isSelf = memberId === userId;
    
    if (!hasPermission && !isSelf) {
      throw new ApiError(403, 'You do not have permission to remove team members');
    }
    
    // Get the member to remove
    const { data: member, error: memberError } = await supabaseClient.getClient()
      .from('team_members')
      .select('*')
      .eq('id', memberId)
      .eq('teamId', teamId)
      .single();
    
    if (memberError || !member) {
      throw new ApiError(404, 'Team member not found');
    }
    
    // Check if trying to remove the owner
    if (member.role === TeamMemberRole.OWNER) {
      throw new ApiError(400, 'Cannot remove the team owner');
    }
    
    // Check if admin is trying to remove another admin
    if (
      member.role === TeamMemberRole.ADMIN && 
      await teamSubscriptionModel.hasTeamRole(teamId, userId, [TeamMemberRole.ADMIN]) &&
      !await teamSubscriptionModel.hasTeamRole(teamId, userId, [TeamMemberRole.OWNER])
    ) {
      throw new ApiError(403, 'Admins cannot remove other admins');
    }
    
    // Remove the member
    await teamSubscriptionModel.removeTeamMember(teamId, member.userId);
    
    res.status(200).json({
      success: true,
      message: 'Team member removed successfully'
    });
  } catch (error) {
    logger.error(`Error removing team member: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to remove team member');
  }
};

/**
 * Update team seats
 * @route PUT /api/subscriptions/teams/:teamId/seats
 * @access Private
 */
export const updateTeamSeats = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const { teamId } = req.params;
    const { seats, prorate = true } = req.body;
    
    if (!seats || seats < 1) {
      throw new ApiError(400, 'Number of seats is required and must be at least 1');
    }
    
    // Check if the user is the owner of the team
    const hasPermission = await teamSubscriptionModel.hasTeamRole(
      teamId,
      userId,
      [TeamMemberRole.OWNER]
    );
    
    if (!hasPermission) {
      throw new ApiError(403, 'Only the team owner can update seats');
    }
    
    // Update team seats
    const updatedTeam = await teamBillingService.updateTeamSeats(
      teamId,
      seats,
      prorate
    );
    
    res.status(200).json({
      success: true,
      message: 'Team seats updated successfully',
      data: updatedTeam
    });
  } catch (error) {
    logger.error(`Error updating team seats: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to update team seats');
  }
};

/**
 * Change team subscription tier
 * @route PUT /api/subscriptions/teams/:teamId/tier
 * @access Private
 */
export const changeTeamTier = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const { teamId } = req.params;
    const { tierId, prorate = true } = req.body;
    
    if (!tierId) {
      throw new ApiError(400, 'Subscription tier ID is required');
    }
    
    // Check if the user is the owner of the team
    const hasPermission = await teamSubscriptionModel.hasTeamRole(
      teamId,
      userId,
      [TeamMemberRole.OWNER]
    );
    
    if (!hasPermission) {
      throw new ApiError(403, 'Only the team owner can change the subscription tier');
    }
    
    // Change team tier
    const updatedTeam = await teamBillingService.changeTeamSubscriptionTier(
      teamId,
      tierId,
      prorate
    );
    
    res.status(200).json({
      success: true,
      message: 'Team subscription tier updated successfully',
      data: updatedTeam
    });
  } catch (error) {
    logger.error(`Error changing team tier: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to change team subscription tier');
  }
};

/**
 * Cancel team subscription
 * @route POST /api/subscriptions/teams/:teamId/cancel
 * @access Private
 */
export const cancelTeamSubscription = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const { teamId } = req.params;
    const { atPeriodEnd = true } = req.body;
    
    // Check if the user is the owner of the team
    const hasPermission = await teamSubscriptionModel.hasTeamRole(
      teamId,
      userId,
      [TeamMemberRole.OWNER]
    );
    
    if (!hasPermission) {
      throw new ApiError(403, 'Only the team owner can cancel the subscription');
    }
    
    // Cancel team subscription
    const updatedTeam = await teamBillingService.cancelTeamSubscription(
      teamId,
      atPeriodEnd
    );
    
    res.status(200).json({
      success: true,
      message: `Team subscription ${atPeriodEnd ? 'will be canceled at the end of the billing period' : 'has been canceled'}`,
      data: updatedTeam
    });
  } catch (error) {
    logger.error(`Error canceling team subscription: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to cancel team subscription');
  }
};

/**
 * Get team billing preview
 * @route GET /api/subscriptions/teams/:teamId/billing-preview
 * @access Private
 */
export const getTeamBillingPreview = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const { teamId } = req.params;
    const { seats, tierId } = req.query;
    
    // Check if the user is the owner of the team
    const hasPermission = await teamSubscriptionModel.hasTeamRole(
      teamId,
      userId,
      [TeamMemberRole.OWNER]
    );
    
    if (!hasPermission) {
      throw new ApiError(403, 'Only the team owner can view billing previews');
    }
    
    // Get billing preview
    const preview = await teamBillingService.calculateTeamBillingPreview(
      teamId,
      seats ? parseInt(seats as string, 10) : undefined,
      tierId as string | undefined
    );
    
    res.status(200).json({
      success: true,
      data: preview
    });
  } catch (error) {
    logger.error(`Error getting team billing preview: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to get team billing preview');
  }
};

export default {
  getUserTeams,
  getTeam,
  createTeam,
  updateTeam,
  deleteTeam,
  getTeamMembers,
  inviteTeamMember,
  acceptTeamInvitation,
  updateTeamMember,
  removeTeamMember,
  updateTeamSeats,
  changeTeamTier,
  cancelTeamSubscription,
  getTeamBillingPreview
};
