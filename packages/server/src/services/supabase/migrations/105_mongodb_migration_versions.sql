-- Migration: MongoDB to PostgreSQL - Versions Table
-- Description: Creates the versions table for tracking entity changes and version history
-- This replaces the MongoDB Version collection with a PostgreSQL implementation

-- Create versions table
CREATE TABLE IF NOT EXISTS versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id TEXT NOT NULL,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('material', 'collection', 'category', 'metadataField')),
    version_number INTEGER NOT NULL CHECK (version_number > 0),
    change_type TEXT NOT NULL CHECK (change_type IN ('create', 'update', 'delete')),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id TEXT NOT NULL,
    description TEXT,
    data JSONB NOT NULL,
    changes JSONB,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_versions_entity_id ON versions(entity_id);
CREATE INDEX IF NOT EXISTS idx_versions_entity_type ON versions(entity_type);
CREATE INDEX IF NOT EXISTS idx_versions_entity_id_type ON versions(entity_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_versions_entity_version ON versions(entity_id, version_number);
CREATE INDEX IF NOT EXISTS idx_versions_timestamp ON versions(timestamp);
CREATE INDEX IF NOT EXISTS idx_versions_user_id ON versions(user_id);
CREATE INDEX IF NOT EXISTS idx_versions_metadata_batch_id ON versions((metadata->>'batchId')) WHERE metadata->>'batchId' IS NOT NULL;

-- Compound index for efficient version history retrieval
CREATE INDEX IF NOT EXISTS idx_versions_entity_history ON versions(entity_id, entity_type, version_number DESC);

-- Create unique constraint for entity + version number combination
CREATE UNIQUE INDEX IF NOT EXISTS idx_versions_entity_version_unique ON versions(entity_id, entity_type, version_number);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_versions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS trigger_versions_updated_at ON versions;
CREATE TRIGGER trigger_versions_updated_at
    BEFORE UPDATE ON versions
    FOR EACH ROW
    EXECUTE FUNCTION update_versions_updated_at();

-- Function to get next version number for an entity
CREATE OR REPLACE FUNCTION get_next_version_number(p_entity_id TEXT, p_entity_type TEXT)
RETURNS INTEGER AS $$
DECLARE
    next_version INTEGER;
BEGIN
    SELECT COALESCE(MAX(version_number), 0) + 1
    INTO next_version
    FROM versions
    WHERE entity_id = p_entity_id AND entity_type = p_entity_type;
    
    RETURN next_version;
END;
$$ LANGUAGE plpgsql;

-- Function to create a new version with automatic version numbering
CREATE OR REPLACE FUNCTION create_version(
    p_entity_id TEXT,
    p_entity_type TEXT,
    p_change_type TEXT,
    p_user_id TEXT,
    p_data JSONB,
    p_description TEXT DEFAULT NULL,
    p_changes JSONB DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    new_version_id UUID;
    next_version INTEGER;
BEGIN
    -- Get next version number
    next_version := get_next_version_number(p_entity_id, p_entity_type);
    
    -- Insert new version
    INSERT INTO versions (
        entity_id,
        entity_type,
        version_number,
        change_type,
        user_id,
        data,
        description,
        changes,
        metadata
    ) VALUES (
        p_entity_id,
        p_entity_type,
        next_version,
        p_change_type,
        p_user_id,
        p_data,
        p_description,
        p_changes,
        p_metadata
    ) RETURNING id INTO new_version_id;
    
    RETURN new_version_id;
END;
$$ LANGUAGE plpgsql;

-- Function to compare two JSONB objects and return differences
CREATE OR REPLACE FUNCTION compare_jsonb_objects(obj_a JSONB, obj_b JSONB)
RETURNS JSONB AS $$
DECLARE
    differences JSONB := '[]'::JSONB;
    key TEXT;
    value_a JSONB;
    value_b JSONB;
BEGIN
    -- Compare keys in obj_a
    FOR key IN SELECT jsonb_object_keys(obj_a)
    LOOP
        value_a := obj_a -> key;
        value_b := obj_b -> key;
        
        IF value_b IS NULL THEN
            -- Key exists only in obj_a
            differences := differences || jsonb_build_object(
                'field', key,
                'valueA', value_a,
                'valueB', null
            );
        ELSIF value_a != value_b THEN
            -- Values are different
            differences := differences || jsonb_build_object(
                'field', key,
                'valueA', value_a,
                'valueB', value_b
            );
        END IF;
    END LOOP;
    
    -- Compare keys that exist only in obj_b
    FOR key IN SELECT jsonb_object_keys(obj_b) WHERE key NOT IN (SELECT jsonb_object_keys(obj_a))
    LOOP
        value_b := obj_b -> key;
        differences := differences || jsonb_build_object(
            'field', key,
            'valueA', null,
            'valueB', value_b
        );
    END LOOP;
    
    RETURN differences;
END;
$$ LANGUAGE plpgsql;

-- Function to track entity changes
CREATE OR REPLACE FUNCTION track_entity_change(
    p_entity_id TEXT,
    p_entity_type TEXT,
    p_change_type TEXT,
    p_user_id TEXT,
    p_data JSONB,
    p_description TEXT DEFAULT NULL,
    p_previous_data JSONB DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    calculated_changes JSONB := NULL;
    new_version_id UUID;
BEGIN
    -- Calculate changes for updates
    IF p_change_type = 'update' AND p_previous_data IS NOT NULL THEN
        calculated_changes := jsonb_build_array();
        
        -- Use the compare function to get differences
        SELECT jsonb_agg(
            jsonb_build_object(
                'field', diff->>'field',
                'oldValue', diff->'valueA',
                'newValue', diff->'valueB'
            )
        )
        INTO calculated_changes
        FROM jsonb_array_elements(compare_jsonb_objects(p_previous_data, p_data)) AS diff;
    END IF;
    
    -- Create the version
    new_version_id := create_version(
        p_entity_id,
        p_entity_type,
        p_change_type,
        p_user_id,
        p_data,
        p_description,
        calculated_changes,
        p_metadata
    );
    
    RETURN new_version_id;
END;
$$ LANGUAGE plpgsql;

-- Row Level Security (RLS)
ALTER TABLE versions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view versions for their entities" ON versions
    FOR SELECT USING (
        -- Allow if user owns the entity or has read access
        user_id = auth.uid()::TEXT OR
        -- Add additional access control logic here based on your requirements
        EXISTS (
            SELECT 1 FROM materials m 
            WHERE m.id = versions.entity_id 
            AND m.user_id = auth.uid()::TEXT
        ) OR
        EXISTS (
            SELECT 1 FROM collections c 
            WHERE c.id = versions.entity_id 
            AND c.user_id = auth.uid()::TEXT
        )
    );

CREATE POLICY "Users can create versions for their entities" ON versions
    FOR INSERT WITH CHECK (
        user_id = auth.uid()::TEXT AND
        (
            EXISTS (
                SELECT 1 FROM materials m 
                WHERE m.id = versions.entity_id 
                AND m.user_id = auth.uid()::TEXT
            ) OR
            EXISTS (
                SELECT 1 FROM collections c 
                WHERE c.id = versions.entity_id 
                AND c.user_id = auth.uid()::TEXT
            )
        )
    );

-- Grant permissions
GRANT SELECT, INSERT ON versions TO authenticated;
GRANT EXECUTE ON FUNCTION get_next_version_number(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_version(TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION compare_jsonb_objects(JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION track_entity_change(TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, JSONB, JSONB) TO authenticated;

-- Comments for documentation
COMMENT ON TABLE versions IS 'Tracks version history for knowledge base entities';
COMMENT ON COLUMN versions.entity_id IS 'ID of the versioned entity';
COMMENT ON COLUMN versions.entity_type IS 'Type of entity being versioned';
COMMENT ON COLUMN versions.version_number IS 'Sequential version number for the entity';
COMMENT ON COLUMN versions.change_type IS 'Type of change (create, update, delete)';
COMMENT ON COLUMN versions.data IS 'Complete snapshot of the entity at this version';
COMMENT ON COLUMN versions.changes IS 'Array of field changes for updates';
COMMENT ON COLUMN versions.metadata IS 'Additional metadata about the version';