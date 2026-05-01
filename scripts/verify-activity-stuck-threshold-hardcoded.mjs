#!/usr/bin/env node
// scripts/verify-activity-stuck-threshold-hardcoded.mjs
// Phase 3 / APP-11 — static SQL grep verifier.
// Validates the activity RPC migration against the D-24 invariant documented
// in .planning/phases/03-tpc-app-activity-activity/03-CONTEXT.md.
//
// D-24 invariant: get_stuck_items hard-codes the literal `interval '2 hours'`
// inside its body. It MUST NOT take a `p_threshold_hours` (or any other
// threshold-named) parameter. One source of truth means the alert card on
// /activity and the /activity/stuck page can never disagree on what counts
// as stuck.
//
// Usage: node scripts/verify-activity-stuck-threshold-hardcoded.mjs
// Exit codes: 0 = all invariants satisfied, 1 = at least one failure.

import { readFileSync, existsSync } from 'node:fs';
import { exit } from 'node:process';

const TAG = '[verify-activity-stuck-threshold-hardcoded]';
const MIGRATION_PATH = 'supabase/migrations/20260430120000_phase_3_activity_rpcs.sql';
const FN_NAME = 'get_stuck_items';

if (!existsSync(MIGRATION_PATH)) {
  console.error(`${TAG} Migration file not found: ${MIGRATION_PATH}`);
  exit(1);
}

const raw = readFileSync(MIGRATION_PATH, 'utf8');

// Strip line comments before counting.
const stripped = raw
  .split(/\r?\n/)
  .filter((line) => !line.trimStart().startsWith('--'))
  .join('\n');

const failures = [];

// Locate the get_stuck_items declaration in the comment-stripped content.
const declRe = new RegExp(
  `create\\s+or\\s+replace\\s+function\\s+public\\.${FN_NAME}\\s*\\(`,
  'i',
);
const declMatch = declRe.exec(stripped);
if (!declMatch) {
  console.error(`${TAG} Missing function declaration: ${FN_NAME}`);
  exit(1);
}

// Slice to the next `$$;` body terminator.
const sliceStart = declMatch.index;
const after = stripped.slice(sliceStart);
const endIdx = after.indexOf('$$;');
if (endIdx === -1) {
  console.error(`${TAG} Could not locate function body terminator ($$;) for: ${FN_NAME}`);
  exit(1);
}
const fullSlice = after.slice(0, endIdx);

// Extract the parameter list — text between the opening `(` of the declaration
// and the matching `)`. Walk balanced parens because default values may
// contain nested parens (e.g., `array[]::text[]` is paren-free but a future
// edit might add `(...)` defaults).
const openParenIdx = fullSlice.indexOf('(');
let depth = 1;
let pi = openParenIdx + 1;
while (pi < fullSlice.length && depth > 0) {
  const ch = fullSlice[pi];
  if (ch === '(') depth++;
  else if (ch === ')') depth--;
  if (depth === 0) break;
  pi++;
}
const paramList = fullSlice.slice(openParenIdx + 1, pi);

// Check 1 — D-24: forbidden threshold parameter names.
// The parameter list is comma-separated; each parameter starts with `p_<name>`.
// We forbid any parameter whose name contains `threshold`, `_hours`, `age`, or
// `stuck` in addition to the explicit names called out in the plan.
const forbiddenParamPatterns = [
  /\bp_[a-z0-9_]*threshold[a-z0-9_]*\b/i,
  /\bp_[a-z0-9_]*_hours\b/i,
  /\bp_age[a-z0-9_]*\b/i,
  /\bp_[a-z0-9_]*stuck[a-z0-9_]*\b/i,
];
for (const re of forbiddenParamPatterns) {
  const m = re.exec(paramList);
  if (m) {
    failures.push(
      `D-24 invariant: ${FN_NAME} signature contains a forbidden threshold parameter "${m[0]}" — threshold MUST be hard-coded`,
    );
  }
}

// Check 2 — D-24: literal `interval '2 hours'` MUST appear inside the function
// body (i.e., after the `as $$` marker). Use a tolerant regex for whitespace
// and case so reformatting doesn't break the check.
const bodyMarkerIdx = fullSlice.indexOf('as $$');
const fnBody = bodyMarkerIdx === -1 ? fullSlice : fullSlice.slice(bodyMarkerIdx);
const intervalRe = /interval\s+'2\s+hours'/i;
if (!intervalRe.test(fnBody)) {
  failures.push(
    `D-24 invariant: ${FN_NAME} body missing literal "interval '2 hours'"`,
  );
}

// Check 3 — defensive: no other interval literal that could shadow the 2-hour
// threshold (e.g., `interval '1 hour'` or `interval '30 minutes'` slipped in
// by a refactor). Allow any non-threshold interval literal elsewhere in the
// file via `interval` only being scanned inside the function body.
const allIntervalsRe = /interval\s+'(\d+\s+\w+)'/gi;
let im;
const otherIntervals = [];
while ((im = allIntervalsRe.exec(fnBody)) !== null) {
  if (!/^2\s+hours$/i.test(im[1])) {
    otherIntervals.push(im[1]);
  }
}
if (otherIntervals.length > 0) {
  failures.push(
    `D-24 invariant: ${FN_NAME} body contains non-2-hour interval literal(s) [${otherIntervals.map((s) => `"${s}"`).join(', ')}] — only "2 hours" is permitted`,
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
  `${TAG} OK — ${FN_NAME} hard-codes interval '2 hours' and signature has no threshold parameter.`,
);
exit(0);
