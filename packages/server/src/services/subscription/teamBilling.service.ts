/**
 * Team Billing Service
 * 
 * This service provides functionality for managing team billing,
 * including seat-based pricing and team subscription management.
 */

import { logger } from '../../utils/logger';
import { 
  TeamSubscription, 
  getTeamById, 
  updateTeam,
  getTeamMembers,
  TeamMemberStatus
} from '../../models/teamSubscription.model';
import { getSubscriptionTierById } from '../../models/subscriptionTier.model';
import stripeService from '../payment/stripeService';

/**
 * Team billing options
 */
export interface TeamBillingOptions {
  seats: number;
  paymentMethodId?: string;
  trialDays?: number;
  metadata?: Record<string, any>;
}

/**
 * Create a team subscription
 * @param ownerId Owner user ID
 * @param name Team name
 * @param tierId Subscription tier ID
 * @param options Billing options
 * @returns Created team subscription
 */
export async function createTeamSubscription(
  ownerId: string,
  name: string,
  tierId: string,
  options: TeamBillingOptions
): Promise<TeamSubscription> {
  try {
    // Get the subscription tier
    const tier = await getSubscriptionTierById(tierId);
    
    if (!tier) {
      throw new Error('Invalid subscription tier');
    }
    
    // Create Stripe customer if not exists
    const customer = await stripeService.getOrCreateCustomer(ownerId);
    
    if (!customer) {
      throw new Error('Failed to create Stripe customer');
    }
    
    // Calculate seat price
    const seatPrice = tier.price;
    const totalPrice = seatPrice * options.seats;
    
    // Create Stripe subscription
    const stripeSubscription = await stripeService.createSubscription(
      customer.id,
      tier.stripePriceId!,
      options.paymentMethodId,
      {
        quantity: options.seats,
        trialDays: options.trialDays,
        metadata: {
          teamName: name,
          seats: options.seats.toString(),
          ...options.metadata
        }
      }
    );
    
    // Create team subscription
    const now = new Date();
    const teamSubscription = {
      name,
      ownerId,
      tierId,
      status: stripeSubscription.status as TeamSubscription['status'],
      seats: options.seats,
      startDate: new Date(stripeSubscription.start_date * 1000),
      autoRenew: !stripeSubscription.cancel_at_period_end,
      stripeCustomerId: customer.id,
      stripeSubscriptionId: stripeSubscription.id,
      stripePriceId: tier.stripePriceId,
      stripePaymentMethodId: options.paymentMethodId,
      currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      trialEndDate: stripeSubscription.trial_end 
        ? new Date(stripeSubscription.trial_end * 1000) 
        : undefined,
      metadata: options.metadata
    };
    
    // Create the team in the database
    const createdTeam = await createTeam(teamSubscription);
    
    return createdTeam;
  } catch (error) {
    logger.error(`Failed to create team subscription: ${error}`);
    throw error;
  }
}

/**
 * Update team subscription seats
 * @param teamId Team ID
 * @param seats New number of seats
 * @param prorate Whether to prorate the change
 * @returns Updated team subscription
 */
export async function updateTeamSeats(
  teamId: string,
  seats: number,
  prorate: boolean = true
): Promise<TeamSubscription> {
  try {
    // Get the team
    const team = await getTeamById(teamId);
    
    if (!team) {
      throw new Error('Team not found');
    }
    
    if (!team.stripeSubscriptionId) {
      throw new Error('Team is not linked to Stripe');
    }
    
    // Get active team members count
    const members = await getTeamMembers(teamId);
    const activeMembers = members.filter(m => m.status === TeamMemberStatus.ACTIVE);
    
    // Validate seats
    if (seats < activeMembers.length) {
      throw new Error(`Cannot reduce seats below active member count (${activeMembers.length})`);
    }
    
    // Update Stripe subscription
    const updatedSubscription = await stripeService.updateSubscriptionQuantity(
      team.stripeSubscriptionId,
      seats,
      prorate
    );
    
    // Update team in database
    const updates = {
      seats,
      currentPeriodStart: new Date(updatedSubscription.current_period_start * 1000),
      currentPeriodEnd: new Date(updatedSubscription.current_period_end * 1000),
      metadata: {
        ...team.metadata,
        lastSeatUpdate: new Date().toISOString(),
        previousSeats: team.seats
      }
    };
    
    const updatedTeam = await updateTeam(teamId, updates);
    
    return updatedTeam;
  } catch (error) {
    logger.error(`Failed to update team seats: ${error}`);
    throw error;
  }
}

/**
 * Cancel team subscription
 * @param teamId Team ID
 * @param atPeriodEnd Whether to cancel at the end of the current period
 * @returns Updated team subscription
 */
export async function cancelTeamSubscription(
  teamId: string,
  atPeriodEnd: boolean = true
): Promise<TeamSubscription> {
  try {
    // Get the team
    const team = await getTeamById(teamId);
    
    if (!team) {
      throw new Error('Team not found');
    }
    
    if (!team.stripeSubscriptionId) {
      throw new Error('Team is not linked to Stripe');
    }
    
    // Cancel Stripe subscription
    const canceledSubscription = await stripeService.cancelSubscription(
      team.stripeSubscriptionId,
      atPeriodEnd
    );
    
    // Update team in database
    const now = new Date();
    const updates: Partial<TeamSubscription> = {
      cancelAtPeriodEnd: true,
      canceledAt: now,
      autoRenew: false,
      metadata: {
        ...team.metadata,
        canceledAt: now.toISOString(),
        cancelReason: 'User requested cancellation'
      }
    };
    
    // If canceling immediately, update status
    if (!atPeriodEnd) {
      updates.status = 'canceled';
      updates.endDate = now;
    }
    
    const updatedTeam = await updateTeam(teamId, updates);
    
    return updatedTeam;
  } catch (error) {
    logger.error(`Failed to cancel team subscription: ${error}`);
    throw error;
  }
}

/**
 * Change team subscription tier
 * @param teamId Team ID
 * @param newTierId New subscription tier ID
 * @param prorate Whether to prorate the change
 * @returns Updated team subscription
 */
export async function changeTeamSubscriptionTier(
  teamId: string,
  newTierId: string,
  prorate: boolean = true
): Promise<TeamSubscription> {
  try {
    // Get the team
    const team = await getTeamById(teamId);
    
    if (!team) {
      throw new Error('Team not found');
    }
    
    if (!team.stripeSubscriptionId) {
      throw new Error('Team is not linked to Stripe');
    }
    
    // Get the new tier
    const newTier = await getSubscriptionTierById(newTierId);
    
    if (!newTier) {
      throw new Error('Invalid subscription tier');
    }
    
    if (!newTier.stripePriceId) {
      throw new Error('Subscription tier is not linked to Stripe');
    }
    
    // Update Stripe subscription
    const updatedSubscription = await stripeService.updateSubscription(
      team.stripeSubscriptionId,
      newTier.stripePriceId,
      prorate ? undefined : Math.floor(Date.now() / 1000)
    );
    
    // Update team in database
    const updates = {
      tierId: newTierId,
      stripePriceId: newTier.stripePriceId,
      currentPeriodStart: new Date(updatedSubscription.current_period_start * 1000),
      currentPeriodEnd: new Date(updatedSubscription.current_period_end * 1000),
      metadata: {
        ...team.metadata,
        previousTierId: team.tierId,
        tierChangedAt: new Date().toISOString()
      }
    };
    
    const updatedTeam = await updateTeam(teamId, updates);
    
    return updatedTeam;
  } catch (error) {
    logger.error(`Failed to change team subscription tier: ${error}`);
    throw error;
  }
}

/**
 * Calculate team billing preview
 * @param teamId Team ID
 * @param seats Number of seats
 * @param tierId Subscription tier ID
 * @returns Billing preview
 */
export async function calculateTeamBillingPreview(
  teamId: string,
  seats?: number,
  tierId?: string
): Promise<any> {
  try {
    // Get the team
    const team = await getTeamById(teamId);
    
    if (!team) {
      throw new Error('Team not found');
    }
    
    if (!team.stripeSubscriptionId) {
      throw new Error('Team is not linked to Stripe');
    }
    
    // Use current values if not provided
    const newSeats = seats || team.seats;
    const newTierId = tierId || team.tierId;
    
    // Get the new tier
    const newTier = await getSubscriptionTierById(newTierId);
    
    if (!newTier) {
      throw new Error('Invalid subscription tier');
    }
    
    if (!newTier.stripePriceId) {
      throw new Error('Subscription tier is not linked to Stripe');
    }
    
    // Calculate preview
    let preview: any;
    
    // If changing tier
    if (tierId && tierId !== team.tierId) {
      preview = await stripeService.calculateProration(
        team.stripeSubscriptionId,
        newTier.stripePriceId,
        undefined,
        newSeats
      );
    } 
    // If changing seats
    else if (seats && seats !== team.seats) {
      preview = await stripeService.previewSubscriptionUpdate(
        team.stripeSubscriptionId,
        {
          quantity: newSeats
        }
      );
    }
    // No changes
    else {
      // Just return current billing info
      preview = {
        currentAmount: newTier.price * team.seats * 100, // in cents
        newAmount: newTier.price * newSeats * 100, // in cents
        proratedAmount: 0,
        totalAmount: 0,
        isUpgrade: false,
        isCredit: false
      };
    }
    
    return {
      currentTier: team.tierId,
      newTier: newTierId,
      currentSeats: team.seats,
      newSeats,
      currentAmount: preview.currentAmount / 100, // Convert to dollars
      newAmount: preview.newAmount / 100, // Convert to dollars
      proratedAmount: preview.proratedAmount / 100, // Convert to dollars
      totalAmount: preview.totalAmount / 100, // Convert to dollars
      isUpgrade: preview.isUpgrade,
      isCredit: preview.isCredit,
      nextBillingDate: team.currentPeriodEnd
    };
  } catch (error) {
    logger.error(`Failed to calculate team billing preview: ${error}`);
    throw error;
  }
}

export default {
  createTeamSubscription,
  updateTeamSeats,
  cancelTeamSubscription,
  changeTeamSubscriptionTier,
  calculateTeamBillingPreview
};
