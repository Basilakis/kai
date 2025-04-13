/**
 * Subscription State Machine Model
 * 
 * This model handles subscription state transitions and maintains a history
 * of state changes for audit and analytics purposes.
 */

import { supabaseClient } from '../services/supabase/supabaseClient';
import { logger } from '../utils/logger';
import { updateUserSubscription, UserSubscription } from './userSubscription.model';

/**
 * Subscription states
 */
export type SubscriptionState = 
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'paused';

/**
 * Subscription state transition
 */
export interface StateTransition {
  id: string;
  subscriptionId: string;
  fromState: SubscriptionState;
  toState: SubscriptionState;
  reason?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

/**
 * Valid state transitions
 * This defines which state transitions are allowed
 */
const VALID_TRANSITIONS: Record<SubscriptionState, SubscriptionState[]> = {
  active: ['past_due', 'canceled', 'paused'],
  trialing: ['active', 'canceled', 'past_due', 'incomplete'],
  past_due: ['active', 'canceled'],
  canceled: ['active'],
  incomplete: ['active', 'canceled'],
  paused: ['active', 'canceled']
};

/**
 * Transition a subscription to a new state
 * @param subscriptionId Subscription ID
 * @param toState New state
 * @param reason Reason for transition
 * @param metadata Additional metadata
 * @returns Updated subscription
 */
export async function transitionSubscriptionState(
  subscriptionId: string,
  toState: SubscriptionState,
  reason?: string,
  metadata?: Record<string, any>
): Promise<UserSubscription> {
  try {
    // Get current subscription
    const { data: subscription, error } = await (supabaseClient.getClient()
      .from('user_subscriptions') as any)
      .select('*')
      .eq('id', subscriptionId)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        throw new Error(`Subscription not found: ${subscriptionId}`);
      }
      throw error;
    }
    
    const fromState = subscription.status as SubscriptionState;
    
    // Check if transition is valid
    if (!isValidTransition(fromState, toState)) {
      throw new Error(`Invalid state transition from ${fromState} to ${toState}`);
    }
    
    // Update subscription state
    const updatedSubscription = await updateUserSubscription(subscriptionId, {
      status: toState
    });
    
    // Record state transition
    await recordStateTransition(
      subscriptionId,
      fromState,
      toState,
      reason,
      metadata
    );
    
    return updatedSubscription;
  } catch (error) {
    logger.error(`Failed to transition subscription state: ${error}`);
    throw error;
  }
}

/**
 * Check if a state transition is valid
 * @param fromState Current state
 * @param toState New state
 * @returns Whether the transition is valid
 */
export function isValidTransition(
  fromState: SubscriptionState,
  toState: SubscriptionState
): boolean {
  // Same state is always valid
  if (fromState === toState) {
    return true;
  }
  
  // Check if transition is in the valid transitions map
  return VALID_TRANSITIONS[fromState]?.includes(toState) || false;
}

/**
 * Record a state transition
 * @param subscriptionId Subscription ID
 * @param fromState Previous state
 * @param toState New state
 * @param reason Reason for transition
 * @param metadata Additional metadata
 * @returns Created state transition
 */
export async function recordStateTransition(
  subscriptionId: string,
  fromState: SubscriptionState,
  toState: SubscriptionState,
  reason?: string,
  metadata?: Record<string, any>
): Promise<StateTransition> {
  try {
    const now = new Date();
    const transition = {
      subscriptionId,
      fromState,
      toState,
      reason,
      metadata,
      createdAt: now
    };
    
    // Type assertion applied earlier in the chain
    const { data, error } = await (supabaseClient.getClient()
      .from('subscription_state_transitions') as any)
      .insert([transition])
      .select();
    
    if (error) {
      logger.error(`Error recording state transition: ${error.message}`);
      throw error;
    }
    
    return data[0];
  } catch (error) {
    logger.error(`Failed to record state transition: ${error}`);
    throw error;
  }
}

/**
 * Get state transitions for a subscription
 * @param subscriptionId Subscription ID
 * @returns Array of state transitions
 */
export async function getStateTransitions(subscriptionId: string): Promise<StateTransition[]> {
  try {
    // Type assertion applied earlier in the chain
    const { data, error } = await (supabaseClient.getClient()
      .from('subscription_state_transitions') as any)
      .select('*')
      .eq('subscriptionId', subscriptionId)
      .order('createdAt', { ascending: false });
    
    if (error) {
      logger.error(`Error getting state transitions: ${error.message}`);
      throw error;
    }
    
    return data || [];
  } catch (error) {
    logger.error(`Failed to get state transitions: ${error}`);
    throw error;
  }
}

/**
 * Get the current state of a subscription
 * @param subscriptionId Subscription ID
 * @returns Current subscription state
 */
export async function getCurrentState(subscriptionId: string): Promise<SubscriptionState> {
  try {
    // Type assertion applied earlier in the chain
    const { data, error } = await (supabaseClient.getClient()
      .from('user_subscriptions') as any)
      .select('status')
      .eq('id', subscriptionId)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        throw new Error(`Subscription not found: ${subscriptionId}`);
      }
      logger.error(`Error getting current state: ${error.message}`);
      throw error;
    }
    
    return data.status as SubscriptionState;
  } catch (error) {
    logger.error(`Failed to get current state: ${error}`);
    throw error;
  }
}

export default {
  transitionSubscriptionState,
  isValidTransition,
  recordStateTransition,
  getStateTransitions,
  getCurrentState
};
