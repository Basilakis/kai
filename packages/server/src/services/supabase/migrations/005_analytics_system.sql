-- Migration: Analytics System
-- This migration sets up the tables and functions needed for the analytics tracking system

-- Create analytics_events table
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  resource_type TEXT,
  query TEXT,
  parameters JSONB,
  response_status INTEGER,
  response_time FLOAT,
  ip_address TEXT,
  user_agent TEXT,
  session_id TEXT
);

-- Add indexes for improved query performance
CREATE INDEX IF NOT EXISTS idx_analytics_events_timestamp ON analytics_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_resource_type ON analytics_events(resource_type);

-- Function to create the analytics_events table if it doesn't exist
-- This is called from the analytics service
CREATE OR REPLACE FUNCTION create_analytics_table()
RETURNS VOID AS $$
BEGIN
  -- Table creation is handled by the migration, but this function is kept
  -- to maintain API compatibility with the analytics service
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get analytics trends grouped by time period
CREATE OR REPLACE FUNCTION get_analytics_trends(
  p_timeframe TEXT,
  p_event_type TEXT DEFAULT NULL,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (date TEXT, count BIGINT) AS $$
DECLARE
  date_format TEXT;
BEGIN
  -- Set the date format based on the timeframe
  IF p_timeframe = 'day' THEN
    date_format := 'YYYY-MM-DD';
  ELSIF p_timeframe = 'week' THEN
    date_format := 'YYYY-"W"IW';
  ELSIF p_timeframe = 'month' THEN
    date_format := 'YYYY-MM';
  ELSE
    date_format := 'YYYY-MM-DD';
  END IF;

  RETURN QUERY
  SELECT
    TO_CHAR(timestamp, date_format) AS date,
    COUNT(*) AS count
  FROM
    analytics_events
  WHERE
    (p_event_type IS NULL OR event_type = p_event_type) AND
    (p_start_date IS NULL OR timestamp >= p_start_date) AND
    (p_end_date IS NULL OR timestamp <= p_end_date)
  GROUP BY
    date
  ORDER BY
    date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get analytics statistics
CREATE OR REPLACE FUNCTION get_analytics_stats(
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  total_count INTEGER;
  by_event_type JSON;
  by_resource_type JSON;
  top_queries JSON;
  top_materials JSON;
  avg_response_time JSON;
BEGIN
  -- Get total event count
  SELECT COUNT(*) INTO total_count
  FROM analytics_events
  WHERE
    (p_start_date IS NULL OR timestamp >= p_start_date) AND
    (p_end_date IS NULL OR timestamp <= p_end_date);

  -- Get counts by event type
  SELECT json_object_agg(event_type, count) INTO by_event_type
  FROM (
    SELECT
      event_type,
      COUNT(*) AS count
    FROM
      analytics_events
    WHERE
      (p_start_date IS NULL OR timestamp >= p_start_date) AND
      (p_end_date IS NULL OR timestamp <= p_end_date)
    GROUP BY
      event_type
  ) AS event_counts;

  -- Get counts by resource type
  SELECT json_object_agg(resource_type, count) INTO by_resource_type
  FROM (
    SELECT
      COALESCE(resource_type, 'unknown') AS resource_type,
      COUNT(*) AS count
    FROM
      analytics_events
    WHERE
      (p_start_date IS NULL OR timestamp >= p_start_date) AND
      (p_end_date IS NULL OR timestamp <= p_end_date)
    GROUP BY
      resource_type
  ) AS resource_counts;

  -- Get top search queries
  SELECT json_agg(row_to_json(q)) INTO top_queries
  FROM (
    SELECT
      query,
      COUNT(*) AS count
    FROM
      analytics_events
    WHERE
      event_type = 'search' AND
      query IS NOT NULL AND
      (p_start_date IS NULL OR timestamp >= p_start_date) AND
      (p_end_date IS NULL OR timestamp <= p_end_date)
    GROUP BY
      query
    ORDER BY
      count DESC
    LIMIT 10
  ) AS q;

  -- Get top materials viewed
  SELECT json_agg(row_to_json(m)) INTO top_materials
  FROM (
    SELECT
      (parameters->>'materialId') AS material_id,
      COUNT(*) AS count
    FROM
      analytics_events
    WHERE
      event_type = 'material_view' AND
      parameters ? 'materialId' AND
      (p_start_date IS NULL OR timestamp >= p_start_date) AND
      (p_end_date IS NULL OR timestamp <= p_end_date)
    GROUP BY
      parameters->>'materialId'
    ORDER BY
      count DESC
    LIMIT 10
  ) AS m;

  -- Get average response time by event type
  SELECT json_object_agg(event_type, avg_time) INTO avg_response_time
  FROM (
    SELECT
      event_type,
      AVG(response_time) AS avg_time
    FROM
      analytics_events
    WHERE
      response_time IS NOT NULL AND
      (p_start_date IS NULL OR timestamp >= p_start_date) AND
      (p_end_date IS NULL OR timestamp <= p_end_date)
    GROUP BY
      event_type
  ) AS response_times;

  -- Return all stats as JSON
  RETURN json_build_object(
    'total', total_count,
    'byEventType', COALESCE(by_event_type, '{}'::JSON),
    'byResourceType', COALESCE(by_resource_type, '{}'::JSON),
    'topQueries', COALESCE(top_queries, '[]'::JSON),
    'topMaterials', COALESCE(top_materials, '[]'::JSON),
    'averageResponseTime', COALESCE(avg_response_time, '{}'::JSON)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get top search queries
CREATE OR REPLACE FUNCTION get_top_search_queries(
  p_limit INTEGER DEFAULT 10,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSON AS $$
BEGIN
  RETURN (
    SELECT json_agg(row_to_json(q))
    FROM (
      SELECT
        query,
        COUNT(*) AS count
      FROM
        analytics_events
      WHERE
        event_type = 'search' AND
        query IS NOT NULL AND
        (p_start_date IS NULL OR timestamp >= p_start_date) AND
        (p_end_date IS NULL OR timestamp <= p_end_date)
      GROUP BY
        query
      ORDER BY
        count DESC
      LIMIT p_limit
    ) AS q
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get top agent prompts
CREATE OR REPLACE FUNCTION get_top_agent_prompts(
  p_limit INTEGER DEFAULT 10,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSON AS $$
BEGIN
  RETURN (
    SELECT json_agg(row_to_json(p))
    FROM (
      SELECT
        query AS prompt,
        COUNT(*) AS count
      FROM
        analytics_events
      WHERE
        event_type = 'agent_prompt' AND
        query IS NOT NULL AND
        (p_start_date IS NULL OR timestamp >= p_start_date) AND
        (p_end_date IS NULL OR timestamp <= p_end_date)
      GROUP BY
        query
      ORDER BY
        count DESC
      LIMIT p_limit
    ) AS p
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get top viewed materials
CREATE OR REPLACE FUNCTION get_top_materials(
  p_limit INTEGER DEFAULT 10,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSON AS $$
BEGIN
  RETURN (
    SELECT json_agg(row_to_json(m))
    FROM (
      SELECT
        (parameters->>'materialId') AS material_id,
        'Material ' || (parameters->>'materialId') AS name, -- In a real scenario, join with materials table
        COUNT(*) AS count
      FROM
        analytics_events
      WHERE
        event_type = 'material_view' AND
        parameters ? 'materialId' AND
        (p_start_date IS NULL OR timestamp >= p_start_date) AND
        (p_end_date IS NULL OR timestamp <= p_end_date)
      GROUP BY
        parameters->>'materialId'
      ORDER BY
        count DESC
      LIMIT p_limit
    ) AS m
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add RLS policies to secure the analytics_events table
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Only authenticated users with admin role can access analytics events
CREATE POLICY analytics_admin_policy ON analytics_events
  USING (
    (SELECT role FROM auth.users WHERE id = auth.uid()) = 'admin'
  );