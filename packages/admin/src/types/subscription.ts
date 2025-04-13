/**
 * Subscription Types for Admin Panel
 */

/**
 * Represents module access for a subscription tier
 */
export interface ModuleAccess {
  name: string;
  enabled: boolean;
  specificFeatures?: Record<string, boolean>;
  usageLimits?: Record<string, number>;
}

/**
 * Represents API limits for a subscription tier
 */
export interface ApiLimits {
  requestsPerMinute: number;
  requestsPerDay: number;
  requestsPerMonth: number;
  maxPayloadSize?: number;
  includedModules: string[];
}

/**
 * Represents storage limits for a subscription tier
 */
export interface StorageLimits {
  maxStorageGB: number;
  maxFileSize: number;
  maxFilesPerProject: number;
}

/**
 * Represents credit limits for a subscription tier
 */
export interface CreditLimits {
  includedCredits: number;
  maxPurchasableCredits: number;
  creditPriceMultiplier: number;
}

/**
 * Represents a subscription tier
 */
export interface SubscriptionTier {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  stripePriceId?: string;
  stripeProductId?: string;
  billingInterval: 'monthly' | 'yearly' | 'one-time';
  moduleAccess: ModuleAccess[];
  apiLimits: ApiLimits;
  storageLimits: StorageLimits;
  creditLimits: CreditLimits;
  maxProjects?: number;
  maxTeamMembers?: number;
  maxMoodboards?: number;
  supportLevel: 'basic' | 'priority' | 'dedicated';
  isPublic: boolean;
  customFeatures?: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Represents subscription usage metrics
 */
export interface SubscriptionUsage {
  apiRequests: {
    count: number;
    lastResetDate: string;
    resetPeriod: 'day' | 'month';
  };
  moduleUsage: Record<string, {
    count: number;
    lastUsedDate: string;
  }>;
}

/**
 * Represents a user for subscription management
 */
export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  credits: number;
  createdAt: string;
}

/**
 * Represents a user subscription
 */
export interface UserSubscription {
  id: string;
  userId: string;
  tierId: string;
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete' | 'paused';
  startDate: string;
  endDate?: string;
  renewalDate?: string;
  canceledAt?: string;
  trialEndDate?: string;
  paymentMethod?: string;
  paymentId?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripePriceId?: string;
  stripePaymentMethodId?: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
  autoRenew: boolean;
  usage: SubscriptionUsage;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  tier?: SubscriptionTier; // Populated tier information
  user?: User; // Populated user information
}

/**
 * Represents a credit transaction
 */
export interface CreditTransaction {
  id: string;
  userId: string;
  amount: number;
  balance: number;
  description: string;
  type: 'purchase' | 'usage' | 'refund' | 'expiration' | 'adjustment' | 'subscription';
  metadata?: Record<string, any>;
  createdAt: string;
  expiresAt?: string;
}

/**
 * Represents tier distribution for analytics
 */
export interface TierDistribution {
  name: string;
  count: number;
  revenue: number;
  percentage: number;
}

/**
 * Represents recent activity for analytics
 */
export interface RecentActivity {
  event: string;
  date: string;
  userId: string;
  metadata?: Record<string, any>;
}

/**
 * Represents credit usage for analytics
 */
export interface CreditUsage {
  feature: string;
  credits: number;
  percentage: number;
}

/**
 * Represents subscription analytics
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
 * Represents subscription plan version
 */
export interface SubscriptionTierVersion {
  id: string;
  tierId: string;
  versionNumber: number;
  changes: Record<string, any>;
  effectiveDate: string;
  createdAt: string;
  createdBy: string;
}

/**
 * Represents a subscription state transition
 */
export interface SubscriptionStateTransition {
  id: string;
  subscriptionId: string;
  fromState: string;
  toState: string;
  reason?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

/**
 * Represents a subscription invoice
 */
export interface SubscriptionInvoice {
  id: string;
  subscriptionId: string;
  userId: string;
  amount: number;
  currency: string;
  status: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void';
  dueDate: string;
  paidAt?: string;
  stripeInvoiceId?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}
