/**
 * Supabase SQL Migration Runner
 * 
 * This script runs SQL migration files in sequential order.
 * It's used during CI/CD deployment to ensure database schema is updated
 * before deploying application changes.
 */
import * as fs from 'fs';
import * as path from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
// Use process as any to bypass TypeScript errors
import * as process from 'process';

// Load environment variables
dotenv.config();

// Migration configuration
const MIGRATIONS_DIR = path.resolve(__dirname, '../src/services/supabase/migrations');
const MIGRATIONS_TABLE = 'schema_migrations';

interface MigrationRecord {
  id: string;
  name: string;
  applied_at: string;
}

interface SqlError {
  code?: string;
  message: string;
}

async function main(): Promise<void> {
  // Validate environment variables
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    console.error('Error: SUPABASE_URL and SUPABASE_KEY environment variables are required');
    (process as any).exit(1);
  }

  const supabaseUrl = process.env.SUPABASE_URL as string;
  const supabaseKey = process.env.SUPABASE_KEY as string;
  
  console.log(`Running migrations from: ${MIGRATIONS_DIR}`);
  console.log(`Using Supabase project: ${supabaseUrl}`);

  // Initialize Supabase client
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // Ensure migrations table exists
    await ensureMigrationsTable(supabase);
    
    // Get applied migrations
    const appliedMigrations = await getAppliedMigrations(supabase);
    
    // Get available migration files
    const migrationFiles = await getMigrationFiles();
    
    // Determine which migrations need to be applied
    const pendingMigrations = getPendingMigrations(migrationFiles, appliedMigrations);
    
    if (pendingMigrations.length === 0) {
      console.log('No pending migrations to apply');
      return;
    }
    
    console.log(`Found ${pendingMigrations.length} pending migrations to apply`);
    
    // Apply pending migrations in order
    for (const migration of pendingMigrations) {
      await applyMigration(supabase, migration);
    }
    
    console.log('All migrations applied successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    (process as any).exit(1);
  }
}

/**
 * Ensure the migrations tracking table exists
 */
async function ensureMigrationsTable(supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase.rpc('create_migrations_table_if_not_exists', {
    table_name: MIGRATIONS_TABLE
  });
  
  if (error) {
    // If RPC method doesn't exist, create table using raw SQL
    const selectResult = await supabase
      .from('schema_migrations')
      .select('id');
      
    // Access first row to check if table exists
    const { error: sqlError } = selectResult;
    
    if (sqlError && (sqlError as SqlError).code === '42P01') { // Table doesn't exist error code
      console.log('Creating migrations table...');
      
      // Use raw PostgreSQL queries
      const { error: createError } = await supabase.rpc('exec_sql', {
        sql: `
          CREATE TABLE ${MIGRATIONS_TABLE} (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          )
        `
      });
      
      if (createError) {
        throw new Error(`Failed to create migrations table: ${createError.message}`);
      }
    } else if (sqlError) {
      throw new Error(`Failed to check migrations table: ${sqlError.message}`);
    }
  }
  
  console.log('Migrations table ready');
}

/**
 * Get list of already applied migrations
 */
async function getAppliedMigrations(supabase: SupabaseClient): Promise<string[]> {
  const selectResult = await supabase
    .from(MIGRATIONS_TABLE)
    .select('name');
    
  const { data, error } = selectResult;
  
  if (error) {
    throw new Error(`Failed to get applied migrations: ${error.message}`);
  }
  
  return data ? data.map((row: { name: string }) => row.name) : [];
}

/**
 * Get available migration files from the migrations directory
 */
async function getMigrationFiles(): Promise<string[]> {
  try {
    return new Promise<string[]>((resolve, reject) => {
      fs.readdir(MIGRATIONS_DIR, (err, files) => {
        if (err) {
          reject(new Error(`Failed to read migrations directory: ${err.message}`));
          return;
        }
        
        const sqlFiles = files
          .filter((file: string) => file.endsWith('.sql'))
          .sort(); // Sort alphabetically to ensure correct order (001_, 002_, etc.)
          
        resolve(sqlFiles);
      });
    });
  } catch (error) {
    throw new Error(`Failed to read migrations directory: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Determine which migrations need to be applied
 */
function getPendingMigrations(allMigrations: string[], appliedMigrations: string[]): string[] {
  const appliedSet = new Set(appliedMigrations);
  return allMigrations.filter(migration => !appliedSet.has(migration));
}

/**
 * Apply a single migration
 */
async function applyMigration(supabase: SupabaseClient, migrationName: string): Promise<void> {
  const migrationPath = path.join(MIGRATIONS_DIR, migrationName);
  
  console.log(`Applying migration: ${migrationName}`);
  
  try {
    const sql = await new Promise<string>((resolve, reject) => {
      fs.readFile(migrationPath, 'utf8', (err, data) => {
        if (err) {
          reject(new Error(`Failed to read migration file: ${err.message}`));
          return;
        }
        resolve(data);
      });
    });
    
    // Execute the migration in a transaction
    const { error } = await supabase.rpc('run_migration', {
      migration_name: migrationName,
      migration_sql: sql
    });
    
    if (error) {
      // If RPC doesn't exist, try direct SQL approach
      // This is more risky as it doesn't use a transaction
      console.warn('RPC method not available, falling back to direct SQL execution');
      
      // Execute SQL statements
      const { error: sqlError } = await supabase.rpc('exec_sql', { sql });
      
      if (sqlError) {
        throw new Error(`Failed to apply migration: ${sqlError.message}`);
      }
      
      // Record migration in tracking table
      const insertResult = await supabase
        .from(MIGRATIONS_TABLE)
        .insert({ name: migrationName });
        
      const { error: insertError } = insertResult;
      
      if (insertError) {
        throw new Error(`Failed to record migration: ${insertError.message}`);
      }
    }
    
    console.log(`Successfully applied migration: ${migrationName}`);
  } catch (error) {
    throw new Error(`Failed to apply migration ${migrationName}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Run the migration script
main().catch((error: Error) => {
  console.error('Migration script failed:', error);
  (process as any).exit(1);
});