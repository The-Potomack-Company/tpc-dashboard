// scripts/lib/supabase-admin.ts
// Service-role Supabase client. MUST remain server-side only.
//
// SECURITY (T-01 mitigation):
//   1. File lives outside src/ so Vite cannot bundle it.
//   2. Env var is SUPABASE_SERVICE_ROLE_KEY (NOT VITE_*) — Vite only injects VITE_*.
//   3. Top-of-file guard throws if loaded in a browser context.
//   4. Only TYPE imports from src/ — no runtime code pulled in.
//
// If you are reading this because a bundle contained the service role key,
// (a) rotate the key immediately in Supabase → Project Settings → API,
// (b) audit the import chain that brought this file into a browser context.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../src/db/database.types.js';

// Safety rail: fail loud if this module is ever loaded into a browser context.
if (typeof window !== 'undefined') {
  throw new Error(
    'scripts/lib/supabase-admin.ts was imported into browser context! ' +
      'This file contains the Supabase service role key and MUST remain server-only. ' +
      'Audit the import chain and rotate the key immediately.',
  );
}

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url) {
  throw new Error(
    'SUPABASE_URL (or VITE_SUPABASE_URL) is not set. Add it to .env.local.',
  );
}
if (!serviceKey) {
  throw new Error(
    'SUPABASE_SERVICE_ROLE_KEY is not set. Get it from Supabase → Project Settings → ' +
      'API → service_role. Add SUPABASE_SERVICE_ROLE_KEY=<key> to .env.local ' +
      '(NOT prefixed with VITE_ — that would leak it into the frontend bundle).',
  );
}

export const supabaseAdmin: SupabaseClient<Database> = createClient<Database>(
  url,
  serviceKey,
  {
    auth: { persistSession: false, autoRefreshToken: false },
  },
);
