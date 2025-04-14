# Kai Deployment Guide

This guide provides detailed instructions for deploying the Kai application to production environments using Supabase, Vercel, and Digital Ocean Kubernetes. It includes setup procedures, environment configuration, and CI/CD pipeline instructions.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Component Installation](#component-installation)
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
- Digital Ocean account
- Node.js (v16+) and Yarn (v1.22+) installed locally
- Docker and kubectl installed locally for testing
- Domain name(s) for your deployment

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

The ML package provides machine learning functionality for material recognition, vector embeddings, and model training:

#### Prerequisites

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
┌────────────────────────┐     ┌───────────────────────┐
│                        │     │                       │
│  Vercel                │     │  Digital Ocean K8s    │
│  ---------------       │     │  ---------------      │
│  - Admin Panel (Next)  │     │  - API Server         │
│  - Client App (Gatsby) │────▶│  - ML Services        │
│                        │     │                       │
└────────────────────────┘     └───────────────────────┘
          │                              │
          │                              │
          ▼                              ▼
┌────────────────────────┐     ┌───────────────────────┐
│                        │     │                       │
│  Supabase              │     │  External Services    │
│  ---------------       │◀───▶│  ---------------     │
│  - Authentication      │     │  - MongoDB Atlas      │
│  - Realtime Features   │     │  - AWS S3             │
│  - Queue Management    │     │                       │
└────────────────────────┘     └───────────────────────┘
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

The KAI ML Platform now uses a structured Kubernetes deployment process optimized for machine learning workloads. This section provides an overview of the deployment process on Digital Ocean Kubernetes (DOKS). For detailed configuration information, refer to the [Kubernetes Architecture](./kubernetes-architecture.md) documentation.

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
       
     - **GPU-Optimized Pool** (if needed):
       - Machine Type: GPU-Optimized
       - Node Plan: With NVIDIA GPUs
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

# ML Services
docker build -t registry.example.com/kai/ml-services:latest -f Dockerfile.ml .

# Coordinator Service 
docker build -t registry.example.com/kai/coordinator-service:latest -f packages/coordinator/Dockerfile .

# MCP Server
docker build -t registry.example.com/kai/mcp-server:latest -f packages/ml/Dockerfile.mcp .

# Mobile Optimization Services
docker build -t registry.example.com/kai/mobile-optimization:latest -f packages/coordinator/Dockerfile.mobile .

# WASM Compiler
docker build -t registry.example.com/kai/wasm-compiler:latest -f packages/coordinator/Dockerfile.wasm .

# Push all images to your registry
docker push registry.example.com/kai/api-server:latest
docker push registry.example.com/kai/ml-services:latest
docker push registry.example.com/kai/coordinator-service:latest
docker push registry.example.com/kai/mcp-server:latest
docker push registry.example.com/kai/mobile-optimization:latest
docker push registry.example.com/kai/wasm-compiler:latest
```

Replace `registry.example.com` with your actual container registry URL.

### 4. Deploying with the Deployment Script

The KAI ML Platform includes a dedicated deployment script that handles all aspects of the deployment process, including component dependencies and sequencing:

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

### 5. Deployment Components

The deployment includes the following main components:

1. **Infrastructure**:
   - Namespace and resource quotas
   - Priority classes for workload scheduling
   - Node pool configurations
   - Monitoring stack (Prometheus, Grafana, Jaeger)
   - Caching infrastructure (Redis)

2. **Coordinator Service**:
   - Central orchestration component
   - Manages task queues and workflow scheduling
   - Interfaces with Argo Workflows
   - Provides API endpoints

3. **Distributed Processing**:
   - Handles distributed workloads
   - Manages task distribution
   - Coordinates work across nodes

4. **Mobile Optimization**:
   - Model compression
   - LOD generation
   - Draco mesh compression

5. **WASM Compiler**:
   - WebAssembly compilation for client-side models
   - Browser optimization

6. **Workflow Templates**:
   - Argo workflow templates for standard ML pipelines
   - 3D reconstruction pipeline

### 6. Verification and Post-Installation

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

### 7. Setting Up External Access

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

### 8. Setting Up Argo Workflows

The KAI ML Platform uses Argo Workflows for orchestrating ML pipelines. Install and configure it:

```bash
# Install Argo Workflows
kubectl create namespace argo
kubectl apply -n argo -f https://github.com/argoproj/argo-workflows/releases/download/v3.4.5/install.yaml

# Configure Argo to work with the kai-ml namespace
kubectl apply -f kubernetes/argo-rbac.yaml
```

Argo Workflows provides a UI that can be accessed at http://localhost:2746 after port-forwarding:

```bash
kubectl -n argo port-forward deployment/argo-server 2746:2746
```

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
```

**ML Services**:
```
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/kai
S3_BUCKET=kai-production
S3_REGION=us-east-1
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key
MODEL_PATH=/app/models
GPU_ENABLED=true
BATCH_SIZE=8
```

## CI/CD Pipeline Setup

Create a GitHub Actions workflow for continuous integration and deployment:

**.github/workflows/deploy.yml**:

```yaml
name: Deploy Kai

on:
  push:
    branches: [ main ]
  workflow_dispatch:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Set up Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '16'
          cache: 'yarn'
      
      - name: Install dependencies
        run: yarn install
      
      - name: Run tests
        run: yarn test

  build-and-deploy-backend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v1
      
      - name: Log in to Docker Hub
        uses: docker/login-action@v1
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}
      
      - name: Build and push API server
        uses: docker/build-push-action@v2
        with:
          context: .
          file: ./Dockerfile.api
          push: true
          tags: ${{ secrets.DOCKER_USERNAME }}/kai-api-server:${{ github.sha }},${{ secrets.DOCKER_USERNAME }}/kai-api-server:latest
      
      - name: Build and push ML services
        uses: docker/build-push-action@v2
        with:
          context: .
          file: ./Dockerfile.ml
          push: true
          tags: ${{ secrets.DOCKER_USERNAME }}/kai-ml-services:${{ github.sha }},${{ secrets.DOCKER_USERNAME }}/kai-ml-services:latest
      
      - name: Install doctl
        uses: digitalocean/action-doctl@v2
        with:
          token: ${{ secrets.DIGITALOCEAN_ACCESS_TOKEN }}
      
      - name: Save DigitalOcean kubeconfig
        run: doctl kubernetes cluster kubeconfig save ${{ secrets.DIGITALOCEAN_CLUSTER_NAME }}
      
      - name: Update deployment image
        run: |
          kubectl set image deployment/kai-api-server -n kai api-server=${{ secrets.DOCKER_USERNAME }}/kai-api-server:${{ github.sha }}
          kubectl set image deployment/kai-ml-services -n kai ml-services=${{ secrets.DOCKER_USERNAME }}/kai-ml-services:${{ github.sha }}
      
      - name: Verify deployment
        run: |
          kubectl rollout status deployment/kai-api-server -n kai
          kubectl rollout status deployment/kai-ml-services -n kai

  deploy-admin:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_ADMIN_PROJECT_ID }}
          working-directory: ./packages/admin
          vercel-args: '--prod'

  deploy-client:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_CLIENT_PROJECT_ID }}
          working-directory: ./packages/client
          vercel-args: '--prod'
```

### GitHub Secrets

The following secrets need to be set in your GitHub repository:

- `DOCKER_USERNAME`: Docker Hub username
- `DOCKER_PASSWORD`: Docker Hub password
- `DIGITALOCEAN_ACCESS_TOKEN`: DigitalOcean API token
- `DIGITALOCEAN_CLUSTER_NAME`: DigitalOcean Kubernetes cluster name
- `VERCEL_TOKEN`: Vercel API token
- `VERCEL_ORG_ID`: Vercel organization ID
- `VERCEL_ADMIN_PROJECT_ID`: Vercel project ID for the admin panel
- `VERCEL_CLIENT_PROJECT_ID`: Vercel project ID for the client app

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
   kubectl get pods -n kai
   ```
2. Check the logs of the API server:
   ```bash
   kubectl logs -n kai deployment/kai-api-server
   ```
3. Check the logs of the ML services:
   ```bash
   kubectl logs -n kai deployment/kai-ml-services
   ```
4. Make a test API call:
   ```bash
   curl https://api.kai.yourdomain.com/health
   ```

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
   - Check pod logs: `kubectl logs -n kai <pod-name>`
   - Describe the pod for events: `kubectl describe pod -n kai <pod-name>`
   - Verify that secrets and config maps are correctly mounted

2. **Connection Issues**:
   - Check if services are properly configured: `kubectl get svc -n kai`
   - Verify ingress configuration: `kubectl describe ingress -n kai kai-ingress`
   - Check if TLS certificates are properly issued: `kubectl get certificates -n kai`

3. **Resource Constraints**:
   - Check pod resource usage: `kubectl top pods -n kai`
   - Increase resource limits if necessary in the deployment YAML files

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
   kubectl scale deployment kai-api-server -n kai --replicas=5
   kubectl scale deployment kai-ml-services -n kai --replicas=3
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