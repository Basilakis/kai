-- Migration: 005_message_broker.sql
-- Message Broker Tables and Infrastructure for Scalable Real-time Updates
-- This migration adds tables, indexes, and RPC functions for the enhanced
-- message broker system optimized for Supabase.

-- Message broker status table (for heartbeat checks)
CREATE TABLE IF NOT EXISTS message_broker_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'active',
  last_check TIMESTAMPTZ NOT NULL DEFAULT now(),
  version TEXT NOT NULL DEFAULT '1.0.0'
);

-- Insert a default status record if none exists
INSERT INTO message_broker_status (status, last_check, version)
SELECT 'active', now(), '1.0.0'
WHERE NOT EXISTS (SELECT 1 FROM message_broker_status);

-- Message persistence table
CREATE TABLE IF NOT EXISTS message_broker_messages (
  id UUID PRIMARY KEY,
  queue TEXT NOT NULL,
  type TEXT NOT NULL,
  data JSONB NOT NULL,
  source TEXT NOT NULL,
  timestamp BIGINT NOT NULL,
  priority SMALLINT NOT NULL DEFAULT 5,
  expires_at BIGINT,
  status TEXT NOT NULL,
  attempts SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Broadcasts table (for real-time notifications without persistence)
CREATE TABLE IF NOT EXISTS message_broker_broadcasts (
  id UUID PRIMARY KEY,
  payload JSONB NOT NULL,
  timestamp BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Message broker tracking table (for delivery metrics)
CREATE TABLE IF NOT EXISTS message_broker_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES message_broker_messages(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,  -- 'sent', 'delivered', 'acknowledged', 'failed'
  timestamp BIGINT NOT NULL,
  duration_ms INTEGER,  -- Time between events (e.g., sent-to-delivered)
  metadata JSONB
);

-- Create indexes for performance optimization

-- Index for searching by queue and type (common filter)
CREATE INDEX IF NOT EXISTS idx_messages_queue_type_status
ON message_broker_messages (queue, type, status);

-- Index for timestamp-based operations like cleanup
CREATE INDEX IF NOT EXISTS idx_messages_status_timestamp
ON message_broker_messages (status, timestamp);

-- Index for expiration-based operations
CREATE INDEX IF NOT EXISTS idx_messages_expires_at
ON message_broker_messages (expires_at)
WHERE expires_at IS NOT NULL;

-- Index for broadcasts by timestamp
CREATE INDEX IF NOT EXISTS idx_broadcasts_timestamp
ON message_broker_broadcasts (timestamp);

-- Index for metrics by message_id for fast lookup
CREATE INDEX IF NOT EXISTS idx_metrics_message_id
ON message_broker_metrics (message_id);

-- Row Level Security (RLS) Policies

-- Enable RLS on tables
ALTER TABLE message_broker_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_broker_broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_broker_metrics ENABLE ROW LEVEL SECURITY;

-- Create policies for message_broker_messages
CREATE POLICY "message_insert_policy"
ON message_broker_messages
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "message_read_policy"
ON message_broker_messages
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "message_update_policy"
ON message_broker_messages
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "message_delete_policy"
ON message_broker_messages
FOR DELETE
TO authenticated
USING (true);

-- Create policies for message_broker_broadcasts
CREATE POLICY "broadcast_insert_policy"
ON message_broker_broadcasts
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "broadcast_read_policy"
ON message_broker_broadcasts
FOR SELECT
TO authenticated
USING (true);

-- Create policies for message_broker_metrics
CREATE POLICY "metrics_insert_policy"
ON message_broker_metrics
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "metrics_read_policy"
ON message_broker_metrics
FOR SELECT
TO authenticated
USING (true);

-- Function to clean up old messages (much more efficient than client-side implementation)
CREATE OR REPLACE FUNCTION cleanup_message_broker(
  acknowledgment_cutoff_days INTEGER DEFAULT 1,
  expired_cutoff_timestamp BIGINT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  cutoff_timestamp BIGINT;
BEGIN
  -- Calculate cutoff timestamp for acknowledged messages
  cutoff_timestamp := (EXTRACT(EPOCH FROM (now() - INTERVAL '1 day' * acknowledgment_cutoff_days)) * 1000)::BIGINT;

  -- Delete old acknowledged messages
  DELETE FROM message_broker_messages
  WHERE status = 'acknowledged'
  AND timestamp < cutoff_timestamp;

  -- Update expired messages
  IF expired_cutoff_timestamp IS NULL THEN
    expired_cutoff_timestamp := (EXTRACT(EPOCH FROM now()) * 1000)::BIGINT;
  END IF;

  UPDATE message_broker_messages
  SET status = 'expired'
  WHERE expires_at < expired_cutoff_timestamp
  AND status != 'acknowledged';
END;
$$;

-- Function to get comprehensive message stats
CREATE OR REPLACE FUNCTION get_message_broker_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_count INTEGER;
  delivered_count INTEGER;
  pending_count INTEGER;
  failed_count INTEGER;
  processing_count INTEGER;
  acknowledged_count INTEGER;
  expired_count INTEGER;
  oldest_pending BIGINT;
  newest_pending BIGINT;
  avg_processing_time NUMERIC;
  result JSON;
BEGIN
  -- Count by status
  SELECT COUNT(*) INTO total_count FROM message_broker_messages;

  SELECT COUNT(*) INTO delivered_count
  FROM message_broker_messages WHERE status = 'delivered';

  SELECT COUNT(*) INTO pending_count
  FROM message_broker_messages WHERE status = 'pending';

  SELECT COUNT(*) INTO failed_count
  FROM message_broker_messages WHERE status = 'failed';

  SELECT COUNT(*) INTO processing_count
  FROM message_broker_messages WHERE status = 'processing';

  SELECT COUNT(*) INTO acknowledged_count
  FROM message_broker_messages WHERE status = 'acknowledged';

  SELECT COUNT(*) INTO expired_count
  FROM message_broker_messages WHERE status = 'expired';

  -- Get oldest and newest pending timestamps
  SELECT MIN(timestamp) INTO oldest_pending
  FROM message_broker_messages WHERE status = 'pending';

  SELECT MAX(timestamp) INTO newest_pending
  FROM message_broker_messages WHERE status = 'pending';

  -- Calculate average processing time (if metrics are being tracked)
  SELECT AVG(duration_ms) INTO avg_processing_time
  FROM message_broker_metrics
  WHERE event_type = 'acknowledged'
  AND duration_ms IS NOT NULL;

  -- Build result JSON
  result := json_build_object(
    'total', total_count,
    'delivered', delivered_count,
    'pending', pending_count,
    'failed', failed_count,
    'processing', processing_count,
    'acknowledged', acknowledged_count,
    'expired', expired_count,
    'oldest_pending', oldest_pending,
    'newest_pending', newest_pending,
    'avg_processing_time', avg_processing_time
  );

  RETURN result;
END;
$$;

-- Enable real-time for the tables (for use with Supabase Realtime)
ALTER PUBLICATION supabase_realtime ADD TABLE message_broker_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE message_broker_broadcasts;

-- Comments for documentation
COMMENT ON TABLE message_broker_messages IS 'Persistent storage for message broker messages';
COMMENT ON TABLE message_broker_broadcasts IS 'Transient broadcasts for real-time notifications';
COMMENT ON TABLE message_broker_metrics IS 'Performance and delivery metrics for the message broker';
COMMENT ON TABLE message_broker_status IS 'Status tracking for the message broker system';

COMMENT ON FUNCTION cleanup_message_broker IS 'Efficiently clean up old and expired messages in the message broker';
COMMENT ON FUNCTION get_message_broker_stats IS 'Get comprehensive statistics about message broker activity';