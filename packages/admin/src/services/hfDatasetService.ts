// packages/admin/src/services/hfDatasetService.ts

import { supabase } from '@kai/shared/services/supabase/supabaseClient';
import { HfDataset } from '@kai/shared/types/huggingface';

const TABLE_NAME = 'hf_datasets';

export const hfDatasetService = {
  async getDatasets(): Promise<HfDataset[]> {
    const client = supabase.getClient();
    const { data, error } = await client.from(TABLE_NAME).select('*');
    if (error) {
      console.error('Error fetching Hugging Face datasets:', error);
      throw new Error(error.message);
    }
    return data || [];
  },

  async getDatasetById(id: string): Promise<HfDataset | null> {
    const client = supabase.getClient();
    const { data, error } = await client
      .from(TABLE_NAME)
      .select('*')
      .eq('id', id)
      .single();
    if (error) {
      console.error(`Error fetching dataset with id ${id}:`, error);
      throw new Error(error.message);
    }
    return data;
  },

  async createDataset(dataset: Omit<HfDataset, 'id' | 'created_at' | 'updated_at'>): Promise<HfDataset> {
    const client = supabase.getClient();
    const { data, error } = await client
      .from(TABLE_NAME)
      .insert([dataset])
      .single();
    if (error) {
      console.error('Error creating dataset:', error);
      throw new Error(error.message);
    }
    return data;
  },

  async updateDataset(id: string, updates: Partial<HfDataset>): Promise<HfDataset> {
    const client = supabase.getClient();
    const { data, error } = await client
      .from(TABLE_NAME)
      .update(updates)
      .eq('id', id)
      .single();
    if (error) {
      console.error(`Error updating dataset with id ${id}:`, error);
      throw new Error(error.message);
    }
    return data;
  },

  async deleteDataset(id: string): Promise<void> {
    const client = supabase.getClient();
    const { error } = await client.from(TABLE_NAME).delete().eq('id', id);
    if (error) {
      console.error(`Error deleting dataset with id ${id}:`, error);
      throw new Error(error.message);
    }
  },
};