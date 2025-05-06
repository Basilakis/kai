-- Migration: 028_prompt_ml_and_advanced_features.sql
-- Description: Adds ML models, predictions, and advanced features for prompt optimization

-- Create a table for ML models
CREATE TABLE IF NOT EXISTS public.prompt_ml_models (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  model_type TEXT NOT NULL,
  model_parameters JSONB NOT NULL,
  training_data_query TEXT,
  training_metrics JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create a table for ML model versions
CREATE TABLE IF NOT EXISTS public.prompt_ml_model_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  model_id UUID NOT NULL REFERENCES public.prompt_ml_models(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  model_data BYTEA,
  accuracy NUMERIC(5,2),
  precision NUMERIC(5,2),
  recall NUMERIC(5,2),
  f1_score NUMERIC(5,2),
  training_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(model_id, version_number)
);

-- Create a table for ML predictions
CREATE TABLE IF NOT EXISTS public.prompt_ml_predictions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prompt_id UUID NOT NULL REFERENCES public.system_prompts(id) ON DELETE CASCADE,
  model_id UUID NOT NULL REFERENCES public.prompt_ml_models(id) ON DELETE CASCADE,
  model_version_id UUID NOT NULL REFERENCES public.prompt_ml_model_versions(id) ON DELETE CASCADE,
  predicted_success_rate NUMERIC(5,2) NOT NULL,
  prediction_features JSONB NOT NULL,
  confidence NUMERIC(5,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create a table for prompt improvement suggestions
CREATE TABLE IF NOT EXISTS public.prompt_improvement_suggestions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prompt_id UUID NOT NULL REFERENCES public.system_prompts(id) ON DELETE CASCADE,
  model_id UUID NOT NULL REFERENCES public.prompt_ml_models(id) ON DELETE CASCADE,
  suggestion_type TEXT NOT NULL,
  suggestion TEXT NOT NULL,
  predicted_improvement NUMERIC(5,2),
  confidence NUMERIC(5,2),
  is_applied BOOLEAN NOT NULL DEFAULT false,
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create a table for statistical analysis results
CREATE TABLE IF NOT EXISTS public.prompt_statistical_analysis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  experiment_id UUID REFERENCES public.prompt_ab_experiments(id) ON DELETE CASCADE,
  segment_id UUID REFERENCES public.user_segments(id) ON DELETE CASCADE,
  prompt_id UUID REFERENCES public.system_prompts(id) ON DELETE CASCADE,
  analysis_type TEXT NOT NULL,
  analysis_parameters JSONB NOT NULL,
  result JSONB NOT NULL,
  p_value NUMERIC(10,8),
  confidence_interval_lower NUMERIC(5,2),
  confidence_interval_upper NUMERIC(5,2),
  is_significant BOOLEAN,
  sample_size INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create a table for automated optimization rules
CREATE TABLE IF NOT EXISTS public.prompt_optimization_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  rule_type TEXT NOT NULL,
  rule_parameters JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create a table for optimization actions
CREATE TABLE IF NOT EXISTS public.prompt_optimization_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rule_id UUID NOT NULL REFERENCES public.prompt_optimization_rules(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  prompt_id UUID REFERENCES public.system_prompts(id) ON DELETE CASCADE,
  experiment_id UUID REFERENCES public.prompt_ab_experiments(id) ON DELETE CASCADE,
  segment_id UUID REFERENCES public.user_segments(id) ON DELETE CASCADE,
  action_parameters JSONB NOT NULL,
  status TEXT NOT NULL,
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  executed_at TIMESTAMPTZ
);

-- Create a table for external system integrations
CREATE TABLE IF NOT EXISTS public.external_system_integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  system_type TEXT NOT NULL,
  connection_parameters JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create a table for data exports
CREATE TABLE IF NOT EXISTS public.prompt_data_exports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  integration_id UUID NOT NULL REFERENCES public.external_system_integrations(id) ON DELETE CASCADE,
  export_type TEXT NOT NULL,
  export_parameters JSONB NOT NULL,
  status TEXT NOT NULL,
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  executed_at TIMESTAMPTZ
);

-- Add advanced segment criteria fields to user_segments
ALTER TABLE public.user_segments
  ADD COLUMN IF NOT EXISTS behavioral_criteria JSONB,
  ADD COLUMN IF NOT EXISTS demographic_criteria JSONB,
  ADD COLUMN IF NOT EXISTS contextual_criteria JSONB,
  ADD COLUMN IF NOT EXISTS discovery_method TEXT,
  ADD COLUMN IF NOT EXISTS discovery_parameters JSONB;

-- Create RLS policies for new tables
ALTER TABLE public.prompt_ml_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_ml_model_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_ml_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_improvement_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_statistical_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_optimization_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_optimization_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_system_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_data_exports ENABLE ROW LEVEL SECURITY;

-- Only admins can manage ML models
CREATE POLICY "Admins can manage ML models" ON public.prompt_ml_models
  FOR ALL USING (
    auth.uid() IN (
      SELECT id FROM auth.users WHERE auth.email() = 'basiliskan@gmail.com'
      UNION
      SELECT user_id FROM public.user_roles WHERE role = 'admin'
    )
  );

-- Only admins can manage ML model versions
CREATE POLICY "Admins can manage ML model versions" ON public.prompt_ml_model_versions
  FOR ALL USING (
    auth.uid() IN (
      SELECT id FROM auth.users WHERE auth.email() = 'basiliskan@gmail.com'
      UNION
      SELECT user_id FROM public.user_roles WHERE role = 'admin'
    )
  );

-- Only admins can view ML predictions
CREATE POLICY "Admins can view ML predictions" ON public.prompt_ml_predictions
  FOR SELECT USING (
    auth.uid() IN (
      SELECT id FROM auth.users WHERE auth.email() = 'basiliskan@gmail.com'
      UNION
      SELECT user_id FROM public.user_roles WHERE role = 'admin'
    )
  );

-- Only admins can manage improvement suggestions
CREATE POLICY "Admins can manage improvement suggestions" ON public.prompt_improvement_suggestions
  FOR ALL USING (
    auth.uid() IN (
      SELECT id FROM auth.users WHERE auth.email() = 'basiliskan@gmail.com'
      UNION
      SELECT user_id FROM public.user_roles WHERE role = 'admin'
    )
  );

-- Only admins can view statistical analysis
CREATE POLICY "Admins can view statistical analysis" ON public.prompt_statistical_analysis
  FOR SELECT USING (
    auth.uid() IN (
      SELECT id FROM auth.users WHERE auth.email() = 'basiliskan@gmail.com'
      UNION
      SELECT user_id FROM public.user_roles WHERE role = 'admin'
    )
  );

-- Only admins can manage optimization rules
CREATE POLICY "Admins can manage optimization rules" ON public.prompt_optimization_rules
  FOR ALL USING (
    auth.uid() IN (
      SELECT id FROM auth.users WHERE auth.email() = 'basiliskan@gmail.com'
      UNION
      SELECT user_id FROM public.user_roles WHERE role = 'admin'
    )
  );

-- Only admins can view optimization actions
CREATE POLICY "Admins can view optimization actions" ON public.prompt_optimization_actions
  FOR SELECT USING (
    auth.uid() IN (
      SELECT id FROM auth.users WHERE auth.email() = 'basiliskan@gmail.com'
      UNION
      SELECT user_id FROM public.user_roles WHERE role = 'admin'
    )
  );

-- Only admins can manage external system integrations
CREATE POLICY "Admins can manage external system integrations" ON public.external_system_integrations
  FOR ALL USING (
    auth.uid() IN (
      SELECT id FROM auth.users WHERE auth.email() = 'basiliskan@gmail.com'
      UNION
      SELECT user_id FROM public.user_roles WHERE role = 'admin'
    )
  );

-- Only admins can view data exports
CREATE POLICY "Admins can view data exports" ON public.prompt_data_exports
  FOR SELECT USING (
    auth.uid() IN (
      SELECT id FROM auth.users WHERE auth.email() = 'basiliskan@gmail.com'
      UNION
      SELECT user_id FROM public.user_roles WHERE role = 'admin'
    )
  );

-- Add comments for documentation
COMMENT ON TABLE public.prompt_ml_models IS 'ML models for prompt success prediction';
COMMENT ON TABLE public.prompt_ml_model_versions IS 'Versions of ML models';
COMMENT ON TABLE public.prompt_ml_predictions IS 'Predictions made by ML models';
COMMENT ON TABLE public.prompt_improvement_suggestions IS 'Suggestions for improving prompts';
COMMENT ON TABLE public.prompt_statistical_analysis IS 'Statistical analysis results';
COMMENT ON TABLE public.prompt_optimization_rules IS 'Rules for automated prompt optimization';
COMMENT ON TABLE public.prompt_optimization_actions IS 'Actions taken by optimization rules';
COMMENT ON TABLE public.external_system_integrations IS 'Integrations with external systems';
COMMENT ON TABLE public.prompt_data_exports IS 'Data exports to external systems';

-- Add this migration to the migrations table
INSERT INTO public.migrations (name, applied_at)
VALUES ('028_prompt_ml_and_advanced_features.sql', NOW())
ON CONFLICT (name) DO NOTHING;
