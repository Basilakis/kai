-- Migration: 014_response_quality_tables.sql
-- Description: Creates tables and functions for tracking response quality metrics

-- Create enum types for feedback and error categories if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'feedback_type') THEN
        CREATE TYPE feedback_type AS ENUM ('thumbs_up', 'thumbs_down', 'star_rating', 'detailed');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'error_category') THEN
        CREATE TYPE error_category AS ENUM ('factual_error', 'hallucination', 'incomplete_answer', 'misunderstood_query', 'irrelevant', 'other');
    END IF;
END
$$;

-- Create model_responses table to store all model responses
CREATE TABLE IF NOT EXISTS public.model_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  model_id UUID NOT NULL REFERENCES public.models(id) ON DELETE CASCADE,
  query_text TEXT NOT NULL,
  response_text TEXT NOT NULL,
  tokens_used INTEGER,
  response_time_ms INTEGER,
  context_used TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB
);

-- Create response_feedback table to store user feedback on responses
CREATE TABLE IF NOT EXISTS public.response_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  response_id UUID NOT NULL REFERENCES public.model_responses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  model_id UUID NOT NULL REFERENCES public.models(id) ON DELETE CASCADE,
  feedback_type feedback_type NOT NULL,
  rating SMALLINT CHECK (rating >= 1 AND rating <= 5),
  is_positive BOOLEAN,
  error_category error_category,
  feedback_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_model_responses_user_id ON public.model_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_model_responses_model_id ON public.model_responses(model_id);
CREATE INDEX IF NOT EXISTS idx_model_responses_created_at ON public.model_responses(created_at);

CREATE INDEX IF NOT EXISTS idx_response_feedback_response_id ON public.response_feedback(response_id);
CREATE INDEX IF NOT EXISTS idx_response_feedback_user_id ON public.response_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_response_feedback_model_id ON public.response_feedback(model_id);
CREATE INDEX IF NOT EXISTS idx_response_feedback_feedback_type ON public.response_feedback(feedback_type);
CREATE INDEX IF NOT EXISTS idx_response_feedback_error_category ON public.response_feedback(error_category);
CREATE INDEX IF NOT EXISTS idx_response_feedback_created_at ON public.response_feedback(created_at);

-- Create view for response quality metrics
CREATE OR REPLACE VIEW public.response_quality_metrics AS
SELECT
  m.id AS model_id,
  m.name AS model_name,
  COUNT(DISTINCT mr.id) AS total_responses,
  COUNT(DISTINCT rf.id) AS rated_responses,
  ROUND(COUNT(DISTINCT rf.id)::NUMERIC / NULLIF(COUNT(DISTINCT mr.id), 0) * 100, 2) AS feedback_rate,
  ROUND(AVG(CASE WHEN rf.rating IS NOT NULL THEN rf.rating ELSE NULL END), 2) AS avg_rating,
  ROUND(SUM(CASE WHEN rf.is_positive = true OR rf.rating >= 4 THEN 1 ELSE 0 END)::NUMERIC / NULLIF(COUNT(DISTINCT rf.id), 0) * 100, 2) AS satisfaction_rate,
  ROUND(SUM(CASE WHEN rf.error_category IS NULL THEN 1 ELSE 0 END)::NUMERIC / NULLIF(COUNT(DISTINCT rf.id), 0) * 100, 2) AS accuracy_rate,
  ROUND(AVG(mr.response_time_ms), 2) AS avg_response_time_ms,
  ROUND(AVG(mr.tokens_used), 2) AS avg_tokens_used,
  DATE_TRUNC('day', NOW()) AS calculated_at
FROM
  public.models m
LEFT JOIN
  public.model_responses mr ON m.id = mr.model_id
LEFT JOIN
  public.response_feedback rf ON mr.id = rf.response_id
GROUP BY
  m.id, m.name;

-- Create function to record response with feedback in one transaction
CREATE OR REPLACE FUNCTION public.record_response_with_feedback(
  p_user_id UUID,
  p_model_id UUID,
  p_query_text TEXT,
  p_response_text TEXT,
  p_tokens_used INTEGER,
  p_response_time_ms INTEGER,
  p_context_used TEXT[],
  p_feedback_type feedback_type,
  p_rating SMALLINT DEFAULT NULL,
  p_is_positive BOOLEAN DEFAULT NULL,
  p_error_category error_category DEFAULT NULL,
  p_feedback_text TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_response_id UUID;
BEGIN
  -- Insert the response
  INSERT INTO public.model_responses (
    user_id, model_id, query_text, response_text, tokens_used, 
    response_time_ms, context_used, metadata
  ) VALUES (
    p_user_id, p_model_id, p_query_text, p_response_text, p_tokens_used, 
    p_response_time_ms, p_context_used, p_metadata
  ) RETURNING id INTO v_response_id;
  
  -- Insert the feedback if provided
  IF p_feedback_type IS NOT NULL THEN
    INSERT INTO public.response_feedback (
      response_id, user_id, model_id, feedback_type, 
      rating, is_positive, error_category, feedback_text
    ) VALUES (
      v_response_id, p_user_id, p_model_id, p_feedback_type, 
      p_rating, p_is_positive, p_error_category, p_feedback_text
    );
  END IF;
  
  RETURN v_response_id;
END;
$$ LANGUAGE plpgsql;

-- Create RLS policies for security
ALTER TABLE public.model_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.response_feedback ENABLE ROW LEVEL SECURITY;

-- Users can see their own responses
CREATE POLICY user_select_own_responses ON public.model_responses
  FOR SELECT USING (user_id = auth.uid());

-- Users can see their own feedback
CREATE POLICY user_select_own_feedback ON public.response_feedback
  FOR SELECT USING (user_id = auth.uid());

-- Users can insert their own feedback
CREATE POLICY user_insert_own_feedback ON public.response_feedback
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Admins can see all responses and feedback
CREATE POLICY admin_select_all_responses ON public.model_responses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid() AND auth.users.role = 'admin'
    )
  );

CREATE POLICY admin_select_all_feedback ON public.response_feedback
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid() AND auth.users.role = 'admin'
    )
  );

-- Grant permissions to authenticated users
GRANT SELECT, INSERT ON public.model_responses TO authenticated;
GRANT SELECT, INSERT ON public.response_feedback TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_response_with_feedback TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE public.model_responses IS 'Stores all model responses for quality tracking';
COMMENT ON TABLE public.response_feedback IS 'User feedback on model responses';
COMMENT ON VIEW public.response_quality_metrics IS 'Aggregated metrics on response quality by model';
COMMENT ON FUNCTION public.record_response_with_feedback IS 'Function to record a model response with optional feedback in one transaction';

-- Add this migration to the migrations table
INSERT INTO public.migrations (name, applied_at)
VALUES ('014_response_quality_tables.sql', NOW())
ON CONFLICT (name) DO NOTHING;
