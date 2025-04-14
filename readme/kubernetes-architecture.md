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

### Deployment Script

The `kubernetes/deploy.sh` script manages the deployment process:

```bash
./kubernetes/deploy.sh --context=my-k8s-context --registry=my-registry.example.com --tag=v1.2.3
```

Script features:
- Templating and variable substitution
- Sequential component deployment
- Validation and dry-run capability
- Selective component updates

### Operational Considerations

#### Scaling Strategies

1. **Horizontal Pod Autoscaling**: For stateless components like the API server
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

2. **Cluster Autoscaling**: For node pool expansion based on pending pods
3. **Quality Tier Scaling**: Adjusting resource allocation based on processing quality tiers

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