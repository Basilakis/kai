# Deployment and Development Guide

This document provides comprehensive instructions for deploying Kai to production environments and setting up development environments.

## Deployment

### Infrastructure Requirements

#### Minimum Production Requirements

| Component | CPU | RAM | Storage | Notes |
|-----------|-----|-----|---------|-------|
| API Server | 4 vCPUs | 8GB | 20GB SSD | Scales horizontally |
| ML Services | 8 vCPUs | 16GB | 40GB SSD | GPU recommended |
| MCP Server | 4 vCPUs | 8GB | 20GB SSD | Model Context Protocol server, GPU recommended |
| Database | 4 vCPUs | 8GB | 100GB SSD | MongoDB replica set |
| File Storage | - | - | 500GB+ | AWS S3 or equivalent |
| Cache | 2 vCPUs | 4GB | 20GB SSD | Redis for caching |
| Queue | 2 vCPUs | 4GB | 10GB SSD | Supabase Realtime |

#### Scaling Considerations

- **API Server**: Horizontally scale based on request volume (recommended 1 instance per 100 concurrent users)
- **ML Services**: Vertically scale for more complex models, or add specialized GPU instances
- **Database**: Scale vertically for better performance, add read replicas for heavy read loads
- **File Storage**: Scale storage based on catalog and image volume (estimate 2GB per 1000 materials)

##### Kubernetes HPA Scaling Architecture

The KAI Platform implements a sophisticated multi-layer scaling architecture in Kubernetes to efficiently manage resources:

1. **Horizontal Pod Autoscaling (HPA) Mechanics**

   The platform uses Kubernetes' Horizontal Pod Autoscaler to automatically adjust replica counts based on observed metrics:

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

   **How HPA Works in Our Platform**:
   - The Kubernetes HPA controller continuously monitors metrics from the Coordinator service and other configured components
   - The standard metrics-server component collects CPU and memory metrics from pods
   - The controller compares current CPU utilization (80% target) against the specified threshold
   - When utilization exceeds the threshold, the controller calculates the desired number of replicas to maintain the target utilization
   - Replicas are added or removed accordingly, while always maintaining between 3 and 10 replicas

   **Communication Flow with HPA:**
   
   Our platform communicates with the HPA through a metrics pipeline:
   
   - **Components expose metrics** via Prometheus annotations:
     ```yaml
     prometheus.io/scrape: "true"
     prometheus.io/port: "8081"
     prometheus.io/path: "/metrics"
     ```
   - **Metrics Collection Flow**:
     1. `metrics-server` collects CPU/memory metrics from kubelet on each node
     2. Prometheus scrapes application-specific metrics from component endpoints
     3. Prometheus Adapter converts these metrics to the Kubernetes custom metrics API format
     4. HPA controller queries these APIs every 15 seconds to make scaling decisions
   
   - **Communication Between Components**:
     - **Coordinator Service → metrics-server**: Coordinator pods expose basic CPU/memory metrics via kubelet
     - **Coordinator Service → Prometheus**: Coordinator exposes detailed metrics on the `/metrics` endpoint (port 8081)
     - **Prometheus → Prometheus Adapter**: Converts detailed metrics to HPA-compatible format
     - **HPA Controller → APIs**: Queries metrics APIs to obtain current utilization
     - **HPA Controller → kube-apiserver**: Updates replica count on the target deployment when needed

   - **Coordinator's Role**: The Coordinator service is central to the scaling architecture:
     - Exposes workload metrics (queue depths, processing times, memory usage)
     - Adjusts task concurrency based on observed cluster capacity
     - Implements back-pressure when resources are constrained

2. **Multi-Layered Scaling Approach**

   Our platform implements scaling at multiple layers:
   
   - **Pod-level HPA**: Automatically scales deployments based on CPU, memory, or custom metrics
     - Coordinator Service: 3-10 replicas based on CPU utilization
     - Mobile Optimization Service: 1-3 replicas based on CPU utilization
     - WASM Compiler: 1-3 replicas based on CPU utilization
     - This handles fluctuations in API request volume and control plane activities
   
   - **Workflow Concurrency Management**: The Coordinator service manages task queues with:
     - Priority-based queueing (interactive, batch, maintenance)
     - Dynamic concurrency limits based on resource availability
     - Resource reservation for high-priority workflows
     - Configured through the `task_queue_config` setting:
       ```
       task_queue_config={"interactive":{"concurrency":5,"weight":10},"batch":{"concurrency":10,"weight":5},"maintenance":{"concurrency":2,"weight":1}}
       ```
     - Ensures high-priority workflows get resources first, while maintaining system stability
   
   - **Cluster Autoscaling**: Node pools scale automatically based on pending pods:
     - When HPAs create new pods that can't be scheduled
     - When Argo workflows spawn pods that require specialized resources
     - Each node pool (CPU, GPU, memory-optimized) scales independently
   
   - **Resource Allocation Adjustment**: The ResourceManager service dynamically adjusts resource requests for workflows based on:
     - Subscription tier limitations
     - Current cluster utilization
     - Quality level requirements (allocating appropriate GPU resources)
     - This ensures optimal resource distribution during high-load periods

3. **Results and Benefits**

   The HPA configuration delivers these benefits:
   
   - **Cost Efficiency**: 
     - During low-traffic periods, components scale down to minimum replicas
     - CPU/memory resources are freed for other workloads or to allow node removal via cluster autoscaling
     - This optimizes resource usage and reduces operational costs
   
   - **Responsive Performance**: 
     - As user traffic increases, the system proactively adds replicas before performance degrades
     - The 80% target utilization provides a buffer to handle traffic spikes during scaling events
     - Maintaining minimum 3 replicas ensures high availability even during scaling
   
   - **Improved Reliability**: 
     - The system can automatically recover from pod failures or node issues by creating new replicas
     - Multiple layers of scaling provide defense-in-depth against resource exhaustion
     - Priority-based queuing ensures critical workflows continue during high demand
   
   - **Resource Optimization**: 
     - Efficient allocation based on actual usage patterns
     - Dynamic adjustment prevents over-provisioning while maintaining performance
   
   - **Quality of Service**: 
     - Performance guarantees for different subscription tiers
     - Consistent user experience regardless of system load

   **Monitoring Scale Behavior**:
   - Dedicated Grafana dashboards include panels to monitor scaling behavior:
     - Current/target replica counts
     - CPU/memory utilization across replicas
     - Scaling events timeline
     - Queue depths by priority level
   - To view these metrics, access the Grafana dashboard at: http://<cluster-ip>/grafana (after setting up port forwarding or ingress)
   - Alerting rules trigger when scaling thresholds or resource constraints are reached

### Deployment Architecture

#### Basic Architecture

```
┌────────────────┐       ┌────────────────┐       ┌────────────────┐
│                │       │                │       │                │
│  Load Balancer │──────▶│  API Server    │──────▶│  Database      │
│  (NGINX/ELB)   │       │  Cluster       │       │  (MongoDB)     │
│                │       │                │       │                │
└────────────────┘       └────────────────┘       └────────────────┘
       │                        │                        │
       │                        │                        │
       ▼                        ▼                        ▼
┌────────────────┐       ┌────────────────┐       ┌────────────────┐
│                │       │                │       │                │
│  CDN           │◀──────│  File Storage  │◀──────│  ML Services   │
│  (CloudFront)  │       │  (S3)          │       │  Cluster       │
│                │       │                │       │                │
└────────────────┘       └────────────────┘       └────────────────┘
                                                          │
                                                          │
                                                          ▼
                                                 ┌────────────────┐
                                                 │                │
                                                 │  MCP Server    │
                                                 │  (Model Context)│
                                                 │                │
                                                 └────────────────┘
```

#### Enhanced Architecture (High Availability)

```
                   ┌─────────────┐
                   │             │
               ┌──▶│ Region 1    │──┐
               │   │             │  │
               │   └─────────────┘  │
┌─────────────┐│                    │┌─────────────┐
│             ││   ┌─────────────┐  ││             │
│ Global Load ││   │             │  ││ Database    │
│ Balancer    │├──▶│ Region 2    │──┤│ Cluster     │
│             ││   │             │  ││ (Multi-AZ)  │
└─────────────┘│   └─────────────┘  │└─────────────┘
               │                    │
               │   ┌─────────────┐  │
               │   │             │  │
               └──▶│ Region 3    │──┘
                   │             │
                   └─────────────┘
```

### Deployment Options

#### Option 1: Cloud Provider Deployment (Recommended)

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

#### Option 2: Self-Hosted Deployment

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

### Database Migration System

Kai uses a robust database migration system to manage schema changes across environments. This system ensures that database schema is always in sync with application code and migrations are applied exactly once.

#### Migration Architecture

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

#### Migration Files

Migration files are SQL scripts stored in `packages/server/src/services/supabase/migrations/` and follow a sequential naming convention:

```
001_initial_schema.sql
002_hybrid_search.sql
003_dataset_upload.sql
004_material_metadata_fields.sql
004_message_broker.sql
...
```

Each file represents a set of schema changes that should be applied in order.

#### Migration Tracking

Migrations are tracked in a `schema_migrations` table in the Supabase database:

```sql
CREATE TABLE schema_migrations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

This table records which migrations have already been applied to prevent duplicate execution.

#### Migration Script

The system uses a TypeScript migration script (`packages/server/scripts/run-migrations.ts`) that:

1. Connects to the Supabase database using environment credentials
2. Creates the `schema_migrations` table if it doesn't exist
3. Retrieves already applied migrations from the table
4. Compares available migrations with applied ones to identify pending migrations
5. Applies pending migrations in sequential order
6. Records successful migrations in the tracking table

This approach ensures migrations are:
- Applied only once
- Applied in the correct order
- Only executed when needed
- Tracked for audit purposes

#### Integration with CI/CD Pipeline

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

2. Similar steps run for the production environment in the production deployment job.

This ensures:
- Database schema is updated before application code is deployed
- Each environment (staging, production) maintains its own migration state
- Migrations that fail will prevent deployment of incompatible application code

#### Adding a New Migration

To create a new migration:

1. Create a SQL file in `packages/server/src/services/supabase/migrations/` with the next sequential number
2. Write SQL statements for the schema changes
3. Commit the migration file to the repository
4. The CI/CD pipeline will apply it automatically during the next deployment

#### Rollback Strategy

For migration rollbacks:

1. **Development**: Remove the entry from the `schema_migrations` table and create a new migration that reverts the changes
2. **Production**: Create a new "down" migration that safely reverses the changes without data loss

#### Best Practices

- Always test migrations in development and staging before production
- Keep migrations focused and atomic (one logical change per file)
- Include comments in SQL files to explain complex changes
- Avoid destructive operations (e.g., dropping columns with data) without careful consideration
- Consider data migration needs alongside schema changes

### Deployment Process

#### 1. Environment Configuration

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

All KAI components will read from this single centralized environment file. This simplifies configuration management and ensures consistency across services.

#### 1.1 Monitoring Configuration

For optimal monitoring in production, configure the following environment variables:

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

These settings enable comprehensive logging, performance metrics collection, and regular health checks for all system components.

#### 2. Database Setup

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

#### 3. Build Process

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

#### 4. Containerization

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
# API Server
docker build -t kai-api-server:latest -f Dockerfile.api .
docker tag kai-api-server:latest registry.example.com/kai/api-server:latest

# Coordinator Service
docker build -t kai-coordinator:latest -f packages/coordinator/Dockerfile.coordinator .
docker tag kai-coordinator:latest registry.example.com/kai/coordinator-service:latest

# Worker Images for Argo Workflows
docker build -t kai-quality-assessment:latest -f packages/ml/python/Dockerfile.quality-assessment .
docker tag kai-quality-assessment:latest registry.example.com/kai/quality-assessment:latest

docker build -t kai-image-preprocessing:latest -f packages/ml/python/Dockerfile.image-preprocessing .
docker tag kai-image-preprocessing:latest registry.example.com/kai/image-preprocessing:latest

docker build -t kai-colmap-sfm:latest -f packages/ml/python/Dockerfile.colmap-sfm .
docker tag kai-colmap-sfm:latest registry.example.com/kai/colmap-sfm:latest

docker build -t kai-point-cloud:latest -f packages/ml/python/Dockerfile.point-cloud .
docker tag kai-point-cloud:latest registry.example.com/kai/point-cloud:latest

docker build -t kai-model-generator:latest -f packages/ml/python/Dockerfile.model-generator .
docker tag kai-model-generator:latest registry.example.com/kai/model-generator:latest

docker build -t kai-diffusion-nerf:latest -f packages/ml/python/Dockerfile.diffusion-nerf .
docker tag kai-diffusion-nerf:latest registry.example.com/kai/diffusion-nerf:latest

docker build -t kai-nerf-mesh-extractor:latest -f packages/ml/python/Dockerfile.nerf-mesh-extractor .
docker tag kai-nerf-mesh-extractor:latest registry.example.com/kai/nerf-mesh-extractor:latest

docker build -t kai-format-converter:latest -f packages/ml/python/Dockerfile.format-converter .
docker tag kai-format-converter:latest registry.example.com/kai/format-converter:latest

docker build -t kai-workflow-finalizer:latest -f packages/ml/python/Dockerfile.workflow-finalizer .
docker tag kai-workflow-finalizer:latest registry.example.com/kai/workflow-finalizer:latest

# Mobile Optimization Services
docker build -t kai-mobile-optimization:latest -f packages/coordinator/Dockerfile.mobile .
docker tag kai-mobile-optimization:latest registry.example.com/kai/mobile-optimization:latest

# WASM Compiler
docker build -t kai-wasm-compiler:latest -f packages/coordinator/Dockerfile.wasm .
docker tag kai-wasm-compiler:latest registry.example.com/kai/wasm-compiler:latest

# MCP Server (if used)
docker build -t kai-mcp-server:latest -f packages/ml/Dockerfile.mcp .
docker tag kai-mcp-server:latest registry.example.com/kai/mcp-server:latest

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
```

#### 5. Kubernetes Deployment (Recommended for Production)

The Kai platform uses a structured Kubernetes-based deployment process, optimized for ML workloads and scalability. The deployment is managed through a dedicated script that applies configurations in the correct order and handles environment-specific settings.

##### 5.1. Kubernetes Architecture

The deployment uses a dedicated namespace `kai-ml` with specialized components arranged in a hierarchical structure:

```
kubernetes/
├── deploy.sh                        # Main deployment script
├── coordinator/                     # Coordinator service manifests
├── distributed-processing/          # Distributed processing components
├── infrastructure/                  # Core infrastructure components
├── mobile-optimization/             # Mobile optimization components
├── wasm-compiler/                   # WebAssembly compiler components
└── workflows/                       # Argo workflow templates
```

##### 5.2. Deployment Script Usage

The `kubernetes/deploy.sh` script manages the deployment process, handling component dependencies and order. Usage:

```bash
# Basic deployment
./kubernetes/deploy.sh

# With custom parameters
./kubernetes/deploy.sh --context=my-k8s-context --registry=my-registry.example.com --tag=v1.2.3

# Selective deployment
./kubernetes/deploy.sh --skip-infrastructure --skip-workflows

# Dry run (validate configs without applying)
./kubernetes/deploy.sh --dry-run
```

Supported options:
- `--context=<context>`: Kubernetes context to use (default: `kai-ml-cluster`)
- `--registry=<url>`: Container registry URL (default: `registry.example.com`)
- `--tag=<tag>`: Image tag (default: `latest`)
- `--dry-run`: Validate configurations without applying changes
- `--skip-infrastructure`: Skip infrastructure components
- `--skip-coordinator`: Skip coordinator service components
- `--skip-workflows`: Skip workflow templates

##### 5.3. Component Structure

###### 5.3.1. Infrastructure Components

The base infrastructure includes:

- **Namespace**: Defines the `kai-ml` namespace with resource quotas and limits.
- **Priority Classes**: Seven distinct priority levels for workload scheduling:
  - `system-critical`: Essential components that must not be preempted
  - `interactive`: User-facing requests requiring low latency
  - `high-priority-batch`: Important batch jobs
  - `medium-priority-batch`: Normal batch jobs (default)
  - `low-priority-batch`: Non-urgent batch jobs
  - `maintenance`: System maintenance tasks
  - `preemptible`: Jobs that can run on spot/preemptible instances
- **Node Pools**: Specialized pools for different workload types:
  - `cpu-optimized`: General processing
  - `gpu-optimized`: ML inference (T4 GPUs)
  - `gpu-high-end`: ML training (A100 GPUs)
  - `memory-optimized`: Large model loading
  - `storage-optimized`: Data-intensive operations
  - `orchestration`: Control plane services
  - `spot-instances`: Cost-effective batch processing
- **Monitoring**: Prometheus and Grafana deployment for metrics collection and visualization
- **Caching**: Redis master-replica setup with tiered caching strategy

###### 5.3.2. Coordinator Service

The coordinator service orchestrates ML workflows and manages resources:

- **RBAC**: Service account with permissions to create and manage Argo workflows
- **Configuration**: ConfigMap with settings for Redis, workflows, resource allocation, and quality tiers
- **Service**: Exposes the coordinator API and metrics endpoints
- **Deployment**: High-availability deployment (3 replicas) with health checks and resource constraints
- **HPA**: Horizontal Pod Autoscaler for automatic scaling based on load
- **PDB**: Pod Disruption Budget to ensure availability during cluster updates

###### 5.3.3. Workflow Templates

Argo workflow templates define reusable ML pipelines:

- **3D Reconstruction**: Multi-stage pipeline for 3D model generation from images
  - Quality assessment and branching
  - Image preprocessing
  - Camera pose estimation
  - Point cloud generation
  - NeRF generation and mesh extraction
  - Format conversion

##### 5.4. Advanced Features

###### 5.4.1. Resource Management

- **Node Selectors**: Components are scheduled on appropriate node pools
- **Tolerations**: Allow pods to run on tainted nodes
- **Pod Anti-Affinity**: Spread pods across nodes for high availability
- **Resource Requests/Limits**: Define CPU, memory, and GPU requirements
- **Priority Classes**: Assign priorities to ensure critical services get resources first

###### 5.4.2. Argo Workflows Integration

The deployment uses Argo Workflows for ML pipeline orchestration:

- **Workflow Templates**: Reusable blueprint definitions for ML processes
- **DAG Structure**: Define dependencies between workflow steps
- **Conditional Execution**: Branch based on quality assessment or other factors
- **Resource Allocation**: Assign appropriate resources to workflow steps
- **Artifact Management**: Store and share data between workflow steps

###### 5.4.3. Monitoring Stack

The deployment includes a comprehensive monitoring stack:

- **Prometheus**: Metrics collection and storage
- **Grafana**: Dashboards for metrics visualization
- **Jaeger**: Distributed tracing for request flows
- **Custom Dashboards**: Pre-configured ML processing dashboards

##### 5.5. Deployment Command Examples

1. Deploy all components to default cluster:

```bash
./kubernetes/deploy.sh
```

2. Deploy with custom registry and tag:

```bash
./kubernetes/deploy.sh --registry=acr.azure.com/kai --tag=release-2023-04-13
```

3. Update only the coordinator service:

```bash
./kubernetes/deploy.sh --skip-infrastructure --skip-workflows
```

4. Perform a dry run to validate configurations:

```bash
./kubernetes/deploy.sh --dry-run
```

For more detailed information about the Kubernetes deployment, including post-installation steps and verification, refer to the [Kubernetes Architecture documentation](./kubernetes-architecture.md).

##### 5.6. Flux GitOps Deployment

The KAI Platform now supports a GitOps approach to deployment using Flux CD, which provides a fully automated, declarative way to manage Kubernetes resources. This approach offers significant advantages in terms of security, reliability, and operational efficiency.

###### 5.6.1. Flux Architecture Overview

Flux is a set of continuous and progressive delivery solutions for Kubernetes that are open and extensible. The Flux GitOps implementation consists of several controllers running in the Kubernetes cluster:

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

1. **Source Controller**: Manages Git/Helm repositories as sources of truth, fetches content, and detects changes
2. **Kustomize Controller**: Applies Kubernetes resources defined through Kustomize
3. **Helm Controller**: Manages Helm releases based on HelmRelease resources
4. **Notification Controller**: Sends events to external systems (Slack, webhook endpoints)

###### 5.6.2. GitOps Repository Structure

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

###### 5.6.3. Installing Flux

To install Flux on your Kubernetes cluster:

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

###### 5.6.4. Creating HelmRelease Resources

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

###### 5.6.5. CI/CD Integration with Flux

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

###### 5.6.6. Monitoring Flux and Deployments

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

###### 5.6.7. Rollback with Flux

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

###### 5.6.8. Benefits of Flux GitOps

The Flux GitOps approach provides several key benefits for KAI Platform deployments:

1. **Declarative Configuration**: All Kubernetes resources are defined declaratively in Git
2. **Automated Reconciliation**: Flux ensures the cluster state always matches the desired state in Git
3. **Self-Healing**: Automatic recovery from drift or failed deployments
4. **Enhanced Security**: No direct access to the Kubernetes cluster is needed for deployments
5. **Complete Audit Trail**: All changes are tracked in Git with full history
6. **Progressive Delivery**: Support for canary deployments and A/B testing
7. **Multi-Cluster Management**: The same GitOps repository can manage multiple clusters

For more detailed information about the Flux GitOps architecture, controllers, and workflow, refer to the [Kubernetes Architecture](./kubernetes-architecture.md) and [CI/CD Pipeline](./cicd-pipeline.md) documentation.

**Using Docker Compose (for simpler deployments)**

```yaml
version: '3.8'

services:
  api-server:
    image: registry.example.com/kai-api-server:latest
    ports:
      - "3000:3000"
    env_file: .env.production
    depends_on:
      - mongodb
      - mcp-server
    restart: always

  ml-services:
    image: registry.example.com/kai-ml-services:latest
    ports:
      - "5000:5000"
    env_file: .env.production
    depends_on:
      - mcp-server
    volumes:
      - ml-models:/app/models
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    restart: always
    
  mcp-server:
    image: registry.example.com/kai-mcp-server:latest
    ports:
      - "8000:8000"
    env_file: .env.production
    volumes:
      - ml-models:/opt/kai/models
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    restart: always

  mongodb:
    image: mongo:5
    volumes:
      - mongodb-data:/data/db
    ports:
      - "27017:27017"
    environment:
      MONGO_INITDB_ROOT_USERNAME: root
      MONGO_INITDB_ROOT_PASSWORD: your-secure-password
    restart: always

volumes:
  mongodb-data:
  ml-models:
```

#### 6. Monitoring Setup in Production

1. **Configure external monitoring systems to use the health endpoints**

   Set up your monitoring system (Prometheus, Datadog, New Relic, etc.) to regularly poll the health endpoints:
   
   ```
   # Basic health check - for load balancers and simple monitoring
   GET https://api.yourdomain.com/health
   
   # Detailed health check - for comprehensive system monitoring (requires authentication)
   GET https://api.yourdomain.com/health/detailed
   ```

2. **Set up alerts based on health endpoint responses**

   Configure alerting rules for:
   - Non-200 status codes from health endpoints
   - System status other than "ok" 
   - Memory usage above 80%
   - CPU usage above 80%
   - Component status degradation
   
3. **Implement a dashboard for rate limit monitoring**

   Set up a dashboard to monitor:
   - Rate limit usage across endpoints
   - Number of rate limited requests
   - Distribution of requests across API categories
   
4. **Deploy admin monitoring dashboard**

   Deploy the admin monitoring interface to enable:
   - Real-time system logs viewing
   - Error distribution analysis
   - Health metrics visualization
   - Rate limit statistics

5. **Log aggregation setup**

   Configure your log aggregation system (ELK Stack, Graylog, etc.) to:
   - Collect logs from all Kai components
   - Parse JSON-formatted logs
   - Create indexes for efficient searching
   - Set up log retention policies

#### 7. Frontend Deployment

**Static Hosting (Client App)**
1. Build the client app: `yarn workspace @kai/client build`
2. Deploy the contents of `packages/client/public` to your CDN or static hosting

**Static Hosting (Admin App)**
1. Build the admin app: `yarn workspace @kai/admin build`
2. Deploy the contents of `packages/admin/out` to your CDN or static hosting
   (Note: For Next.js with SSR, deploy to Vercel or similar platform)

#### 8. Integrating Monitoring Dashboard

1. **Configure Admin Dashboard Access**
   
   Ensure that the admin monitoring dashboard is properly secured:
   
   ```yaml
   # In your ingress or routing configuration
   apiVersion: networking.k8s.io/v1
   kind: Ingress
   metadata:
     name: kai-admin-ingress
     annotations:
       nginx.ingress.kubernetes.io/ssl-redirect: "true"
       nginx.ingress.kubernetes.io/auth-type: basic
       nginx.ingress.kubernetes.io/auth-secret: admin-auth
       nginx.ingress.kubernetes.io/auth-realm: "Authentication Required"
   spec:
     rules:
     - host: admin.yourdomain.com
       http:
         paths:
         - path: /
           pathType: Prefix
           backend:
             service:
               name: kai-admin-service
               port:
                 number: 80
   ```

2. **Connect Admin Dashboard to Monitoring API**
   
   Configure the admin application to connect to the monitoring endpoints:
   
   ```
   # In admin app environment configuration
   MONITORING_API_URL=https://api.yourdomain.com
   MONITORING_REFRESH_INTERVAL=30000
   LOG_RETENTION_DAYS=30
   ```

#### 9. Backup Strategy

1. Configure automated MongoDB backups:
   - Daily full backups
   - Hourly incremental backups
   - 30-day retention
2. Set up S3 bucket versioning for file storage
3. Implement database replication for high availability

### Continuous Integration and Deployment

The Kai platform uses a robust CI/CD pipeline with GitHub Actions to automate the deployment process. The system is configured with a three-branch structure and specific branch protection rules that ensure only authorized users can deploy to production.

For detailed information about the CI/CD pipeline, including branch protection, deployment workflows, and required GitHub secrets, please refer to the [CI/CD Pipeline Documentation](./cicd-pipeline.md).

#### Key CI/CD Features

- Three-branch structure (development, staging, main)
- Branch protection rules controlling who can push to production
- Automated deployments triggered only from the main branch
- Comprehensive build, test, and deployment stages
- Environment-specific configurations for staging and production

#### CI/CD Pipeline Implementation

The CI/CD pipeline is implemented in `.github/workflows/deploy.yml`. This file contains the workflow definition that handles:

1. Building and testing the codebase
2. Deploying to staging for pre-production validation
3. Deploying to production when changes are pushed to main

> **Note**: The production deployment from the main branch is restricted to user "Basilakis" via GitHub branch protection rules.

#### Previous CI/CD Pipeline Example (GitHub Actions)

This is kept for reference purposes. The actual implementation is now in `.github/workflows/deploy.yml`.

```yaml
name: Deploy Kai (Legacy)

on:
  push:
    branches: [ main ]
  workflow_dispatch:

jobs:
  build-and-test:
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
      
      - name: Run linting
        run: yarn lint
      
      - name: Run tests
        run: yarn test
      
      - name: Build packages
        run: yarn build
      
      - name: Upload artifacts
        uses: actions/upload-artifact@v2
        with:
          name: build-artifacts
          path: |
            packages/*/dist
            packages/client/public
            packages/admin/out

  deploy-backend:
    needs: build-and-test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Download artifacts
        uses: actions/download-artifact@v2
        with:
          name: build-artifacts
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v1
      
      - name: Login to Container Registry
        uses: docker/login-action@v1
        with:
          registry: ${{ secrets.DOCKER_REGISTRY }}
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}
      
      - name: Build and push API server
        uses: docker/build-push-action@v2
        with:
          context: .
          file: ./Dockerfile.api
          push: true
          tags: ${{ secrets.DOCKER_REGISTRY }}/kai-api-server:${{ github.sha }},${{ secrets.DOCKER_REGISTRY }}/kai-api-server:latest
      
      - name: Deploy to Kubernetes
        uses: steebchen/kubectl@v2
        with:
          config: ${{ secrets.KUBE_CONFIG_DATA }}
          command: set image deployment/kai-api-server api-server=${{ secrets.DOCKER_REGISTRY }}/kai-api-server:${{ github.sha }}

  deploy-frontend:
    needs: build-and-test
    runs-on: ubuntu-latest
    steps:
      - name: Download artifacts
        uses: actions/download-artifact@v2
        with:
          name: build-artifacts
      
      - name: Deploy Client to CDN
        uses: aws-actions/configure-aws-credentials@v1
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ secrets.AWS_REGION }}
      
      - name: Upload to S3
        run: |
          aws s3 sync packages/client/public s3://${{ secrets.CLIENT_BUCKET_NAME }} --delete
      
      - name: Invalidate CloudFront cache
        run: |
          aws cloudfront create-invalidation --distribution-id ${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }} --paths "/*"
```

## Development Setup

### Local Environment Setup

#### Additional Components

##### MCP Server Setup

1. **Install MCP Server dependencies**
   ```bash
   cd packages/ml
   python -m venv mcp-venv
   source mcp-venv/bin/activate  # On Windows: mcp-venv\Scripts\activate
   pip install -r requirements.txt
   pip install fastapi uvicorn python-multipart
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```

3. **Install TypeScript client package**
   ```bash
   # From project root
   cd packages/mcp-client
   yarn install
   yarn build
   yarn link
   
   # Link to ML package
   cd ../ml
   yarn link @kai/mcp-client
   ```

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

#### Testing and Quality Assurance

1. **Unit Testing**
   ```bash
   # Run all tests
   yarn test
   
   # Test specific package
   yarn workspace @kai/server test
   ```

2. **Integration Testing**
   ```bash
   # Run integration tests
   yarn workspace @kai/server test:integration
   ```

3. **End-to-End Testing**
   ```bash
   # Start the E2E testing environment
   yarn e2e:setup
   
   # Run E2E tests
   yarn e2e
   ```

4. **Linting and Code Quality**
   ```bash
   # Run linting
   yarn lint
   
   # Fix automatically fixable issues
   yarn lint:fix
   
   # Check TypeScript types
   yarn typecheck
   ```

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

### Troubleshooting Common Issues

#### Backend Issues

1. **MongoDB Connection Errors**
   - Check MongoDB connection string
   - Verify MongoDB is running
   - Check network connectivity to MongoDB server
   - Ensure authentication credentials are correct

2. **API Server Not Starting**
   - Check for port conflicts
   - Verify all required environment variables are set
   - Check logs for errors
   - Verify Node.js version compatibility

3. **API Endpoints Returning 500 Errors**
   - Check server logs for detailed error information
   - Verify database connection
   - Check for malformed request data
   - Ensure all dependencies are properly installed

#### Frontend Issues

1. **Build Failures**
   - Check for TypeScript errors
   - Verify all dependencies are installed
   - Check for conflicting dependency versions
   - Clear node_modules and reinstall dependencies

2. **Runtime Errors**
   - Check browser console for error messages
   - Verify API endpoints are correctly called
   - Check for CORS issues
   - Verify environment variables are correctly set

3. **Performance Issues**
   - Use React DevTools Profiler to identify bottlenecks
   - Check for unnecessary re-renders
   - Optimize image loading and sizes
   - Implement code splitting for large components

#### ML Service Issues

1. **Python Dependency Issues**
   - Use a virtual environment to isolate dependencies
   - Ensure all dependencies are installed with correct versions
   - Check for GPU compatibility with TensorFlow/PyTorch

2. **Model Loading Errors**
   - Verify model file paths are correct
   - Check if model files exist and are not corrupted
   - Ensure model format is compatible with the framework version

3. **Slow Inference Performance**
   - Check if GPU is being utilized
   - Optimize batch processing
   - Implement model quantization
   - Profile the code to identify bottlenecks

### Performance Optimization

#### Backend Optimization

1. **Database Optimization**
   - Create appropriate indexes for common queries
   - Use projection to return only needed fields
   - Implement caching for frequent queries
   - Use aggregation pipeline for complex queries

2. **API Server Optimization**
   - Implement response compression
   - Use efficient JSON serialization
   - Implement request throttling for high-traffic endpoints
   - Use connection pooling for database connections

#### Frontend Optimization

1. **React Performance**
   - Use React.memo for pure components
   - Implement useMemo and useCallback hooks appropriately
   - Use virtualization for long lists (react-window)
   - Implement code splitting for large components

2. **Asset Optimization**
   - Optimize images (compression, WebP format)
   - Implement lazy loading for images
   - Use CSS minification
   - Implement critical CSS loading

#### ML Service Optimization

1. **Model Optimization**
   - Use model quantization to reduce size
   - Implement batching for multiple requests
   - Use TensorRT for GPU acceleration
   - Optimize preprocessing pipeline

2. **Deployment Optimization**
   - Use TensorFlow Serving for model serving
   - Implement model caching in memory
   - Use GPU instances for inference
   - Implement input/output pipelines

### Security Best Practices

1. **API Security**
   - Implement rate limiting
   - Use HTTPS for all communications
   - Validate all input data
   - Implement proper authentication and authorization
   - Use secure HTTP headers

2. **Data Security**
   - Encrypt sensitive data at rest
   - Implement proper access controls
   - Use parameterized queries to prevent SQL injection
   - Sanitize user-generated content

3. **Frontend Security**
   - Implement Content Security Policy
   - Use HttpOnly cookies for authentication
   - Prevent XSS attacks by sanitizing input
   - Validate all API responses

4. **Infrastructure Security**
   - Keep all dependencies updated
   - Use a web application firewall
   - Implement network security groups
   - Use the principle of least privilege for all services

## Conclusion

This document provides comprehensive instructions for deploying Kai to production environments and setting up development environments. Following these guidelines will ensure a smooth development experience and reliable production deployments.

For additional assistance, please refer to the other documentation files or contact the development team.