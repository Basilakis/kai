/**
 * Queue Service
 * 
 * Provides functions for interacting with the queue management API
 */

import axios from 'axios';
import { API_BASE_URL } from '../config';
import { getAuthToken } from './auth.service';

// Queue system types
export type QueueSystem = 'pdf' | 'crawler' | 'all';

// Job status types
export type JobStatus = 'pending' | 'processing' | 'running' | 'completed' | 'failed' | 'canceled' | 'retrying' | 'training';

// Priority types
export type JobPriority = 'low' | 'normal' | 'high';

// Job interface
export interface QueueJob {
  id: string;
  system: 'pdf' | 'crawler';
  status: JobStatus;
  priority: JobPriority | string;
  createdAt: string;
  updatedAt: string;
  progress: number;
  attempts: number;
  maxAttempts: number;
  source: string;
  // PDF specific
  filePath?: string;
  options?: any;
  // Crawler specific
  config?: {
    url?: string;
    provider?: string;
    autoTrain?: boolean;
    [key: string]: any;
  };
  // Common
  error?: string;
  trainingJobId?: string;
  statusHistory?: Array<{
    status: JobStatus;
    timestamp: string;
    message?: string;
  }>;
  metrics?: {
    processingTime?: number;
    pagesProcessed?: number;
    pagesCrawled?: number;
    fileSize?: number;
    dataSize?: number;
    [key: string]: any;
  };
}

// Queue statistics interface
export interface QueueStats {
  pdf: {
    total: number;
    byStatus: Record<string, number>;
    bySource?: Record<string, number>;
  };
  crawler: {
    total: number;
    byStatus: Record<string, number>;
    byProvider: Record<string, number>;
    bySource?: Record<string, number>;
  };
  overall?: {
    total: number;
    byStatus: Record<string, number>;
    processing: number;
    waiting: number;
    completed: number;
    failed: number;
  };
}

// Filter interface
export interface QueueFilter {
  queueSystem: QueueSystem;
  status?: string;
  source?: string;
}

// Source filters interface
export interface SourceFilters {
  all: string[];
  pdf: string[];
  crawler: string[];
}

/**
 * Get all queue jobs with optional filtering
 */
export const getQueueJobs = async (filter: QueueFilter): Promise<QueueJob[]> => {
  try {
    const token = getAuthToken();
    const { queueSystem, status, source } = filter;
    
    let url = `${API_BASE_URL}/admin/queue/jobs?system=${queueSystem}`;
    if (status) url += `&status=${status}`;
    if (source) url += `&source=${encodeURIComponent(source)}`;
    
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    return response.data.data;
  } catch (error) {
    console.error('Error fetching queue jobs:', error);
    throw error;
  }
};

/**
 * Get a specific queue job by ID
 */
export const getQueueJob = async (jobId: string, system: 'pdf' | 'crawler'): Promise<QueueJob> => {
  try {
    const token = getAuthToken();
    const response = await axios.get(`${API_BASE_URL}/admin/queue/jobs/${jobId}?system=${system}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    return response.data.data;
  } catch (error) {
    console.error(`Error fetching job ${jobId}:`, error);
    throw error;
  }
};

/**
 * Get queue statistics
 */
export const getQueueStats = async (): Promise<QueueStats> => {
  try {
    const token = getAuthToken();
    const response = await axios.get(`${API_BASE_URL}/admin/queue/stats`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    return response.data.data;
  } catch (error) {
    console.error('Error fetching queue stats:', error);
    throw error;
  }
};

/**
 * Get available source filters for queue jobs
 */
export const getSourceFilters = async (): Promise<SourceFilters> => {
  try {
    const token = getAuthToken();
    const response = await axios.get(`${API_BASE_URL}/admin/queue/sources`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    return response.data.data;
  } catch (error) {
    console.error('Error fetching source filters:', error);
    throw error;
  }
};

/**
 * Retry a failed queue job
 */
export const retryQueueJob = async (jobId: string, system: 'pdf' | 'crawler'): Promise<string> => {
  try {
    const token = getAuthToken();
    const response = await axios.post(
      `${API_BASE_URL}/admin/queue/jobs/${jobId}/retry`,
      { system },
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    
    return response.data.message;
  } catch (error) {
    console.error(`Error retrying job ${jobId}:`, error);
    throw error;
  }
};

/**
 * Cancel a running queue job
 */
export const cancelQueueJob = async (jobId: string, system: 'pdf' | 'crawler'): Promise<string> => {
  try {
    const token = getAuthToken();
    const response = await axios.post(
      `${API_BASE_URL}/admin/queue/jobs/${jobId}/cancel`,
      { system },
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    
    return response.data.message;
  } catch (error) {
    console.error(`Error canceling job ${jobId}:`, error);
    throw error;
  }
};

/**
 * Get logs for a queue job
 */
export const getJobLogs = async (jobId: string, system: 'pdf' | 'crawler'): Promise<string[]> => {
  try {
    const token = getAuthToken();
    const response = await axios.get(
      `${API_BASE_URL}/admin/queue/jobs/${jobId}/logs?system=${system}`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    
    return response.data.data;
  } catch (error) {
    console.error(`Error fetching logs for job ${jobId}:`, error);
    throw error;
  }
};

/**
 * Get results for a queue job
 */
export const getJobResults = async (jobId: string, system: 'pdf' | 'crawler'): Promise<any> => {
  try {
    const token = getAuthToken();
    const response = await axios.get(
      `${API_BASE_URL}/admin/queue/jobs/${jobId}/results?system=${system}`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    
    return response.data.data;
  } catch (error) {
    console.error(`Error fetching results for job ${jobId}:`, error);
    throw error;
  }
};

/**
 * Trigger training for a completed job
 */
export const triggerTrainingForJob = async (jobId: string, system: 'pdf' | 'crawler'): Promise<string> => {
  try {
    const token = getAuthToken();
    const response = await axios.post(
      `${API_BASE_URL}/admin/queue/jobs/${jobId}/train`,
      { system },
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    
    return response.data.message;
  } catch (error) {
    console.error(`Error triggering training for job ${jobId}:`, error);
    throw error;
  }
};

/**
 * Get advanced queue metrics for dashboard
 */
export const getAdvancedQueueMetrics = async (): Promise<any> => {
  try {
    const token = getAuthToken();
    const response = await axios.get(`${API_BASE_URL}/admin/queue/metrics`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    return response.data.data;
  } catch (error) {
    console.error('Error fetching advanced queue metrics:', error);
    throw error;
  }
};

/**
 * Clear all jobs from a queue system
 */
export const clearQueue = async (system: 'pdf' | 'crawler'): Promise<{message: string, count: number}> => {
  try {
    const token = getAuthToken();
    const response = await axios.post(
      `${API_BASE_URL}/admin/queue/clear`,
      { system },
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    
    return {
      message: response.data.message,
      count: response.data.count
    };
  } catch (error) {
    console.error(`Error clearing ${system} queue:`, error);
    throw error;
  }
};

export default {
  getQueueJobs,
  getQueueJob,
  getQueueStats,
  getSourceFilters,
  retryQueueJob,
  cancelQueueJob,
  getJobLogs,
  getJobResults,
  triggerTrainingForJob,
  getAdvancedQueueMetrics,
  clearQueue
};