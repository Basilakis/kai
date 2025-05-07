/**
 * Alerting Service
 *
 * This module provides a unified alerting service for generating alerts based on telemetry data.
 * It integrates with the telemetry service to monitor events and trigger alerts when conditions are met.
 */

import { createLogger } from '../../utils/unified-logger';
import { config } from '../../utils/unified-config';
import { telemetry, TelemetryEvent, TelemetryEventType } from '../telemetry';
import { eventBus } from '../events';
import { tracing, SpanKind } from '../tracing';

const logger = createLogger('AlertingService');

/**
 * Alert severity
 */
export enum AlertSeverity {
  /** Informational alert */
  INFO = 'info',
  /** Warning alert */
  WARNING = 'warning',
  /** Error alert */
  ERROR = 'error',
  /** Critical alert */
  CRITICAL = 'critical'
}

/**
 * Alert status
 */
export enum AlertStatus {
  /** Alert is active */
  ACTIVE = 'active',
  /** Alert has been acknowledged */
  ACKNOWLEDGED = 'acknowledged',
  /** Alert has been resolved */
  RESOLVED = 'resolved'
}

/**
 * Alert
 */
export interface Alert {
  /** Alert ID */
  id: string;
  /** Alert name */
  name: string;
  /** Alert description */
  description: string;
  /** Alert severity */
  severity: AlertSeverity;
  /** Alert status */
  status: AlertStatus;
  /** Alert timestamp */
  timestamp: number;
  /** Alert source */
  source: string;
  /** Alert tags */
  tags?: string[];
  /** Alert properties */
  properties?: Record<string, any>;
  /** Related telemetry events */
  events?: TelemetryEvent[];
}

/**
 * Alert rule condition type
 */
export enum AlertRuleConditionType {
  /** Threshold condition */
  THRESHOLD = 'threshold',
  /** Change condition */
  CHANGE = 'change',
  /** Absence condition */
  ABSENCE = 'absence',
  /** Frequency condition */
  FREQUENCY = 'frequency',
  /** Trend condition */
  TREND = 'trend',
  /** Anomaly condition */
  ANOMALY = 'anomaly',
  /** Composite condition */
  COMPOSITE = 'composite',
  /** Dynamic threshold condition */
  DYNAMIC_THRESHOLD = 'dynamic_threshold',
  /** Custom condition */
  CUSTOM = 'custom'
}

/**
 * Logical operator for composite conditions
 */
export enum LogicalOperator {
  /** AND operator */
  AND = 'and',
  /** OR operator */
  OR = 'or',
  /** NOT operator */
  NOT = 'not'
}

/**
 * Aggregation function
 */
export enum AggregationFunction {
  /** Average */
  AVG = 'avg',
  /** Maximum */
  MAX = 'max',
  /** Minimum */
  MIN = 'min',
  /** Sum */
  SUM = 'sum',
  /** Count */
  COUNT = 'count',
  /** Last value */
  LAST = 'last',
  /** Median */
  MEDIAN = 'median',
  /** 90th percentile */
  P90 = 'p90',
  /** 95th percentile */
  P95 = 'p95',
  /** 99th percentile */
  P99 = 'p99',
  /** Standard deviation */
  STDDEV = 'stddev',
  /** Variance */
  VARIANCE = 'variance'
}

/**
 * Trend direction
 */
export enum TrendDirection {
  /** Increasing trend */
  INCREASING = 'increasing',
  /** Decreasing trend */
  DECREASING = 'decreasing',
  /** Stable trend */
  STABLE = 'stable'
}

/**
 * Alert rule condition
 */
export interface AlertRuleCondition {
  /** Condition type */
  type: AlertRuleConditionType;
  /** Metric to monitor */
  metric?: string;
  /** Multiple metrics to monitor */
  metrics?: string[];
  /** Threshold value */
  threshold?: number;
  /** Comparison operator */
  operator?: 'gt' | 'lt' | 'eq' | 'ne' | 'ge' | 'le';
  /** Time window in seconds */
  timeWindow?: number;
  /** Minimum count */
  minCount?: number;
  /** Logical operator for composite conditions */
  logicalOperator?: LogicalOperator;
  /** Child conditions for composite conditions */
  conditions?: AlertRuleCondition[];
  /** Custom condition function */
  evaluate?: (events: TelemetryEvent[]) => boolean;
  /** Additional properties */
  properties?: {
    /** Aggregation function */
    aggregation?: AggregationFunction | string;
    /** Whether to use percentage change for change condition */
    usePercentage?: boolean;
    /** Trend direction for trend condition */
    trendDirection?: TrendDirection;
    /** Trend threshold for trend condition */
    trendThreshold?: number;
    /** Sensitivity for anomaly detection (0-1) */
    sensitivity?: number;
    /** Training window for anomaly detection (in seconds) */
    trainingWindow?: number;
    /** Baseline period for dynamic thresholds (in seconds) */
    baselinePeriod?: number;
    /** Deviation factor for dynamic thresholds */
    deviationFactor?: number;
    /** Jitter for scheduled evaluations (0-1) */
    jitter?: number;
    /** Backoff strategy for failed evaluations */
    backoff?: {
      /** Initial delay in milliseconds */
      initialDelay: number;
      /** Maximum delay in milliseconds */
      maxDelay: number;
      /** Backoff factor */
      factor: number;
      /** Maximum retry count */
      maxRetries: number;
    };
    /** Any other custom properties */
    [key: string]: any;
  };
}

/**
 * Alert rule
 */
export interface AlertRule {
  /** Rule ID */
  id: string;
  /** Rule name */
  name: string;
  /** Rule description */
  description: string;
  /** Rule severity */
  severity: AlertSeverity;
  /** Event types to monitor */
  eventTypes: TelemetryEventType[];
  /** Event names to monitor */
  eventNames?: string[];
  /** Rule conditions */
  conditions: AlertRuleCondition[];
  /** Rule tags */
  tags?: string[];
  /** Rule properties */
  properties?: Record<string, any>;
  /** Whether the rule is enabled */
  enabled: boolean;
}

/**
 * Alert notification channel type
 */
export enum AlertNotificationChannelType {
  /** Console notification */
  CONSOLE = 'console',
  /** Email notification */
  EMAIL = 'email',
  /** Webhook notification */
  WEBHOOK = 'webhook',
  /** Custom notification */
  CUSTOM = 'custom'
}

/**
 * Alert notification channel
 */
export interface AlertNotificationChannel {
  /** Channel ID */
  id: string;
  /** Channel name */
  name: string;
  /** Channel type */
  type: AlertNotificationChannelType;
  /** Channel configuration */
  config: Record<string, any>;
  /** Whether the channel is enabled */
  enabled: boolean;
}

/**
 * Alerting service
 */
class AlertingService {
  private rules: Map<string, AlertRule> = new Map();
  private channels: Map<string, AlertNotificationChannel> = new Map();
  private alerts: Map<string, Alert> = new Map();
  private eventBuffer: Map<string, TelemetryEvent[]> = new Map();
  private bufferSize: number = 1000;
  private evaluationInterval: NodeJS.Timeout | null = null;
  private initialized: boolean = false;
  private enabled: boolean = true;

  /**
   * Initialize the alerting service
   */
  initialize(): void {
    if (this.initialized) {
      return;
    }

    this.initialized = true;
    this.enabled = config.get('alerting.enabled', true);
    this.bufferSize = config.get('alerting.bufferSize', 1000);

    // Subscribe to telemetry events
    telemetry.trackEvent({
      type: 'custom',
      name: 'alerting_service_initialized',
      timestamp: Date.now(),
      status: 'success',
      properties: {
        enabled: this.enabled,
        bufferSize: this.bufferSize
      }
    });

    // Start evaluation interval
    const evaluationIntervalMs = config.get('alerting.evaluationIntervalMs', 60000);
    this.evaluationInterval = setInterval(() => {
      this.evaluateRules().catch((error) => {
        logger.error('Error evaluating alert rules', error);
      });
    }, evaluationIntervalMs);

    logger.info('Alerting service initialized', {
      enabled: this.enabled,
      bufferSize: this.bufferSize,
      evaluationIntervalMs
    });
  }

  /**
   * Enable alerting
   */
  enable(): void {
    this.enabled = true;
    logger.info('Alerting enabled');
  }

  /**
   * Disable alerting
   */
  disable(): void {
    this.enabled = false;
    logger.info('Alerting disabled');
  }

  /**
   * Add an alert rule
   * @param rule Alert rule
   */
  addRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);

    logger.info(`Added alert rule: ${rule.id}`, {
      name: rule.name,
      severity: rule.severity,
      eventTypes: rule.eventTypes,
      eventNames: rule.eventNames,
      conditions: rule.conditions.length
    });
  }

  /**
   * Remove an alert rule
   * @param ruleId Rule ID
   */
  removeRule(ruleId: string): void {
    if (!this.rules.has(ruleId)) {
      return;
    }

    this.rules.delete(ruleId);

    logger.info(`Removed alert rule: ${ruleId}`);
  }

  /**
   * Get an alert rule
   * @param ruleId Rule ID
   * @returns Alert rule
   */
  getRule(ruleId: string): AlertRule | undefined {
    return this.rules.get(ruleId);
  }

  /**
   * Get all alert rules
   * @returns Alert rules
   */
  getRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Add a notification channel
   * @param channel Notification channel
   */
  addChannel(channel: AlertNotificationChannel): void {
    this.channels.set(channel.id, channel);

    logger.info(`Added notification channel: ${channel.id}`, {
      name: channel.name,
      type: channel.type,
      enabled: channel.enabled
    });
  }

  /**
   * Remove a notification channel
   * @param channelId Channel ID
   */
  removeChannel(channelId: string): void {
    if (!this.channels.has(channelId)) {
      return;
    }

    this.channels.delete(channelId);

    logger.info(`Removed notification channel: ${channelId}`);
  }

  /**
   * Get a notification channel
   * @param channelId Channel ID
   * @returns Notification channel
   */
  getChannel(channelId: string): AlertNotificationChannel | undefined {
    return this.channels.get(channelId);
  }

  /**
   * Get all notification channels
   * @returns Notification channels
   */
  getChannels(): AlertNotificationChannel[] {
    return Array.from(this.channels.values());
  }

  /**
   * Get an alert
   * @param alertId Alert ID
   * @returns Alert
   */
  getAlert(alertId: string): Alert | undefined {
    return this.alerts.get(alertId);
  }

  /**
   * Get all alerts
   * @returns Alerts
   */
  getAlerts(): Alert[] {
    return Array.from(this.alerts.values());
  }

  /**
   * Acknowledge an alert
   * @param alertId Alert ID
   */
  acknowledgeAlert(alertId: string): void {
    if (!this.alerts.has(alertId)) {
      return;
    }

    const alert = this.alerts.get(alertId)!;
    alert.status = AlertStatus.ACKNOWLEDGED;

    logger.info(`Acknowledged alert: ${alertId}`, {
      name: alert.name,
      severity: alert.severity
    });

    // Publish event
    eventBus.publish('alert_acknowledged', { alertId, alert });
  }

  /**
   * Resolve an alert
   * @param alertId Alert ID
   */
  resolveAlert(alertId: string): void {
    if (!this.alerts.has(alertId)) {
      return;
    }

    const alert = this.alerts.get(alertId)!;
    alert.status = AlertStatus.RESOLVED;

    logger.info(`Resolved alert: ${alertId}`, {
      name: alert.name,
      severity: alert.severity
    });

    // Publish event
    eventBus.publish('alert_resolved', { alertId, alert });
  }

  /**
   * Process a telemetry event
   * @param event Telemetry event
   */
  processEvent(event: TelemetryEvent): void {
    if (!this.enabled) {
      return;
    }

    // Buffer the event
    const key = `${event.type}:${event.name}`;

    if (!this.eventBuffer.has(key)) {
      this.eventBuffer.set(key, []);
    }

    const buffer = this.eventBuffer.get(key)!;
    buffer.push(event);

    // Trim buffer if it exceeds the maximum size
    if (buffer.length > this.bufferSize) {
      buffer.shift();
    }

    // Log event processing
    logger.debug(`Processed telemetry event: ${event.type}:${event.name}`, {
      timestamp: event.timestamp,
      status: event.status
    });

    // Check if we should evaluate rules immediately for this event
    const evaluateImmediately = config.get('alerting.evaluateImmediately', false);
    if (evaluateImmediately) {
      // Only evaluate rules that match this event type
      const matchingRules = Array.from(this.rules.values()).filter(rule =>
        rule.enabled &&
        rule.eventTypes.includes(event.type) &&
        (!rule.eventNames || rule.eventNames.length === 0 || rule.eventNames.includes(event.name))
      );

      if (matchingRules.length > 0) {
        logger.debug(`Evaluating ${matchingRules.length} rules immediately for event: ${event.type}:${event.name}`);

        // Evaluate each matching rule
        for (const rule of matchingRules) {
          this.evaluateRule(rule).catch(error => {
            logger.error(`Error evaluating rule: ${rule.id}`, error);
          });
        }
      }
    }
  }

  /**
   * Evaluate a single alert rule
   * @param rule Rule to evaluate
   */
  async evaluateRule(rule: AlertRule): Promise<void> {
    if (!this.enabled || !rule.enabled) {
      return;
    }

    // Use tracing to track the evaluation
    await tracing.withSpan(
      `ALERT_EVALUATE_RULE ${rule.id}`,
      async () => {
        // Get the current span
        const span = tracing.getCurrentSpan();

        if (span) {
          // Add attributes to the span
          tracing.addSpanAttributes(span, {
            'alerting.rule_id': rule.id,
            'alerting.rule_name': rule.name,
            'alerting.rule_severity': rule.severity,
            'alerting.event_types': rule.eventTypes.join(',')
          });
        }

        try {
          // Get relevant events
          const events: TelemetryEvent[] = [];

          for (const eventType of rule.eventTypes) {
            for (const [key, buffer] of this.eventBuffer.entries()) {
              if (key.startsWith(`${eventType}:`)) {
                // If event names are specified, filter by name
                if (rule.eventNames && rule.eventNames.length > 0) {
                  const eventName = key.split(':')[1];
                  if (rule.eventNames.includes(eventName)) {
                    events.push(...buffer);
                  }
                } else {
                  events.push(...buffer);
                }
              }
            }
          }

          // Add event count to span
          if (span) {
            tracing.addSpanAttributes(span, {
              'alerting.event_count': events.length
            });
          }

          // Evaluate conditions
          let triggered = true;

          for (const condition of rule.conditions) {
            if (!this.evaluateCondition(condition, events)) {
              triggered = false;
              break;
            }
          }

          // Add triggered status to span
          if (span) {
            tracing.addSpanAttributes(span, {
              'alerting.triggered': triggered
            });
          }

          // Create alert if triggered
          if (triggered) {
            const alertId = `${rule.id}-${Date.now()}`;
            const alert: Alert = {
              id: alertId,
              name: rule.name,
              description: rule.description,
              severity: rule.severity,
              status: AlertStatus.ACTIVE,
              timestamp: Date.now(),
              source: 'alerting-service',
              tags: rule.tags,
              properties: rule.properties,
              events: events.slice(0, 10) // Include up to 10 events
            };

            this.alerts.set(alertId, alert);

            logger.info(`Alert triggered: ${alertId}`, {
              name: alert.name,
              severity: alert.severity,
              eventCount: events.length
            });

            // Publish event
            eventBus.publish('alert_triggered', { alertId, alert });

            // Send notifications
            this.sendNotifications(alert);
          }
        } catch (error) {
          logger.error(`Error evaluating rule: ${rule.id}`, error as Error);

          // Add error to span
          if (span) {
            tracing.setSpanStatus(
              span,
              1, // ERROR
              error instanceof Error ? error.message : String(error)
            );
          }
        }
      },
      {
        kind: SpanKind.INTERNAL,
        attributes: {
          'alerting.rule_id': rule.id,
          'alerting.rule_name': rule.name,
          'alerting.rule_severity': rule.severity
        }
      }
    );
  }

  /**
   * Evaluate all alert rules
   */
  async evaluateRules(): Promise<void> {
    if (!this.enabled) {
      return;
    }

    // Use tracing to track the evaluation
    await tracing.withSpan(
      'ALERT_EVALUATE_RULES',
      async () => {
        // Get the current span
        const span = tracing.getCurrentSpan();

        if (span) {
          // Add attributes to the span
          tracing.addSpanAttributes(span, {
            'alerting.rule_count': this.rules.size,
            'alerting.event_buffer_size': this.eventBuffer.size
          });
        }

        logger.debug(`Evaluating ${this.rules.size} alert rules`);

        // Evaluate each rule
        const promises: Promise<void>[] = [];

        for (const rule of this.rules.values()) {
          if (!rule.enabled) {
            continue;
          }

          promises.push(this.evaluateRule(rule));
        }

        // Wait for all evaluations to complete
        await Promise.all(promises);

        // Log completion
        logger.debug(`Completed evaluating ${this.rules.size} alert rules`);
      },
      {
        kind: SpanKind.INTERNAL,
        attributes: {
          'alerting.rule_count': this.rules.size,
          'alerting.event_buffer_size': this.eventBuffer.size
        }
      }
    );
  }

  /**
   * Evaluate a condition
   * @param condition Condition to evaluate
   * @param events Events to evaluate against
   * @returns Whether the condition is met
   */
  private evaluateCondition(condition: AlertRuleCondition, events: TelemetryEvent[]): boolean {
    // Use custom evaluator if provided
    if (condition.evaluate) {
      return condition.evaluate(events);
    }

    // Apply condition type
    switch (condition.type) {
      case AlertRuleConditionType.THRESHOLD:
        return this.evaluateThresholdCondition(condition, events);

      case AlertRuleConditionType.FREQUENCY:
        return this.evaluateFrequencyCondition(condition, events);

      case AlertRuleConditionType.ABSENCE:
        return this.evaluateAbsenceCondition(condition, events);

      case AlertRuleConditionType.CHANGE:
        return this.evaluateChangeCondition(condition, events);

      case AlertRuleConditionType.TREND:
        return this.evaluateTrendCondition(condition, events);

      case AlertRuleConditionType.ANOMALY:
        return this.evaluateAnomalyCondition(condition, events);

      case AlertRuleConditionType.COMPOSITE:
        return this.evaluateCompositeCondition(condition, events);

      case AlertRuleConditionType.DYNAMIC_THRESHOLD:
        return this.evaluateDynamicThresholdCondition(condition, events);

      default:
        logger.warn(`Unknown condition type: ${condition.type}`);
        return false;
    }
  }

  /**
   * Evaluate a threshold condition
   * @param condition Condition to evaluate
   * @param events Events to evaluate against
   * @returns Whether the condition is met
   */
  private evaluateThresholdCondition(condition: AlertRuleCondition, events: TelemetryEvent[]): boolean {
    if (!condition.metric || condition.threshold === undefined || !condition.operator) {
      logger.warn('Invalid threshold condition: missing required properties', { condition });
      return false;
    }

    // Filter events within the time window if specified
    let filteredEvents = events;
    if (condition.timeWindow) {
      const now = Date.now();
      const windowStart = now - condition.timeWindow * 1000;
      filteredEvents = events.filter(event => event.timestamp >= windowStart);
    }

    // No events to evaluate
    if (filteredEvents.length === 0) {
      return false;
    }

    // Extract metric values from events
    const metricValues: number[] = [];

    for (const event of filteredEvents) {
      // Check if the metric is in the event properties
      if (event.properties && event.properties[condition.metric] !== undefined) {
        const value = event.properties[condition.metric];

        // Only add numeric values
        if (typeof value === 'number') {
          metricValues.push(value);
        }
      }

      // Check if the metric is in the event measurements
      if (event.measurements && event.measurements[condition.metric] !== undefined) {
        metricValues.push(event.measurements[condition.metric]);
      }
    }

    // No metric values found
    if (metricValues.length === 0) {
      return false;
    }

    // Calculate the aggregate value
    let aggregateValue: number;

    // Default to average if not specified
    const aggregation = condition.properties?.aggregation || AggregationFunction.AVG;

    switch (aggregation) {
      case AggregationFunction.AVG:
      case 'avg':
        aggregateValue = metricValues.reduce((sum, value) => sum + value, 0) / metricValues.length;
        break;

      case AggregationFunction.MAX:
      case 'max':
        aggregateValue = Math.max(...metricValues);
        break;

      case AggregationFunction.MIN:
      case 'min':
        aggregateValue = Math.min(...metricValues);
        break;

      case AggregationFunction.SUM:
      case 'sum':
        aggregateValue = metricValues.reduce((sum, value) => sum + value, 0);
        break;

      case AggregationFunction.COUNT:
      case 'count':
        aggregateValue = metricValues.length;
        break;

      case AggregationFunction.LAST:
      case 'last':
        aggregateValue = metricValues[metricValues.length - 1];
        break;

      case AggregationFunction.MEDIAN:
      case 'median':
        // Sort values and get the middle one
        const sortedValues = [...metricValues].sort((a, b) => a - b);
        const middle = Math.floor(sortedValues.length / 2);

        if (sortedValues.length % 2 === 0) {
          // Even number of values, average the two middle values
          aggregateValue = (sortedValues[middle - 1] + sortedValues[middle]) / 2;
        } else {
          // Odd number of values, take the middle value
          aggregateValue = sortedValues[middle];
        }
        break;

      case AggregationFunction.P90:
      case 'p90':
        // 90th percentile
        aggregateValue = this.calculatePercentile(metricValues, 90);
        break;

      case AggregationFunction.P95:
      case 'p95':
        // 95th percentile
        aggregateValue = this.calculatePercentile(metricValues, 95);
        break;

      case AggregationFunction.P99:
      case 'p99':
        // 99th percentile
        aggregateValue = this.calculatePercentile(metricValues, 99);
        break;

      case AggregationFunction.STDDEV:
      case 'stddev':
        // Standard deviation
        const mean = metricValues.reduce((sum, value) => sum + value, 0) / metricValues.length;
        const squaredDifferences = metricValues.map(value => Math.pow(value - mean, 2));
        const variance = squaredDifferences.reduce((sum, value) => sum + value, 0) / metricValues.length;
        aggregateValue = Math.sqrt(variance);
        break;

      case AggregationFunction.VARIANCE:
      case 'variance':
        // Variance
        const meanForVariance = metricValues.reduce((sum, value) => sum + value, 0) / metricValues.length;
        const squaredDifferencesForVariance = metricValues.map(value => Math.pow(value - meanForVariance, 2));
        aggregateValue = squaredDifferencesForVariance.reduce((sum, value) => sum + value, 0) / metricValues.length;
        break;

      default:
        logger.warn(`Unknown aggregation function: ${aggregation}, using average`);
        aggregateValue = metricValues.reduce((sum, value) => sum + value, 0) / metricValues.length;
    }

    // Compare the aggregate value to the threshold
    switch (condition.operator) {
      case 'gt':
        return aggregateValue > condition.threshold;
      case 'lt':
        return aggregateValue < condition.threshold;
      case 'eq':
        return aggregateValue === condition.threshold;
      case 'ne':
        return aggregateValue !== condition.threshold;
      case 'ge':
        return aggregateValue >= condition.threshold;
      case 'le':
        return aggregateValue <= condition.threshold;
      default:
        logger.warn(`Unknown operator: ${condition.operator}`);
        return false;
    }
  }

  /**
   * Evaluate a frequency condition
   * @param condition Condition to evaluate
   * @param events Events to evaluate against
   * @returns Whether the condition is met
   */
  private evaluateFrequencyCondition(condition: AlertRuleCondition, events: TelemetryEvent[]): boolean {
    if (condition.timeWindow === undefined || condition.minCount === undefined) {
      logger.warn('Invalid frequency condition: missing required properties', { condition });
      return false;
    }

    // Filter events within the time window
    const now = Date.now();
    const windowStart = now - condition.timeWindow * 1000;
    const filteredEvents = events.filter(event => event.timestamp >= windowStart);

    // Check if the number of events meets the minimum count
    return filteredEvents.length >= condition.minCount;
  }

  /**
   * Evaluate an absence condition
   * @param condition Condition to evaluate
   * @param events Events to evaluate against
   * @returns Whether the condition is met
   */
  private evaluateAbsenceCondition(condition: AlertRuleCondition, events: TelemetryEvent[]): boolean {
    if (condition.timeWindow === undefined) {
      logger.warn('Invalid absence condition: missing required properties', { condition });
      return false;
    }

    // Filter events within the time window
    const now = Date.now();
    const windowStart = now - condition.timeWindow * 1000;
    const filteredEvents = events.filter(event => event.timestamp >= windowStart);

    // Check if there are no events in the time window
    return filteredEvents.length === 0;
  }

  /**
   * Evaluate a change condition
   * @param condition Condition to evaluate
   * @param events Events to evaluate against
   * @returns Whether the condition is met
   */
  private evaluateChangeCondition(condition: AlertRuleCondition, events: TelemetryEvent[]): boolean {
    if (!condition.metric || condition.threshold === undefined || !condition.operator) {
      logger.warn('Invalid change condition: missing required properties', { condition });
      return false;
    }

    // Filter events within the time window if specified
    let filteredEvents = events;
    if (condition.timeWindow) {
      const now = Date.now();
      const windowStart = now - condition.timeWindow * 1000;
      filteredEvents = events.filter(event => event.timestamp >= windowStart);
    }

    // Need at least two events to calculate change
    if (filteredEvents.length < 2) {
      return false;
    }

    // Sort events by timestamp (oldest first)
    filteredEvents.sort((a, b) => a.timestamp - b.timestamp);

    // Extract metric values from events
    const metricValues: number[] = [];

    for (const event of filteredEvents) {
      // Check if the metric is in the event properties
      if (event.properties && event.properties[condition.metric] !== undefined) {
        const value = event.properties[condition.metric];

        // Only add numeric values
        if (typeof value === 'number') {
          metricValues.push(value);
        }
      }

      // Check if the metric is in the event measurements
      if (event.measurements && event.measurements[condition.metric] !== undefined) {
        metricValues.push(event.measurements[condition.metric]);
      }
    }

    // Need at least two metric values to calculate change
    if (metricValues.length < 2) {
      return false;
    }

    // Calculate the change
    const firstValue = metricValues[0];
    const lastValue = metricValues[metricValues.length - 1];
    const absoluteChange = lastValue - firstValue;
    const percentageChange = (absoluteChange / Math.abs(firstValue)) * 100;

    // Use absolute or percentage change based on condition properties
    const usePercentage = condition.properties?.usePercentage === true;
    const changeValue = usePercentage ? percentageChange : absoluteChange;

    // Compare the change to the threshold
    switch (condition.operator) {
      case 'gt':
        return changeValue > condition.threshold;
      case 'lt':
        return changeValue < condition.threshold;
      case 'eq':
        return changeValue === condition.threshold;
      case 'ne':
        return changeValue !== condition.threshold;
      case 'ge':
        return changeValue >= condition.threshold;
      case 'le':
        return changeValue <= condition.threshold;
      default:
        logger.warn(`Unknown operator: ${condition.operator}`);
        return false;
    }
  }

  /**
   * Send notifications for an alert
   * @param alert Alert to send notifications for
   */
  private sendNotifications(alert: Alert): void {
    for (const channel of this.channels.values()) {
      if (!channel.enabled) {
        continue;
      }

      try {
        switch (channel.type) {
          case AlertNotificationChannelType.CONSOLE:
            this.sendConsoleNotification(channel, alert);
            break;

          case AlertNotificationChannelType.EMAIL:
            // TODO: Implement email notification
            break;

          case AlertNotificationChannelType.WEBHOOK:
            // TODO: Implement webhook notification
            break;

          case AlertNotificationChannelType.CUSTOM:
            // TODO: Implement custom notification
            break;
        }
      } catch (error) {
        logger.error(`Error sending notification to channel: ${channel.id}`, error as Error);
      }
    }
  }

  /**
   * Send a console notification
   * @param channel Notification channel
   * @param alert Alert to send notification for
   */
  private sendConsoleNotification(channel: AlertNotificationChannel, alert: Alert): void {
    const message = `ALERT [${alert.severity}]: ${alert.name} - ${alert.description}`;

    switch (alert.severity) {
      case AlertSeverity.INFO:
        logger.info(message, { alert });
        break;

      case AlertSeverity.WARNING:
        logger.warn(message, { alert });
        break;

      case AlertSeverity.ERROR:
      case AlertSeverity.CRITICAL:
        logger.error(message, { alert });
        break;
    }
  }

  /**
   * Evaluate a trend condition
   * @param condition Condition to evaluate
   * @param events Events to evaluate against
   * @returns Whether the condition is met
   */
  private evaluateTrendCondition(condition: AlertRuleCondition, events: TelemetryEvent[]): boolean {
    if (!condition.metric || !condition.properties?.trendDirection) {
      logger.warn('Invalid trend condition: missing required properties', { condition });
      return false;
    }

    // Filter events within the time window if specified
    let filteredEvents = events;
    if (condition.timeWindow) {
      const now = Date.now();
      const windowStart = now - condition.timeWindow * 1000;
      filteredEvents = events.filter(event => event.timestamp >= windowStart);
    }

    // Need at least two events to calculate trend
    if (filteredEvents.length < 2) {
      return false;
    }

    // Sort events by timestamp (oldest first)
    filteredEvents.sort((a, b) => a.timestamp - b.timestamp);

    // Extract metric values from events
    const metricValues: { timestamp: number; value: number }[] = [];

    for (const event of filteredEvents) {
      // Check if the metric is in the event properties
      if (event.properties && event.properties[condition.metric] !== undefined) {
        const value = event.properties[condition.metric];

        // Only add numeric values
        if (typeof value === 'number') {
          metricValues.push({ timestamp: event.timestamp, value });
        }
      }

      // Check if the metric is in the event measurements
      if (event.measurements && event.measurements[condition.metric] !== undefined) {
        metricValues.push({
          timestamp: event.timestamp,
          value: event.measurements[condition.metric]
        });
      }
    }

    // Need at least two metric values to calculate trend
    if (metricValues.length < 2) {
      return false;
    }

    // Calculate linear regression
    const n = metricValues.length;
    const sumX = metricValues.reduce((sum, point) => sum + point.timestamp, 0);
    const sumY = metricValues.reduce((sum, point) => sum + point.value, 0);
    const sumXY = metricValues.reduce((sum, point) => sum + point.timestamp * point.value, 0);
    const sumXX = metricValues.reduce((sum, point) => sum + point.timestamp * point.timestamp, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

    // Get trend threshold
    const trendThreshold = condition.properties.trendThreshold || 0;

    // Check trend direction
    switch (condition.properties.trendDirection) {
      case TrendDirection.INCREASING:
        return slope > trendThreshold;

      case TrendDirection.DECREASING:
        return slope < -trendThreshold;

      case TrendDirection.STABLE:
        return Math.abs(slope) <= trendThreshold;

      default:
        logger.warn(`Unknown trend direction: ${condition.properties.trendDirection}`);
        return false;
    }
  }

  /**
   * Evaluate an anomaly condition
   * @param condition Condition to evaluate
   * @param events Events to evaluate against
   * @returns Whether the condition is met
   */
  private evaluateAnomalyCondition(condition: AlertRuleCondition, events: TelemetryEvent[]): boolean {
    if (!condition.metric) {
      logger.warn('Invalid anomaly condition: missing required properties', { condition });
      return false;
    }

    // Get sensitivity (default to 0.5)
    const sensitivity = condition.properties?.sensitivity || 0.5;

    // Get training window (default to 24 hours)
    const trainingWindow = condition.properties?.trainingWindow || 24 * 60 * 60;

    // Filter events within the time window
    const now = Date.now();
    const windowStart = now - trainingWindow * 1000;
    const trainingEvents = events.filter(event => event.timestamp >= windowStart && event.timestamp < now - 60000); // Exclude last minute
    const testEvents = events.filter(event => event.timestamp >= now - 60000); // Last minute

    // Need enough events for training and testing
    if (trainingEvents.length < 10 || testEvents.length === 0) {
      return false;
    }

    // Extract metric values from training events
    const trainingValues: number[] = [];

    for (const event of trainingEvents) {
      // Check if the metric is in the event properties
      if (event.properties && event.properties[condition.metric] !== undefined) {
        const value = event.properties[condition.metric];

        // Only add numeric values
        if (typeof value === 'number') {
          trainingValues.push(value);
        }
      }

      // Check if the metric is in the event measurements
      if (event.measurements && event.measurements[condition.metric] !== undefined) {
        trainingValues.push(event.measurements[condition.metric]);
      }
    }

    // Extract metric values from test events
    const testValues: number[] = [];

    for (const event of testEvents) {
      // Check if the metric is in the event properties
      if (event.properties && event.properties[condition.metric] !== undefined) {
        const value = event.properties[condition.metric];

        // Only add numeric values
        if (typeof value === 'number') {
          testValues.push(value);
        }
      }

      // Check if the metric is in the event measurements
      if (event.measurements && event.measurements[condition.metric] !== undefined) {
        testValues.push(event.measurements[condition.metric]);
      }
    }

    // Need enough values for training and testing
    if (trainingValues.length < 10 || testValues.length === 0) {
      return false;
    }

    // Calculate mean and standard deviation of training values
    const mean = trainingValues.reduce((sum, value) => sum + value, 0) / trainingValues.length;
    const squaredDifferences = trainingValues.map(value => Math.pow(value - mean, 2));
    const variance = squaredDifferences.reduce((sum, value) => sum + value, 0) / trainingValues.length;
    const stdDev = Math.sqrt(variance);

    // Calculate z-scores for test values
    const zScores = testValues.map(value => Math.abs((value - mean) / stdDev));

    // Check if any z-score exceeds the threshold (based on sensitivity)
    const threshold = 3 - 2 * sensitivity; // Range from 1 to 3
    return zScores.some(zScore => zScore > threshold);
  }

  /**
   * Evaluate a composite condition
   * @param condition Condition to evaluate
   * @param events Events to evaluate against
   * @returns Whether the condition is met
   */
  private evaluateCompositeCondition(condition: AlertRuleCondition, events: TelemetryEvent[]): boolean {
    if (!condition.conditions || condition.conditions.length === 0) {
      logger.warn('Invalid composite condition: missing child conditions', { condition });
      return false;
    }

    // Default to AND if no logical operator is specified
    const logicalOperator = condition.logicalOperator || LogicalOperator.AND;

    switch (logicalOperator) {
      case LogicalOperator.AND:
        // All conditions must be met
        return condition.conditions.every(childCondition =>
          this.evaluateCondition(childCondition, events)
        );

      case LogicalOperator.OR:
        // At least one condition must be met
        return condition.conditions.some(childCondition =>
          this.evaluateCondition(childCondition, events)
        );

      case LogicalOperator.NOT:
        // The condition must not be met
        // For NOT, we only consider the first child condition
        if (condition.conditions.length > 1) {
          logger.warn('NOT operator should have only one child condition, using the first one', { condition });
        }

        return !this.evaluateCondition(condition.conditions[0], events);

      default:
        logger.warn(`Unknown logical operator: ${logicalOperator}`);
        return false;
    }
  }

  /**
   * Evaluate a dynamic threshold condition
   * @param condition Condition to evaluate
   * @param events Events to evaluate against
   * @returns Whether the condition is met
   */
  private evaluateDynamicThresholdCondition(condition: AlertRuleCondition, events: TelemetryEvent[]): boolean {
    if (!condition.metric || !condition.operator) {
      logger.warn('Invalid dynamic threshold condition: missing required properties', { condition });
      return false;
    }

    // Get baseline period (default to 24 hours)
    const baselinePeriod = condition.properties?.baselinePeriod || 24 * 60 * 60;

    // Get deviation factor (default to 2)
    const deviationFactor = condition.properties?.deviationFactor || 2;

    // Filter events within the time window
    const now = Date.now();
    const baselineStart = now - baselinePeriod * 1000;
    const baselineEvents = events.filter(event => event.timestamp >= baselineStart && event.timestamp < now - 300000); // Exclude last 5 minutes
    const currentEvents = events.filter(event => event.timestamp >= now - 300000); // Last 5 minutes

    // Need enough events for baseline and current
    if (baselineEvents.length < 10 || currentEvents.length === 0) {
      return false;
    }

    // Extract metric values from baseline events
    const baselineValues: number[] = [];

    for (const event of baselineEvents) {
      // Check if the metric is in the event properties
      if (event.properties && event.properties[condition.metric] !== undefined) {
        const value = event.properties[condition.metric];

        // Only add numeric values
        if (typeof value === 'number') {
          baselineValues.push(value);
        }
      }

      // Check if the metric is in the event measurements
      if (event.measurements && event.measurements[condition.metric] !== undefined) {
        baselineValues.push(event.measurements[condition.metric]);
      }
    }

    // Extract metric values from current events
    const currentValues: number[] = [];

    for (const event of currentEvents) {
      // Check if the metric is in the event properties
      if (event.properties && event.properties[condition.metric] !== undefined) {
        const value = event.properties[condition.metric];

        // Only add numeric values
        if (typeof value === 'number') {
          currentValues.push(value);
        }
      }

      // Check if the metric is in the event measurements
      if (event.measurements && event.measurements[condition.metric] !== undefined) {
        currentValues.push(event.measurements[condition.metric]);
      }
    }

    // Need enough values for baseline and current
    if (baselineValues.length < 10 || currentValues.length === 0) {
      return false;
    }

    // Calculate mean and standard deviation of baseline values
    const mean = baselineValues.reduce((sum, value) => sum + value, 0) / baselineValues.length;
    const squaredDifferences = baselineValues.map(value => Math.pow(value - mean, 2));
    const variance = squaredDifferences.reduce((sum, value) => sum + value, 0) / baselineValues.length;
    const stdDev = Math.sqrt(variance);

    // Calculate dynamic threshold
    const upperThreshold = mean + deviationFactor * stdDev;
    const lowerThreshold = mean - deviationFactor * stdDev;

    // Calculate aggregate value for current values
    const aggregation = condition.properties?.aggregation || AggregationFunction.AVG;
    let currentValue: number;

    switch (aggregation) {
      case AggregationFunction.AVG:
      case 'avg':
        currentValue = currentValues.reduce((sum, value) => sum + value, 0) / currentValues.length;
        break;

      case AggregationFunction.MAX:
      case 'max':
        currentValue = Math.max(...currentValues);
        break;

      case AggregationFunction.MIN:
      case 'min':
        currentValue = Math.min(...currentValues);
        break;

      default:
        currentValue = currentValues.reduce((sum, value) => sum + value, 0) / currentValues.length;
    }

    // Compare current value to dynamic threshold
    switch (condition.operator) {
      case 'gt':
        return currentValue > upperThreshold;

      case 'lt':
        return currentValue < lowerThreshold;

      case 'ge':
        return currentValue >= upperThreshold;

      case 'le':
        return currentValue <= lowerThreshold;

      case 'ne':
        return currentValue <= lowerThreshold || currentValue >= upperThreshold;

      default:
        logger.warn(`Unknown operator: ${condition.operator}`);
        return false;
    }
  }

  /**
   * Calculate percentile
   * @param values Values to calculate percentile from
   * @param percentile Percentile to calculate (0-100)
   * @returns Percentile value
   */
  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) {
      return 0;
    }

    // Sort values
    const sortedValues = [...values].sort((a, b) => a - b);

    // Calculate index
    const index = (percentile / 100) * (sortedValues.length - 1);

    // If index is an integer, return the value at that index
    if (Number.isInteger(index)) {
      return sortedValues[index];
    }

    // Otherwise, interpolate between the two nearest values
    const lowerIndex = Math.floor(index);
    const upperIndex = Math.ceil(index);
    const weight = index - lowerIndex;

    return sortedValues[lowerIndex] * (1 - weight) + sortedValues[upperIndex] * weight;
  }
}

// Create and export a singleton instance
export const alerting = new AlertingService();

// Export default for convenience
export default alerting;
