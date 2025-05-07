# Alerting Service Condition Types

This document describes the implementation of all condition types in the alerting service. The alerting service provides a unified interface for generating alerts based on telemetry data, enabling proactive monitoring and issue detection.

## Overview

The alerting service supports several types of conditions for triggering alerts:

1. **Threshold Condition**: Triggers when a metric exceeds a threshold
2. **Frequency Condition**: Triggers when events occur at a certain frequency
3. **Absence Condition**: Triggers when no events are received for a period of time
4. **Change Condition**: Triggers when a metric changes by a certain amount
5. **Custom Condition**: Triggers based on custom logic

## Condition Types

### Threshold Condition

The threshold condition triggers an alert when a metric exceeds a threshold. It supports various comparison operators and aggregation functions.

#### Properties

- **type**: `AlertRuleConditionType.THRESHOLD`
- **metric**: The metric to monitor (required)
- **threshold**: The threshold value (required)
- **operator**: The comparison operator (required)
  - `gt`: Greater than
  - `lt`: Less than
  - `eq`: Equal to
  - `ne`: Not equal to
  - `ge`: Greater than or equal to
  - `le`: Less than or equal to
- **timeWindow**: The time window in seconds (optional)
- **properties**: Additional properties (optional)
  - **aggregation**: The aggregation function (optional)
    - `avg`: Average (default)
    - `max`: Maximum
    - `min`: Minimum
    - `sum`: Sum
    - `count`: Count
    - `last`: Last value

#### Example

```typescript
const thresholdCondition: AlertRuleCondition = {
  type: AlertRuleConditionType.THRESHOLD,
  metric: 'response_time',
  threshold: 1000,
  operator: 'gt',
  timeWindow: 300, // 5 minutes
  properties: {
    aggregation: 'avg'
  }
};
```

#### Implementation

The threshold condition is implemented as follows:

1. Filter events within the time window if specified
2. Extract metric values from events (from properties or measurements)
3. Calculate the aggregate value based on the aggregation function
4. Compare the aggregate value to the threshold using the specified operator

### Frequency Condition

The frequency condition triggers an alert when events occur at a certain frequency. It counts the number of events within a time window and triggers if the count exceeds a threshold.

#### Properties

- **type**: `AlertRuleConditionType.FREQUENCY`
- **timeWindow**: The time window in seconds (required)
- **minCount**: The minimum count of events (required)

#### Example

```typescript
const frequencyCondition: AlertRuleCondition = {
  type: AlertRuleConditionType.FREQUENCY,
  timeWindow: 300, // 5 minutes
  minCount: 5
};
```

#### Implementation

The frequency condition is implemented as follows:

1. Filter events within the time window
2. Count the number of events
3. Compare the count to the minimum count

### Absence Condition

The absence condition triggers an alert when no events are received for a period of time. It's useful for detecting when a service or component is down.

#### Properties

- **type**: `AlertRuleConditionType.ABSENCE`
- **timeWindow**: The time window in seconds (required)

#### Example

```typescript
const absenceCondition: AlertRuleCondition = {
  type: AlertRuleConditionType.ABSENCE,
  timeWindow: 300 // 5 minutes
};
```

#### Implementation

The absence condition is implemented as follows:

1. Filter events within the time window
2. Check if there are no events in the time window

### Change Condition

The change condition triggers an alert when a metric changes by a certain amount. It supports both absolute and percentage changes.

#### Properties

- **type**: `AlertRuleConditionType.CHANGE`
- **metric**: The metric to monitor (required)
- **threshold**: The threshold value (required)
- **operator**: The comparison operator (required)
- **timeWindow**: The time window in seconds (optional)
- **properties**: Additional properties (optional)
  - **usePercentage**: Whether to use percentage change (optional, default: false)

#### Example

```typescript
const changeCondition: AlertRuleCondition = {
  type: AlertRuleConditionType.CHANGE,
  metric: 'response_time',
  threshold: 50,
  operator: 'gt',
  timeWindow: 300, // 5 minutes
  properties: {
    usePercentage: true
  }
};
```

#### Implementation

The change condition is implemented as follows:

1. Filter events within the time window if specified
2. Extract metric values from events (from properties or measurements)
3. Calculate the change between the first and last values
4. Calculate the percentage change if usePercentage is true
5. Compare the change to the threshold using the specified operator

### Custom Condition

The custom condition allows for custom logic to evaluate events. It's useful for complex conditions that can't be expressed using the other condition types.

#### Properties

- **type**: `AlertRuleConditionType.CUSTOM`
- **evaluate**: A function that evaluates events and returns a boolean (required)

#### Example

```typescript
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

#### Implementation

The custom condition is implemented by calling the evaluate function with the events.

## Usage

Alert conditions are used in alert rules to define when an alert should be triggered. Multiple conditions can be combined in a single rule, and all conditions must be met for the alert to be triggered.

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
    },
    {
      type: AlertRuleConditionType.THRESHOLD,
      metric: 'response_time',
      threshold: 1000,
      operator: 'gt',
      timeWindow: 300, // 5 minutes
      properties: {
        aggregation: 'avg'
      }
    }
  ],
  enabled: true
};

alerting.addRule(rule);
```

## Benefits

The implementation of all condition types provides several benefits:

1. **Flexibility**: Support for different types of conditions allows for flexible alert rules
2. **Customization**: Custom conditions allow for complex logic that can't be expressed using the other condition types
3. **Aggregation**: Support for different aggregation functions allows for more precise alerting
4. **Time Windows**: Support for time windows allows for alerting based on recent events
5. **Comparison Operators**: Support for different comparison operators allows for more precise alerting

## Next Steps

The following steps are recommended to further improve the alerting service:

1. **Add More Condition Types**: Add support for more condition types (trend, anomaly, etc.)
2. **Add More Aggregation Functions**: Add support for more aggregation functions (median, percentile, etc.)
3. **Add Support for Multiple Metrics**: Add support for conditions that involve multiple metrics
4. **Add Support for Composite Conditions**: Add support for conditions that combine multiple conditions with logical operators (AND, OR, NOT)
5. **Add Support for Dynamic Thresholds**: Add support for thresholds that are calculated dynamically based on historical data
