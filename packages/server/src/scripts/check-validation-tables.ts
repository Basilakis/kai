/**
 * Validation Tables Check Script
 * 
 * This script checks if the required database tables for the Advanced Property Validation
 * feature exist in the database and creates them if they don't.
 */

import * as fs from 'fs';
import * as path from 'path';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';

// List of required validation tables
const validationTables = [
  'validation_rules',
  'validation_rule_dependencies',
  'validation_results'
];

/**
 * Check if validation tables exist
 */
async function checkValidationTables() {
  logger.info('Checking validation database tables...');
  
  const missingTables: string[] = [];
  
  for (const tableName of validationTables) {
    try {
      // Check if table exists
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);
      
      if (error && error.code === 'PGRST116') {
        // PGRST116 means "no rows returned" which is fine
        logger.info(`Table ${tableName} exists but is empty`);
      } else if (error && error.code.startsWith('PGRST')) {
        // Other PGRST errors might indicate the table doesn't exist
        logger.warn(`Table ${tableName} might not exist: ${error.message}`);
        missingTables.push(tableName);
      } else if (error) {
        // Other errors
        logger.error(`Error checking table ${tableName}:`, error);
      } else {
        logger.info(`Table ${tableName} exists with ${data.length} rows`);
      }
    } catch (error) {
      logger.error(`Error checking table ${tableName}:`, error);
      missingTables.push(tableName);
    }
  }
  
  return missingTables;
}

/**
 * Create validation tables
 */
async function createValidationTables() {
  logger.info('Creating validation database tables...');
  
  try {
    // Read the SQL migration file
    const migrationPath = path.join(__dirname, '../migrations/validation_rules.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the SQL
    const { error } = await supabase.rpc('execute_sql', { sql_query: sql });
    
    if (error) {
      logger.error('Error creating validation tables:', error);
      throw error;
    }
    
    logger.info('Validation tables created successfully');
    return true;
  } catch (error) {
    logger.error('Error creating validation tables:', error);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    // Check if validation tables exist
    const missingTables = await checkValidationTables();
    
    if (missingTables.length > 0) {
      logger.warn(`Missing validation tables: ${missingTables.join(', ')}`);
      
      // Create validation tables
      const success = await createValidationTables();
      
      if (!success) {
        logger.error('Failed to create validation tables');
        process.exit(1);
      }
    } else {
      logger.info('All validation tables exist');
    }
    
    logger.info('Database is ready for Advanced Property Validation feature');
  } catch (error) {
    logger.error('Unhandled error:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    logger.error('Unhandled error:', error);
    process.exit(1);
  });
}

export default main;
