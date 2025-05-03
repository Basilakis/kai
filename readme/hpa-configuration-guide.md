# Horizontal Pod Autoscaling (HPA) Configuration Guide

This document explains the Horizontal Pod Autoscaling (HPA) configuration used in the KAI platform, including the reasoning behind different target utilization percentages, scaling behaviors, and custom metrics.

## Table of Contents

1. [Overview](#overview)
2. [Standard HPA Configuration](#standard-hpa-configuration)
3. [Custom Metrics](#custom-metrics)
4. [Service-Specific Configurations](#service-specific-configurations)
5. [Scaling Behavior](#scaling-behavior)
6. [Monitoring and Troubleshooting](#monitoring-and-troubleshooting)
7. [Best Practices](#best-practices)

## Overview

Horizontal Pod Autoscaling (HPA) automatically adjusts the number of pod replicas based on observed metrics. The KAI platform uses a sophisticated HPA configuration that combines standard resource metrics (CPU, memory) with custom application metrics (queue depth, processing time) to ensure optimal performance and resource utilization.

## Standard HPA Configuration

All services in the KAI platform use a standardized HPA configuration with service-specific adjustments. The standard configuration includes:

### Resource Metrics

1. **CPU Utilization**:
   - Target: 70% for most services
   - Reasoning: This provides a good balance between resource efficiency and headroom for traffic spikes. At 70%, pods have enough capacity to handle sudden increases in load while still maintaining good resource utilization.

2. **Memory Utilization**:
   - Target: 80% for most services
   - Reasoning: Memory usage tends to be more stable than CPU, so a higher target is appropriate. The 80% target ensures efficient memory usage while still providing buffer for garbage collection and temporary spikes.

### Replica Counts

1. **Minimum Replicas**:
   - Standard: 2 for most services
   - Critical Services: 3 for services that require higher availability
   - Reasoning: Having at least 2 replicas ensures basic high availability, allowing for zero-downtime deployments and resilience to node failures.

2. **Maximum Replicas**:
   - Interactive Services: 10 replicas
   - Background Services: 5-6 replicas
   - Reasoning: Maximum replica counts are based on expected peak load and the resource consumption of each service. Interactive services need to scale higher to maintain responsiveness during peak usage.

## Custom Metrics

The KAI platform uses custom metrics to make more intelligent scaling decisions based on actual application behavior rather than just resource usage.

### Queue-Based Metrics

1. **`coordinator_queue_depth`**:
   - Description: Number of pending tasks in the queue
   - Target: 10 tasks per pod
   - Reasoning: This ensures that each pod has a manageable number of tasks to process. When the queue grows beyond this threshold, additional pods are added to maintain processing throughput.

2. **`coordinator_queue_processing_rate`**:
   - Description: Rate at which tasks are being processed
   - Target: Varies by service
   - Reasoning: This metric helps scale based on actual throughput rather than just queue size, ensuring that we scale appropriately when processing becomes slower.

### Processing Time Metrics

1. **`ml_processing_time_seconds`**:
   - Description: Average time to process an ML task
   - Target: 5 seconds
   - Reasoning: When processing time exceeds this threshold, it indicates that the service is becoming overloaded and additional replicas are needed to maintain performance.

2. **`compilation_time_seconds`**:
   - Description: Average time to compile a WASM module
   - Target: 10 seconds
   - Reasoning: WASM compilation is less time-sensitive than ML processing, so a higher threshold is acceptable.

### Database Connection Metrics

1. **`db_connection_utilization`**:
   - Description: Percentage of database connections in use
   - Target: 70%
   - Reasoning: This ensures that services scale before they exhaust their database connection pools, preventing connection timeouts and errors.

## Service-Specific Configurations

Different services have slightly different HPA configurations based on their specific requirements and characteristics:

### Coordinator Service

```yaml
minReplicas: 2
maxReplicas: 10
metrics:
  - CPU: 70%
  - Memory: 80%
  - coordinator_queue_depth: 10
  - ml_processing_time_seconds: 5
```

**Reasoning**: The Coordinator service is central to the platform's operation, handling task distribution and workflow management. It needs to scale quickly in response to increased workload, so it uses queue depth as a primary scaling metric.

### Mobile Optimization Service

```yaml
minReplicas: 2
maxReplicas: 6
metrics:
  - CPU: 70%
  - Memory: 80%
  - ml_processing_time_seconds: 5
```

**Reasoning**: The Mobile Optimization service performs resource-intensive operations but has more predictable load patterns. It uses processing time as a key metric to ensure that optimization tasks complete within acceptable timeframes.

### WASM Compiler Service

```yaml
minReplicas: 2
maxReplicas: 5
metrics:
  - CPU: 70%
  - Memory: 80%
  - compilation_time_seconds: 10
```

**Reasoning**: The WASM Compiler service is less time-sensitive than other services, so it has a higher processing time threshold and lower maximum replica count.

## Scaling Behavior

The KAI platform uses sophisticated scaling behavior configurations to ensure stable and efficient scaling:

### Scale-Up Behavior

```yaml
scaleUp:
  stabilizationWindowSeconds: 60
  policies:
  - type: Percent
    value: 100
    periodSeconds: 60
  - type: Pods
    value: 4
    periodSeconds: 60
  selectPolicy: Max
```

**Reasoning**:
- The 60-second stabilization window prevents rapid fluctuations in replica count
- The percentage-based policy allows doubling the replica count in high-load situations
- The pods-based policy ensures we can add a minimum number of pods even when starting from a low base
- Using the Max policy ensures we scale up quickly enough to handle sudden load increases

### Scale-Down Behavior

```yaml
scaleDown:
  stabilizationWindowSeconds: 300
  policies:
  - type: Percent
    value: 10
    periodSeconds: 60
  - type: Pods
    value: 2
    periodSeconds: 60
  selectPolicy: Min
```

**Reasoning**:
- The longer 300-second stabilization window prevents premature scale-down during temporary lulls
- The conservative 10% reduction rate ensures gradual scaling down to avoid service disruption
- The pods-based policy limits the maximum number of pods that can be removed at once
- Using the Min policy ensures we take the most conservative approach when scaling down

## Monitoring and Troubleshooting

The KAI platform includes comprehensive monitoring for HPA behavior:

1. **Kubernetes HPA Metrics Dashboard**:
   - Shows current and desired replica counts
   - Displays scaling events and their triggers
   - Visualizes custom metrics used for scaling decisions

2. **HPA Event Logging**:
   - All scaling events are logged with detailed reasons
   - Logs include the metrics that triggered scaling decisions
   - Historical scaling patterns can be analyzed for optimization

3. **Scaling Effectiveness Metrics**:
   - `scaling_latency_seconds`: Time between threshold breach and scaling action
   - `scaling_success_ratio`: Ratio of successful scaling operations
   - `scaling_oscillation_count`: Number of rapid scale up/down cycles

## Best Practices

1. **Tune Based on Actual Usage**:
   - Start with the standard configuration
   - Monitor actual service behavior
   - Adjust thresholds based on observed patterns

2. **Avoid Scaling Oscillations**:
   - Use appropriate stabilization windows
   - Set realistic target thresholds
   - Consider using predictive scaling for services with regular patterns

3. **Service-Specific Considerations**:
   - CPU-intensive services: Focus on CPU metrics
   - Memory-intensive services: Focus on memory metrics
   - I/O-bound services: Use custom metrics related to queue depth or processing time

4. **Regular Review**:
   - Review scaling patterns quarterly
   - Adjust configurations based on changing usage patterns
   - Consider seasonal adjustments for services with predictable load variations

By following these guidelines and understanding the reasoning behind our HPA configuration choices, you can ensure optimal performance and resource utilization for your KAI platform deployment.
