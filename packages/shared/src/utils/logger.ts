import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  module?: string;
  context?: Record<string, any>;
  id?: string;
  stack?: string;
  hostname?: string;
  pid?: number;
}

export interface LogStorage {
  store(entry: LogEntry): void;
  query(options: LogQueryOptions): Promise<LogEntry[]>;
  count(options: LogQueryOptions): Promise<number>;
  getErrorDistribution(timespan: number): Promise<Record<string, number>>;
}

export interface LogQueryOptions {
  level?: LogLevel;
  module?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  skip?: number;
  searchText?: string;
}

export interface LoggerConfig {
  minLevel: LogLevel;
  enableConsole?: boolean;
  customHandlers?: Array<(entry: LogEntry) => void>;
  environment?: 'development' | 'production' | 'test';
  logDirectory?: string;
  maxLogSize?: number;
  maxLogFiles?: number;
  enableFileLogging?: boolean;
}

const DEFAULT_CONFIG: LoggerConfig = {
  minLevel: 'info',
  enableConsole: true,
  environment: 'production',
  logDirectory: path.join(process.cwd(), 'logs'),
  maxLogSize: 10 * 1024 * 1024, // 10MB
  maxLogFiles: 5,
  enableFileLogging: true
};

function getDefaultLogLevel(environment?: string): LogLevel {
  return environment === 'development' ? 'debug' : 'info';
}

// Simple in-memory log storage
class InMemoryLogStorage implements LogStorage {
  private logs: LogEntry[] = [];
  private maxEntries: number;

  constructor(maxEntries: number = 10000) {
    this.maxEntries = maxEntries;
  }

  store(entry: LogEntry): void {
    this.logs.unshift(entry);
    
    // Trim if exceeds max size
    if (this.logs.length > this.maxEntries) {
      this.logs = this.logs.slice(0, this.maxEntries);
    }
  }

  async query(options: LogQueryOptions): Promise<LogEntry[]> {
    let results = this.logs;
    
    if (options.level) {
      const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
      const levelIndex = levels.indexOf(options.level);
      results = results.filter(log => levels.indexOf(log.level) >= levelIndex);
    }
    
    if (options.module) {
      results = results.filter(log => log.module === options.module);
    }
    
    if (options.startDate) {
      const startDate = options.startDate as Date; // Type assertion
      results = results.filter(log => log.timestamp >= startDate);
    }
    
    if (options.endDate) {
      const endDate = options.endDate as Date; // Type assertion
      results = results.filter(log => log.timestamp <= endDate);
    }
    
    if (options.searchText) {
      const searchLower = options.searchText.toLowerCase();
      results = results.filter(log => 
        log.message.toLowerCase().includes(searchLower) || 
        JSON.stringify(log.context || {}).toLowerCase().includes(searchLower)
      );
    }
    
    // Apply pagination
    if (options.skip) {
      results = results.slice(options.skip);
    }
    
    if (options.limit) {
      results = results.slice(0, options.limit);
    }
    
    return Promise.resolve(results);
  }

  async count(options: LogQueryOptions): Promise<number> {
    const results = await this.query({...options, limit: undefined, skip: undefined});
    return results.length;
  }

  async getErrorDistribution(timespan: number): Promise<Record<string, number>> {
    const now = Date.now();
    const cutoff = new Date(now - timespan);
    
    const errors = this.logs.filter(
      log => log.level === 'error' && log.timestamp >= cutoff
    );
    
    const distribution: Record<string, number> = {};
    
    errors.forEach(error => {
      const key = error.module || 'unknown';
      distribution[key] = (distribution[key] || 0) + 1;
    });
    
    return Promise.resolve(distribution);
  }
}

// File-based log storage
class FileLogStorage implements LogStorage {
  private directory: string;
  private currentLog: string;
  private memory: InMemoryLogStorage;
  
  constructor(directory: string) {
    this.directory = directory;
    this.memory = new InMemoryLogStorage(1000); // Keep recent logs in memory
    
    // Ensure directory exists
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }
    
    this.currentLog = path.join(directory, `app-${new Date().toISOString().split('T')[0]}.log`);
  }
  
  store(entry: LogEntry): void {
    // Store in memory for quick querying
    this.memory.store(entry);
    
    // Write to file
    const logString = JSON.stringify(entry) + '\n';
    fs.appendFileSync(this.currentLog, logString);
  }
  
  async query(options: LogQueryOptions): Promise<LogEntry[]> {
    // For simplicity, just query the in-memory storage
    // In a real implementation, this would scan log files as needed
    return this.memory.query(options);
  }
  
  async count(options: LogQueryOptions): Promise<number> {
    return this.memory.count(options);
  }
  
  async getErrorDistribution(timespan: number): Promise<Record<string, number>> {
    return this.memory.getErrorDistribution(timespan);
  }
}

// Singleton instance of storage
let logStorage: LogStorage | null = null;

export function getLogStorage(): LogStorage {
  if (!logStorage) {
    // Check if we're in a Node.js environment
    if (typeof process !== 'undefined' && process.env) {
      const logDir = process.env.LOG_DIRECTORY || path.join(process.cwd(), 'logs');
      logStorage = new FileLogStorage(logDir);
    } else {
      // Browser environment or other
      logStorage = new InMemoryLogStorage();
    }
  }
  return logStorage;
}

export class Logger {
  private config: LoggerConfig;
  private module?: string;

  constructor(config: Partial<LoggerConfig> = {}, module?: string) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      minLevel: config.minLevel || getDefaultLogLevel(config.environment)
    };
    this.module = module;
    
    // Ensure log directory exists if file logging is enabled
    if (this.config.enableFileLogging && this.config.logDirectory) {
      try {
        if (!fs.existsSync(this.config.logDirectory)) {
          fs.mkdirSync(this.config.logDirectory, { recursive: true });
        }
      } catch (err) {
        console.error('Failed to create log directory:', err);
      }
    }
  }

  private createEntry(level: LogLevel, message: string, context?: Record<string, any>): LogEntry {
    const timestamp = new Date();
    const id = Math.random().toString(36).substring(2, 15);
    
    // Capture stack trace for errors
    let stack: string | undefined;
    if (level === 'error') {
      const err = new Error();
      stack = err.stack;
    }
    
    return {
      timestamp,
      level,
      message,
      module: this.module,
      context,
      id,
      stack,
      hostname: os.hostname(),
      pid: process.pid
    };
  }

  private log(entry: LogEntry): void {
    if (this.shouldLog(entry.level)) {
      if (this.config.enableConsole) {
        this.logToConsole(entry);
      }

      // Store in the log storage
      getLogStorage().store(entry);

      // Custom handlers
      this.config.customHandlers?.forEach(handler => handler(entry));
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.config.minLevel);
  }

  private logToConsole(entry: LogEntry): void {
    const prefix = `[${entry.timestamp.toISOString()}]${entry.module ? ` [${entry.module}]` : ''} ${entry.level.toUpperCase()}:`;
    
    switch (entry.level) {
      case 'debug':
        console.debug(prefix, entry.message, entry.context || '');
        break;
      case 'info':
        console.info(prefix, entry.message, entry.context || '');
        break;
      case 'warn':
        console.warn(prefix, entry.message, entry.context || '');
        break;
      case 'error':
        console.error(prefix, entry.message, entry.context || '');
        break;
    }
  }

  debug(message: string, context?: Record<string, any>): void {
    this.log(this.createEntry('debug', message, context));
  }

  info(message: string, context?: Record<string, any>): void {
    this.log(this.createEntry('info', message, context));
  }

  warn(message: string, context?: Record<string, any>): void {
    this.log(this.createEntry('warn', message, context));
  }

  error(message: string, context?: Record<string, any>): void {
    this.log(this.createEntry('error', message, context));
  }

  child(module: string): Logger {
    return new Logger(this.config, module);
  }
  
  // Query logs
  async query(options: LogQueryOptions): Promise<LogEntry[]> {
    return getLogStorage().query(options);
  }
  
  // Count logs
  async count(options: LogQueryOptions): Promise<number> {
    return getLogStorage().count(options);
  }
  
  // Get error distribution
  async getErrorDistribution(timespan: number = 24 * 60 * 60 * 1000): Promise<Record<string, number>> {
    return getLogStorage().getErrorDistribution(timespan);
  }
}

// Create and export default logger instance
export const logger = new Logger();

// Export factory function for creating module-specific loggers
export function createModuleLogger(moduleName: string): Logger {
  return logger.child(moduleName);
}