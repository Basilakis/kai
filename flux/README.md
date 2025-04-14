# Flux GitOps Configuration for KAI Platform

This directory contains the Flux GitOps configuration for the KAI Platform. Flux enables declarative, GitOps-based continuous delivery with support for progressive delivery strategies.

## Overview

[Flux](https://fluxcd.io/) is a set of continuous and progressive delivery solutions for Kubernetes that are open and extensible. It enables:

- Declarative infrastructure and application configuration
- Automated deployment of Kubernetes manifests and Helm charts
- Multi-cluster and multi-tenant capabilities 
- Secure operations with RBAC, policy, and image verification
- Integration with CI pipelines for source and image updates

## Structure

```
flux/
├── clusters/                 # Cluster-specific configurations
│   ├── staging/              # Staging cluster configuration
│   │   ├── flux-system/      # Flux controllers and CRDs
│   │   ├── infrastructure/   # Infrastructure components
│   │   └── applications/     # Application deployments
│   └── production/           # Production cluster configuration
│       ├── flux-system/      # Flux controllers and CRDs
│       ├── infrastructure/   # Infrastructure components
│       └── applications/     # Application deployments
├── sources/                  # Sources for Flux to sync from
│   ├── helm-repositories/    # Helm repository definitions
│   └── git-repositories/     # Git repository definitions
└── bases/                    # Common base configurations
    ├── kustomization.yaml    # Kustomization for bases
    └── helm-values/          # Default Helm values
```

## Installation

### Prerequisites

- Kubernetes cluster
- kubectl configured to communicate with your cluster
- Flux CLI installed

```bash
# Install Flux CLI on Linux
curl -s https://fluxcd.io/install.sh | sudo bash

# Install Flux CLI on macOS
brew install fluxcd/tap/flux
```

### Bootstrap Flux

```bash
# Bootstrap Flux on your cluster
flux bootstrap github \
  --owner=$GITHUB_USER \
  --repository=kai-gitops \
  --branch=main \
  --path=./clusters/staging \
  --personal
```

## Usage

### Adding a Helm Release

To deploy a Helm chart with Flux, create a HelmRelease resource:

```yaml
apiVersion: helm.toolkit.fluxcd.io/v2beta1
kind: HelmRelease
metadata:
  name: coordinator
  namespace: kai-system
spec:
  interval: 5m
  chart:
    spec:
      chart: ./helm-charts/coordinator
      sourceRef:
        kind: GitRepository
        name: kai-platform
        namespace: flux-system
      interval: 1m
  values:
    replicaCount: 2
    resources:
      limits:
        cpu: 1000m
        memory: 1Gi
      requests:
        cpu: 500m
        memory: 512Mi
```

### Automated Deployments

Flux automatically synchronizes your cluster with the Git repository:

1. Changes are pushed to the Git repository
2. Flux detects changes and applies them to the cluster
3. Reconciliation ensures the cluster state matches the desired state

### Monitoring and Alerting

Flux provides metrics for monitoring and alerting:

```bash
# Get the current status of Flux resources
flux get all -A

# Get events for a specific Kustomization
flux events -n flux-system kustomization/infrastructure
```

## Integration with CI/CD Pipeline

The CI/CD pipeline integrates with Flux by:

1. Building and pushing container images
2. Updating image references in the GitOps repository
3. Letting Flux handle the actual deployment to Kubernetes

## For More Information

For more details, see the [Flux documentation](https://fluxcd.io/docs/).