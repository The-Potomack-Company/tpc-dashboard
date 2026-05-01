#!/usr/bin/env node
// scripts/verify-activity-app-source-scope.mjs
// Phase 3 / APP-01..12 — static SQL grep verifier.
// Validates the activity RPC migration against the D-33 invariant documented
// in .planning/phases/03-tpc-app-activity-activity/03-CONTEXT.md.
// Runs WITHOUT a database connection.
//
// D-33 invariant: every reference to public.ui_interactions in the migration
// body must be paired with `app_source = 'tpc-app'` so multi-app shared rows
// from the extension (`app_source = 'tpc-extension'`) and any future apps
// never bleed into TPC-App-only aggregates. Mirrors the Phase 2 D-01
// enforcement convention (see scripts/verify-extension-app-source-scope.mjs).
//
// Usage: node scripts/verify-activity-app-source-scope.mjs
// Exit codes: 0 = all invariants satisfied, 1 = at least one failure.
//
// Plan 03-02 wires this into root package.json `prebuild` so `npm run build`
// runs it after the Phase 1 service-role guard and the Phase 2 extension
// app-source verifier.

import { readFileSync, existsSync } from 'node:fs';
import { exit } from 'node:process';

const TAG = '[verify-activity-app-source-scope]';
const MIGRATION_PATH = 'supabase/migrations/20260430120000_phase_3_activity_rpcs.sql';

// The 3 RPCs that read public.ui_interactions. Every one of these MUST scope
// by `app_source = 'tpc-app'` inside its body.
const UI_INTERACTIONS_RPCS = [
  'get_ui_top_pages',
  'get_ui_top_elements',
  'get_walkthrough_funnel',
];

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

// Check 1 — D-33 invariant: at least 3 occurrences of `app_source = 'tpc-app'`
// (one per ui_interactions RPC).
const appSourceMatches = stripped.match(/app_source\s*=\s*'tpc-app'/g) || [];
if (appSourceMatches.length < UI_INTERACTIONS_RPCS.length) {
  failures.push(
    `D-33 invariant: expected ≥${UI_INTERACTIONS_RPCS.length} occurrences of "app_source = 'tpc-app'" (one per ui_interactions RPC), found ${appSourceMatches.length}`,
  );
}

// Check 2 — for each ui_interactions RPC, slice from the `create or replace
// function public.<name>` declaration through the matching `$$;` and assert
// `app_source = 'tpc-app'` appears within that slice. Also assert
// `public.ui_interactions` is referenced inside that same slice (otherwise the
// RPC list is stale).
for (const name of UI_INTERACTIONS_RPCS) {
  const declRe = new RegExp(
    `create\\s+or\\s+replace\\s+function\\s+public\\.${name}\\s*\\(`,
    'i',
  );
  const declMatch = declRe.exec(stripped);
  if (!declMatch) {
    failures.push(`Missing function declaration: ${name}`);
    continue;
  }
  // Slice from the start of the declaration to the next `$$;` terminator.
  const sliceStart = declMatch.index;
  const after = stripped.slice(sliceStart);
  const endIdx = after.indexOf('$$;');
  if (endIdx === -1) {
    failures.push(`Could not locate function body terminator ($$;) for: ${name}`);
    continue;
  }
  const body = after.slice(0, endIdx);

  if (!/public\.ui_interactions/i.test(body)) {
    failures.push(
      `D-33 invariant: ${name} is declared as a ui_interactions RPC but its body does not reference public.ui_interactions (verifier list out of sync)`,
    );
    continue;
  }
  if (!/app_source\s*=\s*'tpc-app'/.test(body)) {
    failures.push(
      `D-33 invariant: ${name} body references public.ui_interactions but missing app_source = 'tpc-app' filter`,
    );
  }
}

// Check 3 — every occurrence of `public.ui_interactions` anywhere in the
// migration must be inside an RPC body that also includes `app_source =
// 'tpc-app'`. Walk every match and check the surrounding 30 lines (forward,
// since the FROM clause precedes the WHERE).
const uiRefRe = /public\.ui_interactions/gi;
let m;
while ((m = uiRefRe.exec(stripped)) !== null) {
  // Look ahead within the next ~30 lines (≈2400 chars) for `app_source =
  // 'tpc-app'`. This is a soft secondary check — Check 2 is the strict per-RPC
  // assertion. This catches stray references that don't sit inside one of the
  // declared UI_INTERACTIONS_RPCS function bodies.
  const after = stripped.slice(m.index, m.index + 2400);
  if (!/app_source\s*=\s*'tpc-app'/.test(after)) {
    // Compute approximate line number for the diagnostic.
    const lineNo = stripped.slice(0, m.index).split('\n').length;
    failures.push(
      `D-33 invariant: public.ui_interactions reference at line ~${lineNo} not paired with "app_source = 'tpc-app'" within the next 30 lines`,
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
  `${TAG} OK — ${appSourceMatches.length} app_source filters, ${UI_INTERACTIONS_RPCS.length} ui_interactions RPCs verified.`,
);
exit(0);
