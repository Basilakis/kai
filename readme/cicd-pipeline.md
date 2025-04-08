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

## CI/CD Pipeline Configuration

The CI/CD pipeline is implemented using GitHub Actions. The workflow is defined in `.github/workflows/deploy.yml` and includes the following stages:

1. **Build and Test**: Triggered on all branches
   - Install dependencies
   - Run linting
   - Run unit tests
   - Build packages

2. **Deploy to Staging**: Triggered on `staging` branch
   - Run database migrations for staging environment
   - Deploy frontend to staging environment
   - Deploy backend to staging environment
   - Run integration tests

3. **Deploy to Production**: Triggered ONLY on `main` branch
   - Run database migrations for production environment
   - Deploy frontend to production
   - Deploy backend to production
   - Run smoke tests
   - Monitor deployment

## Database Migrations in CI/CD

A critical component of the deployment process is the automated database migration system that ensures schema changes are applied consistently across environments:

### Migration Process

1. **Migration Files**: SQL migration files stored in `packages/server/src/services/supabase/migrations/` follow a sequential naming convention (001_initial_schema.sql, 002_hybrid_search.sql, etc.)

2. **Migration Execution**:
   - During deployment, before any application containers are updated
   - Migrations use a TypeScript script (`packages/server/scripts/run-migrations.ts`) 
   - Each environment (staging, production) has its own migration state

3. **Migration Tracking**:
   - A `schema_migrations` table in Supabase records applied migrations
   - Prevents duplicate execution of migrations across deployments
   - Maintains an audit trail with timestamps for each applied migration

### Migration CI/CD Integration

The workflow includes dedicated steps for running migrations before deploying application changes:

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

Similar steps are included in the production deployment job with production-specific credentials.

### Migration Safety Features

The migration system includes several safety features:

1. **Idempotency**: Migrations are only applied once per environment
2. **Fail-Fast**: If a migration fails, the deployment is halted to prevent inconsistent states
3. **Sequentiality**: Migrations are always applied in the correct order
4. **Environment Isolation**: Each environment maintains its own migration state
5. **Transaction Support**: SQL migrations can use transactions for atomicity

### Adding New Migrations

To add a new database schema change:

1. Create a new SQL file in the migrations directory with the next sequential number
2. Commit the file to the repository
3. The CI/CD pipeline will automatically apply the migration during the next deployment

## Setting Up Branch Protection

To configure branch protection for your repository:

1. Go to your GitHub repository → Settings → Branches
2. Under "Branch protection rules" click "Add rule"
3. For the "main" branch:
   - Enter "main" as the branch name pattern
   - Check "Require pull request reviews before merging"
   - Check "Require status checks to pass before merging"
   - Check "Restrict who can push to matching branches"
   - Add "Basilakis" as an allowed user to push to main
   - Check "Include administrators" to enforce rules for everyone
   - Click "Create" or "Save changes"
4. Repeat with appropriate settings for "staging" and "development" branches

## Required GitHub Secrets

The workflow requires the following secrets to be set in your GitHub repository:

### Vercel Deployment Secrets
- `VERCEL_TOKEN`: API token from Vercel
- `VERCEL_ORG_ID`: Your Vercel organization ID
- `VERCEL_PROJECT_ID_CLIENT`: Project ID for the client application
- `VERCEL_PROJECT_ID_ADMIN`: Project ID for the admin application

### Digital Ocean Kubernetes Secrets
- `DIGITALOCEAN_ACCESS_TOKEN`: Access token for Digital Ocean API
- `KUBE_CONFIG_DATA`: Base64-encoded kubeconfig file for your Kubernetes cluster

### Container Registry Secrets
- `DOCKER_USERNAME`: Docker Hub username or container registry username
- `DOCKER_PASSWORD`: Docker Hub password or container registry password
- `DOCKER_REGISTRY`: Container registry URL (e.g., docker.io, ghcr.io)

### AWS Secrets (for S3/CloudFront Frontend Deployment)
- `AWS_ACCESS_KEY_ID`: AWS access key with S3 and CloudFront permissions
- `AWS_SECRET_ACCESS_KEY`: AWS secret access key
- `AWS_REGION`: AWS region for deployment (e.g., us-east-1)
- `CLIENT_BUCKET_NAME`: S3 bucket name for client static files
- `ADMIN_BUCKET_NAME`: S3 bucket name for admin static files
- `CLOUDFRONT_DISTRIBUTION_ID_CLIENT`: CloudFront distribution ID for client
- `CLOUDFRONT_DISTRIBUTION_ID_ADMIN`: CloudFront distribution ID for admin

### Database and API Secrets
- `MONGODB_URI`: MongoDB connection string
- `SUPABASE_URL`: Supabase project URL (for general use)
- `SUPABASE_KEY`: Supabase service role key (for general use)
- `SUPABASE_URL_STAGING`: Supabase project URL for staging environment migrations
- `SUPABASE_KEY_STAGING`: Supabase service role key for staging environment migrations
- `SUPABASE_URL_PRODUCTION`: Supabase project URL for production environment migrations
- `SUPABASE_KEY_PRODUCTION`: Supabase service role key for production environment migrations
- `JWT_SECRET`: Secret for JWT token generation

## Adding GitHub Secrets

To add these secrets to your repository:

1. Go to your GitHub repository → Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Enter the secret name (e.g., `VERCEL_TOKEN`) and value
4. Click "Add secret"
5. Repeat for all required secrets

## Pipeline Workflow File

The GitHub Actions workflow file (`.github/workflows/deploy.yml`) implements the CI/CD pipeline according to these specifications. This file defines the automated processes that run when code is pushed to the repository.

## Deployment Status and Monitoring

The pipeline includes deployment status reporting via GitHub Deployments API. Each deployment creates a deployment record that you can monitor from the GitHub repository's Deployments tab.

Additionally, the pipeline sends notifications upon completion or failure via:
- GitHub commit status checks
- Optional Slack notifications (requires additional configuration)

## Customizing the Pipeline

To customize the pipeline for your specific needs:
1. Modify the `.github/workflows/deploy.yml` file
2. Add or remove stages as needed
3. Adjust environment variables and deployment targets
4. Update notification settings

## Troubleshooting

If you encounter issues with the pipeline:

1. Check the Actions tab in your GitHub repository to see detailed logs
2. Verify that all required secrets are properly configured
3. Ensure branch protection rules are set correctly
4. Confirm that the Basilakis user has proper access to the repository