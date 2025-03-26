# Supabase Setup Guide for Kai

This guide provides detailed instructions for setting up Supabase for the Kai application, covering authentication, database configuration, storage, and realtime features.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Creating a Supabase Project](#creating-a-supabase-project)
- [Database Schema Setup](#database-schema-setup)
- [Authentication Configuration](#authentication-configuration)
- [Storage Buckets](#storage-buckets)
- [Realtime Configuration](#realtime-configuration)
- [API Keys and Security](#api-keys-and-security)
- [Monitoring and Maintenance](#monitoring-and-maintenance)

## Prerequisites

Before starting, you'll need:

- A Supabase account
- Basic understanding of SQL
- Domain name(s) for your application

## Creating a Supabase Project

### Step 1: Sign Up or Log in to Supabase

Visit [https://app.supabase.io/](https://app.supabase.io/) and log in with your account.

### Step 2: Create a New Project

1. Click **New Project**
2. Enter project details:
   - **Name**: `kai-production` (or your preferred name)
   - **Database Password**: Generate a strong password (save this securely)
   - **Region**: Choose the region closest to your users and other services
   - **Pricing Plan**: Choose appropriate plan (Free tier for development, Pro for production)
3. Click **Create New Project**

Project creation will take 1-2 minutes.

## Database Schema Setup

### Setting Up the Queue System Tables

The Kai application uses Supabase for its queue system. Set up the required tables:

1. Navigate to the **SQL Editor** in the Supabase dashboard
2. Create a new query and enter the following SQL:

```sql
-- Create necessary tables for queue management
CREATE TABLE public.queue_jobs (
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
CREATE INDEX queue_jobs_status_priority_created_idx ON public.queue_jobs (status, priority DESC, created_at);

-- Create tables for job relationships
CREATE TABLE public.job_dependencies (
  job_id UUID REFERENCES public.queue_jobs(id) ON DELETE CASCADE,
  depends_on UUID REFERENCES public.queue_jobs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (job_id, depends_on)
);

-- Create job history table for completed/failed jobs
CREATE TABLE public.job_history (
  id UUID PRIMARY KEY,
  job_type VARCHAR NOT NULL,
  status VARCHAR NOT NULL,
  payload JSONB NOT NULL,
  result JSONB,
  error TEXT,
  attempts INT NOT NULL,
  processing_time_ms INT,
  created_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

3. Execute the query

### Setting Up User Profiles and Permissions

1. Create user profiles table:

```sql
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR NOT NULL,
  first_name VARCHAR,
  last_name VARCHAR,
  avatar_url VARCHAR,
  role VARCHAR NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Only allow administrators to select all profiles
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

### Setting Up Materials Management Tables

Create tables for storing materials metadata (if not using MongoDB for this):

```sql
-- Materials table
CREATE TABLE public.materials_metadata (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_id VARCHAR,
  name VARCHAR NOT NULL,
  description TEXT,
  material_type VARCHAR NOT NULL,
  manufacturer VARCHAR,
  tags JSONB DEFAULT '[]'::jsonb,
  properties JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable Row Level Security
ALTER TABLE public.materials_metadata ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Materials are viewable by everyone"
  ON public.materials_metadata FOR SELECT
  USING (true);

CREATE POLICY "Materials are insertable by authenticated users"
  ON public.materials_metadata FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Materials are updatable by creators or admins"
  ON public.materials_metadata FOR UPDATE
  USING (
    created_by = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

## Authentication Configuration

### Step 1: Configure Auth Settings

1. Navigate to **Authentication** → **Settings** in the Supabase dashboard
2. Set the **Site URL** to your production frontend URL (e.g., `https://kai.yourdomain.com`)
3. Configure **Redirect URLs**:
   - `https://kai.yourdomain.com/auth/callback`
   - `https://admin.kai.yourdomain.com/auth/callback`
4. Enable the **Confirm email** option for added security

### Step 2: Configure Auth Providers

1. Navigate to **Authentication** → **Providers**
2. Configure Email Auth:
   - Enable **Email provider**
   - Choose **Secure email change and recovery flow**

3. (Optional) Configure additional providers:
   - Google
   - GitHub
   - Microsoft
   - etc.

For each provider, you'll need to:
- Create OAuth applications in the respective developer portals
- Configure redirect URIs
- Add client IDs and secrets to Supabase

### Step 3: Create Initial Admin User

1. Navigate to **Authentication** → **Users**
2. Click **Add User**
3. Enter admin user details:
   - Email: `admin@yourdomain.com` (use a real email)
   - Password: Generate a strong password
4. Create the user
5. Update their role in the profiles table:

```sql
INSERT INTO public.profiles (id, email, role)
VALUES (
  'admin-user-uuid-from-auth-users-table',
  'admin@yourdomain.com',
  'admin'
);
```

## Storage Buckets

Kai uses Supabase Storage for temporary file uploads and user avatars.

### Step 1: Create Storage Buckets

1. Navigate to **Storage** in the Supabase dashboard
2. Create the following buckets:
   - `avatars` - For user profile pictures
   - `temp-uploads` - For temporary file uploads before processing
   - `material-thumbnails` - For material thumbnail images

### Step 2: Configure Storage Permissions

For each bucket, configure security rules:

**Avatars Bucket**:
1. Go to **Storage** → `avatars` → **Policies**
2. Create the following policies:

```sql
-- Allow anyone to view avatars
CREATE POLICY "Avatars are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- Allow authenticated users to upload their own avatar
CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' AND
  auth.uid() = SUBSTRING(name, 1, POSITION('/' IN name) - 1)::uuid
);

-- Allow users to update their own avatar
CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars' AND
  auth.uid() = SUBSTRING(name, 1, POSITION('/' IN name) - 1)::uuid
);

-- Allow users to delete their own avatar
CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars' AND
  auth.uid() = SUBSTRING(name, 1, POSITION('/' IN name) - 1)::uuid
);
```

**Temp Uploads Bucket**:
```sql
-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload temp files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'temp-uploads' AND
  auth.role() = 'authenticated'
);

-- Allow users to access their own uploads
CREATE POLICY "Users can access their own temp uploads"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'temp-uploads' AND
  auth.uid()::text = SUBSTRING(name, 1, POSITION('/' IN name) - 1)
);

-- Files automatically expire after 24 hours (set up a cron job)
```

**Material Thumbnails Bucket**:
```sql
-- Allow anyone to view material thumbnails
CREATE POLICY "Material thumbnails are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'material-thumbnails');

-- Allow authenticated users to upload material thumbnails
CREATE POLICY "Authenticated users can upload material thumbnails"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'material-thumbnails' AND
  auth.role() = 'authenticated'
);

-- Only admins can delete material thumbnails
CREATE POLICY "Only admins can delete material thumbnails"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'material-thumbnails' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);
```

## Realtime Configuration

Kai uses Supabase Realtime for the queue system and real-time updates.

### Step 1: Enable Realtime

1. Navigate to **Database** → **Replication** in the Supabase dashboard
2. Create a publication for the queue tables:

```sql
BEGIN;
  -- Drop existing publication if it exists
  DROP PUBLICATION IF EXISTS supabase_realtime;
  
  -- Create publication for realtime tables
  CREATE PUBLICATION supabase_realtime FOR TABLE 
    public.queue_jobs, 
    public.job_dependencies,
    public.materials_metadata;
COMMIT;
```

### Step 2: Configure Client for Realtime

In your frontend application, configure the Supabase client to use Realtime:

```typescript
// In packages/client/src/services/supabaseClient.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
})

// Subscribe to queue updates
export const subscribeToQueue = (callback: (payload: any) => void) => {
  const subscription = supabase
    .channel('queue_updates')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'queue_jobs'
      },
      callback
    )
    .subscribe()
  
  return subscription
}
```

## API Keys and Security

### Step 1: Retrieve API Keys

1. Navigate to **Settings** → **API** in the Supabase dashboard
2. Copy the following values:
   - **Project URL** - The URL of your Supabase project
   - **anon public** - Public API key for client-side authentication
   - **service_role** - Admin API key for server-side operations

### Step 2: Store API Keys Securely

Add these keys to:

1. GitHub Secrets for CI/CD:
   - `SUPABASE_URL`
   - `SUPABASE_KEY` (service_role key)
   - `SUPABASE_ANON_KEY` (anon public key)

2. Vercel Environment Variables:
   - For Admin Panel (Next.js):
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   
   - For Client App (Gatsby):
     - `GATSBY_SUPABASE_URL`
     - `GATSBY_SUPABASE_ANON_KEY`

3. Kubernetes Secrets:
   ```bash
   kubectl create secret generic kai-secrets -n kai \
     --from-literal=supabase-url="https://your-project.supabase.co" \
     --from-literal=supabase-key="your-service-role-key"
   ```

### Step 3: Configure API Security Settings

1. Navigate to **Settings** → **API** → **API Settings**
2. Configure JWT expiry time (default is 3600 seconds)
3. Enable **JWT autorefresh**

## Monitoring and Maintenance

### Database Maintenance

1. **Regular Backups**:
   - Supabase automatically creates daily backups
   - For additional safety, periodically export your data:
     - Navigate to **Database** → **Backups**
     - Click **Create a backup**

2. **Performance Monitoring**:
   - Navigate to **Database** → **Performance**
   - Monitor query performance and optimize slow queries

### Storage Maintenance

1. Set up a cleanup function to remove expired temporary files:

```sql
-- Create a function to clean up expired temp files
CREATE OR REPLACE FUNCTION cleanup_expired_temp_files()
RETURNS void AS $$
DECLARE
  file_record RECORD;
  now_timestamp TIMESTAMP := NOW();
BEGIN
  FOR file_record IN
    SELECT *
    FROM storage.objects
    WHERE
      bucket_id = 'temp-uploads' AND
      created_at < (now_timestamp - INTERVAL '1 day')
  LOOP
    PERFORM storage.delete_object(file_record.bucket_id, file_record.name);
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a cron job to run this function daily
SELECT cron.schedule(
  'cleanup-temp-files',
  '0 0 * * *',  -- Run at midnight every day
  'SELECT cleanup_expired_temp_files();'
);
```

### System Monitoring

1. **Set up Alerts**:
   - Navigate to **Database** → **Database Settings** → **Pooler Settings**
   - Configure connection pool size based on your application needs
   - Set up email notifications for quota usage

2. **Usage Monitoring**:
   - Navigate to **Reports**
   - Monitor API usage, storage consumption, and database performance

## Conclusion

This guide has walked you through setting up Supabase for the Kai application. Your Supabase project is now configured with:

- Authentication and user management
- Database tables for the queue system and materials metadata
- Storage buckets with appropriate security policies
- Realtime features for live updates
- API keys and security settings

Remember to regularly monitor your Supabase project for performance issues, storage usage, and security concerns. As your application grows, you may need to adjust database indexes, connection pool settings, and security policies.