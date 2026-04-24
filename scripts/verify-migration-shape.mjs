// scripts/verify-migration-shape.mjs
// Phase 1 / INFR-05 — static inspection of the analytics_events migration.
// Runs WITHOUT a database connection. Asserts the file contains the required
// create/constraint/policy/index statements.
// Usage: node scripts/verify-migration-shape.mjs

import { readFileSync, existsSync } from 'node:fs';
import { exit } from 'node:process';

const MIGRATION_PATH = 'supabase/migrations/20260424120500_create_analytics_events.sql';

if (!existsSync(MIGRATION_PATH)) {
  console.error(`FATAL: migration file not found: ${MIGRATION_PATH}`);
  exit(1);
}

const sql = readFileSync(MIGRATION_PATH, 'utf8');

const CHECKS = [
  // Create table (idempotent)
  { label: 'create table if not exists public.analytics_events', re: /create\s+table\s+if\s+not\s+exists\s+public\.analytics_events/i },
  // All 28 columns (spot-check the required ones and the tail)
  { label: 'column id uuid primary key', re: /\bid\s+uuid\s+primary\s+key/i },
  { label: 'column event_type text not null', re: /\bevent_type\s+text\s+not\s+null/i },
  { label: 'column extension_version text not null', re: /\bextension_version\s+text\s+not\s+null/i },
  { label: 'column created_at timestamptz not null default now()', re: /\bcreated_at\s+timestamptz\s+not\s+null\s+default\s+now\(\)/i },
  { label: 'column items_content jsonb', re: /\bitems_content\s+jsonb/i },
  // CHECK constraint values (exactly 5)
  { label: "CHECK enum 'catalog_single'", re: /'catalog_single'/ },
  { label: "CHECK enum 'catalog_batch'", re: /'catalog_batch'/ },
  { label: "CHECK enum 'portal_upload'", re: /'portal_upload'/ },
  { label: "CHECK enum 'spreadsheet_transform'", re: /'spreadsheet_transform'/ },
  { label: "CHECK enum 'data_import'", re: /'data_import'/ },
  // DO-block guard for the CHECK constraint (Pitfall 1)
  { label: 'DO $$...END$$ guarded CHECK constraint ADD', re: /do\s+\$\$\s*[\s\S]+?analytics_events_event_type_check[\s\S]+?end\s*\$\$\s*;/im },
  // Enable RLS
  { label: 'enable row level security', re: /alter\s+table\s+public\.analytics_events\s+enable\s+row\s+level\s+security/i },
  // Anon INSERT policy (drop-then-create for idempotency)
  { label: 'drop policy if exists analytics_insert_anon', re: /drop\s+policy\s+if\s+exists\s+"analytics_insert_anon"/i },
  { label: 'create policy analytics_insert_anon', re: /create\s+policy\s+"analytics_insert_anon"[\s\S]+?for\s+insert[\s\S]+?to\s+anon[\s\S]+?with\s+check\s*\(\s*true\s*\)/i },
  // Admin SELECT policy (NEW)
  { label: 'drop policy if exists analytics_admin_select', re: /drop\s+policy\s+if\s+exists\s+"analytics_admin_select"/i },
  { label: 'create policy analytics_admin_select (authenticated, private.is_admin())', re: /create\s+policy\s+"analytics_admin_select"[\s\S]+?for\s+select[\s\S]+?to\s+authenticated[\s\S]+?using\s*\(\s*\(\s*select\s+private\.is_admin\(\)\s*\)\s*\)/i },
  // Grants
  { label: 'grant insert on ... to anon', re: /grant\s+insert\s+on\s+public\.analytics_events\s+to\s+anon/i },
  { label: 'grant select on ... to authenticated', re: /grant\s+select\s+on\s+public\.analytics_events\s+to\s+authenticated/i },
  // Index
  { label: 'create index if not exists analytics_events_event_type_created_at_idx', re: /create\s+index\s+if\s+not\s+exists\s+analytics_events_event_type_created_at_idx\s+on\s+public\.analytics_events\s*\(\s*event_type\s*,\s*created_at\s+desc\s*\)/i },
];

// Forbidden content (A1 — migrations 002/003/004 NOT applied)
const FORBIDDEN = [
  { label: 'Must NOT contain catalog_item in CHECK enum (migration 003 not applied)', re: /'catalog_item'/ },
  { label: 'Must NOT contain started_at column (migration 002 not applied)', re: /\bstarted_at\s+timestamptz/i },
  { label: 'Must NOT contain ended_at column (migration 004 not applied)', re: /\bended_at\s+timestamptz/i },
  // Scope to the `create policy "analytics_admin_select" ... ;` statement only.
  // Using [^;]*? to stop at the policy-terminating semicolon (avoids false positives
  // from unrelated `grant ... to anon;` statements later in the file).
  { label: 'Admin SELECT must NOT target anon', re: /create\s+policy\s+"analytics_admin_select"[^;]*?\bto\s+anon\b/i },
  { label: 'Admin SELECT must NOT target public', re: /create\s+policy\s+"analytics_admin_select"[^;]*?\bto\s+public\b/i },
];

let passed = 0;
let failed = 0;

for (const c of CHECKS) {
  if (c.re.test(sql)) {
    console.log(`PASS  ${c.label}`);
    passed++;
  } else {
    console.error(`FAIL  ${c.label}`);
    failed++;
  }
}

for (const f of FORBIDDEN) {
  if (f.re.test(sql)) {
    console.error(`FORBIDDEN CONTENT PRESENT: ${f.label}`);
    failed++;
  } else {
    console.log(`PASS  ${f.label}`);
    passed++;
  }
}

console.log(`\n=== RESULT: ${passed} passed, ${failed} failed ===`);
if (failed > 0) exit(1);
exit(0);
