#!/usr/bin/env node
// scripts/verify-activity-bucket-tz.mjs
// Phase 3 / APP-01..12 — static SQL grep verifier.
// Validates the activity RPC migration against the D-30 invariant + Pitfall 1
// documented in .planning/phases/03-tpc-app-activity-activity/03-CONTEXT.md
// and 03-RESEARCH.md.
//
// D-30 invariant: every aggregation that buckets time MUST use the 3-arg
// form date_trunc('day' | 'hour', x, 'America/New_York'). The 2-arg form
// `(x AT TIME ZONE 'America/New_York')::date` is forbidden because it
// silently produces text/date instead of timestamptz, breaking the
// useTimezone ET formatting agreement on the client (Pitfall 1).
//
// Usage: node scripts/verify-activity-bucket-tz.mjs
// Exit codes: 0 = all invariants satisfied, 1 = at least one failure.

import { readFileSync, existsSync } from 'node:fs';
import { exit } from 'node:process';

const TAG = '[verify-activity-bucket-tz]';
const MIGRATION_PATH = 'supabase/migrations/20260430120000_phase_3_activity_rpcs.sql';

if (!existsSync(MIGRATION_PATH)) {
  console.error(`${TAG} Migration file not found: ${MIGRATION_PATH}`);
  exit(1);
}

const raw = readFileSync(MIGRATION_PATH, 'utf8');

// Strip line comments — the migration's header invariant block discusses the
// AT TIME ZONE form as a forbidden anti-pattern, and that comment must not
// trigger a false-positive failure.
const stripped = raw
  .split(/\r?\n/)
  .filter((line) => !line.trimStart().startsWith('--'))
  .join('\n');

const failures = [];

// Check 1 — 3-arg form `date_trunc('day'|'hour', <expr>, 'America/New_York')`
// MUST appear at least 2 times (one in get_today_kpis, one in
// get_items_per_specialist_14d). The expression argument can span lines, so
// allow [\s\S] in the middle slot but bound by `,\s*'America/New_York'\s*\)`.
const threeArgRe =
  /date_trunc\s*\(\s*'(?:day|hour)'\s*,\s*[\s\S]+?,\s*'America\/New_York'\s*\)/g;
const threeArgMatches = stripped.match(threeArgRe) || [];
if (threeArgMatches.length < 2) {
  failures.push(
    `D-30 invariant: expected ≥2 occurrences of 3-arg date_trunc(... 'America/New_York'), found ${threeArgMatches.length}`,
  );
}

// Check 2 — forbidden 2-arg form `AT TIME ZONE 'America/New_York'` MUST NOT
// appear anywhere. This catches the Pitfall 1 anti-pattern.
const atTimeZoneRe = /AT\s+TIME\s+ZONE\s+'America\/New_York'/gi;
let attzMatch;
while ((attzMatch = atTimeZoneRe.exec(stripped)) !== null) {
  const lineNo = stripped.slice(0, attzMatch.index).split('\n').length;
  failures.push(
    `Pitfall 1: forbidden 2-arg form "AT TIME ZONE 'America/New_York'" detected at line ~${lineNo}`,
  );
}

// Check 3 — bare 2-arg `date_trunc('day'|'hour', <expr>)` form MUST NOT appear.
// We detect this by walking every date_trunc(...) call and checking that the
// argument list contains a third comma-separated 'America/New_York' literal.
// A balanced-paren walker is needed because the middle expression itself can
// contain commas (e.g., `date_trunc('day', greatest(a, b))`).
const dateTruncCallRe = /date_trunc\s*\(/gi;
let dtMatch;
while ((dtMatch = dateTruncCallRe.exec(stripped)) !== null) {
  const openIdx = stripped.indexOf('(', dtMatch.index);
  if (openIdx === -1) continue;
  // Walk forward, tracking nesting depth, to find the matching close paren.
  let depth = 1;
  let i = openIdx + 1;
  while (i < stripped.length && depth > 0) {
    const ch = stripped[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (depth === 0) break;
    i++;
  }
  if (depth !== 0) continue;
  const argList = stripped.slice(openIdx + 1, i);
  if (!/'America\/New_York'/.test(argList)) {
    const lineNo = stripped.slice(0, dtMatch.index).split('\n').length;
    failures.push(
      `Pitfall 1: forbidden 2-arg date_trunc form (missing 'America/New_York' tz arg) detected at line ~${lineNo}`,
    );
  }
}

if (failures.length > 0) {
  for (const f of failures) {
    console.error(`${TAG} ${f}`);
  }
  console.error(`${TAG} ${failures.length} failure(s).`);
  exit(1);
}

console.log(
  `${TAG} OK — ${threeArgMatches.length} 3-arg date_trunc calls, no AT TIME ZONE / 2-arg leaks.`,
);
exit(0);
