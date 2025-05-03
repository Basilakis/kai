-- Migration for Multilingual Property Dictionaries

-- Language Codes Table
CREATE TABLE IF NOT EXISTS public.language_codes (
    code VARCHAR(10) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    native_name VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insert common language codes
INSERT INTO public.language_codes (code, name, native_name)
VALUES
    ('en', 'English', 'English'),
    ('es', 'Spanish', 'Español'),
    ('fr', 'French', 'Français'),
    ('de', 'German', 'Deutsch'),
    ('it', 'Italian', 'Italiano'),
    ('pt', 'Portuguese', 'Português'),
    ('zh', 'Chinese', '中文'),
    ('ja', 'Japanese', '日本語'),
    ('ko', 'Korean', '한국어'),
    ('ru', 'Russian', 'Русский'),
    ('ar', 'Arabic', 'العربية')
ON CONFLICT (code) DO NOTHING;

-- Property Name Translations Table
CREATE TABLE IF NOT EXISTS public.property_name_translations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_name VARCHAR(100) NOT NULL,
    language_code VARCHAR(10) REFERENCES public.language_codes(code) ON DELETE CASCADE,
    translation VARCHAR(200) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    UNIQUE(property_name, language_code)
);

-- Add indexes for faster querying
CREATE INDEX IF NOT EXISTS idx_property_name_translations_property_name ON public.property_name_translations(property_name);
CREATE INDEX IF NOT EXISTS idx_property_name_translations_language_code ON public.property_name_translations(language_code);

-- Property Value Translations Table
CREATE TABLE IF NOT EXISTS public.property_value_translations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_name VARCHAR(100) NOT NULL,
    property_value VARCHAR(100) NOT NULL,
    language_code VARCHAR(10) REFERENCES public.language_codes(code) ON DELETE CASCADE,
    translation VARCHAR(200) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    UNIQUE(property_name, property_value, language_code)
);

-- Add indexes for faster querying
CREATE INDEX IF NOT EXISTS idx_property_value_translations_property_name ON public.property_value_translations(property_name);
CREATE INDEX IF NOT EXISTS idx_property_value_translations_property_value ON public.property_value_translations(property_value);
CREATE INDEX IF NOT EXISTS idx_property_value_translations_language_code ON public.property_value_translations(language_code);

-- Create RLS policies for the language_codes table
ALTER TABLE public.language_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Language codes are viewable by everyone"
  ON public.language_codes FOR SELECT
  USING (true);

CREATE POLICY "Language codes can be inserted by authenticated users"
  ON public.language_codes FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Language codes can be updated by authenticated users"
  ON public.language_codes FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Create RLS policies for the property_name_translations table
ALTER TABLE public.property_name_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Property name translations are viewable by everyone"
  ON public.property_name_translations FOR SELECT
  USING (true);

CREATE POLICY "Property name translations can be inserted by authenticated users"
  ON public.property_name_translations FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Property name translations can be updated by authenticated users"
  ON public.property_name_translations FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Property name translations can be deleted by authenticated users"
  ON public.property_name_translations FOR DELETE
  USING (auth.role() = 'authenticated');

-- Create RLS policies for the property_value_translations table
ALTER TABLE public.property_value_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Property value translations are viewable by everyone"
  ON public.property_value_translations FOR SELECT
  USING (true);

CREATE POLICY "Property value translations can be inserted by authenticated users"
  ON public.property_value_translations FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Property value translations can be updated by authenticated users"
  ON public.property_value_translations FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Property value translations can be deleted by authenticated users"
  ON public.property_value_translations FOR DELETE
  USING (auth.role() = 'authenticated');
