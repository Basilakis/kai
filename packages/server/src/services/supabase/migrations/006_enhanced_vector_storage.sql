-- Migration: Enhanced Vector Storage for RAG System
-- This migration adds support for:
-- 1. Both dense and sparse embeddings
-- 2. HNSW indexing for better performance at scale
-- 3. Specialized indexes for different material categories
-- 4. Integration with the existing embedding pipeline

-- Ensure vector extension is enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Update the materials table to support both dense and sparse embeddings
ALTER TABLE materials 
-- Rename existing column for backward compatibility
RENAME COLUMN vector_representation TO legacy_vector_embedding;

-- Add new columns for enhanced embedding storage
ALTER TABLE materials
ADD COLUMN dense_embedding VECTOR(384),
ADD COLUMN sparse_embedding JSONB,
ADD COLUMN embedding_metadata JSONB,
ADD COLUMN embedding_method TEXT,
ADD COLUMN embedding_quality FLOAT;

-- Create a function to combine dense and sparse embeddings into a hybrid similarity score
CREATE OR REPLACE FUNCTION hybrid_similarity(
    dense_embedding1 VECTOR(384),
    sparse_embedding1 JSONB,
    dense_embedding2 VECTOR(384),
    sparse_embedding2 JSONB,
    dense_weight FLOAT DEFAULT 0.7
) RETURNS FLOAT AS $$
DECLARE
    dense_score FLOAT;
    sparse_score FLOAT;
    sparse_indices1 INT[];
    sparse_values1 FLOAT[];
    sparse_indices2 INT[];
    sparse_values2 FLOAT[];
    intersection_score FLOAT := 0;
    i INT := 1;
    j INT := 1;
BEGIN
    -- Calculate dense similarity using cosine distance
    dense_score := 1 - (dense_embedding1 <=> dense_embedding2);
    
    -- Extract sparse vectors
    SELECT ARRAY(SELECT jsonb_array_elements_text(sparse_embedding1->'indices')::INT) INTO sparse_indices1;
    SELECT ARRAY(SELECT jsonb_array_elements_text(sparse_embedding1->'values')::FLOAT) INTO sparse_values1;
    SELECT ARRAY(SELECT jsonb_array_elements_text(sparse_embedding2->'indices')::INT) INTO sparse_indices2;
    SELECT ARRAY(SELECT jsonb_array_elements_text(sparse_embedding2->'values')::FLOAT) INTO sparse_values2;
    
    -- Calculate sparse similarity (dot product of matching indices)
    WHILE i <= array_length(sparse_indices1, 1) AND j <= array_length(sparse_indices2, 1) LOOP
        IF sparse_indices1[i] = sparse_indices2[j] THEN
            intersection_score := intersection_score + (sparse_values1[i] * sparse_values2[j]);
            i := i + 1;
            j := j + 1;
        ELSIF sparse_indices1[i] < sparse_indices2[j] THEN
            i := i + 1;
        ELSE
            j := j + 1;
        END IF;
    END LOOP;
    
    -- Normalize sparse score (if no intersection, score is 0)
    IF array_length(sparse_indices1, 1) > 0 AND array_length(sparse_indices2, 1) > 0 THEN
        sparse_score := intersection_score;
    ELSE
        sparse_score := 0;
    END IF;
    
    -- Combine scores with weighting
    RETURN (dense_weight * dense_score) + ((1 - dense_weight) * sparse_score);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create a function to find similar materials using hybrid search
CREATE OR REPLACE FUNCTION find_similar_materials_hybrid(
    dense_query_vector VECTOR(384),
    sparse_query_vector JSONB,
    similarity_threshold FLOAT DEFAULT 0.7,
    max_results INT DEFAULT 10,
    material_type_filter TEXT DEFAULT NULL,
    dense_weight FLOAT DEFAULT 0.7
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
        hybrid_similarity(
            m.dense_embedding,
            m.sparse_embedding,
            dense_query_vector,
            sparse_query_vector,
            dense_weight
        ) AS similarity
    FROM
        materials m
    WHERE
        m.dense_embedding IS NOT NULL
        AND m.sparse_embedding IS NOT NULL
        AND (material_type_filter IS NULL OR m.material_type = material_type_filter)
    ORDER BY
        similarity DESC
    LIMIT max_results;
END;
$$;

-- Create a specialized function for text search using embeddings
CREATE OR REPLACE FUNCTION search_materials_by_text(
    query_text TEXT,
    similarity_threshold FLOAT DEFAULT 0.7,
    max_results INT DEFAULT 10,
    material_type_filter TEXT DEFAULT NULL,
    dense_weight FLOAT DEFAULT 0.7
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    material_type TEXT,
    similarity FLOAT,
    matched_by TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    embedding_record RECORD;
    dense_vector VECTOR(384);
    sparse_vector JSONB;
BEGIN
    -- Call external function to generate embeddings (this will be handled by application code)
    -- For now, we'll just search with existing methods and flag how the match was made
    
    RETURN QUERY
    SELECT
        m.id,
        m.name,
        m.material_type,
        GREATEST(
            -- Text search score (normalized to 0-1 range)
            ts_rank_cd(m.search_text, plainto_tsquery('english', query_text)) / 2.0,
            -- Vector similarity score (already in 0-1 range)
            COALESCE(1 - (m.dense_embedding <=> (SELECT dense_embedding FROM materials WHERE name ILIKE '%' || query_text || '%' LIMIT 1)), 0.0)
        ) AS similarity,
        CASE
            WHEN m.search_text @@ plainto_tsquery('english', query_text) THEN 'text'
            ELSE 'vector'
        END AS matched_by
    FROM
        materials m
    WHERE
        (m.search_text @@ plainto_tsquery('english', query_text) OR 
         m.name ILIKE '%' || query_text || '%' OR
         m.dense_embedding IS NOT NULL)
        AND (material_type_filter IS NULL OR m.material_type = material_type_filter)
    ORDER BY
        similarity DESC
    LIMIT max_results;
END;
$$;

-- Create material category-specific materialized views for specialized indexing
-- These will be populated by the application code
CREATE MATERIALIZED VIEW IF NOT EXISTS materials_tile_vectors AS
SELECT 
    id,
    name,
    material_type,
    dense_embedding,
    sparse_embedding,
    embedding_metadata
FROM 
    materials
WHERE 
    material_type = 'tile' AND
    dense_embedding IS NOT NULL;

CREATE MATERIALIZED VIEW IF NOT EXISTS materials_stone_vectors AS
SELECT 
    id,
    name,
    material_type,
    dense_embedding,
    sparse_embedding,
    embedding_metadata
FROM 
    materials
WHERE 
    material_type = 'stone' AND
    dense_embedding IS NOT NULL;

CREATE MATERIALIZED VIEW IF NOT EXISTS materials_wood_vectors AS
SELECT 
    id,
    name,
    material_type,
    dense_embedding,
    sparse_embedding,
    embedding_metadata
FROM 
    materials
WHERE 
    material_type = 'wood' AND
    dense_embedding IS NOT NULL;

-- Create HNSW indexes on the materialized views for faster similarity search
-- Note: HNSW indexes are better for larger datasets and provide approximate nearest neighbor search
CREATE INDEX IF NOT EXISTS materials_tile_vectors_hnsw_idx ON materials_tile_vectors USING hnsw (dense_embedding vector_cosine_ops) WITH (m=16, ef_construction=64);
CREATE INDEX IF NOT EXISTS materials_stone_vectors_hnsw_idx ON materials_stone_vectors USING hnsw (dense_embedding vector_cosine_ops) WITH (m=16, ef_construction=64);
CREATE INDEX IF NOT EXISTS materials_wood_vectors_hnsw_idx ON materials_wood_vectors USING hnsw (dense_embedding vector_cosine_ops) WITH (m=16, ef_construction=64);

-- Add HNSW index on the main materials table for general search
CREATE INDEX IF NOT EXISTS materials_dense_embedding_hnsw_idx ON materials USING hnsw (dense_embedding vector_cosine_ops) WITH (m=16, ef_construction=64);

-- Create a function to refresh all vector materialized views
CREATE OR REPLACE FUNCTION refresh_vector_materialized_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY materials_tile_vectors;
    REFRESH MATERIALIZED VIEW CONCURRENTLY materials_stone_vectors;
    REFRESH MATERIALIZED VIEW CONCURRENTLY materials_wood_vectors;
    -- Add other material types as needed
END;
$$ LANGUAGE plpgsql;

-- Create a trigger function to update the materialized views when materials are changed
CREATE OR REPLACE FUNCTION update_material_vector_views()
RETURNS TRIGGER AS $$
BEGIN
    -- Schedule a refresh of the appropriate materialized view
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        IF NEW.material_type = 'tile' THEN
            REFRESH MATERIALIZED VIEW CONCURRENTLY materials_tile_vectors;
        ELSIF NEW.material_type = 'stone' THEN
            REFRESH MATERIALIZED VIEW CONCURRENTLY materials_stone_vectors;
        ELSIF NEW.material_type = 'wood' THEN
            REFRESH MATERIALIZED VIEW CONCURRENTLY materials_wood_vectors;
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD.material_type = 'tile' THEN
            REFRESH MATERIALIZED VIEW CONCURRENTLY materials_tile_vectors;
        ELSIF OLD.material_type = 'stone' THEN
            REFRESH MATERIALIZED VIEW CONCURRENTLY materials_stone_vectors;
        ELSIF OLD.material_type = 'wood' THEN
            REFRESH MATERIALIZED VIEW CONCURRENTLY materials_wood_vectors;
        END IF;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to update the materialized views
CREATE TRIGGER material_vector_views_trigger
AFTER INSERT OR UPDATE OR DELETE ON materials
FOR EACH ROW EXECUTE FUNCTION update_material_vector_views();

-- Create a new table for vector search configuration and performance tracking
CREATE TABLE IF NOT EXISTS vector_search_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    
    -- Configuration
    dense_weight FLOAT NOT NULL DEFAULT 0.7,
    index_type TEXT NOT NULL DEFAULT 'hnsw',
    index_parameters JSONB DEFAULT '{"m": 16, "ef_construction": 64, "ef_search": 40}',
    
    -- Material type specific settings
    material_type TEXT,
    model_path TEXT,
    
    -- Performance metrics
    average_query_time_ms FLOAT,
    queries_count INT DEFAULT 0,
    last_updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Create a unique constraint on the name
CREATE UNIQUE INDEX IF NOT EXISTS vector_search_config_name_idx ON vector_search_config (name);

-- Create a table to store embedding statistics and quality metrics
CREATE TABLE IF NOT EXISTS embedding_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    material_id UUID REFERENCES materials(id),
    embedding_type TEXT NOT NULL, -- 'dense', 'sparse', 'hybrid'
    model_name TEXT,
    dimensions INT,
    quality_score FLOAT,
    processing_time_ms FLOAT,
    metrics JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes on the metrics table
CREATE INDEX IF NOT EXISTS embedding_metrics_material_id_idx ON embedding_metrics (material_id);
CREATE INDEX IF NOT EXISTS embedding_metrics_embedding_type_idx ON embedding_metrics (embedding_type);
CREATE INDEX IF NOT EXISTS embedding_metrics_quality_score_idx ON embedding_metrics (quality_score);

-- Insert default vector search configurations
INSERT INTO vector_search_config (name, description, dense_weight, index_type, index_parameters, material_type)
VALUES 
('default', 'Default configuration for all material types', 0.7, 'hnsw', '{"m": 16, "ef_construction": 64, "ef_search": 40}', NULL),
('tile', 'Optimized for tile materials', 0.6, 'hnsw', '{"m": 16, "ef_construction": 64, "ef_search": 50}', 'tile'),
('stone', 'Optimized for stone materials', 0.8, 'hnsw', '{"m": 16, "ef_construction": 64, "ef_search": 60}', 'stone'),
('wood', 'Optimized for wood materials', 0.7, 'hnsw', '{"m": 16, "ef_construction": 96, "ef_search": 40}', 'wood')
ON CONFLICT (name) DO NOTHING;

-- Create a hybrid search function that uses the appropriate configuration
CREATE OR REPLACE FUNCTION material_hybrid_search(
    query_text TEXT,
    material_type TEXT DEFAULT NULL,
    max_results INT DEFAULT 10,
    config_name TEXT DEFAULT 'default'
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    material_type TEXT,
    similarity FLOAT,
    matched_by TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    config_record RECORD;
BEGIN
    -- Get the appropriate configuration
    SELECT * INTO config_record FROM vector_search_config 
    WHERE name = config_name OR (material_type IS NOT NULL AND material_type = material_hybrid_search.material_type)
    ORDER BY material_type NULLS LAST
    LIMIT 1;
    
    -- If no specific configuration is found, use default
    IF config_record IS NULL THEN
        SELECT * INTO config_record FROM vector_search_config WHERE name = 'default' LIMIT 1;
    END IF;
    
    -- Call the search function with the configuration
    RETURN QUERY
    SELECT * FROM search_materials_by_text(
        query_text,
        0.5, -- Lower threshold for hybrid search
        max_results,
        material_type,
        config_record.dense_weight
    );
    
    -- Update metrics for this configuration
    UPDATE vector_search_config
    SET 
        queries_count = queries_count + 1,
        last_updated_at = NOW()
    WHERE id = config_record.id;
END;
$$;

-- Create a view to help monitor vector search performance
CREATE OR REPLACE VIEW vector_search_performance AS
SELECT 
    config.name AS config_name,
    config.material_type,
    config.dense_weight,
    config.index_type,
    config.queries_count,
    config.average_query_time_ms,
    COUNT(metrics.id) AS embeddings_count,
    AVG(metrics.quality_score) AS avg_quality_score,
    AVG(metrics.processing_time_ms) AS avg_processing_time_ms,
    MIN(metrics.quality_score) AS min_quality_score,
    MAX(metrics.quality_score) AS max_quality_score
FROM 
    vector_search_config config
LEFT JOIN
    embedding_metrics metrics ON 
    (config.material_type IS NULL OR metrics.material_id IN 
     (SELECT id FROM materials WHERE material_type = config.material_type))
GROUP BY
    config.id, config.name, config.material_type, config.dense_weight, 
    config.index_type, config.queries_count, config.average_query_time_ms
ORDER BY
    config.queries_count DESC;