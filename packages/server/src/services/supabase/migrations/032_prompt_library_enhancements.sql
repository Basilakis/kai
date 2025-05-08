-- Migration: 032_prompt_library_enhancements.sql
-- Description: Adds enhancements to the User Prompt Library feature including ratings and fork tracking

-- Add columns to user_prompts table for fork tracking
ALTER TABLE public.user_prompts 
ADD COLUMN IF NOT EXISTS forked_from UUID REFERENCES public.user_prompts(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS fork_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Create index on forked_from for faster queries
CREATE INDEX IF NOT EXISTS idx_user_prompts_forked_from ON public.user_prompts(forked_from);

-- Create index on tags for faster filtering
CREATE INDEX IF NOT EXISTS idx_user_prompts_tags ON public.user_prompts USING GIN (tags);

-- Create Prompt Ratings table
CREATE TABLE IF NOT EXISTS public.prompt_ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prompt_id UUID NOT NULL REFERENCES public.user_prompts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(prompt_id, user_id)
);

-- Create index on prompt_id for faster queries
CREATE INDEX IF NOT EXISTS idx_prompt_ratings_prompt_id ON public.prompt_ratings(prompt_id);

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_prompt_ratings_user_id ON public.prompt_ratings(user_id);

-- Add a view for prompt statistics
CREATE OR REPLACE VIEW public.prompt_stats AS
SELECT 
  p.id,
  p.title,
  p.user_id,
  p.is_public,
  p.views_count,
  p.imports_count,
  p.fork_count,
  COUNT(r.id) AS rating_count,
  COALESCE(AVG(r.rating), 0) AS avg_rating
FROM 
  public.user_prompts p
LEFT JOIN 
  public.prompt_ratings r ON p.id = r.prompt_id
GROUP BY 
  p.id;

-- Function to increment fork count
CREATE OR REPLACE FUNCTION increment_prompt_fork_count(prompt_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.user_prompts
  SET fork_count = fork_count + 1
  WHERE id = prompt_id;
END;
$$;

-- Function to get prompt rating
CREATE OR REPLACE FUNCTION get_prompt_rating(prompt_id UUID)
RETURNS TABLE (
  avg_rating NUMERIC,
  rating_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(AVG(rating), 0)::NUMERIC AS avg_rating,
    COUNT(id) AS rating_count
  FROM 
    public.prompt_ratings
  WHERE 
    prompt_id = $1;
END;
$$;

-- RLS Policies for prompt_ratings

-- Enable RLS on ratings table
ALTER TABLE public.prompt_ratings ENABLE ROW LEVEL SECURITY;

-- Users can read ratings for public prompts
CREATE POLICY "Anyone can read ratings for public prompts" 
  ON public.prompt_ratings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_prompts
      WHERE id = prompt_id AND is_public = true
    )
  );

-- Users can read ratings for their own prompts
CREATE POLICY "Users can read ratings for their own prompts" 
  ON public.prompt_ratings
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_prompts
      WHERE id = prompt_id AND user_id = auth.uid()
    )
  );

-- Users can insert their own ratings
CREATE POLICY "Users can insert their own ratings" 
  ON public.prompt_ratings
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own ratings
CREATE POLICY "Users can update their own ratings" 
  ON public.prompt_ratings
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Users can delete their own ratings
CREATE POLICY "Users can delete their own ratings" 
  ON public.prompt_ratings
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Add comments for documentation
COMMENT ON TABLE public.prompt_ratings IS 'User ratings for prompts';
COMMENT ON COLUMN public.user_prompts.forked_from IS 'Reference to the original prompt if this is a fork';
COMMENT ON COLUMN public.user_prompts.fork_count IS 'Number of times this prompt has been forked';
COMMENT ON COLUMN public.user_prompts.tags IS 'Array of tags for the prompt';
COMMENT ON VIEW public.prompt_stats IS 'View for prompt statistics including ratings';
