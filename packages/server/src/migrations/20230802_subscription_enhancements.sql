-- Subscription System Enhancements Migration

-- Team Subscriptions Table
CREATE TABLE IF NOT EXISTS team_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier_id VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('active', 'trialing', 'past_due', 'canceled', 'incomplete', 'paused')),
  seats INTEGER NOT NULL DEFAULT 1,
  used_seats INTEGER NOT NULL DEFAULT 0,
  start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_date TIMESTAMPTZ,
  renewal_date TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  trial_end_date TIMESTAMPTZ,
  payment_method VARCHAR(255),
  payment_id VARCHAR(255),
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  stripe_price_id VARCHAR(255),
  stripe_payment_method_id VARCHAR(255),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  auto_renew BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_team_subscriptions_owner_id ON team_subscriptions(owner_id);

-- Team Members Table
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES team_subscriptions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  status VARCHAR(20) NOT NULL CHECK (status IN ('invited', 'active', 'suspended')),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ,
  last_active_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_email ON team_members(email);

-- Bulk Pricing Tiers Table
CREATE TABLE IF NOT EXISTS bulk_pricing_tiers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type VARCHAR(20) NOT NULL CHECK (type IN ('subscription', 'credit')),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  min_quantity INTEGER NOT NULL,
  max_quantity INTEGER,
  discount_percentage NUMERIC(5,2) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB
);

-- Pricing Versions Table
CREATE TABLE IF NOT EXISTS pricing_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  effective_date TIMESTAMPTZ NOT NULL,
  expiration_date TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB
);

-- Tier Pricing Table
CREATE TABLE IF NOT EXISTS tier_pricing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  version_id UUID NOT NULL REFERENCES pricing_versions(id) ON DELETE CASCADE,
  tier_id VARCHAR(50) NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  billing_interval VARCHAR(20) NOT NULL CHECK (billing_interval IN ('monthly', 'yearly', 'one-time')),
  stripe_price_id VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_tier_pricing_version_id ON tier_pricing(version_id);
CREATE INDEX IF NOT EXISTS idx_tier_pricing_tier_id ON tier_pricing(tier_id);

-- User Pricing Assignments Table
CREATE TABLE IF NOT EXISTS user_pricing_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version_id UUID NOT NULL REFERENCES pricing_versions(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT,
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_user_pricing_assignments_user_id ON user_pricing_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_pricing_assignments_version_id ON user_pricing_assignments(version_id);

-- Functions for team seat management
CREATE OR REPLACE FUNCTION increment_team_seats(team_id UUID)
RETURNS team_subscriptions AS $$
DECLARE
  team team_subscriptions;
BEGIN
  UPDATE team_subscriptions
  SET used_seats = used_seats + 1,
      updated_at = NOW()
  WHERE id = team_id
  RETURNING * INTO team;
  
  RETURN team;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decrement_team_seats(team_id UUID)
RETURNS team_subscriptions AS $$
DECLARE
  team team_subscriptions;
BEGIN
  UPDATE team_subscriptions
  SET used_seats = GREATEST(0, used_seats - 1),
      updated_at = NOW()
  WHERE id = team_id
  RETURNING * INTO team;
  
  RETURN team;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_team_subscriptions_updated_at
BEFORE UPDATE ON team_subscriptions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_team_members_updated_at
BEFORE UPDATE ON team_members
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bulk_pricing_tiers_updated_at
BEFORE UPDATE ON bulk_pricing_tiers
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pricing_versions_updated_at
BEFORE UPDATE ON pricing_versions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tier_pricing_updated_at
BEFORE UPDATE ON tier_pricing
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_pricing_assignments_updated_at
BEFORE UPDATE ON user_pricing_assignments
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
