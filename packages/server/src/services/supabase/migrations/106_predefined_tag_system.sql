-- Migration: 106_predefined_tag_system.sql
-- Description: Creates tables and functions for predefined tag management system
-- This migration supports the NLP-based tag matching feature for PDF processing

-- Create predefined_tag_categories table
CREATE TABLE IF NOT EXISTS predefined_tag_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create predefined_tags table
CREATE TABLE IF NOT EXISTS predefined_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES predefined_tag_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL, -- Lowercase, trimmed version for matching
  synonyms TEXT[] DEFAULT '{}', -- Array of alternative names/spellings
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  confidence_threshold FLOAT DEFAULT 0.7, -- Minimum confidence for NLP matching
  usage_count INTEGER DEFAULT 0, -- Track how often this tag is used
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Ensure unique tags within each category
  UNIQUE(category_id, normalized_name)
);

-- Create tag_matching_logs table for tracking NLP matching decisions
CREATE TABLE IF NOT EXISTS tag_matching_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID, -- References materials table (may not exist yet)
  extracted_text TEXT NOT NULL,
  matched_tag_id UUID REFERENCES predefined_tags(id),
  confidence_score FLOAT,
  matching_method TEXT DEFAULT 'nlp', -- 'exact', 'fuzzy', 'synonym', 'nlp'
  category_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_predefined_tags_category_id ON predefined_tags(category_id);
CREATE INDEX IF NOT EXISTS idx_predefined_tags_normalized_name ON predefined_tags(normalized_name);
CREATE INDEX IF NOT EXISTS idx_predefined_tags_active ON predefined_tags(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_predefined_tag_categories_active ON predefined_tag_categories(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_tag_matching_logs_material_id ON tag_matching_logs(material_id);
CREATE INDEX IF NOT EXISTS idx_tag_matching_logs_created_at ON tag_matching_logs(created_at);

-- Create GIN index for synonym array searches
CREATE INDEX IF NOT EXISTS idx_predefined_tags_synonyms_gin ON predefined_tags USING GIN(synonyms);

-- Insert default tag categories
INSERT INTO predefined_tag_categories (name, description, sort_order) VALUES
  ('colors', 'Color-related tags for materials', 1),
  ('material_types', 'Types and categories of materials', 2),
  ('finishes', 'Surface finishes and textures', 3),
  ('collections', 'Product collections and series', 4),
  ('technical_specs', 'Technical specifications and properties', 5)
ON CONFLICT (name) DO NOTHING;

-- Function to normalize tag names for consistent matching
CREATE OR REPLACE FUNCTION normalize_tag_name(tag_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Convert to lowercase, trim whitespace, and remove extra spaces
  RETURN TRIM(REGEXP_REPLACE(LOWER(tag_name), '\s+', ' ', 'g'));
END;
$$;

-- Function to find matching tags using fuzzy string matching
CREATE OR REPLACE FUNCTION find_matching_tags(
  extracted_text TEXT,
  category_name TEXT,
  min_confidence FLOAT DEFAULT 0.7
)
RETURNS TABLE (
  tag_id UUID,
  tag_name TEXT,
  confidence_score FLOAT,
  matching_method TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  normalized_text TEXT;
  category_id_var UUID;
BEGIN
  -- Normalize the extracted text
  normalized_text := normalize_tag_name(extracted_text);
  
  -- Get category ID
  SELECT id INTO category_id_var 
  FROM predefined_tag_categories 
  WHERE name = category_name AND is_active = true;
  
  IF category_id_var IS NULL THEN
    RETURN;
  END IF;
  
  -- 1. Exact match on normalized name
  RETURN QUERY
  SELECT 
    pt.id,
    pt.name,
    1.0::FLOAT as confidence_score,
    'exact'::TEXT as matching_method
  FROM predefined_tags pt
  WHERE pt.category_id = category_id_var 
    AND pt.is_active = true
    AND pt.normalized_name = normalized_text;
  
  -- If exact match found, return early
  IF FOUND THEN
    RETURN;
  END IF;
  
  -- 2. Synonym match
  RETURN QUERY
  SELECT 
    pt.id,
    pt.name,
    0.95::FLOAT as confidence_score,
    'synonym'::TEXT as matching_method
  FROM predefined_tags pt
  WHERE pt.category_id = category_id_var 
    AND pt.is_active = true
    AND normalized_text = ANY(
      SELECT normalize_tag_name(unnest(pt.synonyms))
    );
  
  -- If synonym match found, return early
  IF FOUND THEN
    RETURN;
  END IF;
  
  -- 3. Fuzzy match using similarity (requires pg_trgm extension)
  -- Note: This requires the pg_trgm extension to be enabled
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    RETURN QUERY
    SELECT 
      pt.id,
      pt.name,
      SIMILARITY(normalized_text, pt.normalized_name)::FLOAT as confidence_score,
      'fuzzy'::TEXT as matching_method
    FROM predefined_tags pt
    WHERE pt.category_id = category_id_var 
      AND pt.is_active = true
      AND SIMILARITY(normalized_text, pt.normalized_name) >= min_confidence
    ORDER BY SIMILARITY(normalized_text, pt.normalized_name) DESC
    LIMIT 1;
  END IF;
  
  RETURN;
END;
$$;

-- Function to log tag matching decisions
CREATE OR REPLACE FUNCTION log_tag_matching(
  p_material_id UUID,
  p_extracted_text TEXT,
  p_matched_tag_id UUID,
  p_confidence_score FLOAT,
  p_matching_method TEXT,
  p_category_name TEXT
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO tag_matching_logs (
    material_id,
    extracted_text,
    matched_tag_id,
    confidence_score,
    matching_method,
    category_name
  ) VALUES (
    p_material_id,
    p_extracted_text,
    p_matched_tag_id,
    p_confidence_score,
    p_matching_method,
    p_category_name
  ) RETURNING id INTO log_id;
  
  -- Update usage count for the matched tag
  IF p_matched_tag_id IS NOT NULL THEN
    UPDATE predefined_tags 
    SET usage_count = usage_count + 1,
        updated_at = NOW()
    WHERE id = p_matched_tag_id;
  END IF;
  
  RETURN log_id;
END;
$$;

-- Function to get tags by category
CREATE OR REPLACE FUNCTION get_tags_by_category(category_name TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  normalized_name TEXT,
  synonyms TEXT[],
  description TEXT,
  confidence_threshold FLOAT,
  usage_count INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pt.id,
    pt.name,
    pt.normalized_name,
    pt.synonyms,
    pt.description,
    pt.confidence_threshold,
    pt.usage_count
  FROM predefined_tags pt
  JOIN predefined_tag_categories ptc ON pt.category_id = ptc.id
  WHERE ptc.name = category_name 
    AND pt.is_active = true 
    AND ptc.is_active = true
  ORDER BY pt.usage_count DESC, pt.name ASC;
END;
$$;

-- Trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Apply the trigger to relevant tables
DROP TRIGGER IF EXISTS update_predefined_tag_categories_updated_at ON predefined_tag_categories;
CREATE TRIGGER update_predefined_tag_categories_updated_at
  BEFORE UPDATE ON predefined_tag_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_predefined_tags_updated_at ON predefined_tags;
CREATE TRIGGER update_predefined_tags_updated_at
  BEFORE UPDATE ON predefined_tags
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger to automatically normalize tag names on insert/update
CREATE OR REPLACE FUNCTION normalize_tag_name_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.normalized_name = normalize_tag_name(NEW.name);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_predefined_tags_name ON predefined_tags;
CREATE TRIGGER normalize_predefined_tags_name
  BEFORE INSERT OR UPDATE ON predefined_tags
  FOR EACH ROW
  EXECUTE FUNCTION normalize_tag_name_trigger();

-- Enable Row Level Security (RLS)
ALTER TABLE predefined_tag_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE predefined_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE tag_matching_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for predefined_tag_categories
CREATE POLICY "Allow read access to active tag categories" ON predefined_tag_categories
  FOR SELECT USING (is_active = true);

CREATE POLICY "Allow admin full access to tag categories" ON predefined_tag_categories
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- RLS Policies for predefined_tags
CREATE POLICY "Allow read access to active tags" ON predefined_tags
  FOR SELECT USING (is_active = true);

CREATE POLICY "Allow admin full access to tags" ON predefined_tags
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- RLS Policies for tag_matching_logs
CREATE POLICY "Allow read access to tag matching logs" ON tag_matching_logs
  FOR SELECT USING (true);

CREATE POLICY "Allow insert to tag matching logs" ON tag_matching_logs
  FOR INSERT WITH CHECK (true);

-- Comments for documentation
COMMENT ON TABLE predefined_tag_categories IS 'Categories for organizing predefined tags (colors, materials, finishes, etc.)';
COMMENT ON TABLE predefined_tags IS 'Predefined tags with synonyms for NLP-based matching during PDF processing';
COMMENT ON TABLE tag_matching_logs IS 'Logs of tag matching decisions for analytics and debugging';

COMMENT ON FUNCTION find_matching_tags(TEXT, TEXT, FLOAT) IS 'Finds matching predefined tags using exact, synonym, and fuzzy matching';
COMMENT ON FUNCTION log_tag_matching(UUID, TEXT, UUID, FLOAT, TEXT, TEXT) IS 'Logs tag matching decisions and updates usage statistics';
COMMENT ON FUNCTION get_tags_by_category(TEXT) IS 'Retrieves all active tags for a specific category';
COMMENT ON FUNCTION normalize_tag_name(TEXT) IS 'Normalizes tag names for consistent matching';

-- Add this migration to the migrations table
INSERT INTO public.migrations (name, applied_at)
VALUES ('106_predefined_tag_system.sql', NOW())
ON CONFLICT (name) DO NOTHING;