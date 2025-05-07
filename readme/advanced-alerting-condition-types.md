# Advanced Alerting Condition Types

This document describes the advanced condition types implemented in the alerting service. These condition types provide more sophisticated alerting capabilities, enabling proactive monitoring and issue detection.

## Overview

The alerting service now supports several advanced condition types:

1. **Trend Condition**: Detects trends in metrics over time
2. **Anomaly Condition**: Detects anomalies in metrics using statistical methods
3. **Composite Condition**: Combines multiple conditions with logical operators
4. **Dynamic Threshold Condition**: Uses dynamic thresholds based on historical data

Additionally, the service now supports advanced aggregation functions:

1. **Median**: Calculates the median value
2. **Percentiles (P90, P95, P99)**: Calculates percentile values
3. **Standard Deviation**: Calculates the standard deviation
4. **Variance**: Calculates the variance

## Advanced Condition Types

### Trend Condition

The trend condition detects trends in metrics over time. It uses linear regression to calculate the slope of the trend line and compares it to a threshold.

#### Properties

- **type**: `AlertRuleConditionType.TREND`
- **metric**: The metric to monitor (required)
- **timeWindow**: The time window in seconds (optional)
- **properties**: Additional properties (required)
  - **trendDirection**: The direction of the trend (required)
    - `TrendDirection.INCREASING`: Increasing trend
    - `TrendDirection.DECREASING`: Decreasing trend
    - `TrendDirection.STABLE`: Stable trend
  - **trendThreshold**: The threshold for the trend slope (optional, default: 0)

#### Example

```typescript
const trendCondition: AlertRuleCondition = {
  type: AlertRuleConditionType.TREND,
  metric: 'response_time',
  timeWindow: 3600, // 1 hour
  properties: {
    trendDirection: TrendDirection.INCREASING,
    trendThreshold: 0.1
  }
};
```

#### Implementation

The trend condition is implemented as follows:

1. Filter events within the time window if specified
2. Extract metric values from events (from properties or measurements)
3. Calculate the linear regression slope
4. Compare the slope to the trend threshold based on the trend direction

### Anomaly Condition

The anomaly condition detects anomalies in metrics using statistical methods. It calculates the z-score of recent values compared to historical values and triggers if the z-score exceeds a threshold.

#### Properties

- **type**: `AlertRuleConditionType.ANOMALY`
- **metric**: The metric to monitor (required)
- **properties**: Additional properties (optional)
  - **sensitivity**: The sensitivity of the anomaly detection (optional, default: 0.5)
  - **trainingWindow**: The training window in seconds (optional, default: 24 hours)

#### Example

```typescript
const anomalyCondition: AlertRuleCondition = {
  type: AlertRuleConditionType.ANOMALY,
  metric: 'response_time',
  properties: {
    sensitivity: 0.7,
    trainingWindow: 86400 // 24 hours
  }
};
```

#### Implementation

The anomaly condition is implemented as follows:

1. Filter events within the training window
2. Split events into training and test sets
3. Calculate the mean and standard deviation of the training values
4. Calculate the z-scores of the test values
5. Check if any z-score exceeds the threshold (based on sensitivity)

### Composite Condition

The composite condition combines multiple conditions with logical operators. It allows for complex conditions that can't be expressed using a single condition.

#### Properties

- **type**: `AlertRuleConditionType.COMPOSITE`
- **logicalOperator**: The logical operator to use (required)
  - `LogicalOperator.AND`: All conditions must be met
  - `LogicalOperator.OR`: At least one condition must be met
  - `LogicalOperator.NOT`: The condition must not be met
- **conditions**: The child conditions to combine (required)

#### Example

```typescript
const compositeCondition: AlertRuleCondition = {
  type: AlertRuleConditionType.COMPOSITE,
  logicalOperator: LogicalOperator.AND,
  conditions: [
    {
      type: AlertRuleConditionType.THRESHOLD,
      metric: 'response_time',
      threshold: 1000,
      operator: 'gt'
    },
    {
      type: AlertRuleConditionType.FREQUENCY,
      timeWindow: 300, // 5 minutes
      minCount: 5
    }
  ]
};
```

#### Implementation

The composite condition is implemented as follows:

1. Evaluate each child condition
2. Combine the results based on the logical operator

### Dynamic Threshold Condition

The dynamic threshold condition uses dynamic thresholds based on historical data. It calculates the mean and standard deviation of historical values and triggers if the current value exceeds the dynamic threshold.

#### Properties

- **type**: `AlertRuleConditionType.DYNAMIC_THRESHOLD`
- **metric**: The metric to monitor (required)
- **operator**: The comparison operator (required)
- **properties**: Additional properties (optional)
  - **baselinePeriod**: The baseline period in seconds (optional, default: 24 hours)
  - **deviationFactor**: The deviation factor (optional, default: 2)
  - **aggregation**: The aggregation function for current values (optional, default: 'avg')

#### Example

```typescript
const dynamicThresholdCondition: AlertRuleCondition = {
  type: AlertRuleConditionType.DYNAMIC_THRESHOLD,
  metric: 'response_time',
  operator: 'gt',
  properties: {
    baselinePeriod: 86400, // 24 hours
    deviationFactor: 3,
    aggregation: AggregationFunction.AVG
  }
};
```

#### Implementation

The dynamic threshold condition is implemented as follows:

1. Filter events within the baseline period
2. Calculate the mean and standard deviation of the baseline values
3. Calculate the dynamic threshold (mean ± deviationFactor * stdDev)
4. Calculate the aggregate value for current values
5. Compare the current value to the dynamic threshold

## Advanced Aggregation Functions

The alerting service now supports several advanced aggregation functions:

### Median

Calculates the median value of a set of metrics.

```typescript
const thresholdCondition: AlertRuleCondition = {
  type: AlertRuleConditionType.THRESHOLD,
  metric: 'response_time',
  threshold: 1000,
  operator: 'gt',
  properties: {
    aggregation: AggregationFunction.MEDIAN
  }
};
```

### Percentiles (P90, P95, P99)

Calculates the 90th, 95th, or 99th percentile of a set of metrics.

```typescript
const thresholdCondition: AlertRuleCondition = {
  type: AlertRuleConditionType.THRESHOLD,
  metric: 'response_time',
  threshold: 1000,
  operator: 'gt',
  properties: {
    aggregation: AggregationFunction.P95
  }
};
```

### Standard Deviation

Calculates the standard deviation of a set of metrics.

```typescript
const thresholdCondition: AlertRuleCondition = {
  type: AlertRuleConditionType.THRESHOLD,
  metric: 'response_time',
  threshold: 100,
  operator: 'gt',
  properties: {
    aggregation: AggregationFunction.STDDEV
  }
};
```

### Variance

Calculates the variance of a set of metrics.

```typescript
const thresholdCondition: AlertRuleCondition = {
  type: AlertRuleConditionType.THRESHOLD,
  metric: 'response_time',
  threshold: 10000,
  operator: 'gt',
  properties: {
    aggregation: AggregationFunction.VARIANCE
  }
};
```

## Multiple Metrics Support

The alerting service now supports conditions that involve multiple metrics. This allows for more complex conditions that compare multiple metrics.

```typescript
const compositeCondition: AlertRuleCondition = {
  type: AlertRuleConditionType.COMPOSITE,
  logicalOperator: LogicalOperator.AND,
  conditions: [
    {
      type: AlertRuleConditionType.THRESHOLD,
      metric: 'response_time',
      threshold: 1000,
      operator: 'gt'
    },
    {
      type: AlertRuleConditionType.THRESHOLD,
      metric: 'error_rate',
      threshold: 0.05,
      operator: 'gt'
    }
  ]
};
```

## Benefits

The implementation of advanced condition types provides several benefits:

1. **Sophisticated Alerting**: Support for advanced condition types allows for more sophisticated alerting
2. **Trend Detection**: Trend conditions allow for detecting trends in metrics over time
3. **Anomaly Detection**: Anomaly conditions allow for detecting anomalies in metrics
4. **Complex Conditions**: Composite conditions allow for complex conditions that combine multiple conditions
5. **Dynamic Thresholds**: Dynamic threshold conditions allow for thresholds that adapt to historical data
6. **Advanced Aggregation**: Support for advanced aggregation functions allows for more precise alerting
7. **Multiple Metrics**: Support for multiple metrics allows for conditions that compare multiple metrics

## Next Steps

The following steps are recommended to further improve the alerting service:

1. **Add More Condition Types**: Add support for more condition types (seasonality, correlation, etc.)
2. **Improve Anomaly Detection**: Improve the anomaly detection algorithm with more sophisticated methods
3. **Add Support for Machine Learning**: Add support for machine learning models for anomaly detection
4. **Add Support for Time Series Forecasting**: Add support for time series forecasting for predictive alerting
5. **Add Support for Alert Correlation**: Add support for correlating alerts to reduce noise
6. **Add Support for Alert Suppression**: Add support for suppressing alerts based on maintenance windows or other criteria
7. **Add Support for Alert Escalation**: Add support for escalating alerts based on severity and time
