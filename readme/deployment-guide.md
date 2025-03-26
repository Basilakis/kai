# Kai Deployment Guide

This guide provides detailed instructions for deploying the Kai application to production environments using Supabase, Vercel, and Digital Ocean Kubernetes. It includes setup procedures, environment configuration, and CI/CD pipeline instructions.

## Table of Contents

- [Prerequisites](#prerequisites)
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

Digital Ocean Kubernetes (DOKS) is used to deploy the backend API server and ML services.

### 1. Setting up a Kubernetes Cluster

1. Log in to [Digital Ocean](https://cloud.digitalocean.com/)
2. Navigate to Kubernetes → Create → Kubernetes
3. Configure the cluster:
   - Kubernetes Version: Latest stable version
   - Datacenter Region: Choose the region closest to your users
   - Node Pool:
     - Machine Type: Standard
     - Node Plan: 
       - For basic deployments: 2 GB / 1 vCPU ($12/month)
       - For production: 4 GB / 2 vCPU ($24/month) or higher
     - Node Count: 3 (for high availability)
4. Add an additional node pool for ML services:
   - Machine Type: CPU-Optimized or GPU-Optimized
   - Node Plan: At least 8 GB / 4 vCPU ($48/month)
   - Node Count: 2
5. Name your cluster (e.g., `kai-production`)
6. Click "Create Cluster"

### 2. Connecting to the Cluster

1. Once the cluster is created, download the kubeconfig file
2. Set up kubectl to use this config:
   ```bash
   export KUBECONFIG=~/Downloads/kai-production-kubeconfig.yaml
   ```
3. Verify connection:
   ```bash
   kubectl get nodes
   ```

### 3. Creating Docker Images

Create Dockerfiles for the API server and ML services.

**API Server Dockerfile (Dockerfile.api)**:

```dockerfile
FROM node:16-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json yarn.lock ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy source code
COPY packages/shared ./packages/shared/
COPY packages/server ./packages/server/

# Build packages
RUN yarn workspace @kai/shared build
RUN yarn workspace @kai/server build

# Production image
FROM node:16-alpine

WORKDIR /app

# Copy package files
COPY package.json yarn.lock ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/

# Install production dependencies only
RUN yarn install --frozen-lockfile --production

# Copy built files
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/server/dist ./packages/server/dist

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Start server
CMD ["node", "packages/server/dist/server.js"]
```

**ML Services Dockerfile (Dockerfile.ml)**:

```dockerfile
FROM tensorflow/tensorflow:2.9.1-gpu

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    python3-pip \
    python3-dev \
    nodejs \
    npm \
    && rm -rf /var/lib/apt/lists/*

# Install yarn
RUN npm install -g yarn

# Copy package files
COPY package.json yarn.lock ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/ml/package.json ./packages/ml/

# Copy requirements.txt
COPY packages/ml/requirements.txt ./packages/ml/

# Install Python dependencies
RUN pip3 install --no-cache-dir -r packages/ml/requirements.txt

# Install Node.js dependencies
RUN yarn install --frozen-lockfile --production

# Copy source code
COPY packages/shared ./packages/shared/
COPY packages/ml ./packages/ml/

# Build TypeScript packages
RUN yarn workspace @kai/shared build
RUN yarn workspace @kai/ml build

# Expose port
EXPOSE 5000

# Start ML service
CMD ["python3", "packages/ml/python/server.py"]
```

### 4. Creating Kubernetes Manifests

Create the following Kubernetes manifests for the deployment:

**Namespace (namespace.yaml)**:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: kai
```

**Secrets (secrets.yaml)**:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: kai-secrets
  namespace: kai
type: Opaque
data:
  # Base64 encoded secrets
  mongodb-uri: <base64-encoded-mongodb-uri>
  supabase-url: <base64-encoded-supabase-url>
  supabase-key: <base64-encoded-supabase-key>
  jwt-secret: <base64-encoded-jwt-secret>
  s3-access-key: <base64-encoded-s3-access-key>
  s3-secret-key: <base64-encoded-s3-secret-key>
```

**ConfigMap (configmap.yaml)**:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: kai-config
  namespace: kai
data:
  NODE_ENV: "production"
  API_BASE_URL: "https://api.kai.yourdomain.com"
  S3_BUCKET: "kai-production"
  S3_REGION: "us-east-1"
  CORS_ORIGIN: "https://kai.yourdomain.com,https://admin.kai.yourdomain.com"
  LOG_LEVEL: "info"
  PORT: "3000"
```

**API Server Deployment (api-server-deployment.yaml)**:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kai-api-server
  namespace: kai
spec:
  replicas: 3
  selector:
    matchLabels:
      app: kai-api-server
  template:
    metadata:
      labels:
        app: kai-api-server
    spec:
      containers:
      - name: api-server
        image: ${DOCKER_REGISTRY}/kai-api-server:${IMAGE_TAG}
        ports:
        - containerPort: 3000
        envFrom:
        - configMapRef:
            name: kai-config
        env:
        - name: MONGODB_URI
          valueFrom:
            secretKeyRef:
              name: kai-secrets
              key: mongodb-uri
        - name: SUPABASE_URL
          valueFrom:
            secretKeyRef:
              name: kai-secrets
              key: supabase-url
        - name: SUPABASE_KEY
          valueFrom:
            secretKeyRef:
              name: kai-secrets
              key: supabase-key
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: kai-secrets
              key: jwt-secret
        - name: S3_ACCESS_KEY
          valueFrom:
            secretKeyRef:
              name: kai-secrets
              key: s3-access-key
        - name: S3_SECRET_KEY
          valueFrom:
            secretKeyRef:
              name: kai-secrets
              key: s3-secret-key
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 10
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 15
          periodSeconds: 20
```

**ML Services Deployment (ml-services-deployment.yaml)**:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kai-ml-services
  namespace: kai
spec:
  replicas: 2
  selector:
    matchLabels:
      app: kai-ml-services
  template:
    metadata:
      labels:
        app: kai-ml-services
    spec:
      containers:
      - name: ml-services
        image: ${DOCKER_REGISTRY}/kai-ml-services:${IMAGE_TAG}
        ports:
        - containerPort: 5000
        envFrom:
        - configMapRef:
            name: kai-config
        env:
        - name: MONGODB_URI
          valueFrom:
            secretKeyRef:
              name: kai-secrets
              key: mongodb-uri
        - name: S3_ACCESS_KEY
          valueFrom:
            secretKeyRef:
              name: kai-secrets
              key: s3-access-key
        - name: S3_SECRET_KEY
          valueFrom:
            secretKeyRef:
              name: kai-secrets
              key: s3-secret-key
        resources:
          requests:
            memory: "2Gi"
            cpu: "1000m"
          limits:
            memory: "4Gi"
            cpu: "2000m"
            nvidia.com/gpu: 1
        readinessProbe:
          httpGet:
            path: /health
            port: 5000
          initialDelaySeconds: 30
          periodSeconds: 30
        volumeMounts:
        - name: ml-models
          mountPath: /app/models
      volumes:
      - name: ml-models
        persistentVolumeClaim:
          claimName: ml-models-pvc
      nodeSelector:
        node-type: ml
```

**Persistent Volume Claim (ml-models-pvc.yaml)**:

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: ml-models-pvc
  namespace: kai
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 20Gi
  storageClassName: do-block-storage
```

**Services (services.yaml)**:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: kai-api-server-service
  namespace: kai
spec:
  selector:
    app: kai-api-server
  ports:
  - port: 80
    targetPort: 3000
  type: ClusterIP
---
apiVersion: v1
kind: Service
metadata:
  name: kai-ml-services-service
  namespace: kai
spec:
  selector:
    app: kai-ml-services
  ports:
  - port: 80
    targetPort: 5000
  type: ClusterIP
```

**Ingress (ingress.yaml)**:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: kai-ingress
  namespace: kai
  annotations:
    kubernetes.io/ingress.class: "nginx"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  tls:
  - hosts:
    - api.kai.yourdomain.com
    secretName: kai-tls-secret
  rules:
  - host: api.kai.yourdomain.com
    http:
      paths:
      - path: /api/ml
        pathType: Prefix
        backend:
          service:
            name: kai-ml-services-service
            port:
              number: 80
      - path: /
        pathType: Prefix
        backend:
          service:
            name: kai-api-server-service
            port:
              number: 80
```

### 5. Setting Up Cert-Manager for TLS

1. Install cert-manager:
   ```bash
   kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.11.0/cert-manager.yaml
   ```

2. Create a ClusterIssuer:
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

### 6. Applying Kubernetes Manifests

Apply all manifests to the cluster:

```bash
kubectl apply -f namespace.yaml
kubectl apply -f secrets.yaml
kubectl apply -f configmap.yaml
kubectl apply -f ml-models-pvc.yaml
kubectl apply -f api-server-deployment.yaml
kubectl apply -f ml-services-deployment.yaml
kubectl apply -f services.yaml
kubectl apply -f ingress.yaml
```

### 7. Setting Up Ingress Controller

1. Install the NGINX Ingress Controller:
   ```bash
   kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.7.0/deploy/static/provider/cloud/deploy.yaml
   ```

2. After the Ingress Controller is deployed, get the Load Balancer IP:
   ```bash
   kubectl get service ingress-nginx-controller -n ingress-nginx
   ```

3. Configure your DNS records to point to this IP address:
   - Create an A record for `api.kai.yourdomain.com` pointing to the Load Balancer IP

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