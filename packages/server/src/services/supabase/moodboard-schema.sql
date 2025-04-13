-- MoodBoard Schema for Supabase

-- Create MoodBoards table
CREATE TABLE moodboards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_public BOOLEAN NOT NULL DEFAULT false,
  view_preference TEXT NOT NULL DEFAULT 'grid',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create MoodBoardItems table
CREATE TABLE moodboard_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  board_id UUID NOT NULL REFERENCES moodboards(id) ON DELETE CASCADE,
  material_id TEXT NOT NULL,
  notes TEXT,
  position INTEGER DEFAULT 0,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_moodboards_user_id ON moodboards(user_id);
CREATE INDEX idx_moodboard_items_board_id ON moodboard_items(board_id);
CREATE INDEX idx_moodboard_items_material_id ON moodboard_items(material_id);

-- Set up Row Level Security (RLS)
ALTER TABLE moodboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE moodboard_items ENABLE ROW LEVEL SECURITY;

-- Policies for MoodBoards
-- Users can view their own boards
CREATE POLICY "Users can view their own boards"
  ON moodboards
  FOR SELECT
  USING (user_id = auth.uid());

-- Users can view public boards
CREATE POLICY "Users can view public boards"
  ON moodboards
  FOR SELECT
  USING (is_public = true);

-- Users can create their own boards
CREATE POLICY "Users can create their own boards"
  ON moodboards
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own boards
CREATE POLICY "Users can update their own boards"
  ON moodboards
  FOR UPDATE
  USING (user_id = auth.uid());

-- Users can delete their own boards
CREATE POLICY "Users can delete their own boards"
  ON moodboards
  FOR DELETE
  USING (user_id = auth.uid());

-- Policies for MoodBoardItems
-- Users can view items in their own boards
CREATE POLICY "Users can view items in their own boards"
  ON moodboard_items
  FOR SELECT
  USING (board_id IN (SELECT id FROM moodboards WHERE user_id = auth.uid()));

-- Users can view items in public boards
CREATE POLICY "Users can view items in public boards"
  ON moodboard_items
  FOR SELECT
  USING (board_id IN (SELECT id FROM moodboards WHERE is_public = true));

-- Users can add items to their own boards
CREATE POLICY "Users can add items to their own boards"
  ON moodboard_items
  FOR INSERT
  WITH CHECK (board_id IN (SELECT id FROM moodboards WHERE user_id = auth.uid()));

-- Users can update items in their own boards
CREATE POLICY "Users can update items in their own boards"
  ON moodboard_items
  FOR UPDATE
  USING (board_id IN (SELECT id FROM moodboards WHERE user_id = auth.uid()));

-- Users can delete items from their own boards
CREATE POLICY "Users can delete items from their own boards"
  ON moodboard_items
  FOR DELETE
  USING (board_id IN (SELECT id FROM moodboards WHERE user_id = auth.uid()));
