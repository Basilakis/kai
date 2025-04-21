import { supabase } from '../config/supabase';
import fs from 'fs';
import path from 'path';
import { logger } from './logger';

/**
 * Database Migration Utility
 * 
 * This utility handles database migrations by executing SQL scripts
 * and tracking which migrations have been applied.
 */
export class DatabaseMigration {
  /**
   * Apply a migration script
   * @param scriptName Name of the script file (without path)
   * @returns Promise that resolves when migration is complete
   */
  public static async applyMigration(scriptName: string): Promise<boolean> {
    try {
      // Check if migration has already been applied
      const { data: existingMigration, error: checkError } = await supabase
        .from('migrations')
        .select('*')
        .eq('name', scriptName)
        .single();

      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
        logger.error('Error checking migration status:', checkError);
        throw checkError;
      }

      if (existingMigration) {
        logger.info(`Migration ${scriptName} already applied on ${existingMigration.applied_at}`);
        return false;
      }

      // Read the migration script
      const scriptPath = path.join(__dirname, '../migrations', scriptName);
      const sql = fs.readFileSync(scriptPath, 'utf8');

      // Execute the migration script
      const { error: migrationError } = await supabase.rpc('execute_sql', { sql_query: sql });

      if (migrationError) {
        logger.error(`Error applying migration ${scriptName}:`, migrationError);
        throw migrationError;
      }

      // Record the migration
      const { error: recordError } = await supabase
        .from('migrations')
        .insert({
          name: scriptName,
          applied_at: new Date().toISOString()
        });

      if (recordError) {
        logger.error(`Error recording migration ${scriptName}:`, recordError);
        throw recordError;
      }

      logger.info(`Successfully applied migration: ${scriptName}`);
      return true;
    } catch (error) {
      logger.error(`Migration failed for ${scriptName}:`, error);
      throw error;
    }
  }

  /**
   * Apply all pending migrations from a directory
   * @returns Promise that resolves when all migrations are complete
   */
  public static async applyPendingMigrations(): Promise<string[]> {
    try {
      // First, ensure migrations table exists
      await this.ensureMigrationsTable();

      // Get list of migration files
      const migrationsDir = path.join(__dirname, '../migrations');
      const migrationFiles = fs.readdirSync(migrationsDir)
        .filter(file => file.endsWith('.sql'))
        .sort(); // Apply in alphabetical order

      // Get list of applied migrations
      const { data: appliedMigrations, error } = await supabase
        .from('migrations')
        .select('name');

      if (error) {
        logger.error('Error fetching applied migrations:', error);
        throw error;
      }

      const appliedMigrationNames = appliedMigrations?.map(m => m.name) || [];
      const pendingMigrations = migrationFiles.filter(file => !appliedMigrationNames.includes(file));

      // Apply pending migrations
      const appliedMigrationsList: string[] = [];
      for (const migration of pendingMigrations) {
        const applied = await this.applyMigration(migration);
        if (applied) {
          appliedMigrationsList.push(migration);
        }
      }

      return appliedMigrationsList;
    } catch (error) {
      logger.error('Error applying pending migrations:', error);
      throw error;
    }
  }

  /**
   * Ensure migrations table exists
   */
  private static async ensureMigrationsTable(): Promise<void> {
    try {
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS migrations (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL UNIQUE,
          applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        );
      `;

      const { error } = await supabase.rpc('execute_sql', { sql_query: createTableSQL });

      if (error) {
        logger.error('Error creating migrations table:', error);
        throw error;
      }
    } catch (error) {
      logger.error('Error ensuring migrations table exists:', error);
      throw error;
    }
  }
}

export default DatabaseMigration;
