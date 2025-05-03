/**
 * Scaling Dependencies Service
 * 
 * This service manages dependencies between services for scaling purposes.
 * It ensures that when one service scales, dependent services are also scaled
 * appropriately to maintain system balance.
 */

import { Logger } from 'winston';
import { createLogger } from '../utils/logger';
import * as k8s from '@kubernetes/client-node';
import { Redis } from 'ioredis';

/**
 * Scaling dependency type
 */
export type DependencyType = 'proportional' | 'fixed' | 'minimum';

/**
 * Scaling dependency
 */
export interface ScalingDependency {
  sourceService: string;
  targetService: string;
  dependencyType: DependencyType;
  ratio?: number; // For proportional dependencies
  fixedReplicas?: number; // For fixed dependencies
  minReplicas?: number; // For minimum dependencies
  enabled: boolean;
  lastUpdated: number;
}

/**
 * Scaling Dependencies Service
 */
export class ScalingDependenciesService {
  private logger: Logger;
  private k8sApi: k8s.AutoscalingV2Api;
  private redis: Redis;
  private namespace: string;
  private checkInterval: NodeJS.Timeout | null = null;
  
  /**
   * Create a new ScalingDependenciesService
   */
  constructor(redisUrl?: string, namespace = 'kai-ml') {
    this.logger = createLogger('scaling-dependencies-service');
    
    // Initialize Kubernetes client
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();
    this.k8sApi = kc.makeApiClient(k8s.AutoscalingV2Api);
    
    // Initialize Redis client
    this.redis = new Redis(redisUrl || process.env.REDIS_URL || 'redis://localhost:6379');
    
    this.namespace = namespace;
    
    this.logger.info('Scaling dependencies service initialized');
  }
  
  /**
   * Start the scaling dependencies service
   */
  public start(): void {
    // Check dependencies every minute
    this.checkInterval = setInterval(() => {
      this.checkDependencies();
    }, 60 * 1000); // 1 minute
    
    this.logger.info('Scaling dependencies service started');
    
    // Check dependencies immediately
    this.checkDependencies();
  }
  
  /**
   * Stop the scaling dependencies service
   */
  public stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    
    this.logger.info('Scaling dependencies service stopped');
  }
  
  /**
   * Check all scaling dependencies
   */
  private async checkDependencies(): Promise<void> {
    try {
      this.logger.info('Checking scaling dependencies');
      
      // Get all dependencies
      const dependencies = await this.getDependencies();
      
      if (dependencies.length === 0) {
        this.logger.info('No scaling dependencies found');
        return;
      }
      
      // Process each dependency
      for (const dependency of dependencies) {
        if (!dependency.enabled) {
          continue;
        }
        
        await this.processDependency(dependency);
      }
      
      this.logger.info('Scaling dependencies checked');
    } catch (error) {
      this.logger.error('Error checking scaling dependencies', { error });
    }
  }
  
  /**
   * Process a scaling dependency
   */
  private async processDependency(dependency: ScalingDependency): Promise<void> {
    try {
      // Get source service HPA
      const sourceHpa = await this.getHpa(dependency.sourceService);
      
      if (!sourceHpa) {
        this.logger.warn('Source HPA not found', { service: dependency.sourceService });
        return;
      }
      
      // Get target service HPA
      const targetHpa = await this.getHpa(dependency.targetService);
      
      if (!targetHpa) {
        this.logger.warn('Target HPA not found', { service: dependency.targetService });
        return;
      }
      
      // Get current replicas
      const sourceReplicas = sourceHpa.status?.currentReplicas || 0;
      
      // Calculate target replicas based on dependency type
      let targetReplicas = 0;
      
      switch (dependency.dependencyType) {
        case 'proportional':
          // Calculate proportional replicas
          const ratio = dependency.ratio || 1;
          targetReplicas = Math.ceil(sourceReplicas * ratio);
          break;
          
        case 'fixed':
          // Use fixed replicas
          targetReplicas = dependency.fixedReplicas || 1;
          break;
          
        case 'minimum':
          // Ensure minimum replicas
          const minReplicas = dependency.minReplicas || 1;
          targetReplicas = Math.max(targetHpa.status?.currentReplicas || 0, minReplicas);
          break;
      }
      
      // Ensure target replicas is within HPA limits
      const targetMinReplicas = targetHpa.spec?.minReplicas || 1;
      const targetMaxReplicas = targetHpa.spec?.maxReplicas || 10;
      
      targetReplicas = Math.max(targetMinReplicas, Math.min(targetMaxReplicas, targetReplicas));
      
      // Check if target replicas needs to be updated
      if (targetReplicas !== (targetHpa.status?.currentReplicas || 0)) {
        // Update target HPA minReplicas
        const patch = {
          spec: {
            minReplicas: targetReplicas
          }
        };
        
        // Apply patch
        await this.k8sApi.patchNamespacedHorizontalPodAutoscaler(
          `${dependency.targetService}-hpa`,
          this.namespace,
          patch,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          { headers: { 'Content-Type': 'application/strategic-merge-patch+json' } }
        );
        
        this.logger.info('Updated target service replicas', {
          sourceService: dependency.sourceService,
          targetService: dependency.targetService,
          sourceReplicas,
          targetReplicas
        });
      }
    } catch (error) {
      this.logger.error('Error processing scaling dependency', {
        error,
        sourceService: dependency.sourceService,
        targetService: dependency.targetService
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
   * Get all scaling dependencies
   */
  public async getDependencies(): Promise<ScalingDependency[]> {
    try {
      // Get all dependency keys
      const keys = await this.redis.keys('scaling-dependency:*');
      
      if (keys.length === 0) {
        return [];
      }
      
      // Get all dependencies
      const dependencies: ScalingDependency[] = [];
      
      for (const key of keys) {
        const data = await this.redis.get(key);
        
        if (data) {
          dependencies.push(JSON.parse(data) as ScalingDependency);
        }
      }
      
      return dependencies;
    } catch (error) {
      this.logger.error('Error getting scaling dependencies', { error });
      return [];
    }
  }
  
  /**
   * Get a specific scaling dependency
   */
  public async getDependency(sourceService: string, targetService: string): Promise<ScalingDependency | null> {
    try {
      // Get from Redis
      const key = `scaling-dependency:${sourceService}:${targetService}`;
      const data = await this.redis.get(key);
      
      if (!data) {
        return null;
      }
      
      return JSON.parse(data) as ScalingDependency;
    } catch (error) {
      this.logger.error('Error getting scaling dependency', { error, sourceService, targetService });
      return null;
    }
  }
  
  /**
   * Set a scaling dependency
   */
  public async setDependency(dependency: ScalingDependency): Promise<void> {
    try {
      // Update timestamp
      dependency.lastUpdated = Date.now();
      
      // Store in Redis
      const key = `scaling-dependency:${dependency.sourceService}:${dependency.targetService}`;
      await this.redis.set(key, JSON.stringify(dependency));
      
      this.logger.info('Scaling dependency set', {
        sourceService: dependency.sourceService,
        targetService: dependency.targetService,
        type: dependency.dependencyType
      });
    } catch (error) {
      this.logger.error('Error setting scaling dependency', {
        error,
        sourceService: dependency.sourceService,
        targetService: dependency.targetService
      });
      throw error;
    }
  }
  
  /**
   * Delete a scaling dependency
   */
  public async deleteDependency(sourceService: string, targetService: string): Promise<void> {
    try {
      // Delete from Redis
      const key = `scaling-dependency:${sourceService}:${targetService}`;
      await this.redis.del(key);
      
      this.logger.info('Scaling dependency deleted', { sourceService, targetService });
    } catch (error) {
      this.logger.error('Error deleting scaling dependency', { error, sourceService, targetService });
      throw error;
    }
  }
  
  /**
   * Close the scaling dependencies service
   */
  public async close(): Promise<void> {
    this.stop();
    
    await this.redis.quit();
    
    this.logger.info('Scaling dependencies service closed');
  }
}

export default ScalingDependenciesService;
