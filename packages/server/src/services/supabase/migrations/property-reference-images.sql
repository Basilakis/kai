-- Migration for Property Reference Images

-- Create a table for property reference images
CREATE TABLE IF NOT EXISTS public.property_reference_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_name TEXT NOT NULL,
    property_value TEXT NOT NULL,
    material_type TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    filename TEXT NOT NULL,
    file_size INTEGER,
    width INTEGER,
    height INTEGER,
    format TEXT,
    description TEXT,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Add indexes for faster querying
CREATE INDEX IF NOT EXISTS idx_property_reference_images_property_name ON public.property_reference_images(property_name);
CREATE INDEX IF NOT EXISTS idx_property_reference_images_property_value ON public.property_reference_images(property_value);
CREATE INDEX IF NOT EXISTS idx_property_reference_images_material_type ON public.property_reference_images(material_type);
CREATE INDEX IF NOT EXISTS idx_property_reference_images_is_primary ON public.property_reference_images(is_primary);

-- Create a storage policy for property reference images
INSERT INTO storage.buckets (id, name, public, avif_autodetection)
VALUES ('property-references', 'Property Reference Images', true, true)
ON CONFLICT (id) DO NOTHING;

-- Set up security policies for the bucket
CREATE POLICY "Property reference images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'property-references')
ON CONFLICT DO NOTHING;

CREATE POLICY "Property reference images can be uploaded by authenticated users"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'property-references' AND auth.role() = 'authenticated')
ON CONFLICT DO NOTHING;

CREATE POLICY "Property reference images can be updated by authenticated users"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'property-references' AND auth.role() = 'authenticated')
ON CONFLICT DO NOTHING;

-- Create RLS policies for the property_reference_images table
ALTER TABLE public.property_reference_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Property reference images are viewable by everyone"
  ON public.property_reference_images FOR SELECT
  USING (true);

CREATE POLICY "Property reference images can be inserted by authenticated users"
  ON public.property_reference_images FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Property reference images can be updated by authenticated users"
  ON public.property_reference_images FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Property reference images can be deleted by authenticated users"
  ON public.property_reference_images FOR DELETE
  USING (auth.role() = 'authenticated');
