-- Migration: 025_prompt_versioning_and_tracking.sql
-- Description: Adds versioning and success rate tracking for system prompts

-- Create System Prompt Versions table
CREATE TABLE IF NOT EXISTS public.system_prompt_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prompt_id UUID NOT NULL REFERENCES public.system_prompts(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  content TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(prompt_id, version_number)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS system_prompt_versions_prompt_id_idx ON public.system_prompt_versions (prompt_id);
CREATE INDEX IF NOT EXISTS system_prompt_versions_is_active_idx ON public.system_prompt_versions (is_active);

-- Create RLS policies for system_prompt_versions
ALTER TABLE public.system_prompt_versions ENABLE ROW LEVEL SECURITY;

-- Only admins can view system prompt versions
CREATE POLICY "Admins can view system prompt versions" ON public.system_prompt_versions
  FOR SELECT USING (
    auth.uid() IN (
      SELECT id FROM auth.users WHERE auth.email() = 'basiliskan@gmail.com'
      UNION
      SELECT user_id FROM public.user_roles WHERE role = 'admin'
    )
  );

-- Only admins can insert system prompt versions
CREATE POLICY "Admins can insert system prompt versions" ON public.system_prompt_versions
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT id FROM auth.users WHERE auth.email() = 'basiliskan@gmail.com'
      UNION
      SELECT user_id FROM public.user_roles WHERE role = 'admin'
    )
  );

-- Only admins can update system prompt versions
CREATE POLICY "Admins can update system prompt versions" ON public.system_prompt_versions
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT id FROM auth.users WHERE auth.email() = 'basiliskan@gmail.com'
      UNION
      SELECT user_id FROM public.user_roles WHERE role = 'admin'
    )
  );

-- Only admins can delete system prompt versions
CREATE POLICY "Admins can delete system prompt versions" ON public.system_prompt_versions
  FOR DELETE USING (
    auth.uid() IN (
      SELECT id FROM auth.users WHERE auth.email() = 'basiliskan@gmail.com'
      UNION
      SELECT user_id FROM public.user_roles WHERE role = 'admin'
    )
  );

-- Create System Prompt Success Tracking table
CREATE TABLE IF NOT EXISTS public.system_prompt_success_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prompt_id UUID NOT NULL REFERENCES public.system_prompts(id) ON DELETE CASCADE,
  prompt_version_id UUID REFERENCES public.system_prompt_versions(id) ON DELETE SET NULL,
  is_successful BOOLEAN NOT NULL,
  feedback TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  context JSONB DEFAULT '{}'
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS system_prompt_success_tracking_prompt_id_idx ON public.system_prompt_success_tracking (prompt_id);
CREATE INDEX IF NOT EXISTS system_prompt_success_tracking_prompt_version_id_idx ON public.system_prompt_success_tracking (prompt_version_id);
CREATE INDEX IF NOT EXISTS system_prompt_success_tracking_is_successful_idx ON public.system_prompt_success_tracking (is_successful);

-- Create RLS policies for system_prompt_success_tracking
ALTER TABLE public.system_prompt_success_tracking ENABLE ROW LEVEL SECURITY;

-- Only admins can view system prompt success tracking
CREATE POLICY "Admins can view system prompt success tracking" ON public.system_prompt_success_tracking
  FOR SELECT USING (
    auth.uid() IN (
      SELECT id FROM auth.users WHERE auth.email() = 'basiliskan@gmail.com'
      UNION
      SELECT user_id FROM public.user_roles WHERE role = 'admin'
    )
  );

-- Only admins can insert system prompt success tracking
CREATE POLICY "Admins can insert system prompt success tracking" ON public.system_prompt_success_tracking
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT id FROM auth.users WHERE auth.email() = 'basiliskan@gmail.com'
      UNION
      SELECT user_id FROM public.user_roles WHERE role = 'admin'
    )
  );

-- Only admins can update system prompt success tracking
CREATE POLICY "Admins can update system prompt success tracking" ON public.system_prompt_success_tracking
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT id FROM auth.users WHERE auth.email() = 'basiliskan@gmail.com'
      UNION
      SELECT user_id FROM public.user_roles WHERE role = 'admin'
    )
  );

-- Only admins can delete system prompt success tracking
CREATE POLICY "Admins can delete system prompt success tracking" ON public.system_prompt_success_tracking
  FOR DELETE USING (
    auth.uid() IN (
      SELECT id FROM auth.users WHERE auth.email() = 'basiliskan@gmail.com'
      UNION
      SELECT user_id FROM public.user_roles WHERE role = 'admin'
    )
  );

-- Add comments for documentation
COMMENT ON TABLE public.system_prompt_versions IS 'Versions of system prompts';
COMMENT ON COLUMN public.system_prompt_versions.prompt_id IS 'Reference to the parent prompt';
COMMENT ON COLUMN public.system_prompt_versions.version_number IS 'Sequential version number';
COMMENT ON COLUMN public.system_prompt_versions.content IS 'The prompt content for this version';
COMMENT ON COLUMN public.system_prompt_versions.is_active IS 'Whether this version is currently active';

COMMENT ON TABLE public.system_prompt_success_tracking IS 'Tracking success rates for system prompts';
COMMENT ON COLUMN public.system_prompt_success_tracking.prompt_id IS 'Reference to the prompt';
COMMENT ON COLUMN public.system_prompt_success_tracking.prompt_version_id IS 'Reference to the specific version of the prompt';
COMMENT ON COLUMN public.system_prompt_success_tracking.is_successful IS 'Whether the prompt was successful';
COMMENT ON COLUMN public.system_prompt_success_tracking.feedback IS 'Optional feedback about the prompt';
COMMENT ON COLUMN public.system_prompt_success_tracking.context IS 'Context data for the prompt usage';

-- Add this migration to the migrations table
INSERT INTO public.migrations (name, applied_at)
VALUES ('025_prompt_versioning_and_tracking.sql', NOW())
ON CONFLICT (name) DO NOTHING;
