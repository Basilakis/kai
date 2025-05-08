# Vercel Deployment Guide for Kai

This guide provides detailed instructions for deploying the Kai application's frontend components to Vercel, including the Next.js admin panel and Gatsby client application.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Vercel Account Setup](#vercel-account-setup)
- [Admin Panel Deployment (Next.js)](#admin-panel-deployment-nextjs)
- [Client App Deployment (Gatsby)](#client-app-deployment-gatsby)
- [Environment Variables](#environment-variables)
- [Custom Domain Configuration](#custom-domain-configuration)
- [Deployment Settings](#deployment-settings)
- [Preview Deployments](#preview-deployments)
- [Monitoring and Analytics](#monitoring-and-analytics)
- [Troubleshooting](#troubleshooting)

## Prerequisites

Before proceeding with Vercel deployment, ensure you have:

- A GitHub account with the Kai repository
- A Vercel account
- Supabase project already set up (see the [Supabase Setup Guide](./supabase-setup-guide.md))
- Backend services deployed to Digital Ocean Kubernetes (see the [Digital Ocean Kubernetes Setup Guide](./digital-ocean-kubernetes-setup.md))
- Domain name(s) for your application

## Vercel Account Setup

### Step 1: Create a Vercel Account

If you don't have a Vercel account, create one at [https://vercel.com/signup](https://vercel.com/signup). It's recommended to sign up using your GitHub account for seamless integration.

### Step 2: Connect GitHub Repository

1. After signing in to Vercel, click **Add New...** → **Project**
2. Select your GitHub account
3. Find and select the Kai repository
4. If you don't see your repository, click **Adjust GitHub App Permissions** and grant Vercel access to the repository

## Admin Panel Deployment (Next.js)

The admin panel is a Next.js application located in `packages/admin`.

### Step 1: Import Project

1. Click **Import** on the Kai repository
2. Configure the project settings:
   - **Framework Preset**: Next.js
   - **Root Directory**: `packages/admin`
   - **Build Command**: `yarn build` (default)
   - **Output Directory**: `.next` (default for Next.js)
   - **Install Command**: `cd ../.. && yarn install`

### Step 2: Configure Environment Variables

Add the following environment variables:

```
NEXT_PUBLIC_API_URL=https://api.kai.yourdomain.com
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

For more detailed environment variables, see the [Environment Variables](#environment-variables) section below.

### Step 3: Deploy the Admin Panel

1. Click **Deploy**
2. Wait for the build and deployment to complete
3. Once deployed, you'll receive a URL like `kai-admin.vercel.app`

## Client App Deployment (Gatsby)

The client application is a Gatsby app located in `packages/client`.

### Step 1: Import Project

1. Click **Add New...** → **Project**
2. Select your GitHub account and the Kai repository again
3. Configure the project settings:
   - **Framework Preset**: Gatsby
   - **Root Directory**: `packages/client`
   - **Build Command**: `yarn build` (default)
   - **Output Directory**: `public` (default for Gatsby)
   - **Install Command**: `cd ../.. && yarn install`

### Step 2: Configure Environment Variables

Add the following environment variables:

```
GATSBY_API_URL=https://api.kai.yourdomain.com
GATSBY_SUPABASE_URL=https://your-project.supabase.co
GATSBY_SUPABASE_ANON_KEY=your-supabase-anon-key
GATSBY_STORAGE_URL=https://your-s3-bucket.s3.amazonaws.com
```

For more detailed environment variables, see the [Environment Variables](#environment-variables) section below.

### Step 3: Deploy the Client App

1. Click **Deploy**
2. Wait for the build and deployment to complete
3. Once deployed, you'll receive a URL like `kai-client.vercel.app`

## Environment Variables

### Admin Panel Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | URL of your backend API | `https://api.kai.yourdomain.com` |
| `NEXT_PUBLIC_SUPABASE_URL` | URL of your Supabase project | `https://your-project.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | `eyJhbGciOiJIUzI1NiIsImtpZCI6...` |
| `NEXT_PUBLIC_APP_ENV` | Environment name | `production` |
| `NEXT_PUBLIC_STORAGE_URL` | URL for S3 storage | `https://your-s3-bucket.s3.amazonaws.com` |
| `NEXT_PUBLIC_ENABLE_ANALYTICS` | Enable analytics | `true` |

### Client App Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `GATSBY_API_URL` | URL of your backend API | `https://api.kai.yourdomain.com` |
| `GATSBY_SUPABASE_URL` | URL of your Supabase project | `https://your-project.supabase.co` |
| `GATSBY_SUPABASE_ANON_KEY` | Supabase anonymous key | `eyJhbGciOiJIUzI1NiIsImtpZCI6...` |
| `GATSBY_STORAGE_URL` | URL for S3 storage | `https://your-s3-bucket.s3.amazonaws.com` |
| `GATSBY_DEFAULT_LOCALE` | Default locale | `en` |
| `GATSBY_ENABLE_OFFLINE` | Enable offline support | `true` |
| `GATSBY_GOOGLE_ANALYTICS_ID` | Google Analytics ID | `G-XXXXXXXXXX` |

## Custom Domain Configuration

### Step 1: Add Custom Domains

For both the admin panel and client app projects:

1. Go to the project in the Vercel dashboard
2. Navigate to **Settings** → **Domains**
3. Click **Add**
4. Enter the domain:
   - Admin Panel: `admin.kai.yourdomain.com`
   - Client App: `kai.yourdomain.com`
5. Click **Add**

### Step 2: Configure DNS

Vercel will provide instructions for configuring your DNS settings. You have two options:

**Option 1: Using Vercel as the DNS provider**
1. Click **Manage DNS on Vercel** in the domain settings
2. Add any additional DNS records as needed

**Option 2: Using your own DNS provider**
1. Add a CNAME record pointing to `cname.vercel-dns.com`:
   - Admin Panel: `admin.kai` → `cname.vercel-dns.com`
   - Client App: `kai` → `cname.vercel-dns.com`
2. Verify the domain in Vercel

### Step 3: SSL Configuration

Vercel automatically provisions and renews SSL certificates for your domains. No additional configuration is required.

## Deployment Settings

### Build & Development Settings

For optimal performance in a monorepo setup:

1. Go to **Settings** → **General** → **Build & Development Settings**
2. Configure the following:
   - **Framework Preset**: Next.js (admin) or Gatsby (client)
   - **Node.js Version**: 16.x
   - **Include source files outside of the Root Directory in the Build Step**: Yes
   - **Install Command**: `cd ../.. && yarn install`

### Build Cache

Enable build cache to speed up deployments:

1. Go to **Settings** → **General** → **Build & Development Settings**
2. Ensure **Cache** is turned on

### Production Branch

Configure which branch triggers production deployments:

1. Go to **Settings** → **Git**
2. Set **Production Branch** to `main` or `master`

## Preview Deployments

Vercel automatically creates preview deployments for each pull request:

### Branch Previews

1. Go to **Settings** → **Git**
2. Ensure **Preview Deployment for Pull Requests** is enabled

### Preview URLs

Preview deployments will have URLs like:
- Admin Panel: `kai-admin-git-feature-branch-username.vercel.app`
- Client App: `kai-client-git-feature-branch-username.vercel.app`

### Environment Variables for Previews

You can configure different environment variables for preview deployments:

1. Go to **Settings** → **Environment Variables**
2. Add the variables you want to override in preview environments
3. Select **Preview** from the environment dropdown

## Monitoring and Analytics

### Performance Monitoring

Vercel provides built-in analytics and performance monitoring:

1. Go to the project dashboard
2. Navigate to **Analytics**
3. View metrics such as:
   - Web Vitals (LCP, CLS, FID)
   - Page views
   - API response times
   - Error rates

### Error Tracking

To set up error tracking:

1. Go to **Settings** → **Integrations**
2. Add an error tracking integration:
   - Sentry
   - Datadog
   - New Relic
   - LogRocket

### Real User Monitoring

Enable Real User Monitoring (RUM) for detailed performance insights:

1. Go to **Settings** → **Analytics**
2. Enable **Real User Monitoring**

## Troubleshooting

### Build Failures

If your build fails, check the following:

1. **Environment Variables**: Ensure all required variables are set
2. **Dependencies**: Check for missing or incompatible dependencies
   - Examine the build logs in the Vercel dashboard
   - Verify that all dependencies are properly declared in package.json

3. **Build Command**: Verify the build command is correct
   - For Next.js admin: `yarn build`
   - For Gatsby client: `yarn build`

4. **Monorepo Issues**: If you're having issues with dependencies in the monorepo:
   - Ensure you're using `cd ../.. && yarn install` as the install command
   - Check that your package.json workspaces are properly configured

### Deployment Issues

If your deployment succeeds but the application doesn't work correctly:

1. **API Connection**: Check that the application can connect to your API
   - Verify the API URL in environment variables
   - Ensure CORS is properly configured on your API

2. **Supabase Connection**: Verify Supabase connectivity
   - Check Supabase URL and anon key in environment variables
   - Ensure the Supabase project is running and accessible

3. **Browser Console Errors**: Inspect the browser console for JavaScript errors
   - Use browser developer tools to diagnose client-side issues

### Domain Issues

If your custom domain isn't working:

1. **DNS Propagation**: DNS changes can take up to 48 hours to propagate
   - Use `dig` or `nslookup` to check if DNS records have propagated

2. **SSL Certificate**: Ensure SSL certificate is properly provisioned
   - Vercel should automatically provision certificates
   - Check for SSL errors in the Vercel dashboard

3. **Domain Configuration**: Verify domain settings in Vercel
   - Ensure your DNS records match Vercel's recommendations

## Automatic Deployments

Vercel automatically deploys your application when you push to the production branch (main/master). To set up additional deployment controls:

### Github Actions Integration

For more advanced deployment workflows, integrate with GitHub Actions:

1. Add a GitHub Actions workflow file at `.github/workflows/vercel-deploy.yml`:

```yaml
name: Deploy Frontend to Vercel

on:
  push:
    branches: [ main, master ]
    paths:
      - 'packages/admin/**'
      - 'packages/client/**'
      - 'packages/shared/**'
  workflow_dispatch:

jobs:
  deploy-admin:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Deploy Admin to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: {% raw %}${{ secrets.VERCEL_TOKEN }}{% endraw %}
          github-token: {% raw %}${{ secrets.GITHUB_TOKEN }}{% endraw %}
          vercel-org-id: {% raw %}${{ secrets.VERCEL_ORG_ID }}{% endraw %}
          vercel-project-id: {% raw %}${{ secrets.VERCEL_ADMIN_PROJECT_ID }}{% endraw %}
          working-directory: ./packages/admin
          vercel-args: '--prod'

  deploy-client:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Deploy Client to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: {% raw %}${{ secrets.VERCEL_TOKEN }}{% endraw %}
          github-token: {% raw %}${{ secrets.GITHUB_TOKEN }}{% endraw %}
          vercel-org-id: {% raw %}${{ secrets.VERCEL_ORG_ID }}{% endraw %}
          vercel-project-id: {% raw %}${{ secrets.VERCEL_CLIENT_PROJECT_ID }}{% endraw %}
          working-directory: ./packages/client
          vercel-args: '--prod'
```

2. Configure required secrets in GitHub:
   - `VERCEL_TOKEN`: API token from Vercel
   - `VERCEL_ORG_ID`: Organization ID from Vercel
   - `VERCEL_ADMIN_PROJECT_ID`: Project ID for admin panel
   - `VERCEL_CLIENT_PROJECT_ID`: Project ID for client app

## Conclusion

Following this guide, you've successfully deployed the Kai application's frontend components to Vercel. The Next.js admin panel and Gatsby client application are now accessible via their respective domains and integrated with your backend services on Digital Ocean Kubernetes and Supabase.

Remember to regularly monitor your deployments for performance issues, error rates, and resource usage. As your application evolves, you may need to adjust build settings, environment variables, and integration points.