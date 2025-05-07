/**
 * Alerting Service Initializer
 * 
 * This module provides functions to initialize the unified alerting service
 * with different alerting configurations based on environment.
 */

import { createLogger } from '../../utils/unified-logger';
import { config } from '../../utils/unified-config';
import { telemetry } from '../telemetry';
import { 
  alerting, 
  AlertRule, 
  AlertNotificationChannel, 
  AlertNotificationChannelType,
  AlertSeverity
} from './alertingService';

const logger = createLogger('AlertingInitializer');

/**
 * Initialize alerting service
 */
export function initializeAlerting(): void {
  try {
    logger.info('Initializing alerting service');
    
    // Initialize alerting service
    alerting.initialize();
    
    // Add default notification channels
    const defaultChannels = config.get('alerting.channels', []);
    if (defaultChannels.length > 0) {
      for (const channel of defaultChannels) {
        alerting.addChannel(channel);
      }
      logger.info(`Added ${defaultChannels.length} default notification channels`);
    } else {
      // Add console notification channel by default
      const consoleChannel: AlertNotificationChannel = {
        id: 'console',
        name: 'Console',
        type: AlertNotificationChannelType.CONSOLE,
        config: {},
        enabled: true
      };
      
      alerting.addChannel(consoleChannel);
      logger.info('Added default console notification channel');
    }
    
    // Add default alert rules
    const defaultRules = config.get('alerting.rules', []);
    if (defaultRules.length > 0) {
      for (const rule of defaultRules) {
        alerting.addRule(rule);
      }
      logger.info(`Added ${defaultRules.length} default alert rules`);
    } else {
      // Add default error alert rule
      const errorRule: AlertRule = {
        id: 'error-alert',
        name: 'Error Alert',
        description: 'Alert on error events',
        severity: AlertSeverity.ERROR,
        eventTypes: ['error'],
        conditions: [
          {
            type: 'frequency',
            timeWindow: 300, // 5 minutes
            minCount: 5
          }
        ],
        enabled: true
      };
      
      alerting.addRule(errorRule);
      logger.info('Added default error alert rule');
    }
    
    // Subscribe to telemetry events
    telemetry.trackEvent({
      type: 'custom',
      name: 'alerting_service_initialized',
      timestamp: Date.now(),
      status: 'success',
      properties: {
        ruleCount: alerting.getRules().length,
        channelCount: alerting.getChannels().length
      }
    });
    
    logger.info('Alerting service initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize alerting service', error as Error);
    
    // Track error with telemetry
    telemetry.trackEvent({
      type: 'error',
      name: 'alerting_service_initialization_error',
      timestamp: Date.now(),
      status: 'error',
      error: {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined
      }
    });
  }
}

// Export default for convenience
export default initializeAlerting;
