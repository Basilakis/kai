# GitHub Actions Workflow Variables

This document describes the environment variables and secrets used in the GitHub Actions workflows.

## Environment Variables

These variables are set during workflow execution:

| Variable | Description | Example Value |
|----------|-------------|---------------|
| `DEPLOY_ENV` | Deployment environment | `staging` or `production` |
| `TAG_SUFFIX` | Docker image tag suffix | `latest` or `staging` |
| `DO_APP_ARGS` | Arguments for Digital Ocean App Platform deployment | `--prod` |
| `API_URL` | URL for API testing | `https://api.kai.example.com` |
| `TEST_SCRIPT` | Test script to run | `test:e2e` |
| `KUBE_CONTEXT` | Kubernetes context name | `kubernetes-cluster1` |

## Repository Secrets

These secrets need to be configured in the repository settings:

### GitHub Container Registry
- `GITHUB_TOKEN`: GitHub token with `write:packages` permission (automatically provided by GitHub Actions)

### Kubernetes Configuration
- `KUBE_CONFIG_DATA`: Base64-encoded Kubernetes config

### Supabase Credentials
- `SUPABASE_URL_PRODUCTION`: Supabase production URL
- `SUPABASE_KEY_PRODUCTION`: Supabase production API key
- `SUPABASE_URL_STAGING`: Supabase staging URL
- `SUPABASE_KEY_STAGING`: Supabase staging API key

### Digital Ocean App Platform Deployment
- `DO_API_TOKEN`: Digital Ocean API token
- `DO_APP_ID_CLIENT`: Digital Ocean App Platform app ID for client
- `DO_APP_ID_ADMIN`: Digital Ocean App Platform app ID for admin

### Notifications
- `SLACK_WEBHOOK`: Slack notification webhook URL
