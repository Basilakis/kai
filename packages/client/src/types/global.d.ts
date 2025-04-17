/**
 * Global type declarations
 */

// Monitoring service interface
interface MonitoringService {
  /**
   * Capture an exception/error to send to monitoring
   * @param error - The error to capture
   * @param options - Additional options for the error report
   */
  captureException: (error: Error, options?: {
    tags?: Record<string, string>;
    extra?: Record<string, any>;
  }) => void;
  
  /**
   * Capture a message to send to monitoring
   * @param message - The message to capture
   * @param options - Additional options for the message
   */
  captureMessage?: (message: string, options?: {
    level?: string;
    tags?: Record<string, string>;
    extra?: Record<string, any>;
  }) => void;
}

// Extend the Window interface
interface Window {
  /**
   * A monitoring service client (e.g., Sentry, LogRocket)
   * This is dynamically loaded in production environments
   */
  monitoringService?: MonitoringService;
}