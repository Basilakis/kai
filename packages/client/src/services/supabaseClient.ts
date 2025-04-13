/**
 * Supabase Client for Client Package
 *
 * This file re-exports the unified Supabase client from the shared package
 * to ensure consistent usage across the application.
 */

// Import the shared Supabase client
// Note: In a real application, you would use a proper import path like '@kai/shared'
// but for this example, we're using a relative path
import { supabase } from '../../shared/src/services/supabase/supabaseClient';

// Log that we're using the shared client
console.debug('Client package using shared Supabase client');

/**
 * Export the shared client as supabaseClient for backward compatibility
 */
export const supabaseClient = supabase;

/**
 * Export the shared client as default export
 */
export default supabase;

/**
 * Subscribe to queue updates
 * This is a client-specific helper function that uses the shared client
 */
export const subscribeToQueue = (callback: (payload: any) => void) => {
  const subscription = supabase
    .getClient()
    .channel('queue_updates')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'queue_jobs'
      },
      callback
    )
    .subscribe();

  return subscription;
};