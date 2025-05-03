-- Validation Rules Tables

-- Create validation_rules table if it doesn't exist
CREATE TABLE IF NOT EXISTS validation_rules (
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

-- Add indexes for faster querying if they don't exist
CREATE INDEX IF NOT EXISTS idx_validation_rules_property_name ON validation_rules(property_name);
CREATE INDEX IF NOT EXISTS idx_validation_rules_material_type ON validation_rules(material_type);
CREATE INDEX IF NOT EXISTS idx_validation_rules_type ON validation_rules(type);

-- Create validation_rule_dependencies table to track relationships between composite rules and their components
CREATE TABLE IF NOT EXISTS validation_rule_dependencies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_rule_id UUID NOT NULL REFERENCES validation_rules(id) ON DELETE CASCADE,
    child_rule_id UUID NOT NULL REFERENCES validation_rules(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(parent_rule_id, child_rule_id)
);

-- Add indexes for faster querying if they don't exist
CREATE INDEX IF NOT EXISTS idx_validation_rule_dependencies_parent ON validation_rule_dependencies(parent_rule_id);
CREATE INDEX IF NOT EXISTS idx_validation_rule_dependencies_child ON validation_rule_dependencies(child_rule_id);

-- Create validation_results table to track validation results (optional, for analytics)
CREATE TABLE IF NOT EXISTS validation_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_id UUID REFERENCES validation_rules(id) ON DELETE SET NULL,
    property_name VARCHAR(100) NOT NULL,
    material_type VARCHAR(100) NOT NULL,
    value TEXT,
    is_valid BOOLEAN NOT NULL,
    message TEXT,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add indexes for faster querying if they don't exist
CREATE INDEX IF NOT EXISTS idx_validation_results_rule_id ON validation_results(rule_id);
CREATE INDEX IF NOT EXISTS idx_validation_results_property_name ON validation_results(property_name);
CREATE INDEX IF NOT EXISTS idx_validation_results_material_type ON validation_results(material_type);
CREATE INDEX IF NOT EXISTS idx_validation_results_is_valid ON validation_results(is_valid);
