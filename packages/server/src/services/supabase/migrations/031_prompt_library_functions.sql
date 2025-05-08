-- Migration: 031_prompt_library_functions.sql
-- Description: Creates functions for the Prompt Library feature

-- Function to increment the view count of a prompt
CREATE OR REPLACE FUNCTION increment_prompt_view_count(prompt_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.user_prompts
  SET views_count = views_count + 1
  WHERE id = prompt_id;
END;
$$;
