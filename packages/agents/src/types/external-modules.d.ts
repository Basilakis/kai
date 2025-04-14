/**
 * Type declarations for external modules
 */

// Declare @kai/shared module
declare module '@kai/shared' {
  // Define SubscriptionTier as a string union type to match the actual implementation
  export type SubscriptionTier = 'free' | 'standard' | 'premium';

  // Add other types from @kai/shared as needed
  export interface User {
    id: string;
    email: string;
    name?: string;
    subscriptionTier: SubscriptionTier;
  }
}

// Declare uuid module
declare module 'uuid' {
  export function v4(): string;
}
