+++
id = "comprehensive-deployment-guide"
title = "Comprehensive Kai Platform Deployment Guide"
context_type = "documentation"
scope = "Complete deployment workflow from infrastructure to application"
target_audience = ["devops", "developers", "operators"]
granularity = "detailed"
status = "active"
last_updated = "2025-07-08"
tags = ["deployment", "infrastructure", "kubernetes", "flux", "helm", "terraform", "digitalocean", "gitops"]
related_context = [
    "infra/",
    "flux/",
    "helm-charts/"
]
+++

# Comprehensive Kai Platform Deployment Guide

## Overview

This guide provides a complete step-by-step process for deploying the Kai Platform, from infrastructure provisioning to application deployment. The platform uses a modern GitOps approach with Infrastructure as Code (IaC) principles.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Kai Platform Architecture                    │
├─────────────────────────────────────────────────────────────────┤
│  Infrastructure Layer (Terraform + DigitalOcean)               │
│  ├── DigitalOcean Kubernetes Cluster (DOKS)                    │
│  ├── Auto-scaling Node Pool (1-5 nodes, s-2vcpu-4gb)          │
│  └── Amsterdam Region (ams3)                                   │
├─────────────────────────────────────────────────────────────────┤
│  GitOps Layer (Flux v2)                                        │
│  ├── Source Controller (Git Repository Monitoring)             │
│  ├── Kustomize Controller (Manifest Processing)                │
│  └── Helm Controller (Chart Deployment)                        │
├─────────────────────────────────────────────────────────────────┤
│  Application Layer (Helm Charts)                               │
│  ├── API Server (REST API + GraphQL)                          │
│  ├── Coordinator (Task Management)                             │
│  ├── ML Services (6 specialized services)                      │
│  ├── Infrastructure Services (Redis, Monitoring)               │
│  └── Workflow Engine (Argo Workflows)                          │
└─────────────────────────────────────────────────────────────────┘
```

## Prerequisites

### Required Tools
- **Terraform** (>= 1.0): Infrastructure provisioning
- **kubectl** (>= 1.28): Kubernetes cluster management
- **flux** (>= 2.0): GitOps toolkit CLI
- **helm** (>= 3.0): Kubernetes package manager
- **git**: Version control and GitOps workflow

### Required Accounts & Access
- **DigitalOcean Account**: For Kubernetes cluster hosting
- **GitHub Repository Access**: For GitOps source control
- **Container Registry Access**: GitHub Container Registry (GHCR)

### Environment Variables
```bash
# DigitalOcean
export DIGITALOCEAN_TOKEN="your_do_token_here"

# Container Registry
export REGISTRY_URL="ghcr.io/basilakis/kai"

# Kubernetes Context (set after cluster creation)
export KUBECONFIG="path/to/kubeconfig"
```

## Step-by-Step Deployment Process

### Phase 1: Infrastructure Provisioning

#### 1.1 Initialize Terraform
```bash
cd infra/
terraform init
```

#### 1.2 Plan Infrastructure Changes
```bash
terraform plan
```

**What this creates:**
- DigitalOcean Kubernetes cluster named "kai"
- Kubernetes version 1.32.x (latest patch)
- Auto-scaling node pool (1-5 nodes)
- Node size: s-2vcpu-4gb (2 vCPU, 4GB RAM)
- Region: Amsterdam (ams3)

#### 1.3 Apply Infrastructure
```bash
terraform apply
```

#### 1.4 Configure kubectl Access
```bash
# Get cluster ID from Terraform output
CLUSTER_ID=$(terraform output -raw cluster-id)

# Download kubeconfig
doctl kubernetes cluster kubeconfig save $CLUSTER_ID

# Verify cluster access
kubectl cluster-info
kubectl get nodes
```

### Phase 2: GitOps Setup (Flux Installation)

#### 2.1 Install Flux on Cluster
```bash
# Check cluster compatibility
flux check --pre

# Install Flux components
flux install
```

#### 2.2 Configure Git Repository Source
```bash
# Create namespace for Flux sources
kubectl create namespace flux-system

# Add Git repository as source
flux create source git kai-platform \
  --url=https://github.com/Basilakis/kai \
  --branch=main \
  --interval=1m \
  --export > flux/clusters/production/sources/kai-platform-source.yaml
```

#### 2.3 Bootstrap GitOps Workflow
```bash
# Apply the production cluster configuration
kubectl apply -k flux/clusters/production/
```

### Phase 3: Application Deployment

#### 3.1 Verify Source Configuration
The system uses two source repositories:

**Internal Charts (kai-charts):**
```yaml
# flux/clusters/production/sources/helm-repository.yaml (lines 1-13)
apiVersion: source.toolkit.fluxcd.io/v1
kind: GitRepository
metadata:
  name: kai-charts
  namespace: flux-system
spec:
  interval: 1m
  ref:
    branch: main
  url: https://github.com/Basilakis/kai
  ignore: |
    /*
    !/helm-charts/
```

**External Charts (argo):**
```yaml
# flux/clusters/production/sources/helm-repository.yaml (lines 15-22)
apiVersion: source.toolkit.fluxcd.io/v1beta2
kind: HelmRepository
metadata:
  name: argo
  namespace: flux-system
spec:
  interval: 1m
  url: https://argoproj.github.io/argo-helm
```

#### 3.2 Deploy Core Services

**API Server:**
```bash
kubectl apply -f flux/clusters/production/releases/api-server.yaml
```

**Coordinator:**
```bash
kubectl apply -f flux/clusters/production/releases/coordinator.yaml
```

**Argo Workflows:**
```bash
kubectl apply -f flux/clusters/production/releases/argo-workflows.yaml
```

#### 3.3 Deploy Application Services
```bash
# Apply all Kai application manifests
kubectl apply -k flux/clusters/production/kai/
```

### Phase 4: Verification & Monitoring

#### 4.1 Check Flux Status
```bash
# Check all Flux resources
flux get all

# Check specific sources
flux get sources git
flux get sources helm

# Check Helm releases
flux get helmreleases
```

#### 4.2 Verify Application Pods
```bash
# Check all pods in kai namespace
kubectl get pods -n kai

# Check specific services
kubectl get svc -n kai
kubectl get ingress -n kai
```

#### 4.3 Check Logs
```bash
# API Server logs
kubectl logs -n kai deployment/api-server -f

# Coordinator logs
kubectl logs -n kai deployment/coordinator -f

# Flux controller logs
kubectl logs -n flux-system deployment/source-controller -f
kubectl logs -n flux-system deployment/helm-controller -f
```

## Service Architecture Details

### Core Services

#### API Server
- **Purpose**: REST API and GraphQL endpoint
- **Image**: `ghcr.io/basilakis/kai/api-server:latest`
- **Dependencies**: Redis, Database
- **Ports**: 8080 (HTTP), 8443 (HTTPS)

#### Coordinator
- **Purpose**: Task management and orchestration
- **Image**: `ghcr.io/basilakis/kai/coordinator:latest`
- **Dependencies**: Redis, Message Queue
- **Secrets**: Redis password, API keys

#### ML Services (6 Services)
1. **Multimodal Pattern Recognition**
2. **Domain-Specific Networks**
3. **Relationship-Aware Training**
4. **3D Reconstruction**
5. **Continuous Learning**
6. **Mobile Optimization**

### Infrastructure Services

#### Redis Caching
- **Purpose**: Session storage, caching, pub/sub
- **Configuration**: Cluster mode with persistence
- **Secrets**: Password-protected access

#### Argo Workflows
- **Purpose**: Complex workflow orchestration
- **Source**: External Helm repository
- **Integration**: ML pipeline execution

## Configuration Management

### Secrets Management
All sensitive data uses Kubernetes secrets with placeholder patterns:

```yaml
# Example secret structure
apiVersion: v1
kind: Secret
metadata:
  name: coordinator-secrets
data:
  redis-password: PUT__REDIS_PASSWORD_HERE  # Base64 encoded
  api-key: PUT_BASE64_ENCODED_API_KEY_HERE
```

### Environment-Specific Configuration
- **Production Only**: Staging environment removed for security
- **Container Registry**: Standardized to `ghcr.io/basilakis/kai`
- **Image Tags**: Latest stable versions with fallback to `latest`

## Troubleshooting Guide

### Common Issues

#### 1. Flux Source Not Syncing
```bash
# Check source status
flux get sources git kai-charts

# Force reconciliation
flux reconcile source git kai-charts
```

#### 2. Helm Release Failed
```bash
# Check Helm release status
flux get helmreleases

# Get detailed error information
kubectl describe helmrelease api-server -n flux-system
```

#### 3. Pod CrashLoopBackOff
```bash
# Check pod logs
kubectl logs -n kai <pod-name> --previous

# Check resource constraints
kubectl describe pod -n kai <pod-name>
```

#### 4. Image Pull Errors
```bash
# Verify image exists
docker pull ghcr.io/basilakis/kai/api-server:latest

# Check image pull secrets
kubectl get secrets -n kai
```

### Recovery Procedures

#### Infrastructure Recovery
```bash
# Recreate cluster if needed
cd infra/
terraform destroy  # WARNING: This deletes everything
terraform apply
```

#### Application Recovery
```bash
# Reset Flux state
flux uninstall
flux install

# Reapply configurations
kubectl apply -k flux/clusters/production/
```

## Maintenance Procedures

### Regular Updates

#### 1. Update Kubernetes Cluster
```bash
# Check available versions
doctl kubernetes options versions

# Update via DigitalOcean console or API
# Note: Update Terraform configuration accordingly
```

#### 2. Update Application Images
```bash
# Update image tags in Helm values
# Flux will automatically detect and deploy changes
```

#### 3. Scale Resources
```bash
# Scale node pool
terraform apply -var="max_nodes=10"

# Scale individual deployments
kubectl scale deployment api-server -n kai --replicas=3
```

### Backup Procedures

#### 1. Backup Persistent Data
```bash
# Backup Redis data
kubectl exec -n kai redis-0 -- redis-cli BGSAVE

# Backup application data
# (Implement based on your data persistence strategy)
```

#### 2. Backup Configuration
```bash
# Export all Kubernetes resources
kubectl get all --all-namespaces -o yaml > cluster-backup.yaml

# Backup Flux configuration
git clone https://github.com/Basilakis/kai
```

## Security Considerations

### Network Security
- All inter-service communication within cluster
- Ingress controller for external access
- Network policies for service isolation

### Secret Management
- Kubernetes native secrets
- Placeholder patterns for sensitive data
- Regular secret rotation procedures

### Access Control
- RBAC for Kubernetes access
- Service accounts for applications
- Flux RBAC for GitOps operations

## Performance Optimization

### Resource Allocation
- CPU/Memory requests and limits defined
- Horizontal Pod Autoscaling (HPA) configured
- Cluster autoscaling for node management

### Monitoring & Observability
- Prometheus metrics collection
- Grafana dashboards
- Centralized logging with Fluentd/Fluent Bit

## Conclusion

This deployment process provides a robust, scalable, and maintainable platform using modern DevOps practices. The GitOps approach ensures declarative configuration management, while the microservices architecture enables independent scaling and updates.

For additional support or questions, refer to the individual service documentation in the `helm-charts/` directory or contact the DevOps team.