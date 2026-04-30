#!/usr/bin/env node
// scripts/verify-extension-app-source-scope.mjs
// Phase 2 / EXT-01..10 — static SQL grep verifier.
// Validates the extension RPC migration against the D-01 / D-02 / D-13
// invariants documented in .planning/phases/02-extension-analytics-extension/.
// Runs WITHOUT a database connection.
//
// Usage: node scripts/verify-extension-app-source-scope.mjs
// Exit codes: 0 = all invariants satisfied, 1 = at least one failure.
//
// Wired into root package.json as `prebuild` so `npm run build` runs it after
// the Phase 1 service-role guard.

import { readFileSync, existsSync } from 'node:fs';
import { exit } from 'node:process';

const TAG = '[verify-extension-app-source-scope]';
const MIGRATION_PATH = 'supabase/migrations/20260429120000_create_extension_rpcs.sql';

const RPC_NAMES = [
  'get_event_volume_daily',
  'get_kpi_totals',
  'get_error_rate_by_type',
  'get_per_user_summary',
  'get_dominant_version',
  'get_cancellation_rates',
];

const FIVE_EVENT_VOCAB =
  "'catalog_single', 'catalog_batch', 'portal_upload', 'spreadsheet_transform', 'data_import'";

if (!existsSync(MIGRATION_PATH)) {
  console.error(`${TAG} Migration file not found: ${MIGRATION_PATH}`);
  exit(1);
}

const raw = readFileSync(MIGRATION_PATH, 'utf8');

// Strip line comments before counting invariant occurrences. Without this, the
// header invariant block at the top of the migration would inflate every
// count and mask a missing real-code occurrence (planner system prompt:
// "grep gate hygiene rule").
const stripped = raw
  .split(/\r?\n/)
  .filter((line) => !line.trimStart().startsWith('--'))
  .join('\n');

const failures = [];

// Check 1 — function presence
for (const name of RPC_NAMES) {
  const re = new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${name}\\s*\\(`, 'i');
  if (!re.test(stripped)) {
    failures.push(`Missing function declaration: ${name}`);
  }
}

// Check 2 — D-01 invariant: app_source = 'tpc-extension' appears at least 6 times (one per function)
const appSourceMatches = stripped.match(/app_source\s*=\s*'tpc-extension'/g) || [];
if (appSourceMatches.length < 6) {
  failures.push(
    `D-01 invariant: expected ≥6 occurrences of "app_source = 'tpc-extension'" (one per function), found ${appSourceMatches.length}`,
  );
}

// Check 3 — D-02 invariant: 5-event vocabulary string appears at least 4 times
// (get_event_volume_daily, get_kpi_totals, get_error_rate_by_type, get_per_user_summary).
// get_dominant_version may also include it; get_cancellation_rates restricts to 2 types and is exempt.
const vocabRe = new RegExp(
  FIVE_EVENT_VOCAB.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*'),
  'g',
);
const vocabMatches = stripped.match(vocabRe) || [];
if (vocabMatches.length < 4) {
  failures.push(
    `D-02 invariant: 5-event vocabulary string appears ${vocabMatches.length} times; expected ≥4`,
  );
}

// Check 4 — D-13 invariant: 3-arg date_trunc with 'America/New_York'.
// Allows the bucket-unit scalar to come from a CTE (e.g. `(select unit from bounds)`),
// hence we do not constrain the body of the date_trunc call. We just require that
// at least one date_trunc(...) call appears whose final positional argument is the
// quoted ET zone literal. Multiline tolerant via [\s\S].
const dateTruncRe = /date_trunc\s*\([\s\S]*?,\s*'America\/New_York'\s*\)/;
if (!dateTruncRe.test(stripped)) {
  failures.push(
    `D-13 invariant: 3-arg form date_trunc(..., 'America/New_York') not found`,
  );
}
const atTimeZoneRe = /AT\s+TIME\s+ZONE\s+'America\/New_York'/i;
if (atTimeZoneRe.test(stripped)) {
  failures.push(
    `Pitfall 1 invariant: forbidden 2-arg form "AT TIME ZONE 'America/New_York'" found; use 3-arg date_trunc instead`,
  );
}

// Check 5 — language sql stable security invoker (case-insensitive, whitespace tolerant)
const langRe = /language\s+sql\s+stable\s+security\s+invoker/gi;
const langMatches = stripped.match(langRe) || [];
if (langMatches.length < 6) {
  failures.push(
    `Volatility/security invariant: "language sql stable security invoker" appears ${langMatches.length} times; expected ≥6`,
  );
}

// Check 6 — grant execute on function public.<name>(  for each RPC (Pitfall 9)
for (const name of RPC_NAMES) {
  const re = new RegExp(`grant\\s+execute\\s+on\\s+function\\s+public\\.${name}\\s*\\(`, 'i');
  if (!re.test(stripped)) {
    failures.push(`Missing grant execute for: ${name}`);
  }
}

if (failures.length > 0) {
  for (const f of failures) {
    console.error(`${TAG} ${f}`);
  }
  console.error(`${TAG} ${failures.length} failure(s).`);
  exit(1);
}

console.log(`${TAG} OK — 6 RPCs, all invariants satisfied.`);
exit(0);
