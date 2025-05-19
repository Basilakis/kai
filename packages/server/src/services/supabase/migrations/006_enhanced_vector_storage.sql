-- Migration: Enhanced Vector Storage for RAG System
-- This migration adds support for:
-- 1. Both dense and sparse embeddings
-- 2. HNSW indexing for better performance at scale
-- 3. Specialized indexes for different material categories
-- 4. Integration with the existing embedding pipeline

-- Ensure vector extension is enabled
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; -- For uuid_generate_v4() if not already available

-- Update the materials table to support both dense and sparse embeddings
ALTER TABLE materials 
-- Rename existing column for backward compatibility
RENAME COLUMN IF EXISTS vector_representation TO legacy_vector_embedding; -- Use IF EXISTS for idempotency

-- Add new columns for enhanced embedding storage (ensure idempotency)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='materials' AND column_name='dense_embedding') THEN
        ALTER TABLE materials ADD COLUMN dense_embedding VECTOR(384);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='materials' AND column_name='sparse_embedding') THEN
        ALTER TABLE materials ADD COLUMN sparse_embedding JSONB;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='materials' AND column_name='embedding_metadata') THEN
        ALTER TABLE materials ADD COLUMN embedding_metadata JSONB;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='materials' AND column_name='embedding_method') THEN
        ALTER TABLE materials ADD COLUMN embedding_method TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='materials' AND column_name='embedding_quality') THEN
        ALTER TABLE materials ADD COLUMN embedding_quality FLOAT;
    END IF;
    -- Ensure search_text column exists for FTS
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='materials' AND column_name='search_text') THEN
        ALTER TABLE materials ADD COLUMN search_text TSVECTOR;
    END IF;
    -- Create an index on search_text if it doesn't exist
    CREATE INDEX IF NOT EXISTS materials_search_text_idx ON materials USING GIN (search_text);

    -- Trigger to update search_text from name and description
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tsvectorupdate') THEN
        CREATE TRIGGER tsvectorupdate BEFORE INSERT OR UPDATE
        ON materials FOR EACH ROW EXECUTE FUNCTION
        tsvector_update_trigger(search_text, 'pg_catalog.english', name, description);
    END IF;
END $$;


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
    norm1 FLOAT := 0;
    norm2 FLOAT := 0;
BEGIN
    -- Calculate dense similarity using cosine distance (1 - cosine_distance)
    IF dense_embedding1 IS NOT NULL AND dense_embedding2 IS NOT NULL THEN
        dense_score := 1 - (dense_embedding1 <=> dense_embedding2);
    ELSE
        dense_score := 0.0;
    END IF;
    
    -- Extract sparse vectors if they are valid JSON arrays for indices and values
    IF sparse_embedding1 IS NOT NULL AND jsonb_typeof(sparse_embedding1->'indices') = 'array' AND jsonb_typeof(sparse_embedding1->'values') = 'array' THEN
        SELECT ARRAY(SELECT jsonb_array_elements_text(sparse_embedding1->'indices')::INT) INTO sparse_indices1;
        SELECT ARRAY(SELECT jsonb_array_elements_text(sparse_embedding1->'values')::FLOAT) INTO sparse_values1;
    ELSE
        sparse_indices1 := ARRAY[]::INT[];
        sparse_values1 := ARRAY[]::FLOAT[];
    END IF;

    IF sparse_embedding2 IS NOT NULL AND jsonb_typeof(sparse_embedding2->'indices') = 'array' AND jsonb_typeof(sparse_embedding2->'values') = 'array' THEN
        SELECT ARRAY(SELECT jsonb_array_elements_text(sparse_embedding2->'indices')::INT) INTO sparse_indices2;
        SELECT ARRAY(SELECT jsonb_array_elements_text(sparse_embedding2->'values')::FLOAT) INTO sparse_values2;
    ELSE
        sparse_indices2 := ARRAY[]::INT[];
        sparse_values2 := ARRAY[]::FLOAT[];
    END IF;
    
    -- Calculate sparse similarity (cosine similarity for sparse vectors)
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

    FOR k IN 1..array_length(sparse_values1, 1) LOOP
        norm1 := norm1 + (sparse_values1[k] * sparse_values1[k]);
    END LOOP;
    norm1 := sqrt(norm1);

    FOR k IN 1..array_length(sparse_values2, 1) LOOP
        norm2 := norm2 + (sparse_values2[k] * sparse_values2[k]);
    END LOOP;
    norm2 := sqrt(norm2);
    
    IF norm1 > 0 AND norm2 > 0 THEN
        sparse_score := intersection_score / (norm1 * norm2);
    ELSE
        sparse_score := 0;
    END IF;
    
    -- Combine scores with weighting
    RETURN (dense_weight * dense_score) + ((1 - dense_weight) * sparse_score);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create a function to find similar materials using hybrid search (expects embeddings)
CREATE OR REPLACE FUNCTION find_similar_materials_hybrid(
    query_dense_embedding VECTOR(384),
    query_sparse_embedding JSONB,
    similarity_threshold FLOAT DEFAULT 0.7,
    max_results INT DEFAULT 10,
    material_type_filter TEXT DEFAULT NULL,
    dense_weight_param FLOAT DEFAULT 0.7 -- Renamed to avoid conflict
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
            query_dense_embedding,
            query_sparse_embedding,
            dense_weight_param
        ) AS similarity_score
    FROM
        materials m
    WHERE
        m.dense_embedding IS NOT NULL -- Ensure material has embeddings
        AND (material_type_filter IS NULL OR m.material_type = material_type_filter)
        AND hybrid_similarity(
            m.dense_embedding,
            m.sparse_embedding,
            query_dense_embedding,
            query_sparse_embedding,
            dense_weight_param
        ) >= similarity_threshold
    ORDER BY
        similarity_score DESC
    LIMIT max_results;
END;
$$;

-- Corrected function for combined text and vector search
-- Renamed from search_materials_by_text to search_materials_combined
CREATE OR REPLACE FUNCTION search_materials_combined(
    query_text TEXT, -- For FTS
    query_dense_embedding VECTOR(384), -- Dense embedding of query_text
    query_sparse_embedding JSONB, -- Sparse embedding of query_text
    similarity_threshold FLOAT DEFAULT 0.1, -- Lower threshold for initial candidates
    max_results INT DEFAULT 10,
    material_type_filter TEXT DEFAULT NULL,
    dense_weight_param FLOAT DEFAULT 0.7, -- Weight for dense in hybrid_similarity
    text_search_weight FLOAT DEFAULT 0.3, -- Weight for FTS score in final ranking
    vector_search_weight FLOAT DEFAULT 0.7 -- Weight for vector score in final ranking
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    material_type TEXT,
    final_similarity FLOAT,
    matched_by TEXT -- 'hybrid', 'text', 'vector'
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH text_search_results AS (
        SELECT
            m.id AS material_id,
            ts_rank_cd(m.search_text, plainto_tsquery('english', query_text)) AS text_score
        FROM materials m
        WHERE query_text IS NOT NULL AND query_text != '' AND m.search_text @@ plainto_tsquery('english', query_text)
        AND (material_type_filter IS NULL OR m.material_type = material_type_filter)
    ),
    vector_search_results AS (
        SELECT
            m.id AS material_id,
            hybrid_similarity(
                m.dense_embedding,
                m.sparse_embedding,
                query_dense_embedding,
                query_sparse_embedding,
                dense_weight_param
            ) AS vector_score
        FROM materials m
        WHERE query_dense_embedding IS NOT NULL AND m.dense_embedding IS NOT NULL -- Ensure embeddings exist
        AND (material_type_filter IS NULL OR m.material_type = material_type_filter)
    )
    SELECT
        m.id,
        m.name,
        m.material_type,
        (COALESCE(tsr.text_score, 0.0) * text_search_weight) + 
        (COALESCE(vsr.vector_score, 0.0) * vector_search_weight) AS combined_similarity,
        CASE
            WHEN COALESCE(tsr.text_score, 0.0) > 0.01 AND COALESCE(vsr.vector_score, 0.0) > 0.01 THEN 'hybrid'
            WHEN COALESCE(tsr.text_score, 0.0) > 0.01 THEN 'text'
            WHEN COALESCE(vsr.vector_score, 0.0) > 0.01 THEN 'vector'
            ELSE 'none'
        END AS match_type
    FROM materials m
    LEFT JOIN text_search_results tsr ON m.id = tsr.material_id
    LEFT JOIN vector_search_results vsr ON m.id = vsr.material_id
    WHERE
        (COALESCE(tsr.text_score, 0.0) > 0 OR COALESCE(vsr.vector_score, 0.0) > 0) -- Must have at least one match
        AND (material_type_filter IS NULL OR m.material_type = material_type_filter)
        AND (
            (COALESCE(tsr.text_score, 0.0) * text_search_weight) + 
            (COALESCE(vsr.vector_score, 0.0) * vector_search_weight)
        ) >= similarity_threshold
    ORDER BY
        combined_similarity DESC
    LIMIT max_results;
END;
$$;

-- Updated material_hybrid_search RPC wrapper to call the new combined search function
-- Renamed to material_hybrid_search_rpc to avoid conflict if old one is kept temporarily for transition
CREATE OR REPLACE FUNCTION material_hybrid_search_rpc( 
    query_text TEXT, -- Still needed for FTS part
    query_dense_embedding VECTOR(384),
    query_sparse_embedding JSONB,
    material_type_filter TEXT DEFAULT NULL,
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
    effective_dense_weight FLOAT;
    effective_text_weight FLOAT;
BEGIN
    SELECT * INTO config_record FROM vector_search_config vsc
    WHERE vsc.name = material_hybrid_search_rpc.config_name OR 
          (material_hybrid_search_rpc.material_type_filter IS NOT NULL AND vsc.material_type = material_hybrid_search_rpc.material_type_filter)
    ORDER BY vsc.material_type NULLS LAST -- Prioritize material-specific config
    LIMIT 1;
    
    IF config_record IS NULL THEN
        SELECT * INTO config_record FROM vector_search_config vsc_def WHERE vsc_def.name = 'default' LIMIT 1;
    END IF;

    effective_dense_weight := COALESCE(config_record.dense_weight, 0.7);
    -- text_search_weight is now explicitly in vector_search_config
    effective_text_weight := COALESCE(config_record.text_search_weight, 1.0 - effective_dense_weight); 
    
    RETURN QUERY
    SELECT * FROM search_materials_combined(
        material_hybrid_search_rpc.query_text,
        material_hybrid_search_rpc.query_dense_embedding,
        material_hybrid_search_rpc.query_sparse_embedding,
        0.1, -- Base similarity_threshold for combined search, can be made configurable
        material_hybrid_search_rpc.max_results,
        material_hybrid_search_rpc.material_type_filter,
        effective_dense_weight, -- For hybrid_similarity within search_materials_combined
        effective_text_weight,  -- For final FTS score weighting
        1.0 - effective_text_weight -- For final vector score weighting (derived)
    );
    
    IF config_record IS NOT NULL THEN
        UPDATE vector_search_config vsc_update
        SET 
            queries_count = vsc_update.queries_count + 1,
            last_updated_at = NOW()
        WHERE vsc_update.id = config_record.id;
    END IF;
END;
$$;

-- Create material category-specific materialized views for specialized indexing
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
END;
$$ LANGUAGE plpgsql;

-- Create a trigger function to update the materialized views when materials are changed
CREATE OR REPLACE FUNCTION update_material_vector_views()
RETURNS TRIGGER AS $$
BEGIN
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
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'material_vector_views_trigger') THEN
        CREATE TRIGGER material_vector_views_trigger
        AFTER INSERT OR UPDATE OR DELETE ON materials
        FOR EACH ROW EXECUTE FUNCTION update_material_vector_views();
    END IF;
END $$;

-- Create a new table for vector search configuration and performance tracking
CREATE TABLE IF NOT EXISTS vector_search_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    dense_weight FLOAT NOT NULL DEFAULT 0.7,
    text_search_weight FLOAT NOT NULL DEFAULT 0.3, -- Added for explicit weighting
    index_type TEXT NOT NULL DEFAULT 'hnsw',
    index_parameters JSONB DEFAULT '{"m": 16, "ef_construction": 64, "ef_search": 40}',
    material_type TEXT,
    model_path TEXT,
    average_query_time_ms FLOAT,
    queries_count INT DEFAULT 0,
    last_updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS vector_search_config_name_idx ON vector_search_config (name);

-- Create a table to store embedding statistics and quality metrics
CREATE TABLE IF NOT EXISTS embedding_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    material_id UUID REFERENCES materials(id) ON DELETE CASCADE, -- Added ON DELETE CASCADE
    embedding_type TEXT NOT NULL, -- 'dense', 'sparse', 'hybrid'
    model_name TEXT,
    dimensions INT,
    quality_score FLOAT,
    processing_time_ms FLOAT,
    metrics JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS embedding_metrics_material_id_idx ON embedding_metrics (material_id);
CREATE INDEX IF NOT EXISTS embedding_metrics_embedding_type_idx ON embedding_metrics (embedding_type);
CREATE INDEX IF NOT EXISTS embedding_metrics_quality_score_idx ON embedding_metrics (quality_score);

-- Insert default vector search configurations
INSERT INTO vector_search_config (name, description, dense_weight, text_search_weight, index_type, index_parameters, material_type)
VALUES 
('default', 'Default configuration for all material types', 0.7, 0.3, 'hnsw', '{"m": 16, "ef_construction": 64, "ef_search": 40}', NULL),
('tile', 'Optimized for tile materials', 0.6, 0.4, 'hnsw', '{"m": 16, "ef_construction": 64, "ef_search": 50}', 'tile'),
('stone', 'Optimized for stone materials', 0.8, 0.2, 'hnsw', '{"m": 16, "ef_construction": 64, "ef_search": 60}', 'stone'),
('wood', 'Optimized for wood materials', 0.7, 0.3, 'hnsw', '{"m": 16, "ef_construction": 96, "ef_search": 40}', 'wood')
ON CONFLICT (name) DO UPDATE SET
description = EXCLUDED.description,
dense_weight = EXCLUDED.dense_weight,
text_search_weight = EXCLUDED.text_search_weight,
index_type = EXCLUDED.index_type,
index_parameters = EXCLUDED.index_parameters,
material_type = EXCLUDED.material_type;


-- Create a view to help monitor vector search performance
CREATE OR REPLACE VIEW vector_search_performance AS
SELECT 
    config.name AS config_name,
    config.material_type,
    config.dense_weight,
    config.text_search_weight,
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
     (SELECT m.id FROM materials m WHERE m.material_type = config.material_type))
GROUP BY
    config.id, config.name, config.material_type, config.dense_weight, config.text_search_weight,
    config.index_type, config.queries_count, config.average_query_time_ms
ORDER BY
    config.queries_count DESC;