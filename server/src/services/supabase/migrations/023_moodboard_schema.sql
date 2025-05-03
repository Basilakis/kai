-- Migration: 023_moodboard_schema.sql
-- Description: Creates tables and policies for the MoodBoard feature

-- Create MoodBoards table
CREATE TABLE IF NOT EXISTS public.moodboards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_public BOOLEAN NOT NULL DEFAULT false,
  view_preference TEXT NOT NULL DEFAULT 'grid',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create MoodBoardItems table
CREATE TABLE IF NOT EXISTS public.moodboard_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  board_id UUID NOT NULL REFERENCES public.moodboards(id) ON DELETE CASCADE,
  material_id TEXT NOT NULL,
  notes TEXT,
  position INTEGER DEFAULT 0,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_moodboards_user_id ON public.moodboards(user_id);
CREATE INDEX IF NOT EXISTS idx_moodboard_items_board_id ON public.moodboard_items(board_id);
CREATE INDEX IF NOT EXISTS idx_moodboard_items_material_id ON public.moodboard_items(material_id);

-- Set up Row Level Security (RLS)
ALTER TABLE public.moodboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moodboard_items ENABLE ROW LEVEL SECURITY;

-- Policies for MoodBoards
-- Users can view their own boards
CREATE POLICY "Users can view their own boards"
  ON public.moodboards
  FOR SELECT
  USING (user_id = auth.uid());

-- Users can view public boards
CREATE POLICY "Users can view public boards"
  ON public.moodboards
  FOR SELECT
  USING (is_public = true);

-- Users can create their own boards
CREATE POLICY "Users can create their own boards"
  ON public.moodboards
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own boards
CREATE POLICY "Users can update their own boards"
  ON public.moodboards
  FOR UPDATE
  USING (user_id = auth.uid());

-- Users can delete their own boards
CREATE POLICY "Users can delete their own boards"
  ON public.moodboards
  FOR DELETE
  USING (user_id = auth.uid());

-- Policies for MoodBoardItems
-- Users can view items in their own boards
CREATE POLICY "Users can view items in their own boards"
  ON public.moodboard_items
  FOR SELECT
  USING (board_id IN (SELECT id FROM public.moodboards WHERE user_id = auth.uid()));

-- Users can view items in public boards
CREATE POLICY "Users can view items in public boards"
  ON public.moodboard_items
  FOR SELECT
  USING (board_id IN (SELECT id FROM public.moodboards WHERE is_public = true));

-- Users can add items to their own boards
CREATE POLICY "Users can add items to their own boards"
  ON public.moodboard_items
  FOR INSERT
  WITH CHECK (board_id IN (SELECT id FROM public.moodboards WHERE user_id = auth.uid()));

-- Users can update items in their own boards
CREATE POLICY "Users can update items in their own boards"
  ON public.moodboard_items
  FOR UPDATE
  USING (board_id IN (SELECT id FROM public.moodboards WHERE user_id = auth.uid()));

-- Users can delete items from their own boards
CREATE POLICY "Users can delete items from their own boards"
  ON public.moodboard_items
  FOR DELETE
  USING (board_id IN (SELECT id FROM public.moodboards WHERE user_id = auth.uid()));

-- Add comments for documentation
COMMENT ON TABLE public.moodboards IS 'User moodboards for collecting and organizing materials';
COMMENT ON TABLE public.moodboard_items IS 'Items within user moodboards';

-- Add this migration to the migrations table
INSERT INTO public.migrations (name, applied_at)
VALUES ('023_moodboard_schema.sql', NOW())
ON CONFLICT (name) DO NOTHING;
