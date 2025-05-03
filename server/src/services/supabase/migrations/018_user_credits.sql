-- Migration: 018_user_credits.sql
-- Description: Creates tables for user credits and credit transactions

-- Create user_credits table
CREATE TABLE IF NOT EXISTS public.user_credits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0,
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create credit_transactions table
CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL, -- Positive for additions, negative for usage
  balance INTEGER NOT NULL, -- Balance after transaction
  description TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('purchase', 'usage', 'refund', 'expiration', 'adjustment', 'subscription')),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_credits_user_id ON public.user_credits(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON public.credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON public.credit_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON public.credit_transactions(type);

-- Create RLS policies for user_credits
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;

-- Users can only read their own credits
CREATE POLICY user_credits_select_policy ON public.user_credits
  FOR SELECT USING (auth.uid() = user_id);

-- Only the service role can insert/update/delete
CREATE POLICY user_credits_all_policy ON public.user_credits
  FOR ALL USING (auth.role() = 'service_role');

-- Create RLS policies for credit_transactions
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

-- Users can only read their own transactions
CREATE POLICY credit_transactions_select_policy ON public.credit_transactions
  FOR SELECT USING (auth.uid() = user_id);

-- Only the service role can insert/update/delete
CREATE POLICY credit_transactions_all_policy ON public.credit_transactions
  FOR ALL USING (auth.role() = 'service_role');

-- Create function to update user credits
CREATE OR REPLACE FUNCTION public.update_user_credits()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.user_credits
  SET 
    balance = NEW.balance,
    last_updated_at = NOW()
  WHERE user_id = NEW.user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update user credits after transaction
DROP TRIGGER IF EXISTS update_user_credits_after_transaction ON public.credit_transactions;
CREATE TRIGGER update_user_credits_after_transaction
AFTER INSERT ON public.credit_transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_user_credits();

-- Add comments for documentation
COMMENT ON TABLE public.user_credits IS 'Stores user credit balances';
COMMENT ON TABLE public.credit_transactions IS 'Records all credit transactions for users';
COMMENT ON FUNCTION public.update_user_credits IS 'Function to update user credit balance after a transaction';

-- Add this migration to the migrations table
INSERT INTO public.migrations (name, applied_at)
VALUES ('018_user_credits.sql', NOW())
ON CONFLICT (name) DO NOTHING;
