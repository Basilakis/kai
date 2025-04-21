/**
 * Run Database Migrations Script
 * 
 * This script runs all pending database migrations to ensure
 * the database schema is up to date.
 */

import { logger } from '../utils/logger';
import DatabaseMigration from '../utils/db-migration';

/**
 * Run database migrations
 */
async function runMigrations() {
  logger.info('Running database migrations...');

  try {
    // First apply the execute_sql function migration
    const executeSqlMigration = 'create_execute_sql_function.sql';
    await DatabaseMigration.applyMigration(executeSqlMigration);
    logger.info(`Applied migration: ${executeSqlMigration}`);

    // Then apply all other pending migrations
    const appliedMigrations = await DatabaseMigration.applyPendingMigrations();
    
    if (appliedMigrations.length > 0) {
      logger.info(`Applied ${appliedMigrations.length} database migrations:`, { migrations: appliedMigrations });
    } else {
      logger.info('No pending database migrations to apply');
    }

    logger.info('Database migrations completed successfully');
    return true;
  } catch (error) {
    logger.error('Error running database migrations:', error);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    // Run migrations
    const success = await runMigrations();

    if (!success) {
      logger.error('Failed to run database migrations');
      process.exit(1);
    }

    logger.info('Database is now ready for response quality and model improvement features');
  } catch (error) {
    logger.error('Unhandled error:', error);
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  logger.error('Unhandled error:', error);
  process.exit(1);
});

export default main;
