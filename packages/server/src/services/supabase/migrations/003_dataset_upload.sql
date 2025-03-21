-- Migration for Dataset Upload Feature
-- This migration adds the necessary tables and storage configuration for dataset management

-- Create a datasets table to track uploaded datasets
CREATE TABLE IF NOT EXISTS public.datasets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    status TEXT DEFAULT 'created' CHECK (status IN ('created', 'processing', 'ready', 'error')),
    class_count INTEGER DEFAULT 0,
    image_count INTEGER DEFAULT 0,
    metadata JSONB
);

-- Create a dataset_classes table for organizing images into classes
CREATE TABLE IF NOT EXISTS public.dataset_classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dataset_id UUID REFERENCES public.datasets(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    image_count INTEGER DEFAULT 0,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create a dataset_images table for tracking individual images
CREATE TABLE IF NOT EXISTS public.dataset_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dataset_id UUID REFERENCES public.datasets(id) ON DELETE CASCADE NOT NULL,
    class_id UUID REFERENCES public.dataset_classes(id) ON DELETE CASCADE NOT NULL,
    storage_path TEXT NOT NULL,
    filename TEXT NOT NULL,
    file_size INTEGER,
    width INTEGER,
    height INTEGER,
    format TEXT,
    material_id UUID REFERENCES public.materials(id) ON DELETE SET NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add indexes for faster querying
CREATE INDEX IF NOT EXISTS idx_dataset_classes_dataset_id ON public.dataset_classes(dataset_id);
CREATE INDEX IF NOT EXISTS idx_dataset_images_dataset_id ON public.dataset_images(dataset_id);
CREATE INDEX IF NOT EXISTS idx_dataset_images_class_id ON public.dataset_images(class_id);
CREATE INDEX IF NOT EXISTS idx_dataset_images_material_id ON public.dataset_images(material_id);

-- Add index for text search on datasets
CREATE INDEX IF NOT EXISTS idx_datasets_name_description ON public.datasets USING GIN (
    to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, ''))
);

-- Set up RLS policies for the dataset tables
ALTER TABLE public.datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dataset_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dataset_images ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for datasets
CREATE POLICY "Allow admin full access to datasets" ON public.datasets
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow admin full access to dataset_classes" ON public.dataset_classes
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow admin full access to dataset_images" ON public.dataset_images
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- Create a storage bucket for datasets
INSERT INTO storage.buckets (id, name, public, avif_autodetection)
VALUES ('datasets', 'datasets', FALSE, FALSE)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies for the datasets bucket
CREATE POLICY "Allow authenticated access to datasets bucket" ON storage.objects
    FOR ALL 
    USING (bucket_id = 'datasets' AND auth.role() = 'authenticated')
    WITH CHECK (bucket_id = 'datasets' AND auth.role() = 'authenticated');