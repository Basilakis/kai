/**
 * Checkpoint Service
 * 
 * This service provides methods for managing model training checkpoints through
 * the server's REST API endpoints. It replaces mock implementations with
 * real API calls to fetch, create, roll back to, and delete checkpoints.
 */

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
          body: JSON.stringify(data)
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
      },
      put: async (url: string, data: any, config?: any) => {
        const headers = new Headers();
        headers.append('Content-Type', 'application/json');
        if (config?.headers) {
          Object.entries(config.headers).forEach(([key, value]) => 
            headers.append(key, value as string)
          );
        }
        const response = await fetch(url, { 
          method: 'PUT',
          headers,
          body: JSON.stringify(data)
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

/**
 * A single checkpoint entry
 */
export interface Checkpoint {
  id: string;
  timestamp: number;
  description: string;
  metrics: {
    loss: number;
    accuracy: number;
    [key: string]: number;
  };
  modelType: string;
  epoch: number;
  parameters: Record<string, number | string>;
  fileSize: number;
  isActive: boolean;
  tags: string[];
}

/**
 * Checkpoint Service Implementation
 */
export const checkpointService = {
  /**
   * Fetch checkpoints for a job
   */
  async fetchCheckpoints(jobId: string): Promise<Checkpoint[]> {
    try {
      const response = await axios.get(`${API_BASE_URL}/admin/training/job/${jobId}/checkpoints`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });

      // Map API response to Checkpoint interface
      return response.data.map((cp: any) => ({
        id: cp.id,
        timestamp: new Date(cp.timestamp || cp.createdAt).getTime(),
        description: cp.description || '',
        metrics: {
          loss: cp.metrics?.loss || 0,
          accuracy: cp.metrics?.accuracy || 0,
          ...cp.metrics
        },
        modelType: cp.modelType || 'unknown',
        epoch: cp.epoch || 0,
        parameters: cp.parameters || {},
        fileSize: cp.fileSize || 0,
        isActive: cp.isActive || false,
        tags: cp.tags || []
      }));
    } catch (error) {
      console.error('Error fetching checkpoints:', error);
      throw error;
    }
  },

  /**
   * Create a new checkpoint for a job
   */
  async createCheckpoint(
    jobId: string,
    description: string,
    tags: string[]
  ): Promise<Checkpoint> {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/admin/training/job/${jobId}/checkpoint`,
        {
          description,
          tags
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      // Map API response to Checkpoint interface
      const cp = response.data;
      return {
        id: cp.id,
        timestamp: new Date(cp.timestamp || cp.createdAt).getTime(),
        description: cp.description || '',
        metrics: {
          loss: cp.metrics?.loss || 0,
          accuracy: cp.metrics?.accuracy || 0,
          ...cp.metrics
        },
        modelType: cp.modelType || 'unknown',
        epoch: cp.epoch || 0,
        parameters: cp.parameters || {},
        fileSize: cp.fileSize || 0,
        isActive: cp.isActive || false,
        tags: cp.tags || []
      };
    } catch (error) {
      console.error('Error creating checkpoint:', error);
      throw error;
    }
  },

  /**
   * Roll back to a specific checkpoint
   */
  async rollbackCheckpoint(
    jobId: string,
    checkpointId: string
  ): Promise<boolean> {
    try {
      const response = await axios.put(
        `${API_BASE_URL}/admin/training/job/${jobId}/rollback`,
        {
          checkpointId
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      return response.data.success || response.status === 200;
    } catch (error) {
      console.error('Error rolling back to checkpoint:', error);
      throw error;
    }
  },

  /**
   * Delete a checkpoint
   */
  async deleteCheckpoint(
    jobId: string,
    checkpointId: string
  ): Promise<boolean> {
    try {
      const response = await axios.delete(
        `${API_BASE_URL}/admin/training/job/${jobId}/checkpoint/${checkpointId}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      return response.data.success || response.status === 200;
    } catch (error) {
      console.error('Error deleting checkpoint:', error);
      throw error;
    }
  },

  /**
   * Get details for a specific checkpoint
   */
  async getCheckpointDetails(
    jobId: string,
    checkpointId: string
  ): Promise<Checkpoint> {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/admin/training/job/${jobId}/checkpoint/${checkpointId}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      // Map API response to Checkpoint interface
      const cp = response.data;
      return {
        id: cp.id,
        timestamp: new Date(cp.timestamp || cp.createdAt).getTime(),
        description: cp.description || '',
        metrics: {
          loss: cp.metrics?.loss || 0,
          accuracy: cp.metrics?.accuracy || 0,
          ...cp.metrics
        },
        modelType: cp.modelType || 'unknown',
        epoch: cp.epoch || 0,
        parameters: cp.parameters || {},
        fileSize: cp.fileSize || 0,
        isActive: cp.isActive || false,
        tags: cp.tags || []
      };
    } catch (error) {
      console.error('Error fetching checkpoint details:', error);
      throw error;
    }
  },

  /**
   * Export a checkpoint to a specific format
   */
  async exportCheckpoint(
    jobId: string,
    checkpointId: string,
    format: 'onnx' | 'torchscript' | 'savedmodel' = 'onnx'
  ): Promise<string> {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/admin/training/job/${jobId}/checkpoint/${checkpointId}/export`,
        {
          format
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      return response.data.exportPath || '';
    } catch (error) {
      console.error('Error exporting checkpoint:', error);
      throw error;
    }
  }
};

export default checkpointService;