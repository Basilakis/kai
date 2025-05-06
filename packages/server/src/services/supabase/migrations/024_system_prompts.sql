-- Migration: 024_system_prompts.sql
-- Description: Creates tables and policies for the System Prompts feature

-- Create System Prompts table
CREATE TABLE IF NOT EXISTS public.system_prompts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  prompt_type TEXT NOT NULL,
  content TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT true,
  location TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(name, prompt_type)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS system_prompts_prompt_type_idx ON public.system_prompts (prompt_type);
CREATE INDEX IF NOT EXISTS system_prompts_is_active_idx ON public.system_prompts (is_active);

-- Create RLS policies for system_prompts
ALTER TABLE public.system_prompts ENABLE ROW LEVEL SECURITY;

-- Only admins can view system prompts
CREATE POLICY "Admins can view system prompts" ON public.system_prompts
  FOR SELECT USING (
    auth.uid() IN (
      SELECT id FROM auth.users WHERE auth.email() = 'basiliskan@gmail.com'
      UNION
      SELECT user_id FROM public.user_roles WHERE role = 'admin'
    )
  );

-- Only admins can insert system prompts
CREATE POLICY "Admins can insert system prompts" ON public.system_prompts
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT id FROM auth.users WHERE auth.email() = 'basiliskan@gmail.com'
      UNION
      SELECT user_id FROM public.user_roles WHERE role = 'admin'
    )
  );

-- Only admins can update system prompts
CREATE POLICY "Admins can update system prompts" ON public.system_prompts
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT id FROM auth.users WHERE auth.email() = 'basiliskan@gmail.com'
      UNION
      SELECT user_id FROM public.user_roles WHERE role = 'admin'
    )
  );

-- Only admins can delete system prompts
CREATE POLICY "Admins can delete system prompts" ON public.system_prompts
  FOR DELETE USING (
    auth.uid() IN (
      SELECT id FROM auth.users WHERE auth.email() = 'basiliskan@gmail.com'
      UNION
      SELECT user_id FROM public.user_roles WHERE role = 'admin'
    )
  );

-- Add comments for documentation
COMMENT ON TABLE public.system_prompts IS 'System prompts used by AI models and agents';
COMMENT ON COLUMN public.system_prompts.prompt_type IS 'Type of prompt (material_specific, agent, rag, etc.)';
COMMENT ON COLUMN public.system_prompts.content IS 'The actual prompt content';
COMMENT ON COLUMN public.system_prompts.variables IS 'Variables that can be used in the prompt';
COMMENT ON COLUMN public.system_prompts.location IS 'File location where the prompt is used';

-- Add this migration to the migrations table
INSERT INTO public.migrations (name, applied_at)
VALUES ('024_system_prompts.sql', NOW())
ON CONFLICT (name) DO NOTHING;
