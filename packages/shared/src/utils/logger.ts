
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  module?: string;
  context?: Record<string, any>;
}

export interface LoggerConfig {
  minLevel: LogLevel;
  enableConsole?: boolean;
  customHandlers?: Array<(entry: LogEntry) => void>;
  environment?: 'development' | 'production' | 'test';
}

const DEFAULT_CONFIG: LoggerConfig = {
  minLevel: 'info',
  enableConsole: true,
  environment: 'production'
};

function getDefaultLogLevel(environment?: string): LogLevel {
  return environment === 'development' ? 'debug' : 'info';
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
  }

  private createEntry(level: LogLevel, message: string, context?: Record<string, any>): LogEntry {
    return {
      timestamp: new Date(),
      level,
      message,
      module: this.module,
      context
    };
  }

  private log(entry: LogEntry): void {
    if (this.shouldLog(entry.level)) {
      if (this.config.enableConsole) {
        this.logToConsole(entry);
      }

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
}

// Create and export default logger instance
export const logger = new Logger();

// Export factory function for creating module-specific loggers
export function createModuleLogger(moduleName: string): Logger {
  return logger.child(moduleName);
}