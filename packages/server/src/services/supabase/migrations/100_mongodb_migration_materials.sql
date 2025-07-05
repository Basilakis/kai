-- MongoDB to PostgreSQL Migration: Materials Schema
-- This migration creates an enhanced materials table that replaces the MongoDB material model
-- with optimized PostgreSQL schema design

-- Drop existing materials table if it exists (from initial schema)
DROP TABLE IF EXISTS vector_embeddings CASCADE;
DROP TABLE IF EXISTS collection_materials CASCADE;
DROP TABLE IF EXISTS materials CASCADE;

-- -------------------------------------------------------
-- Enhanced Materials Table - Replaces MongoDB Material Model
-- -------------------------------------------------------
CREATE TABLE materials (
  -- Primary identification
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT UNIQUE, -- For MongoDB ID compatibility during migration
  
  -- Basic material information
  name TEXT NOT NULL,
  description TEXT,
  manufacturer TEXT,
  
  -- Collection and series organization
  collection_id UUID, -- Will reference collections table
  series_id UUID,     -- Will reference collections table (for sub-collections)
  
  -- Physical properties with structured data
  dimensions JSONB NOT NULL DEFAULT '{}', -- {width, height, depth, unit}
  color JSONB NOT NULL DEFAULT '{}',      -- {name, hex, rgb: {r,g,b}, primary, secondary[]}
  
  -- Category and material type
  category_id UUID, -- Will reference categories table
  material_type TEXT NOT NULL CHECK (material_type IN (
    'tile', 'stone', 'wood', 'laminate', 'vinyl', 'carpet', 
    'metal', 'glass', 'concrete', 'ceramic', 'porcelain', 'other'
  )),
  
  -- Surface properties
  finish TEXT NOT NULL,
  pattern TEXT,
  texture TEXT,
  
  -- Technical specifications (flexible JSONB for material-specific data)
  technical_specs JSONB DEFAULT '{}',
  
  -- Images array with structured metadata
  images JSONB DEFAULT '[]', -- Array of image objects with id, url, type, dimensions, etc.
  
  -- Metadata and tagging
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  metadata_confidence JSONB DEFAULT '{}', -- Field confidence scores
  
  -- Catalog and extraction information
  catalog_id TEXT NOT NULL,
  catalog_page INTEGER,
  extracted_at TIMESTAMPTZ DEFAULT now(),
  
  -- Vector representation for similarity search
  vector_representation VECTOR(384), -- Adjust dimension as needed
  
  -- Processing status fields
  index_status TEXT DEFAULT 'pending' CHECK (index_status IN ('pending', 'indexed', 'failed')),
  processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
  storage_size BIGINT,
  last_retrieved_at TIMESTAMPTZ,
  
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
      coalesce(manufacturer, '') || ' ' ||
      coalesce(material_type, '') || ' ' ||
      coalesce(finish, '') || ' ' ||
      coalesce(pattern, '') || ' ' ||
      coalesce(texture, '') || ' ' ||
      coalesce(array_to_string(tags, ' '), '')
    )
  ) STORED
);

-- -------------------------------------------------------
-- Indexes for Performance
-- -------------------------------------------------------

-- Primary search and filtering indexes
CREATE INDEX materials_search_text_idx ON materials USING GIN (search_text);
CREATE INDEX materials_material_type_idx ON materials (material_type);
CREATE INDEX materials_manufacturer_idx ON materials (manufacturer);
CREATE INDEX materials_finish_idx ON materials (finish);
CREATE INDEX materials_tags_idx ON materials USING GIN (tags);
CREATE INDEX materials_catalog_id_idx ON materials (catalog_id);

-- Relationship indexes
CREATE INDEX materials_collection_id_idx ON materials (collection_id);
CREATE INDEX materials_series_id_idx ON materials (series_id);
CREATE INDEX materials_category_id_idx ON materials (category_id);

-- Status and processing indexes
CREATE INDEX materials_is_active_idx ON materials (is_active);
CREATE INDEX materials_processing_status_idx ON materials (processing_status);
CREATE INDEX materials_index_status_idx ON materials (index_status);

-- Temporal indexes
CREATE INDEX materials_created_at_idx ON materials (created_at);
CREATE INDEX materials_updated_at_idx ON materials (updated_at);
CREATE INDEX materials_extracted_at_idx ON materials (extracted_at);

-- JSONB indexes for structured queries
CREATE INDEX materials_dimensions_idx ON materials USING GIN (dimensions);
CREATE INDEX materials_color_idx ON materials USING GIN (color);
CREATE INDEX materials_technical_specs_idx ON materials USING GIN (technical_specs);
CREATE INDEX materials_metadata_idx ON materials USING GIN (metadata);

-- Vector similarity search index
CREATE INDEX materials_vector_idx ON materials USING ivfflat (vector_representation vector_cosine_ops) WITH (lists = 100);

-- Composite indexes for common query patterns
CREATE INDEX materials_type_manufacturer_idx ON materials (material_type, manufacturer);
CREATE INDEX materials_active_type_idx ON materials (is_active, material_type) WHERE is_active = true;
CREATE INDEX materials_collection_active_idx ON materials (collection_id, is_active) WHERE is_active = true;

-- -------------------------------------------------------
-- Row Level Security (RLS)
-- -------------------------------------------------------
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;

-- Public read access for active materials
CREATE POLICY "Public materials are viewable" 
  ON materials FOR SELECT 
  USING (is_active = true);

-- Authenticated users can insert materials
CREATE POLICY "Authenticated users can insert materials" 
  ON materials FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

-- Users can update their own materials
CREATE POLICY "Users can update own materials" 
  ON materials FOR UPDATE 
  USING (auth.uid() = created_by OR auth.uid() = last_modified_by);

-- Users can delete their own materials (soft delete by setting is_active = false)
CREATE POLICY "Users can delete own materials" 
  ON materials FOR UPDATE 
  USING (auth.uid() = created_by)
  WITH CHECK (is_active = false);

-- -------------------------------------------------------
-- Triggers
-- -------------------------------------------------------

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_materials_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  IF NEW.last_modified_by IS NULL THEN
    NEW.last_modified_by = auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER materials_update_timestamp
  BEFORE UPDATE ON materials
  FOR EACH ROW
  EXECUTE FUNCTION update_materials_timestamp();

-- -------------------------------------------------------
-- Helper Functions
-- -------------------------------------------------------

-- Function to search materials with filters
CREATE OR REPLACE FUNCTION search_materials(
  search_query TEXT DEFAULT NULL,
  material_types TEXT[] DEFAULT NULL,
  manufacturers TEXT[] DEFAULT NULL,
  collection_ids UUID[] DEFAULT NULL,
  category_ids UUID[] DEFAULT NULL,
  tags_filter TEXT[] DEFAULT NULL,
  limit_count INTEGER DEFAULT 50,
  offset_count INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  manufacturer TEXT,
  material_type TEXT,
  finish TEXT,
  dimensions JSONB,
  color JSONB,
  images JSONB,
  tags TEXT[],
  created_at TIMESTAMPTZ,
  rank REAL
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.name,
    m.description,
    m.manufacturer,
    m.material_type,
    m.finish,
    m.dimensions,
    m.color,
    m.images,
    m.tags,
    m.created_at,
    CASE 
      WHEN search_query IS NOT NULL THEN ts_rank(m.search_text, plainto_tsquery('english', search_query))
      ELSE 1.0
    END as rank
  FROM materials m
  WHERE 
    m.is_active = true
    AND (search_query IS NULL OR m.search_text @@ plainto_tsquery('english', search_query))
    AND (material_types IS NULL OR m.material_type = ANY(material_types))
    AND (manufacturers IS NULL OR m.manufacturer = ANY(manufacturers))
    AND (collection_ids IS NULL OR m.collection_id = ANY(collection_ids))
    AND (category_ids IS NULL OR m.category_id = ANY(category_ids))
    AND (tags_filter IS NULL OR m.tags && tags_filter)
  ORDER BY 
    CASE WHEN search_query IS NOT NULL THEN rank END DESC,
    m.updated_at DESC
  LIMIT limit_count
  OFFSET offset_count;
END;
$$;

-- Function to find similar materials by vector
CREATE OR REPLACE FUNCTION find_similar_materials(
  query_vector VECTOR(384),
  material_id_exclude UUID DEFAULT NULL,
  similarity_threshold FLOAT DEFAULT 0.7,
  limit_count INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  material_type TEXT,
  manufacturer TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.name,
    m.material_type,
    m.manufacturer,
    1 - (m.vector_representation <=> query_vector) as similarity
  FROM materials m
  WHERE 
    m.is_active = true
    AND m.vector_representation IS NOT NULL
    AND (material_id_exclude IS NULL OR m.id != material_id_exclude)
    AND (1 - (m.vector_representation <=> query_vector)) >= similarity_threshold
  ORDER BY similarity DESC
  LIMIT limit_count;
END;
$$;

-- Function to get material statistics
CREATE OR REPLACE FUNCTION get_material_stats()
RETURNS TABLE (
  total_materials BIGINT,
  active_materials BIGINT,
  materials_by_type JSONB,
  materials_by_manufacturer JSONB,
  processing_status_counts JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_materials,
    COUNT(*) FILTER (WHERE is_active = true) as active_materials,
    jsonb_object_agg(material_type, type_count) as materials_by_type,
    jsonb_object_agg(manufacturer, manufacturer_count) as materials_by_manufacturer,
    jsonb_object_agg(processing_status, status_count) as processing_status_counts
  FROM (
    SELECT 
      material_type,
      COUNT(*) as type_count,
      manufacturer,
      COUNT(*) as manufacturer_count,
      processing_status,
      COUNT(*) as status_count
    FROM materials 
    WHERE is_active = true
    GROUP BY GROUPING SETS (
      (material_type),
      (manufacturer),
      (processing_status)
    )
  ) stats;
END;
$$;

-- Comments for documentation
COMMENT ON TABLE materials IS 'Enhanced materials table replacing MongoDB material model with optimized PostgreSQL schema';
COMMENT ON COLUMN materials.external_id IS 'External ID for MongoDB compatibility during migration';
COMMENT ON COLUMN materials.dimensions IS 'Physical dimensions as JSONB: {width, height, depth, unit}';
COMMENT ON COLUMN materials.color IS 'Color information as JSONB: {name, hex, rgb, primary, secondary[]}';
COMMENT ON COLUMN materials.technical_specs IS 'Material-specific technical specifications as flexible JSONB';
COMMENT ON COLUMN materials.images IS 'Array of image objects with metadata';
COMMENT ON COLUMN materials.vector_representation IS 'Vector embedding for similarity search';
COMMENT ON COLUMN materials.search_text IS 'Generated full-text search vector';