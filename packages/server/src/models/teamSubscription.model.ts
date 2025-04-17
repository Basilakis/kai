/**
 * Team Subscription Model
 * 
 * This model handles the storage and retrieval of team subscriptions,
 * including team members and usage tracking.
 */

import { supabaseClient } from '../services/supabase/supabaseClient';
import { logger } from '../utils/logger';

/**
 * Team member role
 */
export enum TeamMemberRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MEMBER = 'member'
}

/**
 * Team member status
 */
export enum TeamMemberStatus {
  INVITED = 'invited',
  ACTIVE = 'active',
  SUSPENDED = 'suspended'
}

/**
 * Team member
 */
export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  email: string;
  role: TeamMemberRole;
  status: TeamMemberStatus;
  invitedBy?: string;
  invitedAt?: Date;
  joinedAt?: Date;
  lastActiveAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Team subscription
 */
export interface TeamSubscription {
  id: string;
  name: string;
  ownerId: string;
  tierId: string;
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete' | 'paused';
  seats: number;
  usedSeats: number;
  startDate: Date;
  endDate?: Date;
  renewalDate?: Date;
  canceledAt?: Date;
  trialEndDate?: Date;
  paymentMethod?: string;
  paymentId?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripePriceId?: string;
  stripePaymentMethodId?: string;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
  autoRenew: boolean;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

/**
 * Get all teams for a user
 * @param userId User ID
 * @returns Array of team subscriptions
 */
export async function getUserTeams(userId: string): Promise<TeamSubscription[]> {
  try {
    // Get teams where the user is a member
    const { data: memberships, error: membershipError } = await supabaseClient.getClient()
      .from('team_members')
      .select('teamId')
      .eq('userId', userId)
      .eq('status', TeamMemberStatus.ACTIVE);
    
    if (membershipError) {
      logger.error(`Error getting team memberships: ${membershipError.message}`);
      throw membershipError;
    }
    
    if (!memberships || memberships.length === 0) {
      return [];
    }
    
    // Get the teams
    const teamIds = memberships.map(m => m.teamId);
    
    const { data: teams, error: teamsError } = await supabaseClient.getClient()
      .from('team_subscriptions')
      .select('*')
      .in('id', teamIds);
    
    if (teamsError) {
      logger.error(`Error getting teams: ${teamsError.message}`);
      throw teamsError;
    }
    
    return teams || [];
  } catch (error) {
    logger.error(`Failed to get user teams: ${error}`);
    throw error;
  }
}

/**
 * Get a team by ID
 * @param teamId Team ID
 * @returns Team subscription or null if not found
 */
export async function getTeamById(teamId: string): Promise<TeamSubscription | null> {
  try {
    const { data, error } = await supabaseClient.getClient()
      .from('team_subscriptions')
      .select('*')
      .eq('id', teamId)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      logger.error(`Error getting team: ${error.message}`);
      throw error;
    }
    
    return data;
  } catch (error) {
    logger.error(`Failed to get team: ${error}`);
    throw error;
  }
}

/**
 * Create a new team
 * @param team Team data
 * @returns Created team
 */
export async function createTeam(
  team: Omit<TeamSubscription, 'id' | 'createdAt' | 'updatedAt' | 'usedSeats'>
): Promise<TeamSubscription> {
  try {
    const now = new Date();
    const newTeam = {
      ...team,
      usedSeats: 1, // Owner counts as one seat
      createdAt: now,
      updatedAt: now
    };
    
    const { data, error } = await supabaseClient.getClient()
      .from('team_subscriptions')
      .insert([newTeam])
      .select();
    
    if (error) {
      logger.error(`Error creating team: ${error.message}`);
      throw error;
    }
    
    // Add the owner as a team member
    await addTeamMember({
      teamId: data[0].id,
      userId: team.ownerId,
      email: '', // Will be filled in by a trigger
      role: TeamMemberRole.OWNER,
      status: TeamMemberStatus.ACTIVE,
      joinedAt: now
    });
    
    return data[0];
  } catch (error) {
    logger.error(`Failed to create team: ${error}`);
    throw error;
  }
}

/**
 * Update a team
 * @param teamId Team ID
 * @param updates Updates to apply
 * @returns Updated team
 */
export async function updateTeam(
  teamId: string,
  updates: Partial<Omit<TeamSubscription, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<TeamSubscription> {
  try {
    const now = new Date();
    const updatedTeam = {
      ...updates,
      updatedAt: now
    };
    
    const { data, error } = await supabaseClient.getClient()
      .from('team_subscriptions')
      .update(updatedTeam)
      .eq('id', teamId)
      .select();
    
    if (error) {
      logger.error(`Error updating team: ${error.message}`);
      throw error;
    }
    
    return data[0];
  } catch (error) {
    logger.error(`Failed to update team: ${error}`);
    throw error;
  }
}

/**
 * Delete a team
 * @param teamId Team ID
 * @returns Whether the team was deleted
 */
export async function deleteTeam(teamId: string): Promise<boolean> {
  try {
    // Delete team members first
    const { error: membersError } = await supabaseClient.getClient()
      .from('team_members')
      .delete()
      .eq('teamId', teamId);
    
    if (membersError) {
      logger.error(`Error deleting team members: ${membersError.message}`);
      throw membersError;
    }
    
    // Delete the team
    const { error } = await supabaseClient.getClient()
      .from('team_subscriptions')
      .delete()
      .eq('id', teamId);
    
    if (error) {
      logger.error(`Error deleting team: ${error.message}`);
      throw error;
    }
    
    return true;
  } catch (error) {
    logger.error(`Failed to delete team: ${error}`);
    throw error;
  }
}

/**
 * Get team members
 * @param teamId Team ID
 * @returns Array of team members
 */
export async function getTeamMembers(teamId: string): Promise<TeamMember[]> {
  try {
    const { data, error } = await supabaseClient.getClient()
      .from('team_members')
      .select('*')
      .eq('teamId', teamId);
    
    if (error) {
      logger.error(`Error getting team members: ${error.message}`);
      throw error;
    }
    
    return data || [];
  } catch (error) {
    logger.error(`Failed to get team members: ${error}`);
    throw error;
  }
}

/**
 * Get a team member
 * @param teamId Team ID
 * @param userId User ID
 * @returns Team member or null if not found
 */
export async function getTeamMember(teamId: string, userId: string): Promise<TeamMember | null> {
  try {
    const { data, error } = await supabaseClient.getClient()
      .from('team_members')
      .select('*')
      .eq('teamId', teamId)
      .eq('userId', userId)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      logger.error(`Error getting team member: ${error.message}`);
      throw error;
    }
    
    return data;
  } catch (error) {
    logger.error(`Failed to get team member: ${error}`);
    throw error;
  }
}

/**
 * Add a team member
 * @param member Team member data
 * @returns Created team member
 */
export async function addTeamMember(
  member: Omit<TeamMember, 'id' | 'createdAt' | 'updatedAt'>
): Promise<TeamMember> {
  try {
    const now = new Date();
    const newMember = {
      ...member,
      createdAt: now,
      updatedAt: now
    };
    
    const { data, error } = await supabaseClient.getClient()
      .from('team_members')
      .insert([newMember])
      .select();
    
    if (error) {
      logger.error(`Error adding team member: ${error.message}`);
      throw error;
    }
    
    // Update used seats count
    if (member.status === TeamMemberStatus.ACTIVE) {
      await incrementTeamSeats(member.teamId);
    }
    
    return data[0];
  } catch (error) {
    logger.error(`Failed to add team member: ${error}`);
    throw error;
  }
}

/**
 * Update a team member
 * @param teamId Team ID
 * @param userId User ID
 * @param updates Updates to apply
 * @returns Updated team member
 */
export async function updateTeamMember(
  teamId: string,
  userId: string,
  updates: Partial<Omit<TeamMember, 'id' | 'teamId' | 'userId' | 'createdAt' | 'updatedAt'>>
): Promise<TeamMember> {
  try {
    const now = new Date();
    const updatedMember = {
      ...updates,
      updatedAt: now
    };
    
    // Get current member status
    const currentMember = await getTeamMember(teamId, userId);
    
    if (!currentMember) {
      throw new Error('Team member not found');
    }
    
    const { data, error } = await supabaseClient.getClient()
      .from('team_members')
      .update(updatedMember)
      .eq('teamId', teamId)
      .eq('userId', userId)
      .select();
    
    if (error) {
      logger.error(`Error updating team member: ${error.message}`);
      throw error;
    }
    
    // Update used seats count if status changed
    if (updates.status && updates.status !== currentMember.status) {
      if (updates.status === TeamMemberStatus.ACTIVE && currentMember.status !== TeamMemberStatus.ACTIVE) {
        await incrementTeamSeats(teamId);
      } else if (updates.status !== TeamMemberStatus.ACTIVE && currentMember.status === TeamMemberStatus.ACTIVE) {
        await decrementTeamSeats(teamId);
      }
    }
    
    return data[0];
  } catch (error) {
    logger.error(`Failed to update team member: ${error}`);
    throw error;
  }
}

/**
 * Remove a team member
 * @param teamId Team ID
 * @param userId User ID
 * @returns Whether the member was removed
 */
export async function removeTeamMember(teamId: string, userId: string): Promise<boolean> {
  try {
    // Get current member status
    const currentMember = await getTeamMember(teamId, userId);
    
    if (!currentMember) {
      throw new Error('Team member not found');
    }
    
    // Check if this is the owner
    if (currentMember.role === TeamMemberRole.OWNER) {
      throw new Error('Cannot remove the team owner');
    }
    
    const { error } = await supabaseClient.getClient()
      .from('team_members')
      .delete()
      .eq('teamId', teamId)
      .eq('userId', userId);
    
    if (error) {
      logger.error(`Error removing team member: ${error.message}`);
      throw error;
    }
    
    // Update used seats count if member was active
    if (currentMember.status === TeamMemberStatus.ACTIVE) {
      await decrementTeamSeats(teamId);
    }
    
    return true;
  } catch (error) {
    logger.error(`Failed to remove team member: ${error}`);
    throw error;
  }
}

/**
 * Increment team used seats count
 * @param teamId Team ID
 * @returns Updated team
 */
export async function incrementTeamSeats(teamId: string): Promise<TeamSubscription> {
  try {
    const { data, error } = await supabaseClient.getClient()
      .rpc('increment_team_seats', { team_id: teamId });
    
    if (error) {
      logger.error(`Error incrementing team seats: ${error.message}`);
      throw error;
    }
    
    return data;
  } catch (error) {
    logger.error(`Failed to increment team seats: ${error}`);
    throw error;
  }
}

/**
 * Decrement team used seats count
 * @param teamId Team ID
 * @returns Updated team
 */
export async function decrementTeamSeats(teamId: string): Promise<TeamSubscription> {
  try {
    const { data, error } = await supabaseClient.getClient()
      .rpc('decrement_team_seats', { team_id: teamId });
    
    if (error) {
      logger.error(`Error decrementing team seats: ${error.message}`);
      throw error;
    }
    
    return data;
  } catch (error) {
    logger.error(`Failed to decrement team seats: ${error}`);
    throw error;
  }
}

/**
 * Check if a user is a member of a team
 * @param teamId Team ID
 * @param userId User ID
 * @returns Whether the user is a member of the team
 */
export async function isTeamMember(teamId: string, userId: string): Promise<boolean> {
  try {
    const member = await getTeamMember(teamId, userId);
    return !!member && member.status === TeamMemberStatus.ACTIVE;
  } catch (error) {
    logger.error(`Failed to check team membership: ${error}`);
    return false;
  }
}

/**
 * Check if a user has a specific role in a team
 * @param teamId Team ID
 * @param userId User ID
 * @param roles Roles to check
 * @returns Whether the user has one of the specified roles
 */
export async function hasTeamRole(teamId: string, userId: string, roles: TeamMemberRole[]): Promise<boolean> {
  try {
    const member = await getTeamMember(teamId, userId);
    return !!member && member.status === TeamMemberStatus.ACTIVE && roles.includes(member.role);
  } catch (error) {
    logger.error(`Failed to check team role: ${error}`);
    return false;
  }
}

export default {
  getUserTeams,
  getTeamById,
  createTeam,
  updateTeam,
  deleteTeam,
  getTeamMembers,
  getTeamMember,
  addTeamMember,
  updateTeamMember,
  removeTeamMember,
  isTeamMember,
  hasTeamRole,
  TeamMemberRole,
  TeamMemberStatus
};
