# Vercel Deployment Guide

This guide covers deploying the frontend packages (client and admin) to Vercel while keeping backend services on Digital Ocean.

## Architecture Overview

- **Frontend (Vercel)**: 
  - `packages/client` - Gatsby-based public website
  - `packages/admin` - Next.js admin panel
- **Backend (Digital Ocean Kubernetes)**: 
  - API services, ML processing, analytics, etc.

## Prerequisites

1. Vercel account with CLI installed
2. Access to environment variables for both applications
3. Backend services running on Digital Ocean

## Environment Variables Setup

### Client Application (Gatsby)

Required environment variables in Vercel:

```bash
GATSBY_API_URL=https://api.your-domain.com
GATSBY_SUPABASE_URL=https://your-project.supabase.co
GATSBY_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### Admin Application (Next.js)

Required environment variables in Vercel:

```bash
NEXTAUTH_URL=https://admin.your-domain.com
NEXTAUTH_SECRET=your-nextauth-secret
NEXT_PUBLIC_API_URL=https://api.your-domain.com
DATABASE_URL=your-database-connection-string
```

## Deployment Steps

### 1. Install Vercel CLI

```bash
npm install -g vercel
```

### 2. Login to Vercel

```bash
vercel login
```

### 3. Deploy Client Application

```bash
cd packages/client
vercel --prod
```

Follow the prompts:
- Link to existing project or create new one
- Set project name: `kai-client`
- Configure build settings (should auto-detect Gatsby)

### 4. Deploy Admin Application

```bash
cd packages/admin
vercel --prod
```

Follow the prompts:
- Link to existing project or create new one
- Set project name: `kai-admin`
- Configure build settings (should auto-detect Next.js)

### 5. Configure Environment Variables

For each project in Vercel dashboard:

1. Go to Project Settings → Environment Variables
2. Add all required variables for the respective application
3. Set them for Production, Preview, and Development environments

## Domain Configuration

### Custom Domains

1. In Vercel dashboard, go to Project Settings → Domains
2. Add your custom domains:
   - Client: `your-domain.com`
   - Admin: `admin.your-domain.com`
3. Configure DNS records as instructed by Vercel

### SSL Certificates

Vercel automatically provisions SSL certificates for custom domains.

## Build Configuration

### Client (Gatsby) Build Settings

The `vercel.json` configuration handles:
- Static build using `@vercel/static-build`
- Output directory: `public`
- SPA routing fallback to `index.html`

### Admin (Next.js) Build Settings

The `vercel.json` configuration handles:
- Next.js build using `@vercel/next`
- Automatic API routes deployment
- Environment variable injection

## Monitoring and Logs

### Vercel Dashboard

- Monitor deployments in real-time
- View build logs and runtime logs
- Set up deployment notifications

### Analytics

Enable Vercel Analytics for performance monitoring:
1. Go to Project Settings → Analytics
2. Enable Web Analytics
3. Add analytics script to your applications

## Troubleshooting

### Common Issues

1. **Build Failures**
   - Check build logs in Vercel dashboard
   - Verify all dependencies are in `package.json`
   - Ensure environment variables are set correctly

2. **API Connection Issues**
   - Verify `GATSBY_API_URL` and `NEXT_PUBLIC_API_URL` point to correct backend
   - Check CORS settings on backend services
   - Ensure backend services are accessible from Vercel's edge network

3. **Authentication Issues**
   - Verify `NEXTAUTH_URL` matches the deployed domain
   - Check `NEXTAUTH_SECRET` is set and secure
   - Ensure callback URLs are configured correctly

### Performance Optimization

1. **Image Optimization**
   - Use Vercel's built-in image optimization
   - Configure `next/image` for Next.js admin panel
   - Use Gatsby's image plugins for client application

2. **Caching**
   - Configure appropriate cache headers
   - Use Vercel's Edge Network for static assets
   - Implement ISR (Incremental Static Regeneration) where applicable

## Continuous Deployment

### Git Integration

1. Connect repositories to Vercel projects
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
   - Use Vercel's encrypted environment variables
   - Rotate secrets regularly

2. **CORS Configuration**
   - Configure backend CORS to allow Vercel domains
   - Use specific origins instead of wildcards in production

3. **Authentication**
   - Implement proper session management
   - Use secure cookie settings
   - Configure CSP headers

## Rollback Procedures

### Quick Rollback

1. Go to Vercel dashboard → Deployments
2. Find the last known good deployment
3. Click "Promote to Production"

### Manual Rollback

```bash
vercel rollback [deployment-url]
```

## Monitoring and Alerts

### Set up monitoring for:

1. **Uptime monitoring**
2. **Performance metrics**
3. **Error tracking**
4. **Build failure notifications**

## Cost Optimization

1. **Optimize bundle sizes**
2. **Use appropriate caching strategies**
3. **Monitor bandwidth usage**
4. **Consider Vercel Pro features for team collaboration**

## Next Steps

After successful deployment:

1. Update DNS records to point to Vercel
2. Configure monitoring and alerting
3. Set up automated testing for deployments
4. Document any custom deployment procedures
5. Train team on Vercel dashboard usage