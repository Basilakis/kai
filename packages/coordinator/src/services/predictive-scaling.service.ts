/**
 * Predictive Scaling Service
 *
 * This service analyzes historical metrics to predict future load and proactively
 * adjust HPA settings for services with predictable load patterns.
 */

import { Logger } from 'winston';
import { createLogger } from '../utils/logger';
import * as k8s from '@kubernetes/client-node';
import { Redis } from 'ioredis';

/**
 * Load pattern type
 */
export type LoadPatternType = 'daily' | 'weekly' | 'monthly' | 'custom';

/**
 * Scaling prediction
 */
export interface ScalingPrediction {
  service: string;
  currentReplicas: number;
  predictedReplicas: number;
  confidence: number;
  timestamp: number;
  appliedAt?: number;
}

/**
 * Service load pattern
 */
export interface ServiceLoadPattern {
  service: string;
  patternType: LoadPatternType;
  timeWindows: {
    dayOfWeek?: number; // 0-6, Sunday is 0
    hourOfDay?: number; // 0-23
    minuteOfHour?: number; // 0-59
    expectedLoad: number; // 0-1, relative load
  }[];
  lastUpdated: number;
}

/**
 * Predictive Scaling Service
 */
export class PredictiveScalingService {
  private logger: Logger;
  private k8sApi: k8s.AutoscalingV2Api;
  private redis: Redis;
  private namespace: string;
  private predictionInterval: NodeJS.Timeout | null = null;
  private applyInterval: NodeJS.Timeout | null = null;
  private metricsHistoryDays = 30; // Days of metrics history to analyze

  /**
   * Create a new PredictiveScalingService
   */
  constructor(redisUrl?: string, namespace = 'kai-ml') {
    this.logger = createLogger('predictive-scaling-service');

    // Initialize Kubernetes client
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();
    this.k8sApi = kc.makeApiClient(k8s.AutoscalingV2Api);

    // Initialize Redis client
    this.redis = new Redis(redisUrl || process.env.REDIS_URL || 'redis://localhost:6379');

    this.namespace = namespace;

    this.logger.info('Predictive scaling service initialized');
  }

  /**
   * Start the predictive scaling service
   */
  public start(): void {
    // Generate predictions every hour
    this.predictionInterval = setInterval(() => {
      this.generatePredictions();
    }, 60 * 60 * 1000); // 1 hour

    // Apply predictions every 5 minutes
    this.applyInterval = setInterval(() => {
      this.applyPredictions();
    }, 5 * 60 * 1000); // 5 minutes

    this.logger.info('Predictive scaling service started');

    // Generate initial predictions
    this.generatePredictions();
  }

  /**
   * Stop the predictive scaling service
   */
  public stop(): void {
    if (this.predictionInterval) {
      clearInterval(this.predictionInterval);
      this.predictionInterval = null;
    }

    if (this.applyInterval) {
      clearInterval(this.applyInterval);
      this.applyInterval = null;
    }

    this.logger.info('Predictive scaling service stopped');
  }

  /**
   * Generate scaling predictions for all services
   */
  private async generatePredictions(): Promise<void> {
    try {
      this.logger.info('Generating scaling predictions');

      // Get all services with load patterns
      const patterns = await this.getServiceLoadPatterns();

      if (patterns.length === 0) {
        this.logger.info('No service load patterns found');
        return;
      }

      // Get current time
      const now = new Date();
      const dayOfWeek = now.getUTCDay();
      const hourOfDay = now.getUTCHours();
      const minuteOfHour = now.getUTCMinutes();

      // Generate predictions for each service
      for (const pattern of patterns) {
        await this.generatePredictionForService(pattern, dayOfWeek, hourOfDay, minuteOfHour);
      }

      this.logger.info('Scaling predictions generated');
    } catch (error) {
      this.logger.error('Error generating scaling predictions', { error });
    }
  }

  /**
   * Generate scaling prediction for a service
   */
  private async generatePredictionForService(
    pattern: ServiceLoadPattern,
    dayOfWeek: number,
    hourOfDay: number,
    minuteOfHour: number
  ): Promise<void> {
    try {
      // Find matching time windows
      const matchingWindows = pattern.timeWindows.filter(window => {
        // If dayOfWeek is specified, it must match
        if (window.dayOfWeek !== undefined && window.dayOfWeek !== dayOfWeek) {
          return false;
        }

        // If hourOfDay is specified, it must match
        if (window.hourOfDay !== undefined && window.hourOfDay !== hourOfDay) {
          return false;
        }

        // If minuteOfHour is specified, it must match
        if (window.minuteOfHour !== undefined && window.minuteOfHour !== minuteOfHour) {
          return false;
        }

        return true;
      });

      if (matchingWindows.length === 0) {
        this.logger.debug('No matching time windows for service', { service: pattern.service });
        return;
      }

      // Get current HPA configuration
      const hpa = await this.getHpa(pattern.service);

      if (!hpa) {
        this.logger.warn('HPA not found for service', { service: pattern.service });
        return;
      }

      // Calculate predicted replicas based on expected load
      const currentReplicas = hpa.status?.currentReplicas || 0;
      const minReplicas = hpa.spec?.minReplicas || 1;
      const maxReplicas = hpa.spec?.maxReplicas || 10;

      // Use the highest expected load from matching windows
      const expectedLoad = Math.max(...matchingWindows.map(window => window.expectedLoad));

      // Calculate predicted replicas
      const predictedReplicas = Math.max(
        minReplicas,
        Math.min(
          maxReplicas,
          Math.ceil(maxReplicas * expectedLoad)
        )
      );

      // Calculate confidence based on historical accuracy
      const confidence = await this.calculatePredictionConfidence(pattern.service, predictedReplicas);

      // Create prediction
      const prediction: ScalingPrediction = {
        service: pattern.service,
        currentReplicas,
        predictedReplicas,
        confidence,
        timestamp: Date.now()
      };

      // Store prediction
      await this.storePrediction(prediction);

      this.logger.info('Scaling prediction generated', {
        service: pattern.service,
        currentReplicas,
        predictedReplicas,
        confidence
      });
    } catch (error) {
      this.logger.error('Error generating scaling prediction for service', {
        error,
        service: pattern.service
      });
    }
  }

  /**
   * Apply scaling predictions
   */
  private async applyPredictions(): Promise<void> {
    try {
      this.logger.info('Applying scaling predictions');

      // Get all pending predictions
      const predictions = await this.getPendingPredictions();

      if (predictions.length === 0) {
        this.logger.info('No pending scaling predictions');
        return;
      }

      // Apply each prediction
      for (const prediction of predictions) {
        await this.applyPrediction(prediction);
      }

      this.logger.info('Scaling predictions applied');
    } catch (error) {
      this.logger.error('Error applying scaling predictions', { error });
    }
  }

  /**
   * Apply a scaling prediction
   */
  private async applyPrediction(prediction: ScalingPrediction): Promise<void> {
    try {
      // Only apply predictions with high confidence
      if (prediction.confidence < 0.7) {
        this.logger.info('Skipping prediction with low confidence', {
          service: prediction.service,
          confidence: prediction.confidence
        });
        return;
      }

      // Get current HPA configuration
      const hpa = await this.getHpa(prediction.service);

      if (!hpa) {
        this.logger.warn('HPA not found for service', { service: prediction.service });
        return;
      }

      // Update HPA minReplicas
      const patch = {
        spec: {
          minReplicas: prediction.predictedReplicas
        }
      };

      // Apply patch
      await this.k8sApi.patchNamespacedHorizontalPodAutoscaler(
        `${prediction.service}-hpa`,
        this.namespace,
        patch,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        { headers: { 'Content-Type': 'application/strategic-merge-patch+json' } }
      );

      // Mark prediction as applied
      prediction.appliedAt = Date.now();
      await this.storePrediction(prediction);

      this.logger.info('Scaling prediction applied', {
        service: prediction.service,
        predictedReplicas: prediction.predictedReplicas
      });
    } catch (error) {
      this.logger.error('Error applying scaling prediction', {
        error,
        service: prediction.service
      });
    }
  }

  /**
   * Get HPA configuration for a service
   */
  private async getHpa(service: string): Promise<k8s.V2HorizontalPodAutoscaler | null> {
    try {
      const response = await this.k8sApi.readNamespacedHorizontalPodAutoscaler(
        `${service}-hpa`,
        this.namespace
      );

      return response.body;
    } catch (error) {
      this.logger.error('Error getting HPA', { error, service });
      return null;
    }
  }

  /**
   * Calculate prediction confidence based on historical accuracy
   */
  private async calculatePredictionConfidence(
    service: string,
    predictedReplicas: number
  ): Promise<number> {
    try {
      // Get historical predictions
      const key = `predictive-scaling:history:${service}`;
      const history = await this.redis.lrange(key, 0, -1);

      if (history.length === 0) {
        // No history, use default confidence
        return 0.8;
      }

      // Parse history
      const predictions = history.map(item => JSON.parse(item) as ScalingPrediction);

      // Calculate accuracy of past predictions
      let accurateCount = 0;

      for (const prediction of predictions) {
        // Get actual replicas at the time the prediction was applied
        const actualReplicas = prediction.currentReplicas;

        // Calculate accuracy (within 1 replica is considered accurate)
        const isAccurate = Math.abs(prediction.predictedReplicas - actualReplicas) <= 1;

        if (isAccurate) {
          accurateCount++;
        }
      }

      // Calculate confidence
      const confidence = predictions.length > 0 ? accurateCount / predictions.length : 0.8;

      return confidence;
    } catch (error) {
      this.logger.error('Error calculating prediction confidence', { error, service });
      return 0.5; // Default to medium confidence on error
    }
  }

  /**
   * Store a scaling prediction
   */
  private async storePrediction(prediction: ScalingPrediction): Promise<void> {
    try {
      // Store in Redis
      const key = `predictive-scaling:prediction:${prediction.service}`;
      await this.redis.set(key, JSON.stringify(prediction));

      // Add to history
      const historyKey = `predictive-scaling:history:${prediction.service}`;
      await this.redis.lpush(historyKey, JSON.stringify(prediction));

      // Trim history to last 100 predictions
      await this.redis.ltrim(historyKey, 0, 99);
    } catch (error) {
      this.logger.error('Error storing prediction', { error, service: prediction.service });
    }
  }

  /**
   * Get pending predictions
   */
  public async getPendingPredictions(): Promise<ScalingPrediction[]> {
    try {
      // Get all prediction keys
      const keys = await this.redis.keys('predictive-scaling:prediction:*');

      if (keys.length === 0) {
        return [];
      }

      // Get all predictions
      const predictions: ScalingPrediction[] = [];

      for (const key of keys) {
        const data = await this.redis.get(key);

        if (data) {
          const prediction = JSON.parse(data) as ScalingPrediction;

          // Only include predictions that haven't been applied yet
          if (!prediction.appliedAt) {
            predictions.push(prediction);
          }
        }
      }

      return predictions;
    } catch (error) {
      this.logger.error('Error getting pending predictions', { error });
      return [];
    }
  }

  /**
   * Get service load patterns
   */
  public async getServiceLoadPatterns(): Promise<ServiceLoadPattern[]> {
    try {
      // Get all pattern keys
      const keys = await this.redis.keys('predictive-scaling:pattern:*');

      if (keys.length === 0) {
        return [];
      }

      // Get all patterns
      const patterns: ServiceLoadPattern[] = [];

      for (const key of keys) {
        const data = await this.redis.get(key);

        if (data) {
          patterns.push(JSON.parse(data) as ServiceLoadPattern);
        }
      }

      return patterns;
    } catch (error) {
      this.logger.error('Error getting service load patterns', { error });
      return [];
    }
  }

  /**
   * Set service load pattern
   */
  public async setServiceLoadPattern(pattern: ServiceLoadPattern): Promise<void> {
    try {
      // Update timestamp
      pattern.lastUpdated = Date.now();

      // Store in Redis
      const key = `predictive-scaling:pattern:${pattern.service}`;
      await this.redis.set(key, JSON.stringify(pattern));

      this.logger.info('Service load pattern set', { service: pattern.service });
    } catch (error) {
      this.logger.error('Error setting service load pattern', { error, service: pattern.service });
      throw error;
    }
  }

  /**
   * Get service load pattern
   */
  public async getServiceLoadPattern(service: string): Promise<ServiceLoadPattern | null> {
    try {
      // Get from Redis
      const key = `predictive-scaling:pattern:${service}`;
      const data = await this.redis.get(key);

      if (!data) {
        return null;
      }

      return JSON.parse(data) as ServiceLoadPattern;
    } catch (error) {
      this.logger.error('Error getting service load pattern', { error, service });
      return null;
    }
  }

  /**
   * Delete service load pattern
   */
  public async deleteServiceLoadPattern(service: string): Promise<void> {
    try {
      // Delete from Redis
      const key = `predictive-scaling:pattern:${service}`;
      await this.redis.del(key);

      this.logger.info('Service load pattern deleted', { service });
    } catch (error) {
      this.logger.error('Error deleting service load pattern', { error, service });
      throw error;
    }
  }

  /**
   * Close the predictive scaling service
   */
  public async close(): Promise<void> {
    this.stop();

    await this.redis.quit();

    this.logger.info('Predictive scaling service closed');
  }
}

export default PredictiveScalingService;
