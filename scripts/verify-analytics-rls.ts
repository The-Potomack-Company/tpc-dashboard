// scripts/verify-analytics-rls.ts
// Phase 1 / INFR-05 — D-24 three-client RLS verification.
//
// Runs AFTER plan 01-01 Task 5's `supabase db push` applies the analytics_events
// migration. Asserts five properties in sequence:
//   (a) admin session SELECTs rows from public.analytics_events         → pass
//   (b) non-admin authenticated session SELECTs                          → 0 rows
//   (c) anon session INSERTs a fixture row                               → pass
//   (d) admin session SELECTs and sees the just-inserted fixture row     → pass
//   (e) admin session DELETEs the fixture row                            → cleanup
//
// Exit 0 on all pass; non-zero with diagnostic output on any fail.
// Usage: `npx tsx scripts/verify-analytics-rls.ts`
// Requires env vars:
//   SUPABASE_URL                       (shared, via scraper/.env)
//   SUPABASE_SERVICE_ROLE_KEY          (via scraper/.env)
//   SUPABASE_ANON_KEY                  (via scraper/.env — same as VITE_SUPABASE_ANON_KEY)
//   TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD       (a real admin user's creds)
//   TEST_NONADMIN_EMAIL, TEST_NONADMIN_PASSWORD (a real non-admin user's creds)

import { createClient } from '@supabase/supabase-js';
import { getAdminClient } from '../scraper/lib/supabase-admin';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const TEST_ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL;
const TEST_ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD;
const TEST_NONADMIN_EMAIL = process.env.TEST_NONADMIN_EMAIL;
const TEST_NONADMIN_PASSWORD = process.env.TEST_NONADMIN_PASSWORD;

function required<T>(v: T | undefined, name: string): T {
  if (!v) {
    console.error(`FATAL: ${name} is not set. See scripts/verify-analytics-rls.ts usage comments.`);
    process.exit(1);
  }
  return v;
}

async function main() {
  const url = required(SUPABASE_URL, 'SUPABASE_URL');
  const anonKey = required(SUPABASE_ANON_KEY, 'SUPABASE_ANON_KEY');
  const adminEmail = required(TEST_ADMIN_EMAIL, 'TEST_ADMIN_EMAIL');
  const adminPassword = required(TEST_ADMIN_PASSWORD, 'TEST_ADMIN_PASSWORD');
  const nonAdminEmail = required(TEST_NONADMIN_EMAIL, 'TEST_NONADMIN_EMAIL');
  const nonAdminPassword = required(TEST_NONADMIN_PASSWORD, 'TEST_NONADMIN_PASSWORD');

  // --- Set up three distinct clients ---
  const adminClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const nonAdminClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const anonClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Sign in admin and non-admin
  const { error: adminSignInErr } = await adminClient.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword,
  });
  if (adminSignInErr) {
    console.error('FATAL: admin signInWithPassword failed:', adminSignInErr.message);
    process.exit(2);
  }

  const { error: nonAdminSignInErr } = await nonAdminClient.auth.signInWithPassword({
    email: nonAdminEmail,
    password: nonAdminPassword,
  });
  if (nonAdminSignInErr) {
    console.error('FATAL: non-admin signInWithPassword failed:', nonAdminSignInErr.message);
    process.exit(2);
  }

  // Anon client: no signIn — stays anonymous.

  const results: string[] = [];
  let failed = 0;

  // --- (a) admin SELECT: must succeed ---
  const { data: adminSelectData, error: adminSelectErr } = await adminClient
    .from('analytics_events')
    .select('id')
    .limit(1);
  if (adminSelectErr) {
    results.push(`(a) admin SELECT: FAIL (error: ${adminSelectErr.message})`);
    failed++;
  } else {
    results.push(`(a) admin SELECT: pass (returned ${adminSelectData?.length ?? 0} rows)`);
  }

  // --- (b) non-admin SELECT: must return zero rows ---
  const { data: nonAdminData, error: nonAdminErr } = await nonAdminClient
    .from('analytics_events')
    .select('id');
  if (nonAdminErr) {
    results.push(`(b) non-admin SELECT: FAIL (error: ${nonAdminErr.message})`);
    failed++;
  } else if ((nonAdminData?.length ?? 0) > 0) {
    results.push(`(b) non-admin SELECT: FAIL (expected 0 rows, got ${nonAdminData!.length})`);
    failed++;
  } else {
    results.push('(b) non-admin SELECT: pass (0 rows)');
  }

  // --- (c) anon INSERT: must succeed (extension's policy preserved) ---
  const fixtureRow = {
    event_type: 'catalog_single',
    user_email: 'rls-verify@fixture.invalid',
    extension_version: '0.0.0-rls-verify',
    items_content: { __rls_verify__: true, ts: new Date().toISOString() },
  };
  const { data: anonInsertData, error: anonInsertErr } = await anonClient
    .from('analytics_events')
    .insert(fixtureRow)
    .select('id')
    .single();
  if (anonInsertErr) {
    results.push(`(c) anon INSERT: FAIL (error: ${anonInsertErr.message})`);
    failed++;
    // Can't continue with (d)/(e) — skip and report.
    printResultsAndExit(results, failed);
  }
  results.push(`(c) anon INSERT: pass (inserted id=${anonInsertData?.id})`);
  const fixtureId = anonInsertData!.id;

  // --- (d) admin SELECT round-trip: must see the fixture row ---
  const { data: adminRoundTripData, error: adminRoundTripErr } = await adminClient
    .from('analytics_events')
    .select('id, event_type, user_email')
    .eq('id', fixtureId)
    .single();
  if (adminRoundTripErr) {
    results.push(`(d) admin SELECT round-trip: FAIL (error: ${adminRoundTripErr.message})`);
    failed++;
  } else if (!adminRoundTripData || adminRoundTripData.id !== fixtureId) {
    results.push(`(d) admin SELECT round-trip: FAIL (fixture row not visible to admin)`);
    failed++;
  } else {
    results.push(`(d) admin SELECT round-trip: pass (saw id=${fixtureId})`);
  }

  // --- (e) cleanup: admin DELETE fixture row (uses service-role to bypass any row-scope DELETE policy) ---
  const admin = getAdminClient();
  const { error: cleanupErr } = await admin
    .from('analytics_events')
    .delete()
    .eq('id', fixtureId);
  if (cleanupErr) {
    results.push(`(e) cleanup: FAIL (error: ${cleanupErr.message}) — manual cleanup required for id=${fixtureId}`);
    failed++;
  } else {
    results.push('(e) cleanup: pass');
  }

  printResultsAndExit(results, failed);
}

function printResultsAndExit(results: string[], failed: number): never {
  console.log('=== PHASE 1 INFR-05 D-24 VERIFICATION ===');
  for (const r of results) console.log(r);
  if (failed > 0) {
    console.error(`\n${failed} step(s) FAILED.`);
    process.exit(3);
  }
  console.log('\nAll 5 steps passed.');
  process.exit(0);
}

main().catch((err) => {
  console.error('[verify-rls] FATAL:', err);
  process.exit(99);
});
