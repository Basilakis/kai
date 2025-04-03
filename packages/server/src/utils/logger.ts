import { Logger } from '../../../shared/src/utils/logger';

// Define log levels enum for backward compatibility
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

// Map environment log level to shared logger level
function getLogLevel(): 'debug' | 'info' | 'warn' | 'error' {
  const envLogLevel = process.env.LOG_LEVEL?.toLowerCase();
  
  if (envLogLevel === 'debug') return 'debug';
  if (envLogLevel === 'info') return 'info';
  if (envLogLevel === 'warn') return 'warn';
  if (envLogLevel === 'error') return 'error';
  
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
}

// Create server logger instance with environment-specific configuration
const serverLogger = new Logger({
  minLevel: getLogLevel(),
  environment: process.env.NODE_ENV as 'development' | 'production' | 'test',
  enableConsole: true
});

// Export logger interface that matches the original API
export const logger = {
  error: (message: string, meta?: any) => serverLogger.error(message, meta),
  warn: (message: string, meta?: any) => serverLogger.warn(message, meta),
  info: (message: string, meta?: any) => serverLogger.info(message, meta),
  debug: (message: string, meta?: any) => serverLogger.debug(message, meta),
  log: (level: string, message: string, meta?: any) => {
    switch (level.toLowerCase()) {
      case 'error': return serverLogger.error(message, meta);
      case 'warn': return serverLogger.warn(message, meta);
      case 'info': return serverLogger.info(message, meta);
      case 'debug': return serverLogger.debug(message, meta);
      default: return serverLogger.info(message, meta);
    }
  },
  child: (context: Record<string, any>) => {
    const childLogger = serverLogger.child(Object.keys(context).join('.'));
    return {
      error: (message: string, meta?: any) => childLogger.error(message, { ...context, ...meta }),
      warn: (message: string, meta?: any) => childLogger.warn(message, { ...context, ...meta }),
      info: (message: string, meta?: any) => childLogger.info(message, { ...context, ...meta }),
      debug: (message: string, meta?: any) => childLogger.debug(message, { ...context, ...meta }),
      log: (level: string, message: string, meta?: any) => {
        switch (level.toLowerCase()) {
          case 'error': return childLogger.error(message, { ...context, ...meta });
          case 'warn': return childLogger.warn(message, { ...context, ...meta });
          case 'info': return childLogger.info(message, { ...context, ...meta });
          case 'debug': return childLogger.debug(message, { ...context, ...meta });
          default: return childLogger.info(message, { ...context, ...meta });
        }
      },
      child: (childContext: Record<string, any>) => logger.child({ ...context, ...childContext })
    };
  }
};

// Export createModuleLogger with the same interface
export function createModuleLogger(moduleName: string) {
  return logger.child({ module: moduleName });
}

export default logger;