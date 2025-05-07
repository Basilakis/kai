# Alerting Service

This document describes the alerting service implementation in the KAI platform. The alerting service provides a unified interface for generating alerts based on telemetry data, enabling proactive monitoring and issue detection.

## Overview

The alerting service is designed to monitor telemetry events and trigger alerts when specific conditions are met. It provides a consistent API for defining alert rules, notification channels, and alert management. The service integrates with the telemetry service to collect events and the event bus to publish alert notifications.

## Architecture

The alerting service follows a rule-based architecture, where alert rules define conditions that trigger alerts. The service consists of the following components:

1. **Alerting Service**: The main service that provides a unified interface for alerting operations.
2. **Alert Rules**: Rules that define conditions for triggering alerts.
3. **Notification Channels**: Channels for sending alert notifications.
4. **Alert Management**: Functions for managing active alerts.

## Usage

### Basic Usage

```typescript
import { alerting, AlertSeverity, AlertRuleConditionType } from '@kai/shared';

// Add an alert rule
alerting.addRule({
  id: 'error-alert',
  name: 'Error Alert',
  description: 'Alert on error events',
  severity: AlertSeverity.ERROR,
  eventTypes: ['error'],
  conditions: [
    {
      type: AlertRuleConditionType.FREQUENCY,
      timeWindow: 300, // 5 minutes
      minCount: 5
    }
  ],
  enabled: true
});

// Add a notification channel
alerting.addChannel({
  id: 'console',
  name: 'Console',
  type: AlertNotificationChannelType.CONSOLE,
  config: {},
  enabled: true
});

// Get active alerts
const alerts = alerting.getAlerts();

// Acknowledge an alert
alerting.acknowledgeAlert('alert-id');

// Resolve an alert
alerting.resolveAlert('alert-id');
```

### Alert Rules

Alert rules define conditions that trigger alerts. Each rule consists of:

- **ID**: Unique identifier for the rule
- **Name**: Human-readable name for the rule
- **Description**: Description of the rule
- **Severity**: Severity level of alerts triggered by the rule
- **Event Types**: Types of telemetry events to monitor
- **Event Names**: Optional names of telemetry events to monitor
- **Conditions**: Conditions that must be met to trigger an alert
- **Tags**: Optional tags for categorizing the rule
- **Properties**: Optional additional properties for the rule
- **Enabled**: Whether the rule is enabled

```typescript
const rule: AlertRule = {
  id: 'api-error-alert',
  name: 'API Error Alert',
  description: 'Alert on API error events',
  severity: AlertSeverity.ERROR,
  eventTypes: ['error'],
  eventNames: ['api_error'],
  conditions: [
    {
      type: AlertRuleConditionType.FREQUENCY,
      timeWindow: 300, // 5 minutes
      minCount: 3
    }
  ],
  tags: ['api', 'error'],
  properties: {
    team: 'backend'
  },
  enabled: true
};

alerting.addRule(rule);
```

### Alert Conditions

Alert conditions define the specific criteria that must be met to trigger an alert. The alerting service supports several types of conditions:

- **Threshold**: Triggers when a metric exceeds a threshold
- **Change**: Triggers when a metric changes by a certain amount
- **Absence**: Triggers when no events are received for a period of time
- **Frequency**: Triggers when events occur at a certain frequency
- **Custom**: Triggers based on custom logic

```typescript
// Threshold condition
const thresholdCondition: AlertRuleCondition = {
  type: AlertRuleConditionType.THRESHOLD,
  metric: 'response_time',
  threshold: 1000,
  operator: 'gt'
};

// Frequency condition
const frequencyCondition: AlertRuleCondition = {
  type: AlertRuleConditionType.FREQUENCY,
  timeWindow: 300, // 5 minutes
  minCount: 5
};

// Custom condition
const customCondition: AlertRuleCondition = {
  type: AlertRuleConditionType.CUSTOM,
  evaluate: (events) => {
    // Custom logic to evaluate events
    return events.some(event => 
      event.properties?.statusCode === 500 && 
      event.properties?.endpoint === '/api/users'
    );
  }
};
```

### Notification Channels

Notification channels define how alerts are delivered. The alerting service supports several types of channels:

- **Console**: Logs alerts to the console
- **Email**: Sends alerts via email
- **Webhook**: Sends alerts to a webhook
- **Custom**: Sends alerts using custom logic

```typescript
// Console channel
const consoleChannel: AlertNotificationChannel = {
  id: 'console',
  name: 'Console',
  type: AlertNotificationChannelType.CONSOLE,
  config: {},
  enabled: true
};

// Email channel
const emailChannel: AlertNotificationChannel = {
  id: 'email',
  name: 'Email',
  type: AlertNotificationChannelType.EMAIL,
  config: {
    recipients: ['alerts@example.com'],
    subject: '[KAI] Alert: {alert.name}'
  },
  enabled: true
};

// Webhook channel
const webhookChannel: AlertNotificationChannel = {
  id: 'webhook',
  name: 'Webhook',
  type: AlertNotificationChannelType.WEBHOOK,
  config: {
    url: 'https://hooks.slack.com/services/...',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  },
  enabled: true
};
```

## Configuration

The alerting service can be configured through environment variables or the unified configuration system. The following configuration options are available:

```typescript
// In .env file
ALERTING_ENABLED=true
ALERTING_BUFFER_SIZE=1000
ALERTING_EVALUATION_INTERVAL_MS=60000
```

## Implementation Details

### Alerting Service

The alerting service provides a unified interface for alerting operations. It manages alert rules, notification channels, and active alerts.

```typescript
class AlertingService {
  // Initialize the alerting service
  initialize(): void;
  
  // Enable alerting
  enable(): void;
  
  // Disable alerting
  disable(): void;
  
  // Add an alert rule
  addRule(rule: AlertRule): void;
  
  // Remove an alert rule
  removeRule(ruleId: string): void;
  
  // Get an alert rule
  getRule(ruleId: string): AlertRule | undefined;
  
  // Get all alert rules
  getRules(): AlertRule[];
  
  // Add a notification channel
  addChannel(channel: AlertNotificationChannel): void;
  
  // Remove a notification channel
  removeChannel(channelId: string): void;
  
  // Get a notification channel
  getChannel(channelId: string): AlertNotificationChannel | undefined;
  
  // Get all notification channels
  getChannels(): AlertNotificationChannel[];
  
  // Get an alert
  getAlert(alertId: string): Alert | undefined;
  
  // Get all alerts
  getAlerts(): Alert[];
  
  // Acknowledge an alert
  acknowledgeAlert(alertId: string): void;
  
  // Resolve an alert
  resolveAlert(alertId: string): void;
  
  // Process a telemetry event
  processEvent(event: TelemetryEvent): void;
  
  // Evaluate all alert rules
  evaluateRules(): Promise<void>;
}
```

## Benefits

The alerting service provides several benefits:

1. **Proactive Monitoring**: Detect issues before they impact users.
2. **Customizable Rules**: Define alert rules based on specific criteria.
3. **Multiple Notification Channels**: Send alerts through different channels.
4. **Alert Management**: Acknowledge and resolve alerts.
5. **Integration with Telemetry**: Use telemetry data to trigger alerts.
6. **Event-Based Architecture**: Publish alert events for other services to consume.

## Next Steps

The following steps are recommended to further improve the alerting service:

1. **Implement Condition Types**: Complete the implementation of all condition types.
2. **Add More Notification Channels**: Add support for more notification channels (SMS, PagerDuty, etc.).
3. **Add Alert Aggregation**: Group related alerts to reduce noise.
4. **Add Alert Escalation**: Escalate alerts based on severity and time.
5. **Add Alert History**: Store alert history for analysis.
6. **Add Alert Dashboards**: Create dashboards for visualizing alerts.
7. **Add Alert Templates**: Create templates for alert notifications.
