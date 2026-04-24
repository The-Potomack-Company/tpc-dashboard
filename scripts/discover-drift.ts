// scripts/discover-drift.ts
// Phase 1 / INFR-02 — discovery step (D-05/D-08).
// Enumerates v1.0 remnants in the linked Supabase project so the drop
// migration reflects observed reality, not just CONTEXT.md memory.
// Runs via: `npx tsx scripts/discover-drift.ts`
// Requires: scraper/.env populated with SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.

import { getAdminClient } from '../scraper/lib/supabase-admin';
import { execSync } from 'node:child_process';

const TPC_APP_TABLES = ['profiles', 'sessions', 'items', 'photos', 'export_history'];
const EXTENSION_TABLES = ['analytics_events'];
const KEEP_TABLES = [...TPC_APP_TABLES, ...EXTENSION_TABLES];

const KEEP_FUNCTIONS = new Set(['handle_updated_at']); // private.* helpers live in `private` schema, not public

interface DriftReport {
  remoteOnlyMigrations: string[];
  publicTables: string[];
  publicFunctions: string[];
  publicViews: string[];
  dropCandidates: {
    tables: string[];
    functions: string[];
    views: string[];
  };
}

async function listPublicTables(): Promise<string[]> {
  const admin = getAdminClient();
  // information_schema.tables is readable by service_role; filter to public.
  const { data, error } = await admin
    .schema('information_schema' as never)
    .from('tables' as never)
    .select('table_name')
    .eq('table_schema', 'public')
    .neq('table_type', 'VIEW');
  if (error) throw error;
  return (data ?? []).map((r: { table_name: string }) => r.table_name).sort();
}

async function listPublicViews(): Promise<string[]> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .schema('information_schema' as never)
    .from('views' as never)
    .select('table_name')
    .eq('table_schema', 'public');
  if (error) throw error;
  return (data ?? []).map((r: { table_name: string }) => r.table_name).sort();
}

async function listPublicFunctions(): Promise<string[]> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .schema('information_schema' as never)
    .from('routines' as never)
    .select('routine_name')
    .eq('routine_schema', 'public');
  if (error) throw error;
  return (data ?? []).map((r: { routine_name: string }) => r.routine_name).sort();
}

function parseRemoteOnlyMigrations(): string[] {
  // `supabase migration list --linked` prints a text table. Remote-only rows
  // have an empty Local column. We parse with a defensive regex that matches
  // the 14-digit timestamp version string in the Remote column while Local is blank.
  let output: string;
  try {
    output = execSync('npx supabase migration list --linked', { encoding: 'utf8' });
  } catch (err) {
    console.error('[drift] `supabase migration list --linked` failed:', err);
    console.error('[drift] Ensure the project is linked: `npx supabase link --project-ref <ref>`');
    throw err;
  }
  const lines = output.split(/\r?\n/);
  const remoteOnly: string[] = [];
  // Text table format:
  //     Local          │      Remote         │      Time (UTC)
  //   ─────────────────┼─────────────────────┼───────────────────────
  //                    │ 20260401120000      │ 2026-04-01 12:00:00
  //   20260318000000   │ 20260318000000      │ 2026-03-18 00:00:00
  //
  // Regex: start-of-line whitespace, then column separator `│`, then whitespace,
  // then 14-digit timestamp (Remote column populated while Local is empty).
  const remoteOnlyRe = /^\s*│\s+(\d{14})\s+│/;
  for (const line of lines) {
    const m = remoteOnlyRe.exec(line);
    if (m) remoteOnly.push(m[1]);
  }
  return remoteOnly;
}

async function main() {
  const remoteOnlyMigrations = parseRemoteOnlyMigrations();
  const publicTables = await listPublicTables();
  const publicFunctions = await listPublicFunctions();
  const publicViews = await listPublicViews();

  const dropTableCandidates = publicTables.filter((t) => !KEEP_TABLES.includes(t));
  const dropFunctionCandidates = publicFunctions.filter((f) => !KEEP_FUNCTIONS.has(f));
  const dropViewCandidates = publicViews; // no known public views are kept

  const report: DriftReport = {
    remoteOnlyMigrations,
    publicTables,
    publicFunctions,
    publicViews,
    dropCandidates: {
      tables: dropTableCandidates,
      functions: dropFunctionCandidates,
      views: dropViewCandidates,
    },
  };

  console.log('=== PHASE 1 DRIFT DISCOVERY REPORT ===');
  console.log(JSON.stringify(report, null, 2));
  console.log('\n=== ACTIONS REQUIRED ===');
  if (remoteOnlyMigrations.length > 0) {
    console.log(`Run \`npx supabase migration repair --status reverted <version>\` for each of:`);
    for (const v of remoteOnlyMigrations) console.log(`  - ${v}`);
  } else {
    console.log('No remote-only migrations to repair.');
  }
  console.log(`\nDrop candidates (include in 20260424120000_drop_retired_v1_tables.sql):`);
  console.log(`  tables: ${JSON.stringify(dropTableCandidates)}`);
  console.log(`  functions: ${JSON.stringify(dropFunctionCandidates)}`);
  console.log(`  views: ${JSON.stringify(dropViewCandidates)}`);
}

main().catch((err) => {
  console.error('[drift] FATAL:', err);
  process.exit(1);
});
