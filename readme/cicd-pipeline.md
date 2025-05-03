# CI/CD Pipeline for Kai Platform

This document outlines the CI/CD (Continuous Integration/Continuous Deployment) pipeline configuration for the Kai platform, including branch structure, protection rules, and automated deployment processes.

## Branch Structure

The Kai repository uses a three-branch structure:

1. **main**: Production branch that triggers deployments
2. **staging**: Pre-production testing branch
3. **development**: Active development branch

The workflow follows this pattern:
- Developers work in feature branches branched from `development`
- Features are merged into `development` via pull requests
- When ready for testing, `development` is merged to `staging`
- After validation in staging, `staging` is merged to `main` to trigger production deployment

## Branch Protection Rules

Branch protection rules are set up to ensure code quality and control access:

### Main Branch Protection

- Only user "Basilakis" can push directly to `main`
- Require pull request reviews before merging
- Require status checks to pass before merging
- Require linear history (no merge commits)
- Do not allow bypassing the above settings

### Staging Branch Protection

- Require pull request reviews before merging
- Require status checks to pass before merging
- Allow administrators to bypass

### Development Branch Protection

- Require status checks to pass before merging
- No restrictions on who can push

## CI/CD Pipeline with Reusable Workflows

The CI/CD pipeline is implemented using GitHub Actions with a modular, reusable workflow approach. This new implementation separates the pipeline into individual workflow files that can be called from the main workflow:

### Main Workflow File Structure
The primary workflow is defined in `.github/workflows/deploy.yml` and orchestrates the entire CI/CD process by calling reusable workflows:

```yaml
name: Kai Platform CI/CD Pipeline

jobs:
  # Build and test job using reusable workflow
  build-and-test:
    name: Build and Test
    uses: ./.github/workflows/build-test.yml
    with:
      node-version: '16'
      python-version: '3.9'

  # Build Docker images using reusable workflow
  build-docker-images:
    name: Build Docker Images
    needs: build-and-test
    uses: ./.github/workflows/docker-build.yml
    with:
      environment: ${{ github.ref == 'refs/heads/main' && 'production' || 'staging' }}
      tag-suffix: ${{ github.ref == 'refs/heads/main' && 'latest' || 'staging' }}
    secrets:
      docker_username: ${{ secrets.DOCKER_USERNAME }}
      docker_password: ${{ secrets.DOCKER_PASSWORD }}
      docker_registry: ${{ secrets.DOCKER_REGISTRY }}

  # Deploy to staging or production using environment-specific workflows
  deploy-staging:
    name: Deploy to Staging
    needs: build-docker-images
    if: github.ref == 'refs/heads/staging'
    uses: ./.github/workflows/deploy-staging.yml
    with:
      sha: ${{ github.sha }}
    secrets: # Secrets passed to the workflow
      # Various secrets needed for deployment

  deploy-production:
    name: Deploy to Production
    needs: build-docker-images
    if: github.ref == 'refs/heads/main'
    uses: ./.github/workflows/deploy-production.yml
    with:
      sha: ${{ github.sha }}
    secrets: # Secrets passed to the workflow
      # Various secrets needed for deployment
```

### Reusable Workflow Components

The CI/CD pipeline is now broken down into these reusable workflow files:

1. **Build and Test Workflow** (`.github/workflows/build-test.yml`)
   - Accepts parameters for Node.js and Python versions
   - Handles dependency installation, linting, testing, and building
   - Uploads build artifacts for downstream jobs
   - Can be called independently for PR validation

   ```yaml
   on:
     workflow_call:
       inputs:
         node-version:
           type: string
           default: '20'
         python-version:
           type: string
           default: '3.9'
   ```

2. **Docker Build Workflow** (`.github/workflows/docker-build.yml`)
   - Builds all required Docker images in two phases
   - First builds the centralized ML base image
   - Then builds all service images in parallel using the matrix strategy
   - Accepts parameters for environment-specific configuration
   - Passes the ML base image reference to service builds

   ```yaml
   on:
     workflow_call:
       inputs:
         environment:
           type: string
           required: true
         tag-suffix:
           type: string
           default: ''
       secrets:
         docker_username:
           required: true
         # Other required secrets
   ```

3. **Deploy Staging Workflow** (`.github/workflows/deploy-staging.yml`)
   - Handles all staging-specific deployment steps
   - Updates GitOps repository with new image tags
   - Deploys frontend applications to Vercel
   - Runs database migrations for staging environment

4. **Deploy Production Workflow** (`.github/workflows/deploy-production.yml`)
   - Similar to staging but with production-specific parameters
   - Applies stricter deployment controls
   - Uses production-specific secrets and configurations

### Benefits of Reusable Workflows

This modular approach provides several key advantages:

1. **DRY (Don't Repeat Yourself) Principle**
   - Eliminates duplicated code between staging and production workflows
   - Common logic is defined once and reused across workflows

2. **Simplified Maintenance**
   - Easier to update individual components without affecting others
   - Clear separation of concerns between build, test, and deployment steps

3. **Improved Readability**
   - Each workflow file focuses on a specific responsibility
   - Main workflow file serves as a clean, high-level orchestrator

4. **Easier Troubleshooting**
   - Issues can be isolated to specific workflow components
   - Individual workflows can be tested independently

5. **Consistent Environment Handling**
   - Environment-specific logic is encapsulated in dedicated workflow files
   - Reduces risk of environment configuration inconsistencies

6. **Scalable Architecture**
   - New environments can be added with minimal changes
   - Additional workflow components can be easily integrated

### Enhanced Docker Build Process

The Docker build workflow has been optimized to build the centralized ML base image first, followed by all service images:

```yaml
jobs:
  # First build the ML base image that other images depend on
  build-ml-base-image:
    name: Build ML Base Image
    runs-on: ubuntu-latest
    steps:
      # Steps to build and push the ML base image

  # Then build all service images in parallel
  build-service-images:
    name: Build Service Images
    needs: build-ml-base-image
    runs-on: ubuntu-latest
    strategy:
      matrix:
        include:
          - name: api-server
            dockerfile: ./Dockerfile.api
          # Other service images in the matrix
    steps:
      # Steps to build and push service images
      # Includes reference to the ML base image
```

This approach ensures that:
1. The ML base image is available for all service builds
2. Common layers are properly cached and reused
3. Service Dockerfiles are kept simple and focused

### GitOps Integration

Both staging and production deployment workflows include steps to update the GitOps repository:

```yaml
# From deploy-staging.yml
jobs:
  update-gitops:
    name: Update GitOps Repository
    steps:
      - name: Checkout GitOps repository
        uses: actions/checkout@v3
        with:
          repository: kai-platform/kai-gitops
          path: gitops
          token: ${{ secrets.gitops_pat }}
          ref: staging

      - name: Update image tags in HelmReleases
        # Steps to update and commit changes
```

The production workflow uses a similar process but targets the `main` branch of the GitOps repository.

### Docker Image Build Strategy

The pipeline builds multiple Docker images for different components of the system:

### API Server Image
- Built from `Dockerfile.api` in the repository root
- Contains the main API server, authentication, and business logic

### Coordinator Service Image
- Built from `packages/coordinator/Dockerfile.coordinator`
- Provides orchestration for ML workflows via Argo Workflows
- Handles resource allocation, quality assessment, and caching

### ML Base Image
- New centralized base image for all ML services
- Built from `Dockerfile.ml-base` in the repository root
- Provides consistent environment for ML workers
- Contains common dependencies and infrastructure

### Worker Images
Each worker image is specialized for a specific task in the ML pipeline, now built using one of two centralized base images:

#### GPU-Based ML Services
These services inherit from the `kai-ml-base` image (built from `Dockerfile.ml-base`):
- `kai-quality-assessment`: Assesses image quality and determines processing level
- `kai-image-preprocessing`: Performs initial image preparation
- `kai-colmap-sfm`: Runs Structure from Motion using COLMAP
- `kai-point-cloud`: Generates point clouds from camera poses
- `kai-model-generator`: Creates 3D models from point clouds or camera poses
- `kai-diffusion-nerf`: Implements NeRF-based reconstruction
- `kai-nerf-mesh-extractor`: Extracts mesh data from NeRF models
- `kai-format-converter`: Converts models to different formats

#### Non-GPU Python Services
These services inherit from the `kai-python-base` image (built from `Dockerfile.python-base`):
- `kai-workflow-finalizer`: Handles notifications and final cleanup

This dual base image strategy ensures optimal resource utilization, with GPU-dependent services using the TensorFlow GPU base and lightweight services using a simpler Python base image.

Each worker image is built from its respective Dockerfile in `packages/ml/python/` with significantly reduced size and complexity due to the use of centralized base images.

## Automated Canary Deployments

The CI/CD pipeline now includes support for automated canary deployments with health monitoring and automated rollback capabilities:

### Canary Deployment Implementation

The production deployment workflow (`deploy-production.yml`) has been enhanced with canary deployment support:

```yaml
on:
  workflow_call:
    inputs:
      sha:
        required: true
        type: string
      canary:
        description: 'Whether to deploy as a canary release'
        required: false
        type: boolean
        default: false
      canary_weight:
        description: 'Percentage of traffic to route to canary'
        required: false
        type: number
        default: 20
```

This allows the workflow to be triggered with canary deployment parameters:

```yaml
deploy-production:
  uses: ./.github/workflows/deploy-production.yml
  with:
    sha: ${{ github.sha }}
    canary: true
    canary_weight: 10
```

### Helm Chart Integration

The Helm deployment script (`helm-charts/helm-deploy.sh`) has been updated to support canary deployments with the following parameters:

- `--canary`: Enables canary deployment mode
- `--canary-weight`: Percentage of traffic to route to the canary (default: 20%)
- `--health-threshold`: Number of failures before marking deployment as degraded
- `--critical-services`: Comma-separated list of services to monitor for health

The Kai Helm chart's values.yaml has been updated with canary configuration:

```yaml
canary:
  enabled: false
  weight: 20
  maxTimeMinutes: 30
  healthThreshold: 5
  criticalServices:
    - api-server
    - coordinator-service
```

### Health Monitoring and Automated Promotion/Rollback

The canary deployment process includes automated health monitoring:

1. **Initial Deployment**: The canary version is deployed alongside the stable version
2. **Traffic Splitting**: Traffic is split between stable and canary according to the weight
3. **Health Monitoring**: The process continuously monitors the health of critical services
4. **Automated Decision**:
   - If health checks succeed throughout the monitoring period, the canary is automatically promoted to stable
   - If too many health checks fail, the canary is automatically rolled back

The workflow implementation includes:

```yaml
- name: Monitor Deployment Health
  id: health_check
  run: |
    echo "Monitoring production deployment health for 5 minutes..."
    FAILURES=0

    for i in {1..30}; do
      # Health check logic for critical services
      # ...

      if [ $FAILURES -ge 5 ]; then
        echo "health_status=degraded" >> $GITHUB_OUTPUT
        break
      fi

      sleep 10
    done

- name: Rollback if Needed
  if: steps.health_check.outputs.health_status == 'degraded' && inputs.canary == 'true'
  run: |
    echo "::warning::Production health checks failed, rolling back canary deployment"
    ./helm-charts/helm-deploy.sh \
      --context=${{ env.KUBE_CONTEXT }} \
      --env=production \
      --release=kai-production \
      --rollback
```

### Benefits of Automated Canary Deployments

This implementation provides several key advantages:

1. **Reduced Deployment Risk**: Only a small percentage of traffic is initially exposed to new versions
2. **Early Problem Detection**: Issues are identified with minimal user impact
3. **Automated Verification**: Health monitoring runs automatically without human intervention
4. **Safety Net**: Automatic rollback prevents prolonged service degradation
5. **Configurable Parameters**: Deployment teams can adjust canary settings based on risk tolerance

### Usage in Workflow Dispatch

The canary deployment can be triggered manually via workflow dispatch:

```yaml
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
    canary:
      description: 'Use canary deployment (production only)'
      required: false
      default: false
      type: boolean
    canary_weight:
      description: 'Percentage of traffic to canary (1-50)'
      required: false
      default: '20'
      type: string
```

This allows operations teams to make informed decisions about canary deployments on a case-by-case basis.
## Kubernetes Deployment with Helm Charts

The Kubernetes deployment now uses Helm charts for improved maintainability and consistency:

1. **Helm Chart Structure**: Organized as a parent chart with subcharts for components:
   ```
   helm-charts/
   ├── kai/                    # Main parent chart
   │   ├── Chart.yaml          # Chart metadata with dependencies
   │   ├── values.yaml         # Default values
   │   ├── values-staging.yaml # Staging environment values
   │   └── values-production.yaml # Production environment values
   └── coordinator/            # Example subchart
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

2. **Environment-Specific Configuration**: All environment differences are now managed in dedicated values files rather than script variables:
   - `values.yaml` contains default configurations
   - `values-staging.yaml` overrides for staging environment
   - `values-production.yaml` overrides for production environment

3. **Deployment Process**: The deployment uses the `helm-charts/helm-deploy.sh` script which:
   - Supports the same parameters as the previous script (`--registry`, `--tag`, `--context`)
   - Adds Helm-specific parameters (`--release` for release naming)
   - Provides enhanced rollback capability with version history
   - Enables more fine-grained control over deployment updates
   - Includes built-in deployment verification

4. **CI/CD Integration**: The GitHub Actions workflows use the Helm deployment script for both environments:
   ```yaml
   - name: Deploy to Kubernetes with Helm
     run: |
       ./helm-charts/helm-deploy.sh \
         --context=${{ inputs.kube-context }} \
         --registry=${{ secrets.docker_registry }}/${{ secrets.docker_username }} \
         --tag=${{ inputs.sha }} \
         --env=${{ env.DEPLOY_ENV }} \
         --release=kai-${{ env.DEPLOY_ENV }}
   ```

5. **Improved Rollback**: The Helm-based rollback mechanism provides:
   - Versioned releases for deterministic rollbacks
   - Ability to roll back to any previous version, not just the last one
   - Comprehensive rollback including all related resources
   - Detailed history for auditing deployment changes

## Environment Variables and Secrets

The CI/CD pipeline uses a variety of environment variables and secrets to configure the deployment process. These are defined in the GitHub repository secrets and used across the workflows.

### Environment Variables

These environment variables are commonly used across workflows:

| Variable | Description | Example Value |
|----------|-------------|---------------|
| `DEPLOY_ENV` | Target deployment environment | `staging` or `production` |
| `TAG_SUFFIX` | Suffix for Docker image tags | `staging` or `latest` |
| `VERCEL_ARGS` | Arguments for Vercel deployments | `--prod` |
| `API_URL` | URL for the API service | `https://api.kai.example.com` |
| `TEST_SCRIPT` | Script to run for tests | `test:e2e` |
| `KUBE_CONTEXT` | Kubernetes context to use | `kubernetes-cluster1` |

### Required Secrets

The following secrets should be configured in your GitHub repository:

#### Docker Registry
- `DOCKER_USERNAME`: Username for Docker registry
- `DOCKER_PASSWORD`: Password for Docker registry
- `DOCKER_REGISTRY`: Docker registry URL

#### Kubernetes
- `DIGITALOCEAN_ACCESS_TOKEN`: Digital Ocean API token
- `CLUSTER_NAME`: Base name for Kubernetes cluster (e.g., "kai")
- `DO_REGION`: Digital Ocean region (e.g., "ams3")
- `KUBE_CONFIG_DATA`: Base64-encoded Kubernetes config (if not using DO provisioning)

#### Application
- `DOMAIN_NAME`: Domain name for the application (e.g., "kai-platform.com")
- `ADMIN_EMAIL`: Email for SSL certificate notifications
- `MONGODB_URI`: MongoDB connection string
- `JWT_SECRET`: Secret for JWT tokens
- `OPENAI_API_KEY`: OpenAI API key
- `REDIS_PASSWORD`: Password for Redis

#### Supabase
- `SUPABASE_URL_PRODUCTION`, `SUPABASE_KEY_PRODUCTION`, `SUPABASE_ANON_KEY_PRODUCTION`: Supabase production credentials
- `SUPABASE_URL_STAGING`, `SUPABASE_KEY_STAGING`, `SUPABASE_ANON_KEY_STAGING`: Supabase staging credentials

#### Payment Processing
- `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`: Stripe payment credentials

#### Frontend Deployment
- `VERCEL_TOKEN`, `VERCEL_ORG_ID`: Vercel credentials
- `VERCEL_PROJECT_ID_CLIENT`, `VERCEL_PROJECT_ID_ADMIN`: Vercel project IDs

#### Notifications
- `SLACK_WEBHOOK`: Slack notification webhook URL

## Removed Legacy Workflows and Scripts

As the CI/CD system has evolved, several workflows and scripts have been removed in favor of more modern approaches:

### Removed Workflows

- **workflow-env.yml**: This was a reference file that documented environment variables but never actually ran. This information has been moved to this documentation file.

- **dependency-scanner.yml**: This workflow has been replaced by the more advanced `dependency-update-testing.yml` which includes additional features like creating PRs for safe updates and running targeted tests.

### Removed Scripts

The following scripts have been removed as they are no longer needed with the current GitOps approach:

#### General Deployment Scripts

- **helm-charts/helm-deploy.sh**: Removed in favor of Flux GitOps

#### RAG System Deployment Scripts

The following scripts for the RAG system deployment have been removed as they are now superseded by the GitHub Actions workflow in `.github/workflows/enhanced-rag.yml`:

- **deploy-rag.sh**: Manual deployment script for the RAG system
- **rag-deployment-pipeline.sh**: Orchestrates the RAG deployment process
- **build-push-rag.sh**: Builds and pushes RAG Docker images
- **verify-rag-deployment.sh**: Verifies the RAG deployment
- **monitor-rag-performance.sh**: Monitors RAG system performance
- **monitor-rag-api.sh**: Monitors RAG API performance

### Current Deployment Approach

All deployments are now handled through the GitOps approach with Flux. In case of emergency where the GitOps approach is not working, the deployment can be performed manually using kubectl and Helm commands directly, following the patterns established in the CI/CD workflows.

## Flux GitOps Integration

The CI/CD pipeline now integrates with Flux CD, providing a GitOps approach to Kubernetes deployments:

### GitOps Repository Structure

```
flux/
├── clusters/
│   ├── staging/
│   │   ├── flux-system/
│   │   │   ├── gotk-sync.yaml       # Flux synchronization configuration
│   │   │   └── kustomization.yaml   # Flux system components
│   │   ├── sources/
│   │   │   ├── helm-repository.yaml # Helm chart repository definition
│   │   │   └── kustomization.yaml   # Sources kustomization
│   │   ├── releases/
│   │   │   ├── coordinator.yaml     # HelmRelease for coordinator service
│   │   │   └── kustomization.yaml   # Releases kustomization
│   │   └── kustomization.yaml       # Main kustomization including all components
│   └── production/
│       └── (Similar structure as staging)
```

### CI/CD Workflow Integration

The deployment workflows include jobs that update the GitOps repository with new image versions:

```yaml
update-gitops:
  name: Update GitOps Repository
  runs-on: ubuntu-latest
  steps:
    - name: Checkout GitOps repository
      # Checkout the GitOps repository...

    - name: Update image tags in HelmReleases
      # Update image tags and commit changes...
```

This job:
1. Determines the target environment (staging or production)
2. Checks out the GitOps repository at the appropriate branch
3. Updates image tags in the HelmRelease resources
4. Commits and pushes changes to the GitOps repository

### Flux Automation

Flux operates by continuously monitoring the GitOps repository:

1. **Source Controller**: Watches the Git repository for changes
2. **Kustomize Controller**: Applies Kubernetes resources defined via kustomize
3. **Helm Controller**: Manages Helm releases based on HelmRelease resources
4. **Notification Controller**: Provides alerts and notifications for events

When the CI/CD pipeline updates image tags in the GitOps repository, Flux automatically:
1. Detects the changes via the Source Controller
2. Processes the updated HelmRelease resources
3. Deploys the new image versions to the cluster
4. Reports status via the Notification Controller

### Benefits of Flux GitOps

The Flux GitOps approach provides several advantages:

1. **Declarative Configuration**: All Kubernetes resources are defined as code in the GitOps repository
2. **Automated Reconciliation**: Flux continuously ensures the cluster state matches the desired state in Git
3. **Audit Trail**: All changes are tracked in Git with commit history and authorship
4. **Self-Healing**: Flux automatically recovers from drift by reapplying the desired state
5. **Enhanced Security**: Reduced need for direct cluster access; changes go through Git
6. **Progressive Delivery**: Support for canary deployments and A/B testing
7. **Multi-Cluster Management**: Simplified management of resources across multiple clusters
8. **Simplified Rollbacks**: Reverting to a previous state is as simple as reverting a Git commit

## Required GitHub Secrets

The workflow requires the following secrets to be set in your GitHub repository:

### Vercel Deployment Secrets
- `VERCEL_TOKEN`: API token from Vercel
- `VERCEL_ORG_ID`: Your Vercel organization ID
- `VERCEL_PROJECT_ID_CLIENT`: Project ID for the client application
- `VERCEL_PROJECT_ID_ADMIN`: Project ID for the admin application

### GitOps Repository Access
- `GITOPS_PAT`: Personal access token for the GitOps repository

### Digital Ocean Kubernetes Secrets
- `KUBE_CONFIG_DATA`: Base64-encoded kubeconfig file for your Kubernetes cluster

### Container Registry Secrets
- `DOCKER_USERNAME`: Docker Hub username or container registry username
- `DOCKER_PASSWORD`: Docker Hub password or container registry password
- `DOCKER_REGISTRY`: Container registry URL (e.g., docker.io, ghcr.io)

### Database and API Secrets
- `SUPABASE_URL_STAGING`: Supabase project URL for staging environment migrations
- `SUPABASE_KEY_STAGING`: Supabase service role key for staging environment migrations
- `SUPABASE_URL_PRODUCTION`: Supabase project URL for production environment migrations
- `SUPABASE_KEY_PRODUCTION`: Supabase service role key for production environment migrations

## Adding GitHub Secrets

To add these secrets to your repository:

1. Go to your GitHub repository → Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Enter the secret name (e.g., `VERCEL_TOKEN`) and value
4. Click "Add secret"
5. Repeat for all required secrets

## Customizing the Workflow

To customize the workflow for your specific needs:

1. Modify the core reusable workflow files for global changes:
   - `.github/workflows/build-test.yml` - Build and test process
   - `.github/workflows/docker-build.yml` - Docker image building
   - `.github/workflows/deploy-staging.yml` - Staging deployment
   - `.github/workflows/deploy-production.yml` - Production deployment

2. For environment-specific changes:
   - Update only the relevant environment workflow
   - Keep shared logic in the common workflow files

3. To add a new environment:
   - Create a new environment-specific deployment workflow file
   - Update the main workflow to call this new workflow with appropriate conditions

## Troubleshooting

If you encounter issues with the pipeline:

1. Check the Actions tab in your GitHub repository to see detailed logs
2. Look at the specific workflow run that failed to identify the problem
3. For workflow-specific issues, check the individual reusable workflow files
4. Verify that all required secrets are properly configured
5. Ensure branch protection rules are set correctly

### Troubleshooting Kubernetes Deployment

For Kubernetes-specific issues:

1. Check pod status and logs:
   ```bash
   kubectl get pods -n kai-ml
   kubectl logs <pod-name> -n kai-ml
   ```

2. Check Argo Workflows:
   ```bash
   kubectl get workflows -n kai-ml
   kubectl get workflowtemplates -n kai-ml
   ```

3. View the Coordinator service logs:
   ```bash
   kubectl logs -l app=coordinator-service -n kai-ml
   ```

4. Check for configuration issues:
   ```bash
   kubectl get configmaps -n kai-ml
   kubectl get secrets -n kai-ml
   ```

The Coordinator service provides detailed logs about workflow submissions and their status, which is the first place to look when troubleshooting ML pipeline issues.