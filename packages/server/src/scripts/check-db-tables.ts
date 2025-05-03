/**
 * Database Table Check Script
 *
 * This script checks if the required database tables for response quality
 * and model improvement features exist in the database.
 */

import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';

// List of required tables
const requiredTables = [
  'model_responses',
  'response_feedback',
  'finetuning_datasets',
  'finetuning_dataset_samples',
  'finetuning_jobs',
  'error_patterns',
  'improvement_suggestions',
  'models',
  'migrations',
  'validation_rules',
  'validation_rule_dependencies',
  'validation_results'
];

/**
 * Check if required tables exist
 */
async function checkRequiredTables() {
  logger.info('Checking required database tables...');

  try {
    // Get list of tables
    const { data, error } = await supabase.rpc('get_tables');

    if (error) {
      logger.error('Error getting tables:', error);
      return false;
    }

    if (!data || !Array.isArray(data)) {
      logger.error('Invalid response from get_tables RPC');
      return false;
    }

    const existingTables = data.map(table => table.table_name);
    logger.info(`Found ${existingTables.length} tables in database`);

    // Check if all required tables exist
    const missingTables = requiredTables.filter(table => !existingTables.includes(table));

    if (missingTables.length > 0) {
      logger.warn(`Missing required tables: ${missingTables.join(', ')}`);
      logger.info('Run database migrations to create missing tables');
      return false;
    }

    logger.info('All required tables exist');
    return true;
  } catch (error) {
    logger.error('Error checking required tables:', error);
    return false;
  }
}

/**
 * Create get_tables RPC function if it doesn't exist
 */
async function createGetTablesFunction() {
  try {
    const { error } = await supabase.rpc('get_tables');

    // If the function exists, we're good
    if (!error || error.code !== 'PGRST116') {
      return;
    }

    // Create the function
    const createFunctionSQL = `
      CREATE OR REPLACE FUNCTION get_tables()
      RETURNS TABLE (table_name text, table_schema text)
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      BEGIN
        RETURN QUERY
        SELECT
          t.table_name::text,
          t.table_schema::text
        FROM
          information_schema.tables t
        WHERE
          t.table_schema = 'public'
          AND t.table_type = 'BASE TABLE';
      END;
      $$;
    `;

    const { error: createError } = await supabase.rpc('execute_sql', { sql_query: createFunctionSQL });

    if (createError) {
      logger.error('Error creating get_tables function:', createError);
      throw createError;
    }

    logger.info('Created get_tables function');
  } catch (error) {
    logger.error('Error creating get_tables function:', error);
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    // Create get_tables function if it doesn't exist
    await createGetTablesFunction();

    // Check if required tables exist
    const tablesExist = await checkRequiredTables();

    if (!tablesExist) {
      logger.warn('Some required tables are missing. Please run database migrations.');
    } else {
      logger.info('All required tables exist. Database is ready for response quality and model improvement features.');
    }
  } catch (error) {
    logger.error('Error in main function:', error);
  }
}

// Run the script
main().catch(error => {
  logger.error('Unhandled error:', error);
  process.exit(1);
});

export default main;
