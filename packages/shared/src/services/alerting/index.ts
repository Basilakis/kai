/**
 * Alerting Service Index
 * 
 * This file exports all alerting-related functionality.
 */

// Export alerting service
export { 
  alerting, 
  Alert, 
  AlertSeverity, 
  AlertStatus,
  AlertRule,
  AlertRuleCondition,
  AlertRuleConditionType,
  AlertNotificationChannel,
  AlertNotificationChannelType
} from './alertingService';

// Export alerting initializer
export { 
  initializeAlerting 
} from './alertingInitializer';

// Export default for convenience
export { alerting as default } from './alertingService';
