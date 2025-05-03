-- Migration: 009_execute_sql_function.sql
-- Description: Creates a function to execute SQL queries for migrations

-- Create a function to execute SQL queries
-- This function is used by the migration utility to execute SQL scripts
CREATE OR REPLACE FUNCTION public.execute_sql(sql_query TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER -- Run with privileges of the function creator
AS $$
BEGIN
  EXECUTE sql_query;
END;
$$;

-- Add comment for documentation
COMMENT ON FUNCTION public.execute_sql IS 'Utility function for executing SQL queries during migrations';

-- Add this migration to the migrations table
INSERT INTO public.migrations (name, applied_at)
VALUES ('009_execute_sql_function.sql', NOW())
ON CONFLICT (name) DO NOTHING;
