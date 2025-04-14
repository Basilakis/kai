# Kubernetes Architecture for KAI ML Platform

This document provides detailed information about the Kubernetes architecture used for deploying the KAI ML Platform. It covers the structure, components, workflows, and operational considerations for running the platform on Kubernetes.

## Overview

The KAI ML Platform uses a dedicated Kubernetes architecture optimized for machine learning workloads, with specialized components for orchestration, processing, and resource management. The deployment is managed through a structured script that applies configurations in the correct order and handles environment-specific settings.

## Namespace and Organization

All KAI components are deployed within a dedicated `kai-ml` namespace to isolate resources and permissions. The namespace includes:

- **Resource Quotas**: Limiting total CPU, memory, GPU, and storage resources
- **Default Limits**: Setting default resource constraints for containers
- **Labels**: Identifying components as part of the KAI ML platform

```yaml
# Resource quotas for the kai-ml namespace
apiVersion: v1
kind: ResourceQuota
metadata:
  name: kai-ml-quota
  namespace: kai-ml
spec:
  hard:
    # Pod limits
    pods: "100"
    # CPU limits
    requests.cpu: "100"
    limits.cpu: "200"
    # Memory limits
    requests.memory: 200Gi
    limits.memory: 400Gi
    # GPU limits
    requests.nvidia.com/gpu: "16"
    limits.nvidia.com/gpu: "16"
```

## Component Architecture

The KAI ML Platform architecture in Kubernetes consists of these major components:

```
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│                     │     │                     │     │                     │
│  Coordinator        │────▶│  Distributed        │────▶│  ML Services        │
│  Service            │     │  Processing         │     │  (GPU)              │
│                     │     │                     │     │                     │
└─────────────────────┘     └─────────────────────┘     └─────────────────────┘
          │                          │                          │
          │                          │                          │
          ▼                          ▼                          ▼
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│                     │     │                     │     │                     │
│  Monitoring         │     │  Caching            │     │  Mobile             │
│  (Prometheus)       │     │  (Redis)            │     │  Optimization       │
│                     │     │                     │     │                     │
└─────────────────────┘     └─────────────────────┘     └─────────────────────┘
                                      │                          │
                                      │                          │
                                      ▼                          ▼
                             ┌─────────────────────┐    ┌─────────────────────┐
                             │                     │    │                     │
                             │  WASM               │    │  Argo               │
                             │  Compiler           │    │  Workflows          │
                             │                     │    │                     │
                             └─────────────────────┘    └─────────────────────┘
```

### 1. Coordinator Service

The coordinator service is the central orchestration component that:

- Manages task queues and workflow scheduling
- Handles resource allocation across ML workloads
- Interfaces with Argo Workflows for pipeline execution
- Provides API endpoints for system operations

Deployment manifests:
- `kubernetes/coordinator/rbac.yaml`: Service account and permissions
- `kubernetes/coordinator/config.yaml`: Configuration parameters
- `kubernetes/coordinator/service.yaml`: Service definition
- `kubernetes/coordinator/deployment.yaml`: Pod deployment
- `kubernetes/coordinator/hpa.yaml`: Horizontal Pod Autoscaler
- `kubernetes/coordinator/pdb.yaml`: Pod Disruption Budget

### 2. Distributed Processing

Handles distributed workloads across the cluster:

- Manages task distribution and load balancing
- Processes large ML jobs in parallel
- Coordinates work distribution among worker nodes

Deployment manifests:
- `kubernetes/distributed-processing/deployment.yaml`: Worker pods
- `kubernetes/distributed-processing/pdb.yaml`: Pod Disruption Budget
- `kubernetes/distributed-processing/secret.yaml`: Processing secrets

### 3. Mobile Optimization

Specialized services for optimizing ML models for mobile deployment:

- Model quantization and compression
- LOD (Level of Detail) generation
- Draco mesh compression

Deployment manifests:
- `kubernetes/mobile-optimization/deployment.yaml`: Service pods
- `kubernetes/mobile-optimization/hpa.yaml`: Horizontal Pod Autoscaler
- `kubernetes/mobile-optimization/pdb.yaml`: Pod Disruption Budget

### 4. WASM Compiler

WebAssembly compilation service for client-side ML models:

- Compiles ML models to WebAssembly
- Optimizes for browser execution
- Manages versioning and compilation profiles

Deployment manifests:
- `kubernetes/wasm-compiler/deployment.yaml`: Compiler service
- `kubernetes/wasm-compiler/hpa.yaml`: Horizontal Pod Autoscaler
- `kubernetes/wasm-compiler/pdb.yaml`: Pod Disruption Budget

### 5. Workflows

Argo Workflow templates for standard ML pipelines:

- 3D reconstruction pipeline
- Training pipelines
- Batch processing workflows
- Data transformation workflows

Deployment manifests:
- `kubernetes/workflows/3d-reconstruction-template.yaml`: 3D reconstruction workflow

## Node Pools and Resource Management

The Kubernetes cluster uses specialized node pools to optimize resource allocation:

### Node Pool Structure

```
Kubernetes Cluster
│
├── cpu-optimized pool
│   ├── General processing nodes
│   └── API services
│
├── gpu-optimized pool
│   ├── ML inference nodes (T4 GPUs)
│   └── Real-time processing
│
├── gpu-high-end pool
│   ├── ML training nodes (A100 GPUs)
│   └── Complex model generation
│
├── memory-optimized pool
│   ├── Large model loading nodes
│   └── In-memory processing
│
├── storage-optimized pool
│   ├── Data-intensive operation nodes
│   └── Caching services
│
├── orchestration pool
│   ├── Control plane service nodes
│   └── Coordinator services
│
└── spot-instances pool
    ├── Cost-effective batch processing nodes
    └── Non-critical background tasks
```

Each node pool is configured with labels and taints to ensure proper workload scheduling:

```yaml
# Example of node pool labels and taints
labels:
  node-type: gpu-optimized
  workload-class: ml-inference
  gpu: nvidia-t4
taints:
  - key: "node-type"
    value: "gpu-optimized"
    effect: "NoSchedule"
```

### Priority Classes

The system uses priority classes to ensure critical components get resources first:

1. **system-critical** (1,000,000): Essential components that must not be preempted
2. **interactive** (100,000): User-facing requests requiring low latency
3. **high-priority-batch** (50,000): Important batch jobs
4. **medium-priority-batch** (10,000): Normal batch jobs (default)
5. **low-priority-batch** (1,000): Non-urgent batch jobs
6. **maintenance** (100): System maintenance tasks
7. **preemptible** (0): Jobs that can run on spot/preemptible instances

These priority classes ensure proper resource allocation during contention:

```yaml
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: interactive
value: 100000
globalDefault: false
description: "This priority class is used for interactive user requests that require low latency."
```

## Monitoring and Observability

The platform includes a comprehensive monitoring stack:

### Prometheus and Grafana

- **Prometheus**: Collects metrics from all components
- **Grafana**: Provides dashboards for visualizing metrics
- **Custom Dashboards**: ML-specific dashboards for processing metrics

Prometheus is configured to auto-discover and scrape metrics from pods with the appropriate annotations:

```yaml
prometheus.io/scrape: "true"
prometheus.io/port: "8080"
prometheus.io/path: "/metrics"
```

### Jaeger Distributed Tracing

- Traces requests across components
- Measures processing time for each stage
- Helps identify bottlenecks in ML pipelines

## Argo Workflows Integration

Argo Workflows is used for orchestrating complex ML pipelines:

### Workflow Example: 3D Reconstruction

The 3D reconstruction workflow demonstrates how Argo Workflows manages complex ML pipelines:

1. **Quality Assessment**: Evaluates input images and determines processing quality level
2. **Branching Logic**: Routes to low, medium, or high quality pipeline based on assessment
3. **Parallel Processing**: Processes images in parallel when possible
4. **Resource Allocation**: Assigns appropriate resources to each step
5. **Artifact Management**: Handles intermediary data between steps

```
                             ┌───────────────┐
                             │               │
                             │ Assess Quality│
                             │               │
                             └───────┬───────┘
                                     │
                 ┌───────────────────┼───────────────────┐
                 │                   │                   │
        ┌────────▼─────────┐ ┌───────▼────────┐ ┌───────▼────────┐
        │                  │ │                │ │                │
        │ Low Quality      │ │ Medium Quality │ │ High Quality   │
        │ Pipeline         │ │ Pipeline       │ │ Pipeline       │
        │                  │ │                │ │                │
        └────────┬─────────┘ └───────┬────────┘ └───────┬────────┘
                 │                   │                   │
                 └───────────────────┼───────────────────┘
                                     │
                             ┌───────▼───────┐
                             │               │
                             │ Format        │
                             │ Conversion    │
                             │               │
                             └───────┬───────┘
                                     │
                             ┌───────▼───────┐
                             │               │
                             │ Finalize      │
                             │               │
                             └───────────────┘
```

## Deployment and Operation

### Helm-Based Deployment Architecture

The KAI Platform has migrated from script-based deployments to a structured Helm chart architecture, significantly improving consistency, maintainability, and deployment reliability:

```bash
./helm-charts/helm-deploy.sh --context=my-k8s-context --registry=my-registry.example.com --tag=v1.2.3 --env=staging --release=kai-staging
```

#### Helm Chart Structure

The platform uses a parent-child chart structure to modularize components while maintaining centralized configuration:

```
helm-charts/
├── kai/                    # Main parent chart
│   ├── Chart.yaml          # Defines dependencies on subcharts
│   ├── values.yaml         # Default values for all components
│   ├── values-staging.yaml # Staging-specific overrides
│   └── values-production.yaml # Production-specific overrides
├── coordinator/            # Coordinator service subchart
│   ├── Chart.yaml
│   ├── values.yaml         # Coordinator-specific defaults
│   └── templates/          # Kubernetes manifest templates
│       ├── _helpers.tpl    # Reusable template functions
│       ├── deployment.yaml
│       ├── service.yaml
│       ├── hpa.yaml
│       ├── pdb.yaml
│       ├── rbac.yaml
│       └── configmap.yaml
├── mobile-optimization/    # Mobile optimization subchart
│   └── ...
├── wasm-compiler/          # WASM compiler subchart
│   └── ...
└── infrastructure/         # Shared infrastructure subchart
    └── ...
```

#### Enhanced Deployment Capabilities

The Helm-based deployment system offers significant advantages:

1. **Templated Resources**: All Kubernetes manifests are generated from templates, ensuring consistency across environments
2. **Declarative Configuration**: Resources are defined declaratively, making changes more predictable
3. **Dependency Management**: Charts define dependencies, ensuring proper deployment order
4. **Atomic Deployments**: Changes are applied as atomic operations, preventing partial updates
5. **Versioned Releases**: Each deployment creates a versioned release for auditing and rollbacks
6. **Enhanced Rollbacks**: Helm's native rollback mechanism restores all resources to a consistent state

Example rollback command:
```bash
./helm-charts/helm-deploy.sh --context=my-k8s-context --env=production --release=kai-production --rollback=3
```

#### Deployment Script Integration

The `helm-charts/helm-deploy.sh` script provides a user-friendly interface that integrates with our CI/CD pipeline:

```bash
# Deploy to staging environment
./helm-charts/helm-deploy.sh --context=kai-staging-cluster --registry=your-registry.example.com --tag=v1.2.3 --env=staging --release=kai-staging

# Deploy to production environment
./helm-charts/helm-deploy.sh --context=kai-production-cluster --registry=your-registry.example.com --tag=v1.2.3 --env=production --release=kai-production

# View release history
./helm-charts/helm-deploy.sh --list-versions --release=kai-production

# Rollback to a previous release version
./helm-charts/helm-deploy.sh --context=kai-production-cluster --env=production --release=kai-production --rollback=3
```

Key script features:
- **Environment Detection**: Automatically selects appropriate values file based on environment
- **Release Management**: Handles Helm release lifecycle including upgrades and rollbacks
- **Health Verification**: Verifies deployment health before completion
- **Resource Reporting**: Provides detailed reports on deployed resources
- **History Management**: Manages release history for auditing and rollback
- **Zero-downtime Updates**: Ensures smooth transitions between versions

#### Environment-Specific Configuration with Helm Values

The Helm-based system replaces script variables with structured values files:

**values.yaml (default values):**
```yaml
global:
  environment: "staging"
  namespace: "kai-system-staging"
  resourceMultiplier: 1
  
coordinator:
  replicaCount: 1
  minReplicas: 1
  maxReplicas: 5
  pdbMinAvailable: 1
  resources:
    requests:
      cpu: "200m"
      memory: "512Mi"
    limits:
      cpu: "1000m"
      memory: "2Gi"
```

**values-production.yaml (production overrides):**
```yaml
global:
  environment: "production"
  namespace: "kai-system"
  resourceMultiplier: 2

coordinator:
  replicaCount: 3
  minReplicas: 2
  maxReplicas: 10
  pdbMinAvailable: 2
  resources:
    requests:
      cpu: "500m"
      memory: "1Gi"
    limits:
      cpu: "2000m"
      memory: "4Gi"
```

This approach provides several key benefits:
- **Centralized Configuration Management**: All environment differences are defined in dedicated values files
- **Simplified Maintenance**: Common settings are defined once in default values
- **Reduced Duplication**: Environment-specific values only override what's different from defaults
- **Type Safety**: Helm has built-in validation for value types
- **Greater Consistency**: Less risk of configuration drift between environments
- **Template-driven Generation**: Values are inserted into templates, ensuring consistent structure
- **Validation**: Helm validates values against schema before deployment

#### Built-in Release History and Versioning

Helm maintains a complete history of all releases, enabling:

1. **Auditing**: Every change is recorded with timestamp, username, and detailed manifests
2. **Comparison**: Differences between releases can be easily identified
3. **Selective Rollback**: The system can roll back to any previous release, not just the last one
4. **Release Notes**: Each deployment can include annotated notes for operational reference
5. **Revision Management**: Old revisions can be automatically purged based on retention policies

```bash
# List all release versions
helm history kai-production

# View details of a specific release
helm get all kai-production --revision=2
```

#### Integration with CI/CD Pipeline

The GitHub Actions workflow seamlessly integrates with the Helm deployment system:

```yaml
- name: Deploy to Kubernetes with Helm
  run: |
    ./helm-charts/helm-deploy.sh \
      --context=${{ env.KUBE_CONTEXT }} \
      --registry=${{ secrets.DOCKER_REGISTRY }}/${{ secrets.DOCKER_USERNAME }} \
      --tag=${{ github.sha }} \
      --env=${{ env.DEPLOY_ENV }} \
      --release=kai-${{ env.DEPLOY_ENV }}
```

This integration provides:
- **Deterministic Deployments**: Same inputs produce the same deployed state
- **Simplified Rollbacks**: Failed deployments can be easily rolled back
- **Environment Promotion**: Configurations can be promoted between environments
- **Deployment Artifacts**: Release manifests are preserved for auditing
- **Health Monitoring**: Automatic verification of deployment success
- **Reduced Drift**: Configuration is version-controlled and applied consistently

### Flux GitOps Architecture

The KAI Platform now implements a GitOps approach using Flux CD, providing a declarative and automated way to manage Kubernetes resources.

#### Flux Controllers and Architecture

The Flux GitOps implementation consists of several controllers running in the Kubernetes cluster:

```
┌──────────────────────────────────────────────────────────┐
│                      Kubernetes Cluster                   │
│                                                           │
│  ┌─────────────────┐   ┌─────────────────┐               │
│  │                 │   │                 │               │
│  │  Source         │──▶│  Kustomize      │───┐           │
│  │  Controller     │   │  Controller     │   │           │
│  │                 │   │                 │   │           │
│  └─────────────────┘   └─────────────────┘   │           │
│          │                                    │           │
│          │              ┌─────────────────┐   │           │
│          └─────────────▶│                 │   │           │
│                         │  Helm           │   │           │
│                         │  Controller     │───┼──▶ Apply  │
│                         │                 │   │    Changes│
│  ┌─────────────────┐    └─────────────────┘   │           │
│  │                 │                          │           │
│  │  Notification   │◀─────────────────────────┘           │
│  │  Controller     │                                      │
│  │                 │                                      │
│  └─────────────────┘                                      │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

1. **Source Controller**: 
   - Manages Git/Helm repositories as sources of truth
   - Fetches and validates the GitOps repository content
   - Detects changes in the source and makes them available to other controllers
   - Handles synchronization with configured interval (e.g., every 1 minute)

2. **Kustomize Controller**:
   - Applies Kubernetes resources defined through Kustomize
   - Manages reconciliation of the actual state with the desired state
   - Handles dependencies between resources
   - Reports reconciliation failures and successes

3. **Helm Controller**:
   - Manages Helm releases based on HelmRelease resources
   - Handles Helm chart installation, upgrades, and rollbacks
   - Integrates with Helm repositories for chart sources
   - Validates charts before installation

4. **Notification Controller**:
   - Sends events to external systems (Slack, webhook endpoints)
   - Provides delivery guarantees for notifications
   - Handles event filtering and transformation
   - Manages notification delivery status

#### Flux Resource Structure

The platform's Flux configuration follows a structured organization:

```
flux/
├── clusters/
│   ├── staging/
│   │   ├── flux-system/       # Flux controllers configuration
│   │   ├── sources/           # Repository sources
│   │   ├── releases/          # Application releases
│   │   └── kustomization.yaml # Main kustomization
│   └── production/
│       ├── flux-system/
│       ├── sources/
│       ├── releases/
│       └── kustomization.yaml
```

Each cluster (staging, production) has its own dedicated configuration:

1. **flux-system**: Contains the Flux controllers configuration
   ```yaml
   # Example: flux-system/gotk-sync.yaml
   apiVersion: source.toolkit.fluxcd.io/v1beta2
   kind: GitRepository
   metadata:
     name: flux-system
     namespace: flux-system
   spec:
     interval: 1m0s
     ref:
       branch: main
     url: ssh://git@github.com/kai-platform/kai-gitops
   ```

2. **sources**: Contains Helm repository definitions
   ```yaml
   # Example: sources/helm-repository.yaml
   apiVersion: source.toolkit.fluxcd.io/v1beta2
   kind: HelmRepository
   metadata:
     name: kai-charts
     namespace: flux-system
   spec:
     interval: 5m
     url: https://kai-platform.github.io/helm-charts/
   ```

3. **releases**: Contains HelmRelease definitions for each component
   ```yaml
   # Example: releases/coordinator.yaml
   apiVersion: helm.toolkit.fluxcd.io/v2beta1
   kind: HelmRelease
   metadata:
     name: coordinator
     namespace: flux-system
   spec:
     interval: 5m
     chart:
       spec:
         chart: coordinator
         version: ">=1.0.0"
         sourceRef:
           kind: HelmRepository
           name: kai-charts
     values:
       replicaCount: 3
       image:
         repository: "registry.example.com/coordinator"
         tag: "v1.2.3"
   ```

#### Helm and Flux Integration

Our Flux implementation seamlessly integrates with our Helm-based deployment architecture:

1. **HelmRelease Resources**: Define releases of our Helm charts with specific values
2. **Value Overrides**: Environment-specific values are defined in the HelmRelease resources
3. **Reconciliation**: Flux continuously ensures the Helm releases match their definitions
4. **Releases Management**: Flux handles Helm release creation, upgrades, and rollbacks

#### CI/CD to GitOps Flow

The CI/CD pipeline interacts with the GitOps repository to trigger deployments:

```
┌────────────────┐     ┌────────────────┐     ┌────────────────┐     
│                │     │                │     │                │     
│  CI Build &    │────▶│  Update GitOps │────▶│  Flux          │     
│  Test          │     │  Repository    │     │  Controllers   │     
│                │     │                │     │                │     
└────────────────┘     └────────────────┘     └────────────────┘     
                                                      │              
                                                      │              
                                                      ▼              
┌────────────────┐     ┌────────────────┐     ┌────────────────┐     
│                │     │                │     │                │     
│  Notification  │◀────│  Reconciliation│◀────│  Apply         │     
│                │     │  Status        │     │  Changes       │     
│                │     │                │     │                │     
└────────────────┘     └────────────────┘     └────────────────┘     
```

1. The CI pipeline builds and tests new versions of components
2. Upon successful build, it updates HelmRelease resources in the GitOps repository with new image tags
3. Flux detects changes in the GitOps repository
4. Flux controllers apply changes to the Kubernetes cluster
5. Reconciliation status is reported back
6. Notifications are sent about the deployment results

#### Benefits for Kubernetes Architecture

Adopting Flux GitOps provides several architectural benefits:

1. **Declarative Infrastructure**: All Kubernetes resources are defined declaratively in Git
2. **Kubernetes-Native**: Flux controllers run as Kubernetes controllers and use the Kubernetes API
3. **Self-Healing**: Continuous reconciliation ensures the cluster state matches Git, automatically correcting drift
4. **Multi-Cluster Management**: The same GitOps repository can manage multiple clusters with environment-specific configurations
5. **Progressive Delivery**: Support for canary deployments and A/B testing through Flux extensions
6. **Security Improvements**:
   - No CI/CD pipeline needs direct access to Kubernetes
   - Pull-based model (Flux pulls from Git) rather than push-based
   - Reduced attack surface and credential management
7. **Compliance and Auditability**:
   - All changes go through Git with commit history
   - Automated reconciliation reports
   - Clear source of truth for cluster state

#### Reconciliation and Self-Healing

Flux continuously reconciles the desired state (from Git) with the actual state in the cluster:

1. **Detection**: Flux detects when the actual state drifts from the desired state
2. **Analysis**: It analyzes the difference and determines required changes
3. **Remediation**: It automatically applies the necessary changes to align with the desired state
4. **Reporting**: It reports the reconciliation results through events and status conditions

This self-healing capability ensures that the cluster always reflects the desired configuration, even if manual changes are made or if resources are accidentally deleted.

### Operational Considerations

#### Scaling Strategies

The KAI Platform implements a sophisticated multi-layer scaling architecture to efficiently manage resources:

1. **Horizontal Pod Autoscaling (HPA)**

   The platform uses HPA to automatically adjust replica counts for stateless components based on observed metrics:

   ```yaml
   apiVersion: autoscaling/v2
   kind: HorizontalPodAutoscaler
   metadata:
     name: coordinator-service
   spec:
     scaleTargetRef:
       apiVersion: apps/v1
       kind: Deployment
       name: coordinator-service
     minReplicas: 3
     maxReplicas: 10
     metrics:
     - type: Resource
       resource:
         name: cpu
         target:
           type: Utilization
           averageUtilization: 80
   ```

   **Platform Communication with HPA:**
   
   Our system interacts with the HPA controller through a metrics pipeline:
   
   - **Metrics Exposition**: All components expose metrics via Prometheus annotations:
     ```yaml
     prometheus.io/scrape: "true"
     prometheus.io/port: "8081"
     prometheus.io/path: "/metrics"
     ```
   - **Collection Flow**:
     1. `metrics-server` collects CPU/memory metrics from kubelet on each node
     2. Prometheus scrapes detailed custom metrics from component endpoints
     3. Prometheus Adapter converts Prometheus metrics to the custom metrics API format
     4. HPA controller queries these APIs every 15 seconds to make scaling decisions
   
   - **Coordinator Service Role**: The Coordinator actively participates in the scaling architecture by:
     - Exposing workload metrics (queue depths, processing times) via its `/metrics` endpoint
     - Tracking processing load across different quality tiers
     - Adjusting its internal task concurrency limits based on observed cluster capacity
     - Implementing back-pressure mechanisms when resources are constrained

2. **Workflow-level Concurrency Management**

   The Coordinator Service implements sophisticated task queue management with:
   
   - Priority-based queueing with weighted fair scheduling
   - Dynamic concurrency limits based on resource availability
   - Task classification (interactive, batch, maintenance) with appropriate scheduling policies
   - Resource reservation for high-priority workflows

3. **Cluster Autoscaling**

   Node pools automatically scale based on pending pods, which happens when:
   
   - HPAs increase replica counts, creating new pods
   - Argo workflows spawn pods that can't be scheduled on existing nodes
   - Quality tier requirements demand specialized resources
   
   Each node pool (CPU-optimized, GPU-optimized, etc.) scales independently based on the specific workload needs.

4. **Quality Tier Scaling**

   The ResourceManager component dynamically adjusts resource requests for workflows based on:
   
   - Subscription tier limitations (enforcing fair resource allocation)
   - Current cluster utilization (applying backpressure when needed)
   - Quality level requirements (allocating appropriate GPU resources)
   
   This ensures optimal resource distribution during high-load periods while maintaining quality of service guarantees.
   
**Results and Benefits:**

This multi-layered scaling approach provides:

- **Cost Efficiency**: Scaling components down during low-traffic periods
- **Responsive Scaling**: Proactively adding replicas before performance degrades
- **Reliability**: Automatic recovery from failures through replica recreation
- **Resource Optimization**: Efficient allocation based on actual usage patterns
- **Quality of Service**: Maintaining performance guarantees for different subscription tiers

The system's scaling behavior can be monitored through dedicated Grafana dashboards that display:
- Current/target replica counts
- CPU/memory utilization across replicas
- Scaling events timeline
- Queue depths by priority level

#### High Availability

1. **Pod Disruption Budgets**: Ensure minimum availability during updates
   ```yaml
   apiVersion: policy/v1
   kind: PodDisruptionBudget
   metadata:
     name: coordinator-pdb
   spec:
     minAvailable: 2
     selector:
       matchLabels:
         app: coordinator-service
   ```

2. **Anti-Affinity Rules**: Distribute pods across nodes
3. **Multi-Zone Deployment**: Spread workloads across availability zones

#### Disaster Recovery

1. **Regular Backups**: PVC snapshots, database backups
2. **Stateless Design**: Most components can be recreated from configuration
3. **GitOps Approach**: Infrastructure-as-Code for quick recovery

## Security

### RBAC Configuration

The platform uses role-based access control to secure components:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: coordinator-workflow-manager
  namespace: kai-ml
rules:
  - apiGroups: ["argoproj.io"]
    resources: ["workflows", "workflows/finalizers", "workflowtemplates"]
    verbs: ["create", "delete", "get", "list", "patch", "update", "watch"]
```

### Pod Security

1. **Non-root Users**: Containers run as non-root when possible
2. **Read-only Root Filesystem**: Where applicable
3. **Pod Security Standards**: Enforced at namespace level

## Performance Tuning

### GPU Acceleration

1. **NVIDIA Device Plugin**: For GPU access in containers
2. **GPU Sharing**: For efficient resource usage
3. **Multi-GPU Workflows**: For complex ML training

### Memory Management

1. **Huge Pages**: For memory-intensive operations
2. **Memory Limits**: Preventing OOM situations
3. **Pod Quality of Service**: Based on resource requests and limits

## Troubleshooting

### Common Issues

1. **Pod Scheduling Failures**: Check node selectors, taints, resource availability
2. **Workflow Failures**: Examine Argo Workflow logs, check for resource constraints
3. **Performance Issues**: Check for node resource saturation, check affinity rules

### Debugging Commands

```bash
# Get logs for coordinator service
kubectl logs -n kai-ml deployment/coordinator-service

# Describe a workflow
kubectl -n kai-ml describe workflow my-workflow-name

# Check resource usage
kubectl top pods -n kai-ml
kubectl top nodes
```

## Conclusion

The Kubernetes architecture for the KAI ML Platform provides a robust, scalable foundation for machine learning workloads. By leveraging specialized node pools, priority classes, and custom resource scheduling, the platform efficiently manages compute-intensive ML tasks while maintaining high availability and performance.

For deployment instructions, refer to the [Deployment Guide](./deployment-guide.md) and [Deployment and Development Guide](./deployment-and-development.md).