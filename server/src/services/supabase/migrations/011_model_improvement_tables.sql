-- Migration: 011_model_improvement_tables.sql
-- Description: Creates tables and functions for model improvement features

-- Create enum types if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'finetuning_job_status') THEN
        CREATE TYPE finetuning_job_status AS ENUM (
          'pending',
          'preparing_data',
          'training',
          'evaluating',
          'completed',
          'failed',
          'cancelled'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'error_pattern_status') THEN
        CREATE TYPE error_pattern_status AS ENUM (
          'active',
          'fixed',
          'monitoring'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'improvement_suggestion_status') THEN
        CREATE TYPE improvement_suggestion_status AS ENUM (
          'pending',
          'implemented',
          'rejected'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'impact_level') THEN
        CREATE TYPE impact_level AS ENUM (
          'high',
          'medium',
          'low'
        );
    END IF;
END
$$;

-- Create fine-tuning datasets table
CREATE TABLE IF NOT EXISTS public.finetuning_datasets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  model_id UUID NOT NULL REFERENCES public.models(id) ON DELETE CASCADE,
  sample_count INTEGER NOT NULL,
  error_categories JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create fine-tuning dataset samples table
CREATE TABLE IF NOT EXISTS public.finetuning_dataset_samples (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dataset_id UUID NOT NULL REFERENCES public.finetuning_datasets(id) ON DELETE CASCADE,
  feedback_id UUID REFERENCES public.response_feedback(id) ON DELETE SET NULL,
  query TEXT NOT NULL,
  incorrect_response TEXT NOT NULL,
  error_category error_category,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create fine-tuning jobs table
CREATE TABLE IF NOT EXISTS public.finetuning_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  model_id UUID NOT NULL REFERENCES public.models(id) ON DELETE CASCADE,
  model_name TEXT NOT NULL,
  status finetuning_job_status NOT NULL DEFAULT 'pending',
  progress INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  metrics JSONB,
  dataset_stats JSONB,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create error patterns table
CREATE TABLE IF NOT EXISTS public.error_patterns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  model_id UUID REFERENCES public.models(id) ON DELETE CASCADE,
  category error_category NOT NULL,
  description TEXT NOT NULL,
  frequency INTEGER NOT NULL,
  examples JSONB NOT NULL,
  suggested_fix TEXT,
  first_detected TIMESTAMPTZ NOT NULL,
  last_detected TIMESTAMPTZ NOT NULL,
  status error_pattern_status NOT NULL DEFAULT 'active',
  related_patterns TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create improvement suggestions table
CREATE TABLE IF NOT EXISTS public.improvement_suggestions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pattern_id UUID NOT NULL REFERENCES public.error_patterns(id) ON DELETE CASCADE,
  suggestion TEXT NOT NULL,
  rationale TEXT NOT NULL,
  impact impact_level NOT NULL,
  implementation_difficulty impact_level NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status improvement_suggestion_status NOT NULL DEFAULT 'pending',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create function to get daily error counts
CREATE OR REPLACE FUNCTION public.get_daily_error_counts(
  p_model_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS TABLE (
  day DATE,
  error_category TEXT,
  count BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE_TRUNC('day', rf.created_at)::DATE AS day,
    rf.error_category::TEXT,
    COUNT(*) AS count
  FROM
    public.response_feedback rf
  WHERE
    rf.model_id = p_model_id
    AND rf.created_at >= p_start_date
    AND rf.created_at <= p_end_date
    AND rf.error_category IS NOT NULL
  GROUP BY
    DATE_TRUNC('day', rf.created_at)::DATE,
    rf.error_category
  ORDER BY
    day, error_category;
END;
$$;

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_finetuning_datasets_model_id ON public.finetuning_datasets(model_id);
CREATE INDEX IF NOT EXISTS idx_finetuning_dataset_samples_dataset_id ON public.finetuning_dataset_samples(dataset_id);
CREATE INDEX IF NOT EXISTS idx_finetuning_dataset_samples_feedback_id ON public.finetuning_dataset_samples(feedback_id);
CREATE INDEX IF NOT EXISTS idx_finetuning_jobs_model_id ON public.finetuning_jobs(model_id);
CREATE INDEX IF NOT EXISTS idx_finetuning_jobs_status ON public.finetuning_jobs(status);
CREATE INDEX IF NOT EXISTS idx_finetuning_jobs_user_id ON public.finetuning_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_error_patterns_model_id ON public.error_patterns(model_id);
CREATE INDEX IF NOT EXISTS idx_error_patterns_category ON public.error_patterns(category);
CREATE INDEX IF NOT EXISTS idx_error_patterns_status ON public.error_patterns(status);
CREATE INDEX IF NOT EXISTS idx_improvement_suggestions_pattern_id ON public.improvement_suggestions(pattern_id);
CREATE INDEX IF NOT EXISTS idx_improvement_suggestions_status ON public.improvement_suggestions(status);

-- Create RLS policies for security
ALTER TABLE public.finetuning_datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finetuning_dataset_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finetuning_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.error_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.improvement_suggestions ENABLE ROW LEVEL SECURITY;

-- Admins can see all data
CREATE POLICY admin_select_all_finetuning_datasets ON public.finetuning_datasets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid() AND auth.users.role = 'admin'
    )
  );

CREATE POLICY admin_select_all_finetuning_dataset_samples ON public.finetuning_dataset_samples
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid() AND auth.users.role = 'admin'
    )
  );

CREATE POLICY admin_select_all_finetuning_jobs ON public.finetuning_jobs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid() AND auth.users.role = 'admin'
    )
  );

CREATE POLICY admin_select_all_error_patterns ON public.error_patterns
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid() AND auth.users.role = 'admin'
    )
  );

CREATE POLICY admin_select_all_improvement_suggestions ON public.improvement_suggestions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid() AND auth.users.role = 'admin'
    )
  );

-- Admins can insert, update, and delete data
CREATE POLICY admin_insert_finetuning_datasets ON public.finetuning_datasets
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid() AND auth.users.role = 'admin'
    )
  );

CREATE POLICY admin_update_finetuning_datasets ON public.finetuning_datasets
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid() AND auth.users.role = 'admin'
    )
  );

CREATE POLICY admin_delete_finetuning_datasets ON public.finetuning_datasets
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid() AND auth.users.role = 'admin'
    )
  );

-- Grant permissions to authenticated users
GRANT SELECT ON public.finetuning_datasets TO authenticated;
GRANT SELECT ON public.finetuning_dataset_samples TO authenticated;
GRANT SELECT ON public.finetuning_jobs TO authenticated;
GRANT SELECT ON public.error_patterns TO authenticated;
GRANT SELECT ON public.improvement_suggestions TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE public.finetuning_datasets IS 'Datasets used for fine-tuning models';
COMMENT ON TABLE public.finetuning_dataset_samples IS 'Individual samples within fine-tuning datasets';
COMMENT ON TABLE public.finetuning_jobs IS 'Jobs for fine-tuning models';
COMMENT ON TABLE public.error_patterns IS 'Identified patterns of errors in model responses';
COMMENT ON TABLE public.improvement_suggestions IS 'Suggestions for improving model performance based on error patterns';
COMMENT ON FUNCTION public.get_daily_error_counts IS 'Function to get daily counts of errors by category';

-- Add this migration to the migrations table
INSERT INTO public.migrations (name, applied_at)
VALUES ('011_model_improvement_tables.sql', NOW())
ON CONFLICT (name) DO NOTHING;
