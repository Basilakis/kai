/**
 * Unified Message Broker
 * 
 * A consolidated implementation that combines the best features of both
 * the original MessageBroker and ScalableMessageBroker implementations,
 * while providing a consistent interface for all messaging needs.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger';
import { supabaseClient } from '../supabase/supabaseClient';
import {
  IEnhancedMessageBroker,
  MessageQueueType,
  MessageType,
  MessagePayload,
  MessageHandler,
  SubscriptionOptions,
  MessageStats,
  MessageDeliveryStatus,
  MessageBrokerConfig
} from './messageBrokerInterface';

// Constants for scaling configuration
const PAGE_SIZE = 100; // Pagination size for large queries
const MAX_BATCH_SIZE = 1000; // Maximum batch insert size (Supabase limit)
const DEFAULT_EXPIRY_DAYS = 7; // Default message expiry in days
const MAX_RETRY_COUNT = 5; // Maximum retry attempts
const MIN_BACKOFF_MS = 1000; // Minimum backoff time in ms
const MAX_BACKOFF_MS = 60000; // Maximum backoff time in ms
const MAX_CACHE_SIZE = 1000; // Maximum in-memory cache size

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
 * Cache entry structure
 */
interface CacheEntry<T> {
  value: T;
  timestamp: number;
  expiresAt: number;
}

/**
 * Custom interface for Supabase client with Realtime support
 */
interface RealtimeSupabaseClient extends SupabaseClient {
  channel: (name: string) => SupabaseChannel;
}

/**
 * Custom RealtimeChannel interface for Supabase channels
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
  return (client as unknown as RealtimeSupabaseClient).channel(name);
}

/**
 * Unified Message Broker class that implements the enhanced interface
 */
export class UnifiedMessageBroker implements IEnhancedMessageBroker {
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
    queue: MessageQueueType;
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

  /**
   * Create a new Unified Message Broker
   * @param config Optional configuration
   */
  constructor(config?: Partial<MessageBrokerConfig>) {
    // Get a fresh Supabase client
    this.supabase = supabaseClient.getClient();
    
    // Apply configuration if provided
    if (config) {
      this.configure(config);
    }
    
    // Set up connection monitoring
    this.startHeartbeat();
    
    // Set up message cleanup
    this.startMessageCleanup();
    
    // Set up cache cleanup
    this.startCacheCleanup();
    
    // Initialize the connection
    this.initializeConnection();
    
    logger.info('Unified message broker initialized');
  }

  /**
   * Initialize connection and setup
   */
  private async initializeConnection(): Promise<void> {
    try {
      // Check that required tables exist
      await this.ensureTablesExist();
      
      // Mark as connected
      this.connected = true;
      
    } catch (err) {
      logger.error(`Failed to initialize connection: ${err}`);
      this.connected = false;
      this.handleConnectionLoss();
    }
  }

  /**
   * Ensure required tables exist
   */
  private async ensureTablesExist(): Promise<void> {
    try {
      // First check if tables exist
      const { error } = await (this.supabase
        .from('message_broker_messages') as any)
        .select('id')
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
   * Start a heartbeat to check connection status
   */
  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    this.heartbeatInterval = setInterval(async () => {
      try {
        // Try a simple query to check connection
        const { error } = await (this.supabase
          .from('message_broker_status') as any)
          .select('status')
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
      const { error } = await (this.supabase
        .from('message_broker_status') as any)
        .select('status')
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
        await this.subscribeInternal(
          queue as MessageQueueType,
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
    queue: MessageQueueType,
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
          if (this.processingMessages.has(message.id!)) {
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
          this.processingMessages.add(message.id!);
          
          // Update status to processing if using acknowledgments
          if (options.useAcknowledgment) {
            await this.updateMessageStatus(message.id!, MessageDeliveryStatus.PROCESSING);
          }
          
          try {
            if (options.useAcknowledgment) {
              // With acknowledgment
              await handler(message, async () => {
                await this.acknowledgeMessage(message.id!);
              });
              
              // Auto-acknowledge if enabled
              if (options.autoAcknowledge) {
                await this.acknowledgeMessage(message.id!);
              }
            } else {
              // Without acknowledgment
              await handler(message);
              
              // Mark as delivered if persistence is enabled
              if (this.persistenceEnabled) {
                await this.updateMessageStatus(message.id!, MessageDeliveryStatus.DELIVERED);
              }
              
              // Remove from processing set
              this.processingMessages.delete(message.id!);
            }
          } catch (err) {
            logger.error(`Error handling message ${message.id}: ${err}`);
            
            if (this.persistenceEnabled) {
              // Increment attempts and maybe retry
              const attempts = (message.attempts || 0) + 1;
              const maxRetries = options.maxRetries || DEFAULT_SUBSCRIPTION_OPTIONS.maxRetries || 3;
              
              if (attempts <= maxRetries) {
                // Mark for retry
                await this.updateMessageForRetry(message.id!, attempts);
                
                // Schedule retry after delay
                setTimeout(() => {
                  this.processingMessages.delete(message.id!);
                }, options.retryDelay || DEFAULT_SUBSCRIPTION_OPTIONS.retryDelay || 5000);
              } else {
                // Mark as failed
                await this.updateMessageStatus(message.id!, MessageDeliveryStatus.FAILED);
                this.processingMessages.delete(message.id!);
              }
            } else {
              this.processingMessages.delete(message.id!);
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
   * Update the status of a message
   */
  private async updateMessageStatus(
    messageId: string, 
    status: MessageDeliveryStatus
  ): Promise<void> {
    if (!this.persistenceEnabled) return;
    
    try {
      const { error } = await (this.supabase
        .from('message_broker_messages') as any)
        .update({ status })
        .eq('id', messageId);
      
      if (error) {
        logger.error(`Failed to update message status: ${error.message}`);
      }
    } catch (err) {
      logger.error(`Error updating message status: ${err}`);
    }
  }

  /**
   * Update a message for retry
   */
  private async updateMessageForRetry(
    messageId: string, 
    attempts: number
  ): Promise<void> {
    if (!this.persistenceEnabled) return;
    
    try {
      const { error } = await (this.supabase
        .from('message_broker_messages') as any)
        .update({ 
          status: MessageDeliveryStatus.PENDING,
          attempts
        })
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
      const { error } = await (this.supabase
        .from('message_broker_messages') as any)
        .update({ status: MessageDeliveryStatus.ACKNOWLEDGED })
        .eq('id', messageId);
      
      if (error) {
        logger.error(`Failed to acknowledge message: ${error.message}`);
      }
    } catch (err) {
      logger.error(`Failed to acknowledge message: ${err}`);
    }
  }

  /**
   * Internal method to publish a message
   */
  private async publishInternal<T = any>(
    queue: MessageQueueType,
    type: string,
    data: T,
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
   * Implementation of IMessageBroker's subscribe method
   */
  public async subscribe<T = any>(
    queue: MessageQueueType,
    handler: MessageHandler<T>,
    type?: MessageType | string
  ): Promise<() => Promise<void>> {
    logger.info(`Subscribing to ${queue}:${type || '*'}`);
    
    const options: SubscriptionOptions = {
      ...DEFAULT_SUBSCRIPTION_OPTIONS
    };
    
    return this.subscribeInternal(queue, handler as MessageHandler, type, options);
  }

  /**
   * Implementation of IEnhancedMessageBroker's subscribeWithOptions method
   */
  public async subscribeWithOptions<T = any>(
    queue: MessageQueueType,
    handler: MessageHandler<T>,
    options: SubscriptionOptions,
    type?: MessageType | string
  ): Promise<() => Promise<void>> {
    logger.info(`Subscribing to ${queue}:${type || '*'} with custom options`);
    
    return this.subscribeInternal(
      queue,
      handler as MessageHandler,
      type,
      { ...DEFAULT_SUBSCRIPTION_OPTIONS, ...options }
    );
  }

  /**
   * Implementation of IMessageBroker's publish method
   */
  public async publish<T = any>(
    queue: MessageQueueType,
    type: MessageType | string,
    data: T,
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
   * Implementation of IEnhancedMessageBroker's publishBatch method
   */
  public async publishBatch<T = any>(
    messages: Array<{
      queue: MessageQueueType;
      type: MessageType | string;
      data: T;
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
   * Implementation of IEnhancedMessageBroker's getMessageStats method
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
   * Implementation of IEnhancedMessageBroker's replayMissedMessages method
   */
  public async replayMissedMessages(
    queue?: MessageQueueType,
    type?: MessageType | string,
    filterFn?: (message: MessagePayload) => boolean
  ): Promise<number> {
    if (!this.persistenceEnabled) {
      return 0;
    }
    
    try {
      logger.info(`Checking for missed messages ${queue ? `in queue ${queue}` : ''} ${type ? `of type ${type}` : ''}`);
      
      // Build efficient query with filters directly in the database
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
            if (this.processingMessages.has(message.id!)) {
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
   * Implementation of IEnhancedMessageBroker's configure method
   */
  public configure(options: Partial<MessageBrokerConfig>): void {
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
   * Implementation of IMessageBroker's shutdown method
   */
  public async shutdown(): Promise<void> {
    logger.info('Closing unified message broker connections and cleaning up resources');
    
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
    
    logger.info('Unified message broker resources cleaned up');
  }
}

// Export singleton instance
export const unifiedMessageBroker = new UnifiedMessageBroker();
export default unifiedMessageBroker;