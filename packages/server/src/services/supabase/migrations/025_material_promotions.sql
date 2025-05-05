-- Migration: 025_material_promotions.sql
-- Description: Adds material promotion system for factories to promote their materials in 3D models

-- Create material_promotions table
CREATE TABLE public.material_promotions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  material_id UUID NOT NULL,
  factory_id UUID NOT NULL REFERENCES auth.users(id),
  credits_allocated INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('active', 'inactive', 'completed', 'pending')),
  start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_date TIMESTAMPTZ,
  usage_count INTEGER NOT NULL DEFAULT 0,
  impression_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure a material can only be promoted once at a time
  CONSTRAINT unique_active_material_promotion UNIQUE (material_id, status)
    WHERE status = 'active'
);

-- Add indexes for faster lookups
CREATE INDEX idx_material_promotions_material_id ON public.material_promotions(material_id);
CREATE INDEX idx_material_promotions_factory_id ON public.material_promotions(factory_id);
CREATE INDEX idx_material_promotions_status ON public.material_promotions(status);

-- Add function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_material_promotions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_material_promotions_updated_at
BEFORE UPDATE ON public.material_promotions
FOR EACH ROW
EXECUTE FUNCTION public.update_material_promotions_updated_at();

-- Add promotion type to credit_transactions
ALTER TABLE public.credit_transactions
ADD COLUMN promotion_id UUID REFERENCES public.material_promotions(id);

-- Create a function to allocate credits to a material promotion
CREATE OR REPLACE FUNCTION public.allocate_promotion_credits(
  p_user_id UUID,
  p_material_id UUID,
  p_credits INTEGER,
  p_description TEXT DEFAULT 'Material promotion credit allocation'
)
RETURNS UUID AS $$
DECLARE
  v_user_credit_balance INTEGER;
  v_promotion_id UUID;
  v_factory_type TEXT;
BEGIN
  -- Check if user is a factory
  SELECT raw_app_meta_data->>'user_type' INTO v_factory_type
  FROM auth.users
  WHERE id = p_user_id;
  
  IF v_factory_type != 'factory' THEN
    RAISE EXCEPTION 'Only factory users can allocate promotion credits';
  END IF;
  
  -- Check if user has enough credits
  SELECT balance INTO v_user_credit_balance
  FROM public.user_credits
  WHERE user_id = p_user_id;
  
  IF v_user_credit_balance IS NULL OR v_user_credit_balance < p_credits THEN
    RAISE EXCEPTION 'Insufficient credits for promotion';
  END IF;
  
  -- Create or update promotion
  INSERT INTO public.material_promotions (
    material_id,
    factory_id,
    credits_allocated,
    status,
    start_date
  ) VALUES (
    p_material_id,
    p_user_id,
    p_credits,
    'active',
    NOW()
  )
  ON CONFLICT (material_id, status)
  WHERE status = 'active'
  DO UPDATE SET
    credits_allocated = public.material_promotions.credits_allocated + p_credits,
    updated_at = NOW()
  RETURNING id INTO v_promotion_id;
  
  -- Deduct credits from user
  INSERT INTO public.credit_transactions (
    user_id,
    amount,
    balance,
    description,
    type,
    promotion_id
  )
  SELECT
    p_user_id,
    -p_credits,
    balance - p_credits,
    p_description,
    'promotion',
    v_promotion_id
  FROM public.user_credits
  WHERE user_id = p_user_id;
  
  -- Update user credit balance
  UPDATE public.user_credits
  SET balance = balance - p_credits
  WHERE user_id = p_user_id;
  
  RETURN v_promotion_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to track promotion usage
CREATE OR REPLACE FUNCTION public.track_promotion_usage(
  p_promotion_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Update usage count
  UPDATE public.material_promotions
  SET 
    usage_count = usage_count + 1,
    updated_at = NOW()
  WHERE id = p_promotion_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to track promotion impressions
CREATE OR REPLACE FUNCTION public.track_promotion_impression(
  p_promotion_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Update impression count
  UPDATE public.material_promotions
  SET 
    impression_count = impression_count + 1,
    updated_at = NOW()
  WHERE id = p_promotion_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to get active promotions for a material type
CREATE OR REPLACE FUNCTION public.get_active_promotions_by_material_type(
  p_material_type TEXT
)
RETURNS TABLE (
  promotion_id UUID,
  material_id UUID,
  factory_id UUID,
  credits_allocated INTEGER,
  material_name TEXT,
  material_type TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mp.id as promotion_id,
    mp.material_id,
    mp.factory_id,
    mp.credits_allocated,
    m.name as material_name,
    m.material_type
  FROM 
    public.material_promotions mp
  JOIN 
    public.materials m ON mp.material_id = m.id
  WHERE 
    mp.status = 'active'
    AND m.material_type = p_material_type
    AND mp.credits_allocated > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create RLS policies
ALTER TABLE public.material_promotions ENABLE ROW LEVEL SECURITY;

-- Factories can view their own promotions
CREATE POLICY material_promotions_select_policy ON public.material_promotions
  FOR SELECT USING (
    auth.uid() = factory_id OR
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid() 
      AND (
        auth.users.raw_app_meta_data->>'role' = 'admin' OR 
        auth.users.raw_app_meta_data->>'user_type' = 'admin'
      )
    )
  );

-- Factories can only create promotions for themselves
CREATE POLICY material_promotions_insert_policy ON public.material_promotions
  FOR INSERT WITH CHECK (
    auth.uid() = factory_id AND
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid() 
      AND auth.users.raw_app_meta_data->>'user_type' = 'factory'
    )
  );

-- Factories can only update their own promotions
CREATE POLICY material_promotions_update_policy ON public.material_promotions
  FOR UPDATE USING (
    auth.uid() = factory_id OR
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid() 
      AND (
        auth.users.raw_app_meta_data->>'role' = 'admin' OR 
        auth.users.raw_app_meta_data->>'user_type' = 'admin'
      )
    )
  );

-- Factories can only delete their own promotions
CREATE POLICY material_promotions_delete_policy ON public.material_promotions
  FOR DELETE USING (
    auth.uid() = factory_id OR
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid() 
      AND (
        auth.users.raw_app_meta_data->>'role' = 'admin' OR 
        auth.users.raw_app_meta_data->>'user_type' = 'admin'
      )
    )
  );

-- Add comments for documentation
COMMENT ON TABLE public.material_promotions IS 'Stores material promotions for factories to promote their materials in 3D models';
COMMENT ON FUNCTION public.allocate_promotion_credits IS 'Allocates credits to promote a material';
COMMENT ON FUNCTION public.track_promotion_usage IS 'Tracks when a promoted material is used in a 3D model';
COMMENT ON FUNCTION public.track_promotion_impression IS 'Tracks when a promoted material is shown to a user';
COMMENT ON FUNCTION public.get_active_promotions_by_material_type IS 'Gets active promotions for a specific material type';

-- Add this migration to the migrations table
INSERT INTO public.migrations (name, applied_at)
VALUES ('025_material_promotions.sql', NOW())
ON CONFLICT (name) DO NOTHING;
