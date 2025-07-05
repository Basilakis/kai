// packages/admin/src/services/hfTrainableModelService.ts

import { supabase } from '@kai/shared/services/supabase/supabaseClient';
import { HfTrainableModel } from '@kai/shared/types/huggingface';

const TABLE_NAME = 'hf_trainable_models';

export const hfTrainableModelService = {
  async getModels(): Promise<HfTrainableModel[]> {
    const client = supabase.getClient();
    const { data, error } = await client.from(TABLE_NAME).select('*');
    if (error) {
      console.error('Error fetching Hugging Face trainable models:', error);
      throw new Error(error.message);
    }
    return data || [];
  },

  async getModelById(id: string): Promise<HfTrainableModel | null> {
    const client = supabase.getClient();
    const { data, error } = await client
      .from(TABLE_NAME)
      .select('*')
      .eq('id', id)
      .single();
    if (error) {
      console.error(`Error fetching model with id ${id}:`, error);
      throw new Error(error.message);
    }
    return data;
  },

  async createModel(model: Omit<HfTrainableModel, 'id' | 'created_at' | 'updated_at'>): Promise<HfTrainableModel> {
    const client = supabase.getClient();
    const { data, error } = await client
      .from(TABLE_NAME)
      .insert([model])
      .single();
    if (error) {
      console.error('Error creating model:', error);
      throw new Error(error.message);
    }
    return data;
  },

  async updateModel(id: string, updates: Partial<HfTrainableModel>): Promise<HfTrainableModel> {
    const client = supabase.getClient();
    const { data, error } = await client
      .from(TABLE_NAME)
      .update(updates)
      .eq('id', id)
      .single();
    if (error) {
      console.error(`Error updating model with id ${id}:`, error);
      throw new Error(error.message);
    }
    return data;
  },

  async deleteModel(id: string): Promise<void> {
    const client = supabase.getClient();
    const { error } = await client.from(TABLE_NAME).delete().eq('id', id);
    if (error) {
      console.error(`Error deleting model with id ${id}:`, error);
      throw new Error(error.message);
    }
  },

  async generateModelDescription(baseModelIdentifier: string): Promise<string> {
    // In a real implementation, you would use an AI service here.
    // For now, we'll return a mock description.
    const prompt = `Generate a brief, user-friendly description for the Hugging Face model "${baseModelIdentifier}". Explain its primary function and common use cases within a web application.`;
    
    // Mocking the AI call
    console.log(`Generating description for: ${baseModelIdentifier}`);
    console.log(`Prompt: ${prompt}`);
    
    // This is where you would integrate with an AI provider like OpenAI or Anthropic
    // const aiResponse = await aiProvider.generate(prompt);
    // return aiResponse.text;

    return new Promise(resolve => {
      setTimeout(() => {
        resolve(`This model (${baseModelIdentifier}) is a powerful foundation for various tasks. It can be fine-tuned to specialize in areas like text-to-image generation, content summarization, or sentiment analysis, making it a versatile choice for enhancing application features.`);
      }, 500);
    });
  },
};