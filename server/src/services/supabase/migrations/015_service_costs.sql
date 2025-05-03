-- Migration: 015_service_costs.sql
-- Description: Creates tables for tracking service costs and usage

-- Create service_costs table
CREATE TABLE IF NOT EXISTS public.service_costs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_name TEXT NOT NULL,
  service_key TEXT NOT NULL UNIQUE,
  cost_per_unit DECIMAL(10, 6) NOT NULL,
  unit_type TEXT NOT NULL,
  multiplier DECIMAL(10, 2) NOT NULL DEFAULT 1.0,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(service_key)
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_service_costs_service_key ON public.service_costs(service_key);

-- Create RLS policies for service_costs
ALTER TABLE public.service_costs ENABLE ROW LEVEL SECURITY;

-- Only admins can read service costs
CREATE POLICY service_costs_select_policy ON public.service_costs
  FOR SELECT USING (auth.role() = 'admin' OR auth.role() = 'service_role');

-- Only the service role and admins can insert/update/delete
CREATE POLICY service_costs_all_policy ON public.service_costs
  FOR ALL USING (auth.role() = 'admin' OR auth.role() = 'service_role');

-- Add default service costs
INSERT INTO public.service_costs (service_name, service_key, cost_per_unit, unit_type, multiplier, description)
VALUES 
  ('OpenAI GPT-4', 'openai.gpt-4', 0.00006, 'token', 1.2, 'OpenAI GPT-4 model cost per token'),
  ('OpenAI GPT-3.5 Turbo', 'openai.gpt-3.5-turbo', 0.000002, 'token', 1.2, 'OpenAI GPT-3.5 Turbo model cost per token'),
  ('OpenAI DALL-E 3', 'openai.dall-e-3', 0.04, 'image', 1.2, 'OpenAI DALL-E 3 image generation cost per image'),
  ('Anthropic Claude 2', 'anthropic.claude-2', 0.00008, 'token', 1.2, 'Anthropic Claude 2 model cost per token'),
  ('Stability AI', 'stability.stable-diffusion', 0.02, 'image', 1.2, 'Stability AI image generation cost per image')
ON CONFLICT (service_key) DO NOTHING;

-- Add credit usage tracking to credit_transactions table
ALTER TABLE public.credit_transactions ADD COLUMN IF NOT EXISTS service_key TEXT;
ALTER TABLE public.credit_transactions ADD COLUMN IF NOT EXISTS service_usage JSONB;
CREATE INDEX IF NOT EXISTS idx_credit_transactions_service_key ON public.credit_transactions(service_key);

-- Create function to update the updated_at column
CREATE OR REPLACE FUNCTION public.update_service_costs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update the updated_at column
DROP TRIGGER IF EXISTS update_service_costs_updated_at ON public.service_costs;
CREATE TRIGGER update_service_costs_updated_at
BEFORE UPDATE ON public.service_costs
FOR EACH ROW
EXECUTE FUNCTION public.update_service_costs_updated_at();

-- Add comments for documentation
COMMENT ON TABLE public.service_costs IS 'Costs for third-party API services that can be configured by admins';
COMMENT ON FUNCTION public.update_service_costs_updated_at IS 'Function to automatically update the updated_at column for service costs';

-- Add this migration to the migrations table
INSERT INTO public.migrations (name, applied_at)
VALUES ('015_service_costs.sql', NOW())
ON CONFLICT (name) DO NOTHING;
