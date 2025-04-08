/**
 * Models Service
 * 
 * This service provides methods for interacting with AI models through
 * the server's REST API endpoints. It replaces mock implementations with
 * real API calls to manage, train, and utilize models.
 * 
 * Updated to use the unified search API endpoint for improved consistency
 * and simpler integration.
 */

import unifiedSearchService from './unifiedSearchService';

// Using dynamic import to work around the axios module not found error
// This would typically be a regular import, but TypeScript configurations may vary
const axios = (() => {
  try {
    // @ts-ignore
    return require('axios');
  } catch (e) {
    // Fallback for when axios isn't found
    console.warn('Axios not found, using fetch API instead');
    return {
      get: async (url: string, config?: any) => {
        const headers = new Headers();
        if (config?.headers) {
          Object.entries(config.headers).forEach(([key, value]) => 
            headers.append(key, value as string)
          );
        }
        const response = await fetch(url, { headers });
        return { 
          status: response.status, 
          statusText: response.statusText,
          data: await response.json()
        };
      },
      post: async (url: string, data: any, config?: any) => {
        const headers = new Headers();
        headers.append('Content-Type', 'application/json');
        if (config?.headers) {
          Object.entries(config.headers).forEach(([key, value]) => 
            headers.append(key, value as string)
          );
        }
        const response = await fetch(url, { 
          method: 'POST',
          headers,
          body: config?.headers?.['Content-Type'] === 'multipart/form-data' 
            ? data 
            : JSON.stringify(data)
        });
        return { 
          status: response.status, 
          statusText: response.statusText,
          data: await response.json()
        };
      },
      delete: async (url: string, config?: any) => {
        const headers = new Headers();
        if (config?.headers) {
          Object.entries(config.headers).forEach(([key, value]) => 
            headers.append(key, value as string)
          );
        }
        const response = await fetch(url, { 
          method: 'DELETE',
          headers 
        });
        return { 
          status: response.status, 
          statusText: response.statusText,
          data: await response.json()
        };
      }
    };
  }
})();

// API base URL - should be configured from environment variables
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

// Model type definitions
export interface Model {
  id: string;
  name: string;
  description?: string;
  framework: 'tensorflow' | 'pytorch' | 'onnx' | 'custom';
  type: 'repository' | 'local' | 'trained';
  source?: string;
  status: 'ready' | 'training' | 'failed' | 'importing';
  accuracy?: number;
  modelPath?: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}

// Training parameters
export interface TrainingParams {
  datasetId: string;
  modelType: 'hybrid' | 'feature-based' | 'ml-based';
  outputDir?: string;
  epochs?: number;
  batchSize?: number;
  learningRate?: number;
  framework?: 'tensorflow' | 'pytorch';
  model?: string;
  augmentation?: boolean;
}

// Training Config interface for compatibility with ModelTrainingConnector
export interface TrainingConfig {
  datasetId: string;
  modelType?: 'hybrid' | 'feature-based' | 'ml-based';
  outputDir?: string;
  epochs?: number;
  batchSize?: number;
  learningRate?: number;
  framework?: 'tensorflow' | 'pytorch';
  model?: string;
  augmentation?: boolean;
}

// Training results
export interface TrainingResult {
  success: boolean;
  modelPath?: string;
  metadataPath?: string;
  accuracy?: number;
  trainingTime?: number;
  epochs?: number;
  lossHistory?: number[];
  message?: string;
}

// Import model parameters
export interface ImportModelParams {
  name: string;
  description?: string;
  framework: 'tensorflow' | 'pytorch' | 'onnx' | 'custom';
  source: string;
  type: 'repository' | 'local';
  file?: File; // For file uploads
}

/**
 * Models Service Implementation
 */
export const modelsService = {
  /**
   * Get a list of all models
   */
  async getModels(): Promise<Model[]> {
    try {
      // Use the unified search API with type=models
      const response = await unifiedSearchService.searchModels({
        limit: 100,
        includeMetadata: true
      });

      // Check if we're getting the new unified response format
      if (response.models && Array.isArray(response.models)) {
        // Unified API returns models directly in expected format
        return response.models.map((model: any) => ({
          id: model.id || `${model.type}-${model.name}`,
          name: model.name,
          description: model.description || `${model.type} model`,
          framework: model.framework || 'custom',
          type: model.type || 'local',
          source: model.source,
          modelPath: model.modelPath || model.path,
          status: model.status || 'ready',
          accuracy: model.accuracy,
          createdAt: model.createdAt || new Date().toISOString(),
          updatedAt: model.updatedAt || new Date().toISOString(),
          metadata: model.metadata || model
        }));
      }
      
      // Fallback to handle legacy response format if the API hasn't been fully updated
      const models: Model[] = [];
      const modelTypes = response.modelTypes || [];
      const modelsByType = response.models || {};

      // Flatten the structure and convert to our Model format
      for (const type of modelTypes) {
        const typeModels = modelsByType[type] || [];
        for (const model of typeModels) {
          models.push({
            id: `${type}-${model.name}`,
            name: model.name,
            description: model.description || `${type} model`,
            framework: model.framework || 'custom',
            type: type === 'repository' ? 'repository' : (type === 'trained' ? 'trained' : 'local'),
            modelPath: model.path,
            status: 'ready',
            accuracy: model.accuracy,
            createdAt: model.createdAt || new Date(model.stats?.birthtime).toISOString(),
            updatedAt: model.updatedAt || new Date(model.stats?.mtime).toISOString(),
            metadata: model
          });
        }
      }

      return models;
    } catch (error) {
      console.error('Error fetching models:', error);
      throw error;
    }
  },

  /**
   * Import a model from a repository or local file
   */
  async importModel(params: ImportModelParams): Promise<Model> {
    try {
      let endpoint = `${API_BASE_URL}/admin/model/import`;
      let response;

      if (params.file) {
        // Handle file upload
        const formData = new FormData();
        formData.append('model', params.file);
        formData.append('name', params.name);
        formData.append('description', params.description || '');
        formData.append('framework', params.framework);
        formData.append('type', params.type);

        response = await axios.post(endpoint, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        });
      } else {
        // Handle repository import
        response = await axios.post(endpoint, {
          name: params.name,
          description: params.description,
          framework: params.framework,
          source: params.source,
          type: params.type
        }, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        });
      }

      // Convert response to Model interface
      return {
        id: response.data.id || `imported-${Date.now()}`,
        name: params.name,
        description: params.description,
        framework: params.framework,
        type: params.type,
        source: params.source,
        status: 'ready',
        modelPath: response.data.modelPath,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: response.data
      };
    } catch (error) {
      console.error('Error importing model:', error);
      throw error;
    }
  },

  /**
   * Train a new model
   */
  async trainModel(params: TrainingParams | TrainingConfig): Promise<TrainingResult> {
    try {
      // Ensure we have the required modelType field
      // If using TrainingConfig which has optional modelType, default to 'hybrid'
      const modelType = (params as TrainingParams).modelType || 'hybrid';
      
      // Select the appropriate training endpoint based on model type
      const endpoint = params.framework
        ? `${API_BASE_URL}/admin/model/neural-network` // For neural networks
        : `${API_BASE_URL}/admin/model/train`;        // For feature-based or hybrid models

      const response = await axios.post(endpoint, {
        datasetId: params.datasetId,
        modelType,
        outputDir: params.outputDir,
        epochs: params.epochs,
        batchSize: params.batchSize,
        learningRate: params.learningRate,
        framework: params.framework,
        model: params.model,
        augmentation: params.augmentation
      }, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });

      return {
        success: response.data.success,
        modelPath: response.data.modelPath,
        metadataPath: response.data.metadataPath,
        accuracy: response.data.accuracy,
        trainingTime: response.data.trainingTime,
        epochs: response.data.epochs,
        lossHistory: response.data.lossHistory,
        message: response.data.message
      };
    } catch (error) {
      console.error('Error training model:', error);
      throw error;
    }
  },

  /**
   * Delete a model
   */
  async deleteModel(modelId: string): Promise<boolean> {
    try {
      // Extract type and name from the model ID (format: "type-name")
      const [type, ...nameParts] = modelId.split('-');
      const name = nameParts.join('-');

      await axios.delete(`${API_BASE_URL}/admin/model/${type}/${name}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });

      return true;
    } catch (error) {
      console.error(`Error deleting model ${modelId}:`, error);
      throw error;
    }
  },

  /**
   * Get model performance metrics
   */
  async getModelMetrics(): Promise<any> {
    try {
      const response = await axios.get(`${API_BASE_URL}/ai/models/metrics`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });

      return response.data;
    } catch (error) {
      console.error('Error fetching model metrics:', error);
      throw error;
    }
  }
};

export default modelsService;