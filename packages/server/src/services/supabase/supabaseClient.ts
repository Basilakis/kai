/**
 * Supabase Client for Server Package
 *
 * This file re-exports the unified Supabase client from the shared package
 * to ensure consistent usage across the application.
 */
import { supabase, supabaseClient as sharedClient } from '../../../../shared/src/services/supabase/supabaseClient';
import { logger } from '../../utils/logger';

// Log that we're using the shared client
logger.debug('Server package using shared Supabase client');

/**
 * Export the shared client as supabaseClient for backward compatibility
 */
export const supabaseClient = sharedClient;

/**
 * Export the shared client as default export
 */
export default supabase;