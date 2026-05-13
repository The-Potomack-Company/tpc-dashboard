import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../src/db/database.types';

// Phase 1 / INFR-06 — service-role Supabase admin-client module.
//
// NEVER import this from src/. The prebuild guard at
// scripts/check-no-service-role-in-src.mjs blocks `SUPABASE_SERVICE_ROLE_KEY`
// in src/, but the structural rule is: admin client lives in scraper/,
// scripts/ can import it, src/ cannot.
//
// Auth flags explanation (RESEARCH § Pitfall 9):
//   - persistSession: false — the service role is a static API key, not
//     a user session; there's nothing to persist in localStorage (which
//     doesn't exist in Node anyway).
//   - autoRefreshToken: false — default is true, which schedules a
//     setInterval timer that prevents Node scripts from exiting cleanly
//     after the task completes. We must disable BOTH flags together.

let _client: SupabaseClient<Database> | null = null;

export function getAdminClient(): SupabaseClient<Database> {
  if (_client) return _client;

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error(
      'SUPABASE_URL is not set. Add it to scraper/.env (copy from scraper/.env.example).',
    );
  }
  if (!serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set. Add it to scraper/.env. ' +
        'Get the key from Supabase Dashboard > Settings > API > service_role. ' +
        'NEVER commit this key and NEVER expose it in the frontend.',
    );
  }

  _client = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return _client;
}

// Test-only helper — resets the memoised instance between test cases.
// Not re-exported; accessed via `import * as admin` in the test file.
export function __resetForTests(): void {
  _client = null;
}
