-- Migration: 008_validation_rules.sql
-- Description: Creates tables for the Advanced Property Validation feature

-- Create validation_rules table
CREATE TABLE IF NOT EXISTS public.validation_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    type VARCHAR(20) NOT NULL CHECK (type IN ('range', 'pattern', 'enum', 'dependency', 'custom', 'composite')),
    property_name VARCHAR(100) NOT NULL,
    material_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('error', 'warning', 'info')),
    message TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,

    -- Range validation fields
    min NUMERIC,
    max NUMERIC,
    step NUMERIC,
    unit VARCHAR(20),

    -- Pattern validation fields
    pattern TEXT,
    flags VARCHAR(10),

    -- Enum validation fields
    allowed_values TEXT[],

    -- Dependency validation fields
    condition JSONB,
    required_value JSONB,
    required_pattern TEXT,
    required_range JSONB,

    -- Custom validation fields
    function_name VARCHAR(100),
    parameters JSONB,

    -- Composite validation fields
    operator VARCHAR(10),
    rules TEXT[],

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Add indexes for faster querying
CREATE INDEX IF NOT EXISTS idx_validation_rules_property_name ON public.validation_rules(property_name);
CREATE INDEX IF NOT EXISTS idx_validation_rules_material_type ON public.validation_rules(material_type);
CREATE INDEX IF NOT EXISTS idx_validation_rules_type ON public.validation_rules(type);

-- Create validation_rule_dependencies table to track relationships between composite rules and their components
CREATE TABLE IF NOT EXISTS public.validation_rule_dependencies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_rule_id UUID NOT NULL REFERENCES public.validation_rules(id) ON DELETE CASCADE,
    child_rule_id UUID NOT NULL REFERENCES public.validation_rules(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(parent_rule_id, child_rule_id)
);

-- Add indexes for faster querying
CREATE INDEX IF NOT EXISTS idx_validation_rule_dependencies_parent ON public.validation_rule_dependencies(parent_rule_id);
CREATE INDEX IF NOT EXISTS idx_validation_rule_dependencies_child ON public.validation_rule_dependencies(child_rule_id);

-- Create validation_results table to track validation results (optional, for analytics)
CREATE TABLE IF NOT EXISTS public.validation_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_id UUID REFERENCES public.validation_rules(id) ON DELETE SET NULL,
    property_name VARCHAR(100) NOT NULL,
    material_type VARCHAR(100) NOT NULL,
    value TEXT,
    is_valid BOOLEAN NOT NULL,
    message TEXT,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add indexes for faster querying
CREATE INDEX IF NOT EXISTS idx_validation_results_rule_id ON public.validation_results(rule_id);
CREATE INDEX IF NOT EXISTS idx_validation_results_property_name ON public.validation_results(property_name);
CREATE INDEX IF NOT EXISTS idx_validation_results_material_type ON public.validation_results(material_type);
CREATE INDEX IF NOT EXISTS idx_validation_results_is_valid ON public.validation_results(is_valid);

-- Grant access to authenticated users
GRANT SELECT ON public.validation_rules TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.validation_results TO authenticated;

-- Add server-side function to clean up old validation results (for admin use)
CREATE OR REPLACE FUNCTION cleanup_old_validation_results(days_to_keep INTEGER)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.validation_results
    WHERE created_at < (NOW() - (days_to_keep || ' days')::INTERVAL)
    RETURNING COUNT(*) INTO deleted_count;

    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments for documentation
COMMENT ON TABLE public.validation_rules IS 'Stores validation rules for material properties';
COMMENT ON TABLE public.validation_rule_dependencies IS 'Tracks relationships between composite validation rules and their components';
COMMENT ON TABLE public.validation_results IS 'Stores validation results for analytics purposes';

-- Add this migration to the migrations table
INSERT INTO public.migrations (name, applied_at)
VALUES ('008_validation_rules.sql', NOW())
ON CONFLICT (name) DO NOTHING;
