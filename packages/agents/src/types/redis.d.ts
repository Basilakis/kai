/**
 * Type declarations for Redis
 * 
 * This file provides TypeScript declarations for the Redis package
 * used for agent memory persistence in the KAI platform.
 */

declare module 'redis' {
  export interface RedisClientOptions {
    socket?: {
      host?: string;
      port?: number;
      path?: string;
      connectTimeout?: number;
      reconnectStrategy?: any;
      noDelay?: boolean;
      keepAlive?: number;
      tls?: any;
    };
    username?: string;
    password?: string;
    name?: string;
    database?: number;
    url?: string;
    legacyMode?: boolean;
  }
  
  export interface RedisCommands {
    get(key: string): Promise<string | null>;
    set(key: string, value: string, options?: any): Promise<string | null>;
    del(key: string): Promise<number>;
    exists(key: string): Promise<number>;
    expire(key: string, seconds: number): Promise<number>;
    hget(key: string, field: string): Promise<string | null>;
    hset(key: string, field: string, value: string): Promise<number>;
    hdel(key: string, field: string): Promise<number>;
    hgetall(key: string): Promise<Record<string, string>>;
    hmset(key: string, ...args: any[]): Promise<string>;
    zadd(key: string, score: number, member: string): Promise<number>;
    zrange(key: string, start: number, stop: number): Promise<string[]>;
    zrangebyscore(key: string, min: string | number, max: string | number): Promise<string[]>;
    zrem(key: string, member: string): Promise<number>;
    zcount(key: string, min: string | number, max: string | number): Promise<number>;
  }

  export class Redis implements RedisCommands {
    constructor(options?: RedisClientOptions);
    
    static createClient(options?: RedisClientOptions): Redis;
    
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    quit(): Promise<void>;
    ping(): Promise<string>;
    
    get(key: string): Promise<string | null>;
    set(key: string, value: string, options?: any): Promise<string | null>;
    del(key: string): Promise<number>;
    exists(key: string): Promise<number>;
    expire(key: string, seconds: number): Promise<number>;
    ttl(key: string): Promise<number>;
    
    hget(key: string, field: string): Promise<string | null>;
    hset(key: string, field: string, value: string): Promise<number>;
    hdel(key: string, field: string): Promise<number>;
    hgetall(key: string): Promise<Record<string, string>>;
    hmset(key: string, ...args: any[]): Promise<string>;
    
    zadd(key: string, score: number, member: string): Promise<number>;
    zrange(key: string, start: number, stop: number): Promise<string[]>;
    zrangebyscore(key: string, min: string | number, max: string | number): Promise<string[]>;
    zrem(key: string, member: string): Promise<number>;
    zcount(key: string, min: string | number, max: string | number): Promise<number>;
  }
}