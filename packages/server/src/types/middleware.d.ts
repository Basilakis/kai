import { Request as ExpressRequest, Response as ExpressResponse } from 'express';

// Extend Express Request
export interface Request extends ExpressRequest {
  targetNode?: string;
  startTime?: number;
}

// Extend Express Response
export interface Response extends ExpressResponse {
  on(event: string, callback: () => void): this;
  status(code: number): this;
  json(body: any): this;
  setHeader(name: string, value: string | number): this;
  statusCode: number;
}

export { NextFunction } from 'express';

// Redis client interface
export interface RedisClient {
  connect(): Promise<void>;
  set(key: string, value: string): Promise<void>;
  get(key: string): Promise<string | null>;
  disconnect(): Promise<void>;
}

// CPU Info types
export interface CPUTimes {
  user: number;
  nice: number;
  sys: number;
  idle: number;
  irq: number;
}

export interface CPU {
  model: string;
  speed: number;
  times: CPUTimes;
}

// Performance Metrics
export interface PerformanceMetrics {
  requestCount: number;
  averageResponseTime: number;
  errorRate: number;
  cpuUsage: number;
  memoryUsage: number;
  activeConnections: number;
}

// Service Health
export interface ServiceHealth {
  healthy: boolean;
  lastCheck: number;
  failureCount: number;
  responseTime: number;
}

export interface ServiceNode {
  url: string;
  weight: number;
  health: ServiceHealth;
}

// Configuration Types
export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
}

export interface LoadBalancerConfig {
  serviceName: string;
  nodes: Array<{ url: string; weight?: number }>;
  redis?: RedisConfig;
}

// Redis implementation
export class Redis implements RedisClient {
  constructor(config: RedisConfig) {
    // Implementation will be provided by the actual Redis client
  }

  async connect(): Promise<void> {
    // Implementation will be provided by the actual Redis client
  }

  async set(key: string, value: string): Promise<void> {
    // Implementation will be provided by the actual Redis client
  }

  async get(key: string): Promise<string | null> {
    // Implementation will be provided by the actual Redis client
    return null;
  }

  async disconnect(): Promise<void> {
    // Implementation will be provided by the actual Redis client
  }
}

// OS utilities
export const os = {
  cpus(): CPU[] {
    return [];
  },
  totalmem(): number {
    return 0;
  },
  freemem(): number {
    return 0;
  }
};