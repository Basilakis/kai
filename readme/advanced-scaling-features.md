# Advanced Scaling Features

This document describes the advanced scaling features implemented in the KAI platform, including predictive scaling, cross-service scaling dependencies, and enhanced HPA event logging.

## Table of Contents

1. [Overview](#overview)
2. [Predictive Scaling](#predictive-scaling)
3. [Cross-Service Scaling Dependencies](#cross-service-scaling-dependencies)
4. [Enhanced HPA Event Logging](#enhanced-hpa-event-logging)
5. [Monitoring and Visualization](#monitoring-and-visualization)
6. [API Reference](#api-reference)

## Overview

The KAI platform implements several advanced scaling features to optimize resource utilization and ensure system stability:

- **Predictive Scaling**: Analyzes historical metrics to predict future load and proactively adjust HPA settings
- **Cross-Service Scaling Dependencies**: Ensures that when one service scales, dependent services are also scaled appropriately
- **Enhanced HPA Event Logging**: Provides detailed information about scaling decisions and their triggers

These features are implemented in the Coordinator service and can be enabled or disabled through environment variables.

## Predictive Scaling

Predictive scaling analyzes historical metrics to predict future load and proactively adjust HPA settings for services with predictable load patterns.

### How It Works

1. The system collects and analyzes historical metrics to identify patterns in service load
2. Based on these patterns, it predicts future load for specific time windows
3. The system proactively adjusts HPA settings to ensure that services have the right number of replicas before load increases

### Configuration

Predictive scaling is controlled by the following environment variables:

- `ENABLE_PREDICTIVE_SCALING`: Set to `true` to enable predictive scaling
- `REDIS_URL`: Redis connection URL for storing predictions and patterns

### Service Load Patterns

Service load patterns define when a service is expected to experience increased load:

```json
{
  "service": "coordinator",
  "patternType": "daily",
  "timeWindows": [
    {
      "dayOfWeek": 1,
      "hourOfDay": 9,
      "expectedLoad": 0.8
    },
    {
      "dayOfWeek": 5,
      "hourOfDay": 16,
      "expectedLoad": 0.9
    }
  ]
}
```

### API Endpoints

The following API endpoints are available for managing predictive scaling:

- `GET /api/predictive-scaling/patterns`: Get all service load patterns
- `GET /api/predictive-scaling/patterns/:service`: Get service load pattern for a specific service
- `POST /api/predictive-scaling/patterns/:service`: Create or update service load pattern
- `DELETE /api/predictive-scaling/patterns/:service`: Delete service load pattern
- `GET /api/predictive-scaling/predictions`: Get recent predictions

## Cross-Service Scaling Dependencies

Cross-service scaling dependencies ensure that when one service scales, dependent services are also scaled appropriately to maintain system balance.

### How It Works

1. The system monitors the replica count of source services
2. When a source service scales, the system automatically adjusts the replica count of dependent services based on the defined dependency type

### Dependency Types

- **Proportional**: Scale the target service proportionally to the source service (e.g., 2:1 ratio)
- **Fixed**: Set a fixed number of replicas for the target service when the source service scales
- **Minimum**: Ensure that the target service has at least a minimum number of replicas

### Configuration

Cross-service scaling dependencies are controlled by the following environment variables:

- `ENABLE_SCALING_DEPENDENCIES`: Set to `true` to enable cross-service scaling dependencies
- `REDIS_URL`: Redis connection URL for storing dependencies

### API Endpoints

The following API endpoints are available for managing scaling dependencies:

- `GET /api/scaling-dependencies`: Get all scaling dependencies
- `GET /api/scaling-dependencies/:sourceService/:targetService`: Get a specific scaling dependency
- `POST /api/scaling-dependencies/:sourceService/:targetService`: Create or update a scaling dependency
- `DELETE /api/scaling-dependencies/:sourceService/:targetService`: Delete a scaling dependency
- `POST /api/scaling-dependencies/:sourceService/:targetService/enable`: Enable a scaling dependency
- `POST /api/scaling-dependencies/:sourceService/:targetService/disable`: Disable a scaling dependency

## Enhanced HPA Event Logging

Enhanced HPA event logging provides detailed information about scaling decisions and their triggers, helping to understand and optimize scaling behavior.

### How It Works

1. The system monitors HPA objects in the Kubernetes cluster
2. When a scaling event occurs, the system logs detailed information about the event, including the trigger metric and its value
3. The system also calculates scaling effectiveness metrics to help optimize scaling behavior

### Configuration

Enhanced HPA event logging is controlled by the following environment variables:

- `ENABLE_HPA_EVENT_LOGGING`: Set to `true` to enable enhanced HPA event logging
- `REDIS_URL`: Redis connection URL for storing events

### Event Types

- **scale-up**: HPA decided to increase the number of replicas
- **scale-down**: HPA decided to decrease the number of replicas
- **no-scale**: HPA decided not to change the number of replicas
- **limited-scale**: HPA wanted to scale but was limited by constraints

### API Endpoints

The following API endpoints are available for accessing HPA event logs:

- `GET /api/hpa-events`: Get recent HPA events
- `GET /api/hpa-events/:service`: Get recent HPA events for a specific service
- `GET /api/hpa-events/:service/effectiveness`: Get scaling effectiveness for a specific service

## Monitoring and Visualization

The KAI platform includes comprehensive monitoring and visualization for advanced scaling features:

### Grafana Dashboards

- **HPA Metrics Dashboard**: Shows current and desired replica counts, scaling events, and their triggers
- **Coordinator Service Dashboard**: Shows queue depths, workflow durations, and processing metrics
- **Supabase Connection Pool Dashboard**: Shows database connection pool metrics and performance

### Admin Panel Integration

The admin panel includes a dedicated Grafana Dashboards page that embeds these dashboards, providing a unified interface for monitoring the system.

## API Reference

### Predictive Scaling API

#### Get All Service Load Patterns

```
GET /api/predictive-scaling/patterns
```

Response:

```json
{
  "patterns": [
    {
      "service": "coordinator",
      "patternType": "daily",
      "timeWindows": [
        {
          "dayOfWeek": 1,
          "hourOfDay": 9,
          "expectedLoad": 0.8
        }
      ],
      "lastUpdated": 1623456789000
    }
  ]
}
```

#### Create or Update Service Load Pattern

```
POST /api/predictive-scaling/patterns/:service
```

Request:

```json
{
  "patternType": "daily",
  "timeWindows": [
    {
      "dayOfWeek": 1,
      "hourOfDay": 9,
      "expectedLoad": 0.8
    }
  ]
}
```

### Scaling Dependencies API

#### Get All Scaling Dependencies

```
GET /api/scaling-dependencies
```

Response:

```json
{
  "dependencies": [
    {
      "sourceService": "coordinator",
      "targetService": "mobile-optimization",
      "dependencyType": "proportional",
      "ratio": 0.5,
      "enabled": true,
      "lastUpdated": 1623456789000
    }
  ]
}
```

#### Create or Update Scaling Dependency

```
POST /api/scaling-dependencies/:sourceService/:targetService
```

Request:

```json
{
  "dependencyType": "proportional",
  "ratio": 0.5,
  "enabled": true
}
```

### HPA Events API

#### Get Recent HPA Events

```
GET /api/hpa-events
```

Response:

```json
{
  "events": [
    {
      "service": "coordinator",
      "eventType": "scale-up",
      "currentReplicas": 2,
      "desiredReplicas": 4,
      "actualReplicas": 4,
      "triggerMetric": "resource:cpu",
      "triggerValue": 85,
      "triggerThreshold": 70,
      "timestamp": 1623456789000
    }
  ]
}
```

#### Get Scaling Effectiveness

```
GET /api/hpa-events/:service/effectiveness
```

Response:

```json
{
  "service": "coordinator",
  "effectiveness": 0.95
}
```
