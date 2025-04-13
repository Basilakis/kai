/**
 * Subscription Types
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
  tier?: SubscriptionTier; // For nested tier in UserSubscription
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
 * Represents a payment method
 */
export interface PaymentMethod {
  id: string;
  type: string;
  card?: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  };
  billingDetails?: {
    name?: string;
    email?: string;
    phone?: string;
    address?: {
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      postal_code?: string;
      country?: string;
    };
  };
}

/**
 * Represents a user's credit balance
 */
export interface UserCredit {
  id: string;
  userId: string;
  balance: number;
  lastUpdatedAt: string;
  createdAt: string;
}
