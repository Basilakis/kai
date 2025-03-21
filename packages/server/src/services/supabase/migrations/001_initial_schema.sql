-- Supabase PostgreSQL Schema for RAG Data, ML Models, and Vector Embeddings
-- This migration sets up the initial schema for the Kai system using Supabase

-- Enable the pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS pgvector;

-- -------------------------------------------------------
-- Materials Table - Core RAG Data
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL,
  properties JSONB,
  technical_data JSONB,
  metadata JSONB,
  tags TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  search_text TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, '') || ' ' || 
    coalesce(type, '') || ' ' || coalesce(array_to_string(tags, ' '), ''))
  ) STORED
);

-- Create a GIN index on the search_text column for faster text search
CREATE INDEX IF NOT EXISTS materials_search_text_idx ON materials USING GIN (search_text);
CREATE INDEX IF NOT EXISTS materials_type_idx ON materials (type);
CREATE INDEX IF NOT EXISTS materials_tags_idx ON materials USING GIN (tags);
CREATE INDEX IF NOT EXISTS materials_updated_at_idx ON materials (updated_at);

-- Add RLS policies for materials
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public materials are viewable by everyone" 
  ON materials FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert materials" 
  ON materials FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update their own materials" 
  ON materials FOR UPDATE USING (auth.uid() = created_by);

-- -------------------------------------------------------
-- Collections Table - Groups of Materials
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES collections(id) ON DELETE SET NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS collections_parent_id_idx ON collections (parent_id);
CREATE INDEX IF NOT EXISTS collections_updated_at_idx ON collections (updated_at);

-- Add RLS policies for collections
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public collections are viewable by everyone" 
  ON collections FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert collections" 
  ON collections FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update their own collections" 
  ON collections FOR UPDATE USING (auth.uid() = created_by);

-- -------------------------------------------------------
-- Collection Materials Junction Table
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS collection_materials (
  collection_id UUID REFERENCES collections(id) ON DELETE CASCADE,
  material_id UUID REFERENCES materials(id) ON DELETE CASCADE,
  position INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (collection_id, material_id)
);

CREATE INDEX IF NOT EXISTS collection_materials_material_id_idx ON collection_materials (material_id);

-- -------------------------------------------------------
-- Versions Table - Version History
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL,
  entity_type TEXT NOT NULL,
  data JSONB NOT NULL,
  changes JSONB,
  version_number INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  comment TEXT
);

CREATE INDEX IF NOT EXISTS versions_entity_id_idx ON versions (entity_id);
CREATE INDEX IF NOT EXISTS versions_entity_type_idx ON versions (entity_type);
CREATE INDEX IF NOT EXISTS versions_version_number_idx ON versions (version_number);

-- -------------------------------------------------------
-- Vector Embeddings Table - For Similarity Search
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS vector_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID REFERENCES materials(id) ON DELETE CASCADE,
  embedding vector(384), -- Adjust dimension as needed
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create an index for cosine distance similarity search
CREATE INDEX IF NOT EXISTS vector_embeddings_embedding_idx ON vector_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS vector_embeddings_material_id_idx ON vector_embeddings (material_id);

-- -------------------------------------------------------
-- ML Models Table - Model Metadata
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS ml_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  version TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  metadata JSONB,
  metrics JSONB,
  parameters JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS ml_models_type_idx ON ml_models (type);
CREATE INDEX IF NOT EXISTS ml_models_version_idx ON ml_models (version);

-- -------------------------------------------------------
-- Training Parameters Table - For Dynamic Parameter Tuning
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS training_parameters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id TEXT NOT NULL,
  update_id TEXT NOT NULL,
  parameters JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS training_parameters_job_id_idx ON training_parameters (job_id);
CREATE INDEX IF NOT EXISTS training_parameters_status_idx ON training_parameters (status);
CREATE INDEX IF NOT EXISTS training_parameters_update_id_idx ON training_parameters (update_id);

-- Add trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_materials_timestamp
BEFORE UPDATE ON materials
FOR EACH ROW EXECUTE PROCEDURE update_timestamp();

CREATE TRIGGER update_collections_timestamp
BEFORE UPDATE ON collections
FOR EACH ROW EXECUTE PROCEDURE update_timestamp();

CREATE TRIGGER update_vector_embeddings_timestamp
BEFORE UPDATE ON vector_embeddings
FOR EACH ROW EXECUTE PROCEDURE update_timestamp();

CREATE TRIGGER update_ml_models_timestamp
BEFORE UPDATE ON ml_models
FOR EACH ROW EXECUTE PROCEDURE update_timestamp();

CREATE TRIGGER update_training_parameters_timestamp
BEFORE UPDATE ON training_parameters
FOR EACH ROW EXECUTE PROCEDURE update_timestamp();

-- -------------------------------------------------------
-- Functions for Vector Similarity Search
-- -------------------------------------------------------

-- Function to find similar materials by vector embedding
CREATE OR REPLACE FUNCTION find_similar_materials(
  query_embedding vector,
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id UUID,
  material_id UUID,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ve.id,
    ve.material_id,
    1 - (ve.embedding <=> query_embedding) AS similarity
  FROM
    vector_embeddings ve
  WHERE
    1 - (ve.embedding <=> query_embedding) > match_threshold
  ORDER BY
    similarity DESC
  LIMIT match_count;
END;
$$;

-- Function to get material with its vector embedding
CREATE OR REPLACE FUNCTION get_material_with_embedding(material_uuid UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  type TEXT,
  properties JSONB,
  technical_data JSONB,
  metadata JSONB,
  tags TEXT[],
  embedding vector
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.name,
    m.description,
    m.type,
    m.properties,
    m.technical_data,
    m.metadata,
    m.tags,
    ve.embedding
  FROM
    materials m
  LEFT JOIN
    vector_embeddings ve ON m.id = ve.material_id
  WHERE
    m.id = material_uuid;
END;
$$;