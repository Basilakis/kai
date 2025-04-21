-- Create a function to execute SQL queries
-- This function is used by the migration utility to execute SQL scripts
CREATE OR REPLACE FUNCTION execute_sql(sql_query TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER -- Run with privileges of the function creator
AS $$
BEGIN
  EXECUTE sql_query;
END;
$$;
