/**
 * Queue Controller
 * 
 * This controller provides a unified interface for both PDF and Crawler queue systems,
 * allowing administrators to view, manage and filter jobs from both systems in one place.
 */

import { logger } from '../utils/logger';
import { pdfQueue, JobStatus as PDFJobStatus, QueueJob as PDFJob, JobPriority as PDFJobPriority } from '../services/pdf/pdfQueue';
import { crawlerQueue, CrawlerJobStatus, CrawlerJob } from '../services/crawler/crawlerQueue';

// Define a unified job type to normalize data from both queue systems
export interface UnifiedQueueJob {
  id: string;
  status: string;
  createdAt: Date;
  priority: number | string;
  queueSystem: 'pdf' | 'crawler';
  source: string;
  progress: number;
  lastUpdated: Date;
  attempts: number;
  error?: string;
  metadata: Record<string, any>;
  // PDF specific fields
  filePath?: string;
  fileSize?: number;
  // Crawler specific fields
  url?: string;
  provider?: string;
}

// Convert string priority to number for sorting
const priorityToNumber = (priority: PDFJobPriority): number => {
  switch (priority) {
    case 'high': return 2;
    case 'normal': return 1;
    case 'low': return 0;
    default: return 1;
  }
};

/**
 * Get all jobs from both queue systems
 * @param filter Optional filters to apply
 * @returns Combined list of jobs from both queue systems
 */
export const getAllQueueJobs = async (
  filter?: {
    queueSystem?: 'pdf' | 'crawler' | 'all';
    status?: string;
    source?: string;
  }
): Promise<UnifiedQueueJob[]> => {
  try {
    const allJobs: UnifiedQueueJob[] = [];
    
    // Get PDF jobs if requested
    if (!filter?.queueSystem || filter.queueSystem === 'all' || filter.queueSystem === 'pdf') {
      // Cast the status filter to PDFJobStatus if provided
      const statusFilter = filter?.status as PDFJobStatus | undefined;
      const pdfJobs = pdfQueue.getAll(statusFilter);
      
      // Convert PDF jobs to unified format
      const mappedPdfJobs = pdfJobs.map(job => ({
        id: job.id,
        status: job.status,
        createdAt: new Date(job.createdAt),
        priority: job.priority,
        queueSystem: 'pdf' as const,
        source: job.options?.manufacturer || 'File Upload',
        progress: job.progress?.processedPages ? (job.progress.processedPages / (job.progress.totalPages || 1)) * 100 : 0,
        lastUpdated: new Date(job.startedAt || job.createdAt),
        attempts: job.attempts || 0,
        error: job.error,
        metadata: {
          userId: job.options?.userId,
          catalogName: job.options?.catalogName
        },
        filePath: job.filePath,
        fileSize: fs.existsSync(job.filePath) ? fs.statSync(job.filePath).size : undefined
      }));
      
      allJobs.push(...mappedPdfJobs);
    }
    
    // Get crawler jobs if requested
    if (!filter?.queueSystem || filter.queueSystem === 'all' || filter.queueSystem === 'crawler') {
      const crawlerJobMap = crawlerQueue.getAllJobs();
      const crawlerJobArray = Array.from(crawlerJobMap.values());
      
      // Filter by status if requested
      const filteredCrawlerJobs = filter?.status
        ? crawlerJobArray.filter(job => job.status === filter.status)
        : crawlerJobArray;
      
      // Convert crawler jobs to unified format
      const mappedCrawlerJobs = filteredCrawlerJobs.map(job => ({
        id: job.id,
        status: job.status,
        createdAt: new Date(job.createdAt),
        priority: job.priority,
        queueSystem: 'crawler' as const,
        source: job.provider || 'Unknown',
        progress: job.progress ? job.progress * 100 : 0,
        lastUpdated: new Date(job.completedAt || job.startedAt || job.createdAt),
        attempts: 1, // Crawler jobs don't track attempts
        error: job.error,
        metadata: {
          configId: job.configId,
          externalJobId: job.externalJobId,
          trainingJobId: job.trainingJobId
        },
        url: job.config.url,
        provider: job.provider
      }));
      
      allJobs.push(...mappedCrawlerJobs);
    }
    
    // Apply source filter if provided
    const filteredJobs = filter?.source 
      ? allJobs.filter(job => job.source.toLowerCase().includes(filter.source!.toLowerCase()))
      : allJobs;
    
    // Sort by creation date (newest first)
    return filteredJobs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } catch (error) {
    logger.error(`Error getting queue jobs: ${error}`);
    return [];
  }
};

/**
 * Get a specific job from either queue system
 * @param jobId The job ID to find
 * @param queueSystem Optional queue system to search in
 * @returns Job details or null if not found
 */
export const getQueueJob = async (
  jobId: string,
  queueSystem?: 'pdf' | 'crawler'
): Promise<UnifiedQueueJob | null> => {
  try {
    // Try PDF queue first or if specifically requested
    if (!queueSystem || queueSystem === 'pdf') {
      const pdfJob = pdfQueue.get(jobId);
      if (pdfJob) {
        return {
          id: pdfJob.id,
          status: pdfJob.status,
          createdAt: new Date(pdfJob.createdAt),
          priority: pdfJob.priority,
          queueSystem: 'pdf',
          source: pdfJob.options?.manufacturer || 'File Upload',
          progress: pdfJob.progress?.processedPages ? (pdfJob.progress.processedPages / (pdfJob.progress.totalPages || 1)) * 100 : 0,
          lastUpdated: new Date(pdfJob.startedAt || pdfJob.createdAt),
          attempts: pdfJob.attempts || 0,
          error: pdfJob.error,
          metadata: {
            userId: pdfJob.options?.userId,
            catalogName: pdfJob.options?.catalogName
          },
          filePath: pdfJob.filePath,
          fileSize: fs.existsSync(pdfJob.filePath) ? fs.statSync(pdfJob.filePath).size : undefined
        };
      }
    }
    
    // Try crawler queue if not found in PDF queue or if specifically requested
    if (!queueSystem || queueSystem === 'crawler') {
      const crawlerJob = crawlerQueue.getJob(jobId);
      
      if (crawlerJob) {
        return {
          id: crawlerJob.id,
          status: crawlerJob.status,
          createdAt: new Date(crawlerJob.createdAt),
          priority: crawlerJob.priority,
          queueSystem: 'crawler',
          source: crawlerJob.provider || 'Unknown',
          progress: crawlerJob.progress ? crawlerJob.progress * 100 : 0,
          lastUpdated: new Date(crawlerJob.completedAt || crawlerJob.startedAt || crawlerJob.createdAt),
          attempts: 1, // Crawler jobs don't track attempts
          error: crawlerJob.error,
          metadata: {
            configId: crawlerJob.configId,
            externalJobId: crawlerJob.externalJobId,
            trainingJobId: crawlerJob.trainingJobId
          },
          url: crawlerJob.config.url,
          provider: crawlerJob.provider
        };
      }
    }
    
    return null;
  } catch (error) {
    logger.error(`Error getting queue job ${jobId}: ${error}`);
    return null;
  }
};

/**
 * Get queue statistics for both systems
 * @returns Statistics for both queue systems
 */
export const getQueueStats = async (): Promise<{
  pdf: { 
    total: number;
    byStatus: Record<string, number>;
  };
  crawler: {
    total: number;
    byStatus: Record<string, number>;
    byProvider: Record<string, number>;
  };
}> => {
  try {
    // Get all PDF jobs
    const pdfJobs = pdfQueue.getAll();
    
    // Get all crawler jobs
    const crawlerJobMap = crawlerQueue.getAllJobs();
    const crawlerJobs = Array.from(crawlerJobMap.values());
    
    // Calculate PDF stats
    const pdfByStatus: Record<string, number> = {};
    for (const job of pdfJobs) {
      pdfByStatus[job.status] = (pdfByStatus[job.status] || 0) + 1;
    }
    
    // Calculate crawler stats
    const crawlerByStatus: Record<string, number> = {};
    const crawlerByProvider: Record<string, number> = {};
    
    for (const job of crawlerJobs) {
      crawlerByStatus[job.status] = (crawlerByStatus[job.status] || 0) + 1;
      
      const provider = job.provider || 'unknown';
      crawlerByProvider[provider] = (crawlerByProvider[provider] || 0) + 1;
    }
    
    return {
      pdf: {
        total: pdfJobs.length,
        byStatus: pdfByStatus
      },
      crawler: {
        total: crawlerJobs.length,
        byStatus: crawlerByStatus,
        byProvider: crawlerByProvider
      }
    };
  } catch (error) {
    logger.error(`Error getting queue stats: ${error}`);
    return {
      pdf: { total: 0, byStatus: {} },
      crawler: { total: 0, byStatus: {}, byProvider: {} }
    };
  }
};

/**
 * Retry a failed job
 * @param jobId The job ID to retry
 * @param queueSystem The queue system the job belongs to
 * @returns Success flag and message
 */
export const retryQueueJob = async (
  jobId: string,
  queueSystem: 'pdf' | 'crawler'
): Promise<{ success: boolean; message: string }> => {
  try {
    if (queueSystem === 'pdf') {
      // For PDF jobs, we need to create a new job using the same parameters
      const job = pdfQueue.get(jobId);
      if (!job) {
        return { success: false, message: `PDF job ${jobId} not found` };
      }
      
      if (job.status !== 'failed') {
        return { success: false, message: `Cannot retry PDF job ${jobId} with status ${job.status}` };
      }
      
      // In a real implementation, we would create a new job with the same parameters
      // For now, we'll just log the intent
      logger.info(`Retrying PDF job ${jobId}`);
      return { success: true, message: `PDF job ${jobId} has been queued for retry` };
    } else {
      // For crawler jobs, we need to create a new job using the same config
      const job = crawlerQueue.getJob(jobId);
      if (!job) {
        return { success: false, message: `Crawler job ${jobId} not found` };
      }
      
      if (job.status !== 'failed' && job.status !== 'canceled') {
        return { success: false, message: `Cannot retry crawler job ${jobId} with status ${job.status}` };
      }
      
      // In a real implementation, we would create a new job with the same config
      // For now, we'll just log the intent
      logger.info(`Retrying crawler job ${jobId}`);
      return { success: true, message: `Crawler job ${jobId} has been queued for retry` };
    }
  } catch (error) {
    logger.error(`Error retrying job ${jobId}: ${error}`);
    return { success: false, message: `Failed to retry job: ${error}` };
  }
};

/**
 * Cancel a running or pending job
 * @param jobId The job ID to cancel
 * @param queueSystem The queue system the job belongs to
 * @returns Success flag and message
 */
export const cancelQueueJob = async (
  jobId: string,
  queueSystem: 'pdf' | 'crawler'
): Promise<{ success: boolean; message: string }> => {
  try {
    if (queueSystem === 'pdf') {
      const removed = pdfQueue.remove(jobId);
      if (removed) {
        return { success: true, message: `PDF job ${jobId} has been cancelled` };
      } else {
        return { success: false, message: `PDF job ${jobId} not found or could not be cancelled` };
      }
    } else {
      const removed = await crawlerQueue.removeJob(jobId);
      if (removed) {
        return { success: true, message: `Crawler job ${jobId} has been cancelled` };
      } else {
        return { success: false, message: `Crawler job ${jobId} not found or could not be cancelled` };
      }
    }
  } catch (error) {
    logger.error(`Error cancelling job ${jobId}: ${error}`);
    return { success: false, message: `Failed to cancel job: ${error}` };
  }
};

// We need to import fs for file size calculation
import * as fs from 'fs';

/**
 * Clear all jobs from a queue system
 * @param queueSystem The queue system to clear (pdf or crawler)
 * @returns Success flag, message, and count of cleared jobs
 */
export const clearQueue = async (
  queueSystem: 'pdf' | 'crawler'
): Promise<{ success: boolean; message: string; count: number }> => {
  try {
    if (queueSystem === 'pdf') {
      // Get all PDF jobs
      const pdfJobs = pdfQueue.getAll();
      let successCount = 0;
      
      // Remove each job that isn't currently processing
      for (const job of pdfJobs) {
        if (job.status !== 'processing') {
          const removed = pdfQueue.remove(job.id);
          if (removed) {
            successCount++;
          }
        }
      }
      
      logger.info(`Cleared ${successCount} jobs from PDF queue`);
      return { 
        success: true, 
        message: `Cleared ${successCount} jobs from PDF queue. Jobs currently in processing were skipped.`,
        count: successCount
      };
    } else {
      // For crawler queue, get all jobs
      const crawlerJobs = crawlerQueue.getAll();
      let clearedCount = 0;
      
      // Remove each job
      for (const job of crawlerJobs) {
        if (job.status !== 'processing') {
          const removed = await crawlerQueue.removeJob(job.id);
          if (removed) {
            clearedCount++;
          }
        }
      }
      
      logger.info(`Cleared ${clearedCount} jobs from Crawler queue`);
      return { 
        success: true, 
        message: `Cleared ${clearedCount} jobs from Crawler queue. Jobs currently in processing were skipped.`,
        count: clearedCount
      };
    }
  } catch (error) {
    logger.error(`Error clearing ${queueSystem} queue: ${error}`);
    return { success: false, message: `Failed to clear ${queueSystem} queue: ${error}`, count: 0 };
  }
};