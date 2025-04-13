/**
 * Supabase Message Broker Service
 *
 * Provides a pub/sub message broker system using Supabase Realtime for inter-process
 * and inter-service communication, supporting multiple channels for different queue types.
 */

import { RealtimeChannel, RealtimeChannelStatus, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { logger } from '../../utils/logger';
import supabaseClient from '../supabase/supabaseClient';

/**
 * Queue types for message broker
 */
export type MessageQueueType = 'pdf' | 'crawler' | 'system';

/**
 * Message types that can be published/subscribed to
 */
export type MessageType =
  | 'job-added'
  | 'job-started'
  | 'job-completed'
  | 'job-failed'
  | 'job-progress'
  | 'knowledge-base-event';

/**
 * Message payload structure
 */
export interface MessagePayload<T = any> {
  queue: MessageQueueType;
  type: MessageType;
  data: T;
  source: string;
  timestamp: number;
}

/**
 * Message handler function type
 */
export type MessageHandler<T = any> = (message: MessagePayload<T>) => Promise<void> | void;

/**
 * Maps queue+type combinations to their Supabase Realtime channels
 */
type ChannelMap = Map<string, {
  channel: RealtimeChannel;
  handlers: Map<string, MessageHandler>;
}>;

/**
 * Supabase Message Broker
 *
 * Provides a pub/sub system for messaging between services using Supabase Realtime
 */
export class MessageBroker {
  private channels: ChannelMap = new Map();
  private isInitialized: boolean = false;

  /**
   * Create a new Message Broker
   */
  constructor() {
    logger.info('Supabase message broker created');
  }

  /**
   * Initialize the message broker if needed
   */
  private async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // We don't need any specific initialization for Supabase Realtime
      // as channels are created on-demand
      this.isInitialized = true;
      logger.info('Supabase message broker initialized');
    } catch (err) {
      logger.error(`Failed to initialize Supabase message broker: ${err}`);
      throw err;
    }
  }

  /**
   * Get a channel key for a queue and event type
   * @param queue Queue type
   * @param type Event type (optional)
   * @returns Channel key
   */
  private getChannelKey(queue: MessageQueueType, type?: MessageType): string {
    return type ? `${queue}:${type}` : queue;
  }

  /**
   * Create or get a Supabase Realtime channel
   * @param channelKey Channel key
   * @returns Realtime channel and handlers map
   */
  private async getOrCreateChannel(channelKey: string): Promise<{
    channel: RealtimeChannel;
    handlers: Map<string, MessageHandler>;
  }> {
    await this.initialize();

    let channelData = this.channels.get(channelKey);

    if (!channelData) {
      const client = supabaseClient.getClient();

      // Create a new Supabase Realtime channel
      const channel = client.channel(`queue:${channelKey}`, {
        config: {
          broadcast: {
            self: false
          }
        }
      });

      // Create handlers map
      const handlers = new Map<string, MessageHandler>();

      // Store channel data
      channelData = { channel, handlers };
      this.channels.set(channelKey, channelData);

      // Set up channel event handler
      channel
        .on('broadcast', { event: 'message' }, (payload: { payload: unknown }) => {
          const message = payload.payload as MessagePayload;

          // Call all handlers for this channel
          handlers.forEach(handler => {
            try {
              handler(message);
            } catch (err) {
              logger.error(`Error in message handler: ${err}`);
            }
          });
        })
        .subscribe((status: RealtimeChannelStatus) => {
          if (status === 'SUBSCRIBED') {
            logger.info(`Subscribed to Supabase Realtime channel: ${channelKey}`);
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            logger.warn(`Supabase Realtime channel ${channelKey} status: ${status}`);
          }
        });
    }

    return channelData;
  }

  /**
   * Publish a message to a channel
   * @param queue Queue type
   * @param type Message type
   * @param data Message data
   * @param source Source identifier
   * @returns Success flag
   */
  public async publish<T = any>(
    queue: MessageQueueType,
    type: MessageType,
    data: T,
    source: string = 'unknown'
  ): Promise<boolean> {
    try {
      const channelKey = this.getChannelKey(queue, type);
      const { channel } = await this.getOrCreateChannel(channelKey);

      // Create message payload
      const message: MessagePayload<T> = {
        queue,
        type,
        data,
        source,
        timestamp: Date.now()
      };

      // Publish message to Supabase Realtime channel
      await channel.send({
        type: 'broadcast',
        event: 'message',
        payload: message
      });

      logger.debug(`Published message to ${channelKey}: ${JSON.stringify(message)}`);
      return true;
    } catch (err) {
      logger.error(`Failed to publish message: ${err}`);
      return false;
    }
  }

  /**
   * Subscribe to messages
   * @param queue Queue type to subscribe to
   * @param handler Message handler function
   * @param type Specific message type to filter by (optional)
   * @returns Unsubscribe function
   */
  public async subscribe<T = any>(
    queue: MessageQueueType,
    handler: MessageHandler<T>,
    type?: MessageType
  ): Promise<() => Promise<void>> {
    const channelKey = this.getChannelKey(queue, type);
    const { handlers } = await this.getOrCreateChannel(channelKey);

    // Generate a unique handler ID
    const handlerId = `handler-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Store the handler
    handlers.set(handlerId, (message: MessagePayload) => {
      // If a specific type was requested, filter messages
      if (type && message.type !== type) {
        return;
      }

      handler(message as MessagePayload<T>);
    });

    logger.info(`Subscribed to ${channelKey} messages with handler ${handlerId}`);

    // Return unsubscribe function
    return async () => {
      handlers.delete(handlerId);

      logger.info(`Unsubscribed handler ${handlerId} from ${channelKey}`);

      // If no more handlers for this channel, clean up the channel
      if (handlers.size === 0) {
        const channelData = this.channels.get(channelKey);
        if (channelData) {
          await channelData.channel.unsubscribe();
          this.channels.delete(channelKey);

          logger.info(`Removed Supabase Realtime channel ${channelKey}`);
        }
      }
    };
  }

  /**
   * Clean up all channels and subscriptions
   */
  public async shutdown(): Promise<void> {
    const closePromises: Promise<void>[] = [];

    // Close all channels
    for (const [key, { channel }] of this.channels.entries()) {
      closePromises.push(
        channel.unsubscribe()
          .then(() => {
            logger.info(`Closed Supabase Realtime channel: ${key}`);
          })
          .catch((err: Error) => {
            logger.error(`Error closing Supabase Realtime channel ${key}: ${err}`);
          })
      );
    }

    // Wait for all channels to close
    await Promise.all(closePromises);

    // Clear channels map
    this.channels.clear();
    this.isInitialized = false;

    logger.info('Supabase message broker shutdown complete');
  }
}

// Create singleton instance
export const messageBroker = new MessageBroker();
export default messageBroker;