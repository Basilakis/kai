-- Migration for Advanced Prompt Features
-- This migration adds tables for ML models, model versions, feature importance,
-- optimization rules, rule actions, and statistical analysis

-- ML Models Table
CREATE TABLE IF NOT EXISTS prompt_ml_models (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  model_type VARCHAR(50) NOT NULL,
  model_parameters JSONB NOT NULL DEFAULT '{}',
  training_data_query TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_trained_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ML Model Versions Table
CREATE TABLE IF NOT EXISTS prompt_ml_model_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  model_id UUID NOT NULL REFERENCES prompt_ml_models(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  model_data JSONB,
  accuracy FLOAT,
  precision FLOAT,
  recall FLOAT,
  f1_score FLOAT,
  auc FLOAT,
  confusion_matrix JSONB,
  training_history JSONB,
  training_time FLOAT,
  sample_size INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(model_id, version_number)
);

-- Feature Importance Table
CREATE TABLE IF NOT EXISTS prompt_feature_importance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  model_id UUID NOT NULL REFERENCES prompt_ml_models(id) ON DELETE CASCADE,
  model_version_id UUID REFERENCES prompt_ml_model_versions(id) ON DELETE CASCADE,
  feature VARCHAR(255) NOT NULL,
  importance FLOAT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Optimization Rules Table
CREATE TABLE IF NOT EXISTS prompt_optimization_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  rule_type VARCHAR(50) NOT NULL,
  rule_parameters JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Optimization Rule Actions Table
CREATE TABLE IF NOT EXISTS prompt_optimization_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rule_id UUID NOT NULL REFERENCES prompt_optimization_rules(id) ON DELETE CASCADE,
  action_type VARCHAR(50) NOT NULL,
  prompt_id UUID,
  experiment_id UUID,
  segment_id UUID,
  action_parameters JSONB NOT NULL DEFAULT '{}',
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  executed_at TIMESTAMPTZ,
  CONSTRAINT valid_status CHECK (status IN ('pending', 'executing', 'completed', 'failed', 'cancelled'))
);

-- Statistical Analysis Experiments Table
CREATE TABLE IF NOT EXISTS prompt_statistical_experiments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  experiment_type VARCHAR(50) NOT NULL,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  parameters JSONB NOT NULL DEFAULT '{}',
  results JSONB,
  status VARCHAR(20) NOT NULL DEFAULT 'running',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_status CHECK (status IN ('running', 'completed', 'cancelled'))
);

-- Statistical Analysis Segments Table
CREATE TABLE IF NOT EXISTS prompt_statistical_segments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  segment_criteria JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prompt Predictions Table
CREATE TABLE IF NOT EXISTS prompt_predictions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prompt_id UUID,
  prompt_content TEXT NOT NULL,
  model_id UUID REFERENCES prompt_ml_models(id) ON DELETE SET NULL,
  predicted_success_rate FLOAT NOT NULL,
  confidence_score FLOAT NOT NULL,
  feature_values JSONB NOT NULL DEFAULT '{}',
  suggestions JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- External Integrations Table
CREATE TABLE IF NOT EXISTS prompt_external_integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  integration_type VARCHAR(50) NOT NULL,
  connection_parameters JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- External Integration Exports Table
CREATE TABLE IF NOT EXISTS prompt_integration_exports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  integration_id UUID NOT NULL REFERENCES prompt_external_integrations(id) ON DELETE CASCADE,
  export_type VARCHAR(50) NOT NULL,
  export_parameters JSONB NOT NULL DEFAULT '{}',
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  executed_at TIMESTAMPTZ,
  CONSTRAINT valid_status CHECK (status IN ('pending', 'executing', 'completed', 'failed', 'cancelled'))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_prompt_ml_models_model_type ON prompt_ml_models(model_type);
CREATE INDEX IF NOT EXISTS idx_prompt_ml_models_is_active ON prompt_ml_models(is_active);
CREATE INDEX IF NOT EXISTS idx_prompt_ml_model_versions_model_id ON prompt_ml_model_versions(model_id);
CREATE INDEX IF NOT EXISTS idx_prompt_ml_model_versions_is_active ON prompt_ml_model_versions(is_active);
CREATE INDEX IF NOT EXISTS idx_prompt_feature_importance_model_id ON prompt_feature_importance(model_id);
CREATE INDEX IF NOT EXISTS idx_prompt_optimization_rules_rule_type ON prompt_optimization_rules(rule_type);
CREATE INDEX IF NOT EXISTS idx_prompt_optimization_rules_is_active ON prompt_optimization_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_prompt_optimization_actions_rule_id ON prompt_optimization_actions(rule_id);
CREATE INDEX IF NOT EXISTS idx_prompt_optimization_actions_status ON prompt_optimization_actions(status);
CREATE INDEX IF NOT EXISTS idx_prompt_statistical_experiments_experiment_type ON prompt_statistical_experiments(experiment_type);
CREATE INDEX IF NOT EXISTS idx_prompt_statistical_experiments_status ON prompt_statistical_experiments(status);
CREATE INDEX IF NOT EXISTS idx_prompt_statistical_segments_is_active ON prompt_statistical_segments(is_active);
CREATE INDEX IF NOT EXISTS idx_prompt_predictions_prompt_id ON prompt_predictions(prompt_id);
CREATE INDEX IF NOT EXISTS idx_prompt_predictions_model_id ON prompt_predictions(model_id);
CREATE INDEX IF NOT EXISTS idx_prompt_external_integrations_integration_type ON prompt_external_integrations(integration_type);
CREATE INDEX IF NOT EXISTS idx_prompt_external_integrations_is_active ON prompt_external_integrations(is_active);
CREATE INDEX IF NOT EXISTS idx_prompt_integration_exports_integration_id ON prompt_integration_exports(integration_id);
CREATE INDEX IF NOT EXISTS idx_prompt_integration_exports_status ON prompt_integration_exports(status);

-- Create functions for automatic updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic updated_at timestamps
CREATE TRIGGER update_prompt_ml_models_updated_at
BEFORE UPDATE ON prompt_ml_models
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prompt_optimization_rules_updated_at
BEFORE UPDATE ON prompt_optimization_rules
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prompt_statistical_experiments_updated_at
BEFORE UPDATE ON prompt_statistical_experiments
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prompt_statistical_segments_updated_at
BEFORE UPDATE ON prompt_statistical_segments
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prompt_external_integrations_updated_at
BEFORE UPDATE ON prompt_external_integrations
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create RLS policies
ALTER TABLE prompt_ml_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_ml_model_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_feature_importance ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_optimization_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_optimization_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_statistical_experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_statistical_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_external_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_integration_exports ENABLE ROW LEVEL SECURITY;

-- Create admin policies (only admins can access these tables)
CREATE POLICY admin_prompt_ml_models ON prompt_ml_models
  FOR ALL USING (auth.uid() IN (SELECT id FROM users WHERE role = 'admin'));

CREATE POLICY admin_prompt_ml_model_versions ON prompt_ml_model_versions
  FOR ALL USING (auth.uid() IN (SELECT id FROM users WHERE role = 'admin'));

CREATE POLICY admin_prompt_feature_importance ON prompt_feature_importance
  FOR ALL USING (auth.uid() IN (SELECT id FROM users WHERE role = 'admin'));

CREATE POLICY admin_prompt_optimization_rules ON prompt_optimization_rules
  FOR ALL USING (auth.uid() IN (SELECT id FROM users WHERE role = 'admin'));

CREATE POLICY admin_prompt_optimization_actions ON prompt_optimization_actions
  FOR ALL USING (auth.uid() IN (SELECT id FROM users WHERE role = 'admin'));

CREATE POLICY admin_prompt_statistical_experiments ON prompt_statistical_experiments
  FOR ALL USING (auth.uid() IN (SELECT id FROM users WHERE role = 'admin'));

CREATE POLICY admin_prompt_statistical_segments ON prompt_statistical_segments
  FOR ALL USING (auth.uid() IN (SELECT id FROM users WHERE role = 'admin'));

CREATE POLICY admin_prompt_predictions ON prompt_predictions
  FOR ALL USING (auth.uid() IN (SELECT id FROM users WHERE role = 'admin'));

CREATE POLICY admin_prompt_external_integrations ON prompt_external_integrations
  FOR ALL USING (auth.uid() IN (SELECT id FROM users WHERE role = 'admin'));

CREATE POLICY admin_prompt_integration_exports ON prompt_integration_exports
  FOR ALL USING (auth.uid() IN (SELECT id FROM users WHERE role = 'admin'));
