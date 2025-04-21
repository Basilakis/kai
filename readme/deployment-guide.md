# Kai Platform Deployment and Development Guide

This comprehensive guide covers all aspects of deploying and developing with the Kai platform, including production deployment configurations, development environment setup, Docker optimization strategies, and advanced deployment techniques like canary deployments.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Component Installation](#component-installation)
- [Deployment Options](#deployment-options)
  - [Cloud Provider Deployment](#cloud-provider-deployment)
  - [Self-Hosted Deployment](#self-hosted-deployment)
  - [Kubernetes Deployment](#kubernetes-deployment)
  - [Docker Configuration and Optimization](#docker-configuration-and-optimization)
- [Deployment Process](#deployment-process)
  - [Environment Configuration](#environment-configuration)
  - [Database Setup and Migration](#database-setup-and-migration)
  - [Build Process](#build-process)
  - [Containerization](#containerization)
  - [Kubernetes Deployment](#kubernetes-deployment-1)
  - [Canary Deployments](#canary-deployments)
  - [Vercel Deployment](#vercel-deployment)
  - [Supabase Deployment](#supabase-deployment)
- [CI/CD Pipeline](#cicd-pipeline)
- [Development Environment](#development-environment)
  - [Local Setup](#local-setup)
  - [Development Workflow](#development-workflow)
  - [Debugging](#debugging)
  - [Common Development Tasks](#common-development-tasks)
- [Maintenance and Updates](#maintenance-and-updates)
  - [Updating the Application](#updating-the-application)
  - [Scaling the Application](#scaling-the-application)
  - [Backup and Disaster Recovery](#backup-and-disaster-recovery)
- [Troubleshooting](#troubleshooting)
  - [Supabase Issues](#supabase-issues)
  - [Vercel Deployment Issues](#vercel-deployment-issues)
  - [Kubernetes Issues](#kubernetes-issues)
  - [Docker Issues](#docker-issues)
- [Performance Optimization](#performance-optimization)

## Overview

The Kai Platform is a comprehensive system for material management, recognition, and 3D visualization. This guide provides detailed instructions for deploying the platform to production environments and setting up development environments.

## Architecture

The Kai application consists of several components deployed across different platforms:

```
                             ┌────────────────────────────────────┐
                             │                                    │
                             │  Digital Ocean Kubernetes Cluster  │
                             │  ─────────────────────────────────┤
                             │                                    │
┌────────────────────────┐   │  ┌────────────────┐  ┌───────────┐│
│                        │   │  │                │  │           ││
│  Vercel                │   │  │  API Server    │  │ Redis     ││
│  ───────────────────   │   │  │                │  │           ││
│  - Admin Panel (Next)  │───┼─▶│                │  │           ││
│  - Client App (Gatsby) │   │  └────────┬───────┘  └───────────┘│
│                        │   │           │                       │
└────────────────────────┘   │           ▼                       │
          │                  │  ┌────────────────┐               │
          │                  │  │                │               │
          │                  │  │  Coordinator   │◄──┐           │
          │                  │  │  Service       │   │           │
          ▼                  │  │                │   │           │
┌────────────────────────┐   │  └────────┬───────┘   │           │
│                        │   │           │           │           │
│  Supabase              │   │           ▼           │           │
│  ───────────────────   │   │  ┌────────────────┐   │           │
│  - Authentication      │◀──┼─▶│                │   │           │
│  - Realtime Features   │   │  │  Argo          │───┘           │
│  - Queue Management    │   │  │  Workflows     │               │
│  - Vector Database     │   │  │                │               │
│                        │   │  └────────────────┘               │
└────────────┬───────────┘   │           │                       │
             │               │           ▼                       │
             │               │  ┌────────────────┐               │
             │               │  │  Worker Pods   │               │
             │               │  │  ─────────────┤               │
             └──────────────┼─▶│  - Quality     │               │
                            │  │    Assessment  │               │
┌────────────────────────┐  │  │  - Preprocessing │             │
│                        │  │  │  - COLMAP SfM   │               │
│  External Services     │  │  │  - Point Cloud  │               │
│  ───────────────────   │  │  │  - Model Gen   │               │
│  - MongoDB Atlas       │◀─┼─▶│  - NeRF        │               │
│  - AWS S3              │  │  │  - Format Conv │               │
│                        │  │  │                │               │
└────────────────────────┘  │  └────────────────┘               │
                            │                                    │
                            └────────────────────────────────────┘
```

With the recently added features, the architecture has been extended:

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                                                                                │
│  Digital Ocean Kubernetes Cluster                                             │
│  ─────────────────────────────────────────────────────────────────────────    │
│                                                                                │
│            ┌──────────────────┐                                               │
│            │                  │                                               │
│            │  Parameter       │◄────────────┐                                 │
│            │  Registry        │             │                                 │
│            │                  │             │                                 │
│            └─────────┬────────┘             │                                 │
│                      │                      │                                 │
│                      ▼                      │                                 │
│  ┌──────────────┐  ┌──────────────────┐   ┌─┴────────────┐   ┌───────────────┐│
│  │              │  │                  │   │              │   │               ││
│  │ Notification │  │  Coordinator    │   │ ML Workloads │   │  Webhook      ││
│  │ Service      │◄─┤  Service        │◄──┤ Orchestrator │◄──┤  Service      ││
│  │              │  │                  │   │              │   │               ││
│  └──────┬───────┘  └──────────────────┘   └─────┬────────┘   └───────────────┘│
│         │                   │                   │                             │
│         │                   ▼                   ▼                             │
│         │           ┌────────────────┐  ┌─────────────────┐                  │
│         │           │                │  │                 │                  │
│         │           │  Existing      │  │ New ML Workflows│                  │
│         │           │  Workflows     │  │ ───────────────│                  │
│         │           │                │  │ - MultiModal   │                  │
│         │           └────────────────┘  │   Pattern      │                  │
│         │                               │   Recognition  │                  │
│         │                               │ - Domain-      │                  │
│         │                               │   Specific     │                  │
│         ▼                               │   Networks     │                  │
│  ┌─────────────────┐                    │                 │                  │
│  │ Email/SMS/Push  │                    └─────────────────┘                  │
│  │ Delivery        │                                                         │
│  │ Services        │                                                         │
│  └─────────────────┘                                                         │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Prerequisites

Before proceeding with deployment, ensure you have the following:

- GitHub account with administrator access to the repository
- Supabase account
- Vercel account
- Digital Ocean account with Kubernetes support
- Node.js (v16+) and Yarn (v1.22+) installed locally
- Docker and kubectl installed locally for testing
- Domain name(s) for your deployment
- NVIDIA GPU operators installed (for ML features)
- Nodes with NVIDIA L40S/H100 GPUs available for ML workloads
- Persistent storage configured for parameter history and ML artifacts

## Component Installation

This section provides installation instructions for all Kai system components. Follow these steps to set up the required dependencies and services before deployment.

### Neural OCR Installation

The Neural OCR integration requires additional dependencies beyond the standard OCR system:

1. Install neural OCR dependencies:
   ```bash
   cd packages/ml
   pip install -r python/requirements-ocr.txt
   ```

2. Verify installation:
   ```bash
   python -c "from neural_ocr_orchestrator import NeuralOCROrchestrator; print('Neural OCR available:', NeuralOCROrchestrator.available_engines())"
   ```

### ML Package Installation

The ML package provides machine learning functionality for material recognition, vector embeddings, model training, multimodal pattern recognition, and domain-specific networks:

#### Prerequisites
- CUDA 11.8+ for GPU support
- NVIDIA drivers for L40S/H100 GPUs
- Python 3.8+
- Node.js 16+
- Tesseract OCR (for text extraction)

#### Setup
1. Install Node.js dependencies:
   ```bash
   cd packages/ml
   npm install
   ```

2. Install Python dependencies:
   ```bash
   npm run setup-python
   ```

#### MultiModal Pattern Recognition Setup

For the MultiModal Pattern Recognition system:

1. Install additional dependencies:
   ```bash
   pip install transformers torch torchvision einops timm safetensors
   ```

2. Download model weights:
   ```bash
   python -c "from huggingface_hub import snapshot_download; snapshot_download('kai/multimodal-pattern-recognition-base')"
   ```

3. Verify installation:
   ```bash
   python -c "from multimodal_pattern_recognition import MultiModalPatternRecognizer; print('MultiModal Pattern Recognition available:', MultiModalPatternRecognizer.available())"
   ```

#### Domain-Specific Networks Setup

For the Domain-Specific Networks system:

1. Install additional dependencies:
   ```bash
   pip install torch torchvision einops timm ml_collections
   ```

2. Download model weights:
   ```bash
   python -c "from huggingface_hub import snapshot_download; snapshot_download('kai/domain-specific-networks')"
   ```

3. Verify installation:
   ```bash
   python -c "from domain_specific_networks import DomainSpecificNetworkManager; print('Domain-Specific Networks available:', DomainSpecificNetworkManager.list_available_domains())"
   ```

### Notification System Installation

The Notification System provides multi-channel notification capabilities:

#### Prerequisites
- Node.js 16+
- Redis for notification queueing
- SMTP server (for email notifications)
- Twilio or similar provider (for SMS notifications)

#### Installation Steps

1. Install dependencies:
   ```bash
   cd packages/server
   yarn install
   ```

2. Run database migrations:
   ```bash
   cd packages/server/src/migrations
   node ../../scripts/run-migrations.js notification-tables.sql
   node ../../scripts/run-migrations.js push-notifications.sql
   node ../../scripts/run-migrations.js webhooks.sql
   ```

3. Configure environment variables:
   ```
   # Notification Service
   NOTIFICATION_SERVICE_ENABLED=true
   DEFAULT_NOTIFICATION_CHANNEL=in-app
   
   # Email Provider
   EMAIL_PROVIDER=sendgrid  # sendgrid, mailchimp, or ses
   EMAIL_API_KEY=your_api_key
   
   # SMS Provider (optional)
   SMS_PROVIDER=twilio  # twilio or nexmo
   SMS_API_KEY=your_api_key
   SMS_ACCOUNT_SID=your_sid  # twilio only
   
   # Webhook Configuration
   WEBHOOK_RETRY_ATTEMPTS=3
   WEBHOOK_TIMEOUT_MS=5000
   ```

### Parameter Registry Installation

The Parameter Registry system manages hyperparameters for material analysis:

#### Prerequisites
- Node.js 16+
- PostgreSQL or Supabase
- Redis for caching

#### Installation Steps

1. Install dependencies:
   ```bash
   cd packages/server
   yarn install
   ```

2. Run database migrations:
   ```bash
   cd packages/server/src/migrations
   node ../../scripts/run-migrations.js parameter-registry.sql
   ```

3. Configure environment variables:
   ```
   # Parameter Registry
   PARAM_REGISTRY_ENABLED=true
   PARAM_STORAGE_TYPE=supabase  # supabase or postgres
   PARAM_DB_CONNECTION=your_connection_string
   PARAM_HISTORY_RETENTION_DAYS=90
   DEFAULT_PARAMETER_SET=standard
   SIMILARITY_THRESHOLD=0.75
   ```

### MCP Server Installation

The Model Context Protocol (MCP) Server centralizes model management and provides optimized inference capabilities:

#### Prerequisites

- Docker (for containerized deployment)
- Python 3.8+ (for local development)
- Node.js 14+ (for client SDK)

#### Environment Variables

The MCP Server can be configured with the following environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `MCP_SERVER_PORT` | Port for the MCP server | `8000` |
| `MODEL_DIR` | Directory for storing model files | `/app/models` |
| `LOG_LEVEL` | Logging level (DEBUG, INFO, WARNING, ERROR) | `INFO` |
| `ENABLE_AGENT_API` | Enable agent communication APIs | `true` |

#### Docker Deployment

The MCP Server can be deployed as a Docker container:

```bash
# Build the MCP server image
docker build -t kai-mcp-server -f packages/ml/Dockerfile.mcp .

# Run the MCP server container
docker run -d \
  --name kai-mcp-server \
  -p 8000:8000 \
  -v $(pwd)/models:/app/models \
  kai-mcp-server
```

#### Local Development

For local development, you can run the MCP server directly:

```bash
# Install required packages
cd packages/ml
pip install -r requirements.txt
pip install fastapi uvicorn python-multipart

# Run the server
cd packages/ml/python
uvicorn mcp_server:app --reload --host 0.0.0.0 --port 8000
```

### MCP Client Installation

The MCP Client provides a TypeScript interface for the MCP server:

```bash
# From the project root
cd packages/mcp-client
yarn install
yarn build
yarn link  # For local development

# In packages that use the MCP client
cd ../ml
yarn link @kai/mcp-client
```

#### Client Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MCP_SERVER_URL` | URL of the MCP server | `http://localhost:8000` |
| `USE_MCP_SERVER` | Enable MCP server integration | `false` |
| `MCP_HEALTH_CHECK_TIMEOUT` | Timeout for health check (ms) | `5000` |

### CrewAI Integration Installation

The CrewAI integration adds intelligent agent capabilities to the Kai platform:

#### Prerequisites
- Node.js 16+
- Yarn or npm
- OpenAI API key
- KAI platform services running

#### Installation Steps

1. Install dependencies:
   ```bash
   cd packages/agents
   yarn install
   ```

2. Configure environment variables in the root `.env` file:
   ```
   # Required
   OPENAI_API_KEY=your_openai_api_key

   # KAI Services (change URLs as needed for your environment)
   KAI_API_URL=http://localhost:3000/api
   KAI_VECTOR_DB_URL=http://localhost:5000/api/vector
   KAI_ML_SERVICE_URL=http://localhost:7000/api/ml

   # Optional
   OPENAI_DEFAULT_MODEL=gpt-4
   OPENAI_TEMPERATURE=0.7
   ENABLE_MOCK_FALLBACK=true
   LOG_LEVEL=info
   
   # Redis Configuration (for agent state persistence)
   REDIS_URL=redis://localhost:6379
   REDIS_PASSWORD=
   ```

3. Verify installation:
   ```bash
   cd packages/agents
   yarn verify
   ```
   
   Or run integration tests:
   ```bash
   yarn test:integration
   ```

### Hugging Face Integration Installation

The Hugging Face integration with adaptive model selection provides enhanced AI capabilities across multiple providers:

#### Prerequisites
- Node.js 16+
- Yarn or npm
- Hugging Face API key
- Optional: OpenAI and/or Anthropic API keys (for multi-provider capabilities)

#### Installation Steps

1. Install dependencies:
   ```bash
   cd packages/server
   yarn install
   ```

2. Configure environment variables in the root `.env` file:
   ```
   # Required for Hugging Face integration
   HF_API_KEY=your_huggingface_api_key
   
   # Optional Hugging Face configuration
   HF_ORGANIZATION_ID=your_organization_id
   HF_DEFAULT_TEXT_MODEL=google/flan-t5-xxl
   HF_DEFAULT_EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
   HF_DEFAULT_IMAGE_MODEL=google/vit-base-patch16-224
   HF_MODEL_TIMEOUT=30000
   HF_USE_FAST_MODELS=true
   
   # Optional additional providers
   OPENAI_API_KEY=your_openai_api_key
   ANTHROPIC_API_KEY=your_anthropic_api_key
   
   # Adaptive model selection configuration
   MODEL_EVALUATION_STANDARD_CYCLE=10
   MODEL_EVALUATION_TEST_CYCLE=3
   MODEL_SELECTION_METRICS_WEIGHTS={"accuracy":0.6,"latency":0.2,"cost":0.2}
   ```

3. Verify installation:
   ```bash
   curl http://localhost:3000/api/ai/models/list
   ```
   
   The response should include available models across all configured providers.

4. Test the adaptive model selection system:
   ```bash
   # Generate text with automatic model selection
   curl -X POST http://localhost:3000/api/ai/text/generate \
     -H "Content-Type: application/json" \
     -d '{"prompt": "Explain the properties of porcelain tiles"}'
   ```

## Deployment Options

### Option 1: Cloud Provider Deployment (Recommended)

1. **AWS Deployment**
   - API Server: ECS Fargate or Elastic Beanstalk
   - Database: MongoDB Atlas or DocumentDB
   - File Storage: S3
   - ML Services: EC2 with GPU or SageMaker
   - CDN: CloudFront
   - Queue: Supabase hosted on EC2 or ECS

2. **Azure Deployment**
   - API Server: Azure App Service or AKS
   - Database: Cosmos DB with MongoDB API
   - File Storage: Azure Blob Storage
   - ML Services: Azure VMs with GPU or Azure ML
   - CDN: Azure CDN
   - Queue: Supabase hosted on Azure VMs

3. **Google Cloud Deployment**
   - API Server: Google Cloud Run or GKE
   - Database: MongoDB Atlas
   - File Storage: Google Cloud Storage
   - ML Services: Google Compute with GPUs
   - CDN: Cloud CDN
   - Queue: Supabase hosted on GCE

### Option 2: Self-Hosted Deployment

Requirements:
- Kubernetes cluster or Docker Swarm
- Load balancer (NGINX, HAProxy)
- MongoDB (replica set recommended)
- S3-compatible storage (MinIO, Ceph)
- GPU servers for ML services

Steps:
1. Set up MongoDB replica set
2. Deploy S3-compatible storage
3. Configure container orchestration platform
4. Deploy API server containers
5. Deploy ML service containers
6. Set up load balancer and routing
7. Configure Supabase for queue system
8. Set up monitoring and logging

### Kubernetes Deployment

The KAI ML Platform uses a job-based processing architecture with Argo Workflows for orchestration. This section provides detailed steps for deploying to Digital Ocean Kubernetes (DOKS).

#### Setting up a Kubernetes Cluster

1. Log in to [Digital Ocean](https://cloud.digitalocean.com/)
2. Navigate to Kubernetes → Create → Kubernetes
3. Configure the cluster:
   - Kubernetes Version: Latest stable version
   - Datacenter Region: Choose the region closest to your users
   - Node Pools:
     - **Orchestration Pool**:
       - Machine Type: Standard
       - Node Plan: 4 GB / 2 vCPU or higher
       - Node Count: 3 (for high availability)
       - Labels: `node-type=orchestration`
       
     - **CPU-Optimized Pool**:
       - Machine Type: CPU-Optimized
       - Node Plan: 8 GB / 4 vCPU or higher
       - Node Count: 3
       - Labels: `node-type=cpu-optimized`
       
     - **GPU-Optimized Pool**:
       - Machine Type: GPU-Optimized
       - Node Plan: With NVIDIA L40S/H100 GPUs
       - Node Count: 2
       - Labels: `node-type=gpu-optimized`
       
     - **Memory-Optimized Pool**:
       - Machine Type: Memory-Optimized
       - Node Plan: 16 GB RAM or higher
       - Node Count: 2
       - Labels: `node-type=memory-optimized`
       
4. Enable the NVIDIA GPU Operator (if using GPU nodes)
5. Name your cluster (e.g., `kai-ml-cluster`)
6. Click "Create Cluster"

#### Connecting to the Cluster

1. Once the cluster is created, download the kubeconfig file
2. Set up kubectl to use this config:
   ```bash
   export KUBECONFIG=~/Downloads/kai-ml-cluster-kubeconfig.yaml
   ```
3. Verify connection:
   ```bash
   kubectl get nodes
   kubectl get nodes --show-labels
   ```

#### Installing Argo Workflows

Argo Workflows is required for pipeline orchestration:

```bash
# Install Argo Workflows controller and UI
kubectl create namespace argo
kubectl apply -n argo -f https://github.com/argoproj/argo-workflows/releases/download/v3.4.5/install.yaml

# Configure Argo to work with the kai-ml namespace
kubectl apply -f kubernetes/argo-rbac.yaml
```

#### Deploying with the Deployment Script

The KAI ML Platform includes a dedicated deployment script that handles all aspects of the deployment process:

```bash
# Basic deployment
./kubernetes/deploy.sh

# With custom parameters
./kubernetes/deploy.sh --context=kai-ml-cluster --registry=your-registry.example.com --tag=v1.2.3
```

The script supports several options:
- `--context=<context>`: Kubernetes context to use
- `--registry=<url>`: Container registry URL
- `--tag=<tag>`: Image tag for all components
- `--dry-run`: Validate configurations without applying changes
- `--skip-infrastructure`: Skip infrastructure components
- `--skip-coordinator`: Skip coordinator service components
- `--skip-workflows`: Skip workflow templates

#### Deployment Components

The deployment includes the following main components:

1. **Infrastructure**:
   - Namespace and resource quotas (`kubernetes/infrastructure/namespace.yaml`)
   - Priority classes (`kubernetes/infrastructure/priority-classes.yaml`)
   - Node pools (`kubernetes/infrastructure/node-pools.yaml`)
   - Monitoring (`kubernetes/infrastructure/monitoring.yaml`)
   - Caching (`kubernetes/infrastructure/caching.yaml`)

2. **Coordinator Service** (`kubernetes/coordinator/`):
   - Central orchestration component
   - Manages task queues and workflow scheduling
   - Interfaces with Argo Workflows
   - Exposed via service and potentially ingress

3. **Distributed Processing** (`kubernetes/distributed-processing/`):
   - Handles distributed workloads
   - Optional component for high-throughput processing

4. **Mobile Optimization** (`kubernetes/mobile-optimization/`):
   - Optional component for mobile optimization
   - Includes LOD generation and Draco compression

5. **WASM Compiler** (`kubernetes/wasm-compiler/`):
   - Optional component for WebAssembly compilation

6. **Workflow Templates** (`kubernetes/workflows/`):
   - Argo workflow templates for ML pipelines
   - 3D reconstruction template (`3d-reconstruction-template.yaml`)
   - MultiModal Pattern Recognition template (`multimodal-pattern-recognition-template.yaml`)
   - Domain-Specific Networks template (`domain-specific-networks-template.yaml`)

#### Enhanced Deployment Script

The `kubernetes/deploy.sh` script has been refactored to provide better environment support, backup capabilities, and rollback features:

```bash
# Deploy to staging environment
./kubernetes/deploy.sh --context=kai-staging-cluster --registry=your-registry.example.com --tag=v1.2.3 --env=staging

# Deploy to production environment
./kubernetes/deploy.sh --context=kai-production-cluster --registry=your-registry.example.com --tag=v1.2.3 --env=production

# Rollback to a previous deployment (e.g., after a failed deployment)
./kubernetes/deploy.sh --context=kai-production-cluster --env=production --rollback=20250412153022
```

The enhanced script includes:

1. **Environment-Specific Configuration**:
   - Uses the `--env` parameter to specify target environment
   - Applies environment-specific variables (replicas, resources, etc.)
   - Supports different namespace per environment (e.g., `kai-system-staging` vs `kai-system`)

2. **Automatic Backup**:
   - Creates timestamped backups of all resources before applying changes
   - Stores backups in `./kubernetes/backups/<environment>/<timestamp>/`
   - Maintains the 5 most recent backups for each environment

3. **Rollback Capability**:
   - Provides the `--rollback` parameter to restore to a previous state
   - Applies backed-up manifests in the correct order
   - Provides confirmation and verification of rollback success

4. **Environment-Specific Directories**:
   - Checks for environment-specific configuration files first:
   ```
   kubernetes/
   ├── coordinator/
   │   ├── staging/        # Staging-specific configs
   │   ├── production/     # Production-specific configs
   │   └── *.yaml          # Default configs used if env-specific not found
   ├── infrastructure/
   │   ├── staging/
   │   └── production/
   └── workflows/
       ├── staging/
       └── production/
   ```
   - Falls back to default configurations when environment-specific ones don't exist

5. **Deployment Health Verification**:
   - Verifies that pods reach Running state
   - Checks service availability
   - Provides detailed deployment status information

#### Helm-Based Deployment

In addition to the script-based deployment, the KAI Platform now supports Helm charts for more maintainable and consistent Kubernetes deployments. This approach provides significant advantages in configuration management, environment isolation, and deployment reliability.

##### Helm Chart Structure

The platform uses a modular Helm chart structure with parent-child relationships:

```
helm-charts/
├── kai/                    # Main parent chart
│   ├── Chart.yaml          # Chart metadata with dependencies
│   ├── values.yaml         # Default values
│   ├── values-staging.yaml # Staging environment values
│   └── values-production.yaml # Production environment values
└── coordinator/            # Sample subchart
    ├── Chart.yaml
    ├── values.yaml
    └── templates/          # Resource templates
        ├── _helpers.tpl    # Reusable template snippets
        ├── deployment.yaml # Deployment template
        ├── service.yaml    # Service template
        ├── hpa.yaml        # Autoscaling template
        ├── pdb.yaml        # Pod Disruption Budget template
        ├── rbac.yaml       # RBAC resources template
        └── configmap.yaml  # ConfigMap template
```

##### Deploying with Helm Charts

A Helm-based deployment script `helm-charts/helm-deploy.sh` provides a user-friendly interface:

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

##### Resource Allocation by Environment

Resource allocation is automatically adjusted based on the target environment, whether using the script-based deployment or Helm charts:

| Resource | Staging | Production |
|----------|---------|------------|
| API Server Replicas | 1 | 3 |
| Coordinator Replicas | 1 | 3 |
| Min HPA Replicas | 1 | 2 |
| Max HPA Replicas | 5 | 10 |
| PDB Min Available | "1" | "2" |
| Resource Multiplier | 1x | 2x |
| Namespace | kai-system-staging | kai-system |

#### Flux GitOps-Based Deployment

The KAI Platform now supports a GitOps approach to deployment using Flux CD, which provides a fully automated, declarative way to manage Kubernetes resources.

##### Installing Flux on the Cluster

1. **Install the Flux CLI**:
   ```bash
   # On macOS with Homebrew
   brew install fluxcd/tap/flux

   # On Linux
   curl -s https://fluxcd.io/install.sh | sudo bash
   ```

2. **Check Kubernetes cluster compatibility**:
   ```bash
   flux check --pre
   ```

3. **Bootstrap Flux on your cluster**:
   ```bash
   # Generate a GitHub personal access token with 'repo' permissions
   export GITHUB_TOKEN=<your-github-token>

   # Bootstrap Flux on the staging cluster
   flux bootstrap github \
     --owner=kai-platform \
     --repository=kai-gitops \
     --branch=main \
     --path=clusters/staging \
     --personal \
     --kubeconfig=$HOME/.kube/kai-staging-config

   # Bootstrap Flux on the production cluster
   flux bootstrap github \
     --owner=kai-platform \
     --repository=kai-gitops \
     --branch=main \
     --path=clusters/production \
     --personal \
     --kubeconfig=$HOME/.kube/kai-production-config
   ```

##### GitOps Repository Structure

The KAI Platform uses a structured GitOps repository with separate configurations for staging and production environments:

```
flux/
├── clusters/
│   ├── staging/            # Staging environment
│   │   ├── flux-system/    # Flux core components
│   │   ├── sources/        # Source definitions (Helm repos, Git repos)
│   │   ├── releases/       # Application deployments
│   │   └── kustomization.yaml
│   └── production/         # Production environment (similar structure)
```

##### Creating HelmRelease Resources

Example HelmRelease resource:

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
        namespace: flux-system
      interval: 1m
  values:
    replicaCount: 3
    image:
      repository: "registry.example.com/coordinator"
      tag: "v1.2.3"
  install:
    remediation:
      retries: 3
  upgrade:
    remediation:
      remediateLastFailure: true
    cleanupOnFail: true
  rollback:
    timeout: 5m
    cleanupOnFail: true
  targetNamespace: kai-system
  releaseName: coordinator
```

##### CI/CD Integration with Flux

The CI/CD pipeline integrates with Flux through a dedicated job that updates the GitOps repository with new image versions after building and testing.

### Docker Configuration and Optimization

The Kai platform uses optimized Docker configurations to improve build speed, reduce image size, and enhance security.

#### Optimized Dockerfiles

##### API Server (Dockerfile.api)

Key optimizations:
- Updated from Node.js 16 to Node.js 20 (Alpine variant)
- Multi-stage build to reduce final image size
- Dependency caching for faster builds
- BuildKit features for optimal caching
- Non-root user execution for security
- Health checks and proper signal handling

##### Centralized Base Images

The platform uses centralized base images to ensure consistency:

1. **ML Base Image (Dockerfile.ml-base)**
   - TensorFlow GPU-enabled base image
   - Common ML dependencies
   - Standard user setup and permissions

2. **Node.js Base Image (Dockerfile.node-base)**
   - Alpine-based Node.js image
   - Common Node.js dependencies
   - Standard security configuration

3. **Python Base Image (Dockerfile.python-base)**
   - Python slim image for non-GPU services
   - Common Python dependencies
   - Consistent environment setup

#### Build Context Optimization

For optimal Docker build performance, the `.dockerignore` file excludes:
- Version control directories
- Development and build files (node_modules, __pycache__)
- Test and documentation directories
- Editor/IDE configuration files

#### Best Practices Implemented

1. **Layer Efficiency**
   - Fewer, more purposeful layers
   - Logical grouping of commands to optimize caching
   - RUN commands combined with `&&` where appropriate

2. **Cache Utilization**
   - Dependencies installed separately from application code
   - Package files copied first to leverage cache for dependencies
   - BuildKit cache mounts used for node_modules and pip caches

3. **Image Size Reduction**
   - Multi-stage builds
   - Alpine-based images where appropriate
   - Cleanup of temporary files and package caches
   - Only production dependencies in final image

4. **Security**
   - Non-root user execution
   - Explicit EXPOSE statements for ports
   - Fixed dependency versions
   - Regular base image updates

5. **Process Supervision**
   - Proper signal handling
   - Health checks integrated
   - Explicit entrypoints and commands

## Deployment Process

### Environment Configuration

Create a single `.env` file in the root directory for production:

**Root .env file (.env.production)**
```
# Node Environment
NODE_ENV=production

# Server Configuration
PORT=3000
API_BASE_URL=https://api.yourdomain.com
CORS_ORIGIN=https://yourdomain.com
LOG_LEVEL=info

# Database Configuration
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/kai

# Authentication
JWT_SECRET=your-very-secure-jwt-secret

# Storage Configuration
S3_BUCKET=kai-production
S3_REGION=us-east-1
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key

# Supabase Configuration
SUPABASE_URL=https://your-supabase-project.supabase.co
SUPABASE_KEY=your-supabase-key
SUPABASE_STORAGE_BUCKET=materials

# ML Configuration
MODEL_PATH=/opt/kai/models
TENSORFLOW_SERVING_URL=http://tensorflow-serving:8501
VECTOR_INDEX_PATH=/opt/kai/indexes
GPU_ENABLED=true
BATCH_SIZE=8

# MCP Server Configuration
MCP_SERVER_URL=http://mcp-server:8000
USE_MCP_SERVER=true
MODEL_CACHE_SIZE=5
AGENT_INTEGRATION_ENABLED=true
MAX_BATCH_SIZE=16

# Rate Limiting Configuration
DEFAULT_RATE_LIMIT=100
DEFAULT_RATE_WINDOW_MS=60000
AUTH_RATE_LIMIT=20
AUTH_RATE_WINDOW_MS=60000
ML_RATE_LIMIT=10
ML_RATE_WINDOW_MS=60000
AGENT_RATE_LIMIT=30
AGENT_RATE_WINDOW_MS=60000
PDF_RATE_LIMIT=5
PDF_RATE_WINDOW_MS=600000

# Frontend Configuration
GATSBY_API_URL=https://api.yourdomain.com
GATSBY_SUPABASE_URL=https://your-supabase-project.supabase.co
GATSBY_SUPABASE_ANON_KEY=your-supabase-anon-key
GATSBY_STORAGE_URL=https://your-cdn.com
GATSBY_DEFAULT_LOCALE=en
GATSBY_GOOGLE_ANALYTICS_ID=your-ga-id
```

**New Features Environment Variables**:

```
# Notification System
NOTIFICATION_SERVICE_ENABLED=true
DEFAULT_NOTIFICATION_CHANNEL=in-app
EMAIL_PROVIDER=sendgrid|mailchimp|ses
EMAIL_API_KEY=${SECRET_REF}
SMS_PROVIDER=twilio|nexmo
SMS_API_KEY=${SECRET_REF}
WEBHOOK_RETRY_ATTEMPTS=3
WEBHOOK_TIMEOUT_MS=5000

# Parameter Registry
PARAM_REGISTRY_ENABLED=true
PARAM_STORAGE_TYPE=supabase|postgres
PARAM_DB_CONNECTION=${SECRET_REF}
PARAM_HISTORY_RETENTION_DAYS=90
DEFAULT_PARAMETER_SET=standard
SIMILARITY_THRESHOLD=0.75

# ML Features
GPU_SCALING_ENABLED=true
MIN_GPU_CLASS=L40S
MULTIMODAL_MODEL_VERSION=v2.1
DOMAIN_NETWORKS_ENABLED=true
DEFAULT_QUALITY_TIER=standard
BATCH_SIZE_LIMIT=8
```

For monitoring in production, add:

```
# Logging Configuration
LOG_LEVEL=info
LOG_FORMAT=json
LOG_TO_FILE=true
LOG_FILE_PATH=/var/log/kai/server.log
LOG_ROTATION_INTERVAL=1d
LOG_MAX_FILES=30

# Monitoring Configuration
ENABLE_DETAILED_METRICS=true
METRICS_REPORTING_INTERVAL=60000
ENABLE_PERFORMANCE_MONITORING=true

# Health Check Configuration
HEALTH_CHECK_INTERVAL=30000
COMPONENT_TIMEOUT_MS=5000
```

### Database Setup and Migration

#### Database Setup

1. Create MongoDB database with collections:
   ```
   materials
   collections
   versions
   relationships
   search_indexes
   pdf_jobs
   crawler_jobs
   users
   ```

2. Create indexes for performance:
   ```javascript
   // Materials Collection Indexes
   db.materials.createIndex({ "id": 1 }, { unique: true })
   db.materials.createIndex({ "name": 1 })
   db.materials.createIndex({ "materialType": 1 })
   db.materials.createIndex({ "collectionId": 1 })
   db.materials.createIndex({ "tags": 1 })
   db.materials.createIndex({ "$**": "text" })
   
   // Versions Collection Indexes
   db.versions.createIndex({ "entityId": 1, "entityType": 1 })
   db.versions.createIndex({ "createdAt": -1 })
   
   // Queue Collections Indexes
   db.pdf_jobs.createIndex({ "status": 1, "priority": -1, "createdAt": 1 })
   db.crawler_jobs.createIndex({ "status": 1, "priority": -1, "createdAt": 1 })
   ```

#### Database Migration System

Kai uses a robust database migration system to manage schema changes across environments:

##### Migration Architecture

```
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│                     │     │                     │     │                     │
│  CI/CD Pipeline     │────▶│  Migration Script   │────▶│  Supabase Database  │
│                     │     │                     │     │                     │
└─────────────────────┘     └─────────────────────┘     └─────────────────────┘
         │                          │                          │
         │                          │                          │
         ▼                          ▼                          ▼
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│                     │     │                     │     │                     │
│  Runs before        │     │  Reads SQL files    │     │  schema_migrations  │
│  Application Deploy │     │  from migrations/   │     │  tracking table     │
│                     │     │                     │     │                     │
└─────────────────────┘     └─────────────────────┘     └─────────────────────┘
```

##### Migration Files

Migration files are SQL scripts stored in `packages/server/src/services/supabase/migrations/` and follow a sequential naming convention:

```
001_initial_schema.sql
002_hybrid_search.sql
003_dataset_upload.sql
004_material_metadata_fields.sql
004_message_broker.sql
...
```

##### Migration Tracking

Migrations are tracked in a `schema_migrations` table in the Supabase database:

```sql
CREATE TABLE schema_migrations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

This table records which migrations have already been applied to prevent duplicate execution.

##### Migration Script

The system uses a TypeScript migration script (`packages/server/scripts/run-migrations.ts`) that:

1. Connects to the Supabase database using environment credentials
2. Creates the `schema_migrations` table if it doesn't exist
3. Retrieves already applied migrations from the table
4. Compares available migrations with applied ones to identify pending migrations
5. Applies pending migrations in sequential order
6. Records successful migrations in the tracking table

##### Integration with CI/CD Pipeline

Database migrations are integrated into the CI/CD pipeline to ensure they run automatically before deploying application changes:

1. In the GitHub Actions workflow (`.github/workflows/deploy.yml`), a dedicated step runs migrations before the Kubernetes deployment:

```yaml
# Run database migrations before deployment
- name: Setup Node.js for migrations
  uses: actions/setup-node@v3
  with:
    node-version: ${{ env.NODE_VERSION }}
    
- name: Install dependencies
  run: yarn install --frozen-lockfile
  
- name: Run database migrations (Staging)
  run: |
    echo "Running database migrations for staging environment..."
    yarn tsc -p packages/server/tsconfig.json
    cd packages/server
    node dist/scripts/run-migrations.js
  env:
    SUPABASE_URL: ${{ secrets.SUPABASE_URL_STAGING }}
    SUPABASE_KEY: ${{ secrets.SUPABASE_KEY_STAGING }}
    NODE_ENV: staging
```

### Adding Tables for New Features

For the notification and webhook system, run these additional migrations:

```sql
-- Run notification tables migration
\i notification-tables.sql

-- Run webhook tables migration
\i webhooks.sql

-- Run push notifications migration
\i push-notifications.sql
```

For the parameter registry system:

```sql
-- Run parameter registry migration
\i parameter-registry.sql
```

### Build Process

**Backend Services**
```bash
# Build API server
cd packages/server
yarn build

# Build ML services TypeScript wrapper
cd packages/ml
yarn build
```

**Frontend Applications**
```bash
# Build client app
cd packages/client
yarn build

# Build admin app
cd packages/admin
yarn build
```

### Containerization

**Dockerfile for API Server**
```dockerfile
FROM node:16-alpine

WORKDIR /app

COPY packages/shared/dist ./packages/shared/dist
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/dist ./packages/server/dist
COPY packages/server/package.json ./packages/server/
COPY package.json yarn.lock ./

ENV NODE_ENV=production

RUN yarn install --production --frozen-lockfile

EXPOSE 3000

CMD ["node", "packages/server/dist/server.js"]
```

**Dockerfile for ML Services**
```dockerfile
FROM tensorflow/tensorflow:2.9.1-gpu

WORKDIR /app

COPY packages/ml/python /app/python
COPY packages/ml/dist /app/dist
COPY packages/ml/package.json /app/

RUN apt-get update && apt-get install -y \
    build-essential \
    python3-pip \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

RUN pip3 install --no-cache-dir -r /app/python/requirements.txt

EXPOSE 5000

CMD ["python3", "/app/python/server.py"]
```

**Dockerfile for MCP Server**
```dockerfile
FROM tensorflow/tensorflow:2.9.1-gpu

WORKDIR /app

COPY packages/ml/python/mcp_server.py /app/
COPY packages/ml/python/requirements.txt /app/

RUN apt-get update && apt-get install -y \
    build-essential \
    python3-pip \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

RUN pip3 install --no-cache-dir -r /app/requirements.txt
RUN pip3 install --no-cache-dir fastapi uvicorn python-multipart

EXPOSE 8000

CMD ["uvicorn", "mcp_server:app", "--host", "0.0.0.0", "--port", "8000"]
```

Build and push to container registry:
```bash
# Build the base images first
docker build -t registry.example.com/kai/node-base:latest -f Dockerfile.node-base .
docker build -t registry.example.com/kai/python-base:latest -f Dockerfile.python-base .
docker build -t registry.example.com/kai/ml-base:latest -f Dockerfile.ml-base .

# Build service images
docker build -t registry.example.com/kai/api-server:latest -f Dockerfile.api .
docker build -t registry.example.com/kai/coordinator-service:latest -f packages/coordinator/Dockerfile.coordinator .
docker build -t registry.example.com/kai/mcp-server:latest -f packages/ml/Dockerfile.mcp .

# Build ML worker images
docker build -t registry.example.com/kai/quality-assessment:latest -f packages/ml/python/Dockerfile.quality-assessment .
docker build -t registry.example.com/kai/image-preprocessing:latest -f packages/ml/python/Dockerfile.image-preprocessing .
docker build -t registry.example.com/kai/colmap-sfm:latest -f packages/ml/python/Dockerfile.colmap-sfm .
docker build -t registry.example.com/kai/point-cloud:latest -f packages/ml/python/Dockerfile.point-cloud .
docker build -t registry.example.com/kai/model-generator:latest -f packages/ml/python/Dockerfile.model-generator .
docker build -t registry.example.com/kai/diffusion-nerf:latest -f packages/ml/python/Dockerfile.diffusion-nerf .
docker build -t registry.example.com/kai/nerf-mesh-extractor:latest -f packages/ml/python/Dockerfile.nerf-mesh-extractor .
docker build -t registry.example.com/kai/format-converter:latest -f packages/ml/python/Dockerfile.format-converter .
docker build -t registry.example.com/kai/workflow-finalizer:latest -f packages/ml/python/Dockerfile.workflow-finalizer .

# Build new feature images
docker build -t registry.example.com/kai/parameter-registry:latest -f packages/server/Dockerfile.parameter-registry .
docker build -t registry.example.com/kai/notification-service:latest -f packages/server/Dockerfile.notification-service .
docker build -t registry.example.com/kai/webhook-service:latest -f packages/server/Dockerfile.webhook-service .
docker build -t registry.example.com/kai/multimodal-pattern-recognition:latest -f packages/ml/python/Dockerfile.multimodal-pattern-recognition .
docker build -t registry.example.com/kai/domain-specific-networks:latest -f packages/ml/python/Dockerfile.domain-specific-networks .

# Push all images to registry
docker push registry.example.com/kai/api-server:latest
docker push registry.example.com/kai/coordinator-service:latest
docker push registry.example.com/kai/quality-assessment:latest
# ... and so on for all images
```

### Kubernetes Deployment

#### Deployment Order

For optimal deployment with minimal service disruption, follow this order:

1. **Infrastructure Updates:**
   - Apply GPU configuration updates
   - Update node pools if necessary
   - Configure persistent storage

2. **Coordinator Updates:**
   - Update coordinator configuration (config.yaml)
   - Update coordinator deployment (deployment.yaml)
   - Apply updated resource allocations
   - Restart coordinator service

3. **Core Services:**
   - Deploy Parameter Registry service
   - Deploy Notification System service

4. **ML Components:**
   - Deploy Domain-Specific Networks
   - Deploy MultiModal Pattern Recognition service

5. **Integration Components:**
   - Deploy Webhook service
   - Update workflow templates
   - Configure integrations with existing systems

#### Coordinator Service Updates

The coordinator service has been updated to support the new features with the following changes:

##### Configuration Updates (config.yaml)

1. **Quality Tiers**
   - Added new "premium" and "enterprise" tiers with higher resources
   - Updated GPU class specifications for high-performance nodes

2. **Notification System Integration**
   - Added configuration for notification delivery
   - Configured event types that trigger notifications
   - Setup webhook integration points

3. **Parameter Registry Integration**
   - Added endpoint configuration
   - Configured similarity threshold and retention policies
   - Setup gRPC communication channel

4. **ML Feature Management**
   - Added configuration for multimodal pattern recognition
   - Added configuration for domain-specific networks
   - Setup workflow template references

5. **GPU Resource Management**
   - Added GPU class specifications
   - Configured model-to-GPU mapping
   - Setup autoscaling parameters

##### Deployment Updates (deployment.yaml)

1. **Resource Allocation Increases**
   - CPU: 500m → 1 core (requests), 2 → 4 cores (limits)
   - Memory: 512Mi → 1Gi (requests), 2Gi → 4Gi (limits)

2. **Environment Variables**
   - Added connectivity parameters for new services
   - Configured feature flags for new components
   - Setup workflow template paths

### Canary Deployments

The KAI Platform supports automated canary deployments with health monitoring and automatic promotion or rollback based on metrics. This provides a safer way to roll out changes by testing them on a small subset of traffic before full deployment.

#### Using Canary Deployments

To deploy using the canary approach:

```bash
# Basic canary deployment (10% traffic)
./helm-charts/helm-deploy.sh --context=kai-production-cluster --env=production --canary --tag=v1.2.3

# Advanced canary configuration
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

The canary deployment will:
1. Deploy the new version alongside the existing version
2. Route a percentage of traffic to the new version (10% by default)
3. Monitor health metrics for the specified period (10 minutes by default)
4. Automatically promote the canary to production if health checks pass
5. Automatically roll back if health checks fail

#### Configuration Options

| Option | Description | Default |
|--------|-------------|---------|
| `--canary` | Enable canary deployment | - |
| `--canary-weight=<pct>` | Percentage of traffic to route to canary | 10% |
| `--canary-time=<min>` | Minutes to analyze canary before promotion | 10 minutes |
| `--health-threshold=<pct>` | Success rate threshold for promotion | 95% |
| `--critical-services=<svc>` | Comma-separated list of services to monitor | api-server,coordinator-service |

#### Health Monitoring

The system monitors several health metrics during the canary period:
- Success rate (percentage of non-5xx responses)
- Latency metrics
- Resource utilization

### Vercel Deployment

Vercel is used to deploy the Next.js admin panel and the Gatsby client frontend.

#### Admin Panel Deployment (Next.js)

1. Log in to [Vercel](https://vercel.com/)
2. Click "Add New" → "Project"
3. Import your GitHub repository
4. Configure the project:
   - Framework Preset: Next.js
   - Root Directory: `packages/admin`
   - Build Command: `yarn build`
   - Output Directory: `out` (default)
   - Install Command: `yarn install`
5. Set up environment variables (see [Environment Configuration](#environment-configuration) section)
6. Click "Deploy"

#### Client App Deployment (Gatsby)

1. Log in to [Vercel](https://vercel.com/)
2. Click "Add New" → "Project"
3. Import your GitHub repository (if not already imported)
4. Configure the project:
   - Framework Preset: Gatsby
   - Root Directory: `packages/client`
   - Build Command: `yarn build`
   - Output Directory: `public` (default)
   - Install Command: `yarn install`
5. Set up environment variables (see [Environment Configuration](#environment-configuration) section)
6. Click "Deploy"

#### Custom Domain Configuration

1. In the Vercel project settings, go to Domains
2. Add your custom domain(s):
   - Admin Panel: `admin.kai.yourdomain.com`
   - Client App: `kai.yourdomain.com`
3. Configure DNS settings as instructed by Vercel

#### Vercel Project Settings

For both projects, configure these additional settings:

1. **Build & Development Settings**:
   - Node.js Version: 16.x (or higher if required)
   - Include source files outside of the Root Directory: Yes
   - Install Command: `cd ../.. && yarn install`

2. **Environment Variables**:
   - Add all required environment variables (see [Environment Configuration](#environment-configuration) section)

### Supabase Deployment

Supabase is used for authentication, realtime features, and queue management.

#### Creating a Supabase Project

1. Sign in to [Supabase](https://app.supabase.io/)
2. Click "New Project"
3. Enter project details:
   - Name: `kai-production` (or your preferred name)
   - Database Password: Generate a strong password
   - Region: Choose the region closest to your users
4. Click "Create new project"

#### Setting up Database Schema

After your project is created, you'll need to set up the database schema. You can do this using the SQL editor in the Supabase dashboard.

1. Navigate to the SQL editor
2. Run the migration scripts in order:

```sql
-- Create necessary tables for queue management
CREATE TABLE queue_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_type VARCHAR NOT NULL,
  status VARCHAR NOT NULL DEFAULT 'pending',
  payload JSONB NOT NULL,
  result JSONB,
  error TEXT,
  priority INT NOT NULL DEFAULT 0,
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Create index for job processing
CREATE INDEX queue_jobs_status_priority_created_idx ON queue_jobs (status, priority DESC, created_at);

-- Create realtime publications for queue updates
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR TABLE queue_jobs;
COMMIT;

-- Enable Row Level Security
ALTER TABLE queue_jobs ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users
CREATE POLICY "Authenticated users can view all jobs" 
  ON queue_jobs FOR SELECT 
  TO authenticated 
  USING (true);

-- Create policy for service role to perform all operations
CREATE POLICY "Service role can perform all operations" 
  ON queue_jobs FOR ALL 
  TO service_role 
  USING (true);
```

#### Configuring Authentication

1. In the Supabase dashboard, go to Authentication → Settings
2. Configure the following settings:
   - Site URL: Your production frontend URL (e.g., `https://kai.yourdomain.com`)
   - Enable Email Auth: Yes
   - Enable Phone Auth: Optional
   - Enable OAuth Providers: As needed (Google, GitHub, etc.)

#### Creating Service Role API Keys

1. In the Supabase dashboard, go to Settings → API
2. Copy the following values:
   - URL: Your Supabase project URL
   - `anon` public key: For client-side authentication
   - `service_role` key: For server-side operations (**keep this secure**)

#### Enabling Realtime

1. In the Supabase dashboard, go to Database → Replication
2. Ensure the `supabase_realtime` publication is configured properly
3. Go to Settings → API → Realtime and enable it

## CI/CD Pipeline

The KAI Platform uses GitHub Actions for continuous integration and deployment. The enhanced CI/CD pipeline reduces code duplication, improves efficiency, and adds automatic rollback capabilities.

### Optimized Workflow Structure

The CI/CD workflow is defined in `.github/workflows/deploy.yml` with the following optimizations:

1. **Matrix-Based Docker Builds**: All images are built in parallel using a matrix strategy
2. **Unified Deployment Job**: A single job handles both staging and production deployments
3. **Automatic Environment Detection**: Environment is determined from branch or manual trigger
4. **Dynamic Configuration**: Environment-specific settings applied via variables
5. **Health Monitoring**: Automatic verification and rollback if deployments fail

```yaml
name: Kai Platform CI/CD Pipeline

on:
  push:
    branches: [main, staging, development]
  pull_request:
    branches: [main, staging, development]
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to deploy to'
        required: true
        default: 'staging'
        type: choice
        options:
          - staging
          - production

env:
  NODE_VERSION: '16'
  PYTHON_VERSION: '3.9'
  DOCKER_BUILDKIT: '1'

jobs:
  # Build and test job runs on all branches
  build-and-test:
    name: Build and Test
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3
        
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'yarn'
          
      - name: Install dependencies
        run: yarn install --frozen-lockfile
        
      - name: Run linting
        run: yarn lint
        
      - name: Run unit tests
        run: yarn test
        
      - name: Build packages
        run: yarn build
        
      - name: Upload build artifacts
        uses: actions/upload-artifact@v3
        with:
          name: build-artifacts
          path: |
            packages/*/dist
            packages/client/public
            packages/admin/out
          retention-days: 1

  # Build Docker images with matrix strategy
  build-docker-images:
    name: Build Docker Images
    needs: build-and-test
    if: |
      (github.ref == 'refs/heads/staging') || 
      (github.ref == 'refs/heads/main') || 
      (github.event_name == 'workflow_dispatch')
    runs-on: ubuntu-latest
    strategy:
      matrix:
        include:
          # Main services
          - name: api-server
            dockerfile: ./Dockerfile.api
            context: .
          - name: coordinator-service
            dockerfile: ./packages/coordinator/Dockerfile.coordinator
            context: .
          # ML workers
          - name: quality-assessment
            dockerfile: ./packages/ml/python/Dockerfile.quality-assessment
            context: .
          - name: image-preprocessing
            dockerfile: ./packages/ml/python/Dockerfile.image-preprocessing
            context: .
          - name: colmap-sfm
            dockerfile: ./packages/ml/python/Dockerfile.colmap-sfm
            context: .
          # Additional workers defined similarly
    steps:
      - name: Determine environment
        id: env
        run: |
          if [[ "${{ github.ref }}" == "refs/heads/main" || "${{ github.event.inputs.environment }}" == "production" ]]; then
            echo "DEPLOY_ENV=production" >> $GITHUB_ENV
            echo "TAG_SUFFIX=latest" >> $GITHUB_ENV
          else
            echo "DEPLOY_ENV=staging" >> $GITHUB_ENV
            echo "TAG_SUFFIX=staging" >> $GITHUB_ENV
          fi

      - name: Checkout code
        uses: actions/checkout@v3

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2

      - name: Login to Container Registry
        uses: docker/login-action@v2
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}
          registry: ${{ secrets.DOCKER_REGISTRY }}

      - name: Build and push image
        uses: docker/build-push-action@v4
        with:
          context: ${{ matrix.context }}
          file: ${{ matrix.dockerfile }}
          push: true
          tags: |
            ${{ secrets.DOCKER_REGISTRY }}/${{ secrets.DOCKER_USERNAME }}/kai-${{ matrix.name }}:${{ github.sha }}
            ${{ secrets.DOCKER_REGISTRY }}/${{ secrets.DOCKER_USERNAME }}/kai-${{ matrix.name }}:${{ env.TAG_SUFFIX }}
          cache-from: type=registry,ref=${{ secrets.DOCKER_REGISTRY }}/${{ secrets.DOCKER_USERNAME }}/kai-${{ matrix.name }}:${{ env.TAG_SUFFIX }}-cache
          cache-to: type=registry,ref=${{ secrets.DOCKER_REGISTRY }}/${{ secrets.DOCKER_USERNAME }}/kai-${{ matrix.name }}:${{ env.TAG_SUFFIX }}-cache,mode=max
          build-args: |
            BUILDKIT_INLINE_CACHE=1
            ENVIRONMENT=${{ env.DEPLOY_ENV }}

  # Unified deployment job for both staging and production
  deploy:
    name: Deploy to ${{ github.event.inputs.environment || (github.ref == 'refs/heads/main' && 'production' || 'staging') }}
    needs: build-docker-images
    if: |
      (github.ref == 'refs/heads/staging') || 
      (github.ref == 'refs/heads/main') || 
      (github.event_name == 'workflow_dispatch')
    runs-on: ubuntu-latest
    concurrency:
      group: ${{ github.event.inputs.environment || (github.ref == 'refs/heads/main' && 'production' || 'staging') }}_environment
      cancel-in-progress: false
    steps:
      - name: Determine environment
        id: env
        run: |
          if [[ "${{ github.ref }}" == "refs/heads/main" || "${{ github.event.inputs.environment }}" == "production" ]]; then
            echo "DEPLOY_ENV=production" >> $GITHUB_ENV
            echo "KUBE_CONTEXT=kai-production-cluster" >> $GITHUB_ENV
            echo "API_URL=https://api.kai.yourdomain.com" >> $GITHUB_ENV
            echo "SUPABASE_URL=${{ secrets.SUPABASE_URL_PRODUCTION }}" >> $GITHUB_ENV
            echo "SUPABASE_KEY=${{ secrets.SUPABASE_KEY_PRODUCTION }}" >> $GITHUB_ENV
            echo "VERCEL_ARGS=--prod" >> $GITHUB_ENV
            echo "TEST_SCRIPT=test:smoke" >> $GITHUB_ENV
          else
            echo "DEPLOY_ENV=staging" >> $GITHUB_ENV
            echo "KUBE_CONTEXT=kai-staging-cluster" >> $GITHUB_ENV
            echo "API_URL=https://api-staging.kai.yourdomain.com" >> $GITHUB_ENV
            echo "SUPABASE_URL=${{ secrets.SUPABASE_URL_STAGING }}" >> $GITHUB_ENV
            echo "SUPABASE_KEY=${{ secrets.SUPABASE_KEY_STAGING }}" >> $GITHUB_ENV
            echo "VERCEL_ARGS=" >> $GITHUB_ENV
            echo "TEST_SCRIPT=test:integration" >> $GITHUB_ENV
          fi

      # ... more deployment steps ...
      
      # Run database migrations before deployment
      - name: Setup Node.js for migrations
        uses: actions/setup-node@v3
        with:
          node-version: ${{ env.NODE_VERSION }}
          
      - name: Install dependencies
        run: yarn install --frozen-lockfile
        
      - name: Run database migrations
        run: |
          echo "Running database migrations for ${{ env.DEPLOY_ENV }} environment..."
          yarn tsc -p packages/server/tsconfig.json
          cd packages/server
          node dist/scripts/run-migrations.js
        env:
          SUPABASE_URL: ${{ env.SUPABASE_URL }}
          SUPABASE_KEY: ${{ env.SUPABASE_KEY }}
          NODE_ENV: ${{ env.DEPLOY_ENV }}

      # Deploy to Kubernetes with enhanced script
      - name: Deploy to Kubernetes with rollback support
        id: deploy
        run: |
          echo "Applying Kubernetes manifests for ${{ env.DEPLOY_ENV }}..."
          
          # Create a backup of current deployments for potential rollback
          echo "Creating backup of current deployments..."
          kubectl --context=${{ env.KUBE_CONTEXT }} get deployments -n kai-system -o yaml > deployments-backup.yaml
          
          # Apply the deployment with environment parameter
          chmod +x ./kubernetes/deploy.sh
          ./kubernetes/deploy.sh --context=${{ env.KUBE_CONTEXT }} --registry=${{ secrets.DOCKER_REGISTRY }}/${{ secrets.DOCKER_USERNAME }} --tag=${{ github.sha }} --env=${{ env.DEPLOY_ENV }}
          
          echo "deployment_id=$(date +%s)" >> $GITHUB_OUTPUT

      # Monitor deployment health
      - name: Monitor deployment health
        id: monitor
        run: |
          echo "Monitoring deployment health for 2 minutes..."
          FAILURES=0
          
          for i in {1..12}; do
            sleep 10
            HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" ${{ env.API_URL }}/health || echo "000")
            
            if [ "$HEALTH_STATUS" != "200" ]; then
              FAILURES=$((FAILURES+1))
              echo "::warning::Health check #$i failed with status $HEALTH_STATUS"
            else
              echo "Health check #$i passed"
            fi
          done
          
          if [ "$FAILURES" -gt 3 ]; then
            echo "::error::Too many health check failures. Initiating rollback."
            echo "rollback=true" >> $GITHUB_OUTPUT
          else
            echo "Deployment stable. Health checks passed."
            echo "rollback=false" >> $GITHUB_OUTPUT
          fi

      # Rollback if necessary
      - name: Rollback deployment if needed
        if: steps.monitor.outputs.rollback == 'true'
        run: |
          echo "::warning::Initiating rollback due to health check failures!"
          kubectl --context=${{ env.KUBE_CONTEXT }} apply -f deployments-backup.yaml
```

### CI/CD Integration with Flux

For Flux GitOps deployments, the CI/CD pipeline includes a job to update the GitOps repository with new image versions:

```yaml
update-gitops:
  name: Update GitOps Repository
  needs: build-docker-images
  runs-on: ubuntu-latest
  steps:
    - name: Determine environment
      id: env
      run: |
        if [[ "${{ github.ref }}" == "refs/heads/main" || "${{ github.event.inputs.environment }}" == "production" ]]; then
          echo "DEPLOY_ENV=production" >> $GITHUB_ENV
          echo "TARGET_BRANCH=main" >> $GITHUB_ENV
        else
          echo "DEPLOY_ENV=staging" >> $GITHUB_ENV
          echo "TARGET_BRANCH=staging" >> $GITHUB_ENV
        fi

    - name: Checkout GitOps repository
      uses: actions/checkout@v3
      with:
        repository: kai-platform/kai-gitops
        path: gitops
        token: ${{ secrets.GITOPS_PAT }}
        ref: ${{ env.TARGET_BRANCH }}
        
    - name: Update image tags in HelmReleases
      run: |
        echo "Updating image tags for ${{ env.DEPLOY_ENV }} environment..."
        
        # Update coordinator release
        cd gitops/clusters/${{ env.DEPLOY_ENV }}/releases
        
        # Use yq to update the image tag in the HelmRelease
        yq e '.spec.values.image.tag = "${{ github.sha }}"' -i coordinator.yaml
        
        # Additional services can be updated similarly
        
        git config --global user.name "Kai CI Bot"
        git config --global user.email "ci-bot@kai-platform.com"
        
        git add .
        git commit -m "ci: update image tags to ${{ github.sha }} for ${{ env.DEPLOY_ENV }}" || echo "No changes to commit"
        git push
```

### GitHub Secrets and Environments

The pipeline uses the following secrets, which should be set in your GitHub repository:

- `DOCKER_USERNAME`: Docker Hub or container registry username
- `DOCKER_PASSWORD`: Docker Hub or container registry password
- `DOCKER_REGISTRY`: Container registry URL (e.g., `docker.io` or `gcr.io`)
- `KUBE_CONFIG_DATA`: Base64-encoded Kubernetes config file
- `VERCEL_TOKEN`: Vercel API token
- `VERCEL_ORG_ID`: Vercel organization ID
- `VERCEL_PROJECT_ID_CLIENT`: Vercel project ID for the client app
- `VERCEL_PROJECT_ID_ADMIN`: Vercel project ID for the admin panel
- `SUPABASE_URL_STAGING`: Supabase URL for staging
- `SUPABASE_KEY_STAGING`: Supabase service role key for staging
- `SUPABASE_URL_PRODUCTION`: Supabase URL for production
- `SUPABASE_KEY_PRODUCTION`: Supabase service role key for production
- `GITOPS_PAT`: GitHub Personal Access Token with repo scope (for Flux GitOps)
- `SLACK_WEBHOOK`: Slack webhook URL for notifications (optional)

## Development Environment

### Local Setup

#### Prerequisites

- Node.js (v16 or higher)
- Yarn (v1.22 or higher)
- MongoDB (v4.4 or higher)
- Python 3.8+ (for ML components)
- Docker and Docker Compose
- Git

#### Setup Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/kai.git
   cd kai
   ```

2. **Install dependencies**
   ```bash
   yarn install
   ```

3. **Set up environment variables**
   ```bash
   # Use the centralized .env file in the root directory
   cp .env.example .env
   
   # Configure all necessary environment variables in the .env file
   # including database connections, API keys, services URLs, etc.
   ```

4. **Set up MongoDB**
   ```bash
   # Option 1: Using Docker
   docker run -d -p 27017:27017 --name kai-mongodb mongo:5
   
   # Option 2: Using MongoDB Atlas
   # Configure your MongoDB Atlas connection string in the root .env file
   ```

5. **Set up ML environment**
   ```bash
   cd packages/ml
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

6. **Set up Supabase for the queue system**
   ```bash
   # Option 1: Using Supabase cloud
   # Create a project at https://supabase.com and configure in the root .env file
   
   # Option 2: Using Supabase local development
   npx supabase start
   ```

7. **Initialize database**
   ```bash
   yarn workspace @kai/server db:init
   ```

### Running the Development Environment

#### Starting the Backend

```bash
# Start the API server
yarn workspace @kai/server dev

# In another terminal, start the ML services
cd packages/ml
source venv/bin/activate  # On Windows: venv\Scripts\activate
python python/server.py
```

#### Starting the Frontend

```bash
# Start the client app
yarn workspace @kai/client dev

# In another terminal, start the admin app
yarn workspace @kai/admin dev
```

#### Using Docker Compose for Development

Create a `docker-compose.dev.yml` file:

```yaml
version: '3.8'

services:
  mongodb:
    image: mongo:5
    ports:
      - "27017:27017"
    volumes:
      - mongodb-data:/data/db
    environment:
      MONGO_INITDB_ROOT_USERNAME: kai
      MONGO_INITDB_ROOT_PASSWORD: password

  supabase:
    image: supabase/supabase-local
    ports:
      - "8000:8000"
    volumes:
      - supabase-data:/var/lib/postgresql/data

volumes:
  mongodb-data:
  supabase-data:
```

Start the development dependencies:

```bash
docker-compose -f docker-compose.dev.yml up -d
```

### Development Workflow

#### Using the MCP Server in Development

```bash
# Start the MCP server
cd packages/ml
source mcp-venv/bin/activate  # On Windows: mcp-venv\Scripts\activate
python python/mcp_server.py

# In your application code, enable MCP integration
# Set environment variables:
# - MCP_SERVER_URL=http://localhost:8000
# - USE_MCP_SERVER=true
```

#### Code Organization

```
packages/
├── admin/             # Admin Panel (Next.js)
├── client/            # Client App (Gatsby)
├── ml/                # Machine Learning
│   ├── python/        # Python ML code
│   └── src/           # TypeScript interfaces
├── server/            # API Server
│   ├── src/           # Source code
│   │   ├── controllers/   # API controllers
│   │   ├── middleware/    # Middleware
│   │   ├── models/        # Data models
│   │   ├── routes/        # API routes
│   │   ├── services/      # Business logic
│   │   └── utils/         # Utilities
│   └── tests/         # Tests
└── shared/            # Shared code and types
```

#### Git Workflow

1. **Branch naming convention**
   - Feature branches: `feature/feature-name`
   - Bug fix branches: `fix/bug-name`
   - Refactoring branches: `refactor/refactor-name`
   - Documentation branches: `docs/doc-name`

2. **Commit message convention**
   - Use conventional commits format: `type(scope): message`
   - Example: `feat(material-recognition): add confidence fusion algorithm`

3. **Pull Request workflow**
   - Create PR against `main` branch
   - Require at least one review
   - Pass all automated checks
   - Maintain clean commit history (rebase preferred over merge)

### Debugging

#### Backend Debugging

1. **Using Node.js Inspector**
   ```bash
   # Start API server in debug mode
   yarn workspace @kai/server dev:debug
   
   # Then connect using Chrome DevTools or VS Code
   ```

2. **Using VS Code**
   Create a `.vscode/launch.json` file:
   ```json
   {
     "version": "0.2.0",
     "configurations": [
       {
         "type": "node",
         "request": "launch",
         "name": "Debug API Server",
         "runtimeExecutable": "yarn",
         "runtimeArgs": ["workspace", "@kai/server", "dev:debug"],
         "port": 9229,
         "sourceMaps": true,
         "smartStep": true,
         "outFiles": ["${workspaceFolder}/packages/server/dist/**/*.js"]
       }
     ]
   }
   ```

#### Frontend Debugging

1. **React Developer Tools**
   - Install the browser extension
   - Use React DevTools Profiler for performance analysis

2. **Redux DevTools** (if using Redux)
   - Install the browser extension
   - Monitor state changes and actions

#### Python ML Debugging

1. **Using VS Code**
   Configure `.vscode/launch.json`:
   ```json
   {
     "version": "0.2.0",
     "configurations": [
       {
         "name": "Python: ML Server",
         "type": "python",
         "request": "launch",
         "program": "${workspaceFolder}/packages/ml/python/server.py",
         "console": "integratedTerminal",
         "env": {
           "PYTHONPATH": "${workspaceFolder}/packages/ml"
         }
       }
     ]
   }
   ```

2. **Using Python Debugger**
   ```python
   import pdb; pdb.set_trace()
   ```

### Common Development Tasks

#### Adding a New Feature

1. **Plan the feature**
   - Define requirements and acceptance criteria
   - Identify affected packages and components
   - Create design document if needed

2. **Implement the feature**
   - Create a feature branch
   - Implement code changes
   - Write tests
   - Document the feature

3. **Review and testing**
   - Create a pull request
   - Address code review feedback
   - Verify all tests pass
   - Perform manual testing

4. **Merge and deploy**
   - Merge to main branch
   - Deploy to staging environment
   - Verify in staging
   - Deploy to production

#### Adding a New API Endpoint

1. **Define the endpoint**
   - Determine HTTP method and path
   - Define request parameters and body schema
   - Define response schema and status codes

2. **Implement the endpoint**
   ```typescript
   // In packages/server/src/routes/material.routes.ts
   router.post('/materials/search', validateSearchRequest, materialController.searchMaterials);
   
   // In packages/server/src/controllers/material.controller.ts
   export const searchMaterials = async (req: Request, res: Response, next: NextFunction) => {
     try {
       const searchOptions = req.body;
       const results = await knowledgeBaseService.searchMaterials(searchOptions);
       res.json(results);
     } catch (error) {
       next(error);
     }
   };
   ```

3. **Test the endpoint**
   ```typescript
   // In packages/server/tests/routes/material.routes.test.ts
   describe('POST /materials/search', () => {
     it('should return search results for valid query', async () => {
       const response = await request(app)
         .post('/materials/search')
         .send({ query: 'ceramic', materialType: 'tile' })
         .set('Authorization', `Bearer ${testToken}`);
       
       expect(response.status).toBe(200);
       expect(response.body.materials).toBeInstanceOf(Array);
     });
   });
   ```

#### Creating a New React Component

1. **Create the component file**
   ```tsx
   // In packages/client/src/components/MaterialCard.tsx
   import React from 'react';
   
   interface MaterialCardProps {
     id: string;
     name: string;
     thumbnailUrl: string;
     manufacturer: string;
     onClick?: () => void;
   }
   
   export const MaterialCard: React.FC<MaterialCardProps> = ({
     id,
     name,
     thumbnailUrl,
     manufacturer,
     onClick
   }) => {
     return (
       <div className="material-card" onClick={onClick}>
         <img src={thumbnailUrl} alt={name} className="material-thumbnail" />
         <div className="material-info">
           <h3>{name}</h3>
           <p>{manufacturer}</p>
         </div>
       </div>
     );
   };
   ```

2. **Create component tests**
   ```tsx
   // In packages/client/src/components/__tests__/MaterialCard.test.tsx
   import React from 'react';
   import { render, screen, fireEvent } from '@testing-library/react';
   import { MaterialCard } from '../MaterialCard';
   
   describe('MaterialCard', () => {
     it('renders material information correctly', () => {
       render(
         <MaterialCard
           id="material-123"
           name="Ceramic Tile"
           thumbnailUrl="/example.jpg"
           manufacturer="Example Tiles Inc."
         />
       );
       
       expect(screen.getByText('Ceramic Tile')).toBeInTheDocument();
       expect(screen.getByText('Example Tiles Inc.')).toBeInTheDocument();
       expect(screen.getByAltText('Ceramic Tile')).toHaveAttribute('src', '/example.jpg');
     });
     
     it('calls onClick when clicked', () => {
       const handleClick = jest.fn();
       render(
         <MaterialCard
           id="material-123"
           name="Ceramic Tile"
           thumbnailUrl="/example.jpg"
           manufacturer="Example Tiles Inc."
           onClick={handleClick}
         />
       );
       
       fireEvent.click(screen.getByText('Ceramic Tile'));
       expect(handleClick).toHaveBeenCalledTimes(1);
     });
   });
   ```

#### Adding a New ML Model

1. **Prepare the model code**
   ```python
   # In packages/ml/python/models/texture_classifier.py
   import tensorflow as tf
   from tensorflow.keras import layers, models
   
   def create_texture_classifier(input_shape=(224, 224, 3), num_classes=10):
       """Create a CNN model for texture classification."""
       model = models.Sequential([
           layers.Conv2D(32, (3, 3), activation='relu', input_shape=input_shape),
           layers.MaxPooling2D((2, 2)),
           layers.Conv2D(64, (3, 3), activation='relu'),
           layers.MaxPooling2D((2, 2)),
           layers.Conv2D(128, (3, 3), activation='relu'),
           layers.MaxPooling2D((2, 2)),
           layers.Conv2D(128, (3, 3), activation='relu'),
           layers.MaxPooling2D((2, 2)),
           layers.Flatten(),
           layers.Dense(512, activation='relu'),
           layers.Dropout(0.5),
           layers.Dense(num_classes, activation='softmax')
       ])
       
       model.compile(
           optimizer='adam',
           loss='categorical_crossentropy',
           metrics=['accuracy']
       )
       
       return model
   ```

2. **Create a model trainer**
   ```python
   # In packages/ml/python/trainers/texture_trainer.py
   import os
   import numpy as np
   import tensorflow as tf
   from models.texture_classifier import create_texture_classifier
   
   def train_texture_classifier(dataset_path, output_dir, epochs=10, batch_size=32):
       """Train the texture classifier on a dataset."""
       # Load and preprocess data
       # ...
       
       # Create model
       model = create_texture_classifier(num_classes=len(class_names))
       
       # Train the model
       history = model.fit(
           train_dataset,
           validation_data=validation_dataset,
           epochs=epochs,
           callbacks=[
               tf.keras.callbacks.ModelCheckpoint(
                   filepath=os.path.join(output_dir, 'checkpoints'),
                   save_best_only=True
               ),
               tf.keras.callbacks.TensorBoard(
                   log_dir=os.path.join(output_dir, 'logs')
               )
           ]
       )
       
       # Save the model
       model.save(os.path.join(output_dir, 'texture_classifier.h5'))
       
       # Save class names
       with open(os.path.join(output_dir, 'class_names.txt'), 'w') as f:
           f.write('\n'.join(class_names))
       
       return {
           'model_path': os.path.join(output_dir, 'texture_classifier.h5'),
           'class_names': class_names,
           'accuracy': float(history.history['val_accuracy'][-1]),
           'loss': float(history.history['val_loss'][-1])
       }
   ```

3. **Create a model serving endpoint**
   ```python
   # In packages/ml/python/server.py (add route)
   @app.route('/api/classify-texture', methods=['POST'])
   def classify_texture():
       if 'image' not in request.files:
           return jsonify({'error': 'No image provided'}), 400
       
       image_file = request.files['image']
       img = load_and_preprocess_image(image_file)
       
       # Load the model (cached)
       model = get_texture_classifier()
       
       # Make prediction
       predictions = model.predict(np.expand_dims(img, axis=0))[0]
       class_names = get_texture_class_names()
       
       # Format results
       results = [
           {'class': class_name, 'confidence': float(confidence)}
           for class_name, confidence in zip(class_names, predictions)
       ]
       
       # Sort by confidence
       results.sort(key=lambda x: x['confidence'], reverse=True)
       
       return jsonify({
           'results': results[:5],  # Top 5 predictions
           'processingTimeMs': int((time.time() - start_time) * 1000)
       })
   ```

4. **Create TypeScript interface**
   ```typescript
   // In packages/ml/src/index.ts (add interface)
   export interface TextureClassificationResult {
     results: Array<{
       class: string;
       confidence: number;
     }>;
     processingTimeMs: number;
   }
   
   export async function classifyTexture(
     imagePath: string
   ): Promise<TextureClassificationResult> {
     const formData = new FormData();
     formData.append('image', fs.createReadStream(imagePath));
     
     const response = await axios.post<TextureClassificationResult>(
       `${ML_API_URL}/api/classify-texture`,
       formData,
       {
         headers: {
           'Content-Type': 'multipart/form-data'
         }
       }
     );
     
     return response.data;
   }
   ```

## Maintenance and Updates

### Updating the Application

1. Push changes to the main branch
2. The GitHub Actions workflow will automatically:
   - Run tests
   - Build new Docker images
   - Update Kubernetes deployments
   - Deploy frontend apps to Vercel

### Scaling the Application

1. **Kubernetes Scaling**:
   ```bash
   kubectl scale deployment api-server -n kai-ml --replicas=5
   kubectl scale deployment coordinator-service -n kai-ml --replicas=3
   ```

2. **Node Pool Scaling**:
   - In the Digital Ocean dashboard, navigate to your Kubernetes cluster
   - Select the node pool and increase the number of nodes

### Backup and Disaster Recovery

1. **MongoDB Backup**:
   - Use MongoDB Atlas automated backups
   - Set up periodic exports to S3

2. **Kubernetes State Backup**:
   - Use [Velero](https://velero.io/) for Kubernetes cluster backups
   - Configure regular backups to S3

3. **Supabase Backup**:
   - Enable automatic backups in the Supabase dashboard
   - Schedule regular database exports

## Troubleshooting

### Supabase Issues

1. **Authentication Problems**:
   - Check the Site URL in Supabase authentication settings
   - Verify the anon key is correctly set in frontend apps
   - Check CORS configurations

2. **Realtime Connection Issues**:
   - Ensure the publication is properly configured
   - Check that the realtime service is enabled
   - Verify WebSocket connections in the browser console

### Vercel Deployment Issues

1. **Build Failures**:
   - Check the build logs for errors
   - Verify that all dependencies are properly installed
   - Ensure environment variables are correctly set

2. **Runtime Errors**:
   - Check the browser console for errors
   - Verify that API calls are properly configured with the correct URL
   - Check CORS configurations on the backend

### Kubernetes Issues

1. **Pod Startup Failures**:
   - Check pod logs: `kubectl logs -n kai-ml <pod-name>`
   - Describe the pod for events: `kubectl describe pod -n kai-ml <pod-name>`
   - Verify that secrets and config maps are correctly mounted

2. **Connection Issues**:
   - Check if services are properly configured: `kubectl get svc -n kai-ml`
   - Verify ingress configuration: `kubectl describe ingress -n kai-ml kai-ingress`
   - Check if TLS certificates are properly issued: `kubectl get certificates -n kai-ml`

3. **Resource Constraints**:
   - Check pod resource usage: `kubectl top pods -n kai-ml`
   - Increase resource limits if necessary in the deployment YAML files

4. **Argo Workflow Issues**:
   - Check workflow status: `kubectl get workflows -n kai-ml`
   - Get workflow details: `kubectl get workflow -n kai-ml <workflow-name> -o yaml`
   - Check pod logs for workflow step: `kubectl logs -n kai-ml <workflow-pod-name>`
   - Check if ServiceAccount has appropriate permissions
   - Verify PVC creation and access

### Docker Issues

1. **Build Failures**:
   - Check for syntax errors in Dockerfiles
   - Verify that the build context doesn't include large or unnecessary files
   - Check for connection issues to registries

2. **Container Startup Issues**:
   - Check container logs: `docker logs <container-id>`
   - Verify that environment variables are correctly set
   - Check for permission issues on mounted volumes

3. **Image Size Issues**:
   - Use multi-stage builds to reduce final image size
   - Minimize the number of RUN instructions
   - Clean up package caches in the same layer they're created

## Performance Optimization

### Backend Optimization

1. **Database Optimization**:
   - Create appropriate indexes for common queries
   - Use projection to return only needed fields
   - Implement caching for frequent queries
   - Use aggregation pipeline for complex queries

2. **API Server Optimization**:
   - Implement response compression
   - Use efficient JSON serialization
   - Implement request throttling for high-traffic endpoints
   - Use connection pooling for database connections

### Frontend Optimization

1. **React Performance**:
   - Use React.memo for pure components
   - Implement useMemo and useCallback hooks appropriately
   - Use virtualization for long lists (react-window)
   - Implement code splitting for large components

2. **Asset Optimization**:
   - Optimize images (compression, WebP format)
   - Implement lazy loading for images
   - Use CSS minification
   - Implement critical CSS loading

### ML Service Optimization

1. **Model Optimization**:
   - Use model quantization to reduce size
   - Implement batching for multiple requests
   - Use TensorRT for GPU acceleration
   - Optimize preprocessing pipeline

2. **Deployment Optimization**:
   - Use TensorFlow Serving for model serving
   - Implement model caching in memory
   - Use GPU instances for inference
   - Implement input/output pipelines