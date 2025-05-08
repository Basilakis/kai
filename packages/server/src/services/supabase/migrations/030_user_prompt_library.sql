-- Migration: 030_user_prompt_library.sql
-- Description: Creates tables and policies for the User Prompt Library feature

-- Create Prompt Categories table
CREATE TABLE IF NOT EXISTS public.prompt_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create User Prompts table
CREATE TABLE IF NOT EXISTS public.user_prompts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES public.prompt_categories(id) ON DELETE SET NULL,
  usage TEXT NOT NULL, -- 'analytics_agent', '3d_design_agent', 'search_agent', etc.
  is_public BOOLEAN NOT NULL DEFAULT false,
  views_count INTEGER NOT NULL DEFAULT 0,
  imports_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_user_prompts_user_id ON public.user_prompts(user_id);

-- Create index on is_public for faster queries of public prompts
CREATE INDEX IF NOT EXISTS idx_user_prompts_is_public ON public.user_prompts(is_public);

-- Create index on category_id for faster category filtering
CREATE INDEX IF NOT EXISTS idx_user_prompts_category_id ON public.user_prompts(category_id);

-- Create index on usage for faster filtering by agent type
CREATE INDEX IF NOT EXISTS idx_user_prompts_usage ON public.user_prompts(usage);

-- Insert default categories
INSERT INTO public.prompt_categories (name, description, is_system)
VALUES 
  ('General', 'General purpose prompts', true),
  ('Analytics', 'Prompts for data analysis and insights', true),
  ('3D Design', 'Prompts for 3D modeling and design', true),
  ('Search', 'Prompts for effective searching', true),
  ('Material Recognition', 'Prompts for identifying materials', true)
ON CONFLICT DO NOTHING;

-- RLS Policies

-- Enable RLS on tables
ALTER TABLE public.user_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_categories ENABLE ROW LEVEL SECURITY;

-- Categories policies
-- Anyone can read categories
CREATE POLICY "Anyone can read categories" 
  ON public.prompt_categories
  FOR SELECT USING (true);

-- Only admins can modify categories
CREATE POLICY "Only admins can insert categories" 
  ON public.prompt_categories
  FOR INSERT TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Only admins can update categories" 
  ON public.prompt_categories
  FOR UPDATE TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Only admins can delete categories" 
  ON public.prompt_categories
  FOR DELETE TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin');

-- User prompts policies
-- Users can read their own prompts
CREATE POLICY "Users can read their own prompts" 
  ON public.user_prompts
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Anyone can read public prompts
CREATE POLICY "Anyone can read public prompts" 
  ON public.user_prompts
  FOR SELECT
  USING (is_public = true);

-- Users can insert their own prompts
CREATE POLICY "Users can insert their own prompts" 
  ON public.user_prompts
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own prompts
CREATE POLICY "Users can update their own prompts" 
  ON public.user_prompts
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Users can delete their own prompts
CREATE POLICY "Users can delete their own prompts" 
  ON public.user_prompts
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Add comments for documentation
COMMENT ON TABLE public.prompt_categories IS 'Categories for organizing user prompts';
COMMENT ON TABLE public.user_prompts IS 'User-created and saved prompts';
