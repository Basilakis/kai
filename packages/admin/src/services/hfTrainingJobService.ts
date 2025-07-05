// packages/admin/src/services/hfTrainingJobService.ts

import { supabase } from '@kai/shared/services/supabase/supabaseClient';
import { HfTrainingJob } from '@kai/shared/types/huggingface';

const TABLE_NAME = 'hf_training_jobs';

export const hfTrainingJobService = {
  async getJobs(): Promise<HfTrainingJob[]> {
    const client = supabase.getClient();
    const { data, error } = await client.from(TABLE_NAME).select('*');
    if (error) {
      console.error('Error fetching Hugging Face training jobs:', error);
      throw new Error(error.message);
    }
    return data || [];
  },

  async getJobById(id: string): Promise<HfTrainingJob | null> {
    const client = supabase.getClient();
    const { data, error } = await client
      .from(TABLE_NAME)
      .select('*')
      .eq('id', id)
      .single();
    if (error) {
      console.error(`Error fetching job with id ${id}:`, error);
      throw new Error(error.message);
    }
    return data;
  },

  async createJob(job: Omit<HfTrainingJob, 'id' | 'created_at' | 'updated_at'>): Promise<HfTrainingJob> {
    const client = supabase.getClient();
    const { data, error } = await client
      .from(TABLE_NAME)
      .insert([job])
      .single();
    if (error) {
      console.error('Error creating job:', error);
      throw new Error(error.message);
    }
    return data;
  },

  async updateJob(id: string, updates: Partial<HfTrainingJob>): Promise<HfTrainingJob> {
    const client = supabase.getClient();
    const { data, error } = await client
      .from(TABLE_NAME)
      .update(updates)
      .eq('id', id)
      .single();
    if (error) {
      console.error(`Error updating job with id ${id}:`, error);
      throw new Error(error.message);
    }
    return data;
  },

  async deleteJob(id: string): Promise<void> {
    const client = supabase.getClient();
    const { error } = await client.from(TABLE_NAME).delete().eq('id', id);
    if (error) {
      console.error(`Error deleting job with id ${id}:`, error);
      throw new Error(error.message);
    }
  },
};