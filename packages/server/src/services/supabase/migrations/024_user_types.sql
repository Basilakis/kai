-- Migration: 024_user_types.sql
-- Description: Adds user_type field to user metadata and creates functions to manage user types

-- Create an enum type for user types
CREATE TYPE public.user_type AS ENUM ('user', 'factory', 'b2b', 'admin');

-- Create a function to set user_type in auth.users metadata
CREATE OR REPLACE FUNCTION public.set_user_type(
  user_id UUID,
  new_type public.user_type
)
RETURNS BOOLEAN AS $$
DECLARE
  current_metadata JSONB;
  updated_metadata JSONB;
BEGIN
  -- Get current metadata
  SELECT raw_app_meta_data INTO current_metadata
  FROM auth.users
  WHERE id = user_id;
  
  -- Update metadata with new user_type
  updated_metadata = jsonb_set(
    COALESCE(current_metadata, '{}'::jsonb),
    '{user_type}',
    to_jsonb(new_type::text)
  );
  
  -- Update the user's metadata
  UPDATE auth.users
  SET raw_app_meta_data = updated_metadata,
      raw_user_meta_data = jsonb_set(
        COALESCE(raw_user_meta_data, '{}'::jsonb),
        '{user_type}',
        to_jsonb(new_type::text)
      )
  WHERE id = user_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to get a user's type
CREATE OR REPLACE FUNCTION public.get_user_type(
  user_id UUID
)
RETURNS public.user_type AS $$
DECLARE
  user_type_value TEXT;
  metadata JSONB;
BEGIN
  -- Get user metadata
  SELECT raw_app_meta_data INTO metadata
  FROM auth.users
  WHERE id = user_id;
  
  -- Extract user_type from metadata
  user_type_value = metadata->>'user_type';
  
  -- Return user_type or default to 'user'
  RETURN COALESCE(user_type_value::public.user_type, 'user'::public.user_type);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger function to set default user type on new user creation
CREATE OR REPLACE FUNCTION public.set_default_user_type()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if the email is basiliskan@gmail.com and set as admin
  IF NEW.email = 'basiliskan@gmail.com' THEN
    NEW.raw_app_meta_data = jsonb_set(
      COALESCE(NEW.raw_app_meta_data, '{}'::jsonb),
      '{user_type}',
      '"admin"'
    );
    
    -- Also set the role to 'admin' for compatibility with existing code
    NEW.raw_app_meta_data = jsonb_set(
      NEW.raw_app_meta_data,
      '{role}',
      '"admin"'
    );
  ELSE
    -- Set default user type to 'user' for all other users
    NEW.raw_app_meta_data = jsonb_set(
      COALESCE(NEW.raw_app_meta_data, '{}'::jsonb),
      '{user_type}',
      '"user"'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger on auth.users
DROP TRIGGER IF EXISTS set_default_user_type_trigger ON auth.users;
CREATE TRIGGER set_default_user_type_trigger
BEFORE INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.set_default_user_type();

-- Create a table to store subscription tier user type associations
CREATE TABLE IF NOT EXISTS public.subscription_tier_user_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tier_id UUID NOT NULL REFERENCES public.subscription_tiers(id) ON DELETE CASCADE,
  user_type public.user_type NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tier_id, user_type)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_subscription_tier_user_types_tier_id ON public.subscription_tier_user_types(tier_id);
CREATE INDEX IF NOT EXISTS idx_subscription_tier_user_types_user_type ON public.subscription_tier_user_types(user_type);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_user_types_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_subscription_tier_user_types_updated_at ON public.subscription_tier_user_types;
CREATE TRIGGER update_subscription_tier_user_types_updated_at
BEFORE UPDATE ON public.subscription_tier_user_types
FOR EACH ROW
EXECUTE FUNCTION public.update_user_types_updated_at_column();

-- Create RLS policies
ALTER TABLE public.subscription_tier_user_types ENABLE ROW LEVEL SECURITY;

-- Everyone can view subscription tier user types
CREATE POLICY subscription_tier_user_types_select_policy ON public.subscription_tier_user_types
  FOR SELECT USING (true);

-- Only admins can modify subscription tier user types
CREATE POLICY subscription_tier_user_types_insert_policy ON public.subscription_tier_user_types
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid() 
      AND (
        auth.users.raw_app_meta_data->>'role' = 'admin' OR 
        auth.users.raw_app_meta_data->>'user_type' = 'admin'
      )
    )
  );

CREATE POLICY subscription_tier_user_types_update_policy ON public.subscription_tier_user_types
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid() 
      AND (
        auth.users.raw_app_meta_data->>'role' = 'admin' OR 
        auth.users.raw_app_meta_data->>'user_type' = 'admin'
      )
    )
  );

CREATE POLICY subscription_tier_user_types_delete_policy ON public.subscription_tier_user_types
  FOR DELETE USING (
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
COMMENT ON TABLE public.subscription_tier_user_types IS 'Associates subscription tiers with specific user types';
COMMENT ON FUNCTION public.set_user_type IS 'Sets the user_type in a user''s metadata';
COMMENT ON FUNCTION public.get_user_type IS 'Gets a user''s type from their metadata';
COMMENT ON FUNCTION public.set_default_user_type IS 'Sets the default user type for new users';

-- Add this migration to the migrations table
INSERT INTO public.migrations (name, applied_at)
VALUES ('024_user_types.sql', NOW())
ON CONFLICT (name) DO NOTHING;
