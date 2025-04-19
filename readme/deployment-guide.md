# Kai Deployment Guide

This guide provides detailed instructions for deploying the Kai application to production environments using Supabase, Vercel, and Digital Ocean Kubernetes. It includes setup procedures, environment configuration, and CI/CD pipeline instructions.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Component Installation](#component-installation)
- [Recently Added Features](#recently-added-features)
- [Architecture Overview](#architecture-overview)
- [Supabase Deployment](#supabase-deployment)
- [Vercel Deployment](#vercel-deployment)
- [Digital Ocean Kubernetes Deployment](#digital-ocean-kubernetes-deployment)
- [Environment Variables](#environment-variables)
- [CI/CD Pipeline Setup](#cicd-pipeline-setup)
- [Deployment Verification](#deployment-verification)
- [Troubleshooting](#troubleshooting)

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
### Recently Added Features

The Kai platform has been enhanced with four major new features that require specific deployment configurations:

#### 1. Notification & Webhook System

A comprehensive messaging framework supporting multiple notification channels:
- In-app notifications (real-time & persistent)
- Email notifications
- SMS notifications (via third-party providers)
- Webhook integrations for external systems

**Deployment Components:**
- Notification service deployment
- Webhook service deployment
- Database tables for notification configuration and history
- External service integrations (email, SMS)

#### 2. Parameter Registry System

A hyperparameter management system for ML workloads:
- Material-specific parameter storage
- Similarity-based parameter suggestion
- Automated hyperparameter optimization
- Default configurations for common material types

**Deployment Components:**
- Parameter registry API deployment
- Persistent storage for parameter history
- Integration with ML training pipelines

#### 3. MultiModal Pattern Recognition

An advanced ML system for bridging visual patterns and textual specifications:
- Transformer-based architecture with cross-modal attention
- Pattern-to-text and text-to-pattern matching
- Material pattern classification and specification extraction

**Deployment Components:**
- GPU-optimized deployment for inference
- Workflow templates for pattern recognition tasks
- Integration with existing material analysis pipeline

#### 4. Domain-Specific Neural Networks

Specialized neural architectures for material texture analysis:
- Custom convolutional filters for different material classes
- Multi-resolution material-aware attention mechanisms
- Texture-specific feature extraction and classification

**Deployment Components:**
- GPU-optimized deployment for inference
- Workflow templates for domain-specific processing
- Texture analysis integration points
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
- CUDA 11.8+ for GPU support
- NVIDIA drivers for L40S/H100 GPUs
#### Prerequisites
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
- Python 3.8+
- Node.js 16+
- Tesseract OCR (for text extraction)
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
#### Setup
### New Feature Architecture

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
1. Install Node.js dependencies:
   ```bash
   cd packages/ml
   npm install
   ```
### 3. Adding Tables for New Features

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
2. Install Python dependencies:
   ```bash
   npm run setup-python
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

## Architecture Overview

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

## Supabase Deployment

Supabase is used for authentication, realtime features, and queue management.

### 1. Creating a Supabase Project

1. Sign in to [Supabase](https://app.supabase.io/)
2. Click "New Project"
3. Enter project details:
   - Name: `kai-production` (or your preferred name)
   - Database Password: Generate a strong password
   - Region: Choose the region closest to your users
4. Click "Create new project"

### 2. Setting up Database Schema

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

### 3. Configuring Authentication

1. In the Supabase dashboard, go to Authentication → Settings
2. Configure the following settings:
   - Site URL: Your production frontend URL (e.g., `https://kai.yourdomain.com`)
   - Enable Email Auth: Yes
   - Enable Phone Auth: Optional
   - Enable OAuth Providers: As needed (Google, GitHub, etc.)

### 4. Creating Service Role API Keys

1. In the Supabase dashboard, go to Settings → API
2. Copy the following values:
   - URL: Your Supabase project URL
   - `anon` public key: For client-side authentication
   - `service_role` key: For server-side operations (**keep this secure**)

### 5. Enabling Realtime

1. In the Supabase dashboard, go to Database → Replication
2. Ensure the `supabase_realtime` publication is configured properly
3. Go to Settings → API → Realtime and enable it

## Vercel Deployment

Vercel is used to deploy the Next.js admin panel and the Gatsby client frontend.

### 1. Admin Panel Deployment (Next.js)

1. Log in to [Vercel](https://vercel.com/)
2. Click "Add New" → "Project"
3. Import your GitHub repository
4. Configure the project:
   - Framework Preset: Next.js
   - Root Directory: `packages/admin`
   - Build Command: `yarn build`
   - Output Directory: `out` (default)
   - Install Command: `yarn install`
5. Set up environment variables (see [Environment Variables](#environment-variables) section)
6. Click "Deploy"

### 2. Client App Deployment (Gatsby)

1. Log in to [Vercel](https://vercel.com/)
2. Click "Add New" → "Project"
3. Import your GitHub repository (if not already imported)
4. Configure the project:
   - Framework Preset: Gatsby
   - Root Directory: `packages/client`
   - Build Command: `yarn build`
   - Output Directory: `public` (default)
   - Install Command: `yarn install`
5. Set up environment variables (see [Environment Variables](#environment-variables) section)
6. Click "Deploy"

### 3. Custom Domain Configuration

1. In the Vercel project settings, go to Domains
2. Add your custom domain(s):
   - Admin Panel: `admin.kai.yourdomain.com`
   - Client App: `kai.yourdomain.com`
3. Configure DNS settings as instructed by Vercel

### 4. Vercel Project Settings

For both projects, configure these additional settings:

1. **Build & Development Settings**:
   - Node.js Version: 16.x (or higher if required)
   - Include source files outside of the Root Directory: Yes
   - Install Command: `cd ../.. && yarn install`

2. **Environment Variables**:
   - Add all required environment variables (see [Environment Variables](#environment-variables) section)

## Digital Ocean Kubernetes Deployment

The KAI ML Platform uses a job-based processing architecture with Argo Workflows for orchestration. This section provides detailed steps for deploying to Digital Ocean Kubernetes (DOKS). For detailed configuration information, refer to the [Kubernetes Architecture](./kubernetes-architecture.md) documentation.

### 1. Setting up a Kubernetes Cluster

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
### 2. Deployment Order

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

### 3. Coordinator Service Updates

The coordinator service has been updated to support the new features with the following changes:

#### Configuration Updates (config.yaml)

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

#### Deployment Updates (deployment.yaml)

1. **Resource Allocation Increases**
   - CPU: 500m → 1 core (requests), 2 → 4 cores (limits)
   - Memory: 512Mi → 1Gi (requests), 2Gi → 4Gi (limits)

2. **Environment Variables**
   - Added connectivity parameters for new services
   - Configured feature flags for new components
   - Setup workflow template paths
   
The coordinator serves as the central orchestration component that manages all the new features, distributing workloads, and ensuring proper integration between components.
### 2. Connecting to the Cluster

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

### 3. Building and Pushing Docker Images

The deployment requires several container images for different components:

```bash
# API Server
docker build -t registry.example.com/kai/api-server:latest -f Dockerfile.api .

# Coordinator Service
docker build -t registry.example.com/kai/coordinator-service:latest -f packages/coordinator/Dockerfile.coordinator .

# Worker Images for Argo Workflows
docker build -t registry.example.com/kai/quality-assessment:latest -f packages/ml/python/Dockerfile.quality-assessment .
docker build -t registry.example.com/kai/image-preprocessing:latest -f packages/ml/python/Dockerfile.image-preprocessing .
docker build -t registry.example.com/kai/colmap-sfm:latest -f packages/ml/python/Dockerfile.colmap-sfm .
docker build -t registry.example.com/kai/point-cloud:latest -f packages/ml/python/Dockerfile.point-cloud .
docker build -t registry.example.com/kai/model-generator:latest -f packages/ml/python/Dockerfile.model-generator .
docker build -t registry.example.com/kai/diffusion-nerf:latest -f packages/ml/python/Dockerfile.diffusion-nerf .
docker build -t registry.example.com/kai/nerf-mesh-extractor:latest -f packages/ml/python/Dockerfile.nerf-mesh-extractor .
docker build -t registry.example.com/kai/format-converter:latest -f packages/ml/python/Dockerfile.format-converter .
docker build -t registry.example.com/kai/workflow-finalizer:latest -f packages/ml/python/Dockerfile.workflow-finalizer .

# Mobile Optimization Services
docker build -t registry.example.com/kai/mobile-optimization:latest -f packages/coordinator/Dockerfile.mobile .

# WASM Compiler
docker build -t registry.example.com/kai/wasm-compiler:latest -f packages/coordinator/Dockerfile.wasm .

# New feature images
docker build -t registry.example.com/kai/parameter-registry:latest -f packages/server/Dockerfile.parameter-registry .
docker build -t registry.example.com/kai/notification-service:latest -f packages/server/Dockerfile.notification-service .
docker build -t registry.example.com/kai/webhook-service:latest -f packages/server/Dockerfile.webhook-service .
docker build -t registry.example.com/kai/multimodal-pattern-recognition:latest -f packages/ml/python/Dockerfile.multimodal-pattern-recognition .
docker build -t registry.example.com/kai/domain-specific-networks:latest -f packages/ml/python/Dockerfile.domain-specific-networks .
docker build -t registry.example.com/kai/mcp-server:latest -f packages/ml/Dockerfile.mcp .

# Push all images to your registry
docker push registry.example.com/kai/api-server:latest
docker push registry.example.com/kai/coordinator-service:latest
docker push registry.example.com/kai/quality-assessment:latest
docker push registry.example.com/kai/image-preprocessing:latest
docker push registry.example.com/kai/colmap-sfm:latest
docker push registry.example.com/kai/point-cloud:latest
docker push registry.example.com/kai/model-generator:latest
docker push registry.example.com/kai/diffusion-nerf:latest
docker push registry.example.com/kai/nerf-mesh-extractor:latest
docker push registry.example.com/kai/format-converter:latest
docker push registry.example.com/kai/workflow-finalizer:latest
docker push registry.example.com/kai/mobile-optimization:latest
docker push registry.example.com/kai/wasm-compiler:latest
docker push registry.example.com/kai/mcp-server:latest
docker push registry.example.com/kai/parameter-registry:latest
docker push registry.example.com/kai/notification-service:latest
docker push registry.example.com/kai/webhook-service:latest
docker push registry.example.com/kai/multimodal-pattern-recognition:latest
docker push registry.example.com/kai/domain-specific-networks:latest
```
3. **New ML Components**:
   - MultiModal Pattern Recognition (`kubernetes/ml-services/multimodal-pattern-recognition-deployment.yaml`)
   - Domain-Specific Networks (`kubernetes/ml-services/domain-specific-networks-deployment.yaml`)
   - Updated GPU configuration (`kubernetes/gpu-requirements.yaml`)

4. **New Infrastructure Services**:
   - Notification System (`kubernetes/notification-system/deployment.yaml`)
   - Webhook Service (`kubernetes/notification-system/webhook-deployment.yaml`)
   - Parameter Registry (`kubernetes/parameter-registry/deployment.yaml`)
   - Parameter Registry Service (`kubernetes/parameter-registry/service.yaml`)

5. **New Workflow Templates**:
   - MultiModal Pattern Recognition (`kubernetes/workflows/multimodal-pattern-recognition-template.yaml`)
   - Domain-Specific Networks (`kubernetes/workflows/domain-specific-networks-template.yaml`)
Replace `registry.example.com` with your actual container registry URL.
   - MultiModal Pattern Recognition template (`multimodal-pattern-recognition-template.yaml`)
   - Domain-Specific Networks template (`domain-specific-networks-template.yaml`)
### 4. Installing Argo Workflows
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
Argo Workflows is required for pipeline orchestration:

```bash
# Install Argo Workflows controller and UI
kubectl create namespace argo
kubectl apply -n argo -f https://github.com/argoproj/argo-workflows/releases/download/v3.4.5/install.yaml

# Configure Argo to work with the kai-ml namespace
kubectl apply -f kubernetes/argo-rbac.yaml
```

### 5. Deploying with the Deployment Script

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

### 6. Deployment Components

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

### Horizontal Pod Autoscaling (HPA)

The KAI Platform uses Kubernetes Horizontal Pod Autoscaling (HPA) to automatically adjust the number of running pod replicas based on observed metrics. This section explains how HPA operates in our architecture, the communication flow, and the benefits it provides.

#### HPA Operation and Configuration

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: coordinator-service-hpa
  namespace: kai-ml
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: coordinator-service
  minReplicas: 2 # Ensure at least 2 replicas are running
  maxReplicas: 5 # Scale up to 5 replicas
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 75 # Target 75% CPU utilization
  # Optionally add memory-based scaling
  # - type: Resource
  #   resource:
  #     name: memory
  #     target:
  #       type: Utilization
  #       averageUtilization: 75
```

1. **How HPA Works in Our Platform**:
   - The Kubernetes HPA controller continuously monitors metrics from the Coordinator service and other configured components
   - The standard metrics-server component collects CPU and memory metrics from pods
   - The controller compares current CPU utilization (75% target) against the specified threshold
   - When utilization exceeds the threshold, the controller calculates the desired number of replicas to maintain the target utilization
   - Replicas are added or removed accordingly, while always maintaining between 2 and 5 replicas

2. **Metrics Collection Flow**:
   - **Pod Instrumentation**: Our pods expose metrics via Prometheus annotations:
     ```yaml
     annotations:
       prometheus.io/scrape: "true"
       prometheus.io/port: "8081"
       prometheus.io/path: "/metrics"
     ```
   - **metrics-server**: Collects CPU/memory usage from kubelet on each node
   - **Prometheus Adapter**: Converts Prometheus metrics into custom metrics API format (for custom metrics)
   - **HPA Controller**: Queries metrics API for data at regular intervals (15 seconds by default)

3. **Communication Between Components**:
   - **Coordinator Service → metrics-server**: Coordinator pods expose basic CPU/memory metrics via kubelet
   - **Coordinator Service → Prometheus**: Coordinator exposes detailed metrics on the `/metrics` endpoint (port 8081)
   - **Prometheus → Prometheus Adapter**: Converts detailed metrics to HPA-compatible format
   - **HPA Controller → APIs**: Queries metrics APIs to obtain current utilization
   - **HPA Controller → kube-apiserver**: Updates replica count on the target deployment when needed

#### Multi-layer Scaling Architecture

Our platform implements scaling at multiple layers:

1. **Pod-level Scaling (HPA)**:
   - Coordinator Service: 2-5 replicas based on CPU utilization
   - Mobile Optimization Service: 1-3 replicas based on CPU utilization
   - WASM Compiler: 1-3 replicas based on CPU utilization
   - This handles fluctuations in API request volume and control plane activities

2. **Workflow-level Concurrency**:
   - The Coordinator Service implements task queue management with priority-based concurrency limits
   - Configured through the `task_queue_config` setting:
     ```
     task_queue_config={"interactive":{"concurrency":5,"weight":10},"batch":{"concurrency":10,"weight":5},"maintenance":{"concurrency":2,"weight":1}}
     ```
   - Ensures high-priority workflows get resources first, while maintaining system stability

3. **Cluster Autoscaling**:
   - Node pools automatically scale when pods can't be scheduled due to resource constraints
   - Different node pools (CPU-Optimized, GPU-Optimized, etc.) scale independently based on specific workload needs

4. **Resource Allocation Adjustment**:
   - The ResourceManager service dynamically adjusts resource requests for workflows based on:
     - Subscription tier limitations
     - Current cluster utilization
     - Quality level requirements
   - This ensures optimal resource distribution during high-load periods

#### Results and Benefits

The HPA configuration delivers these benefits:

1. **Cost Efficiency**:
   - During low-traffic periods, components scale down to minimum replicas
   - CPU/memory resources are freed for other workloads or to allow node removal via cluster autoscaling
   - This optimizes resource usage and reduces operational costs

2. **Responsive Scaling**:
   - As user traffic increases, the system proactively adds replicas before performance degrades
   - The 75% target utilization provides a buffer to handle traffic spikes during scaling events
   - Maintaining minimum 2 replicas ensures high availability even during scaling

3. **Improved Reliability**:
   - The system can automatically recover from pod failures or node issues by creating new replicas
   - Multiple layers of scaling provide defense-in-depth against resource exhaustion
   - Priority-based queuing ensures critical workflows continue during high demand

4. **Scaling Metrics**:
   Our Grafana dashboards include panels to monitor scaling behavior:
   - Current/target replica counts
   - CPU/memory utilization across replicas
   - Scaling events timeline
   - Queue depths by priority level

To view these metrics, access the Grafana dashboard at: http://<cluster-ip>/grafana (after setting up port forwarding or ingress)

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

### 7. Verification and Post-Installation

After deployment, verify that all components are running correctly:

```bash
# Check namespace
kubectl get namespace kai-ml

# Check coordinator service
kubectl get deployments -n kai-ml coordinator-service

# Check pods
kubectl get pods -n kai-ml

# Check services
kubectl get services -n kai-ml

# Check Argo Workflows
kubectl get workflowtemplates -n kai-ml
```

Access the monitoring dashboards:
- Grafana: http://<cluster-ip>:80 (via ingress)
- Jaeger: http://<cluster-ip>:16686
- Argo Workflows UI: http://localhost:2746 (after port-forwarding)

```bash
# Port forward to access Argo UI
kubectl -n argo port-forward deployment/argo-server 2746:2746
```

### 8. Setting Up External Access

1. Install the NGINX Ingress Controller if not already installed:
   ```bash
   kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.7.0/deploy/static/provider/cloud/deploy.yaml
   ```

2. Create an ingress for the coordinator and other services:
   ```yaml
   apiVersion: networking.k8s.io/v1
   kind: Ingress
   metadata:
     name: kai-ml-ingress
     namespace: kai-ml
     annotations:
       kubernetes.io/ingress.class: "nginx"
       cert-manager.io/cluster-issuer: "letsencrypt-prod"
   spec:
     tls:
     - hosts:
       - api.yourdomain.com
       secretName: kai-ml-tls-secret
     rules:
     - host: api.yourdomain.com
       http:
         paths:
         - path: /api/workflows
           pathType: Prefix
           backend:
             service:
               name: coordinator-service
               port:
                 number: 80
         - path: /
           pathType: Prefix
           backend:
             service:
               name: api-server-service
               port:
                 number: 80
   ```

3. Install cert-manager for TLS:
   ```bash
   kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.11.0/cert-manager.yaml
   ```

4. Create a ClusterIssuer for Let's Encrypt:
   ```yaml
   apiVersion: cert-manager.io/v1
   kind: ClusterIssuer
   metadata:
     name: letsencrypt-prod
   spec:
     acme:
       server: https://acme-v02.api.letsencrypt.org/directory
       email: your-email@example.com
       privateKeySecretRef:
         name: letsencrypt-prod
       solvers:
       - http01:
           ingress:
             class: nginx
   ```

5. Configure DNS records to point to the Load Balancer IP:
   ```bash
   kubectl get service ingress-nginx-controller -n ingress-nginx
   ```
   Create an A record for `api.yourdomain.com` pointing to the IP address.

For more detailed information about the Kubernetes architecture, node pools, resource management, security, and operational considerations, refer to the [Kubernetes Architecture](./kubernetes-architecture.md) documentation.

## Environment Variables

Here are the required environment variables for each component:

### Supabase Environment Variables

These will be automatically provided by Supabase dashboard.

### Vercel Environment Variables

**Admin Panel (Next.js)**:
```
NEXT_PUBLIC_API_URL=https://api.kai.yourdomain.com
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

**Client App (Gatsby)**:
```
GATSBY_API_URL=https://api.kai.yourdomain.com
GATSBY_SUPABASE_URL=https://your-project.supabase.co
GATSBY_SUPABASE_ANON_KEY=your-supabase-anon-key
GATSBY_STORAGE_URL=https://your-s3-bucket.s3.amazonaws.com
```

### Digital Ocean Kubernetes Environment Variables

**API Server**:
```
NODE_ENV=production
PORT=3000
API_BASE_URL=https://api.kai.yourdomain.com
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/kai
JWT_SECRET=your-very-secure-jwt-secret
S3_BUCKET=kai-production
S3_REGION=us-east-1
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-service-role-key
CORS_ORIGIN=https://kai.yourdomain.com,https://admin.kai.yourdomain.com
LOG_LEVEL=info
COORDINATOR_URL=http://coordinator-service.kai-ml.svc.cluster.local
```

**Coordinator Service**:
```
NODE_ENV=production
PORT=8080
METRICS_PORT=8081
REDIS_HOST=redis-master.kai-ml.svc.cluster.local
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
WORKFLOW_NAMESPACE=kai-ml
WORKFLOW_TEMPLATES_PATH=/app/templates
WORKFLOW_ARCHIVE_TTL=7d
LOG_LEVEL=info
RESOURCE_QUOTA_MODE=namespace
ENABLE_PREEMPTION=true
DEFAULT_PRIORITY=medium
ENABLE_CACHING=true
CACHE_TTL=86400
ENABLE_AUTOSCALING=true
SCALE_DOWN_DELAY=300
PROMETHEUS_ENABLED=true
```

**ML Workers**:
Environment variables for worker containers are typically injected by the Argo workflow template based on the specific requirements of each worker. Common variables include:
```
S3_BUCKET=kai-production
S3_REGION=us-east-1
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key
MODEL_PATH=/app/models
LOG_LEVEL=info
```

## CI/CD Pipeline Setup

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

      # Checkout, artifacts download, and Vercel deployment steps...
      
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

### Benefits of the Enhanced CI/CD Pipeline

1. **Reduced Duplication**: Eliminates nearly identical code between staging and production deployments
2. **Faster Builds**: Parallel Docker image building with the matrix strategy
3. **Consistent Configuration**: One source of truth for environment-specific settings
4. **Enhanced Reliability**: Automatic health checks and rollback capabilities
5. **Simplified Maintenance**: Adding new images or environments requires minimal changes

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
- `SLACK_WEBHOOK`: Slack webhook URL for notifications (optional)

For more details on the CI/CD pipeline, see the [CI/CD Pipeline Documentation](./cicd-pipeline.md).

## Digital Ocean Kubernetes Deployment

The KAI ML Platform uses a job-based processing architecture with Argo Workflows for orchestration, now enhanced with improved environment support and automatic rollback capabilities.

### Enhanced Deployment Script

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

### Helm-Based Deployment

In addition to the script-based deployment, the KAI Platform now supports Helm charts for more maintainable and consistent Kubernetes deployments. This approach provides significant advantages in configuration management, environment isolation, and deployment reliability.

#### Helm Chart Structure

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

#### Deploying with Helm Charts

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

#### Key Advantages of Helm Charts

1. **Templated Resources**:
   - All Kubernetes manifests are generated from templates
   - Environment-specific values are injected automatically
   - Consistent structure across environments

2. **Environment-Specific Values Files**:
   - Uses dedicated values files for staging and production
   - All environment differences are centralized in values files
   - Simplified configuration management

3. **Versioned Releases**:
   - Each deployment creates a versioned Helm release
   - Full history of all deployments is maintained
   - Selective rollback to any previous version
   
   ```bash
   # List all release versions
   helm history kai-production
   
   # View details of a specific release
   helm get all kai-production --revision=2
   ```

4. **Dependency Management**:
   - Proper ordering of resource creation
   - Handles dependencies between components
   - Less risk of partial deployments

5. **Built-in Rollback**:
   - Native Helm rollback capabilities
   - Comprehensive rollback including all resources
   - Simplified recovery from failed deployments

### Canary Deployments with Automated Health Monitoring

The KAI Platform now supports automated canary deployments with health monitoring and automatic promotion or rollback based on metrics. This provides a safer way to roll out changes by testing them on a small subset of traffic before full deployment.

#### Canary Deployment Benefits

1. **Reduced Risk**: Only a small percentage of traffic is initially exposed to the new version
2. **Automated Verification**: The system monitors health metrics and automatically makes promotion/rollback decisions
3. **Critical Service Focus**: Health checks focus on the most important services in your platform
4. **Progressive Rollout**: The system can be configured to gradually increase traffic to the canary if metrics remain healthy

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

These metrics are collected from Prometheus and compared against thresholds to determine if the canary is healthy.

For more detailed information about canary deployments, including health metrics, monitoring details, best practices, and troubleshooting, refer to the [Canary Deployment Documentation](./canary-deployment.md).

#### Deployment Workflow

1. **Install Helm** (if not already installed):
   ```bash
   curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
   ```

2. **Configure Helm Values**:
   Review and adjust values files as needed:
   
   ```yaml
   # Example of values-production.yaml
   global:
     environment: "production"
     namespace: "kai-system"
     resourceMultiplier: 2
   
   coordinator:
     replicaCount: 3
     minReplicas: 2
     maxReplicas: 10
     resources:
       requests:
         cpu: "500m"
         memory: "1Gi"
       limits:
         cpu: "2000m"
         memory: "4Gi"
   ```

3. **Deploy with the Script**:
   ```bash
   ./helm-charts/helm-deploy.sh \
     --context=your-kubernetes-context \
     --registry=your-registry.example.com \
     --tag=your-image-tag \
     --env=production \
     --release=kai-production
   ```

4. **Verify Deployment**:
   ```bash
   helm status kai-production
   kubectl get pods -n kai-system
   ```

### Resource Allocation by Environment

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

This ensures appropriate resource use in each environment, with production getting more resources for reliability and performance while staging uses fewer resources to reduce costs.

For more detailed information about the Kubernetes architecture, including Helm implementation details, node pools, resource management, security, and operational considerations, refer to the [Kubernetes Architecture](./kubernetes-architecture.md) documentation.

### Flux GitOps-Based Deployment

The KAI Platform now supports a GitOps approach to deployment using Flux CD, which provides a fully automated, declarative way to manage Kubernetes resources. This approach offers significant advantages in terms of security, reliability, and operational efficiency.

#### Installing Flux on the Cluster

1. **Install the Flux CLI** (if not already installed):
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
   # and export it as an environment variable
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

   This command will:
   - Create a new repository if it doesn't exist
   - Add Flux components to your cluster
   - Configure Flux to synchronize with the specified path in the repository

#### GitOps Repository Structure

The KAI Platform uses a structured GitOps repository with separate configurations for staging and production environments:

```
flux/
├── clusters/
│   ├── staging/            # Staging environment
│   │   ├── flux-system/    # Flux core components
│   │   │   ├── gotk-sync.yaml       # Git repository sync configuration
│   │   │   └── kustomization.yaml   # Flux system components
│   │   ├── sources/        # Source definitions (Helm repos, Git repos)
│   │   │   ├── helm-repository.yaml # Helm repository source
│   │   │   └── kustomization.yaml   # Sources kustomization
│   │   ├── releases/       # Application deployments
│   │   │   ├── coordinator.yaml     # Coordinator HelmRelease
│   │   │   └── kustomization.yaml   # Releases kustomization
│   │   └── kustomization.yaml       # Main kustomization file
│   └── production/         # Production environment (similar structure)
│       ├── flux-system/
│       ├── sources/
│       ├── releases/
│       └── kustomization.yaml
```

#### Creating HelmRelease Resources

HelmRelease resources define how Flux should deploy applications using Helm charts:

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
    resources:
      limits:
        cpu: 2000m
        memory: 2048Mi
      requests:
        cpu: 1000m
        memory: 1024Mi
    autoscaling:
      enabled: true
      minReplicas: 3
      maxReplicas: 10
      targetCPUUtilizationPercentage: 70
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

#### CI/CD Integration with Flux

The CI/CD pipeline integrates with Flux through a dedicated job that updates the GitOps repository:

1. **Add required secret**:
   Add a Personal Access Token with repo scope to your GitHub repository secrets as `GITOPS_PAT`.

2. **Configure workflow job**:
   The GitHub Actions workflow includes a job to update the GitOps repository with new image versions:

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

3. **Flux reconciliation**:
   After the CI/CD workflow updates the image tags in the GitOps repository, Flux automatically:
   - Detects the changes in the repository
   - Updates the HelmReleases with the new image tags
   - Triggers Helm upgrades for the affected releases
   - Reports the status of the reconciliation

#### Monitoring Flux and Deployments

1. **Check Flux status**:
   ```bash
   # Get all Flux custom resources
   flux get all
   
   # Check specific HelmReleases
   flux get helmreleases
   
   # Get HelmRelease details
   flux get helmrelease coordinator -n flux-system
   ```

2. **View Flux logs**:
   ```bash
   # View controller logs
   flux logs --all-namespaces
   
   # View logs for a specific HelmRelease
   flux logs --kind=helmrelease --name=coordinator
   ```

3. **Check Kubernetes resources**:
   ```bash
   # Get all pods
   kubectl get pods -n kai-system
   
   # Check deployment status
   kubectl get deployments -n kai-system
   ```

#### Rollback with Flux

If you need to roll back a deployment:

1. **Revert the commit in the GitOps repository**:
   ```bash
   # Get the previous commit hash
   git log --oneline

   # Create a revert commit
   git revert <commit-hash>
   git push
   ```

2. **Force Flux reconciliation** (optional, Flux will reconcile automatically within the configured interval):
   ```bash
   flux reconcile kustomization flux-system --with-source
   ```

3. **Monitor the rollback**:
   ```bash
   flux get helmrelease coordinator -n flux-system
   kubectl get pods -n kai-system -w
   ```

#### Benefits of Flux GitOps

The Flux GitOps approach provides several key benefits for KAI Platform deployments:

1. **Declarative Configuration**: All Kubernetes resources are defined declaratively in Git
2. **Automated Reconciliation**: Flux ensures the cluster state always matches the desired state in Git
3. **Self-Healing**: Automatic recovery from drift or failed deployments
4. **Enhanced Security**: No direct access to the Kubernetes cluster is needed for deployments
5. **Complete Audit Trail**: All changes are tracked in Git with full history
6. **Progressive Delivery**: Support for canary deployments and A/B testing
7. **Multi-Cluster Management**: The same GitOps repository can manage multiple clusters

For more detailed information about the Flux GitOps architecture, controllers, and workflow, refer to the [Kubernetes Architecture](./kubernetes-architecture.md) documentation.

## Deployment Verification

After deployment, verify that all components are working properly:

### Vercel Deployment Verification

1. Visit the client app: `https://kai.yourdomain.com`
2. Visit the admin panel: `https://admin.kai.yourdomain.com`
3. Verify that authentication with Supabase works
4. Verify that API calls to the backend are successful

### Digital Ocean Kubernetes Verification

1. Check the status of all pods:
   ```bash
   kubectl get pods -n kai-ml
   ```
2. Check the logs of the API server:
   ```bash
   kubectl logs -n kai-ml deployment/api-server
   ```
3. Check the logs of the Coordinator service:
   ```bash
   kubectl logs -n kai-ml deployment/coordinator-service
   ```
4. Check Argo workflow templates:
   ```bash
   kubectl get workflowtemplates -n kai-ml
   ```
5. Submit a test workflow and check its status:
   ```bash
   # Test API endpoint that triggers a workflow
   curl -X POST https://api.yourdomain.com/api/workflows \
     -H "Content-Type: application/json" \
     -d '{"type":"3d-reconstruction","userId":"test","parameters":{"input-images":"[\"s3://test-bucket/test-image.jpg\"]"}}'
   
   # Get workflow status
   WORKFLOW_ID="from-previous-response"
   curl https://api.yourdomain.com/api/workflows/$WORKFLOW_ID/status
   ```
6. Check Argo UI for workflow visualization

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

### Digital Ocean Kubernetes Issues

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

---

This deployment guide provides comprehensive instructions for deploying the Kai application to Supabase, Vercel, and Digital Ocean Kubernetes. Follow these steps carefully to ensure a successful production deployment.