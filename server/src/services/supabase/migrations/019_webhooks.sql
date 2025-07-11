-- Migration: 019_webhooks.sql
-- Description: Creates tables and functions for webhooks

-- Create webhook configurations table
CREATE TABLE IF NOT EXISTS public.webhook_configurations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  secret TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create webhook delivery logs table
CREATE TABLE IF NOT EXISTS public.webhook_delivery_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  webhook_id UUID NOT NULL REFERENCES public.webhook_configurations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL, -- 'success', 'error'
  status_code INTEGER,
  response_body TEXT,
  error_message TEXT,
  duration INTEGER, -- in milliseconds
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_webhook_configurations_user_id ON public.webhook_configurations(user_id);
CREATE INDEX IF NOT EXISTS idx_webhook_configurations_is_active ON public.webhook_configurations(is_active);

CREATE INDEX IF NOT EXISTS idx_webhook_delivery_logs_webhook_id ON public.webhook_delivery_logs(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_delivery_logs_event_type ON public.webhook_delivery_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_delivery_logs_status ON public.webhook_delivery_logs(status);
CREATE INDEX IF NOT EXISTS idx_webhook_delivery_logs_created_at ON public.webhook_delivery_logs(created_at);

-- Create RLS policies
ALTER TABLE public.webhook_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_delivery_logs ENABLE ROW LEVEL SECURITY;

-- User can only see and manage their own webhook configurations
CREATE POLICY webhook_configurations_select_policy ON public.webhook_configurations
  FOR SELECT USING (auth.uid() = user_id);
  
CREATE POLICY webhook_configurations_insert_policy ON public.webhook_configurations
  FOR INSERT WITH CHECK (auth.uid() = user_id);
  
CREATE POLICY webhook_configurations_update_policy ON public.webhook_configurations
  FOR UPDATE USING (auth.uid() = user_id);
  
CREATE POLICY webhook_configurations_delete_policy ON public.webhook_configurations
  FOR DELETE USING (auth.uid() = user_id);

-- User can only see their own webhook delivery logs
CREATE POLICY webhook_delivery_logs_select_policy ON public.webhook_delivery_logs
  FOR SELECT USING (
    webhook_id IN (
      SELECT id FROM public.webhook_configurations WHERE user_id = auth.uid()
    )
  );

-- Create function to update the updated_at column
CREATE OR REPLACE FUNCTION public.update_webhook_configurations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update the updated_at column
DROP TRIGGER IF EXISTS update_webhook_configurations_updated_at ON public.webhook_configurations;
CREATE TRIGGER update_webhook_configurations_updated_at
BEFORE UPDATE ON public.webhook_configurations
FOR EACH ROW
EXECUTE FUNCTION public.update_webhook_configurations_updated_at();

-- Create functions for webhook stats
CREATE OR REPLACE FUNCTION public.get_webhook_delivery_count(where_clause TEXT)
RETURNS TABLE (
  total_count BIGINT,
  success_count BIGINT,
  error_count BIGINT
) AS $$
BEGIN
  RETURN QUERY EXECUTE '
    SELECT
      COUNT(*) AS total_count,
      COUNT(*) FILTER (WHERE status = ''success'') AS success_count,
      COUNT(*) FILTER (WHERE status = ''error'') AS error_count
    FROM public.webhook_delivery_logs
    ' || where_clause;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.get_webhook_delivery_count_by_status(where_clause TEXT)
RETURNS TABLE (
  status TEXT,
  count BIGINT
) AS $$
BEGIN
  RETURN QUERY EXECUTE '
    SELECT
      status,
      COUNT(*) AS count
    FROM public.webhook_delivery_logs
    ' || where_clause || '
    GROUP BY status
    ORDER BY count DESC';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.get_webhook_delivery_count_by_day(where_clause TEXT)
RETURNS TABLE (
  day DATE,
  total_count BIGINT,
  success_count BIGINT,
  error_count BIGINT
) AS $$
BEGIN
  RETURN QUERY EXECUTE '
    SELECT
      DATE(created_at) AS day,
      COUNT(*) AS total_count,
      COUNT(*) FILTER (WHERE status = ''success'') AS success_count,
      COUNT(*) FILTER (WHERE status = ''error'') AS error_count
    FROM public.webhook_delivery_logs
    ' || where_clause || '
    GROUP BY day
    ORDER BY day';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.get_top_users_by_webhook_count(limit_count INTEGER, where_clause TEXT)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  display_name TEXT,
  webhook_count BIGINT,
  delivery_count BIGINT,
  success_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY EXECUTE '
    SELECT
      wc.user_id,
      p.email,
      p.display_name,
      COUNT(DISTINCT wc.id) AS webhook_count,
      COUNT(wdl.id) AS delivery_count,
      CASE
        WHEN COUNT(wdl.id) > 0 THEN
          ROUND((COUNT(*) FILTER (WHERE wdl.status = ''success'')::NUMERIC / COUNT(wdl.id)) * 100, 2)
        ELSE 0
      END AS success_rate
    FROM public.webhook_configurations wc
    JOIN public.profiles p ON wc.user_id = p.id
    LEFT JOIN public.webhook_delivery_logs wdl ON wc.id = wdl.webhook_id
    ' || where_clause || '
    GROUP BY wc.user_id, p.email, p.display_name
    ORDER BY webhook_count DESC, delivery_count DESC
    LIMIT ' || limit_count;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON TABLE public.webhook_configurations IS 'Stores webhook configurations for users';
COMMENT ON TABLE public.webhook_delivery_logs IS 'Logs of webhook delivery attempts';
COMMENT ON FUNCTION public.update_webhook_configurations_updated_at IS 'Function to automatically update the updated_at column for webhook configurations';
COMMENT ON FUNCTION public.get_webhook_delivery_count IS 'Function to get webhook delivery counts';
COMMENT ON FUNCTION public.get_webhook_delivery_count_by_status IS 'Function to get webhook delivery counts by status';
COMMENT ON FUNCTION public.get_webhook_delivery_count_by_day IS 'Function to get webhook delivery counts by day';
COMMENT ON FUNCTION public.get_top_users_by_webhook_count IS 'Function to get top users by webhook count';

-- Add this migration to the migrations table
INSERT INTO public.migrations (name, applied_at)
VALUES ('019_webhooks.sql', NOW())
ON CONFLICT (name) DO NOTHING;
