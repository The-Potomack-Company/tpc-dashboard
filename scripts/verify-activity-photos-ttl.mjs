#!/usr/bin/env node
// scripts/verify-activity-photos-ttl.mjs
// Phase 3 / D-08 / D-11 — static verifier for useSignedPhotoUrl invariants.
//
// Validates that src/hooks/useSignedPhotoUrl.ts contains the literal tokens
// that make Success Criterion #5 (the 2-hour tab-resume thumbnail repaint)
// work correctly:
//   - createSignedUrl(path, 3600)   (D-11 TTL — matches TPC App)
//   - refetchOnWindowFocus: true    (D-08 override of global default)
//   - staleTime: 50 * 60 * 1000     (D-11 — 10min before TTL expiry)
//   - gcTime:    10 * 60 * 1000     (D-11 — flexibility on whitespace)
//   - retry: 1                      (D-11 retry policy)
//
// Runs WITHOUT a database connection. Wired into root package.json as
// `prebuild` (in Task 4 of Plan 03-02 — the consolidated single-edit).
//
// Usage: node scripts/verify-activity-photos-ttl.mjs
// Exit codes: 0 = all invariants satisfied, 1 = at least one failure.

import { readFileSync, existsSync } from 'node:fs';
import { exit } from 'node:process';

const TAG = '[verify-activity-photos-ttl]';
const HOOK_PATH = 'src/hooks/useSignedPhotoUrl.ts';

if (!existsSync(HOOK_PATH)) {
  console.error(`${TAG} Hook file not found: ${HOOK_PATH}`);
  exit(1);
}

const raw = readFileSync(HOOK_PATH, 'utf8');

// Strip line + block comments before counting invariant occurrences.
// Without this, header comment blocks at the top of the hook would
// inflate every count and mask a missing real-code occurrence (planner
// system prompt: "grep gate hygiene rule"). Phase 2 verifier idiom.
const stripped = raw
  .split(/\r?\n/)
  .filter((line) => !line.trimStart().startsWith('//'))
  .join('\n')
  .replace(/\/\*[\s\S]*?\*\//g, ''); // strip /* ... */ block comments too

const failures = [];

// D-11 invariant: TTL = 3600s (whitespace tolerant).
if (!/createSignedUrl\s*\(\s*path\s*,\s*3600\s*\)/.test(stripped)) {
  failures.push(
    `D-11 invariant: literal "createSignedUrl(path, 3600)" not found in ${HOOK_PATH}`,
  );
}

// D-08 invariant: refetch-on-focus override of global default.
if (!/refetchOnWindowFocus\s*:\s*true/.test(stripped)) {
  failures.push(
    `D-08 invariant: literal "refetchOnWindowFocus: true" not found in ${HOOK_PATH}`,
  );
}

// D-11 invariant: staleTime = 50 * 60 * 1000 (50min — refetch 10min before
// TTL expiry).
if (!/staleTime\s*:\s*50\s*\*\s*60\s*\*\s*1000/.test(stripped)) {
  failures.push(
    `D-11 invariant: literal "staleTime: 50 * 60 * 1000" not found in ${HOOK_PATH}`,
  );
}

// D-11 invariant: gcTime = 10 * 60 * 1000 (10min cache after unmount).
// Whitespace tolerant — the hook may use aligned whitespace (`gcTime:    `).
if (!/gcTime\s*:\s*10\s*\*\s*60\s*\*\s*1000/.test(stripped)) {
  failures.push(
    `D-11 invariant: literal "gcTime: 10 * 60 * 1000" not found in ${HOOK_PATH}`,
  );
}

// D-11 invariant: retry policy.
if (!/retry\s*:\s*1\b/.test(stripped)) {
  failures.push(`D-11 invariant: literal "retry: 1" not found in ${HOOK_PATH}`);
}

if (failures.length > 0) {
  for (const f of failures) {
    console.error(`${TAG} ${f}`);
  }
  console.error(`${TAG} ${failures.length} failure(s).`);
  exit(1);
}

console.log(
  `${TAG} OK — useSignedPhotoUrl D-08 + D-11 invariants present (TTL=3600s, refetchOnWindowFocus=true, staleTime=50min, gcTime=10min, retry=1).`,
);
exit(0);
