import * as k8s from '@kubernetes/client-node';
import { Redis } from 'ioredis';
import { Logger } from 'winston';
import { QualityLevel } from '../types'; // Keep QualityLevel if defined locally
import { SubscriptionTier } from '@kai/shared'; // Import from shared package

/**
 * Resource Manager Service
 * 
 * Manages resource allocation for ML processing workflows in Kubernetes.
 * Determines CPU, memory, and GPU requirements based on quality level,
 * priority, and subscription tier.
 */
export class ResourceManager {
  // Resource allocation maps by quality level
  private static readonly CPU_ALLOCATIONS: Record<QualityLevel, string> = {
    'low': '500m',    // 0.5 CPU cores
    'medium': '2000m', // 2 CPU cores
    'high': '4000m'    // 4 CPU cores
  };
  
  private static readonly MEMORY_ALLOCATIONS: Record<QualityLevel, string> = {
    'low': '2Gi',     // 2 GB
    'medium': '8Gi',  // 8 GB
    'high': '16Gi'    // 16 GB
  };
  
  private static readonly GPU_ALLOCATIONS: Record<QualityLevel, string> = {
    'low': '0',       // No GPU for low quality
    'medium': '1',    // 1 GPU for medium quality
    'high': '2'       // 2 GPUs for high quality
  };
  
  // Node selectors for different quality levels
  private static readonly NODE_SELECTORS: Record<QualityLevel, Record<string, string>> = {
    'low': {
      'node-type': 'cpu-optimized'
    },
    'medium': {
      'node-type': 'gpu-optimized',
      'gpu-type': 'nvidia-t4'
    },
    'high': {
      'node-type': 'gpu-optimized',
      'gpu-type': 'nvidia-a100'
    }
  };
  
  // Allowed quality levels by subscription tier
  private static readonly ALLOWED_QUALITY_LEVELS: Record<SubscriptionTier, QualityLevel[]> = {
    'free': ['low'],
    'standard': ['low', 'medium'],
    'premium': ['low', 'medium', 'high']
  };
  
  // Quality level priorities by subscription tier
  private static readonly QUALITY_PRIORITIES: Record<SubscriptionTier, Record<QualityLevel, number>> = {
    'free': { 'low': 10, 'medium': 0, 'high': 0 },
    'standard': { 'low': 30, 'medium': 20, 'high': 0 },
    'premium': { 'low': 50, 'medium': 40, 'high': 30 }
  };
  
  constructor(
    private redis: Redis,
    private k8sApi: k8s.CustomObjectsApi,
    private coreApi: k8s.CoreV1Api,
    private namespace: string,
    private logger: Logger
  ) {
    this.logger.info('Resource Manager service initialized');
  }
  
  /**
   * Allocates resources for a workflow based on quality level and priority
   * @param qualityLevel The quality level of the workflow
   * @param priority The priority of the workflow
   * @param subscriptionTier The user's subscription tier
   * @returns Resource allocation
   */
  public async allocateResources(
    qualityLevel: QualityLevel,
    priority: string,
    subscriptionTier: SubscriptionTier = 'standard'
  ): Promise<{
    cpu: string,
    memory: string,
    gpu: string,
    nodeSelectors: Record<string, string>
  }> {
    try {
      // Get base resource allocations for the quality level
      const cpu = ResourceManager.CPU_ALLOCATIONS[qualityLevel];
      const memory = ResourceManager.MEMORY_ALLOCATIONS[qualityLevel];
      const gpu = ResourceManager.GPU_ALLOCATIONS[qualityLevel];
      
      // Get appropriate node selectors
      const nodeSelectors = { ...ResourceManager.NODE_SELECTORS[qualityLevel] };
      
      // Check cluster resource availability and adjust if needed
      const adjustedResources = await this.adjustForResourceAvailability({
        cpu,
        memory,
        gpu,
        nodeSelectors
      }, qualityLevel, priority, subscriptionTier);
      
      // Log allocated resources
      this.logger.info('Resources allocated', {
        qualityLevel,
        priority,
        subscriptionTier,
        resources: adjustedResources
      });
      
      return adjustedResources;
    } catch (error) {
      this.logger.error('Error allocating resources', {
        qualityLevel,
        priority,
        subscriptionTier,
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Return default allocations on error
      return {
        cpu: ResourceManager.CPU_ALLOCATIONS[qualityLevel],
        memory: ResourceManager.MEMORY_ALLOCATIONS[qualityLevel],
        gpu: ResourceManager.GPU_ALLOCATIONS[qualityLevel],
        nodeSelectors: ResourceManager.NODE_SELECTORS[qualityLevel]
      };
    }
  }
  
  /**
   * Adjusts resource allocation based on current cluster availability
   * @param baseResources The base resource allocation
   * @param qualityLevel The quality level
   * @param priority The priority
   * @param subscriptionTier The subscription tier
   * @returns Adjusted resource allocation
   */
  private async adjustForResourceAvailability(
    baseResources: {
      cpu: string,
      memory: string,
      gpu: string,
      nodeSelectors: Record<string, string>
    },
    qualityLevel: QualityLevel,
    priority: string,
    subscriptionTier: SubscriptionTier
  ): Promise<{
    cpu: string,
    memory: string,
    gpu: string,
    nodeSelectors: Record<string, string>
  }> {
    try {
      // For high priority requests, don't adjust resources downward
      if (priority === 'high') {
        return baseResources;
      }
      
      // Get current resource utilization from Redis (cached from metrics)
      const [cpuUtilStr, memUtilStr, gpuUtilStr] = await this.redis.mget(
        'resources:cpu:utilization',
        'resources:memory:utilization',
        'resources:gpu:utilization'
      );
      
      // Parse utilization values (0-1 representing percentage used)
      // Default to moderate utilization if data is missing
      const cpuUtilization = cpuUtilStr ? parseFloat(cpuUtilStr) : 0.6;
      const memoryUtilization = memUtilStr ? parseFloat(memUtilStr) : 0.6;
      const gpuUtilization = gpuUtilStr ? parseFloat(gpuUtilStr) : 0.6;
      
      // Determine if cluster is under high load (more than 80% utilized)
      const highCpuLoad = cpuUtilization > 0.8;
      const highMemoryLoad = memoryUtilization > 0.8;
      const highGpuLoad = gpuUtilization > 0.8;
      
      // Make a copy of base resources for adjustment
      const adjustedResources = { ...baseResources };
      
      // If cluster is under high load and this is a low/medium priority job,
      // consider downgrading resources
      if ((highCpuLoad || highMemoryLoad || highGpuLoad) && priority !== 'high') {
        // For medium priority, make moderate adjustments
        if (priority === 'medium') {
          if (highCpuLoad) {
            // Reduce CPU by 25%
            adjustedResources.cpu = this.reduceCpuAllocation(baseResources.cpu, 0.75);
          }
          
          if (highMemoryLoad) {
            // Reduce memory by 25%
            adjustedResources.memory = this.reduceMemoryAllocation(baseResources.memory, 0.75);
          }
        }
        // For low priority, make more significant adjustments
        else if (priority === 'low') {
          if (highCpuLoad) {
            // Reduce CPU by 50%
            adjustedResources.cpu = this.reduceCpuAllocation(baseResources.cpu, 0.5);
          }
          
          if (highMemoryLoad) {
            // Reduce memory by 50%
            adjustedResources.memory = this.reduceMemoryAllocation(baseResources.memory, 0.5);
          }
          
          // For low priority with high GPU load, consider removing GPU allocation
          if (highGpuLoad && qualityLevel !== 'high') {
            adjustedResources.gpu = '0';
            
            // If removing GPU, adjust node selector to CPU-optimized
            adjustedResources.nodeSelectors = {
              'node-type': 'cpu-optimized'
            };
          }
        }
      }
      
      // For free tier under load, enforce stricter limits
      if (subscriptionTier === 'free' && (highCpuLoad || highMemoryLoad || highGpuLoad)) {
        adjustedResources.cpu = ResourceManager.CPU_ALLOCATIONS['low'];
        adjustedResources.memory = ResourceManager.MEMORY_ALLOCATIONS['low'];
        adjustedResources.gpu = '0';
        adjustedResources.nodeSelectors = {
          'node-type': 'cpu-optimized'
        };
      }
      
      // Log adjustments if made
      if (
        adjustedResources.cpu !== baseResources.cpu ||
        adjustedResources.memory !== baseResources.memory ||
        adjustedResources.gpu !== baseResources.gpu
      ) {
        this.logger.info('Resources adjusted due to cluster load', {
          originalResources: baseResources,
          adjustedResources,
          cpuUtilization,
          memoryUtilization,
          gpuUtilization
        });
      }
      
      return adjustedResources;
    } catch (error) {
      // On error, return base resources
      this.logger.warn('Error adjusting resources, using base allocation', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      return baseResources;
    }
  }
  
  /**
   * Reduces CPU allocation by the specified factor
   * @param cpuAllocation The original CPU allocation
   * @param factor The reduction factor (0-1)
   * @returns Reduced CPU allocation
   */
  private reduceCpuAllocation(cpuAllocation: string, factor: number): string {
    // Parse CPU allocation (assuming format like '2000m')
    const match = cpuAllocation.match(/^(\d+)(m?)$/);
    
    if (!match) {
      return cpuAllocation;
    }
    
    const value = parseInt(match[1], 10);
    const unit = match[2];
    
    // Calculate reduced value
    const reducedValue = Math.max(100, Math.floor(value * factor));
    
    return `${reducedValue}${unit}`;
  }
  
  /**
   * Reduces memory allocation by the specified factor
   * @param memoryAllocation The original memory allocation
   * @param factor The reduction factor (0-1)
   * @returns Reduced memory allocation
   */
  private reduceMemoryAllocation(memoryAllocation: string, factor: number): string {
    // Parse memory allocation (assuming format like '8Gi')
    const match = memoryAllocation.match(/^(\d+)(Gi|Mi|Ki)?$/);
    
    if (!match) {
      return memoryAllocation;
    }
    
    const value = parseInt(match[1], 10);
    const unit = match[2] || '';
    
    // Calculate reduced value (minimum 256Mi or 1Gi depending on unit)
    let reducedValue: number;
    
    if (unit === 'Gi') {
      reducedValue = Math.max(1, Math.floor(value * factor));
    } else if (unit === 'Mi') {
      reducedValue = Math.max(256, Math.floor(value * factor));
    } else {
      reducedValue = Math.max(1, Math.floor(value * factor));
    }
    
    return `${reducedValue}${unit}`;
  }
  
  /**
   * Validates if a quality level is allowed for a subscription tier
   * @param qualityLevel The quality level
   * @param subscriptionTier The subscription tier
   * @returns Whether the quality level is allowed
   */
  public async validateQualityForSubscription(
    qualityLevel: QualityLevel,
    subscriptionTier: SubscriptionTier = 'standard'
  ): Promise<boolean> {
    // Get allowed quality levels for the subscription tier
    const allowedLevels = ResourceManager.ALLOWED_QUALITY_LEVELS[subscriptionTier] || ['low'];
    
    return allowedLevels.includes(qualityLevel);
  }
  
  /**
   * Gets the highest allowed quality level for a subscription tier
   * @param subscriptionTier The subscription tier
   * @returns The highest allowed quality level
   */
  public async getHighestAllowedQuality(subscriptionTier: SubscriptionTier = 'standard'): Promise<QualityLevel> {
    const allowedLevels = ResourceManager.ALLOWED_QUALITY_LEVELS[subscriptionTier] || ['low'];
    
    // Return the last (highest) quality level in the array
    return allowedLevels[allowedLevels.length - 1];
  }
  
  /**
   * Gets the priority value for a quality level and subscription tier
   * @param qualityLevel The quality level
   * @param subscriptionTier The subscription tier
   * @returns The priority value
   */
  public getPriorityValue(
    qualityLevel: QualityLevel,
    subscriptionTier: SubscriptionTier = 'standard'
  ): number {
    // Get priority values for the subscription tier
    const priorities = ResourceManager.QUALITY_PRIORITIES[subscriptionTier] || ResourceManager.QUALITY_PRIORITIES.standard;
    
    // Return priority value for the quality level
    return priorities[qualityLevel] || 10;
  }
  
  /**
   * Gets resource utilization metrics from the cluster
   * @returns Resource utilization metrics
   */
  public async getResourceUtilization(): Promise<{
    cpu: number;
    memory: number;
    gpu: number;
  }> {
    try {
      // In a real implementation, this would call the Kubernetes Metrics API
      // For now, we use Redis for pre-cached metrics
      const [cpuStr, memStr, gpuStr] = await this.redis.mget(
        'resources:cpu:utilization',
        'resources:memory:utilization',
        'resources:gpu:utilization'
      );
      
      return {
        cpu: cpuStr ? parseFloat(cpuStr) : 0.5,
        memory: memStr ? parseFloat(memStr) : 0.5,
        gpu: gpuStr ? parseFloat(gpuStr) : 0.5
      };
    } catch (error) {
      this.logger.error('Error getting resource utilization', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Return default values on error
      return {
        cpu: 0.5,
        memory: 0.5,
        gpu: 0.5
      };
    }
  }
  
  /**
   * Gets detailed node metrics for all nodes in the cluster
   * @returns Node metrics by node name
   */
  public async getNodeMetrics(): Promise<Record<string, {
    cpu: {
      capacity: string;
      allocatable: string;
      usage: string;
      utilization: number;
    };
    memory: {
      capacity: string;
      allocatable: string;
      usage: string;
      utilization: number;
    };
    gpu?: {
      capacity: number;
      usage: number;
      utilization: number;
    };
  }>> {
    try {
      // Get nodes using Core API
      const nodesResponse = await this.coreApi.listNode();
      const nodes = nodesResponse.body.items;
      
      // In a real implementation, we would also fetch metrics from the Metrics API
      // For this example, we return node capacities without real utilization
      const metrics: Record<string, any> = {};
      
      for (const node of nodes) {
        const nodeName = node.metadata?.name || 'unknown';
        const nodeType = node.metadata?.labels?.['node-type'] || 'general';
        const gpuType = node.metadata?.labels?.['gpu-type'];
        
        // Get capacities from node status
        const cpuCapacity = node.status?.capacity?.['cpu'] || '1';
        const memoryCapacity = node.status?.capacity?.['memory'] || '1Gi';
        const cpuAllocatable = node.status?.allocatable?.['cpu'] || cpuCapacity;
        const memoryAllocatable = node.status?.allocatable?.['memory'] || memoryCapacity;
        
        // Mock usage values for demonstration
        const cpuUsage = `${parseFloat(cpuAllocatable) * 0.6}`;
        const memoryUsage = memoryAllocatable.replace(
          /^(\d+)(.*)$/,
          (_: string, num: string, unit: string) => `${Math.floor(parseInt(num, 10) * 0.6)}${unit}`
        );
        
        metrics[nodeName] = {
          type: nodeType,
          cpu: {
            capacity: cpuCapacity,
            allocatable: cpuAllocatable,
            usage: cpuUsage,
            utilization: 0.6 // Mocked at 60%
          },
          memory: {
            capacity: memoryCapacity,
            allocatable: memoryAllocatable,
            usage: memoryUsage,
            utilization: 0.6 // Mocked at 60%
          }
        };
        
        // Add GPU metrics if this is a GPU node
        if (gpuType) {
          const gpuCapacity = node.metadata?.labels?.['gpu-count'] ? parseInt(node.metadata.labels['gpu-count'], 10) : 1;
          
          metrics[nodeName].gpu = {
            capacity: gpuCapacity,
            usage: gpuCapacity * 0.5, // Mocked at 50% usage
            utilization: 0.5,
            type: gpuType
          };
        }
      }
      
      return metrics;
    } catch (error) {
      this.logger.error('Error getting node metrics', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Return empty object on error
      return {};
    }
  }
  
  /**
   * Updates the resource availability metrics in Redis
   * This would be called periodically to keep metrics fresh
   */
  public async updateResourceMetrics(): Promise<void> {
    try {
      const metrics = await this.getNodeMetrics();
      
      if (Object.keys(metrics).length === 0) {
        return;
      }
      
      // Aggregate metrics across all nodes
      let totalCpuCapacity = 0;
      let totalCpuUsage = 0;
      let totalMemoryCapacity = 0;
      let totalMemoryUsage = 0;
      let totalGpuCapacity = 0;
      let totalGpuUsage = 0;
      
      for (const nodeName in metrics) {
        const nodeMetrics = metrics[nodeName];
        
        // Add CPU metrics
        const cpuCapacity = parseFloat(nodeMetrics.cpu.capacity.replace('m', '')) / 1000;
        const cpuUsage = parseFloat(nodeMetrics.cpu.usage.replace('m', '')) / 1000;
        totalCpuCapacity += cpuCapacity;
        totalCpuUsage += cpuUsage;
        
        // Add memory metrics
        const memCapacityMatch = nodeMetrics.memory.capacity.match(/^(\d+)(Gi|Mi|Ki)?$/);
        const memUsageMatch = nodeMetrics.memory.usage.match(/^(\d+)(Gi|Mi|Ki)?$/);
        
        if (memCapacityMatch && memUsageMatch) {
          const memCapacityValue = parseInt(memCapacityMatch[1], 10);
          const memCapacityUnit = memCapacityMatch[2] || '';
          const memUsageValue = parseInt(memUsageMatch[1], 10);
          const memUsageUnit = memUsageMatch[2] || '';
          
          // Convert to common unit (Mi)
          let capacityMi = memCapacityValue;
          if (memCapacityUnit === 'Gi') capacityMi *= 1024;
          else if (memCapacityUnit === 'Ki') capacityMi /= 1024;
          
          let usageMi = memUsageValue;
          if (memUsageUnit === 'Gi') usageMi *= 1024;
          else if (memUsageUnit === 'Ki') usageMi /= 1024;
          
          totalMemoryCapacity += capacityMi;
          totalMemoryUsage += usageMi;
        }
        
        // Add GPU metrics if available
        if (nodeMetrics.gpu) {
          totalGpuCapacity += nodeMetrics.gpu.capacity;
          totalGpuUsage += nodeMetrics.gpu.usage;
        }
      }
      
      // Calculate utilization percentages
      const cpuUtilization = totalCpuCapacity > 0 ? totalCpuUsage / totalCpuCapacity : 0;
      const memoryUtilization = totalMemoryCapacity > 0 ? totalMemoryUsage / totalMemoryCapacity : 0;
      const gpuUtilization = totalGpuCapacity > 0 ? totalGpuUsage / totalGpuCapacity : 0;
      
      // Calculate availability (1 - utilization)
      const cpuAvailability = 1 - cpuUtilization;
      const memoryAvailability = 1 - memoryUtilization;
      const gpuAvailability = 1 - gpuUtilization;
      
      // Store metrics in Redis
      await this.redis.mset(
        'resources:cpu:utilization', cpuUtilization.toString(),
        'resources:memory:utilization', memoryUtilization.toString(),
        'resources:gpu:utilization', gpuUtilization.toString(),
        'resources:cpu:availability', cpuAvailability.toString(),
        'resources:memory:availability', memoryAvailability.toString(),
        'resources:gpu:availability', gpuAvailability.toString()
      );
      
      // Set TTL for metrics (5 minutes)
      const keys = [
        'resources:cpu:utilization',
        'resources:memory:utilization',
        'resources:gpu:utilization',
        'resources:cpu:availability',
        'resources:memory:availability',
        'resources:gpu:availability'
      ];
      
      for (const key of keys) {
        await this.redis.expire(key, 300);
      }
      
      this.logger.debug('Resource metrics updated', {
        cpuUtilization,
        memoryUtilization,
        gpuUtilization,
        cpuAvailability,
        memoryAvailability,
        gpuAvailability
      });
    } catch (error) {
      this.logger.error('Error updating resource metrics', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}