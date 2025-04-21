-- Model Improvement Tables Migration
-- This script creates the necessary tables for model improvement features:
-- 1. Fine-tuning jobs and datasets
-- 2. Error patterns and improvement suggestions

-- Create enum types
CREATE TYPE finetuning_job_status AS ENUM (
  'pending',
  'preparing_data',
  'training',
  'evaluating',
  'completed',
  'failed',
  'cancelled'
);

CREATE TYPE error_pattern_status AS ENUM (
  'active',
  'fixed',
  'monitoring'
);

CREATE TYPE improvement_suggestion_status AS ENUM (
  'pending',
  'implemented',
  'rejected'
);

CREATE TYPE impact_level AS ENUM (
  'high',
  'medium',
  'low'
);

-- Create fine-tuning datasets table
CREATE TABLE IF NOT EXISTS finetuning_datasets (
  id UUID PRIMARY KEY,
  model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  sample_count INTEGER NOT NULL,
  error_categories JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create fine-tuning dataset samples table
CREATE TABLE IF NOT EXISTS finetuning_dataset_samples (
  id UUID PRIMARY KEY,
  dataset_id UUID NOT NULL REFERENCES finetuning_datasets(id) ON DELETE CASCADE,
  feedback_id UUID REFERENCES response_feedback(id) ON DELETE SET NULL,
  query TEXT NOT NULL,
  incorrect_response TEXT NOT NULL,
  error_category error_category,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create fine-tuning jobs table
CREATE TABLE IF NOT EXISTS finetuning_jobs (
  id UUID PRIMARY KEY,
  model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  model_name TEXT NOT NULL,
  status finetuning_job_status NOT NULL DEFAULT 'pending',
  progress INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  metrics JSONB,
  dataset_stats JSONB,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create error patterns table
CREATE TABLE IF NOT EXISTS error_patterns (
  id TEXT PRIMARY KEY,
  model_id UUID REFERENCES models(id) ON DELETE CASCADE,
  category error_category NOT NULL,
  description TEXT NOT NULL,
  frequency INTEGER NOT NULL,
  examples JSONB NOT NULL,
  suggested_fix TEXT,
  first_detected TIMESTAMP WITH TIME ZONE NOT NULL,
  last_detected TIMESTAMP WITH TIME ZONE NOT NULL,
  status error_pattern_status NOT NULL DEFAULT 'active',
  related_patterns TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create improvement suggestions table
CREATE TABLE IF NOT EXISTS improvement_suggestions (
  id TEXT PRIMARY KEY,
  pattern_id TEXT NOT NULL REFERENCES error_patterns(id) ON DELETE CASCADE,
  suggestion TEXT NOT NULL,
  rationale TEXT NOT NULL,
  impact impact_level NOT NULL,
  implementation_difficulty impact_level NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status improvement_suggestion_status NOT NULL DEFAULT 'pending',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create function to get daily error counts
CREATE OR REPLACE FUNCTION get_daily_error_counts(
  p_model_id UUID,
  p_start_date TIMESTAMP WITH TIME ZONE,
  p_end_date TIMESTAMP WITH TIME ZONE
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
    response_feedback rf
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
CREATE INDEX idx_finetuning_datasets_model_id ON finetuning_datasets(model_id);
CREATE INDEX idx_finetuning_dataset_samples_dataset_id ON finetuning_dataset_samples(dataset_id);
CREATE INDEX idx_finetuning_dataset_samples_feedback_id ON finetuning_dataset_samples(feedback_id);
CREATE INDEX idx_finetuning_jobs_model_id ON finetuning_jobs(model_id);
CREATE INDEX idx_finetuning_jobs_status ON finetuning_jobs(status);
CREATE INDEX idx_finetuning_jobs_user_id ON finetuning_jobs(user_id);
CREATE INDEX idx_error_patterns_model_id ON error_patterns(model_id);
CREATE INDEX idx_error_patterns_category ON error_patterns(category);
CREATE INDEX idx_error_patterns_status ON error_patterns(status);
CREATE INDEX idx_improvement_suggestions_pattern_id ON improvement_suggestions(pattern_id);
CREATE INDEX idx_improvement_suggestions_status ON improvement_suggestions(status);

-- Create RLS policies for security
ALTER TABLE finetuning_datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE finetuning_dataset_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE finetuning_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE improvement_suggestions ENABLE ROW LEVEL SECURITY;

-- Admins can see all data
CREATE POLICY admin_select_all_finetuning_datasets ON finetuning_datasets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid() AND auth.users.role = 'admin'
    )
  );

CREATE POLICY admin_select_all_finetuning_dataset_samples ON finetuning_dataset_samples
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid() AND auth.users.role = 'admin'
    )
  );

CREATE POLICY admin_select_all_finetuning_jobs ON finetuning_jobs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid() AND auth.users.role = 'admin'
    )
  );

CREATE POLICY admin_select_all_error_patterns ON error_patterns
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid() AND auth.users.role = 'admin'
    )
  );

CREATE POLICY admin_select_all_improvement_suggestions ON improvement_suggestions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid() AND auth.users.role = 'admin'
    )
  );

-- Admins can insert, update, and delete data
CREATE POLICY admin_insert_finetuning_datasets ON finetuning_datasets
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid() AND auth.users.role = 'admin'
    )
  );

CREATE POLICY admin_update_finetuning_datasets ON finetuning_datasets
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid() AND auth.users.role = 'admin'
    )
  );

CREATE POLICY admin_delete_finetuning_datasets ON finetuning_datasets
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid() AND auth.users.role = 'admin'
    )
  );

-- Grant permissions to authenticated users
GRANT SELECT ON finetuning_datasets TO authenticated;
GRANT SELECT ON finetuning_dataset_samples TO authenticated;
GRANT SELECT ON finetuning_jobs TO authenticated;
GRANT SELECT ON error_patterns TO authenticated;
GRANT SELECT ON improvement_suggestions TO authenticated;

-- Grant permissions to admin role
GRANT ALL ON finetuning_datasets TO admin;
GRANT ALL ON finetuning_dataset_samples TO admin;
GRANT ALL ON finetuning_jobs TO admin;
GRANT ALL ON error_patterns TO admin;
GRANT ALL ON improvement_suggestions TO admin;
GRANT EXECUTE ON FUNCTION get_daily_error_counts TO admin;
