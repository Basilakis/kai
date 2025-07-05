/**
 * Search Index Processing Queue
 * 
 * This module provides a persistent queue system for search index jobs,
 * supporting prioritization, concurrency control, and error recovery.
 */

import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger';
import { QueueAdapter } from '../messaging/queueAdapter';
import { supabaseClient } from '../../../../shared/src/services/supabase/supabaseClient';

// TypeScript interfaces to replace MongoDB schema types
interface SearchIndexDocument {
  id: string;
  name: string;
  type: 'text' | 'vector' | 'hybrid';
  entityType: string;
  categoryId?: string;
  config: {
    fields?: string[];
    vectorDimensions?: number;
    similarity?: string;
    [key: string]: any;
  };
  status: 'active' | 'inactive' | 'building' | 'error';
  createdAt: string;
  updatedAt: string;
  lastIndexedAt?: string;
  documentCount?: number;
  metadata?: Record<string, any>;
}

// Queue Job Status Types
export type IndexJobStatus = 
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'retrying';

// Priority Levels
export type JobPriority = 'low' | 'normal' | 'high';

// Index Job Types
export type IndexJobType = 
  | 'update'     // Update an existing index for a specific entity
  | 'rebuild'    // Rebuild an entire index
  | 'create';    // Create a new index

// Queue Job Interface
export interface IndexQueueJob {
  id: string;
  indexId: string;
  entityType: string;
  entityId?: string; // Optional for rebuild jobs
  jobType: IndexJobType;
  status: IndexJobStatus;
  priority: JobPriority;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  attempts: number;
  maxAttempts: number;
  error?: string;
  progress?: {
    total?: number;
    processed?: number;
    indexed?: number;
  };
}

// Queue Configuration
export interface QueueConfig {
  maxConcurrent: number;
  retryDelay: number;
  maxAttempts: number;
  persistPath: string;
  completedJobRetention: number; // In milliseconds
}

/**
 * Create a system queue adapter
 * @returns System queue adapter
 */
export const createSystemQueueAdapter = (): QueueAdapter => {
  return new QueueAdapter('system', 'System Queue');
};

/**
 * Search Index Processing Queue
 */
export class SearchIndexQueue {
  private jobs: Map<string, IndexQueueJob> = new Map();
  private processingJobs: Set<string> = new Set();
  private config: QueueConfig;
  private persistInterval: NodeJS.Timeout | null = null;
  private processInterval: NodeJS.Timeout | null = null;
  private isProcessing: boolean = false;
  private adapter: QueueAdapter;

  /**
   * Create a new Search Index Queue
   * @param config Queue configuration
   */
  constructor(config?: Partial<QueueConfig>) {
    // Initialize the queue adapter
    this.adapter = createSystemQueueAdapter();
    
    // Default configuration
    this.config = {
      maxConcurrent: 2,
      retryDelay: 30000, // 30 seconds
      maxAttempts: 3,
      persistPath: path.join('.', 'data', 'search-index-queue'), 
      completedJobRetention: 3 * 24 * 60 * 60 * 1000, // 3 days
      ...config
    };

    // Create persist directory if it doesn't exist
    if (!fs.existsSync(this.config.persistPath)) {
      fs.mkdirSync(this.config.persistPath, { recursive: true });
    }

    // Restore queue state
    this.restore();

    // Start persistence interval
    this.persistInterval = setInterval(() => this.persist(), 30000);

    // Start processing interval
    this.processInterval = setInterval(() => this.processNextBatch(), 1000);
    
    logger.info('Search Index Queue initialized');
  }

  /**
   * Add an index update job to the queue
   * 
   * @param indexId The ID of the search index
   * @param entityType Entity type (e.g., 'material')
   * @param entityId Entity ID to update in the index
   * @param options Additional options
   * @returns Job ID
   */
  public async addUpdateJob(
    indexId: string,
    entityType: string,
    entityId: string,
    options?: {
      priority?: JobPriority;
    }
  ): Promise<string> {
    // Validate index exists
    const { data: index, error } = await supabaseClient.getClient()
      .from('search_indexes')
      .select('*')
      .eq('id', indexId)
      .single();
    
    if (error || !index) {
      throw new Error(`Search index not found: ${indexId}`);
    }

    // Create new job
    const jobId = uuidv4();
    const job: IndexQueueJob = {
      id: jobId,
      indexId,
      entityType,
      entityId,
      jobType: 'update',
      status: 'pending',
      priority: options?.priority || 'normal',
      createdAt: new Date(),
      attempts: 0,
      maxAttempts: this.config.maxAttempts,
      progress: {
        total: 1,
        processed: 0,
        indexed: 0
      }
    };

    // Add job to queue
    this.jobs.set(jobId, job);

    // Persist queue state
    await this.persist();

    logger.info(`Added index update job to queue: ${indexId} for ${entityType}/${entityId} (Job ID: ${jobId})`);
    
    // Publish job-added event
    await this.adapter.publishJobAdded({
      id: jobId,
      status: 'pending',
      priority: job.priority,
      indexId: job.indexId,
      entityType: job.entityType,
      entityId: job.entityId,
      jobType: job.jobType
    });
    
    return jobId;
  }

  /**
   * Add an index rebuild job to the queue
   * 
   * @param indexId The ID of the search index
   * @param options Additional options
   * @returns Job ID
   */
  public async addRebuildJob(
    indexId: string,
    options?: {
      priority?: JobPriority;
    }
  ): Promise<string> {
    // Validate index exists
    const { data: index, error } = await supabaseClient.getClient()
      .from('search_indexes')
      .select('*')
      .eq('id', indexId)
      .single();
    
    if (error || !index) {
      throw new Error(`Search index not found: ${indexId}`);
    }

    // Create new job
    const jobId = uuidv4();
    const job: IndexQueueJob = {
      id: jobId,
      indexId,
      entityType: index.entityType,
      jobType: 'rebuild',
      status: 'pending',
      priority: options?.priority || 'normal',
      createdAt: new Date(),
      attempts: 0,
      maxAttempts: this.config.maxAttempts,
      progress: {
        total: 0, // Will be set during processing
        processed: 0,
        indexed: 0
      }
    };

    // Add job to queue
    this.jobs.set(jobId, job);

    // Persist queue state
    await this.persist();

    logger.info(`Added index rebuild job to queue: ${indexId} for ${index.entityType} (Job ID: ${jobId})`);
    
    // Publish job-added event
    await this.adapter.publishJobAdded({
      id: jobId,
      status: 'pending',
      priority: job.priority,
      indexId: job.indexId,
      entityType: job.entityType,
      jobType: job.jobType
    });
    
    return jobId;
  }

  /**
   * Add a create index job to the queue
   * 
   * @param indexData Search index data
   * @param options Additional options
   * @returns Job ID
   */
  public async addCreateJob(
    indexData: Partial<SearchIndexDocument>,
    options?: {
      priority?: JobPriority;
    }
  ): Promise<string> {
    // Validate required fields
    if (!indexData.name || !indexData.entityType || !indexData.type) {
      throw new Error('Index name, entityType, and type are required');
    }

    // Create a temporary ID for the index (will be replaced during processing)
    const tempIndexId = uuidv4();

    // Create new job
    const jobId = uuidv4();
    const job: IndexQueueJob = {
      id: jobId,
      indexId: tempIndexId,
      entityType: indexData.entityType,
      jobType: 'create',
      status: 'pending',
      priority: options?.priority || 'normal',
      createdAt: new Date(),
      attempts: 0,
      maxAttempts: this.config.maxAttempts,
      progress: {
        total: 0, // Will be set during processing
        processed: 0,
        indexed: 0
      }
    };

    // Store index data with the job (as an additional field)
    (job as any).indexData = indexData;

    // Add job to queue
    this.jobs.set(jobId, job);

    // Persist queue state
    await this.persist();

    logger.info(`Added create index job to queue: ${indexData.name} for ${indexData.entityType} (Job ID: ${jobId})`);
    
    // Publish job-added event
    await this.adapter.publishJobAdded({
      id: jobId,
      status: 'pending',
      priority: job.priority,
      entityType: job.entityType,
      jobType: job.jobType,
      indexName: indexData.name
    });
    
    return jobId;
  }

  /**
   * Get a job by ID
   * 
   * @param jobId Job ID
   * @returns Job object or null if not found
   */
  public get(jobId: string): IndexQueueJob | null {
    return this.jobs.get(jobId) || null;
  }

  /**
   * Get all jobs in the queue
   * 
   * @param status Optional status filter
   * @returns Array of jobs
   */
  public getAll(status?: IndexJobStatus): IndexQueueJob[] {
    const jobs = Array.from(this.jobs.values());
    
    if (status) {
      return jobs.filter(job => job.status === status);
    }
    
    return jobs;
  }

  /**
   * Get job counts by status
   * 
   * @returns Object with counts for each status
   */
  public getCounts(): Record<IndexJobStatus, number> {
    const counts: Record<IndexJobStatus, number> = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      retrying: 0
    };

    for (const job of this.jobs.values()) {
      counts[job.status]++;
    }

    return counts;
  }

  /**
   * Remove a job from the queue
   * 
   * @param jobId Job ID
   * @returns true if job was removed, false if not found
   */
  public remove(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    
    if (!job) {
      return false;
    }

    // If job is processing, we can't remove it yet
    if (job.status === 'processing') {
      return false;
    }

    // Remove job
    this.jobs.delete(jobId);
    
    // Remove job file
    const jobFile = path.join(this.config.persistPath, `${jobId}.json`);
    if (fs.existsSync(jobFile)) {
      fs.unlinkSync(jobFile);
    }

    logger.info(`Removed job from search index queue: ${jobId}`);
    return true;
  }

  /**
   * Clean up completed and failed jobs older than the retention period
   * 
   * @returns Number of jobs removed
   */
  public cleanup(): number {
    let removedCount = 0;
    const now = Date.now();
    const retentionCutoff = now - this.config.completedJobRetention;

    for (const [jobId, job] of this.jobs.entries()) {
      if (
        (job.status === 'completed' || job.status === 'failed') &&
        job.completedAt &&
        job.completedAt.getTime() < retentionCutoff
      ) {
        this.jobs.delete(jobId);
        removedCount++;

        // Remove job file
        const jobFile = path.join(this.config.persistPath, `${jobId}.json`);
        if (fs.existsSync(jobFile)) {
          fs.unlinkSync(jobFile);
        }
      }
    }

    if (removedCount > 0) {
      logger.info(`Cleaned up ${removedCount} old jobs from search index queue`);
    }

    return removedCount;
  }

  /**
   * Pause queue processing
   */
  public pause(): void {
    this.isProcessing = false;
    logger.info('Search index processing queue paused');
  }

  /**
   * Resume queue processing
   */
  public resume(): void {
    this.isProcessing = true;
    logger.info('Search index processing queue resumed');
    this.processNextBatch();
  }

  /**
   * Shutdown the queue gracefully
   */
  public async shutdown(): Promise<void> {
    logger.info('Shutting down search index processing queue...');
    
    // Stop intervals
    if (this.persistInterval) {
      clearInterval(this.persistInterval);
      this.persistInterval = null;
    }
    
    if (this.processInterval) {
      clearInterval(this.processInterval);
      this.processInterval = null;
    }

    // Pause processing
    this.isProcessing = false;

    // Wait for processing jobs to complete
    if (this.processingJobs.size > 0) {
      logger.info(`Waiting for ${this.processingJobs.size} jobs to complete...`);
      // Wait for a maximum of 10 seconds
      const maxWaitTime = 10000;
      const startTime = Date.now();
      
      while (this.processingJobs.size > 0 && Date.now() - startTime < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Unsubscribe from all message broker events
    await this.adapter.unsubscribeAll();

    // Final persist
    await this.persist();
    logger.info('Search index processing queue shutdown complete');
  }

  /**
   * Process the next batch of jobs
   */
  private async processNextBatch(): Promise<void> {
    if (!this.isProcessing) {
      return;
    }

    // Check if we can process more jobs
    const availableSlots = this.config.maxConcurrent - this.processingJobs.size;
    if (availableSlots <= 0) {
      return;
    }

    // Get pending jobs sorted by priority
    const pendingJobs = Array.from(this.jobs.values())
      .filter(job => job.status === 'pending' || job.status === 'retrying')
      .sort((a, b) => {
        // Sort by priority first (high > normal > low)
        const priorityOrder: Record<JobPriority, number> = { high: 0, normal: 1, low: 2 };
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) {
          return priorityDiff;
        }
        
        // Then by creation date (oldest first)
        return a.createdAt.getTime() - b.createdAt.getTime();
      });

    // Process up to availableSlots jobs
    const jobsToProcess = pendingJobs.slice(0, availableSlots);
    
    for (const job of jobsToProcess) {
      this.processJob(job.id).catch(err => {
        logger.error(`Error processing job ${job.id}: ${err}`);
      });
    }
  }

  /**
   * Process a single job
   * 
   * @param jobId Job ID
   */
  private async processJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      return;
    }

    // Update job status
    job.status = 'processing';
    job.startedAt = new Date();
    job.attempts++;
    this.processingJobs.add(jobId);

    // Persist job state
    await this.persistJob(job);

    logger.info(`Processing index job ${jobId}: ${job.jobType} for ${job.entityType} (Attempt ${job.attempts}/${job.maxAttempts})`);
    
    // Publish job-started event
    await this.adapter.publishJobStarted({
      id: jobId,
      status: 'processing',
      priority: job.priority,
      indexId: job.indexId,
      entityType: job.entityType,
      jobType: job.jobType,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts
    });

    try {
      // Process job based on type
      switch (job.jobType) {
        case 'update':
          await this.processUpdateJob(job);
          break;
        case 'rebuild':
          await this.processRebuildJob(job);
          break;
        case 'create':
          await this.processCreateJob(job);
          break;
        default:
          throw new Error(`Unknown job type: ${job.jobType}`);
      }

      // Update job status
      job.status = 'completed';
      job.completedAt = new Date();

      logger.info(`Completed index job ${jobId} (${job.jobType})`);
      
      // Publish job-completed event
      await this.adapter.publishJobCompleted({
        id: jobId,
        status: 'completed',
        priority: job.priority,
        indexId: job.indexId,
        entityType: job.entityType,
        jobType: job.jobType,
        progress: 100
      });
    } catch (err) {
      // Handle job failure
      job.error = err instanceof Error ? err.message : String(err);
      logger.error(`Failed to process index job ${jobId}: ${job.error}`);
      
      // Publish job-failed event
      await this.adapter.publishJobFailed({
        id: jobId,
        status: job.attempts < job.maxAttempts ? 'retrying' : 'failed',
        priority: job.priority,
        indexId: job.indexId,
        entityType: job.entityType,
        jobType: job.jobType,
        attempts: job.attempts,
        maxAttempts: job.maxAttempts,
        error: job.error
      });

      // Check if we should retry
      if (job.attempts < job.maxAttempts) {
        job.status = 'retrying';
        logger.info(`Will retry index job ${jobId} in ${this.config.retryDelay / 1000} seconds`);
        
        // Schedule retry after delay
        setTimeout(() => {
          // Only retry if the job is still in retrying state
          const updatedJob = this.jobs.get(jobId);
          if (updatedJob && updatedJob.status === 'retrying') {
            this.processJob(jobId).catch(err => {
              logger.error(`Error processing job ${jobId}: ${err}`);
            });
          }
        }, this.config.retryDelay);
      } else {
        job.status = 'failed';
        job.completedAt = new Date();
        logger.error(`Index job ${jobId} failed after ${job.attempts} attempts`);
      }
    } finally {
      // Remove job from processing set
      this.processingJobs.delete(jobId);
      
      // Persist job state
      await this.persistJob(job);
    }
  }

  /**
   * Process an update job
   * 
   * @param job Job to process
   */
  private async processUpdateJob(job: IndexQueueJob): Promise<void> {
    if (!job.entityId) {
      throw new Error('Entity ID is required for update jobs');
    }

    // Get the search index
    const { data: index, error: indexError } = await supabaseClient.getClient()
      .from('search_indexes')
      .select('*')
      .eq('id', job.indexId)
      .single();
    
    if (indexError || !index) {
      throw new Error(`Search index not found: ${job.indexId}`);
    }

    // Get entity data from the appropriate table
    const entityTableName = job.entityType.toLowerCase() + 's'; // Convert entityType to table name
    const { data: entity, error: _entityError } = await supabaseClient.getClient()
      .from(entityTableName)
      .select('*')
      .eq('id', job.entityId)
      .single();
    
    if (!entity) {
      throw new Error(`Entity not found: ${job.entityId}`);
    }

    // Update progress
    job.progress = {
      total: 1,
      processed: 1,
      indexed: 0
    };
    await this.persistJob(job);
    
    // Publish progress
    await this.adapter.publishJobProgress({
      id: job.id,
      status: 'processing',
      priority: job.priority,
      indexId: job.indexId,
      entityType: job.entityType,
      entityId: job.entityId,
      progress: 50
    });

    // Process entity based on index type
    switch (index.indexType) {
      case 'text':
        await this.updateTextIndex(index, entity);
        break;
      case 'vector':
        await this.updateVectorIndex(index, entity);
        break;
      default:
        throw new Error(`Unsupported index type: ${index.indexType}`);
    }

    // Update index status
    const { error: updateError } = await supabaseClient.getClient()
      .from('search_indexes')
      .update({
        lastUpdateTime: new Date().toISOString()
        // Note: documentCount remains unchanged for updates
      })
      .eq('id', job.indexId);

    if (updateError) {
      throw new Error(`Failed to update search index status: ${updateError.message}`);
    }

    // Update progress
    job.progress.indexed = 1;
    await this.persistJob(job);
    
    // Publish progress
    await this.adapter.publishJobProgress({
      id: job.id,
      status: 'processing',
      priority: job.priority,
      indexId: job.indexId,
      entityType: job.entityType,
      entityId: job.entityId,
      progress: 100
    });
  }

  /**
   * Process a rebuild job
   *
   * @param job Job to process
   */
  private async processRebuildJob(job: IndexQueueJob): Promise<void> {
    // Get the search index
    const { data: index, error: indexError } = await supabaseClient.getClient()
      .from('search_indexes')
      .select('*')
      .eq('id', job.indexId)
      .single();

    if (indexError || !index) {
      throw new Error(`Search index not found: ${job.indexId}`);
    }

    // Update index status to building
    const { error: updateError } = await supabaseClient.getClient()
      .from('search_indexes')
      .update({
        status: 'building',
        lastUpdateTime: new Date().toISOString()
      })
      .eq('id', job.indexId);

    if (updateError) {
      throw new Error(`Failed to update search index status: ${updateError.message}`);
    }

    // Get entity table name
    const tableName = job.entityType.toLowerCase() + 's';
    
    // Count entities using proper Supabase count syntax
    const { count, error: countError } = await supabaseClient.getClient()
      .from(tableName)
      .select('id')
      .then(({ data, error }) => ({ count: data?.length || 0, error }));

    if (countError) {
      throw new Error(`Failed to count entities in table ${tableName}: ${countError.message}`);
    }

    const totalEntities = count || 0;
    
    // Update progress
    job.progress = {
      total: totalEntities,
      processed: 0,
      indexed: 0
    };
    await this.persistJob(job);
    
    // Publish progress
    await this.adapter.publishJobProgress({
      id: job.id,
      status: 'processing',
      priority: job.priority,
      indexId: job.indexId,
      entityType: job.entityType,
      progress: 0,
      total: totalEntities
    });

    // Process entities in batches to avoid memory issues
    const batchSize = 100;
    let processedCount = 0;
    let indexedCount = 0;
    
    // Determine how many batches we need
    const batchCount = Math.ceil(totalEntities / batchSize);
    
    for (let batchIndex = 0; batchIndex < batchCount; batchIndex++) {
      // Get a batch of entities with pagination
      const startIndex = batchIndex * batchSize;
      const endIndex = startIndex + batchSize - 1;
      
      const { data: entities, error: entitiesError } = await supabaseClient.getClient()
        .from(tableName)
        .select('*')
        .range(startIndex, endIndex);
      
      if (entitiesError) {
        throw new Error(`Failed to fetch entities: ${entitiesError.message}`);
      }
      
      // Process each entity in the batch
      for (const entity of entities || []) {
        try {
          // Process entity based on index type
          switch (index.indexType) {
            case 'text':
              await this.updateTextIndex(index, entity);
              break;
            case 'vector':
              await this.updateVectorIndex(index, entity);
              break;
            default:
              throw new Error(`Unsupported index type: ${index.indexType}`);
          }
          
          indexedCount++;
        } catch (err) {
          logger.error(`Error processing entity ${entity.id}: ${err}`);
          // Continue with next entity
        }
        
        processedCount++;
        
        // Update progress periodically (every 10 entities)
        if (processedCount % 10 === 0) {
          job.progress = {
            total: totalEntities,
            processed: processedCount,
            indexed: indexedCount
          };
          await this.persistJob(job);
          
          // Publish progress
          await this.adapter.publishJobProgress({
            id: job.id,
            status: 'processing',
            priority: job.priority,
            indexId: job.indexId,
            entityType: job.entityType,
            progress: Math.round((processedCount / totalEntities) * 100),
            processed: processedCount,
            total: totalEntities
          });
        }
      }
    }

    // Update index status to ready
    const { error: finalUpdateError } = await supabaseClient.getClient()
      .from('search_indexes')
      .update({
        status: 'ready',
        last_build_time: new Date().toISOString(),
        last_update_time: new Date().toISOString(),
        document_count: indexedCount
      })
      .eq('id', job.indexId);

    if (finalUpdateError) {
      throw new Error(`Failed to update search index: ${finalUpdateError.message}`);
    }

    // Final progress update
    job.progress = {
      total: totalEntities,
      processed: processedCount,
      indexed: indexedCount
    };
    await this.persistJob(job);
    
    // Publish final progress
    await this.adapter.publishJobProgress({
      id: job.id,
      status: 'processing',
      priority: job.priority,
      indexId: job.indexId,
      entityType: job.entityType,
      progress: 100,
      processed: processedCount,
      total: totalEntities
    });
  }

  /**
   * Process a create job
   * 
   * @param job Job to process
   */
  private async processCreateJob(job: IndexQueueJob): Promise<void> {
    // Get the index data from the job
    const indexData = (job as any).indexData as Partial<SearchIndexDocument>;
    if (!indexData) {
      throw new Error('Index data not found in job');
    }

    // Create the search index
    const indexId = uuidv4();
    const { data: searchIndex, error: createError } = await supabaseClient.getClient()
      .from('search_indexes')
      .insert({
        id: indexId,
        name: indexData.name,
        entity_type: indexData.entityType,
        type: indexData.type,
        status: 'building',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        document_count: 0,
        config: indexData.config || {},
        metadata: indexData.metadata || {}
      })
      .select()
      .single();

    if (createError) {
      throw new Error(`Failed to create search index: ${createError.message}`);
    }

    // Update the job with the new index ID
    job.indexId = indexId;
    await this.persistJob(job);
    
    // Publish progress
    await this.adapter.publishJobProgress({
      id: job.id,
      status: 'processing',
      priority: job.priority,
      indexId: job.indexId,
      entityType: job.entityType,
      progress: 10
    });

    // Now perform a full build of the index (similar to rebuild job)
    // Get table name for entity type
    const tableName = job.entityType.toLowerCase() + 's';
    
    // Count entities using Supabase
    const { count, error: countError } = await supabaseClient.getClient()
      .from(tableName)
      .select('*', { count: 'exact', head: true });

    if (countError) {
      throw new Error(`Failed to count entities: ${countError.message}`);
    }

    const totalEntities = count || 0;
    
    // Update progress
    job.progress = {
      total: totalEntities,
      processed: 0,
      indexed: 0
    };
    await this.persistJob(job);
    
    // Publish progress
    await this.adapter.publishJobProgress({
      id: job.id,
      status: 'processing',
      priority: job.priority,
      indexId: job.indexId,
      entityType: job.entityType,
      progress: 20,
      total: totalEntities
    });

    // Process entities in batches
    const batchSize = 100;
    let processedCount = 0;
    let indexedCount = 0;
    
    // Determine how many batches we need
    const batchCount = Math.ceil(totalEntities / batchSize);
    
    for (let batchIndex = 0; batchIndex < batchCount; batchIndex++) {
      // Get a batch of entities
      const { data: entities, error: entitiesError } = await supabaseClient.getClient()
        .from(tableName)
        .select('*');
      
      if (entitiesError) {
        throw new Error(`Failed to fetch entities: ${entitiesError.message}`);
      }
      
      // Process each entity in the batch
      for (const entity of entities) {
        try {
          // Process entity based on index type
          switch (searchIndex.indexType) {
            case 'text':
              await this.updateTextIndex(searchIndex, entity);
              break;
            case 'vector':
              await this.updateVectorIndex(searchIndex, entity);
              break;
            default:
              throw new Error(`Unsupported index type: ${searchIndex.indexType}`);
          }
          
          indexedCount++;
        } catch (err) {
          logger.error(`Error processing entity ${entity.id}: ${err}`);
          // Continue with next entity
        }
        
        processedCount++;
        
        // Update progress periodically (every 10 entities)
        if (processedCount % 10 === 0) {
          job.progress = {
            total: totalEntities,
            processed: processedCount,
            indexed: indexedCount
          };
          await this.persistJob(job);
          
          // Calculate progress from 20 to 90 percent
          const progressPercent = 20 + Math.round((processedCount / totalEntities) * 70);
          
          // Publish progress
          await this.adapter.publishJobProgress({
            id: job.id,
            status: 'processing',
            priority: job.priority,
            indexId: job.indexId,
            entityType: job.entityType,
            progress: progressPercent,
            processed: processedCount,
            total: totalEntities
          });
        }
      }
    }

    // Update index status to ready
    const { error: finalUpdateError } = await supabaseClient.getClient()
      .from('search_indexes')
      .update({
        status: 'ready',
        last_build_time: new Date().toISOString(),
        last_update_time: new Date().toISOString(),
        document_count: indexedCount
      })
      .eq('id', job.indexId);

    if (finalUpdateError) {
      throw new Error(`Failed to update search index status: ${finalUpdateError.message}`);
    }

    // Final progress update
    job.progress = {
      total: totalEntities,
      processed: processedCount,
      indexed: indexedCount
    };
    await this.persistJob(job);
    
    // Publish final progress
    await this.adapter.publishJobProgress({
      id: job.id,
      status: 'processing',
      priority: job.priority,
      indexId: job.indexId,
      entityType: job.entityType,
      progress: 100,
      processed: processedCount,
      total: totalEntities
    });
  }

  /**
   * Update a text index with an entity
   * 
   * @param index Search index
   * @param entity Entity to process
   */
  private async updateTextIndex(index: SearchIndexDocument, entity: any): Promise<void> {
    logger.debug(`Updating text index ${index.id} with entity ${entity.id}`);
    
    // This is a simplified implementation - in a real system, you'd:
    // 1. Extract text from relevant entity fields
    // 2. Process and normalize the text (stemming, stop words, etc.)
    // 3. Update the index storage (could be MongoDB text index, Elasticsearch, etc.)
    
    // For this implementation, we'll assume MongoDB text indexes are used
    // and have been set up via schema configuration
    
    // Assuming text index is maintained by MongoDB itself
    // No explicit update needed here, as MongoDB will update its text indexes automatically
    // when documents change
    
    // In a more complex implementation, you might:
    // 1. Extract the text from the entity
    // 2. Send it to a dedicated search service
    // 3. Track the indexing in a separate collection
  }

  /**
   * Update a vector index with an entity
   * 
   * @param index Search index
   * @param entity Entity to process
   */
  private async updateVectorIndex(index: SearchIndexDocument, entity: any): Promise<void> {
    logger.debug(`Updating vector index ${index.id} with entity ${entity.id}`);
    
    // This is a simplified implementation - in a real system, you'd:
    // 1. Extract relevant text from entity fields
    // 2. Generate embeddings for the text (using an AI model)
    // 3. Store the embeddings in a vector database
    
    // For this implementation, we'll assume entity.embedding exists
    // or needs to be generated and stored
    
    // Generate embedding if needed
    // In a real implementation, this would call an embedding service
    if (!entity.embedding) {
      // Here we would make a call to an AI service to generate embeddings
      // For simplicity, we'll just log this step
      logger.debug(`Generating embedding for entity ${entity.id}`);
      
      // In a real implementation:
      // 1. Extract text from the entity (e.g., name, description, tags)
      // 2. Call an embedding service (like OpenAI, TensorFlow, etc.)
      // 3. Store the result in the entity
      
      // const text = `${entity.name} ${entity.description} ${entity.tags?.join(' ')}`;
      // const embedding = await embeddingService.generateEmbedding(text);
      // await Model.updateOne({ id: entity.id }, { embedding });
    }
    
    // In a more complete implementation, you would:
    // 1. Store the embedding in a vector database
    // 2. Update index metadata (counts, etc.)
  }

  /**
   * Persist the queue state to disk
   */
  private async persist(): Promise<void> {
    try {
      // Persist each job to its own file
      for (const job of this.jobs.values()) {
        await this.persistJob(job);
      }

      logger.debug(`Persisted search index queue state: ${this.jobs.size} jobs`);
    } catch (err) {
      logger.error(`Failed to persist search index queue state: ${err}`);
    }
  }

  /**
   * Persist a single job to disk
   * 
   * @param job Job to persist
   */
  private async persistJob(job: IndexQueueJob): Promise<void> {
    try {
      const jobFile = path.join(this.config.persistPath, `${job.id}.json`);
      const jobJson = JSON.stringify(job, null, 2);
      fs.writeFileSync(jobFile, jobJson);
    } catch (err) {
      logger.error(`Failed to persist job ${job.id}: ${err}`);
    }
  }

  /**
   * Restore queue state from disk
   */
  private restore(): void {
    try {
      // Ensure the persist directory exists
      if (!fs.existsSync(this.config.persistPath)) {
        fs.mkdirSync(this.config.persistPath, { recursive: true });
        logger.info(`Created search index queue persist directory: ${this.config.persistPath}`);
        this.isProcessing = true;
        return;
      }
      
      // Get all job files
      const files = fs.readdirSync(this.config.persistPath);
      const jobFiles = files.filter(file => file.endsWith('.json'));

      // Restore each job
      for (const file of jobFiles) {
        try {
          const jobFile = path.join(this.config.persistPath, file);
          const jobJson = fs.readFileSync(jobFile, 'utf-8').toString();
          const job = JSON.parse(jobJson) as IndexQueueJob;

          // Convert date strings back to Date objects
          job.createdAt = new Date(job.createdAt);
          if (job.startedAt) job.startedAt = new Date(job.startedAt);
          if (job.completedAt) job.completedAt = new Date(job.completedAt);

          // Reset processing jobs to retrying
          if (job.status === 'processing') {
            job.status = 'retrying';
          }

          // Add job to queue
          this.jobs.set(job.id, job);
        } catch (err) {
          logger.error(`Failed to restore job from ${file}: ${err}`);
        }
      }

      logger.info(`Restored search index queue state: ${this.jobs.size} jobs`);
      
      // Start processing
      this.isProcessing = true;
    } catch (err) {
      logger.error(`Failed to restore search index queue state: ${err}`);
      // Start processing anyway
      this.isProcessing = true;
    }
  }
}

// Create a singleton instance
export const searchIndexQueue = new SearchIndexQueue();

// Export default instance
export default searchIndexQueue;