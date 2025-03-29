/**
 * Scalable Message Broker Service
 * 
 * An implementation following Supabase best practices for scalability:
 * - Proper Supabase Realtime channel management
 * - Efficient database operations with pagination
 * - Connection pooling with exponential backoff
 * - Row Level Security (RLS) policy awareness
 * - Transaction support for atomic operations
 * - Proper error handling and monitoring
 * - Performance optimizations with indexes and caching
 * - Support for horizontal scaling
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger';
import { supabaseClient } from '../supabase/supabaseClient';

// Constants for scaling configuration
const PAGE_SIZE = 100; // Pagination size for large queries
const MAX_BATCH_SIZE = 1000; // Maximum batch insert size (Supabase limit)
const CHANNEL_TIMEOUT = 10000; // Channel connection timeout
const MAX_CACHE_SIZE = 1000; // Maximum in-memory cache size
const DEFAULT_EXPIRY_DAYS = 7; // Default message expiry in days
const MAX_RETRY_COUNT = 5; // Maximum retry attempts
const MIN_BACKOFF_MS = 1000; // Minimum backoff time in ms
const MAX_BACKOFF_MS = 60000; // Maximum backoff time in ms

/**
 * Message types for the broker
 */
export enum MessageType {
  PDF = 'pdf',
  CRAWLER = 'crawler',
  SYSTEM = 'system',
  QUEUE = 'queue',
  TRAINING = 'training',
  KNOWLEDGE_BASE_EVENT = 'knowledge-base-event'
}

/**
 * Queue types for organizing messages
 */
export type QueueType = 'pdf' | 'crawler' | 'system';

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
 * Message payload interface
 */
export interface MessagePayload<T = any> {
  id: string;
  queue: QueueType;
  type: string;
  data: T;
  source: string;
  timestamp: number;
  priority?: number;
  expiresAt?: number;
  attempts?: number;
  status?: MessageDeliveryStatus;
}

/**
 * Message handler type definition
 */
export type MessageHandler<T = any> = (
  message: MessagePayload<T>, 
  acknowledge?: () => void
) => Promise<void>;

/**
 * Subscription options
 */
interface SubscriptionOptions {
  useAcknowledgment?: boolean;
  autoAcknowledge?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  enableCache?: boolean;
  useFilters?: boolean; // Whether to use Postgres filters or client-side filters
}

/**
 * Default subscription options
 */
const DEFAULT_SUBSCRIPTION_OPTIONS: SubscriptionOptions = {
  useAcknowledgment: false,
  autoAcknowledge: true,
  maxRetries: 3,
  retryDelay: 5000,
  enableCache: false,
  useFilters: true
};

/**
 * Statistics on message processing
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
 * Database indexing recommendations interface
 */
interface DatabaseIndexRecommendations {
  table: string;
  index: string;
  columns: string[];
  description: string;
}

/**
 * RLS policy recommendations interface
 */
interface RLSPolicyRecommendations {
  table: string;
  policyName: string;
  policyDefinition: string;
  description: string;
}

/**
 * Cache entry structure
 */
interface CacheEntry<T> {
  value: T;
  timestamp: number;
  expiresAt: number;
}

/**
 * Custom interface for Supabase client with Realtime support
 * This extends SupabaseClient to include the channel method that exists
 * in the runtime implementation but is missing from TypeScript definitions
 */
interface RealtimeSupabaseClient extends SupabaseClient {
  channel: (name: string) => SupabaseChannel;
}

/**
 * Custom RealtimeChannel interface for Supabase channels
 * This matches the functionality we need from Supabase Realtime
 */
interface SupabaseChannel {
  on: (event: string, config: any, callback: (payload: any) => void) => SupabaseChannel;
  subscribe: () => Promise<{ error?: Error }>;
  unsubscribe: () => void;
}

/**
 * Helper function to create a Supabase Realtime channel in a type-safe way
 */
function createChannel(client: SupabaseClient, name: string): SupabaseChannel {
  // We know the channel method exists at runtime, so this cast is safe
  // This approach centralizes the type assertion in one place for better maintainability
  return (client as unknown as RealtimeSupabaseClient).channel(name);
}

/**
 * Scalable Message Broker class following Supabase best practices
 */
export class ScalableMessageBroker {
  private supabase: SupabaseClient;
  private subscriptions: Map<string, { 
    handler: MessageHandler, 
    options: SubscriptionOptions,
    channel?: SupabaseChannel
  }> = new Map();
  
  private connected: boolean = false;
  private reconnecting: boolean = false;
  private processingMessages: Set<string> = new Set();
  private messageCache: Map<string, CacheEntry<MessagePayload>> = new Map();
  
  private pendingPublishes: Array<{
    queue: QueueType;
    type: string;
    data: any;
    source: string;
    priority?: number;
    expiresAt?: number;
    resolve: (success: boolean) => void;
  }> = [];
  
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private messageCleanupInterval: NodeJS.Timeout | null = null;
  private cacheCleanupInterval: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  
  private maxRetries: number = MAX_RETRY_COUNT;
  private retryAttempts: number = 0;
  private batchSize: number = MAX_BATCH_SIZE / 4; // Conservative default (25% of max)
  private persistenceEnabled: boolean = true;
  private realtimeEnabled: boolean = true;

  constructor() {
    // Get a fresh Supabase client
    this.supabase = supabaseClient.getClient();
    
    // Set up connection monitoring
    this.startHeartbeat();
    
    // Set up message cleanup
    this.startMessageCleanup();
    
    // Set up cache cleanup
    this.startCacheCleanup();
    
    // Initialize the connection
    this.initializeConnection();
    
    logger.info('Scalable message broker initialized with Supabase best practices');
  }

  /**
   * Initialize connection and setup
   */
  private async initializeConnection(): Promise<void> {
    try {
      // Check that required tables exist
      await this.ensureTablesExist();
      
      // Get recommended database indexing
      const indexing = this.getRecommendedIndexing();
      logger.info(`Recommended database indexing: ${JSON.stringify(indexing)}`);
      
      // Get recommended RLS policies
      const rlsPolicies = this.getRecommendedRLSPolicies();
      logger.info(`Recommended RLS policies: ${JSON.stringify(rlsPolicies)}`);
      
      // Mark as connected
      this.connected = true;
      
    } catch (err) {
      logger.error(`Failed to initialize connection: ${err}`);
      this.connected = false;
      this.handleConnectionLoss();
    }
  }

  /**
   * Ensure required tables exist (or create them)
   */
  private async ensureTablesExist(): Promise<void> {
    try {
      // First check if tables exist
      // Use type assertion to bypass TypeScript errors with method chaining
      const { data: tables, error } = await (this.supabase
        .from('message_broker_messages')
        .select('id') as any)
        .limit(1);
      
      if (error) {
        logger.warn(`Tables might not exist: ${error.message}`);
        // In a real implementation, we would create tables or notify admin
      }
    } catch (err) {
      logger.error(`Failed to check tables: ${err}`);
      throw err;
    }
  }

  /**
   * Get recommended database indexing for scaling
   */
  private getRecommendedIndexing(): DatabaseIndexRecommendations[] {
    return [
      {
        table: 'message_broker_messages',
        index: 'idx_messages_queue_type_status',
        columns: ['queue', 'type', 'status'],
        description: 'Optimizes filtering by queue, message type, and status'
      },
      {
        table: 'message_broker_messages',
        index: 'idx_messages_status_timestamp',
        columns: ['status', 'timestamp'],
        description: 'Optimizes queries for message cleanup and stats'
      },
      {
        table: 'message_broker_messages',
        index: 'idx_messages_expires_at',
        columns: ['expiresAt'],
        description: 'Optimizes queries for expired messages'
      },
      {
        table: 'message_broker_broadcasts',
        index: 'idx_broadcasts_timestamp',
        columns: ['timestamp'],
        description: 'Optimizes broadcasts by timestamp'
      }
    ];
  }

  /**
   * Get recommended RLS policies for security scaling
   */
  private getRecommendedRLSPolicies(): RLSPolicyRecommendations[] {
    return [
      {
        table: 'message_broker_messages',
        policyName: 'message_insert_policy',
        policyDefinition: '(auth.uid() IS NOT NULL)',
        description: 'Only authenticated users can insert messages'
      },
      {
        table: 'message_broker_messages',
        policyName: 'message_read_policy',
        policyDefinition: '(auth.uid() IS NOT NULL)',
        description: 'Only authenticated users can read messages'
      },
      {
        table: 'message_broker_broadcasts',
        policyName: 'broadcast_insert_policy',
        policyDefinition: '(auth.uid() IS NOT NULL)',
        description: 'Only authenticated users can broadcast messages'
      }
    ];
  }

  /**
   * Start a heartbeat to check connection status
   */
  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    this.heartbeatInterval = setInterval(async () => {
      try {
        // Try a simple query to check connection
        // Use type assertion to bypass TypeScript errors with method chaining
        const { error } = await (this.supabase
          .from('message_broker_status')
          .select('status') as any)
          .limit(1)
          .single();
        
        if (error) {
          logger.warn(`Supabase connection check failed: ${error.message}`);
          this.connected = false;
          this.handleConnectionLoss();
        } else {
          if (!this.connected) {
            logger.info('Supabase connection restored');
            this.connected = true;
            this.reconnecting = false;
            this.retryAttempts = 0;
            
            // Reestablish subscriptions
            await this.reestablishSubscriptions();
            
            // Process any pending publishes
            await this.processPendingPublishes();
          }
        }
      } catch (err) {
        logger.error(`Error in heartbeat check: ${err}`);
        this.connected = false;
        this.handleConnectionLoss();
      }
    }, 30000); // 30 seconds
  }

  /**
   * Start periodic cleanup of processed/expired messages
   */
  private startMessageCleanup(): void {
    if (this.messageCleanupInterval) {
      clearInterval(this.messageCleanupInterval);
    }
    
    this.messageCleanupInterval = setInterval(async () => {
      try {
        if (!this.connected || !this.persistenceEnabled) return;
        
        // Use a transaction for atomic cleanup operations
        const { error } = await this.supabase.rpc('cleanup_message_broker', {
          acknowledgment_cutoff_days: 1,
          expired_cutoff_timestamp: new Date().getTime()
        });
        
        if (error) {
          logger.error(`Failed to clean up messages: ${error.message}`);
          
          // Fallback to direct queries if RPC fails
          await this.fallbackMessageCleanup();
        }
      } catch (err) {
        logger.error(`Error in message cleanup: ${err}`);
      }
    }, 3600000); // 1 hour
  }
  
  /**
   * Fallback message cleanup when RPC fails
   */
  private async fallbackMessageCleanup(): Promise<void> {
    try {
      // Clean up acknowledged messages older than 24 hours
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      
      // Use pagination for large deletes
      let hasMore = true;
      let lastId: string | null = null;
      
      while (hasMore) {
        // Use type assertion to bypass TypeScript errors with method chaining
        let query = this.supabase
          .from('message_broker_messages')
          .delete() as any;
        
        query = query
          .eq('status', MessageDeliveryStatus.ACKNOWLEDGED)
          .lt('timestamp', oneDayAgo.getTime())
          .limit(PAGE_SIZE);
          
        if (lastId) {
          query = query.gt('id', lastId);
        }
        
        const { data, error } = await query;
        
        if (error) {
          logger.error(`Failed to clean up old messages: ${error.message}`);
          break;
        }
        
        hasMore = data && data.length === PAGE_SIZE;
        if (hasMore && data && data.length > 0) {
          lastId = data[data.length - 1].id;
        } else {
          hasMore = false;
        }
      }
      
      // Mark expired messages (using pagination)
      const now = new Date().getTime();
      hasMore = true;
      lastId = null;
      
      while (hasMore) {
        // Use type assertion to bypass TypeScript errors with method chaining
        let query = this.supabase
          .from('message_broker_messages')
          .update({ status: MessageDeliveryStatus.EXPIRED }) as any;
        
        query = query
          .lt('expiresAt', now)
          .neq('status', MessageDeliveryStatus.ACKNOWLEDGED)
          .limit(PAGE_SIZE);
          
        if (lastId) {
          query = query.gt('id', lastId);
        }
        
        const { data, error } = await query;
        
        if (error) {
          logger.error(`Failed to mark expired messages: ${error.message}`);
          break;
        }
        
        hasMore = data && data.length === PAGE_SIZE;
        if (hasMore && data && data.length > 0) {
          lastId = data[data.length - 1].id;
        } else {
          hasMore = false;
        }
      }
    } catch (err) {
      logger.error(`Error in fallback message cleanup: ${err}`);
    }
  }

  /**
   * Start periodic cache cleanup
   */
  private startCacheCleanup(): void {
    if (this.cacheCleanupInterval) {
      clearInterval(this.cacheCleanupInterval);
    }
    
    this.cacheCleanupInterval = setInterval(() => {
      try {
        const now = Date.now();
        let expiredCount = 0;
        
        // Clean expired entries
        for (const [key, entry] of this.messageCache.entries()) {
          if (entry.expiresAt <= now) {
            this.messageCache.delete(key);
            expiredCount++;
          }
        }
        
        // If cache is too large, remove oldest entries
        if (this.messageCache.size > MAX_CACHE_SIZE) {
          const entriesToRemove = this.messageCache.size - MAX_CACHE_SIZE;
          const entries = Array.from(this.messageCache.entries())
            .sort((a, b) => a[1].timestamp - b[1].timestamp)
            .slice(0, entriesToRemove);
            
          for (const [key] of entries) {
            this.messageCache.delete(key);
          }
          
          logger.info(`Cache pruned: removed ${entriesToRemove} oldest entries`);
        }
        
        if (expiredCount > 0) {
          logger.debug(`Cache cleanup: removed ${expiredCount} expired entries`);
        }
      } catch (err) {
        logger.error(`Error in cache cleanup: ${err}`);
      }
    }, 300000); // 5 minutes
  }

  /**
   * Handle connection loss events
   */
  private handleConnectionLoss(): void {
    if (this.reconnecting) return;
    
    this.reconnecting = true;
    logger.warn('Supabase connection lost, preparing for reconnection');
    
    // Close existing realtime channels
    for (const [key, subscription] of this.subscriptions.entries()) {
      if (subscription.channel) {
        try {
          subscription.channel.unsubscribe();
        } catch (err) {
          logger.error(`Error unsubscribing from channel ${key}: ${err}`);
        }
        
        // Mark as not having an active channel
        this.subscriptions.set(key, {
          ...subscription,
          channel: undefined
        });
      }
    }
    
    // Schedule reconnection attempt with exponential backoff
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    
    const backoffTime = this.calculateBackoff();
    logger.info(`Scheduling reconnection in ${backoffTime}ms`);
    
    this.reconnectTimeout = setTimeout(() => {
      this.attemptReconnection();
    }, backoffTime);
  }

  /**
   * Calculate exponential backoff time
   */
  private calculateBackoff(): number {
    // Exponential backoff with jitter
    const exponentialPart = Math.min(
      MAX_BACKOFF_MS,
      MIN_BACKOFF_MS * Math.pow(2, this.retryAttempts)
    );
    
    // Add some randomness (jitter) to prevent thundering herd problem
    const jitter = Math.random() * 0.3 * exponentialPart;
    
    this.retryAttempts++;
    return Math.floor(exponentialPart + jitter);
  }

  /**
   * Attempt to reconnect to Supabase
   */
  private async attemptReconnection(): Promise<void> {
    logger.info(`Attempting to reconnect to Supabase (attempt ${this.retryAttempts})`);
    
    try {
      // Get a fresh client
      this.supabase = supabaseClient.getClient();
      
      // Check connection with a simple query
      // Use type assertion to bypass TypeScript errors with method chaining
      const { error } = await (this.supabase
        .from('message_broker_status')
        .select('status') as any)
        .limit(1)
        .single();
      
      if (error) {
        logger.error(`Reconnection failed: ${error.message}`);
        
        // Schedule another attempt with exponential backoff
        if (this.retryAttempts < this.maxRetries) {
          if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
          }
          
          const backoffTime = this.calculateBackoff();
          logger.info(`Scheduling reconnection in ${backoffTime}ms`);
          
          this.reconnectTimeout = setTimeout(() => {
            this.attemptReconnection();
          }, backoffTime);
        } else {
          logger.error(`Maximum reconnection attempts (${this.maxRetries}) reached`);
          this.reconnecting = false;
          
          // Notify system of persistent connection failure
          // In production, this might trigger an alert or fallback
        }
      } else {
        logger.info('Reconnection successful');
        this.connected = true;
        this.reconnecting = false;
        this.retryAttempts = 0;
        
        // Reestablish subscriptions
        await this.reestablishSubscriptions();
        
        // Process any pending publishes
        await this.processPendingPublishes();
      }
    } catch (err) {
      logger.error(`Reconnection attempt failed with exception: ${err}`);
      
      // Schedule another attempt with exponential backoff
      if (this.retryAttempts < this.maxRetries) {
        if (this.reconnectTimeout) {
          clearTimeout(this.reconnectTimeout);
        }
        
        const backoffTime = this.calculateBackoff();
        
        this.reconnectTimeout = setTimeout(() => {
          this.attemptReconnection();
        }, backoffTime);
      } else {
        logger.error(`Maximum reconnection attempts (${this.maxRetries}) reached`);
        this.reconnecting = false;
      }
    }
  }

  /**
   * Reestablish all subscriptions after reconnection
   */
  private async reestablishSubscriptions(): Promise<void> {
    if (!this.realtimeEnabled) return;
    
    logger.info('Reestablishing subscriptions after reconnection');
    
    // Reestablish each subscription
    for (const [key, { handler, options }] of this.subscriptions.entries()) {
      const [queue, type] = key.split(':');
      try {
        const unsubscribe = await this.subscribeInternal(
          queue as QueueType,
          handler,
          type === '*' ? undefined : type,
          options
        );
        
        logger.info(`Reestablished subscription to ${queue}:${type}`);
      } catch (err) {
        logger.error(`Failed to reestablish subscription to ${queue}:${type}: ${err}`);
      }
    }
    
    // Check for any messages that were sent while disconnected
    await this.replayMissedMessages();
  }

  /**
   * Process any pending publish operations
   */
  private async processPendingPublishes(): Promise<void> {
    if (this.pendingPublishes.length === 0) return;
    
    logger.info(`Processing ${this.pendingPublishes.length} pending publish operations`);
    
    // Process in batches for efficiency
    const pendingBatches: Array<typeof this.pendingPublishes> = [];
    const pending = [...this.pendingPublishes];
    this.pendingPublishes = [];
    
    // Group into batches
    for (let i = 0; i < pending.length; i += this.batchSize) {
      pendingBatches.push(pending.slice(i, i + this.batchSize));
    }
    
    // Process each batch
    for (const batch of pendingBatches) {
      try {
        // Create batch of messages
        const messages = batch.map(pub => ({
          id: uuidv4(),
          queue: pub.queue,
          type: pub.type,
          data: pub.data,
          source: pub.source,
          timestamp: Date.now(),
          priority: pub.priority || 5,
          expiresAt: pub.expiresAt,
          status: MessageDeliveryStatus.PENDING,
          attempts: 0
        }));
        
        // Insert batch
        const { error } = await this.supabase
          .from('message_broker_messages')
          .insert(messages);
        
        if (error) {
          logger.error(`Failed to process pending publish batch: ${error.message}`);
          
          // Resolve all with failure
          for (const pub of batch) {
            pub.resolve(false);
          }
        } else {
          // Resolve all with success
          for (const pub of batch) {
            pub.resolve(true);
          }
        }
      } catch (err) {
        logger.error(`Error processing pending publish batch: ${err}`);
        
        // Resolve all with failure
        for (const pub of batch) {
          pub.resolve(false);
        }
      }
    }
  }

  /**
   * Internal method to subscribe to a channel using Supabase Realtime
   */
  private async subscribeInternal(
    queue: QueueType,
    handler: MessageHandler,
    type?: string,
    options: SubscriptionOptions = DEFAULT_SUBSCRIPTION_OPTIONS
  ): Promise<() => Promise<void>> {
    if (!this.realtimeEnabled) {
      logger.warn('Realtime is disabled, subscription will not receive real-time updates');
      
      // Return dummy unsubscribe function
      return async () => {
        logger.debug(`Dummy unsubscribe for ${queue}:${type || '*'} (realtime disabled)`);
      };
    }
    
    // Create a unique key for this subscription
    const key = `${queue}:${type || '*'}`;
    
    // Create a channel for this subscription using our type-safe helper function
    const channel = createChannel(this.supabase, `message-broker-${key}`);
    
    // Define filter for Postgres changes
    const baseFilter = options.useFilters
      ? { queue: { eq: queue } } 
      : undefined;
    
    // Add type filter if specified
    const filter = type && options.useFilters
      ? { ...baseFilter, type: { eq: type } }
      : baseFilter;
    
    // Build channel with Postgres changes
    channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message_broker_messages',
          filter
        },
        async (payload: { new: any }) => {
          const message = payload.new as MessagePayload;
          
          // Skip if already processing
          if (this.processingMessages.has(message.id)) {
            return;
          }
          
          // Apply client-side filter if not using database filters
          if (!options.useFilters && type && message.type !== type) {
            return;
          }
          
          // Check cache if enabled
          if (options.enableCache) {
            const cacheKey = `msg:${message.id}`;
            const cachedMessage = this.messageCache.get(cacheKey);
            
            if (cachedMessage) {
              // Skip if we've already processed this message
              return;
            }
            
            // Add to cache to prevent duplicate processing
            this.messageCache.set(cacheKey, {
              value: message,
              timestamp: Date.now(),
              expiresAt: Date.now() + 3600000 // 1 hour
            });
          }
          
          // Mark as processing to prevent duplicates
          this.processingMessages.add(message.id);
          
          // Update status to processing if using acknowledgments
          if (options.useAcknowledgment) {
            await this.updateMessageStatus(message.id, MessageDeliveryStatus.PROCESSING);
          }
          
          try {
            if (options.useAcknowledgment) {
              // With acknowledgment
              await handler(message, async () => {
                await this.acknowledgeMessage(message.id);
              });
              
              // Auto-acknowledge if enabled
              if (options.autoAcknowledge) {
                await this.acknowledgeMessage(message.id);
              }
            } else {
              // Without acknowledgment
              await handler(message);
              
              // Mark as delivered if persistence is enabled
              if (this.persistenceEnabled) {
                await this.updateMessageStatus(message.id, MessageDeliveryStatus.DELIVERED);
              }
              
              // Remove from processing set
              this.processingMessages.delete(message.id);
            }
          } catch (err) {
            logger.error(`Error handling message ${message.id}: ${err}`);
            
            if (this.persistenceEnabled) {
              // Increment attempts and maybe retry
              const attempts = (message.attempts || 0) + 1;
              const maxRetries = options.maxRetries || DEFAULT_SUBSCRIPTION_OPTIONS.maxRetries || 3;
              
              if (attempts <= maxRetries) {
                // Mark for retry
                await this.updateMessageForRetry(message.id, attempts);
                
                // Schedule retry after delay
                setTimeout(() => {
                  this.processingMessages.delete(message.id);
                }, options.retryDelay || DEFAULT_SUBSCRIPTION_OPTIONS.retryDelay || 5000);
              } else {
                // Mark as failed
                await this.updateMessageStatus(message.id, MessageDeliveryStatus.FAILED);
                this.processingMessages.delete(message.id);
              }
            } else {
              this.processingMessages.delete(message.id);
            }
          }
        }
      )
      .subscribe();
    
    // Store subscription info
    const unsubscribe = async () => {
      channel.unsubscribe();
      this.subscriptions.delete(key);
    };
    
    this.subscriptions.set(key, { 
      handler, 
      options,
      channel
    });
    
    return unsubscribe;
  }

  /**
   * Update the status of a message with proper error handling
   */
  private async updateMessageStatus(
    messageId: string, 
    status: MessageDeliveryStatus
  ): Promise<void> {
    if (!this.persistenceEnabled) return;
    
    try {
      // Use type assertion to bypass TypeScript errors with method chaining
      const { error } = await (this.supabase
        .from('message_broker_messages')
        .update({ status }) as any)
        .eq('id', messageId);
      
      if (error) {
        logger.error(`Failed to update message status: ${error.message}`);
      }
    } catch (err) {
      logger.error(`Error updating message status: ${err}`);
    }
  }

  /**
   * Update a message for retry with proper error handling
   */
  private async updateMessageForRetry(
    messageId: string, 
    attempts: number
  ): Promise<void> {
    if (!this.persistenceEnabled) return;
    
    try {
      // Use type assertion to bypass TypeScript errors with method chaining
      const { error } = await (this.supabase
        .from('message_broker_messages')
        .update({ 
          status: MessageDeliveryStatus.PENDING,
          attempts
        }) as any)
        .eq('id', messageId);
      
      if (error) {
        logger.error(`Failed to update message for retry: ${error.message}`);
      }
    } catch (err) {
      logger.error(`Error updating message for retry: ${err}`);
    }
  }

  /**
   * Acknowledge message processing completion
   */
  private async acknowledgeMessage(messageId: string): Promise<void> {
    // Remove from processing set
    this.processingMessages.delete(messageId);
    
    if (!this.persistenceEnabled) return;
    
    try {
      // Use type assertion to bypass TypeScript errors with method chaining
      const { error } = await (this.supabase
        .from('message_broker_messages')
        .update({ status: MessageDeliveryStatus.ACKNOWLEDGED }) as any)
        .eq('id', messageId);
      
      if (error) {
        logger.error(`Failed to acknowledge message: ${error.message}`);
      }
    } catch (err) {
      logger.error(`Failed to acknowledge message: ${err}`);
    }
  }

  /**
   * Internal method to publish a message with database safety
   */
  private async publishInternal(
    queue: QueueType,
    type: string,
    data: any,
    source: string,
    priority: number = 5,
    expiresAt?: number
  ): Promise<boolean> {
    if (!this.connected && !this.persistenceEnabled) {
      logger.warn(`Cannot publish message, not connected to Supabase`);
      return false;
    }
    
    try {
      // Calculate expiry if not provided
      if (!expiresAt) {
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + DEFAULT_EXPIRY_DAYS);
        expiresAt = expiryDate.getTime();
      }
      
      const message: MessagePayload = {
        id: uuidv4(),
        queue,
        type,
        data,
        source,
        timestamp: Date.now(),
        priority,
        expiresAt,
        status: MessageDeliveryStatus.PENDING,
        attempts: 0
      };
      
      if (this.persistenceEnabled) {
        // Store in Supabase for persistence
        const { error } = await this.supabase
          .from('message_broker_messages')
          .insert(message);
        
        if (error) {
          logger.error(`Failed to persist message: ${error.message}`);
          return false;
        }
      } else {
        // Direct broadcast if not using persistence
        await this.broadcastMessage(message);
      }
      
      return true;
    } catch (err) {
      logger.error(`Error publishing message: ${err}`);
      return false;
    }
  }

  /**
   * Broadcast a message directly through Supabase
   */
  private async broadcastMessage(message: MessagePayload): Promise<void> {
    try {
      // Use a broadcast table for real-time notification without persistence
      const { error } = await this.supabase
        .from('message_broker_broadcasts')
        .insert({
          id: message.id,
          payload: message,
          timestamp: Date.now()
        });
      
      if (error) {
        logger.error(`Failed to broadcast message: ${error.message}`);
      }
    } catch (err) {
      logger.error(`Failed to broadcast message: ${err}`);
    }
  }

  /**
   * Subscribe to messages of a specific type in a queue
   * 
   * @param queue Queue to subscribe to
   * @param handler Message handler function
   * @param type Optional message type filter
   * @param useAcknowledgment Whether to use acknowledgment for reliability
   * @returns Unsubscribe function
   */
  public async subscribe(
    queue: QueueType,
    handler: MessageHandler,
    type?: string,
    useAcknowledgment: boolean = false
  ): Promise<() => Promise<void>> {
    logger.info(`Subscribing to ${queue}:${type || '*'}`);
    
    const options: SubscriptionOptions = {
      ...DEFAULT_SUBSCRIPTION_OPTIONS,
      useAcknowledgment
    };
    
    return this.subscribeInternal(queue, handler, type, options);
  }

  /**
   * Subscribe with advanced options for scaling control
   * 
   * @param queue Queue to subscribe to
   * @param handler Message handler function
   * @param options Subscription options with scaling controls
   * @param type Optional message type filter
   * @returns Unsubscribe function
   */
  public async subscribeWithOptions(
    queue: QueueType,
    handler: MessageHandler,
    options: SubscriptionOptions,
    type?: string
  ): Promise<() => Promise<void>> {
    logger.info(`Subscribing to ${queue}:${type || '*'} with custom options`);
    
    return this.subscribeInternal(
      queue,
      handler,
      type,
      { ...DEFAULT_SUBSCRIPTION_OPTIONS, ...options }
    );
  }

  /**
   * Publish a message to a queue with scaling considerations
   * 
   * @param queue Queue to publish to
   * @param type Message type
   * @param data Message data
   * @param source Source identifier
   * @param priority Priority (0-9, higher is more important)
   * @param expiresAt Optional expiration timestamp
   * @returns Success indicator
   */
  public async publish(
    queue: QueueType,
    type: string,
    data: any,
    source: string,
    priority: number = 5,
    expiresAt?: number
  ): Promise<boolean> {
    // Log large payloads as warning
    const dataSize = JSON.stringify(data).length;
    if (dataSize > 100000) { // 100KB
      logger.warn(`Publishing large payload (${dataSize} bytes) - consider using storage for large data`);
    }
    
    // If not connected, queue the publish for later
    if (!this.connected) {
      return new Promise((resolve) => {
        this.pendingPublishes.push({
          queue, type, data, source, priority, expiresAt, resolve
        });
        
        logger.info(`Queued publish to ${queue}:${type} for later (not connected)`);
      });
    }
    
    return this.publishInternal(queue, type, data, source, priority, expiresAt);
  }

  /**
   * Publish multiple messages as a batch with optimized performance
   * 
   * @param messages Array of messages to publish
   * @returns Number of successfully published messages
   */
  public async publishBatch(
    messages: Array<{
      queue: QueueType;
      type: string;
      data: any;
      source: string;
      priority?: number;
      expiresAt?: number;
    }>
  ): Promise<number> {
    if (messages.length === 0) return 0;
    
    logger.info(`Publishing batch of ${messages.length} messages`);
    
    // Check if we're exceeded recommended batch size
    if (messages.length > this.batchSize) {
      logger.warn(`Batch size ${messages.length} exceeds recommended size ${this.batchSize}`);
      
      // Split into smaller batches to avoid Supabase limits
      let successCount = 0;
      
      for (let i = 0; i < messages.length; i += this.batchSize) {
        const batchSlice = messages.slice(i, i + this.batchSize);
        const batchCount = await this.publishBatch(batchSlice);
        successCount += batchCount;
      }
      
      return successCount;
    }
    
    if (!this.connected && !this.persistenceEnabled) {
      // Queue the publishes for later
      return new Promise((resolve) => {
        let successCount = 0;
        const resolvers: (() => void)[] = [];
        
        for (const msg of messages) {
          this.pendingPublishes.push({
            ...msg,
            resolve: (success) => {
              if (success) successCount++;
              resolvers.push(() => {});
            }
          });
        }
        
        // When all are resolved, return success count
        Promise.all(resolvers.map(r => r())).then(() => resolve(successCount));
      });
    }
    
    if (this.persistenceEnabled) {
      // Use batch insert with proper error handling
      try {
        // Set default expiry for messages without one
        const now = Date.now();
        const defaultExpiryDate = new Date();
        defaultExpiryDate.setDate(defaultExpiryDate.getDate() + DEFAULT_EXPIRY_DAYS);
        const defaultExpiresAt = defaultExpiryDate.getTime();
        
        // Create batch with proper defaults
        const batch = messages.map(msg => ({
          id: uuidv4(),
          queue: msg.queue,
          type: msg.type,
          data: msg.data,
          source: msg.source,
          timestamp: now,
          priority: msg.priority || 5,
          expiresAt: msg.expiresAt || defaultExpiresAt,
          status: MessageDeliveryStatus.PENDING,
          attempts: 0
        }));
        
        // Insert the batch
        const { error } = await this.supabase
          .from('message_broker_messages')
          .insert(batch);
        
        if (error) {
          logger.error(`Failed to publish batch: ${error.message}`);
          return 0;
        }
        
        return batch.length;
      } catch (err) {
        logger.error(`Error publishing batch: ${err}`);
        return 0;
      }
    } else {
      // Broadcast individually if not using persistence
      let successCount = 0;
      
      // Process in small chunks to avoid overwhelming the system
      const chunkSize = 10;
      
      for (let i = 0; i < messages.length; i += chunkSize) {
        const chunk = messages.slice(i, i + chunkSize);
        
        // Process chunk
        const results = await Promise.all(
          chunk.map(msg => 
            this.publishInternal(
              msg.queue,
              msg.type,
              msg.data,
              msg.source,
              msg.priority,
              msg.expiresAt
            )
          )
        );
        
        // Count successes
        successCount += results.filter(result => result).length;
      }
      
      return successCount;
    }
  }

  /**
   * Get comprehensive statistics about message processing with insights
   * 
   * @returns Enhanced message statistics with processing metrics
   */
  public async getMessageStats(): Promise<MessageStats> {
    if (!this.persistenceEnabled) {
      return {
        total: 0,
        delivered: 0,
        pending: 0,
        failed: 0,
        processing: 0,
        acknowledged: 0,
        expired: 0
      };
    }
    
    try {
      // Use RPC for efficient stats calculation
      const { data, error } = await this.supabase.rpc('get_message_broker_stats');
      
      if (error) {
        logger.error(`Failed to get message stats from RPC: ${error.message}`);
        
        // Fall back to direct query
        return this.getMessageStatsFallback();
      }
      
      if (!data) {
        return {
          total: 0,
          delivered: 0,
          pending: 0,
          failed: 0,
          processing: 0,
          acknowledged: 0,
          expired: 0
        };
      }
      
      // Convert the stats
      return {
        total: data.total || 0,
        delivered: data.delivered || 0,
        pending: data.pending || 0,
        failed: data.failed || 0,
        processing: data.processing || 0,
        acknowledged: data.acknowledged || 0,
        expired: data.expired || 0,
        oldestPending: data.oldest_pending ? new Date(data.oldest_pending) : undefined,
        newestPending: data.newest_pending ? new Date(data.newest_pending) : undefined,
        avgProcessingTime: data.avg_processing_time
      };
    } catch (err) {
      logger.error(`Failed to get message stats: ${err}`);
      
      // Fall back to direct query
      return this.getMessageStatsFallback();
    }
  }

  /**
   * Fallback method to get message stats when RPC fails
   */
  private async getMessageStatsFallback(): Promise<MessageStats> {
    try {
      // Get counts by status
      const { data, error } = await this.supabase
        .from('message_broker_messages')
        .select('status, timestamp');
      
      if (error) {
        logger.error(`Failed to get message stats: ${error.message}`);
        throw error;
      }
      
      // Calculate statistics from data
      const stats = {
        total: data?.length || 0,
        delivered: 0,
        pending: 0,
        failed: 0,
        processing: 0,
        acknowledged: 0,
        expired: 0
      };
      
      // Calculate timestamps for oldest and newest pending
      let oldestPending: number | undefined;
      let newestPending: number | undefined;
      
      if (data) {
        for (const msg of data) {
          // Count by status
          switch (msg.status) {
            case MessageDeliveryStatus.DELIVERED:
              stats.delivered++;
              break;
            case MessageDeliveryStatus.PENDING:
              stats.pending++;
              // Track timestamps for pending messages
              const timestamp = msg.timestamp as number;
              if (!oldestPending || timestamp < oldestPending) {
                oldestPending = timestamp;
              }
              if (!newestPending || timestamp > newestPending) {
                newestPending = timestamp;
              }
              break;
            case MessageDeliveryStatus.FAILED:
              stats.failed++;
              break;
            case MessageDeliveryStatus.PROCESSING:
              stats.processing++;
              break;
            case MessageDeliveryStatus.ACKNOWLEDGED:
              stats.acknowledged++;
              break;
            case MessageDeliveryStatus.EXPIRED:
              stats.expired++;
              break;
          }
        }
      }
      
      return {
        ...stats,
        oldestPending: oldestPending ? new Date(oldestPending) : undefined,
        newestPending: newestPending ? new Date(newestPending) : undefined
      };
    } catch (err) {
      logger.error(`Failed to get message stats fallback: ${err}`);
      
      // Return empty stats
      return {
        total: 0,
        delivered: 0,
        pending: 0,
        failed: 0,
        processing: 0,
        acknowledged: 0,
        expired: 0
      };
    }
  }

  /**
   * Check for and replay any missed messages with efficient batching
   * 
   * @param queue Optional queue to filter by
   * @param type Optional message type to filter by
   * @param filterFn Optional filter function
   * @returns Number of replayed messages
   */
  public async replayMissedMessages(
    queue?: QueueType,
    type?: string,
    filterFn?: (message: MessagePayload) => boolean
  ): Promise<number> {
    if (!this.persistenceEnabled) {
      return 0;
    }
    
    try {
      logger.info(`Checking for missed messages ${queue ? `in queue ${queue}` : ''} ${type ? `of type ${type}` : ''}`);
      
      // Build efficient query with filters directly in the database
      // Use type assertion to bypass TypeScript errors with method chaining
      let query = this.supabase
        .from('message_broker_messages')
        .select('*') as any;
      
      query = query.in('status', [MessageDeliveryStatus.PENDING, MessageDeliveryStatus.PROCESSING]);
      
      // Apply queue filter if provided
      if (queue) {
        query = query.eq('queue', queue);
      }
      
      // Apply type filter if provided
      if (type) {
        query = query.eq('type', type);
      }
      
      // Get messages with pagination for large results
      let allMessages: MessagePayload[] = [];
      let page = 0;
      let hasMore = true;
      
      while (hasMore) {
        // Get a page of results
        const { data, error } = await query
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
        
        if (error) {
          logger.error(`Failed to get missed messages: ${error.message}`);
          break;
        }
        
        if (!data || data.length === 0) {
          break;
        }
        
        // Add to our collection
        allMessages = allMessages.concat(data as MessagePayload[]);
        
        // Check if there might be more
        hasMore = data.length === PAGE_SIZE;
        page++;
        
        // Safety limit to avoid infinite loops
        if (page > 100) {
          logger.warn('Reached maximum pagination limit for missed messages');
          break;
        }
      }
      
      // Apply custom filter if provided
      const messagesToReplay = filterFn 
        ? allMessages.filter(filterFn) 
        : allMessages;
      
      logger.info(`Found ${messagesToReplay.length} missed messages to replay`);
      
      // Replay messages in batches for efficiency
      let replayCount = 0;
      
      // Process in small batches
      const batchSize = 20;
      for (let i = 0; i < messagesToReplay.length; i += batchSize) {
        const batch = messagesToReplay.slice(i, i + batchSize);
        
        // Process batch with concurrency limit
        const results = await Promise.all(
          batch.map(async (message) => {
            // Skip if already processing
            if (this.processingMessages.has(message.id)) {
              return false;
            }
            
            try {
              // Broadcast the message
              await this.broadcastMessage(message);
              return true;
            } catch (err) {
              logger.error(`Failed to replay message ${message.id}: ${err}`);
              return false;
            }
          })
        );
        
        // Count successes
        replayCount += results.filter(result => result).length;
      }
      
      logger.info(`Replayed ${replayCount} missed messages`);
      return replayCount;
    } catch (err) {
      logger.error(`Failed to replay missed messages: ${err}`);
      return 0;
    }
  }

  /**
   * Replay specific messages by ID with efficient batching
   * 
   * @param messageIds Array of message IDs to replay
   * @returns Number of successfully replayed messages
   */
  public async replayMessagesById(messageIds: string[]): Promise<number> {
    if (!this.persistenceEnabled || messageIds.length === 0) {
      return 0;
    }
    
    try {
      logger.info(`Replaying ${messageIds.length} specific messages by ID`);
      
      // Get messages by ID
      // Split into chunks to avoid Supabase query parameter limits
      const idChunks: string[][] = [];
      for (let i = 0; i < messageIds.length; i += 100) {
        idChunks.push(messageIds.slice(i, i + 100));
      }
      
      let allMessages: MessagePayload[] = [];
      
      // Get each chunk of messages
      for (const idChunk of idChunks) {
        // Use type assertion to bypass TypeScript errors with method chaining
        const { data, error } = await (this.supabase
          .from('message_broker_messages')
          .select('*') as any)
          .in('id', idChunk);
        
        if (error) {
          logger.error(`Failed to get messages by ID: ${error.message}`);
          continue;
        }
        
        if (data && data.length > 0) {
          allMessages = allMessages.concat(data as MessagePayload[]);
        }
      }
      
      if (allMessages.length === 0) {
        logger.warn(`None of the requested messages were found`);
        return 0;
      }
      
      logger.info(`Found ${allMessages.length} of ${messageIds.length} requested messages`);
      
      // Replay each message in batches
      let replayCount = 0;
      
      // Process in small batches
      const batchSize = 20;
      for (let i = 0; i < allMessages.length; i += batchSize) {
        const batch = allMessages.slice(i, i + batchSize);
        
        // Process batch with concurrency limit
        const results = await Promise.all(
          batch.map(async (message) => {
            // Skip if already processing
            if (this.processingMessages.has(message.id)) {
              return false;
            }
            
            try {
              // Broadcast the message
              await this.broadcastMessage(message);
              return true;
            } catch (err) {
              logger.error(`Failed to replay message ${message.id}: ${err}`);
              return false;
            }
          })
        );
        
        // Count successes
        replayCount += results.filter(result => result).length;
      }
      
      logger.info(`Replayed ${replayCount} messages by ID`);
      return replayCount;
    } catch (err) {
      logger.error(`Failed to replay messages by ID: ${err}`);
      return 0;
    }
  }

  /**
   * Configure the message broker for different scaling needs
   * 
   * @param options Configuration options
   */
  public configure(options: {
    persistenceEnabled?: boolean;
    realtimeEnabled?: boolean;
    batchSize?: number;
    maxRetries?: number;
  }): void {
    if (options.persistenceEnabled !== undefined) {
      this.persistenceEnabled = options.persistenceEnabled;
      logger.info(`Message persistence ${this.persistenceEnabled ? 'enabled' : 'disabled'}`);
    }
    
    if (options.realtimeEnabled !== undefined) {
      this.realtimeEnabled = options.realtimeEnabled;
      logger.info(`Realtime updates ${this.realtimeEnabled ? 'enabled' : 'disabled'}`);
    }
    
    if (options.batchSize !== undefined) {
      // Ensure batch size is within limits
      this.batchSize = Math.min(options.batchSize, MAX_BATCH_SIZE);
      logger.info(`Batch size set to ${this.batchSize}`);
    }
    
    if (options.maxRetries !== undefined) {
      this.maxRetries = options.maxRetries;
      logger.info(`Maximum retries set to ${this.maxRetries}`);
    }
  }

  /**
   * Get recommended database schema with indexing for scaling
   */
  public getScalingRecommendations(): {
    indexing: DatabaseIndexRecommendations[];
    rlsPolicies: RLSPolicyRecommendations[];
    scaling: string[];
  } {
    return {
      indexing: this.getRecommendedIndexing(),
      rlsPolicies: this.getRecommendedRLSPolicies(),
      scaling: [
        "Use Supabase Pro tier or higher for production workloads",
        "Enable connection pooling for high-volume applications",
        "Set up read replicas for read-heavy workloads",
        "Implement proper caching strategy with Redis or similar",
        "Set up database monitoring with proper alerting",
        "Use Edge Functions for processing-heavy operations",
        "Implement proper rate limiting on clients",
        "Consider sharding for very large datasets",
        "Use Supabase Storage for large message payloads",
        "Consider TTL-based cleanup for high-volume message systems"
      ]
    };
  }

  /**
   * Clean up resources when shutting down
   */
  public async close(): Promise<void> {
    logger.info('Closing scalable message broker connections and cleaning up resources');
    
    // Clear intervals
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    if (this.messageCleanupInterval) {
      clearInterval(this.messageCleanupInterval);
      this.messageCleanupInterval = null;
    }
    
    if (this.cacheCleanupInterval) {
      clearInterval(this.cacheCleanupInterval);
      this.cacheCleanupInterval = null;
    }
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    // Unsubscribe from all channels
    for (const [key, subscription] of this.subscriptions.entries()) {
      if (subscription.channel) {
        try {
          subscription.channel.unsubscribe();
          logger.debug(`Unsubscribed from channel ${key}`);
        } catch (err) {
          logger.error(`Error unsubscribing from channel ${key}: ${err}`);
        }
      }
    }
    
    // Clear collections
    this.subscriptions.clear();
    this.processingMessages.clear();
    this.messageCache.clear();
    this.pendingPublishes = [];
    
    // Close Supabase connection
    try {
      // Supabase JS client doesn't have an explicit close method,
      // but we could clear any auth state if needed
    } catch (err) {
      logger.error(`Error during close: ${err}`);
    }
    
    logger.info('Scalable message broker resources cleaned up');
  }
}

// Create singleton instance
export const scalableMessageBroker = new ScalableMessageBroker();
export default scalableMessageBroker;