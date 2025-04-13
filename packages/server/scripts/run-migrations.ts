/**
 * Supabase SQL Migration Runner
 *
 * This script runs SQL migration files in sequential order.
 * It's used during CI/CD deployment to ensure database schema is updated
 * before deploying application changes.
 *
 * Enhanced version with improved error handling, validation, and transaction support.
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
const MIGRATION_TIMEOUT_MS = 30000; // 30 seconds timeout for each migration
const VERIFY_AFTER_MIGRATION = true; // Verify each migration after it's applied

interface MigrationRecord {
  id: string;
  name: string;
  applied_at: string;
  success: boolean;
  error_message?: string;
  duration_ms?: number;
}

interface SqlError {
  code?: string;
  message: string;
  details?: string;
  hint?: string;
}

interface MigrationResult {
  success: boolean;
  message: string;
  duration_ms: number;
  error?: Error;
}

async function main(): Promise<void> {
  console.log('🔄 Starting Supabase migration runner...');

  // Validate environment variables
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    console.error('❌ Error: SUPABASE_URL and SUPABASE_KEY environment variables are required');
    (process as any).exit(1);
  }

  const supabaseUrl = process.env.SUPABASE_URL as string;
  const supabaseKey = process.env.SUPABASE_KEY as string;

  console.log(`📁 Running migrations from: ${MIGRATIONS_DIR}`);
  console.log(`🔗 Using Supabase project: ${supabaseUrl}`);

  // Initialize Supabase client
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Verify connection to Supabase
    await verifySupabaseConnection(supabase);

    // Ensure migrations table exists
    await ensureMigrationsTable(supabase);

    // Get applied migrations
    const appliedMigrations = await getAppliedMigrations(supabase);
    console.log(`✅ Found ${appliedMigrations.length} previously applied migrations`);

    // Get available migration files
    const migrationFiles = await getMigrationFiles();
    console.log(`📄 Found ${migrationFiles.length} migration files`);

    // Determine which migrations need to be applied
    const pendingMigrations = getPendingMigrations(migrationFiles, appliedMigrations);

    if (pendingMigrations.length === 0) {
      console.log('✅ No pending migrations to apply');
      return;
    }

    console.log(`🔄 Found ${pendingMigrations.length} pending migrations to apply`);

    // Validate migration file sequence
    validateMigrationSequence(pendingMigrations);

    // Apply pending migrations in order
    const results: Record<string, MigrationResult> = {};
    let allSuccessful = true;

    for (const migration of pendingMigrations) {
      const result = await applyMigration(supabase, migration);
      results[migration] = result;

      if (!result.success) {
        allSuccessful = false;
        console.error(`❌ Migration failed: ${migration}`);
        console.error(`   Error: ${result.message}`);
        break; // Stop on first failure
      }

      // Verify the migration if enabled
      if (VERIFY_AFTER_MIGRATION) {
        const verificationResult = await verifyMigration(supabase, migration);
        if (!verificationResult.success) {
          allSuccessful = false;
          console.error(`❌ Migration verification failed: ${migration}`);
          console.error(`   Error: ${verificationResult.message}`);
          break;
        }
      }
    }

    // Print summary
    console.log('\n📋 Migration Summary:');
    for (const [migration, result] of Object.entries(results)) {
      const status = result.success ? '✅' : '❌';
      console.log(`${status} ${migration} (${result.duration_ms}ms)`);
    }

    if (allSuccessful) {
      console.log('\n✅ All migrations applied successfully');
    } else {
      console.error('\n❌ Some migrations failed to apply');
      (process as any).exit(1);
    }
  } catch (error) {
    console.error('❌ Migration process failed:', error);
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
 * Verify Supabase connection
 */
async function verifySupabaseConnection(supabase: SupabaseClient): Promise<void> {
  try {
    const startTime = Date.now();
    const { data, error } = await supabase.from('pg_catalog.pg_tables').select('tablename').limit(1);

    if (error) {
      throw new Error(`Failed to connect to Supabase: ${error.message}`);
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Connected to Supabase (${duration}ms)`);
  } catch (error) {
    console.error('❌ Failed to connect to Supabase');
    throw error;
  }
}

/**
 * Validate migration sequence to ensure no gaps or duplicates
 */
function validateMigrationSequence(migrations: string[]): void {
  // Extract numeric prefixes (e.g., '001' from '001_initial_schema.sql')
  const prefixes = migrations.map(file => {
    const match = file.match(/^(\d+)_/);
    return match ? match[1] : null;
  });

  // Check for null prefixes (invalid format)
  if (prefixes.some(prefix => prefix === null)) {
    throw new Error('Some migration files do not follow the naming convention: NNN_description.sql');
  }

  // Check for duplicates
  const uniquePrefixes = new Set(prefixes);
  if (uniquePrefixes.size !== prefixes.length) {
    throw new Error('Duplicate migration numbers detected');
  }

  // Convert to numbers and check for gaps
  const numericPrefixes = prefixes.map(p => parseInt(p as string, 10)).sort((a, b) => a - b);
  for (let i = 1; i < numericPrefixes.length; i++) {
    if (numericPrefixes[i] !== numericPrefixes[i-1] + 1) {
      console.warn(`⚠️ Warning: Gap detected in migration sequence between ${numericPrefixes[i-1]} and ${numericPrefixes[i]}`);
    }
  }
}

/**
 * Apply a single migration
 */
async function applyMigration(supabase: SupabaseClient, migrationName: string): Promise<MigrationResult> {
  const migrationPath = path.join(MIGRATIONS_DIR, migrationName);
  const startTime = Date.now();

  console.log(`🔄 Applying migration: ${migrationName}`);

  try {
    // Read migration file with timeout
    const sql = await Promise.race([
      new Promise<string>((resolve, reject) => {
        fs.readFile(migrationPath, 'utf8', (err, data) => {
          if (err) {
            reject(new Error(`Failed to read migration file: ${err.message}`));
            return;
          }
          resolve(data);
        });
      }),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout reading migration file')), 5000);
      })
    ]);

    // Execute the migration in a transaction with timeout
    const migrationPromise = new Promise<void>(async (resolve, reject) => {
      try {
        // First try using the run_migration RPC function (which uses transactions)
        const { error } = await supabase.rpc('run_migration', {
          migration_name: migrationName,
          migration_sql: sql
        });

        if (error) {
          // If RPC doesn't exist, try direct SQL approach with manual transaction
          console.warn('⚠️ RPC method not available, falling back to direct SQL execution with manual transaction');

          // Start transaction
          await supabase.rpc('exec_sql', { sql: 'BEGIN;' });

          try {
            // Execute SQL statements
            const { error: sqlError } = await supabase.rpc('exec_sql', { sql });

            if (sqlError) {
              // Rollback on error
              await supabase.rpc('exec_sql', { sql: 'ROLLBACK;' });
              throw new Error(`Failed to apply migration: ${sqlError.message}`);
            }

            // Record migration in tracking table
            const insertResult = await supabase
              .from(MIGRATIONS_TABLE)
              .insert({
                name: migrationName,
                success: true,
                duration_ms: Date.now() - startTime
              });

            const { error: insertError } = insertResult;

            if (insertError) {
              // Rollback on error
              await supabase.rpc('exec_sql', { sql: 'ROLLBACK;' });
              throw new Error(`Failed to record migration: ${insertError.message}`);
            }

            // Commit transaction
            await supabase.rpc('exec_sql', { sql: 'COMMIT;' });
          } catch (txError) {
            // Ensure rollback on any error
            try {
              await supabase.rpc('exec_sql', { sql: 'ROLLBACK;' });
            } catch (rollbackError) {
              console.error('Failed to rollback transaction:', rollbackError);
            }
            throw txError;
          }
        }

        resolve();
      } catch (error) {
        reject(error);
      }
    });

    // Apply timeout to the migration
    await Promise.race([
      migrationPromise,
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Migration timed out after ${MIGRATION_TIMEOUT_MS}ms`)), MIGRATION_TIMEOUT_MS);
      })
    ]);

    const duration = Date.now() - startTime;
    console.log(`✅ Successfully applied migration: ${migrationName} (${duration}ms)`);

    return {
      success: true,
      message: `Migration applied successfully in ${duration}ms`,
      duration_ms: duration
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = `Failed to apply migration ${migrationName}: ${error instanceof Error ? error.message : String(error)}`;

    // Record failed migration
    try {
      await supabase
        .from(MIGRATIONS_TABLE)
        .insert({
          name: migrationName,
          success: false,
          error_message: errorMessage,
          duration_ms: duration
        });
    } catch (recordError) {
      console.error('Failed to record migration failure:', recordError);
    }

    return {
      success: false,
      message: errorMessage,
      duration_ms: duration,
      error: error instanceof Error ? error : new Error(String(error))
    };
  }
}

/**
 * Verify a migration was applied correctly
 */
async function verifyMigration(supabase: SupabaseClient, migrationName: string): Promise<MigrationResult> {
  const startTime = Date.now();

  try {
    // Check if migration is recorded in the migrations table
    const { data, error } = await supabase
      .from(MIGRATIONS_TABLE)
      .select('*')
      .eq('name', migrationName)
      .single();

    if (error) {
      return {
        success: false,
        message: `Migration verification failed: ${error.message}`,
        duration_ms: Date.now() - startTime
      };
    }

    if (!data) {
      return {
        success: false,
        message: 'Migration verification failed: Migration not found in tracking table',
        duration_ms: Date.now() - startTime
      };
    }

    // Additional verification could be added here, such as checking if tables were created

    return {
      success: true,
      message: 'Migration verified successfully',
      duration_ms: Date.now() - startTime
    };
  } catch (error) {
    return {
      success: false,
      message: `Migration verification failed: ${error instanceof Error ? error.message : String(error)}`,
      duration_ms: Date.now() - startTime,
      error: error instanceof Error ? error : new Error(String(error))
    };
  }
}

// Run the migration script
main().catch((error: Error) => {
  console.error('❌ Migration script failed:', error);
  (process as any).exit(1);
});

// Log start time for performance tracking
console.log(`🕒 Migration script started at ${new Date().toISOString()}`);