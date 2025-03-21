/**
 * Queue Events Service
 * 
 * Provides real-time queue events using Supabase Realtime
 * for the admin dashboard and other components.
 */

import supabaseClient from './supabaseClient';
import { RealtimeChannel } from '@supabase/supabase-js';

// Event types
export enum QueueEventType {
  JOB_ADDED = 'job_added',
  JOB_STARTED = 'job_started',
  JOB_PROGRESS = 'job_progress',
  JOB_COMPLETED = 'job_completed',
  JOB_FAILED = 'job_failed',
  JOB_CANCELED = 'job_canceled',
  JOB_RETRIED = 'job_retried',
}

// Queue systems
export enum QueueSystem {
  PDF = 'pdf',
  CRAWLER = 'crawler',
}

// Event data interface
export interface QueueEvent {
  type: QueueEventType;
  system: QueueSystem;
  jobId: string;
  data?: any;
  timestamp: number;
}

/**
 * Queue Events Service
 */
class QueueEventsService {
  private static instance: QueueEventsService;
  private channels: Map<string, RealtimeChannel> = new Map();
  private eventHandlers: Map<string, Set<(event: QueueEvent) => void>> = new Map();
  private isInitialized = false;
  
  /**
   * Create a new Queue Events Service
   */
  private constructor() {
    // Private constructor for singleton pattern
  }
  
  /**
   * Get the singleton instance
   * @returns Queue Events Service instance
   */
  public static getInstance(): QueueEventsService {
    if (!QueueEventsService.instance) {
      QueueEventsService.instance = new QueueEventsService();
    }
    return QueueEventsService.instance;
  }
  
  /**
   * Initialize the service
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }
    
    try {
      const supabase = supabaseClient.getClient();
      
      // Initialize channels for PDF and Crawler queues
      this.setupChannel(QueueSystem.PDF);
      this.setupChannel(QueueSystem.CRAWLER);
      
      this.isInitialized = true;
      console.info('Queue Events Service initialized with Supabase Realtime');
    } catch (err) {
      console.error('Failed to initialize Queue Events Service:', err);
      throw err;
    }
  }
  
  /**
   * Setup a Supabase Realtime channel for a queue system
   * @param system Queue system
   */
  private setupChannel(system: QueueSystem): void {
    const channelName = `queue_events_${system}`;
    const supabase = supabaseClient.getClient();
    
    // Create Realtime channel
    const channel = supabase.channel(channelName);
    
    // Subscribe to broadcasts on this channel
    channel
      .on('broadcast', { event: '*' }, (payload: { payload: QueueEvent }) => {
        try {
          const event = payload.payload as QueueEvent;
          this.handleEvent(event);
        } catch (err) {
          console.error(`Error handling event from ${system} queue:`, err);
        }
      })
      .subscribe((status: 'SUBSCRIBED' | 'CLOSED' | 'CHANNEL_ERROR' | string) => {
        if (status === 'SUBSCRIBED') {
          console.info(`Subscribed to ${system} queue events`);
        } else if (status === 'CLOSED') {
          console.info(`Disconnected from ${system} queue events`);
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`Error connecting to ${system} queue events`);
        }
      });
    
    this.channels.set(system, channel);
  }
  
  /**
   * Handle an incoming event
   * @param event Queue event
   */
  private handleEvent(event: QueueEvent): void {
    // Get handlers for this event type
    const typeKey = `${event.system}:${event.type}`;
    const handlers = this.eventHandlers.get(typeKey) || new Set();
    
    // Get handlers for all events of this system
    const systemKey = `${event.system}:*`;
    const systemHandlers = this.eventHandlers.get(systemKey) || new Set();
    
    // Get handlers for all events
    const allKey = '*';
    const allHandlers = this.eventHandlers.get(allKey) || new Set();
    
    // Call all matching handlers
    handlers.forEach(handler => handler(event));
    systemHandlers.forEach(handler => handler(event));
    allHandlers.forEach(handler => handler(event));
  }
  
  /**
   * Subscribe to queue events
   * @param system Queue system or '*' for all systems
   * @param eventType Event type or '*' for all event types
   * @param handler Event handler function
   * @returns Unsubscribe function
   */
  public subscribe(
    system: QueueSystem | '*', 
    eventType: QueueEventType | '*', 
    handler: (event: QueueEvent) => void
  ): () => void {
    if (!this.isInitialized) {
      this.initialize().catch(err => {
        console.error('Failed to initialize Queue Events Service:', err);
      });
    }
    
    const key = `${system}:${eventType}`;
    if (!this.eventHandlers.has(key)) {
      this.eventHandlers.set(key, new Set());
    }
    
    this.eventHandlers.get(key)!.add(handler);
    
    // Return unsubscribe function
    return () => {
      const handlers = this.eventHandlers.get(key);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.eventHandlers.delete(key);
        }
      }
    };
  }
  
  /**
   * Unsubscribe all handlers for a specific system and event type
   * @param system Queue system or '*' for all systems
   * @param eventType Event type or '*' for all event types
   */
  public unsubscribeAll(system: QueueSystem | '*', eventType: QueueEventType | '*'): void {
    const key = `${system}:${eventType}`;
    this.eventHandlers.delete(key);
  }
  
  /**
   * Close all channels and clean up
   */
  public async close(): Promise<void> {
    for (const [system, channel] of this.channels.entries()) {
      await channel.unsubscribe();
      console.info(`Unsubscribed from ${system} queue events`);
    }
    
    this.channels.clear();
    this.eventHandlers.clear();
    this.isInitialized = false;
  }
}

// Export singleton instance
export const queueEventsService = QueueEventsService.getInstance();
export default queueEventsService;