#!/usr/bin/env node
// scripts/verify-activity-mode-filter-on-sessions.mjs
// Phase 3 / APP-01..12 — static SQL grep verifier.
// Validates the activity RPC migration against the D-20 invariant documented
// in .planning/phases/03-tpc-app-activity-activity/03-CONTEXT.md.
//
// D-20 invariant: every mode filter targets `sessions.mode`; NEVER `items.mode`.
// The TPC App data model has `items.mode` redundantly mirroring
// `sessions.mode`, but only `sessions.mode` is canonical. Filtering on
// `items.mode` would diverge if TPC App ever permits the redundant column to
// drift. This verifier blocks any such filter pattern at build time.
//
// Usage: node scripts/verify-activity-mode-filter-on-sessions.mjs
// Exit codes: 0 = all invariants satisfied, 1 = at least one failure.

import { readFileSync, existsSync } from 'node:fs';
import { exit } from 'node:process';

const TAG = '[verify-activity-mode-filter-on-sessions]';
const MIGRATION_PATH = 'supabase/migrations/20260430120000_phase_3_activity_rpcs.sql';

if (!existsSync(MIGRATION_PATH)) {
  console.error(`${TAG} Migration file not found: ${MIGRATION_PATH}`);
  exit(1);
}

const raw = readFileSync(MIGRATION_PATH, 'utf8');

// Strip line comments. The header invariant block discusses `items.mode` as a
// forbidden anti-pattern in plain English; without stripping the verifier
// would false-positive on its own documentation.
const stripped = raw
  .split(/\r?\n/)
  .filter((line) => !line.trimStart().startsWith('--'))
  .join('\n');

const failures = [];

// Check 1 — forbidden filter pattern `items.mode = p_mode`. Block both fully
// qualified and aliased forms (`i.mode = p_mode`).
const forbiddenPatterns = [
  { re: /\bitems\.mode\s*=\s*p_mode\b/gi, label: 'items.mode = p_mode' },
  { re: /\bi\.mode\s*=\s*p_mode\b/gi, label: 'i.mode = p_mode' },
  // Block forbidden array-form variants too:
  { re: /\bitems\.mode\s*=\s*any\s*\(/gi, label: 'items.mode = any(...)' },
  { re: /\bi\.mode\s*=\s*any\s*\(/gi, label: 'i.mode = any(...)' },
  // And the equality-with-string-literal form (e.g., `items.mode = 'house'`)
  // which would also bypass the canonical sessions.mode source.
  { re: /\bitems\.mode\s*=\s*'(?:house|sale)'/gi, label: "items.mode = 'house'/'sale'" },
  { re: /\bi\.mode\s*=\s*'(?:house|sale)'/gi, label: "i.mode = 'house'/'sale'" },
];
for (const { re, label } of forbiddenPatterns) {
  let m;
  while ((m = re.exec(stripped)) !== null) {
    const lineNo = stripped.slice(0, m.index).split('\n').length;
    failures.push(
      `D-20 invariant: forbidden filter "${label}" detected at line ~${lineNo} — mode filter MUST target sessions.mode`,
    );
  }
}

// Check 2 — at least 4 occurrences of the canonical `sessions.mode = p_mode`
// (or aliased `s.mode = p_mode`) pattern. The lower bound of 4 leaves
// refactor flexibility while still requiring the invariant to be load-bearing.
// In the migration produced by Plan 03-01 Task 1, the canonical pattern
// appears in: get_today_kpis (3x — sessions/items/exports CTEs),
// get_active_sessions (1), get_items_per_specialist_14d (1),
// get_ai_status_distribution (1), get_export_pipeline (1),
// get_house_sale_split (2 — scoped_sessions + scoped_items),
// get_stuck_items (1), get_failed_ai_breakdown (1).
const canonicalRe = /\b(?:sessions|s)\.mode\s*=\s*p_mode\b/gi;
const canonicalMatches = stripped.match(canonicalRe) || [];
if (canonicalMatches.length < 4) {
  failures.push(
    `D-20 invariant: expected ≥4 occurrences of "sessions.mode = p_mode" (or "s.mode = p_mode"), found ${canonicalMatches.length}`,
  );
}

if (failures.length > 0) {
  for (const f of failures) {
    console.error(`${TAG} ${f}`);
  }
  console.error(`${TAG} ${failures.length} failure(s).`);
  exit(1);
}

console.log(
  `${TAG} OK — ${canonicalMatches.length} canonical "sessions.mode = p_mode" filters, no items.mode leaks.`,
);
exit(0);
