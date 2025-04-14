# Kai Platform Helm Charts

This directory contains Helm charts for deploying the Kai Platform to Kubernetes clusters.

## Chart Structure

The Kai Platform uses a parent chart with several subcharts:

- `kai` - Main parent chart
  - `coordinator` - Coordinator service
  - `mobile-optimization` - Mobile optimization services
  - `wasm-compiler` - WebAssembly compiler services
  - `infrastructure` - Shared infrastructure components
  - `workflows` - Workflow templates

## Environment Configuration

Environment-specific values are stored in separate files:

- `values.yaml` - Default values
- `values-staging.yaml` - Staging environment overrides
- `values-production.yaml` - Production environment overrides

## Usage

### Installing

```bash
# Install to staging environment
helm upgrade --install kai ./helm-charts/kai --values ./helm-charts/kai/values-staging.yaml

# Install to production environment
helm upgrade --install kai ./helm-charts/kai --values ./helm-charts/kai/values-production.yaml
```

### Uninstalling

```bash
helm uninstall kai
```

## Migrating from Previous Deployment

This Helm-based deployment replaces the previous bash script approach. The Helm charts encapsulate the same resources but provide better management of environment differences and easier upgrades/rollbacks.