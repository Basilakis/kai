-- Migration: Add Hybrid Search Functionality
-- This migration adds the PostgreSQL function needed for hybrid search,
-- combining vector similarity and full-text search capabilities.

-- Create hybrid search function
CREATE OR REPLACE FUNCTION hybrid_search(
  query_text TEXT,
  query_embedding VECTOR,
  table_name TEXT,
  text_columns TEXT[] DEFAULT ARRAY['name', 'description'],
  vector_column TEXT DEFAULT 'embedding',
  text_weight FLOAT DEFAULT 0.5,
  vector_weight FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 10,
  score_threshold FLOAT DEFAULT 0.3,
  filter_obj JSONB DEFAULT '{}'
) RETURNS TABLE (
  id UUID,
  text_score FLOAT,
  vector_score FLOAT,
  combined_score FLOAT
) LANGUAGE plpgsql AS $$
DECLARE
  search_query TEXT;
  column_list TEXT;
  filter_conditions TEXT;
  query_sql TEXT;
BEGIN
  -- Prepare the text search query
  search_query := websearch_to_tsquery('english', query_text);
  
  -- Prepare column list for selecting
  column_list := 'id';
  
  -- Prepare filter conditions if any
  IF jsonb_typeof(filter_obj) = 'object' AND jsonb_object_keys(filter_obj) > 0 THEN
    filter_conditions := ' WHERE ';
    FOR key_value IN SELECT * FROM jsonb_each_text(filter_obj) LOOP
      filter_conditions := filter_conditions || format('%I = %L AND ', key_value.key, key_value.value);
    END LOOP;
    filter_conditions := substring(filter_conditions, 1, length(filter_conditions) - 5);
  ELSE
    filter_conditions := '';
  END IF;
  
  -- Build and execute the hybrid search query
  query_sql := format('
    WITH text_search AS (
      SELECT
        id,
        CASE WHEN %L = '''' THEN 0
        ELSE ts_rank(to_tsvector(''english'', %s), websearch_to_tsquery(''english'', %L))
        END AS text_score
      FROM %I
      %s
      ' || CASE WHEN length(query_text) > 0 THEN '
      AND to_tsvector(''english'', %s) @@ websearch_to_tsquery(''english'', %L)
      ' ELSE '' END || '
    ),
    vector_search AS (
      SELECT
        id,
        CASE WHEN %I IS NULL THEN 0
        ELSE 1 - (%I <=> %L::vector)
        END AS vector_score
      FROM %I
      %s
    ),
    combined_results AS (
      SELECT
        COALESCE(t.id, v.id) AS id,
        COALESCE(t.text_score, 0) AS text_score,
        COALESCE(v.vector_score, 0) AS vector_score,
        (COALESCE(t.text_score, 0) * %L) + (COALESCE(v.vector_score, 0) * %L) AS combined_score
      FROM text_search t
      FULL OUTER JOIN vector_search v ON t.id = v.id
      WHERE (t.id IS NOT NULL OR v.id IS NOT NULL)
    )
    SELECT
      id,
      text_score,
      vector_score,
      combined_score
    FROM combined_results
    WHERE combined_score >= %L
    ORDER BY combined_score DESC
    LIMIT %L',
    query_text,
    array_to_string(array(SELECT format('%I', col) FROM unnest(text_columns) AS col), ' || '' '' || '),
    query_text,
    table_name,
    filter_conditions,
    array_to_string(array(SELECT format('%I', col) FROM unnest(text_columns) AS col), ' || '' '' || '),
    query_text,
    vector_column,
    vector_column,
    query_embedding,
    table_name,
    filter_conditions,
    text_weight,
    vector_weight,
    score_threshold,
    match_count
  );
  
  -- Execute the dynamic SQL
  RETURN QUERY EXECUTE query_sql;
END;
$$;

-- Create a helper function to initialize a hybrid search on materials
CREATE OR REPLACE FUNCTION hybrid_search_materials(
  query_text TEXT,
  query_embedding VECTOR,
  text_weight FLOAT DEFAULT 0.5,
  vector_weight FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 10,
  material_type TEXT DEFAULT NULL
) RETURNS TABLE (
  id UUID,
  name TEXT,
  material_type TEXT,
  text_score FLOAT,
  vector_score FLOAT,
  combined_score FLOAT
) LANGUAGE plpgsql AS $$
DECLARE
  filter_obj JSONB := '{}';
BEGIN
  -- Add material type filter if provided
  IF material_type IS NOT NULL THEN
    filter_obj := jsonb_build_object('material_type', material_type);
  END IF;

  RETURN QUERY
  SELECT
    m.id,
    m.name,
    m.material_type,
    h.text_score,
    h.vector_score,
    h.combined_score
  FROM
    hybrid_search(
      query_text,
      query_embedding,
      'materials',
      ARRAY['name', 'description', 'manufacturer', 'array_to_string(tags, '' '')'],
      'embedding',
      text_weight,
      vector_weight,
      match_count,
      0.1,
      filter_obj
    ) h
  JOIN
    materials m ON h.id = m.id
  ORDER BY
    h.combined_score DESC;
END;
$$;

-- Add comment explaining the functions
COMMENT ON FUNCTION hybrid_search IS 'Generic hybrid search function combining full-text search and vector similarity';
COMMENT ON FUNCTION hybrid_search_materials IS 'Specialized hybrid search for materials table';