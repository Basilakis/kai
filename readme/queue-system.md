# Queue System

The Queue System is a critical component of Kai that manages asynchronous processing tasks using Supabase Realtime for message brokering. This document details the architecture, components, and usage of the queue system.

## Overview

The Queue System provides:

1. **Asynchronous Processing**: Handle time-consuming tasks without blocking user operations
2. **Prioritization**: Process critical tasks ahead of less important ones
3. **Resource Management**: Control resource allocation for different processing tasks
4. **Status Tracking**: Monitor job progress and status in real time
5. **Error Handling**: Robust error recovery and retry mechanisms
6. **Cross-Service Communication**: Coordinate workflows across different services

## Architecture

The Queue System uses a message broker architecture with Supabase Realtime:

```
┌───────────────┐     ┌───────────────────┐     ┌───────────────┐
│               │     │                   │     │               │
│  Client Apps  │────▶│  Message Broker   │────▶│  PDF Queue    │
│               │     │  (Supabase)       │     │               │
└───────────────┘     └───────────────────┘     └───────────────┘
        │                      │                        │
        │                      │                        ▼
        │                      │               ┌───────────────┐
        │                      │               │               │
        ▼                      ▼               │  PDF Worker   │
┌───────────────┐     ┌───────────────────┐    │               │
│               │     │                   │    └───────────────┘
│  Admin Panel  │────▶│  Queue Events     │             │
│               │     │                   │             │
└───────────────┘     └───────────────────┘             ▼
                               │              ┌───────────────┐
                               │              │               │
                               ▼              │  Knowledge    │
                      ┌───────────────────┐   │  Base Import  │
                      │                   │   │               │
                      │  Crawler Queue    │   └───────────────┘
                      │                   │
                      └───────────────────┘
                               │
                               ▼
                      ┌───────────────────┐
                      │                   │
                      │  Crawler Worker   │
                      │                   │
                      └───────────────────┘
```

### Core Components

1. **Supabase Client**
   - Manages connections to Supabase Realtime
   - Handles authentication and authorization
   - Provides reconnection and error handling
   - Manages subscription lifecycle

2. **Message Broker**
   - Core routing component for pub/sub messaging
   - Handles message delivery and confirmation
   - Supports multiple channels for different message types
   - Provides delivery guarantees

3. **Queue Adapters**
   - Standardize interface between queues and message broker
   - Convert queue-specific events to standard message format
   - Handle queue-specific processing requirements
   - Implement queue persistence and state management

4. **Queue Workers**
   - Process jobs from specific queues
   - Report progress and status updates
   - Handle resource allocation
   - Implement error recovery

5. **Event Handlers**
   - Process events from other queues
   - Trigger dependent workflows
   - Update system state based on events
   - Propagate event notifications

## Queue Types

The system includes several specialized queues:

### PDF Processing Queue

Handles the processing of PDF catalogs:

1. **Features**
   - Multi-stage processing pipeline
   - Progress tracking for each stage
   - Automatic retry for failed stages
   - Result storage and notification

2. **Job Lifecycle**
   - Submission: PDF uploaded and job created
   - Queuing: Job prioritized and scheduled
   - Processing: Multi-stage PDF extraction
   - Completion: Results stored and notifications sent
   - (Optional) Error recovery: Automatic retries or manual intervention

3. **Events Published**
   - `pdf.job.queued`: Job has been queued
   - `pdf.job.started`: Processing has started
   - `pdf.job.progress`: Progress update (percentage, current stage)
   - `pdf.job.completed`: Processing completed successfully
   - `pdf.job.failed`: Processing failed
   - `pdf.job.materials.extracted`: Materials were extracted and are ready for import

### Web Crawler Queue

Manages web crawling jobs:

1. **Features**
   - Multiple crawler provider support
   - Credential management for authenticated sites
   - Rate limiting to respect website policies
   - Incremental crawling capabilities

2. **Job Lifecycle**
   - Configuration: Crawler settings defined
   - Scheduling: Job scheduled with priority
   - Initialization: Crawler setup and authentication
   - Crawling: Website traversal and data extraction
   - Completion: Data processed and notifications sent

3. **Events Published**
   - `crawler.job.queued`: Job has been queued
   - `crawler.job.started`: Crawling has started
   - `crawler.job.progress`: Progress update (pages crawled, data extracted)
   - `crawler.job.completed`: Crawling completed successfully
   - `crawler.job.failed`: Crawling failed
   - `crawler.job.materials.extracted`: Materials were extracted and are ready for import

### ML Training Queue

Coordinates machine learning model training:

1. **Features**
   - Resource-intensive job management
   - GPU allocation and scheduling
   - Progress monitoring with metrics
   - Model versioning and deployment

2. **Job Lifecycle**
   - Configuration: Training parameters defined
   - Preprocessing: Dataset preparation
   - Training: Model training with checkpoints
   - Evaluation: Model performance assessment
   - Deployment: Model integration into recognition system

3. **Events Published**
   - `training.job.queued`: Job has been queued
   - `training.job.started`: Training has started
   - `training.job.progress`: Progress update (epoch, metrics)
   - `training.job.completed`: Training completed successfully
   - `training.job.failed`: Training failed
   - `training.model.deployed`: New model has been deployed

## Message Broker Implementation

The message broker is implemented using Supabase Realtime:

```typescript
// Core Message Broker
export class MessageBroker {
  private supabase: SupabaseClient;
  private channels: Record<string, RealtimeChannel> = {};
  private handlers: Record<string, Record<string, Array<(payload: any) => Promise<void>>>> = {};

  constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient;
  }

  /**
   * Initialize a channel for a specific queue
   */
  public initChannel(channelName: string): RealtimeChannel {
    if (this.channels[channelName]) {
      return this.channels[channelName];
    }

    const channel = this.supabase.channel(channelName);
    
    // Initialize handlers container for this channel
    if (!this.handlers[channelName]) {
      this.handlers[channelName] = {};
    }
    
    // Setup channel with handlers
    Object.entries(this.handlers[channelName]).forEach(([eventType, handlers]) => {
      channel.on('broadcast', { event: eventType }, async (payload) => {
        try {
          await Promise.all(handlers.map(handler => handler(payload)));
        } catch (error) {
          logger.error(`Error handling event ${eventType} on channel ${channelName}:`, error);
        }
      });
    });
    
    // Subscribe to the channel
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        logger.info(`Subscribed to channel: ${channelName}`);
      } else if (status === 'CLOSED') {
        logger.warn(`Channel closed: ${channelName}`);
      } else if (status === 'CHANNEL_ERROR') {
        logger.error(`Channel error: ${channelName}`);
      }
    });
    
    this.channels[channelName] = channel;
    return channel;
  }

  /**
   * Publish a message to a channel
   */
  public async publish(channelName: string, eventType: string, payload: any): Promise<void> {
    try {
      // Ensure channel exists
      const channel = this.initChannel(channelName);
      
      // Add timestamp if not present
      const messagePayload = {
        ...payload,
        timestamp: payload.timestamp || Date.now()
      };
      
      // Send the message
      await channel.send({
        type: 'broadcast',
        event: eventType,
        payload: messagePayload
      });
      
      logger.debug(`Published message to ${channelName}:${eventType}`, { messageId: messagePayload.id });
    } catch (error) {
      logger.error(`Failed to publish message to ${channelName}:${eventType}`, error);
      throw new Error(`Message publishing failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Subscribe to events on a channel
   */
  public subscribe(
    channelName: string, 
    eventType: string, 
    handler: (payload: any) => Promise<void>
  ): () => void {
    // Ensure channel and handlers exist
    if (!this.handlers[channelName]) {
      this.handlers[channelName] = {};
    }
    
    if (!this.handlers[channelName][eventType]) {
      this.handlers[channelName][eventType] = [];
    }
    
    // Add the handler
    this.handlers[channelName][eventType].push(handler);
    
    // Ensure channel is initialized
    this.initChannel(channelName);
    
    // Return unsubscribe function
    return () => {
      if (this.handlers[channelName] && this.handlers[channelName][eventType]) {
        this.handlers[channelName][eventType] = this.handlers[channelName][eventType]
          .filter(h => h !== handler);
      }
    };
  }

  /**
   * Close all channels
   */
  public async close(): Promise<void> {
    await Promise.all(
      Object.values(this.channels).map(channel => channel.unsubscribe())
    );
    this.channels = {};
    this.handlers = {};
  }
}

// Export singleton instance
export const messageBroker = new MessageBroker(supabaseClient);
```

## Queue Adapter Implementation

Queue adapters standardize the interface between different queue implementations and the message broker:

```typescript
// Queue Adapter Interface
export interface QueueAdapter<T> {
  // Job management
  createJob(data: Partial<T>): Promise<string>;
  getJob(jobId: string): Promise<T | null>;
  updateJob(jobId: string, updates: Partial<T>): Promise<T>;
  deleteJob(jobId: string): Promise<boolean>;
  
  // Queue operations
  getJobs(options: QueueQueryOptions): Promise<{ jobs: T[], total: number }>;
  processNextJob(): Promise<T | null>;
  getQueueStats(): Promise<QueueStats>;
  
  // Event handling
  subscribeToEvents(eventTypes: string[], handler: EventHandler): () => void;
  publishEvent(eventType: string, data: any): Promise<void>;
}

// Base Queue Adapter Implementation
export abstract class BaseQueueAdapter<T extends QueueJob> implements QueueAdapter<T> {
  protected queueName: string;
  protected messageBroker: MessageBroker;
  
  constructor(queueName: string, messageBroker: MessageBroker) {
    this.queueName = queueName;
    this.messageBroker = messageBroker;
  }
  
  // Abstract methods to be implemented by specific queue adapters
  abstract createJob(data: Partial<T>): Promise<string>;
  abstract getJob(jobId: string): Promise<T | null>;
  abstract updateJob(jobId: string, updates: Partial<T>): Promise<T>;
  abstract deleteJob(jobId: string): Promise<boolean>;
  abstract getJobs(options: QueueQueryOptions): Promise<{ jobs: T[], total: number }>;
  abstract processNextJob(): Promise<T | null>;
  abstract getQueueStats(): Promise<QueueStats>;
  
  // Event methods using message broker
  public async publishEvent(eventType: string, data: any): Promise<void> {
    await this.messageBroker.publish(this.queueName, eventType, {
      ...data,
      queueName: this.queueName,
      timestamp: Date.now()
    });
  }
  
  public subscribeToEvents(eventTypes: string[], handler: EventHandler): () => void {
    const unsubscribers = eventTypes.map(eventType => 
      this.messageBroker.subscribe(this.queueName, eventType, handler)
    );
    
    return () => unsubscribers.forEach(unsubscribe => unsubscribe());
  }
}
```

## PDF Queue Implementation

Example of the PDF Processing Queue implementation:

```typescript
// PDF Queue Job Interface
export interface PDFProcessingJob extends QueueJob {
  fileName: string;
  fileSize: number;
  filePath: string;
  pageCount?: number;
  options: PDFProcessingOptions;
  progress: {
    currentPage: number;
    totalPages: number;
    percentComplete: number;
    currentStage: PDFProcessingStage;
    stageProgress: number;
  };
  results?: {
    imagesExtracted: number;
    textRegionsExtracted: number;
    tablesDetected: number;
    materialsIdentified: number;
    materialsImported: number;
  };
  outputDir?: string;
}

// PDF Queue Implementation
export class PDFQueue extends BaseQueueAdapter<PDFProcessingJob> {
  private db: Database;
  
  constructor(messageBroker: MessageBroker, db: Database) {
    super('pdf', messageBroker);
    this.db = db;
    
    // Subscribe to relevant events from other queues
    this.subscribeToExternalEvents();
  }
  
  /**
   * Create a new PDF processing job
   */
  public async createJob(data: Partial<PDFProcessingJob>): Promise<string> {
    // Generate job ID
    const jobId = uuidv4();
    
    // Create job with defaults
    const job: PDFProcessingJob = {
      id: jobId,
      status: 'waiting',
      priority: data.priority || 5,
      progress: {
        currentPage: 0,
        totalPages: data.pageCount || 0,
        percentComplete: 0,
        currentStage: 'initializing',
        stageProgress: 0
      },
      fileName: data.fileName!,
      fileSize: data.fileSize!,
      filePath: data.filePath!,
      options: data.options || {
        extractImages: true,
        extractText: true,
        enhanceResolution: false,
        associateTextWithImages: true,
        extractStructuredData: true
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data
    };
    
    // Save job to database
    await this.db.insert('pdf_jobs', job);
    
    // Publish event
    await this.publishEvent('pdf.job.queued', {
      jobId,
      fileName: job.fileName,
      fileSize: job.fileSize,
      priority: job.priority,
      options: job.options
    });
    
    return jobId;
  }
  
  /**
   * Get job by ID
   */
  public async getJob(jobId: string): Promise<PDFProcessingJob | null> {
    const job = await this.db.selectOne('pdf_jobs', { id: jobId });
    return job as PDFProcessingJob || null;
  }
  
  /**
   * Update job
   */
  public async updateJob(jobId: string, updates: Partial<PDFProcessingJob>): Promise<PDFProcessingJob> {
    // Get current job
    const currentJob = await this.getJob(jobId);
    if (!currentJob) {
      throw new Error(`Job not found: ${jobId}`);
    }
    
    // Update job
    const updatedJob = {
      ...currentJob,
      ...updates,
      updatedAt: new Date()
    };
    
    // Save to database
    await this.db.update('pdf_jobs', { id: jobId }, updatedJob);
    
    // Publish events based on updates
    if (updates.status) {
      switch (updates.status) {
        case 'processing':
          await this.publishEvent('pdf.job.started', {
            jobId,
            fileName: updatedJob.fileName,
            fileSize: updatedJob.fileSize
          });
          break;
        case 'completed':
          await this.publishEvent('pdf.job.completed', {
            jobId,
            fileName: updatedJob.fileName,
            results: updatedJob.results
          });
          break;
        case 'failed':
          await this.publishEvent('pdf.job.failed', {
            jobId,
            fileName: updatedJob.fileName,
            error: updatedJob.error
          });
          break;
      }
    }
    
    // Publish progress updates if progress changed
    if (updates.progress) {
      await this.publishEvent('pdf.job.progress', {
        jobId,
        fileName: updatedJob.fileName,
        progress: updatedJob.progress
      });
    }
    
    return updatedJob;
  }
  
  /**
   * Delete job
   */
  public async deleteJob(jobId: string): Promise<boolean> {
    const result = await this.db.delete('pdf_jobs', { id: jobId });
    return result.affected > 0;
  }
  
  /**
   * Get jobs with filtering, sorting, and pagination
   */
  public async getJobs(options: QueueQueryOptions): Promise<{ jobs: PDFProcessingJob[], total: number }> {
    const {
      status,
      priority,
      createdAfter,
      createdBefore,
      limit = 20,
      skip = 0,
      sort = 'createdAt',
      order = 'desc'
    } = options;
    
    // Build query
    const query: Record<string, any> = {};
    
    if (status) {
      query.status = Array.isArray(status) ? { $in: status } : status;
    }
    
    if (priority) {
      query.priority = Array.isArray(priority) 
        ? { $in: priority } 
        : typeof priority === 'object'
          ? priority
          : { $gte: priority };
    }
    
    if (createdAfter || createdBefore) {
      query.createdAt = {};
      if (createdAfter) query.createdAt.$gte = createdAfter;
      if (createdBefore) query.createdAt.$lte = createdBefore;
    }
    
    // Execute query
    const jobs = await this.db.select('pdf_jobs', query, {
      limit,
      skip,
      sort: { [sort]: order === 'asc' ? 1 : -1 }
    });
    
    const total = await this.db.count('pdf_jobs', query);
    
    return { 
      jobs: jobs as PDFProcessingJob[],
      total
    };
  }
  
  /**
   * Process next job in queue
   */
  public async processNextJob(): Promise<PDFProcessingJob | null> {
    // Find next job to process based on priority and creation time
    const nextJob = await this.db.selectOne('pdf_jobs', { status: 'waiting' }, {
      sort: { priority: -1, createdAt: 1 }
    });
    
    if (!nextJob) {
      return null;
    }
    
    // Update job status to processing
    return await this.updateJob(nextJob.id, { 
      status: 'processing',
      startedAt: new Date()
    });
  }
  
  /**
   * Get queue statistics
   */
  public async getQueueStats(): Promise<QueueStats> {
    const waiting = await this.db.count('pdf_jobs', { status: 'waiting' });
    const processing = await this.db.count('pdf_jobs', { status: 'processing' });
    const completed = await this.db.count('pdf_jobs', { status: 'completed' });
    const failed = await this.db.count('pdf_jobs', { status: 'failed' });
    
    // Get oldest waiting job
    const oldestJob = await this.db.selectOne('pdf_jobs', { status: 'waiting' }, {
      sort: { createdAt: 1 }
    });
    
    // Calculate throughput
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const completedLast24h = await this.db.count('pdf_jobs', {
      status: 'completed',
      completedAt: { $gte: oneDayAgo }
    });
    
    const completedLast7d = await this.db.count('pdf_jobs', {
      status: 'completed',
      completedAt: { $gte: sevenDaysAgo }
    });
    
    // Calculate average processing time
    const recentJobs = await this.db.select('pdf_jobs', {
      status: 'completed',
      completedAt: { $gte: sevenDaysAgo }
    });
    
    let totalProcessingTime = 0;
    let jobsWithTime = 0;
    
    recentJobs.forEach(job => {
      if (job.startedAt && job.completedAt) {
        totalProcessingTime += job.completedAt.getTime() - job.startedAt.getTime();
        jobsWithTime++;
      }
    });
    
    const averageProcessingTime = jobsWithTime > 0 
      ? totalProcessingTime / jobsWithTime 
      : 0;
    
    return {
      queueId: 'pdf',
      name: 'PDF Processing Queue',
      status: 'active',
      jobCount: {
        waiting,
        processing,
        completed,
        failed
      },
      throughput: {
        last24h: completedLast24h,
        last7d: completedLast7d
      },
      averageProcessingTime,
      oldestJob: oldestJob?.createdAt || null
    };
  }
  
  /**
   * Subscribe to events from other queues
   */
  private subscribeToExternalEvents(): void {
    // Listen for knowledge base events
    this.messageBroker.subscribe('knowledge-base', 'material.imported', async (payload) => {
      if (payload.source === 'pdf' && payload.jobId) {
        const job = await this.getJob(payload.jobId);
        if (job) {
          await this.updateJob(payload.jobId, {
            results: {
              ...job.results,
              materialsImported: payload.count
            }
          });
        }
      }
    });
  }
}
```

## Queue Events Service

The Queue Events Service provides a client-side interface for subscribing to queue events:

```typescript
// Queue Events Service
export class QueueEventsService {
  private supabase: SupabaseClient;
  private channels: Record<string, RealtimeChannel> = {};
  private subscriptions: Record<string, () => void> = {};
  
  constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient;
  }
  
  /**
   * Subscribe to queue events
   */
  public subscribe(
    queueId: string,
    eventTypes: string[],
    handler: (event: QueueEvent) => void
  ): () => void {
    // Create channel ID
    const channelId = `queue-${queueId}`;
    
    // Initialize channel if it doesn't exist
    if (!this.channels[channelId]) {
      this.channels[channelId] = this.supabase.channel(channelId);
      
      // Subscribe to channel
      this.channels[channelId].subscribe(status => {
        if (status === 'SUBSCRIBED') {
          console.log(`Subscribed to queue events: ${queueId}`);
        }
      });
    }
    
    // Subscribe to each event type
    eventTypes.forEach(eventType => {
      const subscriptionId = `${channelId}-${eventType}`;
      
      // Unsubscribe if already subscribed
      if (this.subscriptions[subscriptionId]) {
        this.subscriptions[subscriptionId]();
      }
      
      // Subscribe to event
      this.channels[channelId].on('broadcast', { event: eventType }, payload => {
        handler({
          type: eventType,
          queueId,
          data: payload.payload,
          timestamp: payload.payload.timestamp || Date.now()
        });
      });
      
      // Store unsubscribe function
      this.subscriptions[subscriptionId] = () => {
        this.channels[channelId].off('broadcast', { event: eventType });
      };
    });
    
    // Return unsubscribe function
    return () => {
      eventTypes.forEach(eventType => {
        const subscriptionId = `${channelId}-${eventType}`;
        if (this.subscriptions[subscriptionId]) {
          this.subscriptions[subscriptionId]();
          delete this.subscriptions[subscriptionId];
        }
      });
    };
  }
  
  /**
   * Subscribe to PDF queue events
   */
  public subscribeToPDFEvents(
    handler: (event: QueueEvent) => void
  ): () => void {
    return this.subscribe('pdf', [
      'pdf.job.queued',
      'pdf.job.started',
      'pdf.job.progress',
      'pdf.job.completed',
      'pdf.job.failed'
    ], handler);
  }
  
  /**
   * Subscribe to crawler queue events
   */
  public subscribeToCrawlerEvents(
    handler: (event: QueueEvent) => void
  ): () => void {
    return this.subscribe('crawler', [
      'crawler.job.queued',
      'crawler.job.started',
      'crawler.job.progress',
      'crawler.job.completed',
      'crawler.job.failed'
    ], handler);
  }
  
  /**
   * Subscribe to training queue events
   */
  public subscribeToTrainingEvents(
    handler: (event: QueueEvent) => void
  ): () => void {
    return this.subscribe('training', [
      'training.job.queued',
      'training.job.started',
      'training.job.progress',
      'training.job.completed',
      'training.job.failed',
      'training.model.deployed'
    ], handler);
  }
  
  /**
   * Unsubscribe from all events
   */
  public unsubscribeAll(): void {
    // Unsubscribe from all subscriptions
    Object.values(this.subscriptions).forEach(unsubscribe => unsubscribe());
    this.subscriptions = {};
    
    // Unsubscribe from all channels
    Object.values(this.channels).forEach(channel => channel.unsubscribe());
    this.channels = {};
  }
}

// Export singleton instance
export const queueEvents = new QueueEventsService(supabaseClient);
```

## Queue Dashboard Implementation

The Queue Dashboard uses the Queue Events Service to display real-time queue status:

```typescript
// Queue Dashboard Component
import React, { useEffect, useState } from 'react';
import { queueEvents } from '../../services/queueEvents.service';

interface QueueStats {
  queueId: string;
  name: string;
  status: 'active' | 'paused' | 'error';
  jobCount: {
    waiting: number;
    processing: number;
    completed: number;
    failed: number;
  };
  throughput: {
    last1h: number;
    last24h: number;
    last7d: number;
  };
  averageProcessingTime: number;
  oldestJob: Date | null;
}

interface QueueEvent {
  type: string;
  queueId: string;
  data: any;
  timestamp: number;
}

export const QueueDashboard: React.FC = () => {
  const [pdfStats, setPdfStats] = useState<QueueStats | null>(null);
  const [crawlerStats, setCrawlerStats] = useState<QueueStats | null>(null);
  const [recentEvents, setRecentEvents] = useState<QueueEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    // Fetch initial queue stats
    const fetchQueueStats = async () => {
      try {
        const response = await fetch('/api/admin/queues');
        const data = await response.json();
        
        // Update stats
        data.queues.forEach((queueStats: QueueStats) => {
          if (queueStats.queueId === 'pdf') {
            setPdfStats(queueStats);
          } else if (queueStats.queueId === 'crawler') {
            setCrawlerStats(queueStats);
          }
        });
        
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to fetch queue stats:', error);
        setIsLoading(false);
      }
    };
    
    fetchQueueStats();
    
    // Subscribe to queue events
    const unsubscribePdf = queueEvents.subscribeToPDFEvents(handleQueueEvent);
    const unsubscribeCrawler = queueEvents.subscribeToCrawlerEvents(handleQueueEvent);
    
    return () => {
      unsubscribePdf();
      unsubscribeCrawler();
    };
  }, []);
  
  // Handle queue events
  const handleQueueEvent = (event: QueueEvent) => {
    // Update recent events list
    setRecentEvents(prevEvents => {
      const newEvents = [event, ...prevEvents].slice(0, 10);
      return newEvents;
    });
    
    // Update queue stats based on event
    if (event.queueId === 'pdf') {
      if (event.type === 'pdf.job.queued') {
        setPdfStats(prev => prev ? {
          ...prev,
          jobCount: {
            ...prev.jobCount,
            waiting: prev.jobCount.waiting + 1
          }
        } : null);
      } else if (event.type === 'pdf.job.started') {
        setPdfStats(prev => prev ? {
          ...prev,
          jobCount: {
            ...prev.jobCount,
            waiting: Math.max(0, prev.jobCount.waiting - 1),
            processing: prev.jobCount.processing + 1
          }
        } : null);
      } else if (event.type === 'pdf.job.completed') {
        setPdfStats(prev => prev ? {
          ...prev,
          jobCount: {
            ...prev.jobCount,
            processing: Math.max(0, prev.jobCount.processing - 1),
            completed: prev.jobCount.completed + 1
          },
          throughput: {
            ...prev.throughput,
            last1h: prev.throughput.last1h + 1,
            last24h: prev.throughput.last24h + 1,
            last7d: prev.throughput.last7d + 1
          }
        } : null);
      } else if (event.type === 'pdf.job.failed') {
        setPdfStats(prev => prev ? {
          ...prev,
          jobCount: {
            ...prev.jobCount,
            processing: Math.max(0, prev.jobCount.processing - 1),
            failed: prev.jobCount.failed + 1
          }
        } : null);
      }
    } else if (event.queueId === 'crawler') {
      // Similar updates for crawler stats
    }
  };
  
  if (isLoading) {
    return <div>Loading queue statistics...</div>;
  }
  
  return (
    <div className="queue-dashboard">
      <h2>Queue Dashboard</h2>
      
      <div className="queue-stats-container">
        {pdfStats && (
          <div className="queue-stats-card">
            <h3>{pdfStats.name}</h3>
            <div className="status-indicator status-{pdfStats.status}">
              {pdfStats.status}
            </div>
            
            <div className="stats-grid">
              <div className="stat-item">
                <div className="stat-label">Waiting</div>
                <div className="stat-value">{pdfStats.jobCount.waiting}</div>
              </div>
              <div className="stat-item">
                <div className="stat-label">Processing</div>
                <div className="stat-value">{pdfStats.jobCount.processing}</div>
              </div>
              <div className="stat-item">
                <div className="stat-label">Completed</div>
                <div className="stat-value">{pdfStats.jobCount.completed}</div>
              </div>
              <div className="stat-item">
                <div className="stat-label">Failed</div>
                <div className="stat-value">{pdfStats.jobCount.failed}</div>
              </div>
            </div>
            
            <div className="throughput-section">
              <h4>Throughput</h4>
              <div>Last 24h: {pdfStats.throughput.last24h} jobs</div>
              <div>Last 7d: {pdfStats.throughput.last7d} jobs</div>
            </div>
            
            <div className="processing-time">
              <h4>Average Processing Time</h4>
              <div>{formatTime(pdfStats.averageProcessingTime)}</div>
            </div>
            
            {pdfStats.oldestJob && (
              <div className="oldest-job">
                <h4>Oldest Waiting Job</h4>
                <div>{formatDate(pdfStats.oldestJob)}</div>
              </div>
            )}
            
            <div className="action-buttons">
              <button onClick={() => viewQueueJobs('pdf')}>View Jobs</button>
              <button onClick={() => pauseQueue('pdf')}>
                {pdfStats.status === 'paused' ? 'Resume' : 'Pause'}
              </button>
            </div>
          </div>
        )}
        
        {/* Similar card for crawler stats */}
      </div>
      
      <div className="recent-events">
        <h3>Recent Events</h3>
        <ul className="event-list">
          {recentEvents.map((event, index) => (
            <li key={index} className={`event-item event-${event.type.split('.')[1]}`}>
              <div className="event-time">{formatTime(event.timestamp)}</div>
              <div className="event-queue">{event.queueId}</div>
              <div className="event-type">{event.type}</div>
              <div className="event-data">
                {event.data.jobId && <span>Job: {event.data.jobId}</span>}
                {event.data.progress && (
                  <span>Progress: {event.data.progress.percentComplete}%</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

// Helper functions
const formatTime = (milliseconds: number) => {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
};

const formatDate = (date: Date) => {
  return new Date(date).toLocaleString();
};

const viewQueueJobs = (queueId: string) => {
  window.location.href = `/admin/queues/${queueId}/jobs`;
};

const pauseQueue = async (queueId: string) => {
  try {
    await fetch(`/api/admin/queues/${queueId}/toggle`, {
      method: 'POST'
    });
  } catch (error) {
    console.error(`Failed to toggle queue ${queueId}:`, error);
  }
};
```

## API Usage

### Creating a PDF Processing Job

```typescript
import { pdfQueue } from '../services/pdf/pdfQueue';

async function processPDFCatalog(filePath: string, fileName: string, fileSize: number) {
  try {
    // Create a new PDF processing job
    const jobId = await pdfQueue.createJob({
      fileName,
      fileSize,
      filePath,
      priority: 5,
      options: {
        extractImages: true,
        extractText: true,
        enhanceResolution: true,
        associateTextWithImages: true,
        extractStructuredData: true
      }
    });
    
    console.log(`PDF processing job created: ${jobId}`);
    
    // Optionally, subscribe to job events
    const unsubscribe = pdfQueue.subscribeToEvents(['pdf.job.completed', 'pdf.job.failed'], async (event) => {
      if (event.data.jobId === jobId) {
        if (event.type === 'pdf.job.completed') {
          console.log(`Job completed with results:`, event.data.results);
          
          // Do something with the results
          if (event.data.results && event.data.results.materialsIdentified > 0) {
            // Handle extracted materials
          }
        } else if (event.type === 'pdf.job.failed') {
          console.error(`Job failed:`, event.data.error);
          // Handle failure
        }
        
        // Unsubscribe after handling event
        unsubscribe();
      }
    });
    
    return jobId;
  } catch (error) {
    console.error('Failed to create PDF processing job:', error);
    throw error;
  }
}
```

### Monitoring Job Progress in UI

```typescript
import React, { useEffect, useState } from 'react';
import { queueEvents } from '../../services/queueEvents.service';

interface JobProgress {
  currentPage: number;
  totalPages: number;
  percentComplete: number;
  currentStage: string;
  stageProgress: number;
}

interface JobDetails {
  jobId: string;
  status: 'waiting' | 'processing' | 'completed' | 'failed';
  fileName: string;
  fileSize: number;
  progress: JobProgress;
  results?: Record<string, number>;
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export const JobProgressTracker: React.FC<{ jobId: string }> = ({ jobId }) => {
  const [jobDetails, setJobDetails] = useState<JobDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    // Fetch initial job details
    const fetchJobDetails = async () => {
      try {
        const response = await fetch(`/api/pdf/jobs/${jobId}`);
        const data = await response.json();
        setJobDetails(data);
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to fetch job details:', error);
        setIsLoading(false);
      }
    };
    
    fetchJobDetails();
    
    // Subscribe to job events
    const unsubscribe = queueEvents.subscribeToPDFEvents((event) => {
      if (event.data.jobId === jobId) {
        // Update job details based on event type
        if (event.type === 'pdf.job.progress') {
          setJobDetails(prev => prev ? {
            ...prev,
            progress: event.data.progress
          } : null);
        } else if (event.type === 'pdf.job.completed') {
          setJobDetails(prev => prev ? {
            ...prev,
            status: 'completed',
            results: event.data.results,
            completedAt: new Date(event.timestamp).toISOString()
          } : null);
        } else if (event.type === 'pdf.job.failed') {
          setJobDetails(prev => prev ? {
            ...prev,
            status: 'failed',
            error: event.data.error,
            completedAt: new Date(event.timestamp).toISOString()
          } : null);
        }
      }
    });
    
    return () => {
      unsubscribe();
    };
  }, [jobId]);
  
  if (isLoading) {
    return <div>Loading job details...</div>;
  }
  
  if (!jobDetails) {
    return <div>Job not found</div>;
  }
  
  return (
    <div className="job-progress-tracker">
      <h2>Job Progress: {jobDetails.fileName}</h2>
      
      <div className="job-status">
        Status: <span className={`status-${jobDetails.status}`}>{jobDetails.status}</span>
      </div>
      
      {jobDetails.status === 'processing' && (
        <div className="progress-section">
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ width: `${jobDetails.progress.percentComplete}%` }}
            />
          </div>
          <div className="progress-text">
            {jobDetails.progress.percentComplete}% complete
          </div>
          <div className="stage-info">
            Current stage: {jobDetails.progress.currentStage}
            <div className="stage-progress-bar">
              <div 
                className="stage-progress-fill"
                style={{ width: `${jobDetails.progress.stageProgress}%` }}
              />
            </div>
          </div>
          <div className="page-progress">
            Processing page {jobDetails.progress.currentPage} of {jobDetails.progress.totalPages}
          </div>
        </div>
      )}
      
      {jobDetails.status === 'completed' && jobDetails.results && (
        <div className="results-section">
          <h3>Processing Results</h3>
          <div className="results-grid">
            <div className="result-item">
              <div className="result-label">Images Extracted</div>
              <div className="result-value">{jobDetails.results.imagesExtracted}</div>
            </div>
            <div className="result-item">
              <div className="result-label">Text Regions</div>
              <div className="result-value">{jobDetails.results.textRegionsExtracted}</div>
            </div>
            <div className="result-item">
              <div className="result-label">Tables Detected</div>
              <div className="result-value">{jobDetails.results.tablesDetected}</div>
            </div>
            <div className="result-item">
              <div className="result-label">Materials Identified</div>
              <div className="result-value">{jobDetails.results.materialsIdentified}</div>
            </div>
            {jobDetails.results.materialsImported !== undefined && (
              <div className="result-item">
                <div className="result-label">Materials Imported</div>
                <div className="result-value">{jobDetails.results.materialsImported}</div>
              </div>
            )}
          </div>
          
          <div className="action-buttons">
            <button onClick={() => viewResults(jobId)}>View Results</button>
            <button onClick={() => downloadResults(jobId)}>Download Results</button>
          </div>
        </div>
      )}
      
      {jobDetails.status === 'failed' && (
        <div className="error-section">
          <h3>Processing Error</h3>
          <div className="error-message">
            {jobDetails.error || 'Unknown error occurred'}
          </div>
          <div className="action-buttons">
            <button onClick={() => retryJob(jobId)}>Retry Job</button>
          </div>
        </div>
      )}
      
      <div className="job-details">
        <h3>Job Details</h3>
        <div className="details-grid">
          <div className="detail-item">
            <div className="detail-label">Job ID</div>
            <div className="detail-value">{jobDetails.jobId}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">File Name</div>
            <div className="detail-value">{jobDetails.fileName}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">File Size</div>
            <div className="detail-value">{formatFileSize(jobDetails.fileSize)}</div>
          </div>
          <div className="detail-item">
            <div className="detail-label">Created</div>
            <div className="detail-value">{formatDate(jobDetails.createdAt)}</div>
          </div>
          {jobDetails.startedAt && (
            <div className="detail-item">
              <div className="detail-label">Started</div>
              <div className="detail-value">{formatDate(jobDetails.startedAt)}</div>
            </div>
          )}
          {jobDetails.completedAt && (
            <div className="detail-item">
              <div className="detail-label">Completed</div>
              <div className="detail-value">{formatDate(jobDetails.completedAt)}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Helper functions
const formatFileSize = (bytes: number) => {
  if (bytes < 1024) {
    return `${bytes} B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  } else if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  } else {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleString();
};

const viewResults = (jobId: string) => {
  window.location.href = `/pdf/jobs/${jobId}/results`;
};

const downloadResults = (jobId: string) => {
  window.location.href = `/api/pdf/jobs/${jobId}/results/download`;
};

const retryJob = async (jobId: string) => {
  try {
    await fetch(`/api/pdf/jobs/${jobId}/retry`, {
      method: 'POST'
    });
  } catch (error) {
    console.error(`Failed to retry job ${jobId}:`, error);
  }
};
```

## Performance Considerations

1. **Horizontal Scaling**
   - Each queue worker can be scaled independently
   - Multiple workers can process jobs from the same queue
   - Cloud deployment allows auto-scaling based on queue length

2. **Message Efficiency**
   - Compact message payloads to reduce transmission overhead
   - Appropriate subscription filtering to reduce unnecessary processing
   - Batch operations for high-volume workflows

3. **Error Handling and Recovery**
   - Automatic retries with exponential backoff
   - Dead-letter queues for failed jobs
   - Partial progress recovery for interrupted jobs
   - Circuit breakers for dependent services

4. **Monitoring and Alerting**
   - Real-time queue length monitoring
   - Processing time tracking
   - Error rate alerting
   - Resource utilization monitoring

5. **Resource Requirements**
   - Supabase instance with Realtime features enabled
   - Database for job storage and persistence
   - Worker instances with appropriate resources for job types
   - Network capacity for real-time updates