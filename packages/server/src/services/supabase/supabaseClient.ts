/**
 * Supabase Client Redirection for Server
 * This file re-exports the shared Supabase client for server-side use.
 */

// Re-export the supabaseClient and supabase from the shared package
export { supabase, supabaseClient } from '../../../shared/src/services/supabase/supabaseClient';