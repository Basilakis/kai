-- MongoDB to PostgreSQL Migration: Categories Schema
-- This migration creates an enhanced categories table that replaces the MongoDB category model
-- with optimized PostgreSQL schema design for hierarchical classification

-- -------------------------------------------------------
-- Enhanced Categories Table - Replaces MongoDB Category Model
-- -------------------------------------------------------
CREATE TABLE categories (
  -- Primary identification
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT UNIQUE, -- For MongoDB ID compatibility during migration
  
  -- Basic category information
  name TEXT NOT NULL,
  description TEXT,
  
  -- Hierarchical structure
  parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  path TEXT[] NOT NULL DEFAULT '{}', -- Materialized path for efficient hierarchy queries
  level INTEGER NOT NULL DEFAULT 0, -- Depth level in hierarchy (0 = root)
  
  -- URL and display
  slug TEXT UNIQUE NOT NULL, -- URL-friendly identifier
  display_name TEXT, -- Alternative display name if different from name
  
  -- Category classification
  category_type TEXT NOT NULL DEFAULT 'material' CHECK (category_type IN (
    'material', 'application', 'style', 'brand', 'collection', 'technical', 'custom'
  )),
  
  -- Display and ordering
  display_order INTEGER DEFAULT 0,
  icon TEXT, -- Icon identifier or URL
  color TEXT, -- Hex color code for UI theming
  
  -- Category metadata and properties
  metadata JSONB DEFAULT '{}',
  properties JSONB DEFAULT '{}', -- Category-specific properties
  
  -- Statistics (denormalized for performance)
  material_count INTEGER DEFAULT 0,
  child_count INTEGER DEFAULT 0,
  total_descendant_count INTEGER DEFAULT 0, -- Total materials in this category and all descendants
  
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
      coalesce(display_name, '') || ' ' ||
      coalesce(slug, '') || ' ' ||
      coalesce(category_type, '') || ' ' ||
      coalesce(array_to_string(path, ' '), '')
    )
  ) STORED
);

-- -------------------------------------------------------
-- Category Materials Junction Table - Many-to-Many with Classification Metadata
-- -------------------------------------------------------
CREATE TABLE category_materials (
  -- Primary relationship
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  
  -- Classification metadata
  classification_type TEXT DEFAULT 'primary' CHECK (classification_type IN (
    'primary', 'secondary', 'suggested', 'related', 'alternative'
  )),
  confidence_score FLOAT DEFAULT 1.0 CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
  
  -- Additional metadata for the relationship
  metadata JSONB DEFAULT '{}',
  notes TEXT,
  
  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Composite primary key
  PRIMARY KEY (category_id, material_id, classification_type)
);

-- -------------------------------------------------------
-- Category Attributes Table - For Dynamic Category Properties
-- -------------------------------------------------------
CREATE TABLE category_attributes (
  -- Primary identification
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  
  -- Attribute definition
  attribute_name TEXT NOT NULL,
  attribute_type TEXT NOT NULL CHECK (attribute_type IN (
    'text', 'number', 'boolean', 'select', 'multi_select', 'range', 'date', 'color'
  )),
  
  -- Attribute configuration
  is_required BOOLEAN DEFAULT false,
  is_filterable BOOLEAN DEFAULT true,
  is_searchable BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  
  -- Validation and options
  validation_rules JSONB DEFAULT '{}', -- JSON schema for validation
  options JSONB DEFAULT '{}', -- Available options for select types
  default_value JSONB,
  
  -- Display configuration
  label TEXT NOT NULL,
  description TEXT,
  placeholder TEXT,
  help_text TEXT,
  
  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Unique constraint
  UNIQUE (category_id, attribute_name)
);

-- -------------------------------------------------------
-- Indexes for Performance
-- -------------------------------------------------------

-- Categories table indexes
CREATE INDEX categories_search_text_idx ON categories USING GIN (search_text);
CREATE INDEX categories_parent_id_idx ON categories (parent_id);
CREATE INDEX categories_path_idx ON categories USING GIN (path);
CREATE INDEX categories_slug_idx ON categories (slug);
CREATE INDEX categories_level_idx ON categories (level);
CREATE INDEX categories_category_type_idx ON categories (category_type);
CREATE INDEX categories_is_active_idx ON categories (is_active);
CREATE INDEX categories_is_public_idx ON categories (is_public);
CREATE INDEX categories_is_featured_idx ON categories (is_featured);
CREATE INDEX categories_visibility_idx ON categories (visibility);
CREATE INDEX categories_created_at_idx ON categories (created_at);
CREATE INDEX categories_updated_at_idx ON categories (updated_at);
CREATE INDEX categories_display_order_idx ON categories (display_order);

-- Composite indexes for common queries
CREATE INDEX categories_active_public_idx ON categories (is_active, is_public) WHERE is_active = true AND is_public = true;
CREATE INDEX categories_type_level_idx ON categories (category_type, level);
CREATE INDEX categories_featured_active_idx ON categories (is_featured, is_active) WHERE is_featured = true AND is_active = true;
CREATE INDEX categories_parent_level_idx ON categories (parent_id, level);

-- Category materials junction table indexes
CREATE INDEX category_materials_material_id_idx ON category_materials (material_id);
CREATE INDEX category_materials_classification_type_idx ON category_materials (classification_type);
CREATE INDEX category_materials_confidence_score_idx ON category_materials (confidence_score);
CREATE INDEX category_materials_created_at_idx ON category_materials (created_at);

-- Category attributes indexes
CREATE INDEX category_attributes_category_id_idx ON category_attributes (category_id);
CREATE INDEX category_attributes_attribute_name_idx ON category_attributes (attribute_name);
CREATE INDEX category_attributes_attribute_type_idx ON category_attributes (attribute_type);
CREATE INDEX category_attributes_is_filterable_idx ON category_attributes (is_filterable) WHERE is_filterable = true;
CREATE INDEX category_attributes_display_order_idx ON category_attributes (category_id, display_order);

-- -------------------------------------------------------
-- Row Level Security (RLS)
-- -------------------------------------------------------
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_attributes ENABLE ROW LEVEL SECURITY;

-- Categories policies
CREATE POLICY "Public categories are viewable" 
  ON categories FOR SELECT 
  USING (is_active = true AND (is_public = true OR visibility = 'public'));

CREATE POLICY "Authenticated users can insert categories" 
  ON categories FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update own categories" 
  ON categories FOR UPDATE 
  USING (auth.uid() = created_by OR auth.uid() = last_modified_by);

-- Category materials policies
CREATE POLICY "Public category materials are viewable" 
  ON category_materials FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM categories c 
    WHERE c.id = category_id 
    AND c.is_active = true 
    AND (c.is_public = true OR c.visibility = 'public')
  ));

CREATE POLICY "Authenticated users can manage category materials" 
  ON category_materials FOR ALL 
  USING (auth.role() = 'authenticated');

-- Category attributes policies
CREATE POLICY "Public category attributes are viewable" 
  ON category_attributes FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM categories c 
    WHERE c.id = category_id 
    AND c.is_active = true 
    AND (c.is_public = true OR c.visibility = 'public')
  ));

CREATE POLICY "Authenticated users can manage category attributes" 
  ON category_attributes FOR ALL 
  USING (auth.role() = 'authenticated');

-- -------------------------------------------------------
-- Triggers and Functions
-- -------------------------------------------------------

-- Update timestamp trigger for categories
CREATE OR REPLACE FUNCTION update_categories_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  IF NEW.last_modified_by IS NULL THEN
    NEW.last_modified_by = auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER categories_update_timestamp
  BEFORE UPDATE ON categories
  FOR EACH ROW
  EXECUTE FUNCTION update_categories_timestamp();

-- Update timestamp trigger for category_materials
CREATE OR REPLACE FUNCTION update_category_materials_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER category_materials_update_timestamp
  BEFORE UPDATE ON category_materials
  FOR EACH ROW
  EXECUTE FUNCTION update_category_materials_timestamp();

-- Update timestamp trigger for category_attributes
CREATE OR REPLACE FUNCTION update_category_attributes_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER category_attributes_update_timestamp
  BEFORE UPDATE ON category_attributes
  FOR EACH ROW
  EXECUTE FUNCTION update_category_attributes_timestamp();

-- Function to maintain category hierarchy path and level
CREATE OR REPLACE FUNCTION maintain_category_hierarchy()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    -- Update path and level based on parent_id
    IF NEW.parent_id IS NOT NULL THEN
      -- Get the path from the parent
      SELECT 
        COALESCE(c.path, '{}') || c.slug,
        COALESCE(c.level, 0) + 1
      INTO NEW.path, NEW.level
      FROM categories c
      WHERE c.id = NEW.parent_id;
    ELSE
      -- Root level category
      NEW.path = ARRAY[NEW.slug];
      NEW.level = 0;
    END IF;
    
    -- Generate slug if not provided
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
      NEW.slug = lower(regexp_replace(NEW.name, '[^a-zA-Z0-9]+', '-', 'g'));
      -- Ensure uniqueness by appending a number if needed
      WHILE EXISTS (SELECT 1 FROM categories WHERE slug = NEW.slug AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)) LOOP
        NEW.slug = NEW.slug || '-' || extract(epoch from now())::integer;
      END LOOP;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER categories_hierarchy_trigger
  BEFORE INSERT OR UPDATE ON categories
  FOR EACH ROW
  EXECUTE FUNCTION maintain_category_hierarchy();

-- Function to update category statistics
CREATE OR REPLACE FUNCTION update_category_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Update material count for the affected category
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE categories 
    SET material_count = (
      SELECT COUNT(*) 
      FROM category_materials cm 
      WHERE cm.category_id = NEW.category_id 
      AND cm.classification_type = 'primary'
    )
    WHERE id = NEW.category_id;
  END IF;
  
  IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
    UPDATE categories 
    SET material_count = (
      SELECT COUNT(*) 
      FROM category_materials cm 
      WHERE cm.category_id = OLD.category_id 
      AND cm.classification_type = 'primary'
    )
    WHERE id = OLD.category_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER category_materials_stats_trigger
  AFTER INSERT OR UPDATE OR DELETE ON category_materials
  FOR EACH ROW
  EXECUTE FUNCTION update_category_stats();

-- Function to update child count when categories are added/removed
CREATE OR REPLACE FUNCTION update_category_child_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Update child count for parent categories
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW.parent_id IS NOT NULL THEN
      UPDATE categories 
      SET child_count = (
        SELECT COUNT(*) 
        FROM categories c 
        WHERE c.parent_id = NEW.parent_id 
        AND c.is_active = true
      )
      WHERE id = NEW.parent_id;
    END IF;
  END IF;
  
  IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
    IF OLD.parent_id IS NOT NULL THEN
      UPDATE categories 
      SET child_count = (
        SELECT COUNT(*) 
        FROM categories c 
        WHERE c.parent_id = OLD.parent_id 
        AND c.is_active = true
      )
      WHERE id = OLD.parent_id;
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER categories_child_count_trigger
  AFTER INSERT OR UPDATE OR DELETE ON categories
  FOR EACH ROW
  EXECUTE FUNCTION update_category_child_count();

-- -------------------------------------------------------
-- Helper Functions
-- -------------------------------------------------------

-- Function to get category tree (children)
CREATE OR REPLACE FUNCTION get_category_children(
  parent_category_id UUID,
  max_depth INTEGER DEFAULT NULL,
  include_inactive BOOLEAN DEFAULT false
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  slug TEXT,
  category_type TEXT,
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
  WITH RECURSIVE category_tree AS (
    -- Base case: direct children
    SELECT 
      c.id,
      c.name,
      c.description,
      c.slug,
      c.category_type,
      c.level,
      c.path,
      c.material_count,
      c.child_count,
      c.is_active,
      1 as depth
    FROM categories c
    WHERE c.parent_id = parent_category_id
    AND (include_inactive OR c.is_active = true)
    
    UNION ALL
    
    -- Recursive case: children of children
    SELECT 
      c.id,
      c.name,
      c.description,
      c.slug,
      c.category_type,
      c.level,
      c.path,
      c.material_count,
      c.child_count,
      c.is_active,
      ct.depth + 1
    FROM categories c
    INNER JOIN category_tree ct ON c.parent_id = ct.id
    WHERE (max_depth IS NULL OR ct.depth < max_depth)
    AND (include_inactive OR c.is_active = true)
  )
  SELECT 
    ct.id,
    ct.name,
    ct.description,
    ct.slug,
    ct.category_type,
    ct.level,
    ct.path,
    ct.material_count,
    ct.child_count,
    ct.is_active
  FROM category_tree ct
  ORDER BY ct.level, ct.display_order, ct.name;
END;
$$;

-- Function to get category ancestors (parents)
CREATE OR REPLACE FUNCTION get_category_ancestors(
  child_category_id UUID
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  level INTEGER,
  path TEXT[]
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE category_ancestors AS (
    -- Base case: direct parent
    SELECT 
      c.id,
      c.name,
      c.slug,
      c.level,
      c.path,
      1 as depth
    FROM categories c
    INNER JOIN categories child ON child.id = child_category_id
    WHERE c.id = child.parent_id
    
    UNION ALL
    
    -- Recursive case: parents of parents
    SELECT 
      c.id,
      c.name,
      c.slug,
      c.level,
      c.path,
      ca.depth + 1
    FROM categories c
    INNER JOIN category_ancestors ca ON c.id = (
      SELECT parent_id FROM categories WHERE id = ca.id
    )
  )
  SELECT 
    ca.id,
    ca.name,
    ca.slug,
    ca.level,
    ca.path
  FROM category_ancestors ca
  ORDER BY ca.level;
END;
$$;

-- Function to search categories with hierarchy
CREATE OR REPLACE FUNCTION search_categories(
  search_query TEXT DEFAULT NULL,
  category_types TEXT[] DEFAULT NULL,
  parent_id UUID DEFAULT NULL,
  include_children BOOLEAN DEFAULT false,
  limit_count INTEGER DEFAULT 50,
  offset_count INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  slug TEXT,
  category_type TEXT,
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
    c.slug,
    c.category_type,
    c.level,
    c.path,
    c.material_count,
    c.child_count,
    c.is_featured,
    CASE 
      WHEN search_query IS NOT NULL THEN ts_rank(c.search_text, plainto_tsquery('english', search_query))
      ELSE 1.0
    END as rank
  FROM categories c
  WHERE 
    c.is_active = true
    AND (search_query IS NULL OR c.search_text @@ plainto_tsquery('english', search_query))
    AND (category_types IS NULL OR c.category_type = ANY(category_types))
    AND (parent_id IS NULL OR (
      CASE 
        WHEN include_children THEN c.parent_id = parent_id OR c.id IN (
          SELECT child_id FROM get_category_children(parent_id)
        )
        ELSE c.parent_id = parent_id
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

-- Function to get category with materials
CREATE OR REPLACE FUNCTION get_category_with_materials(
  category_uuid UUID,
  classification_types TEXT[] DEFAULT ARRAY['primary'],
  limit_count INTEGER DEFAULT 100,
  offset_count INTEGER DEFAULT 0
)
RETURNS TABLE (
  category_id UUID,
  category_name TEXT,
  category_slug TEXT,
  material_id UUID,
  material_name TEXT,
  material_type TEXT,
  material_manufacturer TEXT,
  classification_type TEXT,
  confidence_score FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id as category_id,
    c.name as category_name,
    c.slug as category_slug,
    m.id as material_id,
    m.name as material_name,
    m.material_type,
    m.manufacturer as material_manufacturer,
    cm.classification_type,
    cm.confidence_score
  FROM categories c
  LEFT JOIN category_materials cm ON c.id = cm.category_id
  LEFT JOIN materials m ON cm.material_id = m.id
  WHERE 
    c.id = category_uuid
    AND c.is_active = true
    AND (m.id IS NULL OR m.is_active = true)
    AND (classification_types IS NULL OR cm.classification_type = ANY(classification_types))
  ORDER BY 
    cm.confidence_score DESC,
    m.name ASC
  LIMIT limit_count
  OFFSET offset_count;
END;
$$;

-- Function to get category breadcrumb
CREATE OR REPLACE FUNCTION get_category_breadcrumb(
  category_uuid UUID
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  level INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE breadcrumb AS (
    -- Start with the target category
    SELECT 
      c.id,
      c.name,
      c.slug,
      c.level,
      c.parent_id
    FROM categories c
    WHERE c.id = category_uuid
    
    UNION ALL
    
    -- Recursively get parents
    SELECT 
      c.id,
      c.name,
      c.slug,
      c.level,
      c.parent_id
    FROM categories c
    INNER JOIN breadcrumb b ON c.id = b.parent_id
  )
  SELECT 
    b.id,
    b.name,
    b.slug,
    b.level
  FROM breadcrumb b
  ORDER BY b.level ASC;
END;
$$;

-- Comments for documentation
COMMENT ON TABLE categories IS 'Enhanced categories table with hierarchical structure for material classification';
COMMENT ON COLUMN categories.path IS 'Materialized path using slugs for efficient hierarchy queries';
COMMENT ON COLUMN categories.level IS 'Depth level in hierarchy (0 = root)';
COMMENT ON COLUMN categories.slug IS 'URL-friendly identifier, auto-generated from name if not provided';
COMMENT ON TABLE category_materials IS 'Many-to-many relationship between categories and materials with classification metadata';
COMMENT ON TABLE category_attributes IS 'Dynamic attributes for categories to support flexible classification schemas';