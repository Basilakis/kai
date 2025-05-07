import { Router } from 'express';
import { supabase } from '../../services/supabase';
import { isAdmin } from '../../middleware/auth';
import { z } from 'zod';
import { validateRequest } from '../../middleware/validation';

const router = Router();

// Apply admin middleware to all routes
router.use(isAdmin);

// Schema for creating/updating ML models
const mlModelSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  modelType: z.string().min(1).max(50),
  modelParameters: z.record(z.any()).default({}),
  trainingDataQuery: z.string().optional(),
  isActive: z.boolean().default(true)
});

// Get all ML models
router.get('/models', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('prompt_ml_models')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(400).json({ success: false, message: error.message });
    }

    return res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching ML models:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get ML model by ID
router.get('/models/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('prompt_ml_models')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return res.status(404).json({ success: false, message: 'Model not found' });
    }

    return res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching ML model:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Create ML model
router.post('/models', validateRequest(mlModelSchema), async (req, res) => {
  try {
    const modelData = req.body;

    const { data, error } = await supabase
      .from('prompt_ml_models')
      .insert({
        name: modelData.name,
        description: modelData.description,
        model_type: modelData.modelType,
        model_parameters: modelData.modelParameters,
        training_data_query: modelData.trainingDataQuery,
        is_active: modelData.isActive
      })
      .select()
      .single();

    if (error) {
      return res.status(400).json({ success: false, message: error.message });
    }

    return res.status(201).json({ success: true, data });
  } catch (error) {
    console.error('Error creating ML model:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Update ML model
router.patch('/models/:id', validateRequest(mlModelSchema.partial()), async (req, res) => {
  try {
    const { id } = req.params;
    const modelData = req.body;

    const updateData: any = {};
    if (modelData.name !== undefined) updateData.name = modelData.name;
    if (modelData.description !== undefined) updateData.description = modelData.description;
    if (modelData.modelType !== undefined) updateData.model_type = modelData.modelType;
    if (modelData.modelParameters !== undefined) updateData.model_parameters = modelData.modelParameters;
    if (modelData.trainingDataQuery !== undefined) updateData.training_data_query = modelData.trainingDataQuery;
    if (modelData.isActive !== undefined) updateData.is_active = modelData.isActive;

    const { data, error } = await supabase
      .from('prompt_ml_models')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ success: false, message: error.message });
    }

    return res.json({ success: true, data });
  } catch (error) {
    console.error('Error updating ML model:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Train ML model
router.post('/models/:id/train', async (req, res) => {
  try {
    const { id } = req.params;

    // Get the model
    const { data: model, error: modelError } = await supabase
      .from('prompt_ml_models')
      .select('*')
      .eq('id', id)
      .single();

    if (modelError) {
      return res.status(404).json({ success: false, message: 'Model not found' });
    }

    // Get the latest version number
    const { data: versions, error: versionsError } = await supabase
      .from('prompt_ml_model_versions')
      .select('version_number')
      .eq('model_id', id)
      .order('version_number', { ascending: false })
      .limit(1);

    if (versionsError) {
      return res.status(400).json({ success: false, message: versionsError.message });
    }

    const nextVersionNumber = versions && versions.length > 0 ? versions[0].version_number + 1 : 1;

    // Create a new version (this would normally trigger a background job for training)
    const { data: newVersion, error: newVersionError } = await supabase
      .from('prompt_ml_model_versions')
      .insert({
        model_id: id,
        version_number: nextVersionNumber,
        is_active: false
      })
      .select()
      .single();

    if (newVersionError) {
      return res.status(400).json({ success: false, message: newVersionError.message });
    }

    // Update the model's last_trained_at timestamp
    await supabase
      .from('prompt_ml_models')
      .update({ last_trained_at: new Date().toISOString() })
      .eq('id', id);

    // In a real implementation, you would trigger a background job here
    // For now, we'll just return success
    return res.json({ 
      success: true, 
      data: { 
        message: 'Model training started', 
        modelId: id, 
        versionId: newVersion.id,
        versionNumber: nextVersionNumber
      } 
    });
  } catch (error) {
    console.error('Error training ML model:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get model versions
router.get('/models/:id/versions', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('prompt_ml_model_versions')
      .select('*')
      .eq('model_id', id)
      .order('version_number', { ascending: false });

    if (error) {
      return res.status(400).json({ success: false, message: error.message });
    }

    return res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching model versions:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get model performance
router.get('/models/:id/performance', async (req, res) => {
  try {
    const { id } = req.params;

    // Get the latest active version
    const { data: version, error: versionError } = await supabase
      .from('prompt_ml_model_versions')
      .select('*')
      .eq('model_id', id)
      .eq('is_active', true)
      .order('version_number', { ascending: false })
      .limit(1)
      .single();

    if (versionError) {
      // If no active version, get the latest version
      const { data: latestVersion, error: latestVersionError } = await supabase
        .from('prompt_ml_model_versions')
        .select('*')
        .eq('model_id', id)
        .order('version_number', { ascending: false })
        .limit(1)
        .single();

      if (latestVersionError) {
        return res.status(404).json({ success: false, message: 'No model versions found' });
      }

      return res.json({ success: true, data: latestVersion });
    }

    return res.json({ success: true, data: version });
  } catch (error) {
    console.error('Error fetching model performance:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get feature importance
router.get('/feature-importance', async (req, res) => {
  try {
    const { modelId } = req.query;

    if (!modelId) {
      return res.status(400).json({ success: false, message: 'Model ID is required' });
    }

    const { data, error } = await supabase
      .from('prompt_feature_importance')
      .select('*')
      .eq('model_id', modelId)
      .order('importance', { ascending: false });

    if (error) {
      return res.status(400).json({ success: false, message: error.message });
    }

    return res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching feature importance:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Predict prompt success
router.post('/predict', async (req, res) => {
  try {
    const { promptContent, modelId } = req.body;

    if (!promptContent) {
      return res.status(400).json({ success: false, message: 'Prompt content is required' });
    }

    // In a real implementation, you would use the ML model to make a prediction
    // For now, we'll just return a mock prediction
    const mockPrediction = {
      predictedSuccessRate: Math.random() * 0.5 + 0.5, // Random value between 0.5 and 1.0
      confidenceScore: Math.random() * 0.3 + 0.7, // Random value between 0.7 and 1.0
      featureValues: {
        length: promptContent.length,
        wordCount: promptContent.split(/\s+/).length,
        questionCount: (promptContent.match(/\?/g) || []).length,
        commandCount: (promptContent.match(/!/g) || []).length,
        complexity: Math.random() * 0.5 + 0.5
      },
      suggestions: [
        'Add more specific instructions',
        'Include examples of desired output',
        'Break down complex requests into steps'
      ]
    };

    // Save the prediction to the database
    const { data, error } = await supabase
      .from('prompt_predictions')
      .insert({
        prompt_content: promptContent,
        model_id: modelId,
        predicted_success_rate: mockPrediction.predictedSuccessRate,
        confidence_score: mockPrediction.confidenceScore,
        feature_values: mockPrediction.featureValues,
        suggestions: mockPrediction.suggestions
      })
      .select()
      .single();

    if (error) {
      return res.status(400).json({ success: false, message: error.message });
    }

    return res.json({ success: true, data: mockPrediction });
  } catch (error) {
    console.error('Error predicting prompt success:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;
