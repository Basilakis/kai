-- Migration: 020_auth_enhancements.sql
-- Description: Creates tables for enhanced authentication features

-- Two-Factor Authentication Table
CREATE TABLE IF NOT EXISTS public.two_factor_auth (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  method VARCHAR(20) NOT NULL CHECK (method IN ('totp', 'sms', 'email')),
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  secret TEXT,
  backup_codes JSONB,
  phone_number VARCHAR(20),
  email VARCHAR(255),
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_two_factor_auth_user_id ON public.two_factor_auth(user_id);

-- User Sessions Table
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  refresh_token_hash TEXT,
  device_info JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  location JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token_hash ON public.user_sessions(token_hash);

-- Password Reset Tokens Table
CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  is_used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used_at TIMESTAMPTZ,
  ip_address VARCHAR(45),
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON public.password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token_hash ON public.password_reset_tokens(token_hash);

-- API Keys Table
CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  key TEXT NOT NULL,
  prefix VARCHAR(10) NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT ARRAY['read'],
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON public.api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON public.api_keys(prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_key ON public.api_keys(key);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_auth_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_two_factor_auth_updated_at ON public.two_factor_auth;
CREATE TRIGGER update_two_factor_auth_updated_at
BEFORE UPDATE ON public.two_factor_auth
FOR EACH ROW
EXECUTE FUNCTION public.update_auth_updated_at_column();

DROP TRIGGER IF EXISTS update_api_keys_updated_at ON public.api_keys;
CREATE TRIGGER update_api_keys_updated_at
BEFORE UPDATE ON public.api_keys
FOR EACH ROW
EXECUTE FUNCTION public.update_auth_updated_at_column();

-- Create RLS policies
ALTER TABLE public.two_factor_auth ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Users can only see and manage their own 2FA settings
CREATE POLICY two_factor_auth_select_policy ON public.two_factor_auth
  FOR SELECT USING (auth.uid() = user_id);
  
CREATE POLICY two_factor_auth_insert_policy ON public.two_factor_auth
  FOR INSERT WITH CHECK (auth.uid() = user_id);
  
CREATE POLICY two_factor_auth_update_policy ON public.two_factor_auth
  FOR UPDATE USING (auth.uid() = user_id);
  
CREATE POLICY two_factor_auth_delete_policy ON public.two_factor_auth
  FOR DELETE USING (auth.uid() = user_id);

-- Users can only see and manage their own sessions
CREATE POLICY user_sessions_select_policy ON public.user_sessions
  FOR SELECT USING (auth.uid() = user_id);
  
CREATE POLICY user_sessions_update_policy ON public.user_sessions
  FOR UPDATE USING (auth.uid() = user_id);
  
CREATE POLICY user_sessions_delete_policy ON public.user_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- Users can only see and manage their own API keys
CREATE POLICY api_keys_select_policy ON public.api_keys
  FOR SELECT USING (auth.uid() = user_id);
  
CREATE POLICY api_keys_insert_policy ON public.api_keys
  FOR INSERT WITH CHECK (auth.uid() = user_id);
  
CREATE POLICY api_keys_update_policy ON public.api_keys
  FOR UPDATE USING (auth.uid() = user_id);
  
CREATE POLICY api_keys_delete_policy ON public.api_keys
  FOR DELETE USING (auth.uid() = user_id);

-- Add comments for documentation
COMMENT ON TABLE public.two_factor_auth IS 'Stores two-factor authentication settings for users';
COMMENT ON TABLE public.user_sessions IS 'Tracks user sessions for enhanced security';
COMMENT ON TABLE public.password_reset_tokens IS 'Stores password reset tokens';
COMMENT ON TABLE public.api_keys IS 'API keys for programmatic access to the API';
COMMENT ON FUNCTION public.update_auth_updated_at_column IS 'Function to automatically update the updated_at column for auth tables';

-- Add this migration to the migrations table
INSERT INTO public.migrations (name, applied_at)
VALUES ('020_auth_enhancements.sql', NOW())
ON CONFLICT (name) DO NOTHING;
