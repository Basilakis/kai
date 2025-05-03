-- Migration: 022_credit_enhancements.sql
-- Description: Creates tables for enhanced credit system management

-- Bulk Credit Packages Table
CREATE TABLE IF NOT EXISTS public.bulk_credit_packages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  credit_amount INTEGER NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  discount_percentage NUMERIC(5,2) NOT NULL,
  stripe_price_id VARCHAR(255),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB
);

-- Credit Top-up Settings Table
CREATE TABLE IF NOT EXISTS public.credit_topup_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  threshold_amount INTEGER NOT NULL,
  topup_amount INTEGER NOT NULL,
  max_monthly_spend NUMERIC(10,2),
  payment_method_id VARCHAR(255),
  last_topup_at TIMESTAMPTZ,
  monthly_spend NUMERIC(10,2) DEFAULT 0,
  monthly_spend_reset_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_credit_topup_settings_user_id ON public.credit_topup_settings(user_id);

-- Credit Top-up History Table
CREATE TABLE IF NOT EXISTS public.credit_topup_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  setting_id UUID NOT NULL REFERENCES public.credit_topup_settings(id) ON DELETE CASCADE,
  credit_amount INTEGER NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  payment_id VARCHAR(255),
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_credit_topup_history_user_id ON public.credit_topup_history(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_topup_history_setting_id ON public.credit_topup_history(setting_id);

-- Credit Alert Settings Table
CREATE TABLE IF NOT EXISTS public.credit_alert_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  threshold_amount INTEGER NOT NULL,
  alert_types TEXT[] NOT NULL,
  email_addresses TEXT[],
  phone_numbers TEXT[],
  webhook_urls TEXT[],
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_credit_alert_settings_user_id ON public.credit_alert_settings(user_id);

-- Credit Alert History Table
CREATE TABLE IF NOT EXISTS public.credit_alert_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  setting_id UUID NOT NULL REFERENCES public.credit_alert_settings(id) ON DELETE CASCADE,
  credit_balance INTEGER NOT NULL,
  threshold_amount INTEGER NOT NULL,
  alert_types TEXT[] NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'sent', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_credit_alert_history_user_id ON public.credit_alert_history(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_alert_history_setting_id ON public.credit_alert_history(setting_id);

-- Credit Transfers Table
CREATE TABLE IF NOT EXISTS public.credit_transfers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  note TEXT,
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
  from_transaction_id UUID,
  to_transaction_id UUID,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_credit_transfers_from_user_id ON public.credit_transfers(from_user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transfers_to_user_id ON public.credit_transfers(to_user_id);

-- Function to get users needing top-up
CREATE OR REPLACE FUNCTION public.get_users_needing_topup()
RETURNS TABLE (
  user_id UUID,
  setting_id UUID,
  credit_balance INTEGER,
  setting public.credit_topup_settings
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id AS user_id,
    s.id AS setting_id,
    COALESCE(c.balance, 0) AS credit_balance,
    s AS setting
  FROM
    public.credit_topup_settings s
    JOIN auth.users u ON s.user_id = u.id
    LEFT JOIN public.user_credits c ON u.id = c.user_id
  WHERE
    s.is_enabled = true
    AND s.payment_method_id IS NOT NULL
    AND COALESCE(c.balance, 0) <= s.threshold_amount
    AND (
      s.max_monthly_spend IS NULL
      OR s.monthly_spend IS NULL
      OR s.monthly_spend < s.max_monthly_spend
    );
END;
$$ LANGUAGE plpgsql;

-- Function to get users needing alerts
CREATE OR REPLACE FUNCTION public.get_users_needing_alerts()
RETURNS TABLE (
  user_id UUID,
  setting_id UUID,
  credit_balance INTEGER,
  setting public.credit_alert_settings
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id AS user_id,
    s.id AS setting_id,
    COALESCE(c.balance, 0) AS credit_balance,
    s AS setting
  FROM
    public.credit_alert_settings s
    JOIN auth.users u ON s.user_id = u.id
    LEFT JOIN public.user_credits c ON u.id = c.user_id
  WHERE
    s.is_enabled = true
    AND COALESCE(c.balance, 0) <= s.threshold_amount
    AND (
      s.last_triggered_at IS NULL
      OR s.last_triggered_at < NOW() - INTERVAL '24 hours'
    );
END;
$$ LANGUAGE plpgsql;

-- Create function to update the updated_at column
CREATE OR REPLACE FUNCTION public.update_credit_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_bulk_credit_packages_updated_at ON public.bulk_credit_packages;
CREATE TRIGGER update_bulk_credit_packages_updated_at
BEFORE UPDATE ON public.bulk_credit_packages
FOR EACH ROW
EXECUTE FUNCTION public.update_credit_updated_at_column();

DROP TRIGGER IF EXISTS update_credit_topup_settings_updated_at ON public.credit_topup_settings;
CREATE TRIGGER update_credit_topup_settings_updated_at
BEFORE UPDATE ON public.credit_topup_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_credit_updated_at_column();

DROP TRIGGER IF EXISTS update_credit_alert_settings_updated_at ON public.credit_alert_settings;
CREATE TRIGGER update_credit_alert_settings_updated_at
BEFORE UPDATE ON public.credit_alert_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_credit_updated_at_column();

-- Create RLS policies
ALTER TABLE public.bulk_credit_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_topup_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_topup_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_alert_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_alert_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transfers ENABLE ROW LEVEL SECURITY;

-- Users can see all bulk credit packages
CREATE POLICY bulk_credit_packages_select_policy ON public.bulk_credit_packages
  FOR SELECT USING (true);

-- Users can only see and manage their own credit settings
CREATE POLICY credit_topup_settings_select_policy ON public.credit_topup_settings
  FOR SELECT USING (auth.uid() = user_id);
  
CREATE POLICY credit_topup_settings_insert_policy ON public.credit_topup_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);
  
CREATE POLICY credit_topup_settings_update_policy ON public.credit_topup_settings
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can only see their own credit history
CREATE POLICY credit_topup_history_select_policy ON public.credit_topup_history
  FOR SELECT USING (auth.uid() = user_id);

-- Users can only see and manage their own alert settings
CREATE POLICY credit_alert_settings_select_policy ON public.credit_alert_settings
  FOR SELECT USING (auth.uid() = user_id);
  
CREATE POLICY credit_alert_settings_insert_policy ON public.credit_alert_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);
  
CREATE POLICY credit_alert_settings_update_policy ON public.credit_alert_settings
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can only see their own alert history
CREATE POLICY credit_alert_history_select_policy ON public.credit_alert_history
  FOR SELECT USING (auth.uid() = user_id);

-- Users can see credit transfers they're involved in
CREATE POLICY credit_transfers_select_policy ON public.credit_transfers
  FOR SELECT USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

-- Add comments for documentation
COMMENT ON TABLE public.bulk_credit_packages IS 'Bulk credit packages available for purchase';
COMMENT ON TABLE public.credit_topup_settings IS 'User settings for automatic credit top-ups';
COMMENT ON TABLE public.credit_topup_history IS 'History of automatic credit top-ups';
COMMENT ON TABLE public.credit_alert_settings IS 'User settings for credit balance alerts';
COMMENT ON TABLE public.credit_alert_history IS 'History of credit balance alerts';
COMMENT ON TABLE public.credit_transfers IS 'Credit transfers between users';
COMMENT ON FUNCTION public.get_users_needing_topup IS 'Function to get users who need automatic credit top-ups';
COMMENT ON FUNCTION public.get_users_needing_alerts IS 'Function to get users who need credit balance alerts';
COMMENT ON FUNCTION public.update_credit_updated_at_column IS 'Function to automatically update the updated_at column for credit tables';

-- Add this migration to the migrations table
INSERT INTO public.migrations (name, applied_at)
VALUES ('022_credit_enhancements.sql', NOW())
ON CONFLICT (name) DO NOTHING;
