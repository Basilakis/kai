# Monitoring System

Kai includes a comprehensive monitoring system that provides real-time insights into the health, performance, and operation of the platform. This system is designed to help administrators identify issues, track system performance, and ensure optimal operation.

## Features

### System Health Monitoring

- **Real-time Health Metrics**: Track CPU usage, memory consumption, and service statuses
- **Environment Variable Validation**: Automatic validation of required environment variables
- **Service Status**: Monitor individual service health across the platform
- **Rate Limit Statistics**: Track API usage and rate limiting across different endpoints

### Comprehensive Logging

- **Centralized Log Collection**: All system logs are collected in a central location
- **Log Filtering**: Filter logs by level, module, date range, and text content
- **Error Distribution Analysis**: Track error frequency by module to identify problem areas

### Admin Dashboard

The monitoring system includes a dedicated admin dashboard that provides:

- **System Health Visualization**: Real-time charts and metrics for system health
- **Log Explorer**: Interactive interface for exploring and filtering logs
- **Error Analysis**: Visual breakdown of errors by module and time period
- **Rate Limit Monitoring**: Track API usage and rate limiting

## Architecture

The monitoring system consists of:

1. **Backend Services**: Collect metrics, logs, and health data
2. **Admin API**: Provides access to monitoring data through dedicated endpoints
3. **Frontend Dashboard**: Visualizes monitoring data for administrators

## Prometheus Integration

The KAI platform uses Prometheus for metrics collection, aggregation, and storage. Prometheus is deployed as part of the monitoring stack in the `monitoring` namespace.

### Key Components

- **Prometheus Server**: Collects and stores time-series metrics data
- **Alert Manager**: Handles alerts sent by Prometheus server
- **Grafana**: Provides visualization and dashboards for Prometheus metrics
- **Prometheus Adapter**: Exposes Prometheus metrics to Kubernetes for HPA

### Metrics Collection

Services expose metrics through annotations in their Kubernetes manifests:

```yaml
prometheus.io/scrape: "true"
prometheus.io/port: "8080"
prometheus.io/path: "/metrics"
```

These annotations enable Prometheus to automatically discover and scrape metrics from the services.

### Custom Metrics API

The platform uses the Prometheus Adapter to expose custom metrics to the Kubernetes API, enabling advanced autoscaling based on application-specific metrics:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-adapter-config
  namespace: kai-ml
data:
  config.yaml: |
    rules:
    # API Request Rate Metrics
    - seriesQuery: 'http_requests_total{kubernetes_namespace!="",kubernetes_pod_name!=""}'
      resources:
        overrides:
          kubernetes_namespace: {resource: "namespace"}
          kubernetes_pod_name: {resource: "pod"}
      name:
        matches: "^(.*)_total"
        as: "${1}_per_second"
      metricsQuery: 'sum(rate(<<.Series>>{<<.LabelMatchers>>}[2m])) by (<<.GroupBy>>)'

    # Queue Depth Metrics for Coordinator
    - seriesQuery: 'kai_coordinator_queue_depth{kubernetes_namespace!="",kubernetes_pod_name!=""}'
      resources:
        overrides:
          kubernetes_namespace: {resource: "namespace"}
          kubernetes_pod_name: {resource: "pod"}
      name:
        matches: "kai_coordinator_queue_depth"
        as: "coordinator_queue_depth"
      metricsQuery: 'sum(<<.Series>>{<<.LabelMatchers>>}) by (<<.GroupBy>>)'
```

### Available Metrics

The platform exposes various metrics through the monitoring service:

- **Workflow Metrics**:
  - `workflow_started_total`: Counter for started workflows
  - `workflow_completed_total`: Counter for completed workflows
  - `workflow_duration_seconds`: Histogram for workflow durations
  - `workflow_error_total`: Counter for workflow errors

- **Resource Metrics**:
  - `workflow_cpu_usage_cores`: Gauge for CPU usage
  - `workflow_memory_usage_bytes`: Gauge for memory usage
  - `workflow_gpu_usage_percent`: Gauge for GPU utilization

- **Coordinator Metrics**:
  - `kai_coordinator_queue_depth`: Gauge for queue depth by priority
  - `kai_coordinator_active_workflows`: Gauge for active workflows by type
  - `kai_coordinator_workflow_duration_seconds`: Histogram for workflow durations
  - `kai_coordinator_workflow_completed_total`: Counter for completed workflows
  - `kai_coordinator_workflow_error_total`: Counter for workflow errors
  - `kai_coordinator_resource_utilization`: Gauge for resource utilization

- **Database Connection Metrics**:
  - `kai_supabase_connection_pool_active`: Gauge for active connections
  - `kai_supabase_connection_pool_idle`: Gauge for idle connections
  - `kai_supabase_connection_pool_total`: Gauge for total connections
  - `kai_supabase_connection_pool_utilization`: Gauge for connection pool utilization
  - `kai_supabase_connection_pool_waiting_acquires`: Gauge for waiting connection acquires
  - `kai_supabase_connection_pool_acquire_success_rate`: Gauge for connection acquisition success rate
  - `kai_supabase_connection_pool_average_acquire_time`: Gauge for average connection acquisition time
  - `kai_supabase_connection_pool_connection_errors`: Gauge for connection errors

- **Cache Metrics**:
  - `workflow_cache_hit_total`: Counter for cache hits
  - `workflow_stage_duration_seconds`: Histogram for stage durations

## Accessing Grafana

Grafana provides visualization of all metrics collected by Prometheus. Here's how to access and use Grafana:

### Access Methods

#### Method 1: Domain Access (if configured)

If Ingress has been set up:

1. Navigate to `https://grafana.yourdomain.com` in your browser
2. You'll be presented with the Grafana login screen

#### Method 2: Port Forwarding

For direct access:

```bash
# Start port-forwarding to access Grafana UI locally
kubectl port-forward svc/prometheus-grafana 3000:80 -n monitoring
```

Then access Grafana at `http://localhost:3000` in your browser.

### Login Credentials

- **Username**: `admin`
- **Password**: Set during installation

If you don't know the password, retrieve it with:

```bash
kubectl get secret prometheus-grafana -n monitoring -o jsonpath="{.data.admin-password}" | base64 --decode ; echo
```

### Available Dashboards

The following pre-configured dashboards are available:

1. **Kubernetes Dashboard**:
   - Shows cluster-wide metrics
   - Navigate to Dashboards → Browse → Default → Kubernetes Dashboard

2. **ML Workflows Dashboard**:
   - Shows execution times and resource usage of ML pipelines
   - Navigate to Dashboards → Browse → Default → ML Workflows Dashboard

3. **ML Processing Dashboard**:
   - Shows metrics for different processing stages
   - Navigate to Dashboards → Browse → Default → ML Processing Dashboard

4. **Supabase Connection Pool Dashboard**:
   - Shows database connection pool metrics
   - Monitors connection counts, utilization, and performance
   - Tracks connection acquisition times and error rates
   - Navigate to Dashboards → Browse → Default → Supabase Connection Pool

5. **Kubernetes HPA Metrics Dashboard**:
   - Shows Horizontal Pod Autoscaler metrics
   - Monitors replica counts, scaling events, and custom metrics
   - Visualizes CPU/memory utilization and queue depths
   - Navigate to Dashboards → Browse → Default → Kubernetes HPA Metrics

6. **Coordinator Service Dashboard**:
   - Shows metrics for the Coordinator service
   - Monitors queue depths, workflow durations, and error rates
   - Tracks resource utilization and processing performance
   - Navigate to Dashboards → Browse → Default → Coordinator Service

### Exploring Metrics

To explore specific metrics:

1. From the left menu, select "Explore"
2. Select "Prometheus" as the data source
3. Enter PromQL queries to retrieve specific metrics
4. Example queries:
   - `rate(workflow_completed_total[5m])` - Workflow completion rate
   - `avg(workflow_duration_seconds) by (type)` - Average duration by workflow type
   - `sum(workflow_error_total) by (type)` - Total errors by workflow type

### Creating Custom Dashboards

You can create custom dashboards for specific monitoring needs:

1. Click the "+" icon in the left sidebar
2. Select "Dashboard"
3. Click "Add new panel"
4. Configure the panel with Prometheus queries and appropriate visualizations

### Troubleshooting Grafana Access

If you're unable to access Grafana:

1. Check if pods are running: `kubectl get pods -n monitoring`
2. Verify services: `kubectl get svc -n monitoring`
3. Check ingress (if using domain access): `kubectl get ingress -n monitoring`
4. Check for port-forwarding issues

## API Endpoints

### Health Endpoints

#### Basic Health Check

```
GET /health
```

Provides basic system health information including:
- System status
- Uptime information
- Memory usage
- Node.js version
- Environment health status

This endpoint is public and does not require authentication, making it suitable for automated health checks from load balancers or monitoring services.

#### Detailed Health Check

```
GET /health/detailed
```

Provides comprehensive system health data including:
- Detailed system status
- CPU and memory usage statistics
- Component-by-component health status
- Environment variable validation status

This endpoint requires authentication to protect sensitive system information.

### Admin Monitoring API

#### Get System Logs

```
POST /api/admin/monitoring/logs
```

Retrieves system logs with filtering options:
- Filter by log level (debug, info, warn, error)
- Filter by module
- Filter by date range
- Full-text search within logs
- Pagination support

#### Get Error Distribution

```
GET /api/admin/monitoring/errors
```

Retrieves error distribution by module over a specified time period.

#### Get Health Metrics

```
GET /api/admin/monitoring/health
```

Retrieves detailed health metrics including CPU usage, memory utilization, service statuses, and rate limit statistics.

## Rate Limiting

The system includes a sophisticated rate limiting mechanism to prevent abuse and ensure stability:

- **Default API Rate Limit**: 100 requests per minute for general API endpoints
- **Authentication Rate Limit**: 20 requests per minute for authentication endpoints to prevent brute force attacks
- **ML Processing Rate Limit**: 10 requests per minute for resource-intensive ML operations
- **Agent API Rate Limit**: 30 requests per minute for AI agent interactions
- **PDF Processing Rate Limit**: 5 requests per 10 minutes for resource-intensive PDF processing

Rate limit statistics are tracked and visible in the monitoring dashboard.

## Environment Validation

The monitoring system includes a sophisticated environment variable validation mechanism:

- **Requirement Levels**: Variables can be marked as required, optional, development-only, or production-only
- **Custom Validators**: Each variable can have a custom validation function
- **Health Reporting**: Environment validation status is included in health checks

## Setup and Configuration

To enable all monitoring features, ensure the following:

1. Configure environment variables according to the validation rules
2. Ensure the logger is properly configured
3. Grant appropriate admin access to users who need monitoring capabilities

## Best Practices

1. **Regular Monitoring**: Check the monitoring dashboard regularly to identify potential issues
2. **Alert Configuration**: Set up alerts for critical error thresholds
3. **Log Rotation**: Configure log rotation to prevent storage issues
4. **Permission Management**: Restrict monitoring access to authorized administrators

## ML Training Monitoring Integration

The monitoring system integrates with the ML Training Monitoring System, providing specialized visualizations and controls for machine learning training processes:

- **Training Metrics Visualization**: Real-time charts showing loss, accuracy, and custom metrics
- **Checkpoint Management**: Interface for creating, comparing, and rolling back to model checkpoints
- **Parameter Tuning**: Controls for adjusting hyperparameters during training
- **Training Job Control**: Status monitoring and control for training jobs

For complete details on these capabilities, see the [Training Monitoring System](./training-monitoring-system.md) documentation.