/**
 * Subscription Analytics Service
 * 
 * This service provides analytics for subscriptions, including revenue metrics,
 * churn analysis, and usage patterns.
 */

import { supabaseClient } from '../supabase/supabaseClient';
import { logger } from '../../utils/logger';

/**
 * Tier distribution for analytics
 */
export interface TierDistribution {
  name: string;
  count: number;
  revenue: number;
  percentage: number;
}

/**
 * Recent activity for analytics
 */
export interface RecentActivity {
  event: string;
  date: string;
  userId: string;
  metadata?: Record<string, any>;
}

/**
 * Credit usage for analytics
 */
export interface CreditUsage {
  feature: string;
  credits: number;
  percentage: number;
}

/**
 * Subscription analytics
 */
export interface SubscriptionAnalytics {
  revenue: {
    monthly: number;
    annual: number;
    averagePerUser: number;
    byTier: Record<string, number>;
  };
  subscribers: {
    total: number;
    active: number;
    trialing: number;
    pastDue: number;
    canceled: number;
  };
  churnRate: number;
  conversionRate: number;
  tierDistribution: TierDistribution[];
  recentActivity: RecentActivity[];
  creditUsage: CreditUsage[];
}

/**
 * Get subscription analytics
 * @returns Subscription analytics data
 */
export async function getSubscriptionAnalytics(): Promise<SubscriptionAnalytics> {
  try {
    // Get subscription counts by status
    const { data: statusCounts, error: statusError } = await (supabaseClient.getClient()
      .from('user_subscriptions') as any)
      .select('status, count')
      .group('status');
    
    if (statusError) {
      throw new Error(`Error getting subscription status counts: ${statusError.message}`);
    }
    
    // Get subscription counts and revenue by tier
    const { data: tierData, error: tierError } = await (supabaseClient.getClient()
      .rpc('get_subscription_tier_analytics') as any);
    
    if (tierError) {
      throw new Error(`Error getting subscription tier analytics: ${tierError.message}`);
    }
    
    // Get recent subscription activity
    const { data: recentActivity, error: activityError } = await (supabaseClient.getClient()
      .from('subscription_state_transitions') as any)
      .select('to_state, created_at, subscription_id, reason, metadata')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (activityError) {
      throw new Error(`Error getting recent subscription activity: ${activityError.message}`);
    }
    
    // Get credit usage by feature
    const { data: creditUsage, error: creditError } = await (supabaseClient.getClient()
      .rpc('get_credit_usage_by_feature') as any);
    
    if (creditError) {
      throw new Error(`Error getting credit usage: ${creditError.message}`);
    }
    
    // Calculate subscriber counts
    const subscriberCounts = {
      total: 0,
      active: 0,
      trialing: 0,
      pastDue: 0,
      canceled: 0
    };
    
    statusCounts.forEach((item: any) => {
      const status = item.status;
      const count = parseInt(item.count);
      
      subscriberCounts.total += count;
      
      if (status === 'active') {
        subscriberCounts.active = count;
      } else if (status === 'trialing') {
        subscriberCounts.trialing = count;
      } else if (status === 'past_due') {
        subscriberCounts.pastDue = count;
      } else if (status === 'canceled') {
        subscriberCounts.canceled = count;
      }
    });
    
    // Calculate revenue metrics
    let monthlyRevenue = 0;
    const revenueByTier: Record<string, number> = {};
    
    tierData.forEach((item: any) => {
      const tierRevenue = parseFloat(item.revenue) || 0;
      monthlyRevenue += tierRevenue;
      revenueByTier[item.tier_name] = tierRevenue;
    });
    
    // Calculate tier distribution
    const tierDistribution: TierDistribution[] = tierData.map((item: any) => ({
      name: item.tier_name,
      count: parseInt(item.count),
      revenue: parseFloat(item.revenue) || 0,
      percentage: parseInt(item.count) / subscriberCounts.total
    }));
    
    // Calculate churn rate (simplified)
    const churnRate = subscriberCounts.canceled / (subscriberCounts.total || 1);
    
    // Calculate conversion rate (simplified)
    const conversionRate = subscriberCounts.active / (subscriberCounts.total || 1);
    
    // Format recent activity
    const formattedActivity: RecentActivity[] = recentActivity.map((item: any) => ({
      event: `Subscription changed to ${item.to_state}`,
      date: item.created_at,
      userId: item.metadata?.userId || 'Unknown',
      metadata: item.metadata
    }));
    
    // Format credit usage
    const totalCredits = creditUsage.reduce((sum: number, item: any) => sum + parseInt(item.credits), 0);
    const formattedCreditUsage: CreditUsage[] = creditUsage.map((item: any) => ({
      feature: item.feature,
      credits: parseInt(item.credits),
      percentage: parseInt(item.credits) / (totalCredits || 1)
    }));
    
    return {
      revenue: {
        monthly: monthlyRevenue,
        annual: monthlyRevenue * 12,
        averagePerUser: subscriberCounts.active ? monthlyRevenue / subscriberCounts.active : 0,
        byTier: revenueByTier
      },
      subscribers: subscriberCounts,
      churnRate,
      conversionRate,
      tierDistribution,
      recentActivity: formattedActivity,
      creditUsage: formattedCreditUsage
    };
  } catch (error) {
    logger.error(`Failed to get subscription analytics: ${error}`);
    throw error;
  }
}

/**
 * Get subscription analytics by date range
 * @param startDate Start date
 * @param endDate End date
 * @returns Subscription analytics data
 */
export async function getSubscriptionAnalyticsByDateRange(
  startDate: Date,
  endDate: Date
): Promise<SubscriptionAnalytics> {
  try {
    // For now, return the same analytics
    // In a real implementation, this would filter by date range
    return getSubscriptionAnalytics();
  } catch (error) {
    logger.error(`Failed to get subscription analytics by date range: ${error}`);
    throw error;
  }
}

/**
 * Get subscription churn analytics
 * @returns Churn analytics data
 */
export async function getSubscriptionChurnAnalytics(): Promise<any> {
  try {
    // Get churn data by tier
    const { data: churnByTier, error: churnError } = await (supabaseClient.getClient()
      .rpc('get_subscription_churn_by_tier') as any);
    
    if (churnError) {
      throw new Error(`Error getting churn by tier: ${churnError.message}`);
    }
    
    // Get churn data by period
    const { data: churnByPeriod, error: periodError } = await (supabaseClient.getClient()
      .rpc('get_subscription_churn_by_period') as any);
    
    if (periodError) {
      throw new Error(`Error getting churn by period: ${periodError.message}`);
    }
    
    // Calculate overall churn rate
    const { data: statusCounts, error: statusError } = await (supabaseClient.getClient()
      .from('user_subscriptions') as any)
      .select('status, count')
      .group('status');
    
    if (statusError) {
      throw new Error(`Error getting subscription status counts: ${statusError.message}`);
    }
    
    let totalSubscribers = 0;
    let canceledSubscribers = 0;
    
    statusCounts.forEach((item: any) => {
      const count = parseInt(item.count);
      totalSubscribers += count;
      
      if (item.status === 'canceled') {
        canceledSubscribers = count;
      }
    });
    
    const churnRate = canceledSubscribers / (totalSubscribers || 1);
    
    return {
      churnRate,
      churnByTier: churnByTier || [],
      churnByPeriod: churnByPeriod || []
    };
  } catch (error) {
    logger.error(`Failed to get subscription churn analytics: ${error}`);
    throw error;
  }
}

/**
 * Get subscription revenue analytics
 * @returns Revenue analytics data
 */
export async function getSubscriptionRevenueAnalytics(): Promise<any> {
  try {
    // Get revenue data by tier
    const { data: revenueByTier, error: tierError } = await (supabaseClient.getClient()
      .rpc('get_subscription_revenue_by_tier') as any);
    
    if (tierError) {
      throw new Error(`Error getting revenue by tier: ${tierError.message}`);
    }
    
    // Get revenue data by period
    const { data: revenueByPeriod, error: periodError } = await (supabaseClient.getClient()
      .rpc('get_subscription_revenue_by_period') as any);
    
    if (periodError) {
      throw new Error(`Error getting revenue by period: ${periodError.message}`);
    }
    
    // Calculate MRR and ARR
    let mrr = 0;
    
    (revenueByTier || []).forEach((item: any) => {
      mrr += parseFloat(item.revenue) || 0;
    });
    
    const arr = mrr * 12;
    
    return {
      mrr,
      arr,
      revenueByTier: revenueByTier || [],
      revenueByPeriod: revenueByPeriod || []
    };
  } catch (error) {
    logger.error(`Failed to get subscription revenue analytics: ${error}`);
    throw error;
  }
}

export default {
  getSubscriptionAnalytics,
  getSubscriptionAnalyticsByDateRange,
  getSubscriptionChurnAnalytics,
  getSubscriptionRevenueAnalytics
};
