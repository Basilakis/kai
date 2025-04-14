# Automated Canary Deployments with Health Monitoring

This document describes the canary deployment functionality implemented in the KAI Platform deployment system. Canary deployments allow you to release new versions with reduced risk by gradually exposing changes to a small subset of users before rolling them out to the entire user base.

## Overview

Canary deployments work by:

1. Deploying a new version alongside the existing production version
2. Routing a small percentage of traffic to the new version
3. Monitoring the health of the new version
4. Automatically promoting or rolling back based on health metrics

The KAI Platform implements full automated canary deployments with health-based promotion and rollback functionality, reducing the risk of problematic deployments reaching all users.

## Benefits

- **Reduced Risk**: By exposing changes to a subset of users, the impact of problematic deployments is limited.
- **Automated Health Monitoring**: The system continuously monitors critical services for errors and performance issues.
- **Automatic Promotion**: Successful canary deployments are automatically promoted to full production.
- **Automatic Rollback**: Failed deployments are automatically rolled back, preventing further impact.
- **Progressive Traffic Shifting**: Traffic can be incrementally shifted to the canary as confidence grows.
- **Critical Service Focus**: Health checks focus on the most important services in the platform.

## Implementation Details

The canary deployment system is integrated into:

1. **Helm Deployment Script**: `helm-charts/helm-deploy.sh` has been enhanced with canary deployment capabilities.
2. **Helm Chart Values**: The `values.yaml` includes canary configuration settings.
3. **Prometheus Integration**: Health metrics are collected from Prometheus for informed promotion/rollback decisions.

### Key Components

- **Traffic Splitting**: Canary deployments control the percentage of traffic sent to the new version.
- **Health Metrics Collection**: Metrics are collected from Prometheus on specified intervals.
- **Threshold-Based Decisions**: Success rates and latency metrics are compared against thresholds.
- **Progressive Analysis**: Canary deployments are monitored for a configurable analysis period before final decisions.

## How to Use

### Basic Canary Deployment

To deploy a new version using canary deployment:

```bash
./helm-charts/helm-deploy.sh \
  --context=kai-production-cluster \
  --env=production \
  --canary \
  --tag=v1.2.3
```

This deploys a canary release with 10% traffic (default) and monitors it for 10 minutes before deciding to promote or rollback.

### Advanced Canary Configuration

You can customize the canary deployment behavior:

```bash
./helm-charts/helm-deploy.sh \
  --context=kai-production-cluster \
  --env=production \
  --canary \
  --canary-weight=20 \
  --canary-time=15 \
  --health-threshold=98 \
  --critical-services=api-server,coordinator-service,mobile-optimization \
  --tag=v1.2.3
```

### Available Options

| Option | Description | Default |
|--------|-------------|---------|
| `--canary` | Enable canary deployment | - |
| `--canary-weight=<pct>` | Percentage of traffic to route to canary | 10% |
| `--canary-time=<min>` | Minutes to analyze canary before promotion | 10 minutes |
| `--health-threshold=<pct>` | Success rate threshold for promotion | 95% |
| `--critical-services=<svc>` | Comma-separated list of services to monitor | api-server,coordinator-service |

## Health Monitoring Details

The canary deployment system monitors the following health metrics:

1. **Success Rate**: Percentage of successful requests (non-5xx responses)
2. **Latency**: Response time metrics for critical endpoints

Health checks are performed:
- At 30-second intervals during the analysis period
- Once more as a final check before promotion

The system retrieves metrics from Prometheus using queries like:
```
sum(rate(http_requests_total{service="api-server",status_code=~"2.."}[5m])) / 
sum(rate(http_requests_total{service="api-server"}[5m])) * 100
```

## Best Practices

1. **Start with Lower Traffic Percentages**: Use smaller values for `--canary-weight` (5-10%) for critical changes.
2. **Appropriate Analysis Time**: Choose an appropriate `--canary-time` based on traffic volume - longer times provide more confidence but slow deployments.
3. **Include All Critical Services**: Ensure all user-facing services are included in `--critical-services`.
4. **Appropriate Thresholds**: Set `--health-threshold` based on your normal service performance - don't use 100% if your service typically has occasional errors.
5. **Monitor Deployments**: Even with automation, monitor canary deployments as they progress.

## Troubleshooting

If a canary deployment fails:

1. Check the logs for the specific service that failed health checks
2. Examine Prometheus metrics before and after the deployment
3. Review the specific deployment logs from the canary version

Use the following command to list all recent releases to identify failed canaries:
```bash
./helm-charts/helm-deploy.sh --list-releases
```

## Architecture Diagram

```
                ┌─────────────────┐
                │                 │
                │  User Traffic   │
                │                 │
                └────────┬────────┘
                         │
                         ▼
             ┌───────────────────────┐
             │                       │
             │   Traffic Splitter    │
             │                       │
             └───┬───────────────┬───┘
                 │               │
                 │               │
                 ▼               ▼
        ┌─────────────┐   ┌──────────────┐
        │             │   │              │
        │  Production │   │    Canary    │
        │             │   │              │
        └─────┬───────┘   └──────┬───────┘
              │                  │
              │                  │
              ▼                  ▼
    ┌─────────────────┐  ┌────────────────┐
    │                 │  │                │
    │ Health Metrics  │  │ Health Metrics │
    │                 │  │                │
    └────────┬────────┘  └────────┬───────┘
             │                    │
             └───────┐  ┌─────────┘
                     │  │
                     ▼  ▼
             ┌────────────────────┐
             │                    │
             │  Prometheus        │
             │                    │
             └─────────┬──────────┘
                       │
                       ▼
               ┌───────────────┐
               │               │
               │  Automated    │
               │  Decision     │
               │               │
               └───────┬───────┘
                       │
                       ▼
               ┌───────────────┐
               │ Promote or    │
               │ Rollback      │
               └───────────────┘