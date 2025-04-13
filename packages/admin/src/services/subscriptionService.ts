import axios from 'axios';
import { API_BASE_URL } from '../config';
import { 
  SubscriptionTier, 
  UserSubscription, 
  SubscriptionAnalytics 
} from '../types/subscription';

// Set up axios instance with auth headers
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminAuthToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Subscription Tiers

/**
 * Get all subscription tiers
 */
export const getAllSubscriptionTiers = async (): Promise<{ data: SubscriptionTier[] }> => {
  const response = await api.get('/admin/subscriptions/tiers');
  return response.data;
};

/**
 * Get subscription tier by ID
 */
export const getSubscriptionTierById = async (tierId: string): Promise<{ data: SubscriptionTier }> => {
  const response = await api.get(`/admin/subscriptions/tiers/${tierId}`);
  return response.data;
};

/**
 * Create subscription tier
 */
export const createSubscriptionTier = async (tier: Omit<SubscriptionTier, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ data: SubscriptionTier }> => {
  const response = await api.post('/admin/subscriptions/tiers', tier);
  return response.data;
};

/**
 * Update subscription tier
 */
export const updateSubscriptionTier = async (tierId: string, tier: Partial<SubscriptionTier>): Promise<{ data: SubscriptionTier }> => {
  const response = await api.put(`/admin/subscriptions/tiers/${tierId}`, tier);
  return response.data;
};

/**
 * Delete subscription tier
 */
export const deleteSubscriptionTier = async (tierId: string): Promise<{ success: boolean }> => {
  const response = await api.delete(`/admin/subscriptions/tiers/${tierId}`);
  return response.data;
};

// User Subscriptions

/**
 * Get all user subscriptions
 */
export const getAllUserSubscriptions = async (
  limit: number = 10,
  offset: number = 0,
  search: string = '',
  status: string = 'all'
): Promise<{ data: UserSubscription[] }> => {
  const response = await api.get('/admin/subscriptions/users', {
    params: { limit, offset, search, status }
  });
  return response.data;
};

/**
 * Get user subscription by ID
 */
export const getUserSubscriptionById = async (subscriptionId: string): Promise<{ data: UserSubscription }> => {
  const response = await api.get(`/admin/subscriptions/users/${subscriptionId}`);
  return response.data;
};

/**
 * Get user subscription by user ID
 */
export const getUserSubscriptionByUserId = async (userId: string): Promise<{ data: UserSubscription }> => {
  const response = await api.get(`/admin/subscriptions/users/by-user/${userId}`);
  return response.data;
};

/**
 * Update user subscription
 */
export const updateUserSubscription = async (
  subscriptionId: string,
  updates: Partial<UserSubscription>
): Promise<{ data: UserSubscription }> => {
  const response = await api.put(`/admin/subscriptions/users/${subscriptionId}`, updates);
  return response.data;
};

/**
 * Cancel user subscription
 */
export const cancelUserSubscription = async (
  subscriptionId: string,
  cancelAtPeriodEnd: boolean = true
): Promise<{ data: UserSubscription }> => {
  const response = await api.post(`/admin/subscriptions/users/${subscriptionId}/cancel`, {
    cancelAtPeriodEnd
  });
  return response.data;
};

/**
 * Change user subscription tier
 */
export const changeUserSubscriptionTier = async (
  subscriptionId: string,
  newTierId: string,
  prorate: boolean = true
): Promise<{ data: UserSubscription }> => {
  const response = await api.post(`/admin/subscriptions/users/${subscriptionId}/change-tier`, {
    newTierId,
    prorate
  });
  return response.data;
};

// Credits

/**
 * Add credits to user
 */
export const addCreditsToUser = async (
  userId: string,
  amount: number,
  description: string
): Promise<{ success: boolean }> => {
  const response = await api.post(`/admin/subscriptions/credits/${userId}/add`, {
    amount,
    description,
    type: 'adjustment'
  });
  return response.data;
};

/**
 * Get user credit history
 */
export const getUserCreditHistory = async (
  userId: string,
  limit: number = 10,
  offset: number = 0
): Promise<{ data: any[] }> => {
  const response = await api.get(`/admin/subscriptions/credits/${userId}/history`, {
    params: { limit, offset }
  });
  return response.data;
};

// Analytics

/**
 * Get subscription analytics
 */
export const getSubscriptionAnalytics = async (): Promise<{ data: SubscriptionAnalytics }> => {
  const response = await api.get('/admin/subscriptions/analytics');
  return response.data;
};

/**
 * Get subscription analytics by date range
 */
export const getSubscriptionAnalyticsByDateRange = async (
  startDate: string,
  endDate: string
): Promise<{ data: SubscriptionAnalytics }> => {
  const response = await api.get('/admin/subscriptions/analytics/by-date', {
    params: { startDate, endDate }
  });
  return response.data;
};

/**
 * Get subscription churn analytics
 */
export const getSubscriptionChurnAnalytics = async (): Promise<{ data: any }> => {
  const response = await api.get('/admin/subscriptions/analytics/churn');
  return response.data;
};

/**
 * Get subscription revenue analytics
 */
export const getSubscriptionRevenueAnalytics = async (): Promise<{ data: any }> => {
  const response = await api.get('/admin/subscriptions/analytics/revenue');
  return response.data;
};

export default {
  getAllSubscriptionTiers,
  getSubscriptionTierById,
  createSubscriptionTier,
  updateSubscriptionTier,
  deleteSubscriptionTier,
  getAllUserSubscriptions,
  getUserSubscriptionById,
  getUserSubscriptionByUserId,
  updateUserSubscription,
  cancelUserSubscription,
  changeUserSubscriptionTier,
  addCreditsToUser,
  getUserCreditHistory,
  getSubscriptionAnalytics,
  getSubscriptionAnalyticsByDateRange,
  getSubscriptionChurnAnalytics,
  getSubscriptionRevenueAnalytics
};
