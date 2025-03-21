# Supabase Schema for Kai System

This document outlines the database schema for the Kai system using Supabase PostgreSQL.

## Tables and Relationships

### Materials Table

```sql
-- Enable vector extension for similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Create materials table
CREATE TABLE materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  manufacturer TEXT,
  
  -- Collection organization
  collection_id UUID REFERENCES collections(id),
  series_id UUID REFERENCES collections(id),
  
  -- Physical properties
  dimensions JSONB NOT NULL DEFAULT '{"width": 0, "height": 0, "unit": "mm"}',
  
  color JSONB NOT NULL DEFAULT '{"name": "Unknown", "primary": true}',
  
  -- Category and material type
  category_id UUID REFERENCES categories(id),
  material_type TEXT NOT NULL CHECK (material_type IN (
    'tile', 'stone', 'wood', 'laminate', 'vinyl', 'carpet', 
    'metal', 'glass', 'concrete', 'ceramic', 'porcelain', 'other'
  )),
  
  -- Surface properties
  finish TEXT NOT NULL,
  pattern TEXT,
  texture TEXT,
  
  -- Technical specifications
  technical_specs JSONB,
  
  -- Images
  images JSONB[] DEFAULT '{}',
  
  -- Metadata
  tags TEXT[] DEFAULT '{}',
  catalog_id UUID REFERENCES catalogs(id),
  catalog_page INTEGER,
  
  -- Vector representation for similarity search (using pgvector)
  vector_representation VECTOR(384),
  
  -- Additional metadata
  metadata JSONB DEFAULT '{}',
  metadata_confidence JSONB DEFAULT '{}',
  
  -- Timestamps
  extracted_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Full-text search index
  search_text TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('english', array_to_string(tags, ' ')), 'C')
  ) STORED
);

-- Create indexes
CREATE INDEX materials_collection_id_idx ON materials (collection_id);
CREATE INDEX materials_material_type_idx ON materials (material_type);
CREATE INDEX materials_tags_idx ON materials USING GIN (tags);
CREATE INDEX materials_search_idx ON materials USING GIN (search_text);
CREATE INDEX materials_vector_idx ON materials USING ivfflat (vector_representation vector_cosine_ops) WITH (lists = 100);
```

### Collections Table

```sql
CREATE TABLE collections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES collections(id),
  
  -- Metadata
  manufacturer TEXT,
  year TEXT,
  tags TEXT[] DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX collections_parent_id_idx ON collections (parent_id);
```

### Categories Table

```sql
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES categories(id),
  
  -- Metadata
  properties JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX categories_parent_id_idx ON categories (parent_id);
```

### Catalogs Table

```sql
CREATE TABLE catalogs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  manufacturer TEXT,
  
  -- File information
  file_path TEXT,
  file_size INTEGER,
  page_count INTEGER,
  
  -- Timestamps
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  
  -- Processing status
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  status_message TEXT
);
```

### Versions Table (Material History)

```sql
CREATE TABLE versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_id UUID NOT NULL,
  entity_type TEXT NOT NULL,
  previous_data JSONB NOT NULL,
  
  -- Metadata
  change_description TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX versions_entity_id_type_idx ON versions (entity_id, entity_type);
```

### ML Models Table

```sql
CREATE TABLE ml_models (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  
  -- Model details
  model_type TEXT NOT NULL CHECK (model_type IN ('feature-based', 'ml-based', 'hybrid')),
  framework TEXT CHECK (framework IN ('tensorflow', 'pytorch', 'other')),
  version TEXT NOT NULL,
  
  -- File information
  storage_path TEXT NOT NULL,
  file_size_bytes INTEGER,
  
  -- Performance metrics
  accuracy FLOAT,
  validation_accuracy FLOAT,
  loss FLOAT,
  
  -- Training information
  trained_at TIMESTAMPTZ DEFAULT NOW(),
  training_duration_seconds INTEGER,
  epochs INTEGER,
  parameters JSONB DEFAULT '{}',
  
  -- Status
  is_active BOOLEAN DEFAULT false,
  status TEXT NOT NULL CHECK (status IN ('pending', 'training', 'completed', 'failed', 'active')),
  
  -- Created by
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX ml_models_model_type_idx ON ml_models (model_type);
CREATE INDEX ml_models_is_active_idx ON ml_models (is_active) WHERE is_active = true;
```

### Vector Indexes Table

```sql
CREATE TABLE vector_indexes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  
  -- Index details
  entity_type TEXT NOT NULL,
  index_type TEXT NOT NULL CHECK (index_type IN ('ivfflat', 'hnsw', 'custom')),
  
  -- Configuration
  dimension INTEGER NOT NULL,
  parameters JSONB DEFAULT '{}',
  
  -- Status
  status TEXT NOT NULL CHECK (status IN ('building', 'ready', 'updating', 'failed')),
  document_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_build_time TIMESTAMPTZ,
  last_update_time TIMESTAMPTZ
);
```

## Storage Buckets

```sql
-- Create buckets for different types of files
INSERT INTO storage.buckets (id, name, public, avif_autodetection)
VALUES 
  ('models', 'ML Models', false, false),
  ('materials', 'Material Images', true, true),
  ('catalogs', 'PDF Catalogs', false, false),
  ('embeddings', 'Vector Embeddings', false, false);

-- Set up security policies for buckets
CREATE POLICY "Models access for authenticated users only"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'models' AND auth.role() = 'authenticated');

CREATE POLICY "Material images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'materials');

CREATE POLICY "Catalog access for authenticated users only"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'catalogs' AND auth.role() = 'authenticated');
```

## Row-Level Security (RLS) Policies

```sql
-- Enable RLS on tables
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE vector_indexes ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Materials are viewable by everyone"
  ON materials FOR SELECT
  USING (true);

CREATE POLICY "Collections are viewable by everyone"
  ON collections FOR SELECT
  USING (true);

CREATE POLICY "Categories are viewable by everyone"
  ON categories FOR SELECT
  USING (true);

CREATE POLICY "Catalog metadata is viewable by authenticated users"
  ON catalogs FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "ML models are viewable by authenticated users"
  ON ml_models FOR SELECT
  USING (auth.role() = 'authenticated');
```

## Functions for Vector Search

```sql
-- Function to find similar materials based on vector similarity
CREATE OR REPLACE FUNCTION find_similar_materials(
  search_vector VECTOR(384),
  similarity_threshold FLOAT DEFAULT 0.7,
  max_results INT DEFAULT 10,
  material_type_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  material_type TEXT,
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
    1 - (m.vector_representation <=> search_vector) AS similarity
  FROM
    materials m
  WHERE
    m.vector_representation IS NOT NULL
    AND (material_type_filter IS NULL OR m.material_type = material_type_filter)
    AND 1 - (m.vector_representation <=> search_vector) >= similarity_threshold
  ORDER BY
    similarity DESC
  LIMIT max_results;
END;
$$;
```

## Database Triggers

```sql
-- Trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_materials_timestamp
BEFORE UPDATE ON materials
FOR EACH ROW EXECUTE PROCEDURE update_timestamp();

CREATE TRIGGER update_collections_timestamp
BEFORE UPDATE ON collections
FOR EACH ROW EXECUTE PROCEDURE update_timestamp();

-- Trigger to create a version record when a material is updated
CREATE OR REPLACE FUNCTION create_material_version()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO versions (
    id,
    entity_id,
    entity_type,
    previous_data,
    change_description,
    created_by
  ) VALUES (
    uuid_generate_v4(),
    OLD.id,
    'material',
    row_to_json(OLD),
    'Material updated',
    NEW.created_by
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER create_material_version_trigger
BEFORE UPDATE ON materials
FOR EACH ROW EXECUTE PROCEDURE create_material_version();
```

## Data Migration Notes

When migrating from MongoDB to Supabase PostgreSQL:

1. Convert MongoDB ObjectIDs to UUIDs
2. Normalize nested documents into proper relational tables where appropriate
3. Move MongoDB arrays to PostgreSQL arrays or JSONB arrays depending on access patterns
4. Use JSONB type for flexible schema fields (like metadata)
5. Replace MongoDB text search with PostgreSQL full-text search using tsvector fields
6. Convert MongoDB vector fields to pgvector VECTOR type
7. Implement proper foreign key relationships that weren't enforced in MongoDB