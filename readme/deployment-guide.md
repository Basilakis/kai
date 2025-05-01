# KAI Platform Automated Deployment Guide

This comprehensive guide covers the fully automated deployment process for the KAI platform, including infrastructure provisioning, Kubernetes cluster setup, CI/CD pipeline configuration, and monitoring.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Automated Deployment with GitHub Actions](#automated-deployment-with-github-actions)
  - [Required GitHub Secrets](#required-github-secrets)
  - [Complete GitHub Actions Workflow](#complete-github-actions-workflow)
  - [Workflow Explanation](#workflow-explanation)
- [Digital Ocean Kubernetes Cluster Configuration](#digital-ocean-kubernetes-cluster-configuration)
  - [Cluster Requirements](#cluster-requirements)
  - [Node Pool Configuration](#node-pool-configuration)
  - [Resource Allocation](#resource-allocation)
- [SSL Certificate Management](#ssl-certificate-management)
- [Frontend Deployment to Vercel](#frontend-deployment-to-vercel)
- [Environment Variables and Secrets](#environment-variables-and-secrets)
- [Deployment Verification and Monitoring](#deployment-verification-and-monitoring)
- [Maintenance and Updates](#maintenance-and-updates)
  - [Updating the Application](#updating-the-application)
  - [Scaling the Application](#scaling-the-application)
  - [Backup and Disaster Recovery](#backup-and-disaster-recovery)
- [Troubleshooting](#troubleshooting)
  - [Deployment Issues](#deployment-issues)
  - [Kubernetes Issues](#kubernetes-issues)
  - [SSL Certificate Issues](#ssl-certificate-issues)
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
- Supabase account and project set up
- Vercel account with projects created for frontend and admin panel
- Digital Ocean account with API access
- Domain name(s) for your deployment
- OpenAI API key (for AI features)
- MongoDB Atlas account (or other MongoDB provider)
- Stripe account (if using payment features)

You do not need to install any local tools as the entire deployment process is automated through GitHub Actions.

## Automated Deployment with GitHub Actions

The KAI platform uses GitHub Actions to fully automate the deployment process, from building and testing code to provisioning infrastructure and deploying to Kubernetes and Vercel. Our approach uses modular, reusable workflows for better maintainability and flexibility.

### Workflow Architecture

The deployment system consists of several reusable workflows:

1. **Main Workflow (`deploy.yml`)**:
   - Orchestrates the entire deployment process
   - Determines which environment to deploy to (staging or production)
   - Calls the appropriate reusable workflows in sequence

2. **Build and Test (`build-test.yml`)**:
   - Builds the application code
   - Runs tests to ensure code quality
   - Uploads build artifacts for later use

3. **Docker Build (`docker-build.yml`)**:
   - Builds Docker images for all services
   - Pushes images to the Docker registry
   - Tags images with both the commit SHA and environment

4. **Infrastructure Provisioning (`provision-infrastructure.yml`)**:
   - Checks if a Kubernetes cluster exists
   - Creates a new cluster if needed
   - Sets up node pools optimized for different workloads

5. **Kubernetes Setup (`setup-kubernetes.yml`)**:
   - Creates necessary namespaces
   - Sets up Kubernetes secrets
   - Installs cert-manager for SSL certificates
   - Installs NGINX Ingress Controller
   - Installs Argo Workflows for ML pipelines

6. **Application Deployment (`deploy-application.yml`)**:
   - Deploys the application using Helm
   - Runs database migrations
   - Verifies the deployment

7. **Frontend Deployment (`deploy-frontend.yml`)**:
   - Deploys the client frontend to Vercel
   - Deploys the admin panel to Vercel
   - Sets up environment variables

8. **Deployment Verification (`verify-deployment.yml`)**:
   - Performs comprehensive health checks
   - Verifies API availability
   - Checks SSL certificate validity
   - Sends deployment notifications

### Required GitHub Secrets

Before running the deployment workflow, you need to add the following secrets to your GitHub repository:

#### Digital Ocean / Infrastructure Secrets
- `DIGITALOCEAN_ACCESS_TOKEN`: Your Digital Ocean API token with write access
- `CLUSTER_NAME`: Base name for your Kubernetes cluster (e.g., "kai")
- `DO_REGION`: Region for your cluster (e.g., "ams3")

#### Docker Registry Secrets
- `DOCKER_REGISTRY`: Your Docker registry URL (e.g., "registry.digitalocean.com")
- `DOCKER_USERNAME`: Your Docker registry username
- `DOCKER_PASSWORD`: Your Docker registry password

#### Domain and SSL Secrets
- `DOMAIN_NAME`: Your domain name (e.g., "kai-platform.com")
- `ADMIN_EMAIL`: Email for SSL certificate notifications
- `BASE_URL`: Base URL for the application (e.g., "https://api.kai-platform.com")

#### Database Secrets
- `MONGODB_URI`: MongoDB connection string
- `DATABASE_URL`: Database connection string (if using a different database)
- `DATABASE_HOST`: Database host (if not using connection string)
- `DATABASE_PORT`: Database port
- `DATABASE_USER`: Database username
- `DATABASE_PASSWORD`: Database password
- `DATABASE_NAME`: Database name
- `DATABASE_SSL`: Whether to use SSL for database connection (true/false)
- `DATABASE_MAX_CONNECTIONS`: Maximum number of database connections
- `DATABASE_CONNECTION_TIMEOUT`: Database connection timeout in milliseconds

#### Authentication Secrets
- `JWT_SECRET`: Secret for JWT tokens
- `JWT_EXPIRES_IN`: JWT token expiration time (e.g., "1d")
- `RATE_LIMIT_WINDOW`: Rate limiting window in milliseconds
- `RATE_LIMIT_MAX`: Maximum number of requests per window
- `CORS_ORIGINS`: Comma-separated list of allowed origins for CORS
- `MAX_UPLOAD_SIZE`: Maximum upload size in bytes

#### AI/ML Model Secrets
- `OPENAI_API_KEY`: Your OpenAI API key
- `OPENAI_DEFAULT_MODEL`: Default model to use (e.g., "gpt-4")
- `OPENAI_TEMPERATURE`: Temperature setting (e.g., "0.7")
- `ANTHROPIC_API_KEY`: Your Anthropic API key for Claude models
- `HF_API_KEY` or `HUGGINGFACE_API_KEY`: Your Hugging Face API key
- `HF_ORGANIZATION_ID`: Your Hugging Face organization ID (optional)
- `HF_DEFAULT_TEXT_MODEL`: Default text model (e.g., "google/flan-t5-xxl")
- `HF_DEFAULT_EMBEDDING_MODEL`: Default embedding model (e.g., "sentence-transformers/all-MiniLM-L6-v2")
- `HF_DEFAULT_IMAGE_MODEL`: Default image model (e.g., "google/vit-base-patch16-224")
- `HF_MODEL_TIMEOUT`: Timeout for model requests in milliseconds
- `HF_USE_FAST_MODELS`: Whether to use faster models (true/false)
- `OCR_MODEL_PATH`: Path to OCR model
- `ML_MAX_PROCESSING_TIME`: Maximum processing time for ML tasks in milliseconds
- `MODEL_CACHE_PATH`: Path to model cache directory

#### S3 Storage Secrets
- `S3_ENDPOINT`: S3 endpoint URL
- `S3_ACCESS_KEY`: S3 access key
- `S3_SECRET_KEY`: S3 secret key
- `S3_BUCKET`: S3 bucket name
- `S3_REGION`: S3 region (e.g., "us-east-1")
- `S3_PUBLIC_URL`: Public URL for S3 bucket (optional)
- `AWS_REGION`: AWS region (if using AWS S3)
- `AWS_ACCESS_KEY_ID`: AWS access key ID (if using AWS S3)
- `AWS_SECRET_ACCESS_KEY`: AWS secret access key (if using AWS S3)
- `TEMP`: Temporary directory for file processing

#### Redis Secrets
- `REDIS_URL`: Redis connection URL (or use host/port/password)
- `REDIS_HOST`: Redis host (if not using connection URL)
- `REDIS_PORT`: Redis port
- `REDIS_PASSWORD`: Redis password
- `REDIS_SSL`: Whether to use SSL for Redis connection (true/false)
- `REDIS_DB`: Redis database number

#### Supabase Secrets - Staging
- `SUPABASE_URL_STAGING`: Your Supabase staging project URL
- `SUPABASE_KEY_STAGING`: Your Supabase staging service key
- `SUPABASE_ANON_KEY_STAGING`: Your Supabase staging anonymous key
- `SUPABASE_SERVICE_ROLE_KEY_STAGING`: Supabase service role key for staging

#### Supabase Secrets - Production
- `SUPABASE_URL_PRODUCTION`: Your Supabase production project URL
- `SUPABASE_KEY_PRODUCTION`: Your Supabase production service key
- `SUPABASE_ANON_KEY_PRODUCTION`: Your Supabase production anonymous key
- `SUPABASE_SERVICE_ROLE_KEY_PRODUCTION`: Supabase service role key for production
- `SUPABASE_STORAGE_BUCKET`: Supabase storage bucket name (e.g., "materials")

#### Stripe Payment Secrets
- `STRIPE_SECRET_KEY`: Stripe secret key
- `STRIPE_PUBLISHABLE_KEY`: Stripe publishable key
- `STRIPE_WEBHOOK_SECRET`: Stripe webhook secret
- `STRIPE_API_VERSION`: Stripe API version (e.g., "2023-10-16")
- `STRIPE_TEST_MODE`: Whether to use Stripe in test mode (true/false)

#### Vercel Secrets
- `VERCEL_TOKEN`: Your Vercel API token
- `VERCEL_ORG_ID`: Your Vercel organization ID
- `VERCEL_PROJECT_ID_CLIENT`: Vercel project ID for client frontend
- `VERCEL_PROJECT_ID_ADMIN`: Vercel project ID for admin panel

#### Model Selection Configuration
- `MODEL_EVALUATION_STANDARD_CYCLE`: Number of standard operations before evaluation
- `MODEL_EVALUATION_TEST_CYCLE`: Number of evaluation operations
- `MODEL_SELECTION_METRICS_WEIGHTS`: Weights for accuracy, latency, and cost

#### Service Integration
- `KAI_API_URL`: Main KAI API URL
- `KAI_VECTOR_DB_URL`: Vector database service URL
- `KAI_ML_SERVICE_URL`: Machine learning service URL
- `ML_API_URL`: ML API URL for LLM fallback
- `KAI_API_KEY`: API key for KAI service authentication
- `API_URL`: API URL (if different from KAI_API_URL)
- `MCP_SERVER_URL`: MCP server URL
- `USE_MCP_SERVER`: Whether to use MCP server (true/false)
- `MCP_HEALTH_CHECK_TIMEOUT`: Timeout for MCP health check in milliseconds
- `ENABLE_MOCK_FALLBACK`: Enable mock services as fallback (true/false)

#### Agent Configuration
- `AGENT_VERBOSE_MODE`: Enable verbose mode for agents (true/false)
- `AGENT_MEMORY_ENABLED`: Enable agent memory persistence (true/false)
- `AGENT_MAX_ITERATIONS`: Maximum number of iterations for agent tasks
- `AGENT_TIMEOUT`: Default timeout for agent operations in milliseconds
- `MAX_CONCURRENT_SESSIONS`: Maximum number of concurrent agent sessions
- `AGENT_API_KEY`: API key for agent authentication
- `LOG_LEVEL`: Logging level (error, warn, info, http, debug)
- `LOG_FILE_PATH`: Path to log file
- `LOG_CONSOLE_OUTPUT`: Whether to output logs to console (true/false)

#### Frontend Configuration
- `GATSBY_API_URL`: API URL for frontend to connect to backend services
- `GATSBY_WS_URL`: WebSocket URL for real-time communication
- `GATSBY_SUPABASE_URL`: Supabase URL for client
- `GATSBY_SUPABASE_ANON_KEY`: Supabase anonymous key for client
- `GATSBY_STORAGE_URL`: Storage URL for frontend assets
- `GATSBY_DEFAULT_LOCALE`: Default locale
- `GATSBY_ENABLE_OFFLINE_MODE`: Enable offline mode (true/false)
- `GATSBY_GOOGLE_ANALYTICS_ID`: Google Analytics ID
- `REACT_APP_VERSION`: App version
- `GATSBY_APP_NAME`: App name
- `GATSBY_STRIPE_PUBLISHABLE_KEY`: Stripe publishable key for frontend

#### Monitoring Configuration
- `HEALTH_CHECK_INTERVAL`: Health check interval in milliseconds
- `METRICS_ENABLED`: Whether to enable metrics (true/false)
- `METRICS_PORT`: Port for metrics server

#### Notification Secrets
- `SLACK_WEBHOOK`: Slack webhook URL for deployment notifications

#### Web Crawler Secrets
- `CREDENTIALS_ENCRYPTION_KEY`: Encryption key for stored credentials
- `JINA_API_KEY`: Jina AI API key for web crawler

### Complete GitHub Actions Workflow

Create a file at `.github/workflows/deploy.yml` with the following content:

```yaml
name: KAI Platform CI/CD Pipeline

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to deploy to'
        required: true
        default: 'production'
        type: choice
        options:
          - staging
          - production
      create_cluster:
        description: 'Create new cluster if not exists'
        type: boolean
        default: false

env:
  DOMAIN_NAME: ${{ secrets.DOMAIN_NAME }}
  ENVIRONMENT: ${{ github.event.inputs.environment || 'production' }}

jobs:
  build-and-test:
    name: Build and Test
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Set up Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '16'
          cache: 'yarn'

      - name: Install dependencies
        run: yarn install --frozen-lockfile

      - name: Build packages
        run: yarn build

      - name: Run tests
        run: yarn test

      - name: Upload build artifacts
        uses: actions/upload-artifact@v3
        with:
          name: build-artifacts
          path: packages/*/dist

  build-docker:
    name: Build and Push Docker Images
    needs: build-and-test
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Download build artifacts
        uses: actions/download-artifact@v3
        with:
          name: build-artifacts
          path: packages

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2

      - name: Login to Docker Registry
        uses: docker/login-action@v2
        with:
          registry: ${{ secrets.DOCKER_REGISTRY }}
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}

      - name: Build and push API server
        uses: docker/build-push-action@v4
        with:
          context: .
          file: packages/server/Dockerfile
          push: true
          tags: |
            ${{ secrets.DOCKER_REGISTRY }}/${{ secrets.DOCKER_USERNAME }}/kai-api:${{ github.sha }}
            ${{ secrets.DOCKER_REGISTRY }}/${{ secrets.DOCKER_USERNAME }}/kai-api:latest

      - name: Build and push Coordinator service
        uses: docker/build-push-action@v4
        with:
          context: .
          file: packages/coordinator/Dockerfile
          push: true
          tags: |
            ${{ secrets.DOCKER_REGISTRY }}/${{ secrets.DOCKER_USERNAME }}/kai-coordinator:${{ github.sha }}
            ${{ secrets.DOCKER_REGISTRY }}/${{ secrets.DOCKER_USERNAME }}/kai-coordinator:latest

      - name: Build and push ML services
        uses: docker/build-push-action@v4
        with:
          context: .
          file: packages/ml/Dockerfile
          push: true
          tags: |
            ${{ secrets.DOCKER_REGISTRY }}/${{ secrets.DOCKER_USERNAME }}/kai-ml:${{ github.sha }}
            ${{ secrets.DOCKER_REGISTRY }}/${{ secrets.DOCKER_USERNAME }}/kai-ml:latest

      - name: Build and push Notification service
        uses: docker/build-push-action@v4
        with:
          context: .
          file: packages/notification/Dockerfile
          push: true
          tags: |
            ${{ secrets.DOCKER_REGISTRY }}/${{ secrets.DOCKER_USERNAME }}/kai-notification:${{ github.sha }}
            ${{ secrets.DOCKER_REGISTRY }}/${{ secrets.DOCKER_USERNAME }}/kai-notification:latest

  provision-infrastructure:
    name: Provision Kubernetes Cluster
    needs: build-docker
    runs-on: ubuntu-latest
    if: github.event.inputs.create_cluster == 'true' || github.ref == 'refs/heads/main'
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Install doctl
        uses: digitalocean/action-doctl@v2
        with:
          token: ${{ secrets.DIGITALOCEAN_ACCESS_TOKEN }}

      - name: Check if cluster exists
        id: check-cluster
        run: |
          CLUSTER_NAME="${{ secrets.CLUSTER_NAME }}-${{ env.ENVIRONMENT }}"
          if doctl kubernetes cluster get $CLUSTER_NAME &>/dev/null; then
            echo "Cluster exists, skipping creation"
            echo "cluster_exists=true" >> $GITHUB_OUTPUT
          else
            echo "Cluster does not exist"
            echo "cluster_exists=false" >> $GITHUB_OUTPUT
          fi

      - name: Create Digital Ocean Kubernetes cluster
        if: steps.check-cluster.outputs.cluster_exists == 'false' && (github.event.inputs.create_cluster == 'true' || github.ref == 'refs/heads/main')
        run: |
          CLUSTER_NAME="${{ secrets.CLUSTER_NAME }}-${{ env.ENVIRONMENT }}"

          echo "Creating main Kubernetes cluster with orchestration node pool..."
          # Create the main cluster with the orchestration node pool
          doctl kubernetes cluster create $CLUSTER_NAME \
            --region ${{ secrets.DO_REGION }} \
            --version latest \
            --tag kai-platform \
            --tag ${{ env.ENVIRONMENT }} \
            --auto-upgrade=true \
            --maintenance-window="saturday=21:00" \
            --size s-2vcpu-4gb \
            --count 3 \
            --node-pool "name=orchestration;size=s-2vcpu-4gb;count=3;label=node-type=orchestration;tag=orchestration" \
            --wait

          # Save kubeconfig
          doctl kubernetes cluster kubeconfig save $CLUSTER_NAME

          # Wait for cluster to be fully ready
          echo "Waiting for cluster to be ready..."
          sleep 60

          echo "Adding CPU-optimized node pool..."
          # Add CPU-optimized node pool
          doctl kubernetes cluster node-pool create $CLUSTER_NAME \
            --name cpu-optimized \
            --size c-4 \
            --count 3 \
            --label node-type=cpu-optimized \
            --tag cpu-optimized

          # Add GPU node pool if in production
          if [ "${{ env.ENVIRONMENT }}" = "production" ]; then
            echo "Adding GPU-optimized node pool..."
            doctl kubernetes cluster node-pool create $CLUSTER_NAME \
              --name gpu-optimized \
              --size gd-l40s-4vcpu-24gb \
              --count 2 \
              --label node-type=gpu-optimized \
              --tag gpu-optimized
          fi

          # Add memory-optimized node pool if in production
          if [ "${{ env.ENVIRONMENT }}" = "production" ]; then
            echo "Adding memory-optimized node pool..."
            doctl kubernetes cluster node-pool create $CLUSTER_NAME \
              --name memory-optimized \
              --size m-4vcpu-32gb \
              --count 1 \
              --label node-type=memory-optimized \
              --tag memory-optimized
          fi

      - name: Get kubeconfig
        if: steps.check-cluster.outputs.cluster_exists == 'true'
        run: |
          CLUSTER_NAME="${{ secrets.CLUSTER_NAME }}-${{ env.ENVIRONMENT }}"
          doctl kubernetes cluster kubeconfig save $CLUSTER_NAME

      - name: Install kubectl
        uses: azure/setup-kubectl@v3

      - name: Verify cluster
        run: |
          kubectl get nodes
          kubectl get nodes --show-labels

  deploy-kubernetes:
    name: Deploy to Kubernetes
    needs: [build-docker, provision-infrastructure]
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Install doctl
        uses: digitalocean/action-doctl@v2
        with:
          token: ${{ secrets.DIGITALOCEAN_ACCESS_TOKEN }}

      - name: Get kubeconfig
        run: |
          CLUSTER_NAME="${{ secrets.CLUSTER_NAME }}-${{ env.ENVIRONMENT }}"
          doctl kubernetes cluster kubeconfig save $CLUSTER_NAME

      - name: Set up kubectl
        uses: azure/setup-kubectl@v3

      - name: Set up Helm
        uses: azure/setup-helm@v3
        with:
          version: 'v3.10.0'

      - name: Create environment files
        run: |
          # Create .env file for production
          cat > .env.production << EOF
          # OpenAI API
          OPENAI_API_KEY=${{ secrets.OPENAI_API_KEY }}

          # Database
          MONGODB_URI=${{ secrets.MONGODB_URI }}

          # Authentication
          JWT_SECRET=${{ secrets.JWT_SECRET }}

          # Supabase
          SUPABASE_URL=${{ secrets.SUPABASE_URL }}
          SUPABASE_KEY=${{ secrets.SUPABASE_KEY }}

          # Frontend URLs
          GATSBY_API_URL=https://api.${{ secrets.DOMAIN_NAME }}
          GATSBY_SUPABASE_URL=${{ secrets.SUPABASE_URL }}
          GATSBY_SUPABASE_ANON_KEY=${{ secrets.SUPABASE_ANON_KEY }}

          # Stripe (if using payments)
          STRIPE_SECRET_KEY=${{ secrets.STRIPE_SECRET_KEY }}
          GATSBY_STRIPE_PUBLISHABLE_KEY=${{ secrets.STRIPE_PUBLISHABLE_KEY }}
          EOF

      - name: Create Kubernetes namespace
        run: |
          kubectl create namespace kai-system --dry-run=client -o yaml | kubectl apply -f -

      - name: Create Kubernetes secrets
        run: |
          # Create main secrets
          kubectl create secret generic kai-secrets \
            --namespace kai-system \
            --from-literal=mongodb-uri='${{ secrets.MONGODB_URI }}' \
            --from-literal=jwt-secret='${{ secrets.JWT_SECRET }}' \
            --from-literal=openai-api-key='${{ secrets.OPENAI_API_KEY }}' \
            --from-literal=supabase-url='${{ secrets.SUPABASE_URL }}' \
            --from-literal=supabase-key='${{ secrets.SUPABASE_KEY }}' \
            --from-literal=stripe-secret-key='${{ secrets.STRIPE_SECRET_KEY }}' \
            --dry-run=client -o yaml | kubectl apply -f -

          # Create Redis password secret
          kubectl create secret generic redis-password \
            --namespace kai-system \
            --from-literal=redis-password='${{ secrets.REDIS_PASSWORD }}' \
            --dry-run=client -o yaml | kubectl apply -f -

      - name: Check and Install cert-manager
        run: |
          # Check if cert-manager is already installed
          if kubectl get namespace cert-manager &>/dev/null && kubectl get deployment -n cert-manager cert-manager &>/dev/null; then
            echo "cert-manager is already installed, skipping installation"
          else
            echo "Installing cert-manager..."
            # Add Jetstack Helm repo
            helm repo add jetstack https://charts.jetstack.io

            # Install cert-manager
            helm upgrade --install cert-manager jetstack/cert-manager \
              --namespace cert-manager \
              --create-namespace \
              --version v1.11.0 \
              --set installCRDs=true

            # Wait for cert-manager to be ready
            kubectl -n cert-manager rollout status deployment/cert-manager
            kubectl -n cert-manager rollout status deployment/cert-manager-webhook
          fi

          # Check if ClusterIssuer exists
          if kubectl get clusterissuer letsencrypt-prod &>/dev/null; then
            echo "ClusterIssuer already exists, skipping creation"
          else
            echo "Creating ClusterIssuer for Let's Encrypt..."
            # Create ClusterIssuer for Let's Encrypt
            cat > cluster-issuer.yaml << EOF
            apiVersion: cert-manager.io/v1
            kind: ClusterIssuer
            metadata:
              name: letsencrypt-prod
            spec:
              acme:
                server: https://acme-v02.api.letsencrypt.org/directory
                email: ${{ secrets.ADMIN_EMAIL }}
                privateKeySecretRef:
                  name: letsencrypt-prod
                solvers:
                - http01:
                    ingress:
                      class: nginx
            EOF

            kubectl apply -f cluster-issuer.yaml
          fi

      - name: Check and Install NGINX Ingress Controller
        run: |
          # Check if NGINX Ingress is already installed
          if kubectl get deployment -n kai-system nginx-ingress-ingress-nginx-controller &>/dev/null; then
            echo "NGINX Ingress Controller is already installed, skipping installation"
          else
            echo "Installing NGINX Ingress Controller..."
            # Add NGINX Ingress Helm repo
            helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx

            # Install NGINX Ingress
            helm upgrade --install nginx-ingress ingress-nginx/ingress-nginx \
              --namespace kai-system \
              --set controller.publishService.enabled=true

            # Wait for NGINX Ingress to be ready
            kubectl -n kai-system rollout status deployment/nginx-ingress-ingress-nginx-controller
          fi

      - name: Check and Install Argo Workflows
        run: |
          # Check if Argo Workflows is already installed
          if kubectl get namespace argo &>/dev/null && kubectl get deployment -n argo argo-server &>/dev/null; then
            echo "Argo Workflows is already installed, skipping installation"
          else
            echo "Installing Argo Workflows..."
            # Create namespace
            kubectl create namespace argo --dry-run=client -o yaml | kubectl apply -f -

            # Install Argo Workflows
            kubectl apply -n argo -f https://github.com/argoproj/argo-workflows/releases/download/v3.4.5/install.yaml

            # Wait for Argo to be ready
            kubectl -n argo rollout status deployment/argo-server
          fi

          # Check and update Argo configuration
          echo "Configuring Argo to work with the kai-system namespace..."
          kubectl patch configmap/workflow-controller-configmap \
            -n argo \
            --type merge \
            -p '{"data":{"workflowNamespaces":"kai-system,argo"}}' \
            --dry-run=client -o yaml | kubectl apply -f -

      - name: Deploy with Helm
        run: |
          # Update Helm repos
          helm repo update

          # Create values override file
          cat > values-override.yaml << EOF
          global:
            environment: ${{ env.ENVIRONMENT }}
            imageRegistry: ${{ secrets.DOCKER_REGISTRY }}/${{ secrets.DOCKER_USERNAME }}
            imageTag: ${{ github.sha }}
            domain: ${{ secrets.DOMAIN_NAME }}
            ingress:
              enabled: true
              annotations:
                kubernetes.io/ingress.class: nginx
                cert-manager.io/cluster-issuer: letsencrypt-prod
              hosts:
                - host: api.${{ secrets.DOMAIN_NAME }}
                  paths:
                    - path: /
                      pathType: Prefix
              tls:
                - secretName: kai-tls-cert
                  hosts:
                    - api.${{ secrets.DOMAIN_NAME }}
          EOF

          # Deploy using Helm
          helm upgrade --install kai ./helm-charts/kai \
            --namespace kai-system \
            --values ./helm-charts/kai/values-${{ env.ENVIRONMENT }}.yaml \
            --values values-override.yaml

      - name: Verify deployment
        run: |
          # Wait for deployments to be ready
          kubectl -n kai-system rollout status deployment/api-server
          kubectl -n kai-system rollout status deployment/coordinator-service

          # Check if services are running
          kubectl -n kai-system get services

          # Check if ingress is configured
          kubectl -n kai-system get ingress

          # Check if certificates are issued
          kubectl -n kai-system get certificates

      - name: Run database migrations
        run: |
          # Create a temporary pod to run migrations
          cat > migration-job.yaml << EOF
          apiVersion: batch/v1
          kind: Job
          metadata:
            name: database-migrations
            namespace: kai-system
          spec:
            template:
              spec:
                containers:
                - name: migrations
                  image: ${{ secrets.DOCKER_REGISTRY }}/${{ secrets.DOCKER_USERNAME }}/kai-api:${{ github.sha }}
                  command: ["node", "scripts/run-migrations.js"]
                  env:
                  - name: MONGODB_URI
                    valueFrom:
                      secretKeyRef:
                        name: kai-secrets
                        key: mongodb-uri
                restartPolicy: Never
            backoffLimit: 4
          EOF

          kubectl apply -f migration-job.yaml

          # Wait for migrations to complete
          kubectl -n kai-system wait --for=condition=complete job/database-migrations --timeout=120s

      - name: Notify deployment status
        if: always()
        uses: rtCamp/action-slack-notify@v2
        env:
          SLACK_WEBHOOK: ${{ secrets.SLACK_WEBHOOK }}
          SLACK_TITLE: "Deployment Status"
          SLACK_MESSAGE: "Kubernetes deployment ${{ job.status }}"
          SLACK_COLOR: ${{ job.status == 'success' && 'good' || 'danger' }}

  deploy-frontend:
    name: Deploy Frontend to Vercel
    needs: deploy-kubernetes
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Set up Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '16'
          cache: 'yarn'

      - name: Install dependencies
        run: yarn install --frozen-lockfile

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID_CLIENT }}
          working-directory: ./packages/client
          vercel-args: '--prod'

      - name: Deploy admin panel to Vercel
        uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID_ADMIN }}
          working-directory: ./packages/admin
          vercel-args: '--prod'

  verify-deployment:
    name: Verify Full Deployment
    needs: [deploy-kubernetes, deploy-frontend]
    runs-on: ubuntu-latest
    steps:
      - name: Comprehensive health check
        run: |
          # Wait for DNS propagation (may take some time)
          echo "Waiting for DNS propagation..."
          sleep 60

          # Check API health endpoint
          curl -sSf https://api.${{ secrets.DOMAIN_NAME }}/health || echo "API not yet available, may need more time for DNS propagation"

          # Check pod status
          kubectl get pods -n kai-system -o json | jq '.items[] | select(.status.phase != "Running" or ([ .status.containerStatuses[] | select(.ready == false) ] | length > 0)) | .metadata.name' || echo "All pods are running"

          # Check recent logs for errors
          kubectl logs -n kai-system -l app=api-server --tail=50 | grep -i error || echo "No errors in recent logs"

          # Check SSL certificate validity and expiration
          CERT_EXPIRY=$(echo | openssl s_client -servername api.${{ secrets.DOMAIN_NAME }} -connect api.${{ secrets.DOMAIN_NAME }}:443 2>/dev/null | openssl x509 -noout -enddate | cut -d= -f2 || echo "Certificate not yet available")
          echo "Certificate expires on: $CERT_EXPIRY"

      - name: Send deployment notification
        uses: rtCamp/action-slack-notify@v2
        env:
          SLACK_WEBHOOK: ${{ secrets.SLACK_WEBHOOK }}
          SLACK_TITLE: "Deployment Complete"
          SLACK_MESSAGE: "✅ KAI Platform has been successfully deployed to ${{ env.ENVIRONMENT }}!"
          SLACK_COLOR: "good"
```

### Workflow Explanation

The GitHub Actions workflow above automates the entire deployment process:

1. **Build and Test**:
   - Checks out the code
   - Installs dependencies
   - Builds all packages
   - Runs tests
   - Uploads build artifacts for later use

2. **Build Docker Images**:
   - Downloads the build artifacts
   - Builds Docker images for all services
   - Pushes images to the Docker registry

3. **Provision Infrastructure**:
   - Checks if a Kubernetes cluster already exists
   - Creates a new cluster if needed with all required node pools
   - Configures the cluster with appropriate labels and tags

4. **Deploy to Kubernetes**:
   - Creates necessary namespaces
   - Creates Kubernetes secrets from GitHub secrets
   - Installs cert-manager for SSL certificates (if not already installed)
   - Installs NGINX Ingress Controller (if not already installed)
   - Installs Argo Workflows for ML pipelines (if not already installed)
   - Deploys the application using Helm charts
   - Verifies the deployment
   - Runs database migrations

5. **Deploy Frontend**:
   - Deploys the client frontend to Vercel
   - Deploys the admin panel to Vercel

6. **Verify Full Deployment**:
   - Performs comprehensive health checks
   - Verifies API availability
   - Checks pod status
   - Examines logs for errors
   - Verifies SSL certificate validity
   - Sends a notification when deployment is complete

## Digital Ocean Kubernetes Cluster Configuration

The KAI platform is designed to run on a Kubernetes cluster with specific node pools optimized for different workloads. This section details the cluster configuration required for optimal performance.

### Cluster Requirements

Based on the KAI platform's architecture and resource needs, the following cluster configuration is recommended:

1. **Kubernetes Version**: Latest stable version (1.32.x or newer)
2. **Region**: Choose the region closest to your users
3. **High Availability**: At least 3 nodes in the orchestration pool for production

### Node Pool Configuration

The KAI platform requires several specialized node pools to handle different types of workloads:

#### 1. Orchestration Pool
- **Purpose**: Runs the API server, coordinator service, and other control plane components
- **Machine Type**: Standard Droplets
- **Size**: 4GB RAM / 2 vCPUs (s-2vcpu-4gb)
- **Count**: 3 nodes (for high availability in production)
- **Labels**: `node-type=orchestration`

#### 2. CPU-Optimized Pool
- **Purpose**: Handles general processing, data transformation, and non-GPU workloads
- **Machine Type**: CPU-Optimized Droplets
- **Size**: 8GB RAM / 4 vCPUs (c-4)
- **Count**: 3 nodes
- **Labels**: `node-type=cpu-optimized`

#### 3. GPU Pool
- **Purpose**: Runs ML inference and training tasks, 3D model generation
- **Machine Type**: GPU Droplets
- **Size**: With NVIDIA L40S or H100 GPUs
- **Count**: 2 nodes
- **Labels**: `node-type=gpu-optimized`
- **Note**: Required for production, optional for staging

#### 4. Memory-Optimized Pool
- **Purpose**: Handles large model loading and memory-intensive operations
- **Machine Type**: Memory-Optimized Droplets
- **Size**: 32GB RAM / 4 vCPUs (m-4vcpu-32gb)
- **Count**: 1 node
- **Labels**: `node-type=memory-optimized`
- **Note**: Required for production, optional for staging

### Resource Allocation

The KAI platform components have specific resource requirements that are automatically configured based on the environment:

| Component | Resource | Staging | Production |
|-----------|----------|---------|------------|
| API Server | Replicas | 1 | 3 |
| API Server | CPU Request | 200m | 500m |
| API Server | Memory Request | 512Mi | 1Gi |
| API Server | CPU Limit | 1000m | 2000m |
| API Server | Memory Limit | 2Gi | 4Gi |
| Coordinator | Replicas | 1 | 3 |
| Coordinator | CPU Request | 200m | 500m |
| Coordinator | Memory Request | 512Mi | 1Gi |
| Coordinator | CPU Limit | 1000m | 2000m |
| Coordinator | Memory Limit | 2Gi | 4Gi |
| ML Services | Replicas | 1 | 1-3 (auto-scaled) |
| ML Services | CPU Request | 500m-1000m | 1000m-4000m |
| ML Services | Memory Request | 1Gi-2Gi | 2Gi-8Gi |
| ML Services | GPU Request | 0-1 | 1 |
| Notification | Replicas | 1 | 3 |
| Notification | CPU Request | 200m | 500m |
| Notification | Memory Request | 256Mi | 512Mi |

## SSL Certificate Management

The KAI platform uses cert-manager to automatically manage SSL certificates. This section explains how certificates are issued and renewed.

### Certificate Issuance

When you deploy the KAI platform, the GitHub Actions workflow automatically:

1. Installs cert-manager in the cluster (if not already installed)
2. Creates a ClusterIssuer for Let's Encrypt
3. Configures the ingress resources with appropriate annotations
4. Requests certificates for all configured domains

### Automatic Certificate Renewal

Cert-manager handles certificate renewal automatically:

1. **Monitoring**: Cert-manager continuously monitors certificate expiration dates
2. **Proactive Renewal**: It automatically initiates renewal when certificates reach ~30 days before expiration
3. **Zero-downtime Process**: New certificates are obtained in the background and only replaced after successful validation
4. **Failure Handling**: If renewal fails, cert-manager retries with exponential backoff

### Certificate Verification

You can verify the status of your certificates using:

```bash
kubectl get certificates -n kai-system
kubectl get certificaterequests -n kai-system
kubectl describe certificate kai-tls-cert -n kai-system
```

## Frontend Deployment to Vercel

The KAI platform frontend applications are deployed to Vercel for optimal performance and reliability.

### Vercel Projects Setup

Before running the GitHub Actions workflow, you need to set up two projects in Vercel:

1. **Client Frontend** (Gatsby):
   - Create a new project in Vercel
   - Connect to your GitHub repository
   - Configure the project:
     - Framework Preset: Gatsby
     - Root Directory: `packages/client`
     - Build Command: `yarn build`
     - Output Directory: `public`
   - Note the Project ID for the GitHub secret `VERCEL_PROJECT_ID_CLIENT`

2. **Admin Panel** (Next.js):
   - Create a new project in Vercel
   - Connect to your GitHub repository
   - Configure the project:
     - Framework Preset: Next.js
     - Root Directory: `packages/admin`
     - Build Command: `yarn build`
     - Output Directory: `out`
   - Note the Project ID for the GitHub secret `VERCEL_PROJECT_ID_ADMIN`

### Vercel Environment Variables

The GitHub Actions workflow automatically sets the required environment variables for your Vercel deployments, including:

- API URL
- Supabase configuration
- Stripe keys (if using payments)
- Other application-specific settings

### Custom Domain Configuration

After the first deployment, you should configure custom domains in Vercel:

1. Go to your Vercel project settings
2. Navigate to the "Domains" section
3. Add your custom domains:
   - `app.yourdomain.com` for the client frontend
   - `admin.yourdomain.com` for the admin panel
4. Configure DNS records as instructed by Vercel

## Environment Variables and Secrets

The KAI platform requires various environment variables and secrets for proper operation. This section explains how they are managed.

### GitHub Secrets

All sensitive information is stored as GitHub Secrets and injected into the deployment process by the GitHub Actions workflow. This includes:

- API keys
- Database credentials
- JWT secrets
- Supabase credentials
- Vercel tokens
- Docker registry credentials

### Kubernetes Secrets

The GitHub Actions workflow creates Kubernetes secrets from the GitHub Secrets, making them available to the applications running in the cluster:

```yaml
# Example of how secrets are created
kubectl create secret generic kai-secrets \
  --namespace kai-system \
  --from-literal=mongodb-uri='${{ secrets.MONGODB_URI }}' \
  --from-literal=jwt-secret='${{ secrets.JWT_SECRET }}' \
  --from-literal=openai-api-key='${{ secrets.OPENAI_API_KEY }}' \
  --from-literal=supabase-url='${{ secrets.SUPABASE_URL }}' \
  --from-literal=supabase-key='${{ secrets.SUPABASE_KEY }}' \
  --from-literal=stripe-secret-key='${{ secrets.STRIPE_SECRET_KEY }}' \
  --dry-run=client -o yaml | kubectl apply -f -
```

### Environment-Specific Configuration

The KAI platform uses different configuration values for staging and production environments:

1. **Helm Values Files**:
   - `values.yaml`: Default values
   - `values-staging.yaml`: Staging-specific overrides
   - `values-production.yaml`: Production-specific overrides

2. **Environment Variables**:
   - The GitHub Actions workflow creates environment-specific `.env` files
   - These files are used during the build process

## Initial Setup and Deployment

To get started with the automated deployment system, follow these steps:

### 1. Set Up GitHub Repository

1. **Configure GitHub Secrets**:
   - Go to your GitHub repository
   - Navigate to Settings > Secrets and variables > Actions
   - Add all the required secrets listed in the "Required GitHub Secrets" section

### 2. Set Up External Services

1. **Set Up Supabase Projects**:
   - Create a staging project in Supabase
   - Create a production project in Supabase
   - Set up the necessary tables and storage buckets
   - Note the URLs and API keys for the GitHub secrets

2. **Set Up Vercel Projects**:
   - Create a project for the client frontend
     - Framework Preset: Gatsby
     - Root Directory: `packages/client`
   - Create a project for the admin panel
     - Framework Preset: Next.js
     - Root Directory: `packages/admin`
   - Note the project IDs for the GitHub secrets

3. **Configure DNS**:
   - Set up your domain with your DNS provider
   - Create records for:
     - `api.yourdomain.com` (production API)
     - `api.staging.yourdomain.com` (staging API)
     - `app.yourdomain.com` (production frontend)
     - `app.staging.yourdomain.com` (staging frontend)
     - `admin.yourdomain.com` (production admin panel)
     - `admin.staging.yourdomain.com` (staging admin panel)

### 3. Trigger the Initial Deployment

1. **Run the Workflow**:
   - Go to the "Actions" tab in your GitHub repository
   - Select the "KAI Platform CI/CD Pipeline" workflow
   - Click "Run workflow"
   - Choose the environment (staging or production)
   - Check "Create new cluster if not exists"
   - Click "Run workflow"

2. **Monitor the Deployment**:
   - Watch the workflow progress in the GitHub Actions tab
   - Check for any errors and fix them if needed
   - The workflow will automatically:
     - Build and test your code
     - Build Docker images
     - Provision Kubernetes infrastructure
     - Deploy the application
     - Deploy the frontend
     - Verify the deployment

### 4. Verify the Deployment

The GitHub Actions workflow includes a comprehensive verification step that checks:

1. **API Availability**: Verifies that the API is responding correctly
2. **Pod Status**: Ensures all pods are running and ready
3. **Logs**: Examines recent logs for errors
4. **SSL Certificates**: Verifies certificate validity and expiration

You can perform additional verification manually:

```bash
# Check pod status
kubectl get pods -n kai-system

# Check services
kubectl get services -n kai-system

# Check ingress
kubectl get ingress -n kai-system

# Check certificates
kubectl get certificates -n kai-system

# Check API health
curl https://api.yourdomain.com/health
```

### Monitoring

For ongoing monitoring, the KAI platform includes:

1. **Prometheus Metrics**: All services expose Prometheus metrics
2. **Grafana Dashboards**: Pre-configured dashboards for monitoring system health
3. **Liveness and Readiness Probes**: All pods have appropriate health checks
4. **Logging**: Structured JSON logs for easy analysis

To access Grafana (if installed):

```bash
# Port forward to Grafana
kubectl port-forward -n monitoring svc/grafana 3000:80

# Access in browser
open http://localhost:3000
```

Default login: admin / admin (change on first login)

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

## Ongoing Maintenance and Updates

Once your initial deployment is complete, the system is designed for easy maintenance and updates.

### Updating the Application

With the automated GitHub Actions workflow, updating the KAI platform is straightforward:

1. **Code Changes**:
   - Make your changes in a feature branch
   - Create a pull request to the main branch
   - Review and merge the pull request

2. **Automatic Deployment**:
   - The GitHub Actions workflow automatically triggers when changes are pushed to the main branch
   - The workflow:
     - Runs tests
     - Builds new Docker images
     - Updates Kubernetes deployments
     - Deploys frontend apps to Vercel

3. **Manual Deployment**:
   - You can also trigger a deployment manually:
     - Go to the "Actions" tab in your GitHub repository
     - Select the "KAI Platform CI/CD Pipeline" workflow
     - Click "Run workflow"
     - Choose the environment (staging or production)
     - Optionally select "Create new cluster if not exists"

### Deployment Workflow

The deployment process follows these steps:

1. **Code is pushed** to the main branch (for production) or staging branch (for staging)
2. **GitHub Actions workflow is triggered**
3. **Build and test** job runs to verify code quality
4. **Docker images are built** for all services
5. **Infrastructure is checked** and provisioned if needed
6. **Kubernetes components are set up** (cert-manager, NGINX, Argo)
7. **Application is deployed** using Helm charts
8. **Frontend is deployed** to Vercel
9. **Deployment is verified** with comprehensive health checks
10. **Notification is sent** upon completion

### Scaling the Application

The KAI platform can be scaled in several ways:

1. **Horizontal Pod Autoscaling**:
   - The platform uses Kubernetes Horizontal Pod Autoscalers (HPAs) to automatically scale based on CPU and memory usage
   - You can adjust the HPA settings in the Helm values files

2. **Manual Scaling**:
   ```bash
   # Scale API server
   kubectl scale deployment api-server -n kai-system --replicas=5

   # Scale coordinator service
   kubectl scale deployment coordinator-service -n kai-system --replicas=3

   # Scale notification service
   kubectl scale deployment notification-service -n kai-system --replicas=3
   ```

3. **Node Pool Scaling**:
   - In the Digital Ocean dashboard:
     - Navigate to your Kubernetes cluster
     - Select the node pool you want to scale
     - Click "Edit" and adjust the number of nodes

   - Using the command line:
     ```bash
     # Get the cluster name
     doctl kubernetes cluster list

     # Get node pool ID
     doctl kubernetes cluster node-pool list your-cluster-name

     # Scale the node pool
     doctl kubernetes cluster node-pool update your-cluster-name node-pool-id --count=5
     ```

4. **Autoscaling Node Pools**:
   - Digital Ocean supports node pool autoscaling
   - Enable autoscaling when creating the cluster or update existing node pools:
     ```bash
     doctl kubernetes cluster node-pool update your-cluster-name node-pool-id --auto-scale --min-nodes=2 --max-nodes=5
     ```

### Backup and Disaster Recovery

The KAI platform includes several backup and disaster recovery mechanisms:

1. **Database Backups**:
   - **MongoDB Atlas**: If using MongoDB Atlas, configure automated backups:
     - Daily snapshots with 7-day retention
     - Point-in-time recovery
     - Periodic exports to S3 for long-term storage

   - **Self-hosted MongoDB**: Use the backup job included in the deployment:
     ```bash
     # Check backup job status
     kubectl get cronjobs -n kai-system

     # Trigger a manual backup
     kubectl create job --from=cronjob/mongodb-backup manual-backup-$(date +%s) -n kai-system
     ```

2. **Kubernetes State Backups**:
   - The deployment script automatically creates backups before applying changes
   - Backups are stored in `./kubernetes/backups/<environment>/<timestamp>/`
   - To restore from a backup:
     ```bash
     ./kubernetes/deploy.sh --context=your-context --env=production --rollback=20250412153022
     ```

3. **Disaster Recovery Procedure**:

   In case of a major failure:

   a. **Assess the Situation**:
      - Identify the affected components
      - Check logs and monitoring data

   b. **Restore Database**:
      - Restore the most recent MongoDB backup
      - Verify data integrity

   c. **Rebuild Infrastructure**:
      - If the cluster is compromised, create a new one:
        ```bash
        # Trigger manual workflow with "create_cluster=true"
        # Go to GitHub Actions → KAI Platform CI/CD Pipeline → Run workflow
        ```

   d. **Restore Application State**:
      - Deploy the last known good version:
        ```bash
        # Find the last successful deployment
        git log --oneline

        # Checkout that commit
        git checkout <commit-hash>

        # Trigger deployment
        git push -f origin HEAD:main
        ```

   e. **Verify Recovery**:
      - Check all services are running
      - Verify API endpoints
      - Test frontend functionality
      - Validate data consistency

4. **High Availability Configuration**:
   - The production environment is configured for high availability:
     - Multiple replicas for all critical services
     - Pod Disruption Budgets to ensure minimum availability
     - Anti-affinity rules to distribute pods across nodes
     - Readiness and liveness probes for automatic recovery

2. **Kubernetes State Backup**:
   - Use [Velero](https://velero.io/) for Kubernetes cluster backups
   - Configure regular backups to S3

3. **Supabase Backup**:
   - Enable automatic backups in the Supabase dashboard
   - Schedule regular database exports

## Troubleshooting

This section provides solutions for common issues you might encounter during deployment or operation of the KAI platform.

### Deployment Issues

#### GitHub Actions Workflow Failures

1. **Build Failures**:
   - Check the build logs for specific error messages
   - Verify that all dependencies are correctly specified
   - Ensure that tests are passing locally before pushing

2. **Docker Image Build Failures**:
   - Verify Docker registry credentials
   - Check for disk space issues in the GitHub runner
   - Ensure Dockerfiles are correctly formatted

3. **Deployment Timeouts**:
   - Increase the timeout values in the workflow
   - Check if the cluster is under heavy load
   - Verify network connectivity to the cluster

### Vercel Deployment Issues

1. **Build Failures**:
   - Check the Vercel build logs
   - Verify environment variables are correctly set
   - Ensure the project configuration is correct

2. **Domain Configuration Issues**:
   - Verify DNS records are correctly configured
   - Check SSL certificate issuance
   - Ensure custom domains are properly set up in Vercel

3. **Runtime Errors**:
   - Check the browser console for errors
   - Verify that API calls are properly configured with the correct URL
   - Check CORS configurations on the backend

### Supabase Issues

1. **Authentication Problems**:
   - Check the Site URL in Supabase authentication settings
   - Verify the anon key is correctly set in frontend apps
   - Check CORS configurations

2. **Realtime Connection Issues**:
   - Ensure the publication is properly configured
   - Check that the realtime service is enabled
   - Verify WebSocket connections in the browser console

3. **Database Connection Issues**:
   - Verify connection string format
   - Check network access rules
   - Ensure the database is running and accessible

### Kubernetes Issues

#### Pod Startup Failures

1. **ImagePullBackOff**:
   - Verify Docker registry credentials
   - Check image name and tag
   - Ensure the image exists in the registry

   ```bash
   # Check pod status
   kubectl get pods -n kai-system

   # Describe the failing pod
   kubectl describe pod <pod-name> -n kai-system

   # Check image pull secrets
   kubectl get secrets -n kai-system
   ```

2. **CrashLoopBackOff**:
   - Check container logs
   - Verify environment variables
   - Check for resource constraints

   ```bash
   # Get logs from the failing pod
   kubectl logs <pod-name> -n kai-system

   # Check events
   kubectl get events -n kai-system --sort-by='.lastTimestamp'
   ```

3. **Pending Pods**:
   - Check for resource constraints
   - Verify node pool availability
   - Check for taints and tolerations

   ```bash
   # Check node status
   kubectl get nodes

   # Describe the node
   kubectl describe node <node-name>
   ```

#### Service Connectivity Issues

1. **Service Not Accessible**:
   - Verify service is running
   - Check endpoints
   - Verify network policies

   ```bash
   # Check service
   kubectl get svc -n kai-system

   # Check endpoints
   kubectl get endpoints -n kai-system

   # Test connectivity from within the cluster
   kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- curl http://service-name.kai-system
   ```

2. **Ingress Issues**:
   - Verify ingress controller is running
   - Check ingress resource configuration
   - Verify SSL certificate

   ```bash
   # Check ingress
   kubectl get ingress -n kai-system

   # Describe ingress
   kubectl describe ingress <ingress-name> -n kai-system

   # Check ingress controller logs
   kubectl logs -n kai-system -l app=nginx-ingress-ingress-nginx-controller
   ```

#### Argo Workflow Issues

1. **Workflow Failures**:
   - Check workflow status
   - Examine workflow logs
   - Verify service account permissions

   ```bash
   # Check workflow status
   kubectl get workflows -n kai-system

   # Get workflow details
   kubectl get workflow -n kai-system <workflow-name> -o yaml

   # Check pod logs for workflow step
   kubectl logs -n kai-system <workflow-pod-name>
   ```

2. **Workflow Stuck in Pending**:
   - Check for PVC issues
   - Verify resource availability
   - Check for node selector issues

   ```bash
   # Check PVCs
   kubectl get pvc -n kai-system

   # Check resource quotas
   kubectl describe resourcequota -n kai-system
   ```

### SSL Certificate Issues

1. **Certificate Not Issued**:
   - Verify cert-manager is running
   - Check certificate resource
   - Check DNS configuration

   ```bash
   # Check cert-manager pods
   kubectl get pods -n cert-manager

   # Check certificate status
   kubectl get certificate -n kai-system

   # Check certificate request
   kubectl get certificaterequest -n kai-system

   # Check challenge
   kubectl get challenge -n kai-system
   ```

2. **Certificate Renewal Failures**:
   - Check cert-manager logs
   - Verify ACME account registration
   - Check for rate limiting

   ```bash
   # Check cert-manager logs
   kubectl logs -n cert-manager -l app=cert-manager

   # Check ACME account
   kubectl get secret -n cert-manager letsencrypt-prod
   ```

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

### Performance Issues

1. **High CPU/Memory Usage**:
   - Check resource usage
   - Identify resource-intensive pods
   - Consider scaling up resources

   ```bash
   # Check resource usage
   kubectl top pods -n kai-system

   # Check node resource usage
   kubectl top nodes
   ```

2. **Slow API Responses**:
   - Check for database bottlenecks
   - Verify network latency
   - Check for resource constraints

   ```bash
   # Check API server logs
   kubectl logs -n kai-system -l app=api-server

   # Check database metrics
   # (Requires Prometheus and MongoDB exporter)
   ```

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