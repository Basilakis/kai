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