# Digital Ocean App Platform Deployment Guide

This guide covers deploying the frontend packages (client and admin) to Digital Ocean App Platform, consolidating all services within the Digital Ocean ecosystem.

## Architecture Overview

- **Frontend (Digital Ocean App Platform)**:
  - `packages/client` - Gatsby-based public website
  - `packages/admin` - Next.js admin panel
- **Backend (Digital Ocean Kubernetes)**:
  - API services, ML processing, analytics, etc.
- **Infrastructure (Digital Ocean)**:
  - DOKS (Digital Ocean Kubernetes Service)
  - DO Spaces (S3-compatible storage)
  - DO Managed Databases
  - DO Load Balancers

## Prerequisites

1. Digital Ocean account with API access
2. `doctl` CLI installed and configured
3. Access to environment variables for both applications
4. Backend services running on Digital Ocean Kubernetes

## App Platform Configuration Files

The deployment is configured using `.do/app.yaml` files in each frontend package:

### Client Application Configuration (`packages/client/.do/app.yaml`)

```yaml
name: kai-client
services:
- name: client
  source_dir: /packages/client
  github:
    repo: your-username/kai
    branch: main
  run_command: npm start
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs
  http_port: 8080
  envs:
  - key: GATSBY_API_URL
    scope: RUN_TIME
    type: SECRET
  - key: GATSBY_SUPABASE_URL
    scope: RUN_TIME
    type: SECRET
  - key: GATSBY_SUPABASE_ANON_KEY
    scope: RUN_TIME
    type: SECRET
  build_command: npm run build
```

### Admin Application Configuration (`packages/admin/.do/app.yaml`)

```yaml
name: kai-admin
services:
- name: admin
  source_dir: /packages/admin
  github:
    repo: your-username/kai
    branch: main
  run_command: npm start
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs
  http_port: 3000
  envs:
  - key: NEXTAUTH_URL
    scope: RUN_TIME
    type: SECRET
  - key: NEXTAUTH_SECRET
    scope: RUN_TIME
    type: SECRET
  - key: NEXT_PUBLIC_API_URL
    scope: RUN_TIME
    type: SECRET
  - key: DATABASE_URL
    scope: RUN_TIME
    type: SECRET
  build_command: npm run build
```

## Environment Variables Setup

### Client Application (Gatsby)

Required environment variables in Digital Ocean App Platform:

```bash
GATSBY_API_URL=https://api.your-domain.com
GATSBY_SUPABASE_URL=https://your-project.supabase.co
GATSBY_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### Admin Application (Next.js)

Required environment variables in Digital Ocean App Platform:

```bash
NEXTAUTH_URL=https://admin.your-domain.com
NEXTAUTH_SECRET=your-nextauth-secret
NEXT_PUBLIC_API_URL=https://api.your-domain.com
DATABASE_URL=your-database-connection-string
```

## Deployment Steps

### 1. Install and Configure doctl CLI

```bash
# Install doctl (macOS)
brew install doctl

# Install doctl (Linux)
wget https://github.com/digitalocean/doctl/releases/download/v1.94.0/doctl-1.94.0-linux-amd64.tar.gz
tar xf doctl-1.94.0-linux-amd64.tar.gz
sudo mv doctl /usr/local/bin

# Authenticate with Digital Ocean
doctl auth init
```

### 2. Create App Platform Applications

#### Deploy Client Application

```bash
cd packages/client
doctl apps create .do/app.yaml
```

#### Deploy Admin Application

```bash
cd packages/admin
doctl apps create .do/app.yaml
```

### 3. Configure Environment Variables

For each application in Digital Ocean App Platform dashboard:

1. Go to your app → Settings → Environment Variables
2. Add all required variables for the respective application
3. Set them as encrypted secrets for security

Alternatively, use doctl CLI:

```bash
# Set environment variables for client app
doctl apps update CLIENT_APP_ID --spec .do/app.yaml

# Set environment variables for admin app
doctl apps update ADMIN_APP_ID --spec .do/app.yaml
```

## Domain Configuration

### Custom Domains

1. In Digital Ocean App Platform dashboard, go to your app → Settings → Domains
2. Add your custom domains:
   - Client: `your-domain.com`
   - Admin: `admin.your-domain.com`
3. Configure DNS records as instructed by Digital Ocean

### SSL Certificates

Digital Ocean App Platform automatically provisions SSL certificates for custom domains.

## Build Configuration

### Client (Gatsby) Build Settings

The App Platform configuration handles:
- Node.js environment with npm build
- Static file serving from build output
- SPA routing support
- Environment variable injection

### Admin (Next.js) Build Settings

The App Platform configuration handles:
- Next.js build and start commands
- Server-side rendering support
- API routes deployment
- Environment variable injection

## Monitoring and Logs

### Digital Ocean App Platform Dashboard

- Monitor deployments in real-time
- View build logs and runtime logs
- Set up deployment notifications
- Monitor resource usage and performance

### Application Insights

Digital Ocean App Platform provides:
1. Real-time metrics and monitoring
2. Application performance insights
3. Error tracking and logging
4. Resource utilization monitoring

## Troubleshooting

### Common Issues

1. **Build Failures**
   - Check build logs in Digital Ocean dashboard
   - Verify all dependencies are in `package.json`
   - Ensure environment variables are set correctly
   - Check Node.js version compatibility

2. **API Connection Issues**
   - Verify `GATSBY_API_URL` and `NEXT_PUBLIC_API_URL` point to correct backend
   - Check CORS settings on backend services
   - Ensure backend services are accessible from App Platform

3. **Authentication Issues**
   - Verify `NEXTAUTH_URL` matches the deployed domain
   - Check `NEXTAUTH_SECRET` is set and secure
   - Ensure callback URLs are configured correctly

### Performance Optimization

1. **Image Optimization**
   - Use Digital Ocean Spaces for image storage
   - Configure `next/image` for Next.js admin panel
   - Use Gatsby's image plugins with DO Spaces

2. **Caching**
   - Configure appropriate cache headers
   - Use Digital Ocean CDN for static assets
   - Implement proper caching strategies

## Continuous Deployment

### Git Integration

1. Connect GitHub repositories to App Platform applications
2. Configure automatic deployments on push to main branch
3. Set up preview deployments for pull requests

### Deployment Hooks

Configure webhooks for:
- Content management system updates
- Database schema changes
- Backend service deployments

## Security Considerations

1. **Environment Variables**
   - Never commit sensitive variables to git
   - Use Digital Ocean's encrypted environment variables
   - Rotate secrets regularly

2. **CORS Configuration**
   - Configure backend CORS to allow App Platform domains
   - Use specific origins instead of wildcards in production

3. **Authentication**
   - Implement proper session management
   - Use secure cookie settings
   - Configure CSP headers

## Rollback Procedures

### Quick Rollback

1. Go to Digital Ocean App Platform dashboard → Deployments
2. Find the last known good deployment
3. Click "Rollback" to revert to that deployment

### CLI Rollback

```bash
# List deployments
doctl apps list-deployments APP_ID

# Rollback to specific deployment
doctl apps create-deployment APP_ID --deployment-id DEPLOYMENT_ID
```

## Monitoring and Alerts

### Set up monitoring for:

1. **Uptime monitoring**
2. **Performance metrics**
3. **Error tracking**
4. **Build failure notifications**
5. **Resource utilization alerts**

## Cost Optimization

1. **Optimize bundle sizes**
2. **Use appropriate instance sizes**
3. **Monitor bandwidth usage**
4. **Leverage Digital Ocean's pricing tiers**
5. **Use CDN for static assets**

## Integration with Existing Digital Ocean Infrastructure

### Benefits of Consolidation

1. **Unified Management**: Single dashboard for all services
2. **Network Performance**: Reduced latency between frontend and backend
3. **Cost Efficiency**: Simplified billing and potential volume discounts
4. **Security**: Simplified network security and VPC integration
5. **Monitoring**: Centralized monitoring and alerting

### VPC Integration

App Platform applications can be integrated with your existing VPC:
1. Configure VPC settings in app specification
2. Enable private networking between frontend and backend
3. Use internal load balancers for backend communication

## Next Steps

After successful deployment:

1. Update DNS records to point to Digital Ocean App Platform
2. Configure monitoring and alerting
3. Set up automated testing for deployments
4. Document any custom deployment procedures
5. Train team on Digital Ocean App Platform dashboard usage
6. Consider setting up staging environments
7. Implement proper CI/CD pipelines with GitHub Actions