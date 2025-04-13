-- Migration: 007_agent_sessions.sql
-- Description: Creates the agent_sessions table for persistent agent session storage

-- Create agent_sessions table
CREATE TABLE IF NOT EXISTS agent_sessions (
    id UUID PRIMARY KEY,
    agent_type TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_activity TIMESTAMPTZ NOT NULL DEFAULT now(),
    messages JSONB NOT NULL DEFAULT '[]'::jsonb,
    metadata JSONB,
    
    -- Add constraints
    CONSTRAINT agent_sessions_agent_type_check CHECK (agent_type IN (
        'RECOGNITION',
        'MATERIAL_EXPERT', 
        'PROJECT_ASSISTANT', 
        'KNOWLEDGE_BASE', 
        'ANALYTICS', 
        'OPERATIONS'
    ))
);

-- Create index for faster user-specific queries
CREATE INDEX IF NOT EXISTS agent_sessions_user_id_idx ON agent_sessions(user_id);

-- Create index for filtering on last activity (for cleanup)
CREATE INDEX IF NOT EXISTS agent_sessions_last_activity_idx ON agent_sessions(last_activity);

-- Enable Row Level Security
ALTER TABLE agent_sessions ENABLE ROW LEVEL SECURITY;

-- Create policies for row-level security
-- Users can only view their own sessions
CREATE POLICY agent_sessions_select_policy ON agent_sessions
    FOR SELECT USING (auth.uid() = user_id);

-- Users can only insert their own sessions
CREATE POLICY agent_sessions_insert_policy ON agent_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can only update their own sessions
CREATE POLICY agent_sessions_update_policy ON agent_sessions
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can only delete their own sessions
CREATE POLICY agent_sessions_delete_policy ON agent_sessions
    FOR DELETE USING (auth.uid() = user_id);

-- Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON agent_sessions TO authenticated;

-- Add server-side function to clean up old sessions (for admin use)
CREATE OR REPLACE FUNCTION cleanup_old_agent_sessions(days_to_keep INTEGER) 
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM agent_sessions 
    WHERE last_activity < (NOW() - (days_to_keep || ' days')::INTERVAL)
    RETURNING COUNT(*) INTO deleted_count;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment to describe the migration
COMMENT ON TABLE agent_sessions IS 'Stores persistent agent chat sessions for users';