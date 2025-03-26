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

### Deployment Process

#### 1. Environment Configuration

Create the following `.env` files for production:

**API Server (.env.production)**
```
NODE_ENV=production
PORT=3000
API_BASE_URL=https://api.yourdomain.com
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/kai
JWT_SECRET=your-very-secure-jwt-secret
S3_BUCKET=kai-production
S3_REGION=us-east-1
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key
SUPABASE_URL=https://your-supabase-project.supabase.co
SUPABASE_KEY=your-supabase-key
CORS_ORIGIN=https://yourdomain.com
LOG_LEVEL=info
```

**ML Services (.env.production)**
```
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/kai
S3_BUCKET=kai-production
S3_REGION=us-east-1
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key
MODEL_PATH=/opt/kai/models
TENSORFLOW_SERVING_URL=http://tensorflow-serving:8501
VECTOR_INDEX_PATH=/opt/kai/indexes
GPU_ENABLED=true
BATCH_SIZE=8
MCP_SERVER_URL=http://mcp-server:8000
USE_MCP_SERVER=true
```

**MCP Server (.env.production)**
```
PORT=8000
MODEL_PATH=/opt/kai/models
MODEL_CACHE_SIZE=5
GPU_ENABLED=true
LOG_LEVEL=info
AGENT_INTEGRATION_ENABLED=true
MAX_BATCH_SIZE=16
```

**Frontend (.env.production)**
```
GATSBY_API_URL=https://api.yourdomain.com
GATSBY_SUPABASE_URL=https://your-supabase-project.supabase.co
GATSBY_SUPABASE_ANON_KEY=your-supabase-anon-key
GATSBY_STORAGE_URL=https://your-cdn.com
GATSBY_DEFAULT_LOCALE=en
GATSBY_GOOGLE_ANALYTICS_ID=your-ga-id
```

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
docker build -t kai-api-server:latest -f Dockerfile.api .
docker build -t kai-ml-services:latest -f Dockerfile.ml .
docker build -t kai-mcp-server:latest -f packages/ml/Dockerfile.mcp .

docker tag kai-api-server:latest registry.example.com/kai-api-server:latest
docker tag kai-ml-services:latest registry.example.com/kai-ml-services:latest
docker tag kai-mcp-server:latest registry.example.com/kai-mcp-server:latest

docker push registry.example.com/kai-api-server:latest
docker push registry.example.com/kai-ml-services:latest
docker push registry.example.com/kai-mcp-server:latest
```

#### 5. Deployment Steps

**Using Kubernetes (recommended for production)**

1. Create Kubernetes manifests:

**api-server-deployment.yaml**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kai-api-server
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
        image: registry.example.com/kai-api-server:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: MONGODB_URI
          valueFrom:
            secretKeyRef:
              name: kai-secrets
              key: mongodb-uri
        # Additional environment variables from ConfigMap
        envFrom:
        - configMapRef:
            name: kai-api-config
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
```

2. Apply configurations:
```bash
kubectl apply -f api-server-deployment.yaml
kubectl apply -f ml-services-deployment.yaml
kubectl apply -f api-server-service.yaml
kubectl apply -f ml-services-service.yaml
kubectl apply -f ingress.yaml
```

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
    env_file: .env.ml.production
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
    env_file: .env.mcp.production
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

#### 6. Frontend Deployment

**Static Hosting (Client App)**
1. Build the client app: `yarn workspace @kai/client build`
2. Deploy the contents of `packages/client/public` to your CDN or static hosting

**Static Hosting (Admin App)**
1. Build the admin app: `yarn workspace @kai/admin build`
2. Deploy the contents of `packages/admin/out` to your CDN or static hosting
   (Note: For Next.js with SSR, deploy to Vercel or similar platform)

#### 7. Monitoring Setup

1. Set up monitoring using Prometheus and Grafana
2. Configure alerts for:
   - High API server CPU/memory usage
   - ML service errors
   - Queue backlogs
   - Database performance issues
   - High error rates

#### 8. Backup Strategy

1. Configure automated MongoDB backups:
   - Daily full backups
   - Hourly incremental backups
   - 30-day retention
2. Set up S3 bucket versioning for file storage
3. Implement database replication for high availability

### Continuous Integration and Deployment

#### CI/CD Pipeline Example (GitHub Actions)

**.github/workflows/deploy.yml**
```yaml
name: Deploy Kai

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
   cp packages/ml/.env.mcp.example packages/ml/.env.mcp
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
   # For each package
   cp packages/server/.env.example packages/server/.env
   cp packages/client/.env.example packages/client/.env
   cp packages/admin/.env.example packages/admin/.env
   ```

4. **Set up MongoDB**
   ```bash
   # Option 1: Using Docker
   docker run -d -p 27017:27017 --name kai-mongodb mongo:5
   
   # Option 2: Using MongoDB Atlas
   # Configure your MongoDB Atlas connection string in packages/server/.env
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
   # Create a project at https://supabase.com and configure in .env files
   
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