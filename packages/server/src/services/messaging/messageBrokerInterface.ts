/**
 * Message Broker Interface
 * 
 * Defines a common interface for all message broker implementations,
 * enabling a factory pattern and easier switching between implementations.
 */

/**
 * Queue types enum for message broker
 */
export enum QueueType {
  PDF = 'pdf',
  CRAWLER = 'crawler',
  SYSTEM = 'system',
  RECOGNITION = 'recognition',
  MODEL_TRAINING = 'model-training'
}

/**
 * Legacy queue type definition for backward compatibility
 */
export type MessageQueueType = string | QueueType;

/**
 * Message types enum for pub/sub events
 */
export enum MessageType {
  JOB_ADDED = 'job-added',
  JOB_STARTED = 'job-started',
  JOB_COMPLETED = 'job-completed',
  JOB_FAILED = 'job-failed',
  JOB_PROGRESS = 'job-progress',
  KNOWLEDGE_BASE_EVENT = 'knowledge-base-event',
  DATA_SYNC = 'data-sync',
  SYSTEM_NOTIFICATION = 'system-notification',
  USER_NOTIFICATION = 'user-notification'
}

/**
 * Message delivery status for tracking
 */
export enum MessageDeliveryStatus {
  PENDING = 'pending',
  DELIVERED = 'delivered',
  PROCESSING = 'processing',
  ACKNOWLEDGED = 'acknowledged',
  FAILED = 'failed',
  EXPIRED = 'expired'
}

/**
 * Message payload structure
 */
export interface MessagePayload<T = any> {
  id?: string;         // Optional in basic broker, required in enhanced versions
  queue: MessageQueueType;
  type: MessageType | string;
  data: T;
  source?: string;     // Made optional for backward compatibility
  timestamp: number;
  priority?: number;    // Used in enhanced versions
  expiresAt?: number;   // Used in enhanced versions
  attempts?: number;    // Used in enhanced versions
  status?: MessageDeliveryStatus; // Used in enhanced versions
}

/**
 * Message handler function type
 */
export type MessageHandler<T = any> = (
  message: MessagePayload<T>, 
  acknowledge?: () => Promise<void> | void
) => Promise<void> | void;

/**
 * Subscription options (advanced brokers)
 */
export interface SubscriptionOptions {
  useAcknowledgment?: boolean;
  autoAcknowledge?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  enableCache?: boolean;
  useFilters?: boolean;
  batchSize?: number;
  priority?: number;
}

/**
 * Broker statistics (advanced brokers)
 */
export interface MessageStats {
  total: number;
  delivered: number;
  pending: number;
  failed: number;
  processing: number;
  acknowledged: number;
  expired: number;
  oldestPending?: Date;
  newestPending?: Date;
  avgProcessingTime?: number;
}

/**
 * Configuration options for message brokers
 */
export interface MessageBrokerConfig {
  persistenceEnabled?: boolean;
  realtimeEnabled?: boolean;
  batchSize?: number;
  maxRetries?: number;
  reliability?: 'basic' | 'enhanced' | 'high';
  scaling?: 'none' | 'basic' | 'advanced';
  caching?: boolean;
}

/**
 * Core Message Broker Interface
 * 
 * Defines the functionality required for message brokers,
 * ensuring compatibility across different implementations.
 */
export interface IMessageBroker {
  /**
   * Publish a message to a queue
   * @param queue Queue to publish to
   * @param type Message type
   * @param data Message data
   * @param source Source identifier
   * @param priority Optional priority level
   * @returns Success flag
   */
  publish<T = any>(
    queue: MessageQueueType,
    type: MessageType | string,
    data: T,
    source?: string,
    priority?: number
  ): Promise<boolean>;
  
  /**
   * Subscribe to messages
   * @param queue Queue type to subscribe to
   * @param handler Message handler function
   * @param type Specific message type to filter by (optional)
   * @returns Unsubscribe function
   */
  subscribe<T = any>(
    queue: MessageQueueType,
    handler: MessageHandler<T>,
    type?: MessageType | string
  ): Promise<() => Promise<void>>;
  
  /**
   * Subscribe with advanced options
   * @param queue Queue to subscribe to
   * @param handler Message handler function
   * @param options Subscription options
   * @param type Optional message type filter
   * @returns Unsubscribe function
   */
  subscribeWithOptions<T = any>(
    queue: MessageQueueType,
    handler: MessageHandler<T>,
    options: SubscriptionOptions,
    type?: MessageType | string
  ): Promise<() => Promise<void>>;
  
  /**
   * Clean up resources
   */
  shutdown(): Promise<void>;
}

/**
 * Extended Message Broker Interface with enhanced features
 */
export interface IEnhancedMessageBroker extends IMessageBroker {
  /**
   * Publish multiple messages as a batch
   * @param messages Array of messages to publish
   * @returns Number of successfully published messages
   */
  publishBatch<T = any>(
    messages: Array<{
      queue: MessageQueueType;
      type: MessageType | string;
      data: T;
      source: string;
      priority?: number;
      expiresAt?: number;
    }>
  ): Promise<number>;
  
  /**
   * Get statistics about message processing
   * @returns Message statistics
   */
  getMessageStats(): Promise<MessageStats>;
  
  /**
   * Check for and replay any missed messages
   * @param queue Optional queue to filter by
   * @param type Optional message type to filter by
   * @param filterFn Optional filter function
   * @returns Number of replayed messages
   */
  replayMissedMessages(
    queue?: MessageQueueType,
    type?: MessageType | string,
    filterFn?: (message: MessagePayload) => boolean
  ): Promise<number>;
  
  /**
   * Configure the message broker
   * @param options Configuration options
   */
  configure(options: Partial<MessageBrokerConfig>): void;
}

/**
 * Type guard to check if a broker has enhanced features
 * @param broker Message broker to check
 * @returns True if the broker has enhanced features
 */
export function isEnhancedMessageBroker(
  broker: IMessageBroker
): broker is IEnhancedMessageBroker {
  return (
    (broker as IEnhancedMessageBroker).publishBatch !== undefined &&
    (broker as IEnhancedMessageBroker).getMessageStats !== undefined &&
    (broker as IEnhancedMessageBroker).replayMissedMessages !== undefined
  );
}