import axios from 'axios';
import { API_BASE_URL } from '../config';
import { SubscriptionTier, UserSubscription, CreditTransaction, PaymentMethod } from '../types/subscription';

// Set up axios instance with auth headers
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Subscription Tiers

/**
 * Fetch all available subscription tiers
 */
export const fetchSubscriptionTiers = async (): Promise<{ data: SubscriptionTier[] }> => {
  const response = await api.get('/subscriptions/tiers');
  return response.data;
};

/**
 * Fetch a specific subscription tier by ID
 */
export const fetchSubscriptionTier = async (tierId: string): Promise<{ data: SubscriptionTier }> => {
  const response = await api.get(`/subscriptions/tiers/${tierId}`);
  return response.data;
};

// User Subscriptions

/**
 * Get current user's subscription
 */
export const getCurrentSubscription = async (): Promise<{ data: UserSubscription }> => {
  const response = await api.get('/subscriptions/my-subscription');
  return response.data;
};

/**
 * Subscribe to a tier
 */
export const subscribeToTier = async (
  tierId: string,
  paymentMethodId: string,
  trialDays?: number,
  metadata?: Record<string, any>
): Promise<any> => {
  const response = await api.post('/subscriptions/subscribe', {
    tierId,
    paymentMethodId,
    trialDays,
    metadata
  });
  return response.data;
};

/**
 * Cancel subscription
 */
export const cancelSubscription = async (
  cancelAtPeriodEnd: boolean = true
): Promise<{ data: UserSubscription }> => {
  const response = await api.post('/subscriptions/cancel', {
    cancelAtPeriodEnd
  });
  return response.data;
};

/**
 * Change subscription plan
 */
export const changeSubscriptionPlan = async (
  newTierId: string,
  prorate: boolean = true,
  metadata?: Record<string, any>
): Promise<{ data: UserSubscription }> => {
  const response = await api.post('/subscriptions/change-plan', {
    newTierId,
    prorate,
    metadata
  });
  return response.data;
};

// Credits

/**
 * Get user's credit balance
 */
export const getCreditBalance = async (): Promise<{ data: { balance: number, lastUpdatedAt: string } }> => {
  const response = await api.get('/subscriptions/credits');
  return response.data;
};

/**
 * Get user's credit transactions
 */
export const getCreditTransactions = async (
  limit: number = 10,
  offset: number = 0
): Promise<{ data: CreditTransaction[] }> => {
  const response = await api.get('/subscriptions/credits/transactions', {
    params: { limit, offset }
  });
  return response.data;
};

/**
 * Purchase credits
 */
export const purchaseCredits = async (
  amount: number,
  paymentMethodId: string
): Promise<any> => {
  const response = await api.post('/subscriptions/credits/purchase', {
    amount,
    paymentMethodId
  });
  return response.data;
};

/**
 * Use credits
 */
export const useCredits = async (
  amount: number,
  description: string,
  type: string = 'usage',
  metadata?: Record<string, any>
): Promise<any> => {
  const response = await api.post('/subscriptions/credits/use', {
    amount,
    description,
    type,
    metadata
  });
  return response.data;
};

/**
 * Use credits for a specific service
 */
export const useServiceCredits = async (
  serviceKey: string,
  units: number,
  description: string,
  metadata?: Record<string, any>
): Promise<any> => {
  const response = await api.post('/subscriptions/credits/use-service', {
    serviceKey,
    units,
    description,
    metadata
  });
  return response.data;
};

/**
 * Get credit usage by service
 */
export const getCreditUsageByService = async (
  limit: number = 10,
  offset: number = 0
): Promise<any> => {
  const response = await api.get('/subscriptions/credits/usage-by-service', {
    params: { limit, offset }
  });
  return response.data;
};

/**
 * Get all service costs
 */
export const getServiceCosts = async (): Promise<any> => {
  const response = await api.get('/subscriptions/service-costs');
  return response.data;
};

// Payment Methods

/**
 * Get user's payment methods
 */
export const getPaymentMethods = async (): Promise<{ data: PaymentMethod[] }> => {
  const response = await api.get('/subscriptions/payment-methods');
  return response.data;
};

/**
 * Add a payment method
 */
export const addPaymentMethod = async (
  paymentMethodId: string
): Promise<any> => {
  const response = await api.post('/subscriptions/payment-methods', {
    paymentMethodId
  });
  return response.data;
};

export default {
  fetchSubscriptionTiers,
  fetchSubscriptionTier,
  getCurrentSubscription,
  subscribeToTier,
  cancelSubscription,
  changeSubscriptionPlan,
  getCreditBalance,
  getCreditTransactions,
  purchaseCredits,
  useCredits,
  getPaymentMethods,
  addPaymentMethod
};
