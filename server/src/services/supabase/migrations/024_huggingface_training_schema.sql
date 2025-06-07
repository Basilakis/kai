-- Migration: 024_huggingface_training_schema.sql
-- Description: Creates tables for Hugging Face dataset integration and model training.

-- Create enum type for Hugging Face training job status
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hf_training_job_status') THEN
        CREATE TYPE public.hf_training_job_status AS ENUM (
          'pending',
          'preprocessing',
          'downloading_dataset',
          'downloading_model',
          'training',
          'evaluating',
          'saving_model',
          'completed',
          'failed',
          'cancelled'
        );
    END IF;
END
$$;

-- Table to store information about Hugging Face datasets
CREATE TABLE IF NOT EXISTS public.hf_datasets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dataset_identifier TEXT NOT NULL UNIQUE COMMENT 'Hugging Face dataset identifier (e.g., stabilityai/stable-diffusion-xl-base-1.0)',
  name TEXT NOT NULL COMMENT 'User-friendly name for the dataset',
  description TEXT COMMENT 'Optional description for the dataset',
  source_url TEXT COMMENT 'URL to the Hugging Face dataset page',
  local_path TEXT COMMENT 'Local path where the dataset is stored/cached, if applicable',
  metadata JSONB COMMENT 'Additional metadata from Hugging Face or user-defined',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL COMMENT 'User who registered this dataset'
);

COMMENT ON TABLE public.hf_datasets IS 'Stores information about Hugging Face datasets used for training.';
COMMENT ON COLUMN public.hf_datasets.dataset_identifier IS 'Hugging Face dataset identifier (e.g., stabilityai/stable-diffusion-xl-base-1.0)';
COMMENT ON COLUMN public.hf_datasets.name IS 'User-friendly name for the dataset';

-- Table to store information about models that can be trained using Hugging Face datasets
CREATE TABLE IF NOT EXISTS public.hf_trainable_models (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE COMMENT 'User-friendly name for the trainable model (e.g., Custom Stable Diffusion XL for Art)',
  base_model_identifier TEXT NOT NULL COMMENT 'Hugging Face model identifier for the base model (e.g., stabilityai/stable-diffusion-xl-base-1.0)',
  description TEXT COMMENT 'AI-generated or user-provided description of the model, its function, and use cases',
  model_type TEXT NOT NULL COMMENT 'Type of model, e.g., image_generation, text_generation, text-to-image',
  version TEXT DEFAULT '1.0.0' COMMENT 'Version of this trainable model configuration',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL COMMENT 'User who configured this trainable model'
);

COMMENT ON TABLE public.hf_trainable_models IS 'Represents models that can be fine-tuned using Hugging Face datasets and pipelines.';
COMMENT ON COLUMN public.hf_trainable_models.name IS 'User-friendly name for the trainable model (e.g., Custom Stable Diffusion XL for Art)';
COMMENT ON COLUMN public.hf_trainable_models.base_model_identifier IS 'Hugging Face model identifier for the base model (e.g., stabilityai/stable-diffusion-xl-base-1.0)';
COMMENT ON COLUMN public.hf_trainable_models.description IS 'AI-generated or user-provided description of the model, its function, and use cases';

-- Table to manage Hugging Face training jobs
CREATE TABLE IF NOT EXISTS public.hf_training_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trainable_model_id UUID NOT NULL REFERENCES public.hf_trainable_models(id) ON DELETE CASCADE,
  hf_dataset_id UUID NOT NULL REFERENCES public.hf_datasets(id) ON DELETE CASCADE,
  job_name TEXT COMMENT 'Optional user-friendly name for the training job',
  status public.hf_training_job_status NOT NULL DEFAULT 'pending',
  training_parameters JSONB COMMENT 'Configuration for the training run (e.g., epochs, learning_rate, batch_size, custom scripts)',
  output_safetensor_path TEXT COMMENT 'Path to the trained model artifacts (e.g., safetensors file)',
  output_metadata JSONB COMMENT 'Metadata about the trained model, like checkpoints, adapter info',
  metrics JSONB COMMENT 'Performance metrics from the training (e.g., loss, accuracy, evaluation scores)',
  logs_path TEXT COMMENT 'Path or reference to training logs',
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT
);

COMMENT ON TABLE public.hf_training_jobs IS 'Manages training jobs for Hugging Face models and datasets.';
COMMENT ON COLUMN public.hf_training_jobs.output_safetensor_path IS 'Path to the trained model artifacts (e.g., safetensors file)';

-- Indexes for foreign keys and frequently queried columns
CREATE INDEX IF NOT EXISTS idx_hf_datasets_user_id ON public.hf_datasets(user_id);
CREATE INDEX IF NOT EXISTS idx_hf_trainable_models_user_id ON public.hf_trainable_models(user_id);
CREATE INDEX IF NOT EXISTS idx_hf_trainable_models_base_model_identifier ON public.hf_trainable_models(base_model_identifier);
CREATE INDEX IF NOT EXISTS idx_hf_training_jobs_trainable_model_id ON public.hf_training_jobs(trainable_model_id);
CREATE INDEX IF NOT EXISTS idx_hf_training_jobs_hf_dataset_id ON public.hf_training_jobs(hf_dataset_id);
CREATE INDEX IF NOT EXISTS idx_hf_training_jobs_user_id ON public.hf_training_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_hf_training_jobs_status ON public.hf_training_jobs(status);

-- RLS Policies
-- Enable RLS for the new tables
ALTER TABLE public.hf_datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hf_trainable_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hf_training_jobs ENABLE ROW LEVEL SECURITY;

-- Policies for hf_datasets
CREATE POLICY "Allow admin full access on hf_datasets"
  ON public.hf_datasets FOR ALL
  USING (auth.role() = 'service_role' OR (SELECT is_admin FROM public.get_user_roles() WHERE user_id = auth.uid()))
  WITH CHECK (auth.role() = 'service_role' OR (SELECT is_admin FROM public.get_user_roles() WHERE user_id = auth.uid()));

CREATE POLICY "Allow authenticated users to read hf_datasets"
  ON public.hf_datasets FOR SELECT
  USING (auth.role() = 'authenticated');

-- Policies for hf_trainable_models
CREATE POLICY "Allow admin full access on hf_trainable_models"
  ON public.hf_trainable_models FOR ALL
  USING (auth.role() = 'service_role' OR (SELECT is_admin FROM public.get_user_roles() WHERE user_id = auth.uid()))
  WITH CHECK (auth.role() = 'service_role' OR (SELECT is_admin FROM public.get_user_roles() WHERE user_id = auth.uid()));

CREATE POLICY "Allow authenticated users to read hf_trainable_models"
  ON public.hf_trainable_models FOR SELECT
  USING (auth.role() = 'authenticated');

-- Policies for hf_training_jobs
CREATE POLICY "Allow admin full access on hf_training_jobs"
  ON public.hf_training_jobs FOR ALL
  USING (auth.role() = 'service_role' OR (SELECT is_admin FROM public.get_user_roles() WHERE user_id = auth.uid()))
  WITH CHECK (auth.role() = 'service_role' OR (SELECT is_admin FROM public.get_user_roles() WHERE user_id = auth.uid()));

CREATE POLICY "Allow users to manage their own hf_training_jobs"
  ON public.hf_training_jobs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow authenticated users to read hf_training_jobs"
  ON public.hf_training_jobs FOR SELECT
  USING (auth.role() = 'authenticated');

-- Update timestamps function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER set_hf_datasets_updated_at
BEFORE UPDATE ON public.hf_datasets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_hf_trainable_models_updated_at
BEFORE UPDATE ON public.hf_trainable_models
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add this migration to the migrations table
INSERT INTO public.migrations (name, applied_at)
VALUES ('024_huggingface_training_schema.sql', NOW())
ON CONFLICT (name) DO NOTHING;