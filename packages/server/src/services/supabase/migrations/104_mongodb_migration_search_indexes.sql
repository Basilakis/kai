-- Migration: MongoDB to Supabase - Search Indexes
-- Description: Creates the search_indexes table with comprehensive search index management
-- This replaces the MongoDB SearchIndex collection with a PostgreSQL implementation
-- supporting text, vector, metadata, and combined search indexes

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Create enum types for search indexes
CREATE TYPE index_type AS ENUM ('text', 'vector', 'metadata', 'combined');
CREATE TYPE index_status AS ENUM ('building', 'ready', 'updating', 'error');
CREATE TYPE metric_type AS ENUM ('cosine', 'euclidean', 'dot');
CREATE TYPE tokenizer_type AS ENUM ('standard', 'ngram', 'whitespace', 'custom');
CREATE TYPE entity_type AS ENUM ('material', 'collection', 'category', 'metadataField');

-- Create search_indexes table
CREATE TABLE search_indexes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    entity_type entity_type NOT NULL,
    index_type index_type NOT NULL,
    fields TEXT[] NOT NULL DEFAULT '{}',
    tokenizer tokenizer_type DEFAULT 'standard',
    dimensions INTEGER,
    metric_type metric_type DEFAULT 'cosine',
    facets TEXT[] DEFAULT '{}',
    filter_fields TEXT[] DEFAULT '{}',
    sort_fields TEXT[] DEFAULT '{}',
    config JSONB DEFAULT '{}',
    status index_status DEFAULT 'building',
    last_build_time TIMESTAMPTZ,
    last_update_time TIMESTAMPTZ,
    document_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Create indexes for performance
CREATE INDEX idx_search_indexes_entity_type ON search_indexes(entity_type);
CREATE INDEX idx_search_indexes_index_type ON search_indexes(index_type);
CREATE INDEX idx_search_indexes_status ON search_indexes(status);
CREATE INDEX idx_search_indexes_name ON search_indexes(name);
CREATE INDEX idx_search_indexes_created_at ON search_indexes(created_at);
CREATE INDEX idx_search_indexes_updated_at ON search_indexes(updated_at);

-- GIN indexes for array and JSONB fields
CREATE INDEX idx_search_indexes_fields ON search_indexes USING GIN(fields);
CREATE INDEX idx_search_indexes_facets ON search_indexes USING GIN(facets);
CREATE INDEX idx_search_indexes_filter_fields ON search_indexes USING GIN(filter_fields);
CREATE INDEX idx_search_indexes_sort_fields ON search_indexes USING GIN(sort_fields);
CREATE INDEX idx_search_indexes_config ON search_indexes USING GIN(config);
CREATE INDEX idx_search_indexes_metadata ON search_indexes USING GIN(metadata);

-- Full-text search index on name and description
CREATE INDEX idx_search_indexes_text_search ON search_indexes USING GIN(
    to_tsvector('english', COALESCE(name, '') || ' ' || COALESCE(description, ''))
);

-- Composite indexes for common queries
CREATE INDEX idx_search_indexes_entity_status ON search_indexes(entity_type, status);
CREATE INDEX idx_search_indexes_type_status ON search_indexes(index_type, status);

-- Create trigger function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_search_indexes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER trigger_search_indexes_updated_at
    BEFORE UPDATE ON search_indexes
    FOR EACH ROW
    EXECUTE FUNCTION update_search_indexes_updated_at();

-- Add constraints
ALTER TABLE search_indexes ADD CONSTRAINT check_fields_not_empty 
    CHECK (array_length(fields, 1) > 0);

ALTER TABLE search_indexes ADD CONSTRAINT check_vector_dimensions 
    CHECK (
        (index_type != 'vector' AND index_type != 'combined') OR 
        (dimensions IS NOT NULL AND dimensions > 0)
    );

ALTER TABLE search_indexes ADD CONSTRAINT check_metadata_facets 
    CHECK (
        (index_type != 'metadata' AND index_type != 'combined') OR 
        (facets IS NOT NULL AND array_length(facets, 1) > 0)
    );

ALTER TABLE search_indexes ADD CONSTRAINT check_document_count_non_negative 
    CHECK (document_count >= 0);

-- Create helper functions for search index management

-- Function to get search indexes by entity type
CREATE OR REPLACE FUNCTION get_search_indexes_by_entity(
    p_entity_type entity_type,
    p_status index_status DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    description TEXT,
    entity_type entity_type,
    index_type index_type,
    fields TEXT[],
    status index_status,
    document_count INTEGER,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        si.id,
        si.name,
        si.description,
        si.entity_type,
        si.index_type,
        si.fields,
        si.status,
        si.document_count,
        si.created_at,
        si.updated_at
    FROM search_indexes si
    WHERE si.entity_type = p_entity_type
    AND (p_status IS NULL OR si.status = p_status)
    ORDER BY si.updated_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to update index status and document count
CREATE OR REPLACE FUNCTION update_search_index_status(
    p_index_id UUID,
    p_status index_status,
    p_document_count INTEGER DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_metadata JSONB;
BEGIN
    -- Prepare metadata update
    IF p_error_message IS NOT NULL THEN
        v_metadata = jsonb_build_object(
            'lastError', p_error_message,
            'lastErrorTimestamp', NOW()
        );
    ELSE
        v_metadata = '{}';
    END IF;

    -- Update the search index
    UPDATE search_indexes 
    SET 
        status = p_status,
        document_count = COALESCE(p_document_count, document_count),
        last_update_time = NOW(),
        last_build_time = CASE 
            WHEN p_status = 'ready' THEN NOW() 
            ELSE last_build_time 
        END,
        metadata = CASE 
            WHEN p_error_message IS NOT NULL THEN metadata || v_metadata
            ELSE metadata
        END
    WHERE id = p_index_id;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to search indexes by text
CREATE OR REPLACE FUNCTION search_indexes_by_text(
    p_query TEXT,
    p_entity_type entity_type DEFAULT NULL,
    p_index_type index_type DEFAULT NULL,
    p_limit INTEGER DEFAULT 10,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    description TEXT,
    entity_type entity_type,
    index_type index_type,
    status index_status,
    document_count INTEGER,
    rank REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        si.id,
        si.name,
        si.description,
        si.entity_type,
        si.index_type,
        si.status,
        si.document_count,
        ts_rank(
            to_tsvector('english', COALESCE(si.name, '') || ' ' || COALESCE(si.description, '')),
            plainto_tsquery('english', p_query)
        ) as rank
    FROM search_indexes si
    WHERE 
        to_tsvector('english', COALESCE(si.name, '') || ' ' || COALESCE(si.description, '')) 
        @@ plainto_tsquery('english', p_query)
    AND (p_entity_type IS NULL OR si.entity_type = p_entity_type)
    AND (p_index_type IS NULL OR si.index_type = p_index_type)
    ORDER BY rank DESC, si.updated_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- Function to get index statistics
CREATE OR REPLACE FUNCTION get_search_index_stats()
RETURNS TABLE (
    entity_type entity_type,
    index_type index_type,
    status index_status,
    count BIGINT,
    total_documents BIGINT,
    avg_documents NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        si.entity_type,
        si.index_type,
        si.status,
        COUNT(*) as count,
        SUM(si.document_count) as total_documents,
        AVG(si.document_count) as avg_documents
    FROM search_indexes si
    GROUP BY si.entity_type, si.index_type, si.status
    ORDER BY si.entity_type, si.index_type, si.status;
END;
$$ LANGUAGE plpgsql;

-- Enable Row Level Security
ALTER TABLE search_indexes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies

-- Policy: Users can view all search indexes
CREATE POLICY "search_indexes_select_policy" ON search_indexes
    FOR SELECT
    USING (true);

-- Policy: Authenticated users can create search indexes
CREATE POLICY "search_indexes_insert_policy" ON search_indexes
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- Policy: Users can update search indexes they created or if they're admin
CREATE POLICY "search_indexes_update_policy" ON search_indexes
    FOR UPDATE
    USING (
        auth.uid() = created_by OR
        auth.jwt() ->> 'role' = 'admin' OR
        auth.jwt() ->> 'role' = 'service_role'
    );

-- Policy: Users can delete search indexes they created or if they're admin
CREATE POLICY "search_indexes_delete_policy" ON search_indexes
    FOR DELETE
    USING (
        auth.uid() = created_by OR
        auth.jwt() ->> 'role' = 'admin' OR
        auth.jwt() ->> 'role' = 'service_role'
    );

-- Grant permissions
GRANT ALL ON search_indexes TO authenticated;
GRANT ALL ON search_indexes TO service_role;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION get_search_indexes_by_entity(entity_type, index_status) TO authenticated;
GRANT EXECUTE ON FUNCTION update_search_index_status(UUID, index_status, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION search_indexes_by_text(TEXT, entity_type, index_type, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_search_index_stats() TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE search_indexes IS 'Search indexes for optimized querying of various entity types';
COMMENT ON COLUMN search_indexes.entity_type IS 'The type of entity this index supports (material, collection, etc.)';
COMMENT ON COLUMN search_indexes.index_type IS 'Type of search index (text, vector, metadata, combined)';
COMMENT ON COLUMN search_indexes.fields IS 'Array of field names that are indexed';
COMMENT ON COLUMN search_indexes.tokenizer IS 'Text tokenization method for text indexes';
COMMENT ON COLUMN search_indexes.dimensions IS 'Vector dimensions for vector indexes';
COMMENT ON COLUMN search_indexes.metric_type IS 'Distance metric for vector similarity';
COMMENT ON COLUMN search_indexes.facets IS 'Facetable fields for metadata indexes';
COMMENT ON COLUMN search_indexes.filter_fields IS 'Fields available for filtering';
COMMENT ON COLUMN search_indexes.sort_fields IS 'Fields available for sorting';
COMMENT ON COLUMN search_indexes.config IS 'Index-specific configuration as JSON';
COMMENT ON COLUMN search_indexes.status IS 'Current status of the index build process';
COMMENT ON COLUMN search_indexes.document_count IS 'Number of documents covered by this index';

-- Create sample data for testing (optional)
-- INSERT INTO search_indexes (name, description, entity_type, index_type, fields, status) VALUES
-- ('Materials Full Text', 'Full-text search index for materials', 'material', 'text', ARRAY['name', 'description', 'content'], 'ready'),
-- ('Materials Vector', 'Vector similarity search for materials', 'material', 'vector', ARRAY['embedding'], 'ready'),
-- ('Collections Metadata', 'Faceted search for collections', 'collection', 'metadata', ARRAY['tags', 'category'], 'ready');