/**
 * Queue Adapter for Message Broker
 * 
 * Provides a consistent interface for queue systems to interact with
 * the message broker, handling the publication of events and subscription
 * to events from other queues.
 */

import { logger } from '../../utils/logger';
import { messageBroker, MessageQueueType, MessageType, MessageHandler, MessagePayload } from './messageBroker';

/**
 * Queue event types that map to MessageType in the broker
 */
export type QueueEventType = 
  | 'job-added'
  | 'job-started'
  | 'job-completed'
  | 'job-failed'
  | 'job-progress';

/**
 * Interface for job data passed to/from queues
 */
export interface QueueJobData {
  id: string;
  status: string;
  priority?: string | number;
  progress?: number;
  [key: string]: any; // Allow any additional properties
}

/**
 * Queue Adapter for Message Broker
 */
export class QueueAdapter {
  private queueType: MessageQueueType;
  private queueName: string;
  private subscriptions: Array<() => Promise<void>> = [];
  
  /**
   * Create a new Queue Adapter
   * @param queueType Type of queue (pdf or crawler)
   * @param queueName Human-readable name of the queue
   */
  constructor(queueType: MessageQueueType, queueName: string) {
    this.queueType = queueType;
    this.queueName = queueName;
    
    logger.info(`Initialized queue adapter for ${queueName} (${queueType})`);
  }
  
  /**
   * Publish a job event to the message broker
   * @param eventType Type of event
   * @param jobData Job data to publish
   * @returns Success flag
   */
  public async publishEvent(
    eventType: QueueEventType,
    jobData: QueueJobData
  ): Promise<boolean> {
    try {
      await messageBroker.publish(
        this.queueType,
        eventType as MessageType,
        jobData,
        this.queueName
      );
      
      return true;
    } catch (err) {
      logger.error(`Failed to publish ${eventType} event for job ${jobData.id}: ${err}`);
      return false;
    }
  }
  
  /**
   * Subscribe to job events from a specific queue
   * @param queueType Queue to subscribe to
   * @param eventType Specific event type to filter by (optional)
   * @param handler Handler function for received events
   * @returns Unsubscribe function
   */
  public async subscribeToEvents<T = QueueJobData>(
    queueType: MessageQueueType,
    handler: MessageHandler<T>,
    eventType?: QueueEventType
  ): Promise<() => Promise<void>> {
    const unsubscribe = await messageBroker.subscribe<T>(
      queueType,
      handler,
      eventType as MessageType | undefined
    );
    
    // Keep track of subscriptions
    this.subscriptions.push(unsubscribe);
    
    return unsubscribe;
  }
  
  /**
   * Publish a job added event
   * @param jobData Job data
   * @returns Success flag
   */
  public async publishJobAdded(jobData: QueueJobData): Promise<boolean> {
    return this.publishEvent('job-added', jobData);
  }
  
  /**
   * Publish a job started event
   * @param jobData Job data
   * @returns Success flag
   */
  public async publishJobStarted(jobData: QueueJobData): Promise<boolean> {
    return this.publishEvent('job-started', jobData);
  }
  
  /**
   * Publish a job progress update event
   * @param jobData Job data with progress information
   * @returns Success flag
   */
  public async publishJobProgress(jobData: QueueJobData): Promise<boolean> {
    return this.publishEvent('job-progress', jobData);
  }
  
  /**
   * Publish a job completed event
   * @param jobData Job data
   * @returns Success flag
   */
  public async publishJobCompleted(jobData: QueueJobData): Promise<boolean> {
    return this.publishEvent('job-completed', jobData);
  }
  
  /**
   * Publish a job failed event
   * @param jobData Job data with error information
   * @returns Success flag
   */
  public async publishJobFailed(jobData: QueueJobData): Promise<boolean> {
    return this.publishEvent('job-failed', jobData);
  }
  
  /**
   * Setup standard cross-queue event handlers
   * @param handlers Event handlers for different event types
   */
  public async setupStandardEventHandlers(handlers: {
    onJobAdded?: MessageHandler;
    onJobStarted?: MessageHandler;
    onJobProgress?: MessageHandler;
    onJobCompleted?: MessageHandler;
    onJobFailed?: MessageHandler;
  }): Promise<void> {
    const otherQueueType = this.queueType === 'pdf' ? 'crawler' : 'pdf';
    
    // Subscribe to events from the other queue type
    if (handlers.onJobAdded) {
      await this.subscribeToEvents(otherQueueType, handlers.onJobAdded, 'job-added');
    }
    
    if (handlers.onJobStarted) {
      await this.subscribeToEvents(otherQueueType, handlers.onJobStarted, 'job-started');
    }
    
    if (handlers.onJobProgress) {
      await this.subscribeToEvents(otherQueueType, handlers.onJobProgress, 'job-progress');
    }
    
    if (handlers.onJobCompleted) {
      await this.subscribeToEvents(otherQueueType, handlers.onJobCompleted, 'job-completed');
    }
    
    if (handlers.onJobFailed) {
      await this.subscribeToEvents(otherQueueType, handlers.onJobFailed, 'job-failed');
    }
    
    logger.info(`Set up standard cross-queue event handlers for ${this.queueName}`);
  }
  
  /**
   * Unsubscribe from all events
   */
  public async unsubscribeAll(): Promise<void> {
    const promises = this.subscriptions.map(unsubscribe => unsubscribe());
    await Promise.all(promises);
    this.subscriptions = [];
    
    logger.info(`Unsubscribed from all events for ${this.queueName}`);
  }
}

/**
 * Create a PDF queue adapter
 * @returns PDF queue adapter
 */
export const createPdfQueueAdapter = (): QueueAdapter => {
  return new QueueAdapter('pdf', 'PDF Processing Queue');
};

/**
 * Create a crawler queue adapter
 * @returns Crawler queue adapter
 */
export const createCrawlerQueueAdapter = (): QueueAdapter => {
  return new QueueAdapter('crawler', 'Web Crawler Queue');
};