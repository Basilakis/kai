-- Migration for Model Registry Persistence

-- Table to store performance metrics for each model invocation
CREATE TABLE IF NOT EXISTS model_performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_provider TEXT NOT NULL,
  model_id TEXT NOT NULL,
  task_type TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  input_hash TEXT, -- Optional hash of the input to identify similar tasks
  context_size INTEGER, -- Optional, e.g., token count for LLMs
  accuracy FLOAT, -- Task-specific accuracy metric
  latency_ms INTEGER, -- Execution time in milliseconds
  cost_per_token FLOAT, -- Estimated cost per token/unit
  token_count INTEGER, -- Number of tokens/units processed
  user_rating FLOAT, -- Optional user feedback (e.g., 1-5 stars)
  custom_metrics JSONB, -- For any other task-specific metrics
  comparison_report_id UUID REFERENCES model_comparison_reports(id) ON DELETE SET NULL, -- Link to a comparison report if part of an evaluation
  created_at TIMESTAMPTZ NOT NULL DEFAULT now() -- For the record itself
);

CREATE INDEX IF NOT EXISTS idx_model_performance_model_task ON model_performance_metrics (model_provider, model_id, task_type);
CREATE INDEX IF NOT EXISTS idx_model_performance_timestamp ON model_performance_metrics (timestamp);
CREATE INDEX IF NOT EXISTS idx_model_performance_input_hash ON model_performance_metrics (input_hash);
CREATE INDEX IF NOT EXISTS idx_model_performance_report_id ON model_performance_metrics (comparison_report_id);

COMMENT ON TABLE model_performance_metrics IS 'Stores detailed performance metrics for AI model invocations.';
COMMENT ON COLUMN model_performance_metrics.input_hash IS 'Optional hash of the input to identify similar tasks for performance tracking.';
COMMENT ON COLUMN model_performance_metrics.comparison_report_id IS 'Links to a model_comparison_reports if this metric was recorded during a formal evaluation.';

-- Table to track task counts and evaluation cycles
CREATE TABLE IF NOT EXISTS task_evaluation_status (
  task_type TEXT PRIMARY KEY,
  current_count INTEGER NOT NULL DEFAULT 0,
  last_evaluation_at TIMESTAMPTZ NOT NULL DEFAULT '1970-01-01T00:00:00Z',
  in_evaluation_mode BOOLEAN NOT NULL DEFAULT false,
  evaluation_tasks_remaining INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE task_evaluation_status IS 'Tracks invocation counts and evaluation cycle status for each task type.';

-- Table to store model comparison reports generated during evaluation cycles
CREATE TABLE IF NOT EXISTS model_comparison_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- rankings JSONB, -- Optional: Store derived rankings directly if needed
  -- best_model_provider TEXT, -- Optional: Store derived best model provider
  -- best_model_id TEXT, -- Optional: Store derived best model ID
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_model_comparison_reports_task_type ON model_comparison_reports (task_type);
CREATE INDEX IF NOT EXISTS idx_model_comparison_reports_timestamp ON model_comparison_reports (timestamp);

COMMENT ON TABLE model_comparison_reports IS 'Stores reports from model evaluation cycles, linking to individual performance metrics.';

-- Table to store ModelRegistry configuration (e.g., metric weights, cycle lengths)
-- This allows dynamic configuration without code changes.
CREATE TABLE IF NOT EXISTS model_registry_config (
  config_key TEXT PRIMARY KEY DEFAULT 'default', -- Using a fixed key for a single global config row
  config_data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE model_registry_config IS 'Stores the operational configuration for the ModelRegistry service.';
COMMENT ON COLUMN model_registry_config.config_key IS 'Primary key, typically "default" for the single active configuration.';

-- Function to update the 'updated_at' timestamp automatically
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply the trigger to relevant tables
CREATE TRIGGER update_task_evaluation_status_timestamp
BEFORE UPDATE ON task_evaluation_status
FOR EACH ROW EXECUTE PROCEDURE update_timestamp();

CREATE TRIGGER update_model_registry_config_timestamp
BEFORE UPDATE ON model_registry_config
FOR EACH ROW EXECUTE PROCEDURE update_timestamp();

-- Note: RLS policies for these tables should be defined.
-- Typically, only backend service roles should have write access.
-- Read access might be granted to admin/monitoring roles.

-- Example RLS (restrictive, adjust as needed):
-- ALTER TABLE model_performance_metrics ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow service role full access on model_performance_metrics"
--   ON model_performance_metrics FOR ALL
--   USING (auth.role() = 'service_role')
--   WITH CHECK (auth.role() = 'service_role');

-- ALTER TABLE task_evaluation_status ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow service role full access on task_evaluation_status"
--   ON task_evaluation_status FOR ALL
--   USING (auth.role() = 'service_role')
--   WITH CHECK (auth.role() = 'service_role');

-- ALTER TABLE model_comparison_reports ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow service role full access on model_comparison_reports"
--   ON model_comparison_reports FOR ALL
--   USING (auth.role() = 'service_role')
--   WITH CHECK (auth.role() = 'service_role');

-- ALTER TABLE model_registry_config ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow service role full access on model_registry_config"
--   ON model_registry_config FOR ALL
--   USING (auth.role() = 'service_role')
--   WITH CHECK (auth.role() = 'service_role');
-- CREATE POLICY "Allow authenticated read access on model_registry_config"
--   ON model_registry_config FOR SELECT
--   USING (auth.role() = 'authenticated');