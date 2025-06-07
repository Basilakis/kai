// packages/shared/src/types/huggingface.ts

/**
 * Represents the status of a Hugging Face training job.
 * Matches the 'hf_training_job_status' enum in the database.
 */
export enum HfTrainingJobStatus {
  PENDING = 'pending',
  PREPROCESSING = 'preprocessing',
  DOWNLOADING_DATASET = 'downloading_dataset',
  DOWNLOADING_MODEL = 'downloading_model',
  TRAINING = 'training',
  EVALUATING = 'evaluating',
  SAVING_MODEL = 'saving_model',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

/**
 * Interface for the 'hf_datasets' table.
 * Stores information about Hugging Face datasets used for training.
 */
export interface HfDataset {
  id: string; // UUID
  dataset_identifier: string;
  name: string;
  description?: string | null;
  source_url?: string | null;
  local_path?: string | null;
  metadata?: Record<string, any> | null; // JSONB
  created_at: string; // TIMESTAMPTZ
  updated_at: string; // TIMESTAMPTZ
  user_id?: string | null; // UUID
}

/**
 * Interface for the 'hf_trainable_models' table.
 * Represents models that can be fine-tuned using Hugging Face datasets and pipelines.
 */
export interface HfTrainableModel {
  id: string; // UUID
  name: string;
  base_model_identifier: string;
  description?: string | null;
  model_type: string;
  version?: string | null;
  created_at: string; // TIMESTAMPTZ
  updated_at: string; // TIMESTAMPTZ
  user_id?: string | null; // UUID
}

/**
 * Interface for the 'hf_training_jobs' table.
 * Manages training jobs for Hugging Face models and datasets.
 */
export interface HfTrainingJob {
  id: string; // UUID
  trainable_model_id: string; // UUID
  hf_dataset_id: string; // UUID
  job_name?: string | null;
  status: HfTrainingJobStatus;
  training_parameters?: Record<string, any> | null; // JSONB
  output_safetensor_path?: string | null;
  output_metadata?: Record<string, any> | null; // JSONB
  metrics?: Record<string, any> | null; // JSONB
  logs_path?: string | null;
  user_id: string; // UUID
  created_at: string; // TIMESTAMPTZ
  started_at?: string | null; // TIMESTAMPTZ
  completed_at?: string | null; // TIMESTAMPTZ
  error_message?: string | null;
}

// You might want to add these to your main Supabase generated types (Database interface)
// if you are using `supabase gen types typescript`. For example:
/*
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      hf_datasets: {
        Row: HfDataset;
        Insert: Omit<HfDataset, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<HfDataset, 'id' | 'created_at'>>;
      };
      hf_trainable_models: {
        Row: HfTrainableModel;
        Insert: Omit<HfTrainableModel, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<HfTrainableModel, 'id' | 'created_at'>>;
      };
      hf_training_jobs: {
        Row: HfTrainingJob;
        Insert: Omit<HfTrainingJob, 'id' | 'created_at' | 'started_at' | 'completed_at'>;
        Update: Partial<Omit<HfTrainingJob, 'id' | 'created_at' | 'user_id'>>;
      };
      // ... other tables
    };
    Views: {
      // ... your views
    };
    Functions: {
      // ... your functions
    };
    Enums: {
      hf_training_job_status: HfTrainingJobStatus;
      // ... other enums
    };
    CompositeTypes: {
      // ... your composite types
    };
  };
}
*/