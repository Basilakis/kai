-- Migration for Enhanced Material Classification

-- Classification Systems Table
CREATE TABLE IF NOT EXISTS public.classification_systems (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    version VARCHAR(50),
    is_hierarchical BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Add indexes for faster querying
CREATE INDEX IF NOT EXISTS idx_classification_systems_code ON public.classification_systems(code);

-- Classification Categories Table
CREATE TABLE IF NOT EXISTS public.classification_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    system_id UUID NOT NULL REFERENCES public.classification_systems(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES public.classification_categories(id) ON DELETE CASCADE,
    code VARCHAR(100) NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    level INTEGER NOT NULL,
    path TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    UNIQUE(system_id, code)
);

-- Add indexes for faster querying
CREATE INDEX IF NOT EXISTS idx_classification_categories_system_id ON public.classification_categories(system_id);
CREATE INDEX IF NOT EXISTS idx_classification_categories_parent_id ON public.classification_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_classification_categories_path ON public.classification_categories(path);
CREATE INDEX IF NOT EXISTS idx_classification_categories_level ON public.classification_categories(level);

-- Material Classifications Table
CREATE TABLE IF NOT EXISTS public.material_classifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES public.classification_categories(id) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT false,
    confidence FLOAT,
    source VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    UNIQUE(material_id, category_id)
);

-- Add indexes for faster querying
CREATE INDEX IF NOT EXISTS idx_material_classifications_material_id ON public.material_classifications(material_id);
CREATE INDEX IF NOT EXISTS idx_material_classifications_category_id ON public.material_classifications(category_id);
CREATE INDEX IF NOT EXISTS idx_material_classifications_is_primary ON public.material_classifications(is_primary);

-- Classification Mappings Table
CREATE TABLE IF NOT EXISTS public.classification_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_category_id UUID NOT NULL REFERENCES public.classification_categories(id) ON DELETE CASCADE,
    target_category_id UUID NOT NULL REFERENCES public.classification_categories(id) ON DELETE CASCADE,
    mapping_type VARCHAR(50) NOT NULL, -- 'exact', 'broader', 'narrower', 'related'
    confidence FLOAT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    UNIQUE(source_category_id, target_category_id)
);

-- Add indexes for faster querying
CREATE INDEX IF NOT EXISTS idx_classification_mappings_source_category_id ON public.classification_mappings(source_category_id);
CREATE INDEX IF NOT EXISTS idx_classification_mappings_target_category_id ON public.classification_mappings(target_category_id);
CREATE INDEX IF NOT EXISTS idx_classification_mappings_mapping_type ON public.classification_mappings(mapping_type);

-- Create RLS policies for the classification_systems table
ALTER TABLE public.classification_systems ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Classification systems are viewable by everyone"
  ON public.classification_systems FOR SELECT
  USING (true);

CREATE POLICY "Classification systems can be inserted by authenticated users"
  ON public.classification_systems FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Classification systems can be updated by authenticated users"
  ON public.classification_systems FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Create RLS policies for the classification_categories table
ALTER TABLE public.classification_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Classification categories are viewable by everyone"
  ON public.classification_categories FOR SELECT
  USING (true);

CREATE POLICY "Classification categories can be inserted by authenticated users"
  ON public.classification_categories FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Classification categories can be updated by authenticated users"
  ON public.classification_categories FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Create RLS policies for the material_classifications table
ALTER TABLE public.material_classifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Material classifications are viewable by everyone"
  ON public.material_classifications FOR SELECT
  USING (true);

CREATE POLICY "Material classifications can be inserted by authenticated users"
  ON public.material_classifications FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Material classifications can be updated by authenticated users"
  ON public.material_classifications FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Create RLS policies for the classification_mappings table
ALTER TABLE public.classification_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Classification mappings are viewable by everyone"
  ON public.classification_mappings FOR SELECT
  USING (true);

CREATE POLICY "Classification mappings can be inserted by authenticated users"
  ON public.classification_mappings FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Classification mappings can be updated by authenticated users"
  ON public.classification_mappings FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Insert some common classification systems
INSERT INTO public.classification_systems (name, code, description, version, is_hierarchical, is_active)
VALUES
    ('CSI MasterFormat', 'CSI_MASTERFORMAT', 'Construction Specifications Institute MasterFormat', '2020', true, true),
    ('Uniclass 2015', 'UNICLASS_2015', 'Unified classification for the construction industry', '2015', true, true),
    ('OmniClass', 'OMNICLASS', 'OmniClass Construction Classification System', '2.0', true, true),
    ('ASTM Standard', 'ASTM', 'American Society for Testing and Materials Standards', '2023', false, true),
    ('ISO Classification', 'ISO', 'International Organization for Standardization', '2023', true, true)
ON CONFLICT (code) DO NOTHING;
