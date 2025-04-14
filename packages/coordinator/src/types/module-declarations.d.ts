/**
 * Type declarations for local modules
 */

// Service modules
declare module './quality-manager.service' {
  export class QualityManager {
    constructor(redis: import('ioredis').Redis, logger: import('winston').Logger);
    assessQuality(request: import('../types').WorkflowRequest): Promise<{
      qualityLevel: import('../types').QualityLevel;
      factors: Record<string, number>;
    }>;
    recordQualitySelection(requestType: string, qualityLevel: import('../types').QualityLevel): Promise<void>;
  }
}

declare module './resource-manager.service' {
  export class ResourceManager {
    constructor(k8sApi: any, redis: import('ioredis').Redis, logger: import('winston').Logger);
    allocateResources(request: import('../types').WorkflowRequest, qualityLevel: import('../types').QualityLevel): Promise<{
      cpu: string;
      memory: string;
      gpu: string | null;
      nodeSelector: Record<string, string>;
      tolerations: Array<any>;
    }>;
    checkPriorityClass(subscriptionTier: string): string;
  }
}

declare module './cache-manager.service' {
  export interface CachedResult {
    workflowId: string;
    result: any;
    createdAt: number;
    expiresAt: number;
  }
  
  export class CacheManager {
    constructor(redis: import('ioredis').Redis, logger: import('winston').Logger);
    generateCacheKey(request: any): string;
    set(key: string, workflowId: string, result: any, ttl?: number): Promise<boolean>;
    get(key: string): Promise<CachedResult | null>;
    invalidate(key: string): Promise<boolean>;
    invalidateByType(type: string): Promise<number>;
    clear(): Promise<number>;
  }
}

declare module './monitoring.service' {
  export class MonitoringService {
    constructor(logger: import('winston').Logger);
    recordWorkflowCreation(workflowId: string, workflowType: string, priority: string): void;
    recordWorkflowCompletion(workflowId: string, processingTimeMs: number, success: boolean): void;
    recordQualityLevel(workflowId: string, qualityLevel: import('../types').QualityLevel): void;
    recordResourceAllocation(workflowId: string, cpu: string, memory: string, gpu: string | null): void;
    recordCacheResult(workflowId: string, hit: boolean): void;
    recordError(workflowId: string, stage: import('../types').ProcessingStage, errorMessage: string): void;
  }
}

declare module './quality-manager.service' {
  import { Redis } from 'ioredis';
  import { Logger } from 'winston';
  import { QualityLevel, WorkflowRequest } from '../types';

  export class QualityManager {
    constructor(redis: Redis, logger: Logger);
    assessQuality(request: WorkflowRequest): Promise<{
      qualityLevel: QualityLevel;
      factors: Record<string, number>;
    }>;
    recordQualitySelection(requestType: string, qualityLevel: QualityLevel): Promise<void>;
  }
}

declare module './resource-manager.service' {
  import * as k8s from '@kubernetes/client-node';
  import { Redis } from 'ioredis';
  import { Logger } from 'winston';
  import { QualityLevel, SubscriptionTier } from '../types';

  export class ResourceManager {
    constructor(
      redis: Redis,
      k8sApi: k8s.CustomObjectsApi,
      coreApi: k8s.CoreV1Api,
      namespace: string,
      logger: Logger
    );
    allocateResources(
      qualityLevel: QualityLevel,
      priority: string,
      subscriptionTier?: SubscriptionTier
    ): Promise<{
      cpu: string;
      memory: string;
      gpu: string;
      nodeSelectors: Record<string, string>;
    }>;
    validateQualityForSubscription(
      qualityLevel: QualityLevel,
      subscriptionTier?: SubscriptionTier
    ): Promise<boolean>;
    getHighestAllowedQuality(subscriptionTier?: SubscriptionTier): Promise<QualityLevel>;
    getPriorityValue(qualityLevel: QualityLevel, subscriptionTier?: SubscriptionTier): number;
    getResourceUtilization(): Promise<{ cpu: number; memory: number; gpu: number }>;
    getNodeMetrics(): Promise<Record<string, any>>;
    updateResourceMetrics(): Promise<void>;
  }
}

declare module './cache-manager.service' {
  import { Redis } from 'ioredis';
  import { Logger } from 'winston';

  export class CacheManager {
    constructor(redis: Redis, logger: Logger);
    get(key: string): Promise<any>;
    set(key: string, value: any, ttl?: number): Promise<void>;
    delete(key: string): Promise<void>;
    clear(): Promise<void>;
  }
}

declare module './monitoring.service' {
  import { Logger } from 'winston';
  import { WorkflowRequest } from '../types';

  export class MonitoringService {
    constructor(logger: Logger);
    startWorkflow(workflowId: string, request: WorkflowRequest): void;
    recordWorkflowCreation(workflowId: string, type: string, duration: number): void;
    recordWorkflowCompletion(workflowId: string, type: string, duration: number, success: boolean): void;
    recordWorkflowCancellation(workflowId: string): void;
    recordWorkflowError(workflowId: string, type: string, error: string): void;
    recordCacheHit(workflowId: string, type: string): void;
    getMetrics(): Record<string, any>;
  }
}

// Declare external module types if needed
declare module '@kubernetes/client-node' {
  export class KubeConfig {
    loadFromDefault(): void;
    makeApiClient<T>(api: new (basePath: string) => T): T;
  }

  export class CustomObjectsApi {
    getNamespacedCustomObject(
      group: string,
      version: string,
      namespace: string,
      plural: string,
      name: string
    ): Promise<{ body: any }>;
    
    listNamespacedCustomObject(
      group: string,
      version: string,
      namespace: string,
      plural: string,
      continued?: string,
      fieldSelector?: string,
      labelSelector?: string,
      limit?: number,
      resourceVersion?: string
    ): Promise<{ body: any }>;

    patchNamespacedCustomObject(
      group: string,
      version: string,
      namespace: string,
      plural: string,
      name: string,
      body: any,
      dryRun?: string,
      fieldManager?: string,
      force?: boolean,
      options?: any
    ): Promise<{ body: any }>;

    createNamespacedCustomObject(
      group: string,
      version: string,
      namespace: string,
      plural: string,
      body: any,
      dryRun?: string,
      fieldManager?: string
    ): Promise<{ body: any }>;
  }

  export class CoreV1Api {
    listNode(
      pretty?: string,
      allowWatchBookmarks?: boolean,
      continued?: string,
      fieldSelector?: string,
      labelSelector?: string,
      limit?: number,
      resourceVersion?: string,
      resourceVersionMatch?: string,
      timeoutSeconds?: number,
      watch?: boolean
    ): Promise<{
      body: {
        items: any[];
      };
    }>;
  }
}

declare module 'ioredis' {
  export default class Redis {
    constructor(url?: string);
    get(key: string): Promise<string | null>;
    set(key: string, value: string, mode?: string, duration?: number): Promise<string>;
    mget(...keys: string[]): Promise<(string | null)[]>;
    mset(...keyValues: string[]): Promise<string>;
    expire(key: string, seconds: number): Promise<number>;
    del(key: string): Promise<number>;
    flushall(): Promise<string>;
  }

  export class Redis {
    constructor(url?: string);
    get(key: string): Promise<string | null>;
    set(key: string, value: string, mode?: string, duration?: number): Promise<string>;
    mget(...keys: string[]): Promise<(string | null)[]>;
    mset(...keyValues: string[]): Promise<string>;
    expire(key: string, seconds: number): Promise<number>;
    del(key: string): Promise<number>;
    flushall(): Promise<string>;
  }
}