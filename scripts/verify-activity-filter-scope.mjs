#!/usr/bin/env node
// scripts/verify-activity-filter-scope.mjs
// Phase 3 / D-14..D-18 + Specifics — static verifier for filter-scope JSDoc
// tags on every activity hook.
//
// Master rule (CONTEXT D-14..D-18): the global date range filter applies to
// `created_at`-based aggregates only. "Right-now" widgets ignore the date
// range. Specialist + mode filters apply to BOTH categories.
//
// Enforcement: every activity hook MUST carry a `@filterScope` JSDoc tag with
// one of these tokens, declaring its filter-scope class:
//   right-now      — today/now-anchored; ignores date range (D-14, D-15, D-18)
//   range-driven   — consumes useDateRange.from/.to (D-17)
//   fixed-window   — own bounds (e.g. trailing 14d) — does NOT consume useDateRange (D-16)
//   live-tail      — refetchInterval-based polling (D-32 Recent Events Feed)
//   one-shot       — fixed/static query (no date range, no live tail; e.g. walkthrough funnel D-32)
//
// Wave 1 state: src/hooks/activity/ does not yet exist (Plan 03-03 lands it).
// In that case, the verifier exits 0 with a "no files yet" notice.
//
// Wired into root package.json as `prebuild` in Task 4 of Plan 03-02.
//
// Usage: node scripts/verify-activity-filter-scope.mjs
// Exit codes: 0 = all hooks tagged correctly OR directory absent; 1 = ≥1 miss.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { exit } from 'node:process';

const TAG = '[verify-activity-filter-scope]';
const HOOKS_DIR = 'src/hooks/activity';

const ALLOWED = ['right-now', 'range-driven', 'fixed-window', 'live-tail', 'one-shot'];
const TAG_RE = /@filterScope\s+(right-now|range-driven|fixed-window|live-tail|one-shot)\b/i;

function walkTs(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) {
      out.push(...walkTs(p));
    } else if (
      ent.isFile() &&
      p.endsWith('.ts') &&
      !p.endsWith('.test.ts') &&
      !p.endsWith('.test.tsx') &&
      !p.endsWith('.d.ts')
    ) {
      out.push(p);
    }
  }
  return out;
}

if (!existsSync(HOOKS_DIR)) {
  console.log(
    `${TAG} OK — ${HOOKS_DIR} does not exist yet (Plan 03-03 pending). No files to scan.`,
  );
  exit(0);
}

const files = walkTs(HOOKS_DIR);

if (files.length === 0) {
  console.log(`${TAG} OK — ${HOOKS_DIR} is empty. No files to scan.`);
  exit(0);
}

const failures = [];

for (const file of files) {
  const raw = readFileSync(file, 'utf8');
  if (!TAG_RE.test(raw)) {
    failures.push(
      `Missing @filterScope JSDoc in ${file}; expected one of: ${ALLOWED.join(' | ')}`,
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

console.log(`${TAG} OK — ${files.length} hook file(s) scanned; every file carries @filterScope JSDoc tag.`);
exit(0);
