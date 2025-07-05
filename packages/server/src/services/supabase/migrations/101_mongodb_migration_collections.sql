-- MongoDB to PostgreSQL Migration: Collections Schema
-- This migration creates an enhanced collections table that replaces the MongoDB collection model
-- with optimized PostgreSQL schema design for hierarchical data

-- Drop existing collections table if it exists (from initial schema)
DROP TABLE IF EXISTS collection_materials CASCADE;
DROP TABLE IF EXISTS collections CASCADE;

-- -------------------------------------------------------
-- Enhanced Collections Table - Replaces MongoDB Collection Model
-- -------------------------------------------------------
CREATE TABLE collections (
  -- Primary identification
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT UNIQUE, -- For MongoDB ID compatibility during migration
  
  -- Basic collection information
  name TEXT NOT NULL,
  description TEXT,
  
  -- Hierarchical structure with multiple parent support
  parent_ids UUID[] DEFAULT '{}', -- Array of parent collection IDs for multiple inheritance
  path TEXT[], -- Materialized path for efficient hierarchy queries
  level INTEGER DEFAULT 0, -- Depth level in hierarchy
  
  -- Collection type and organization
  collection_type TEXT NOT NULL DEFAULT 'standard' CHECK (collection_type IN (
    'standard', 'series', 'category', 'brand', 'project', 'custom'
  )),
  
  -- Display and ordering
  display_order INTEGER DEFAULT 0,
  slug TEXT UNIQUE, -- URL-friendly identifier
  
  -- Collection metadata
  metadata JSONB DEFAULT '{}',
  settings JSONB DEFAULT '{}', -- Collection-specific settings
  
  -- Statistics (denormalized for performance)
  material_count INTEGER DEFAULT 0,
  child_count INTEGER DEFAULT 0,
  total_descendant_count INTEGER DEFAULT 0, -- Total materials in this collection and all descendants
  
  -- Visibility and access control
  is_public BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'private', 'restricted')),
  
  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  last_modified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Full-text search
  search_text TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('english', 
      coalesce(name, '') || ' ' || 
      coalesce(description, '') || ' ' ||
      coalesce(slug, '') || ' ' ||
      coalesce(collection_type, '') || ' ' ||
      coalesce(array_to_string(path, ' '), '')
    )
  ) STORED
);

-- -------------------------------------------------------
-- Collection Materials Junction Table - Many-to-Many with Enhanced Metadata
-- -------------------------------------------------------
CREATE TABLE collection_materials (
  -- Primary relationship
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  
  -- Ordering and organization within collection
  position INTEGER DEFAULT 0,
  display_order INTEGER DEFAULT 0,
  
  -- Relationship metadata
  relationship_type TEXT DEFAULT 'contains' CHECK (relationship_type IN (
    'contains', 'featured', 'related', 'similar', 'alternative'
  )),
  
  -- Additional metadata for the relationship
  metadata JSONB DEFAULT '{}',
  notes TEXT,
  
  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Composite primary key
  PRIMARY KEY (collection_id, material_id, relationship_type)
);

-- -------------------------------------------------------
-- Collection Hierarchy Junction Table - For Multiple Parent Support
-- -------------------------------------------------------
CREATE TABLE collection_hierarchy (
  -- Parent-child relationship
  parent_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  child_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  
  -- Hierarchy metadata
  depth INTEGER NOT NULL DEFAULT 1, -- Direct child = 1, grandchild = 2, etc.
  path_segment TEXT, -- Name of this segment in the path
  
  -- Ordering within parent
  display_order INTEGER DEFAULT 0,
  
  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraints
  PRIMARY KEY (parent_id, child_id),
  CHECK (parent_id != child_id) -- Prevent self-reference
);

-- -------------------------------------------------------
-- Indexes for Performance
-- -------------------------------------------------------

-- Collections table indexes
CREATE INDEX collections_search_text_idx ON collections USING GIN (search_text);
CREATE INDEX collections_parent_ids_idx ON collections USING GIN (parent_ids);
CREATE INDEX collections_path_idx ON collections USING GIN (path);
CREATE INDEX collections_collection_type_idx ON collections (collection_type);
CREATE INDEX collections_slug_idx ON collections (slug);
CREATE INDEX collections_level_idx ON collections (level);
CREATE INDEX collections_is_active_idx ON collections (is_active);
CREATE INDEX collections_is_public_idx ON collections (is_public);
CREATE INDEX collections_is_featured_idx ON collections (is_featured);
CREATE INDEX collections_visibility_idx ON collections (visibility);
CREATE INDEX collections_created_at_idx ON collections (created_at);
CREATE INDEX collections_updated_at_idx ON collections (updated_at);
CREATE INDEX collections_display_order_idx ON collections (display_order);

-- Composite indexes for common queries
CREATE INDEX collections_active_public_idx ON collections (is_active, is_public) WHERE is_active = true AND is_public = true;
CREATE INDEX collections_type_level_idx ON collections (collection_type, level);
CREATE INDEX collections_featured_active_idx ON collections (is_featured, is_active) WHERE is_featured = true AND is_active = true;

-- Collection materials junction table indexes
CREATE INDEX collection_materials_material_id_idx ON collection_materials (material_id);
CREATE INDEX collection_materials_position_idx ON collection_materials (collection_id, position);
CREATE INDEX collection_materials_display_order_idx ON collection_materials (collection_id, display_order);
CREATE INDEX collection_materials_relationship_type_idx ON collection_materials (relationship_type);
CREATE INDEX collection_materials_created_at_idx ON collection_materials (created_at);

-- Collection hierarchy indexes
CREATE INDEX collection_hierarchy_child_id_idx ON collection_hierarchy (child_id);
CREATE INDEX collection_hierarchy_depth_idx ON collection_hierarchy (depth);
CREATE INDEX collection_hierarchy_display_order_idx ON collection_hierarchy (parent_id, display_order);

-- -------------------------------------------------------
-- Row Level Security (RLS)
-- -------------------------------------------------------
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_hierarchy ENABLE ROW LEVEL SECURITY;

-- Collections policies
CREATE POLICY "Public collections are viewable" 
  ON collections FOR SELECT 
  USING (is_active = true AND (is_public = true OR visibility = 'public'));

CREATE POLICY "Authenticated users can insert collections" 
  ON collections FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update own collections" 
  ON collections FOR UPDATE 
  USING (auth.uid() = created_by OR auth.uid() = last_modified_by);

-- Collection materials policies
CREATE POLICY "Public collection materials are viewable" 
  ON collection_materials FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM collections c 
    WHERE c.id = collection_id 
    AND c.is_active = true 
    AND (c.is_public = true OR c.visibility = 'public')
  ));

CREATE POLICY "Authenticated users can manage collection materials" 
  ON collection_materials FOR ALL 
  USING (auth.role() = 'authenticated');

-- Collection hierarchy policies
CREATE POLICY "Public collection hierarchy is viewable" 
  ON collection_hierarchy FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM collections c 
    WHERE c.id = parent_id 
    AND c.is_active = true 
    AND (c.is_public = true OR c.visibility = 'public')
  ));

CREATE POLICY "Authenticated users can manage collection hierarchy" 
  ON collection_hierarchy FOR ALL 
  USING (auth.role() = 'authenticated');

-- -------------------------------------------------------
-- Triggers and Functions
-- -------------------------------------------------------

-- Update timestamp trigger for collections
CREATE OR REPLACE FUNCTION update_collections_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  IF NEW.last_modified_by IS NULL THEN
    NEW.last_modified_by = auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER collections_update_timestamp
  BEFORE UPDATE ON collections
  FOR EACH ROW
  EXECUTE FUNCTION update_collections_timestamp();

-- Update timestamp trigger for collection_materials
CREATE OR REPLACE FUNCTION update_collection_materials_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER collection_materials_update_timestamp
  BEFORE UPDATE ON collection_materials
  FOR EACH ROW
  EXECUTE FUNCTION update_collection_materials_timestamp();

-- Function to update collection statistics
CREATE OR REPLACE FUNCTION update_collection_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Update material count for the affected collection
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE collections 
    SET material_count = (
      SELECT COUNT(*) 
      FROM collection_materials cm 
      WHERE cm.collection_id = NEW.collection_id 
      AND cm.relationship_type = 'contains'
    )
    WHERE id = NEW.collection_id;
  END IF;
  
  IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
    UPDATE collections 
    SET material_count = (
      SELECT COUNT(*) 
      FROM collection_materials cm 
      WHERE cm.collection_id = OLD.collection_id 
      AND cm.relationship_type = 'contains'
    )
    WHERE id = OLD.collection_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER collection_materials_stats_trigger
  AFTER INSERT OR UPDATE OR DELETE ON collection_materials
  FOR EACH ROW
  EXECUTE FUNCTION update_collection_stats();

-- Function to maintain hierarchy path and level
CREATE OR REPLACE FUNCTION maintain_collection_hierarchy()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    -- Update path and level based on parent_ids
    IF array_length(NEW.parent_ids, 1) > 0 THEN
      -- Get the path from the first parent (primary parent)
      SELECT 
        COALESCE(c.path, '{}') || c.name,
        COALESCE(c.level, 0) + 1
      INTO NEW.path, NEW.level
      FROM collections c
      WHERE c.id = NEW.parent_ids[1];
    ELSE
      -- Root level collection
      NEW.path = ARRAY[NEW.name];
      NEW.level = 0;
    END IF;
    
    -- Generate slug if not provided
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
      NEW.slug = lower(regexp_replace(NEW.name, '[^a-zA-Z0-9]+', '-', 'g'));
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER collections_hierarchy_trigger
  BEFORE INSERT OR UPDATE ON collections
  FOR EACH ROW
  EXECUTE FUNCTION maintain_collection_hierarchy();

-- -------------------------------------------------------
-- Helper Functions
-- -------------------------------------------------------

-- Function to get collection tree (children)
CREATE OR REPLACE FUNCTION get_collection_children(
  parent_collection_id UUID,
  max_depth INTEGER DEFAULT NULL,
  include_inactive BOOLEAN DEFAULT false
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  collection_type TEXT,
  level INTEGER,
  path TEXT[],
  material_count INTEGER,
  child_count INTEGER,
  is_active BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE collection_tree AS (
    -- Base case: direct children
    SELECT 
      c.id,
      c.name,
      c.description,
      c.collection_type,
      c.level,
      c.path,
      c.material_count,
      c.child_count,
      c.is_active,
      1 as depth
    FROM collections c
    WHERE parent_collection_id = ANY(c.parent_ids)
    AND (include_inactive OR c.is_active = true)
    
    UNION ALL
    
    -- Recursive case: children of children
    SELECT 
      c.id,
      c.name,
      c.description,
      c.collection_type,
      c.level,
      c.path,
      c.material_count,
      c.child_count,
      c.is_active,
      ct.depth + 1
    FROM collections c
    INNER JOIN collection_tree ct ON ct.id = ANY(c.parent_ids)
    WHERE (max_depth IS NULL OR ct.depth < max_depth)
    AND (include_inactive OR c.is_active = true)
  )
  SELECT 
    ct.id,
    ct.name,
    ct.description,
    ct.collection_type,
    ct.level,
    ct.path,
    ct.material_count,
    ct.child_count,
    ct.is_active
  FROM collection_tree ct
  ORDER BY ct.level, ct.name;
END;
$$;

-- Function to get collection ancestors (parents)
CREATE OR REPLACE FUNCTION get_collection_ancestors(
  child_collection_id UUID
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  level INTEGER,
  path TEXT[]
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE collection_ancestors AS (
    -- Base case: direct parents
    SELECT 
      c.id,
      c.name,
      c.level,
      c.path,
      1 as depth
    FROM collections c
    INNER JOIN collections child ON child.id = child_collection_id
    WHERE c.id = ANY(child.parent_ids)
    
    UNION ALL
    
    -- Recursive case: parents of parents
    SELECT 
      c.id,
      c.name,
      c.level,
      c.path,
      ca.depth + 1
    FROM collections c
    INNER JOIN collection_ancestors ca ON c.id = ANY(
      SELECT unnest(parent_ids) FROM collections WHERE id = ca.id
    )
  )
  SELECT 
    ca.id,
    ca.name,
    ca.level,
    ca.path
  FROM collection_ancestors ca
  ORDER BY ca.level;
END;
$$;

-- Function to search collections with hierarchy
CREATE OR REPLACE FUNCTION search_collections(
  search_query TEXT DEFAULT NULL,
  collection_types TEXT[] DEFAULT NULL,
  parent_id UUID DEFAULT NULL,
  include_children BOOLEAN DEFAULT false,
  limit_count INTEGER DEFAULT 50,
  offset_count INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  collection_type TEXT,
  level INTEGER,
  path TEXT[],
  material_count INTEGER,
  child_count INTEGER,
  is_featured BOOLEAN,
  rank REAL
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.description,
    c.collection_type,
    c.level,
    c.path,
    c.material_count,
    c.child_count,
    c.is_featured,
    CASE 
      WHEN search_query IS NOT NULL THEN ts_rank(c.search_text, plainto_tsquery('english', search_query))
      ELSE 1.0
    END as rank
  FROM collections c
  WHERE 
    c.is_active = true
    AND (search_query IS NULL OR c.search_text @@ plainto_tsquery('english', search_query))
    AND (collection_types IS NULL OR c.collection_type = ANY(collection_types))
    AND (parent_id IS NULL OR (
      CASE 
        WHEN include_children THEN parent_id = ANY(c.parent_ids) OR c.id IN (
          SELECT child_id FROM get_collection_children(parent_id)
        )
        ELSE parent_id = ANY(c.parent_ids)
      END
    ))
  ORDER BY 
    CASE WHEN search_query IS NOT NULL THEN rank END DESC,
    c.level ASC,
    c.display_order ASC,
    c.name ASC
  LIMIT limit_count
  OFFSET offset_count;
END;
$$;

-- Function to get collection with materials
CREATE OR REPLACE FUNCTION get_collection_with_materials(
  collection_uuid UUID,
  relationship_types TEXT[] DEFAULT ARRAY['contains'],
  limit_count INTEGER DEFAULT 100,
  offset_count INTEGER DEFAULT 0
)
RETURNS TABLE (
  collection_id UUID,
  collection_name TEXT,
  collection_description TEXT,
  material_id UUID,
  material_name TEXT,
  material_type TEXT,
  material_manufacturer TEXT,
  relationship_type TEXT,
  position INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id as collection_id,
    c.name as collection_name,
    c.description as collection_description,
    m.id as material_id,
    m.name as material_name,
    m.material_type,
    m.manufacturer as material_manufacturer,
    cm.relationship_type,
    cm.position
  FROM collections c
  LEFT JOIN collection_materials cm ON c.id = cm.collection_id
  LEFT JOIN materials m ON cm.material_id = m.id
  WHERE 
    c.id = collection_uuid
    AND c.is_active = true
    AND (m.id IS NULL OR m.is_active = true)
    AND (relationship_types IS NULL OR cm.relationship_type = ANY(relationship_types))
  ORDER BY 
    cm.display_order ASC,
    cm.position ASC,
    m.name ASC
  LIMIT limit_count
  OFFSET offset_count;
END;
$$;

-- Comments for documentation
COMMENT ON TABLE collections IS 'Enhanced collections table with hierarchical structure and multiple parent support';
COMMENT ON COLUMN collections.parent_ids IS 'Array of parent collection IDs for multiple inheritance support';
COMMENT ON COLUMN collections.path IS 'Materialized path for efficient hierarchy queries';
COMMENT ON COLUMN collections.level IS 'Depth level in hierarchy (0 = root)';
COMMENT ON TABLE collection_materials IS 'Many-to-many relationship between collections and materials with metadata';
COMMENT ON TABLE collection_hierarchy IS 'Explicit parent-child relationships for complex hierarchy management';