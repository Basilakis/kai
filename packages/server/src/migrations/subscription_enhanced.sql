-- Enhanced Subscription Management Framework Migrations
-- This file contains migrations for subscription tier versioning and state machine

-- Create subscription_tier_versions table
CREATE TABLE IF NOT EXISTS subscription_tier_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tier_id UUID NOT NULL REFERENCES subscription_tiers(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  changes JSONB NOT NULL,
  effective_date TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  UNIQUE(tier_id, version_number)
);

-- Create subscription_state_transitions table
CREATE TABLE IF NOT EXISTS subscription_state_transitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id UUID NOT NULL REFERENCES user_subscriptions(id) ON DELETE CASCADE,
  from_state TEXT NOT NULL,
  to_state TEXT NOT NULL,
  reason TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tier_versions_tier_id ON subscription_tier_versions(tier_id);
CREATE INDEX IF NOT EXISTS idx_tier_versions_effective_date ON subscription_tier_versions(effective_date);
CREATE INDEX IF NOT EXISTS idx_state_transitions_subscription_id ON subscription_state_transitions(subscription_id);
CREATE INDEX IF NOT EXISTS idx_state_transitions_created_at ON subscription_state_transitions(created_at);

-- Create RLS policies for subscription_tier_versions
ALTER TABLE subscription_tier_versions ENABLE ROW LEVEL SECURITY;

-- Only admins can read tier versions
CREATE POLICY tier_versions_select_policy ON subscription_tier_versions
  FOR SELECT USING (auth.role() = 'service_role' OR auth.role() = 'admin');

-- Only admins can insert/update/delete tier versions
CREATE POLICY tier_versions_all_policy ON subscription_tier_versions
  FOR ALL USING (auth.role() = 'service_role' OR auth.role() = 'admin');

-- Create RLS policies for subscription_state_transitions
ALTER TABLE subscription_state_transitions ENABLE ROW LEVEL SECURITY;

-- Only admins can read state transitions
CREATE POLICY state_transitions_select_policy ON subscription_state_transitions
  FOR SELECT USING (auth.role() = 'service_role' OR auth.role() = 'admin');

-- Only the service role can insert/update/delete state transitions
CREATE POLICY state_transitions_all_policy ON subscription_state_transitions
  FOR ALL USING (auth.role() = 'service_role');

-- Add new fields to subscription_tiers table
ALTER TABLE subscription_tiers ADD COLUMN IF NOT EXISTS billing_interval TEXT NOT NULL DEFAULT 'monthly';
ALTER TABLE subscription_tiers ADD COLUMN IF NOT EXISTS storage_limits JSONB;
ALTER TABLE subscription_tiers ADD COLUMN IF NOT EXISTS credit_limits JSONB;
ALTER TABLE subscription_tiers ADD COLUMN IF NOT EXISTS max_moodboards INTEGER;

-- Add new fields to user_subscriptions table
ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;
ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS stripe_payment_method_id TEXT;
ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMP WITH TIME ZONE;
ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMP WITH TIME ZONE;
ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT FALSE;

-- Update existing subscription tiers with default values
UPDATE subscription_tiers
SET 
  storage_limits = '{"maxStorageGB": 1, "maxFileSize": 10, "maxFilesPerProject": 100}'::jsonb,
  credit_limits = '{"includedCredits": 0, "maxPurchasableCredits": 1000, "creditPriceMultiplier": 1}'::jsonb
WHERE storage_limits IS NULL OR credit_limits IS NULL;
