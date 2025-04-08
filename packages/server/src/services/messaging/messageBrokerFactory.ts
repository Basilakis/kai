/**
 * Message Broker Factory
 * 
 * Factory pattern implementation for creating and managing message broker instances.
 * This enables easy switching between different implementations based on application needs.
 */

import { logger } from '../../utils/logger';
import { 
  IMessageBroker,
  MessageBrokerConfig
} from './messageBrokerInterface';
import { UnifiedMessageBroker } from './unifiedMessageBroker';

/**
 * Broker implementation type
 */
export enum BrokerImplementation {
  BASIC = 'basic',      // Basic features (lightweight, suitable for simple pub/sub)
  ENHANCED = 'enhanced', // Enhanced features (reliability, persistence, scaling capabilities)
  ADVANCED = 'advanced'  // Advanced features (full feature set with optimized performance)
}

/**
 * Broker selection criteria
 */
interface BrokerSelectionCriteria {
  implementation?: BrokerImplementation; // Specific implementation to use
  reliability?: 'basic' | 'enhanced' | 'high'; // Reliability level
  scaling?: 'none' | 'basic' | 'advanced';     // Scaling requirements
  features?: {                                 // Feature requirements
    acknowledgment?: boolean;                  // Message acknowledgment
    persistence?: boolean;                     // Message persistence
    batching?: boolean;                        // Batch operations
    statistics?: boolean;                      // Message statistics
    replay?: boolean;                          // Replay capabilities
    caching?: boolean;                         // Caching
  };
}

/**
 * Message Broker Factory
 * 
 * Provides a centralized way to create and manage message broker instances
 * based on application requirements.
 */
export class MessageBrokerFactory {
  private static instance: MessageBrokerFactory;
  private brokers: Map<string, IMessageBroker> = new Map();
  private defaultBroker: IMessageBroker | null = null;
  
  /**
   * Create a new Message Broker Factory
   */
  private constructor() {
    logger.info('Message Broker Factory initialized');
  }
  
  /**
   * Get the singleton instance
   * @returns Factory instance
   */
  public static getInstance(): MessageBrokerFactory {
    if (!MessageBrokerFactory.instance) {
      MessageBrokerFactory.instance = new MessageBrokerFactory();
    }
    return MessageBrokerFactory.instance;
  }
  
  /**
   * Create a message broker instance based on selection criteria
   * 
   * @param criteria Selection criteria
   * @param config Optional broker configuration
   * @returns Message broker instance
   */
  public createBroker(
    criteria: BrokerSelectionCriteria = {},
    config: Partial<MessageBrokerConfig> = {}
  ): IMessageBroker {
    // Determine which implementation to use based on criteria
    const implementation = this.determineBrokerImplementation(criteria);
    
    logger.info(`Creating ${implementation} message broker`);
    
    // Create the unified broker instance with appropriate configuration
    const broker = new UnifiedMessageBroker();
    
    // Configure the broker based on implementation type
    if (implementation === BrokerImplementation.BASIC) {
      // Configure for basic operation
      broker.configure({
        persistenceEnabled: false,
        realtimeEnabled: true,
        maxRetries: 1,
        ...config
      });
    } else if (implementation === BrokerImplementation.ADVANCED) {
      // Configure for advanced operation with all features enabled
      broker.configure({
        persistenceEnabled: true,
        realtimeEnabled: true,
        maxRetries: 3,
        batchSize: 100,
        reliability: 'high',
        scaling: 'advanced',
        caching: true,
        ...config
      });
    } else {
      // Apply enhanced configuration
      if (Object.keys(config).length > 0) {
        broker.configure(config);
      }
    }
    
    return broker;
  }
  
  /**
   * Get or create a named broker instance with the specified criteria
   * 
   * @param name Broker name
   * @param criteria Selection criteria
   * @param config Optional broker configuration
   * @returns Message broker instance
   */
  public getBroker(
    name: string,
    criteria: BrokerSelectionCriteria = {},
    config: Partial<MessageBrokerConfig> = {}
  ): IMessageBroker {
    if (!this.brokers.has(name)) {
      const broker = this.createBroker(criteria, config);
      this.brokers.set(name, broker);
    }
    
    return this.brokers.get(name)!;
  }
  
  /**
   * Get or create the default broker instance
   * 
   * @param criteria Selection criteria
   * @param config Optional broker configuration
   * @returns Default message broker instance
   */
  public getDefaultBroker(
    criteria: BrokerSelectionCriteria = {},
    config: Partial<MessageBrokerConfig> = {}
  ): IMessageBroker {
    if (!this.defaultBroker) {
      this.defaultBroker = this.createBroker(criteria, config);
      logger.info('Default message broker created');
    }
    
    return this.defaultBroker;
  }
  
  /**
   * Set the default broker instance
   * 
   * @param broker Message broker instance
   */
  public setDefaultBroker(broker: IMessageBroker): void {
    this.defaultBroker = broker;
    logger.info('Default message broker updated');
  }
  
  /**
   * Determine which broker implementation to use based on selection criteria
   * 
   * @param criteria Selection criteria
   * @returns Broker implementation to use
   */
  private determineBrokerImplementation(
    criteria: BrokerSelectionCriteria
  ): BrokerImplementation {
    // If specific implementation is requested, use it
    if (criteria.implementation) {
      return criteria.implementation;
    }
    
    // Otherwise, determine based on feature requirements
    
    // Check reliability requirements
    if (criteria.reliability === 'high' || criteria.reliability === 'enhanced') {
      return BrokerImplementation.ENHANCED;
    }
    
    // Check scaling requirements
    if (criteria.scaling === 'advanced' || criteria.scaling === 'basic') {
      return BrokerImplementation.ENHANCED;
    }
    
    // Check feature requirements
    const features = criteria.features || {};
    
    // Check for advanced features using a type-safe approach
    const needsAdvancedFeatures = 
      typeof criteria.implementation === 'string' && criteria.implementation === BrokerImplementation.ADVANCED;
      
    // Direct check for ADVANCED implementation
    if (needsAdvancedFeatures) {
      return BrokerImplementation.ADVANCED;
    }
    
    // If all required features are enabled, use ADVANCED
    const hasAllAdvancedFeatures = features.acknowledgment === true && 
                                 features.batching === true &&
                                 features.statistics === true &&
                                 features.replay === true &&
                                 features.caching === true;
    
    if (hasAllAdvancedFeatures) {
      return BrokerImplementation.ADVANCED;
    }
    
    // Any of these features requires at least the enhanced implementation
    if (
      features.acknowledgment ||
      features.batching ||
      features.statistics ||
      features.replay ||
      features.caching
    ) {
      // If all features are required, use ADVANCED
      if (
        features.acknowledgment &&
        features.batching &&
        features.statistics &&
        features.replay &&
        features.caching
      ) {
        return BrokerImplementation.ADVANCED;
      }
      
      return BrokerImplementation.ENHANCED;
    }
    
    // Default to basic implementation
    return BrokerImplementation.BASIC;
  }
  
  /**
   * Shutdown all broker instances
   */
  public async shutdownAll(): Promise<void> {
    const shutdownPromises: Promise<void>[] = [];
    
    // Shutdown all named brokers
    for (const [name, broker] of this.brokers) {
      logger.info(`Shutting down ${name} message broker`);
      shutdownPromises.push(broker.shutdown());
    }
    
    // Shutdown default broker if exists
    if (this.defaultBroker) {
      logger.info('Shutting down default message broker');
      shutdownPromises.push(this.defaultBroker.shutdown());
    }
    
    // Wait for all to shutdown
    await Promise.all(shutdownPromises);
    
    // Clear instances
    this.brokers.clear();
    this.defaultBroker = null;
    
    logger.info('All message brokers shutdown');
  }
}

// Export singleton instance
export const messageBrokerFactory = MessageBrokerFactory.getInstance();
export default messageBrokerFactory;