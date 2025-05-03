-- Migration for Property Relationship Graph

-- Property Relationships Table
CREATE TABLE IF NOT EXISTS public.property_relationships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_property TEXT NOT NULL,
    target_property TEXT NOT NULL,
    relationship_type TEXT NOT NULL,
    material_type TEXT NOT NULL,
    strength FLOAT NOT NULL DEFAULT 1.0,
    bidirectional BOOLEAN NOT NULL DEFAULT false,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    UNIQUE(source_property, target_property, relationship_type, material_type)
);

-- Add indexes for faster querying
CREATE INDEX IF NOT EXISTS idx_property_relationships_source_property ON public.property_relationships(source_property);
CREATE INDEX IF NOT EXISTS idx_property_relationships_target_property ON public.property_relationships(target_property);
CREATE INDEX IF NOT EXISTS idx_property_relationships_material_type ON public.property_relationships(material_type);
CREATE INDEX IF NOT EXISTS idx_property_relationships_relationship_type ON public.property_relationships(relationship_type);

-- Property Value Correlations Table
CREATE TABLE IF NOT EXISTS public.property_value_correlations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    relationship_id UUID REFERENCES public.property_relationships(id) ON DELETE CASCADE,
    source_value TEXT NOT NULL,
    target_value TEXT NOT NULL,
    correlation_strength FLOAT NOT NULL DEFAULT 0.0,
    sample_size INTEGER NOT NULL DEFAULT 0,
    confidence_interval FLOAT NOT NULL DEFAULT 0.0,
    is_statistical BOOLEAN NOT NULL DEFAULT true,
    is_manual BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add indexes for faster querying
CREATE INDEX IF NOT EXISTS idx_property_value_correlations_relationship_id ON public.property_value_correlations(relationship_id);
CREATE INDEX IF NOT EXISTS idx_property_value_correlations_source_value ON public.property_value_correlations(source_value);
CREATE INDEX IF NOT EXISTS idx_property_value_correlations_target_value ON public.property_value_correlations(target_value);

-- Property Compatibility Rules Table
CREATE TABLE IF NOT EXISTS public.property_compatibility_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    relationship_id UUID REFERENCES public.property_relationships(id) ON DELETE CASCADE,
    source_value TEXT NOT NULL,
    target_value TEXT NOT NULL,
    compatibility_type TEXT NOT NULL, -- 'compatible', 'recommended', 'not_recommended', 'incompatible'
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Add indexes for faster querying
CREATE INDEX IF NOT EXISTS idx_property_compatibility_rules_relationship_id ON public.property_compatibility_rules(relationship_id);
CREATE INDEX IF NOT EXISTS idx_property_compatibility_rules_source_value ON public.property_compatibility_rules(source_value);
CREATE INDEX IF NOT EXISTS idx_property_compatibility_rules_target_value ON public.property_compatibility_rules(target_value);
CREATE INDEX IF NOT EXISTS idx_property_compatibility_rules_compatibility_type ON public.property_compatibility_rules(compatibility_type);

-- Create RLS policies for the property_relationships table
ALTER TABLE public.property_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Property relationships are viewable by everyone"
  ON public.property_relationships FOR SELECT
  USING (true);

CREATE POLICY "Property relationships can be inserted by authenticated users"
  ON public.property_relationships FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Property relationships can be updated by authenticated users"
  ON public.property_relationships FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Property relationships can be deleted by authenticated users"
  ON public.property_relationships FOR DELETE
  USING (auth.role() = 'authenticated');

-- Create RLS policies for the property_value_correlations table
ALTER TABLE public.property_value_correlations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Property value correlations are viewable by everyone"
  ON public.property_value_correlations FOR SELECT
  USING (true);

CREATE POLICY "Property value correlations can be inserted by authenticated users"
  ON public.property_value_correlations FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Property value correlations can be updated by authenticated users"
  ON public.property_value_correlations FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Property value correlations can be deleted by authenticated users"
  ON public.property_value_correlations FOR DELETE
  USING (auth.role() = 'authenticated');

-- Create RLS policies for the property_compatibility_rules table
ALTER TABLE public.property_compatibility_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Property compatibility rules are viewable by everyone"
  ON public.property_compatibility_rules FOR SELECT
  USING (true);

CREATE POLICY "Property compatibility rules can be inserted by authenticated users"
  ON public.property_compatibility_rules FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Property compatibility rules can be updated by authenticated users"
  ON public.property_compatibility_rules FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Property compatibility rules can be deleted by authenticated users"
  ON public.property_compatibility_rules FOR DELETE
  USING (auth.role() = 'authenticated');
