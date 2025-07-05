-- Migration: MongoDB to Supabase - Collection Memberships
-- This migration creates the collection_memberships table to replace MongoDB CollectionMembership model
-- Handles many-to-many relationships between materials and collections with additional metadata

-- Create collection_memberships table
CREATE TABLE IF NOT EXISTS collection_memberships (
    -- Primary identification
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Foreign key relationships
    material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
    collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    
    -- Membership properties
    primary_membership BOOLEAN DEFAULT FALSE,
    inherit_parent_properties BOOLEAN DEFAULT TRUE,
    position INTEGER DEFAULT 0,
    
    -- Hierarchy tracking
    path TEXT[] DEFAULT '{}', -- Array of collection IDs representing path from root
    nesting_level INTEGER DEFAULT 0,
    
    -- Metadata and tracking
    metadata JSONB DEFAULT '{}',
    added_by UUID REFERENCES auth.users(id),
    
    -- Timestamps
    added_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_collection_memberships_material_id ON collection_memberships(material_id);
CREATE INDEX IF NOT EXISTS idx_collection_memberships_collection_id ON collection_memberships(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_memberships_primary ON collection_memberships(material_id, primary_membership) WHERE primary_membership = TRUE;
CREATE INDEX IF NOT EXISTS idx_collection_memberships_position ON collection_memberships(collection_id, position);
CREATE INDEX IF NOT EXISTS idx_collection_memberships_path ON collection_memberships USING GIN(path);
CREATE INDEX IF NOT EXISTS idx_collection_memberships_nesting ON collection_memberships(nesting_level);
CREATE INDEX IF NOT EXISTS idx_collection_memberships_metadata ON collection_memberships USING GIN(metadata);

-- Create unique constraint to prevent duplicate memberships
CREATE UNIQUE INDEX IF NOT EXISTS idx_collection_memberships_unique 
ON collection_memberships(material_id, collection_id);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_collection_memberships_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_collection_memberships_updated_at
    BEFORE UPDATE ON collection_memberships
    FOR EACH ROW
    EXECUTE FUNCTION update_collection_memberships_updated_at();

-- Function to ensure only one primary membership per material
CREATE OR REPLACE FUNCTION ensure_single_primary_membership()
RETURNS TRIGGER AS $$
BEGIN
    -- If setting this membership as primary, unset all other primary memberships for this material
    IF NEW.primary_membership = TRUE THEN
        UPDATE collection_memberships 
        SET primary_membership = FALSE 
        WHERE material_id = NEW.material_id 
        AND id != NEW.id 
        AND primary_membership = TRUE;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ensure_single_primary_membership
    BEFORE INSERT OR UPDATE ON collection_memberships
    FOR EACH ROW
    EXECUTE FUNCTION ensure_single_primary_membership();

-- Function to automatically set primary membership if none exists
CREATE OR REPLACE FUNCTION auto_set_primary_membership()
RETURNS TRIGGER AS $$
DECLARE
    primary_count INTEGER;
BEGIN
    -- After delete, check if we need to promote another membership to primary
    IF TG_OP = 'DELETE' AND OLD.primary_membership = TRUE THEN
        -- Count remaining memberships for this material
        SELECT COUNT(*) INTO primary_count
        FROM collection_memberships 
        WHERE material_id = OLD.material_id;
        
        -- If there are remaining memberships but no primary, make the first one primary
        IF primary_count > 0 THEN
            UPDATE collection_memberships 
            SET primary_membership = TRUE 
            WHERE material_id = OLD.material_id 
            AND id = (
                SELECT id FROM collection_memberships 
                WHERE material_id = OLD.material_id 
                ORDER BY added_at ASC 
                LIMIT 1
            );
        END IF;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_set_primary_membership
    AFTER DELETE ON collection_memberships
    FOR EACH ROW
    EXECUTE FUNCTION auto_set_primary_membership();

-- Function to update membership path based on collection hierarchy
CREATE OR REPLACE FUNCTION update_membership_path()
RETURNS TRIGGER AS $$
DECLARE
    collection_path TEXT[];
    collection_level INTEGER;
BEGIN
    -- Get the collection's materialized path and level
    SELECT materialized_path, level INTO collection_path, collection_level
    FROM collections 
    WHERE id = NEW.collection_id;
    
    -- Update the membership's path and nesting level
    NEW.path = collection_path;
    NEW.nesting_level = collection_level;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_membership_path
    BEFORE INSERT OR UPDATE ON collection_memberships
    FOR EACH ROW
    WHEN (NEW.collection_id IS NOT NULL)
    EXECUTE FUNCTION update_membership_path();

-- Function to get materials in collection (including subcollections)
CREATE OR REPLACE FUNCTION get_materials_in_collection(
    p_collection_id UUID,
    p_include_subcollections BOOLEAN DEFAULT FALSE
)
RETURNS TABLE(material_id UUID) AS $$
BEGIN
    IF p_include_subcollections THEN
        -- Return materials from this collection and all subcollections
        RETURN QUERY
        SELECT cm.material_id
        FROM collection_memberships cm
        WHERE p_collection_id = ANY(cm.path)
        ORDER BY cm.position;
    ELSE
        -- Return materials only from this specific collection
        RETURN QUERY
        SELECT cm.material_id
        FROM collection_memberships cm
        WHERE cm.collection_id = p_collection_id
        ORDER BY cm.position;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to get collection hierarchy for a membership
CREATE OR REPLACE FUNCTION get_membership_hierarchy(p_membership_id UUID)
RETURNS TABLE(
    collection_id UUID,
    collection_name TEXT,
    level INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH membership_path AS (
        SELECT path FROM collection_memberships WHERE id = p_membership_id
    )
    SELECT 
        c.id,
        c.name,
        array_position((SELECT path FROM membership_path), c.id::TEXT) as level
    FROM collections c
    WHERE c.id::TEXT = ANY((SELECT path FROM membership_path))
    ORDER BY level;
END;
$$ LANGUAGE plpgsql;

-- Function to batch update membership positions
CREATE OR REPLACE FUNCTION update_membership_positions(
    p_collection_id UUID,
    p_material_positions JSONB -- Array of {material_id, position} objects
)
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER := 0;
    item JSONB;
BEGIN
    -- Update positions for each material in the collection
    FOR item IN SELECT * FROM jsonb_array_elements(p_material_positions)
    LOOP
        UPDATE collection_memberships 
        SET position = (item->>'position')::INTEGER,
            updated_at = NOW()
        WHERE collection_id = p_collection_id 
        AND material_id = (item->>'material_id')::UUID;
        
        GET DIAGNOSTICS updated_count = updated_count + ROW_COUNT;
    END LOOP;
    
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- RLS Policies
ALTER TABLE collection_memberships ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view memberships for materials/collections they have access to
CREATE POLICY "Users can view collection memberships" ON collection_memberships
    FOR SELECT USING (
        -- User can access if they can access the material
        EXISTS (
            SELECT 1 FROM materials m 
            WHERE m.id = material_id 
            AND (m.created_by = auth.uid() OR m.visibility = 'public')
        )
        OR
        -- User can access if they can access the collection
        EXISTS (
            SELECT 1 FROM collections c 
            WHERE c.id = collection_id 
            AND (c.created_by = auth.uid() OR c.visibility = 'public')
        )
    );

-- Policy: Users can create memberships for materials/collections they own
CREATE POLICY "Users can create collection memberships" ON collection_memberships
    FOR INSERT WITH CHECK (
        -- User must own the material
        EXISTS (
            SELECT 1 FROM materials m 
            WHERE m.id = material_id 
            AND m.created_by = auth.uid()
        )
        AND
        -- User must have access to the collection
        EXISTS (
            SELECT 1 FROM collections c 
            WHERE c.id = collection_id 
            AND (c.created_by = auth.uid() OR c.visibility = 'public')
        )
    );

-- Policy: Users can update memberships they created or for materials they own
CREATE POLICY "Users can update collection memberships" ON collection_memberships
    FOR UPDATE USING (
        added_by = auth.uid()
        OR
        EXISTS (
            SELECT 1 FROM materials m 
            WHERE m.id = material_id 
            AND m.created_by = auth.uid()
        )
    );

-- Policy: Users can delete memberships they created or for materials they own
CREATE POLICY "Users can delete collection memberships" ON collection_memberships
    FOR DELETE USING (
        added_by = auth.uid()
        OR
        EXISTS (
            SELECT 1 FROM materials m 
            WHERE m.id = material_id 
            AND m.created_by = auth.uid()
        )
    );

-- Create helpful views
CREATE OR REPLACE VIEW collection_membership_details AS
SELECT 
    cm.*,
    m.title as material_title,
    m.type as material_type,
    c.name as collection_name,
    c.type as collection_type,
    array_length(cm.path, 1) as hierarchy_depth
FROM collection_memberships cm
JOIN materials m ON m.id = cm.material_id
JOIN collections c ON c.id = cm.collection_id;

-- Comments for documentation
COMMENT ON TABLE collection_memberships IS 'Many-to-many relationship between materials and collections with additional metadata';
COMMENT ON COLUMN collection_memberships.primary_membership IS 'Whether this is the primary collection for the material';
COMMENT ON COLUMN collection_memberships.inherit_parent_properties IS 'Whether to inherit properties from parent collection';
COMMENT ON COLUMN collection_memberships.position IS 'Display position within the collection';
COMMENT ON COLUMN collection_memberships.path IS 'Array of collection IDs representing path from root to this collection';
COMMENT ON COLUMN collection_memberships.nesting_level IS 'Nesting level in the collection hierarchy';
COMMENT ON COLUMN collection_memberships.metadata IS 'Additional metadata for the membership relationship';