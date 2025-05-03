/**
 * HPA Event Logger Service
 * 
 * This service monitors and logs Horizontal Pod Autoscaler (HPA) events,
 * providing detailed information about scaling decisions and their triggers.
 */

import { Logger } from 'winston';
import { createLogger } from '../utils/logger';
import * as k8s from '@kubernetes/client-node';
import { Redis } from 'ioredis';

/**
 * HPA event type
 */
export type HpaEventType = 'scale-up' | 'scale-down' | 'no-scale' | 'limited-scale';

/**
 * HPA event
 */
export interface HpaEvent {
  service: string;
  eventType: HpaEventType;
  currentReplicas: number;
  desiredReplicas: number;
  actualReplicas: number;
  triggerMetric: string;
  triggerValue: number;
  triggerThreshold: number;
  limitingFactor?: string;
  timestamp: number;
}

/**
 * HPA Event Logger Service
 */
export class HpaEventLoggerService {
  private logger: Logger;
  private k8sApi: k8s.CustomObjectsApi;
  private coreApi: k8s.CoreV1Api;
  private redis: Redis;
  private namespace: string;
  private checkInterval: NodeJS.Timeout | null = null;
  private lastEventTimes: Map<string, number> = new Map();
  
  /**
   * Create a new HpaEventLoggerService
   */
  constructor(redisUrl?: string, namespace = 'kai-ml') {
    this.logger = createLogger('hpa-event-logger-service');
    
    // Initialize Kubernetes client
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();
    this.k8sApi = kc.makeApiClient(k8s.CustomObjectsApi);
    this.coreApi = kc.makeApiClient(k8s.CoreV1Api);
    
    // Initialize Redis client
    this.redis = new Redis(redisUrl || process.env.REDIS_URL || 'redis://localhost:6379');
    
    this.namespace = namespace;
    
    this.logger.info('HPA event logger service initialized');
  }
  
  /**
   * Start the HPA event logger service
   */
  public start(): void {
    // Check for HPA events every 30 seconds
    this.checkInterval = setInterval(() => {
      this.checkHpaEvents();
    }, 30 * 1000); // 30 seconds
    
    this.logger.info('HPA event logger service started');
    
    // Check for HPA events immediately
    this.checkHpaEvents();
  }
  
  /**
   * Stop the HPA event logger service
   */
  public stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    
    this.logger.info('HPA event logger service stopped');
  }
  
  /**
   * Check for HPA events
   */
  private async checkHpaEvents(): Promise<void> {
    try {
      this.logger.debug('Checking for HPA events');
      
      // Get all HPAs in the namespace
      const response = await this.k8sApi.listNamespacedCustomObject(
        'autoscaling.k8s.io',
        'v2',
        this.namespace,
        'horizontalpodautoscalers'
      );
      
      const hpas = response.body as {
        items: any[];
      };
      
      if (!hpas.items || hpas.items.length === 0) {
        this.logger.debug('No HPAs found');
        return;
      }
      
      // Process each HPA
      for (const hpa of hpas.items) {
        await this.processHpa(hpa);
      }
    } catch (error) {
      this.logger.error('Error checking for HPA events', { error });
    }
  }
  
  /**
   * Process an HPA
   */
  private async processHpa(hpa: any): Promise<void> {
    try {
      const name = hpa.metadata?.name;
      const service = name.replace(/-hpa$/, '');
      
      if (!name) {
        this.logger.warn('HPA has no name', { hpa });
        return;
      }
      
      // Get current and desired replicas
      const currentReplicas = hpa.status?.currentReplicas || 0;
      const desiredReplicas = hpa.status?.desiredReplicas || currentReplicas;
      
      // Get actual replicas from deployment
      const actualReplicas = await this.getDeploymentReplicas(service);
      
      // Check if there's a scaling event
      if (currentReplicas !== desiredReplicas || currentReplicas !== actualReplicas) {
        // Determine event type
        let eventType: HpaEventType;
        let limitingFactor: string | undefined;
        
        if (desiredReplicas > currentReplicas) {
          eventType = 'scale-up';
          
          // Check if scale-up is limited
          if (desiredReplicas > actualReplicas) {
            eventType = 'limited-scale';
            limitingFactor = 'resource-constraints';
          }
        } else if (desiredReplicas < currentReplicas) {
          eventType = 'scale-down';
        } else {
          eventType = 'no-scale';
        }
        
        // Get trigger metric
        const triggerMetric = this.getTriggerMetric(hpa);
        const triggerValue = this.getTriggerValue(hpa, triggerMetric);
        const triggerThreshold = this.getTriggerThreshold(hpa, triggerMetric);
        
        // Create event
        const event: HpaEvent = {
          service,
          eventType,
          currentReplicas,
          desiredReplicas,
          actualReplicas,
          triggerMetric,
          triggerValue,
          triggerThreshold,
          limitingFactor,
          timestamp: Date.now()
        };
        
        // Check if this is a new event
        const lastEventTime = this.lastEventTimes.get(service) || 0;
        const timeSinceLastEvent = Date.now() - lastEventTime;
        
        // Only log events that are at least 5 minutes apart
        if (timeSinceLastEvent > 5 * 60 * 1000) {
          // Log event
          await this.logEvent(event);
          
          // Update last event time
          this.lastEventTimes.set(service, Date.now());
        }
      }
    } catch (error) {
      this.logger.error('Error processing HPA', { error, hpa });
    }
  }
  
  /**
   * Get deployment replicas
   */
  private async getDeploymentReplicas(service: string): Promise<number> {
    try {
      const response = await this.coreApi.readNamespacedDeployment(
        service,
        this.namespace
      );
      
      return response.body.status?.availableReplicas || 0;
    } catch (error) {
      this.logger.error('Error getting deployment replicas', { error, service });
      return 0;
    }
  }
  
  /**
   * Get trigger metric
   */
  private getTriggerMetric(hpa: any): string {
    try {
      // Check if there's a specific metric in the status
      if (hpa.status?.currentMetrics && hpa.status.currentMetrics.length > 0) {
        const metric = hpa.status.currentMetrics[0];
        
        if (metric.resource) {
          return `resource:${metric.resource.name}`;
        }
        
        if (metric.pods) {
          return `pods:${metric.pods.metric.name}`;
        }
        
        if (metric.object) {
          return `object:${metric.object.metric.name}`;
        }
        
        if (metric.external) {
          return `external:${metric.external.metric.name}`;
        }
      }
      
      // Fall back to spec metrics
      if (hpa.spec?.metrics && hpa.spec.metrics.length > 0) {
        const metric = hpa.spec.metrics[0];
        
        if (metric.resource) {
          return `resource:${metric.resource.name}`;
        }
        
        if (metric.pods) {
          return `pods:${metric.pods.metric.name}`;
        }
        
        if (metric.object) {
          return `object:${metric.object.metric.name}`;
        }
        
        if (metric.external) {
          return `external:${metric.external.metric.name}`;
        }
      }
      
      return 'unknown';
    } catch (error) {
      this.logger.error('Error getting trigger metric', { error, hpa });
      return 'unknown';
    }
  }
  
  /**
   * Get trigger value
   */
  private getTriggerValue(hpa: any, metricName: string): number {
    try {
      // Check if there's a specific metric in the status
      if (hpa.status?.currentMetrics && hpa.status.currentMetrics.length > 0) {
        for (const metric of hpa.status.currentMetrics) {
          const name = this.getMetricName(metric);
          
          if (name === metricName) {
            return this.getMetricValue(metric);
          }
        }
      }
      
      return 0;
    } catch (error) {
      this.logger.error('Error getting trigger value', { error, hpa, metricName });
      return 0;
    }
  }
  
  /**
   * Get trigger threshold
   */
  private getTriggerThreshold(hpa: any, metricName: string): number {
    try {
      // Check spec metrics
      if (hpa.spec?.metrics && hpa.spec.metrics.length > 0) {
        for (const metric of hpa.spec.metrics) {
          const name = this.getMetricName(metric);
          
          if (name === metricName) {
            return this.getMetricThreshold(metric);
          }
        }
      }
      
      return 0;
    } catch (error) {
      this.logger.error('Error getting trigger threshold', { error, hpa, metricName });
      return 0;
    }
  }
  
  /**
   * Get metric name
   */
  private getMetricName(metric: any): string {
    if (metric.resource) {
      return `resource:${metric.resource.name}`;
    }
    
    if (metric.pods) {
      return `pods:${metric.pods.metric.name}`;
    }
    
    if (metric.object) {
      return `object:${metric.object.metric.name}`;
    }
    
    if (metric.external) {
      return `external:${metric.external.metric.name}`;
    }
    
    return 'unknown';
  }
  
  /**
   * Get metric value
   */
  private getMetricValue(metric: any): number {
    if (metric.resource) {
      if (metric.resource.current.averageUtilization) {
        return metric.resource.current.averageUtilization;
      }
      
      if (metric.resource.current.averageValue) {
        return parseFloat(metric.resource.current.averageValue);
      }
      
      if (metric.resource.current.value) {
        return parseFloat(metric.resource.current.value);
      }
    }
    
    if (metric.pods) {
      if (metric.pods.current.averageValue) {
        return parseFloat(metric.pods.current.averageValue);
      }
    }
    
    if (metric.object) {
      if (metric.object.current.value) {
        return parseFloat(metric.object.current.value);
      }
      
      if (metric.object.current.averageValue) {
        return parseFloat(metric.object.current.averageValue);
      }
    }
    
    if (metric.external) {
      if (metric.external.current.value) {
        return parseFloat(metric.external.current.value);
      }
      
      if (metric.external.current.averageValue) {
        return parseFloat(metric.external.current.averageValue);
      }
    }
    
    return 0;
  }
  
  /**
   * Get metric threshold
   */
  private getMetricThreshold(metric: any): number {
    if (metric.resource) {
      if (metric.resource.target.averageUtilization) {
        return metric.resource.target.averageUtilization;
      }
      
      if (metric.resource.target.averageValue) {
        return parseFloat(metric.resource.target.averageValue);
      }
      
      if (metric.resource.target.value) {
        return parseFloat(metric.resource.target.value);
      }
    }
    
    if (metric.pods) {
      if (metric.pods.target.averageValue) {
        return parseFloat(metric.pods.target.averageValue);
      }
    }
    
    if (metric.object) {
      if (metric.object.target.value) {
        return parseFloat(metric.object.target.value);
      }
      
      if (metric.object.target.averageValue) {
        return parseFloat(metric.object.target.averageValue);
      }
    }
    
    if (metric.external) {
      if (metric.external.target.value) {
        return parseFloat(metric.external.target.value);
      }
      
      if (metric.external.target.averageValue) {
        return parseFloat(metric.external.target.averageValue);
      }
    }
    
    return 0;
  }
  
  /**
   * Log an HPA event
   */
  private async logEvent(event: HpaEvent): Promise<void> {
    try {
      // Log to console
      this.logger.info('HPA event', { event });
      
      // Store in Redis
      const key = `hpa-event:${event.service}:${event.timestamp}`;
      await this.redis.set(key, JSON.stringify(event));
      
      // Add to event list
      const listKey = `hpa-events:${event.service}`;
      await this.redis.lpush(listKey, JSON.stringify(event));
      
      // Trim list to last 100 events
      await this.redis.ltrim(listKey, 0, 99);
      
      // Add to all events list
      const allEventsKey = 'hpa-events:all';
      await this.redis.lpush(allEventsKey, JSON.stringify(event));
      
      // Trim all events list to last 1000 events
      await this.redis.ltrim(allEventsKey, 0, 999);
      
      // Record metrics
      this.recordMetrics(event);
    } catch (error) {
      this.logger.error('Error logging HPA event', { error, event });
    }
  }
  
  /**
   * Record metrics for an HPA event
   */
  private recordMetrics(event: HpaEvent): void {
    try {
      // Record event count
      const eventCountKey = `hpa-event-count:${event.service}:${event.eventType}`;
      this.redis.incr(eventCountKey);
      
      // Record scaling effectiveness
      if (event.eventType === 'scale-up' || event.eventType === 'scale-down') {
        const effectivenessKey = `hpa-scaling-effectiveness:${event.service}`;
        const effectiveness = event.actualReplicas === event.desiredReplicas ? 1 : 0;
        this.redis.lpush(effectivenessKey, effectiveness.toString());
        this.redis.ltrim(effectivenessKey, 0, 99);
      }
    } catch (error) {
      this.logger.error('Error recording HPA event metrics', { error, event });
    }
  }
  
  /**
   * Get recent HPA events
   */
  public async getRecentEvents(service?: string, limit = 100): Promise<HpaEvent[]> {
    try {
      const key = service ? `hpa-events:${service}` : 'hpa-events:all';
      const events = await this.redis.lrange(key, 0, limit - 1);
      
      return events.map(event => JSON.parse(event) as HpaEvent);
    } catch (error) {
      this.logger.error('Error getting recent HPA events', { error, service });
      return [];
    }
  }
  
  /**
   * Get scaling effectiveness
   */
  public async getScalingEffectiveness(service: string): Promise<number> {
    try {
      const key = `hpa-scaling-effectiveness:${service}`;
      const effectiveness = await this.redis.lrange(key, 0, -1);
      
      if (effectiveness.length === 0) {
        return 1; // Default to 100% if no data
      }
      
      const sum = effectiveness.reduce((acc, val) => acc + parseInt(val, 10), 0);
      return sum / effectiveness.length;
    } catch (error) {
      this.logger.error('Error getting scaling effectiveness', { error, service });
      return 1; // Default to 100% on error
    }
  }
  
  /**
   * Close the HPA event logger service
   */
  public async close(): Promise<void> {
    this.stop();
    
    await this.redis.quit();
    
    this.logger.info('HPA event logger service closed');
  }
}

export default HpaEventLoggerService;
