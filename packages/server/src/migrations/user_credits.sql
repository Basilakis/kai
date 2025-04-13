-- User Credits Table
-- This table stores user credit balances and related information

-- Create user_credits table
CREATE TABLE IF NOT EXISTS user_credits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0,
  last_updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create credit_transactions table
CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL, -- Positive for additions, negative for usage
  balance INTEGER NOT NULL, -- Balance after transaction
  description TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('purchase', 'usage', 'refund', 'expiration', 'adjustment', 'subscription')),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_credits_user_id ON user_credits(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON credit_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON credit_transactions(type);

-- Create RLS policies for user_credits
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;

-- Users can only read their own credits
CREATE POLICY user_credits_select_policy ON user_credits
  FOR SELECT USING (auth.uid() = user_id);

-- Only the service role can insert/update/delete
CREATE POLICY user_credits_all_policy ON user_credits
  FOR ALL USING (auth.role() = 'service_role');

-- Create RLS policies for credit_transactions
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

-- Users can only read their own transactions
CREATE POLICY credit_transactions_select_policy ON credit_transactions
  FOR SELECT USING (auth.uid() = user_id);

-- Only the service role can insert/update/delete
CREATE POLICY credit_transactions_all_policy ON credit_transactions
  FOR ALL USING (auth.role() = 'service_role');
