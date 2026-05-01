#!/usr/bin/env node
// scripts/verify-activity-table-readonly.mjs
// Phase 3 / Phase Boundary — static SQL grep verifier.
// Validates the activity RPC migration against the Phase Boundary invariant
// documented in .planning/phases/03-tpc-app-activity-activity/03-CONTEXT.md.
//
// Phase Boundary: Phase 3 is read-only. The migration MUST NOT contain
// INSERT INTO / UPDATE / DELETE FROM / ALTER TABLE / TRUNCATE / DROP TABLE
// against any TPC App table (profiles, sessions, items, photos,
// export_history, ui_interactions). It also MUST NOT add or drop RLS
// policies on those tables (D-26).
//
// Phase 3 owns ZERO tables. Every table referenced is owned by the TPC App.
// The dashboard reads via SECURITY INVOKER RPCs and never writes.
//
// Usage: node scripts/verify-activity-table-readonly.mjs
// Exit codes: 0 = all invariants satisfied, 1 = at least one failure.

import { readFileSync, existsSync } from 'node:fs';
import { exit } from 'node:process';

const TAG = '[verify-activity-table-readonly]';
const MIGRATION_PATH = 'supabase/migrations/20260430120000_phase_3_activity_rpcs.sql';

const TPC_APP_TABLES = [
  'profiles',
  'sessions',
  'items',
  'photos',
  'export_history',
  'ui_interactions',
];

if (!existsSync(MIGRATION_PATH)) {
  console.error(`${TAG} Migration file not found: ${MIGRATION_PATH}`);
  exit(1);
}

const raw = readFileSync(MIGRATION_PATH, 'utf8');

// Strip line comments. The header invariant block calls out the forbidden
// patterns in plain English; without stripping the verifier would
// false-positive on its own documentation.
const stripped = raw
  .split(/\r?\n/)
  .filter((line) => !line.trimStart().startsWith('--'))
  .join('\n');

const failures = [];

// For each TPC App table, check for forbidden write/DDL operations. We use
// `\b` word boundaries to avoid matching e.g. `public.items_view` when
// looking for `public.items`. The `(?!_)` negative lookahead handles the
// edge case where a table name is a prefix of another (`items` vs
// `items_<suffix>`); since none of our six TPC App tables have such a
// neighbour today, we keep the simple `\b` form for clarity.
for (const table of TPC_APP_TABLES) {
  const forbiddenOps = [
    {
      label: 'INSERT INTO',
      re: new RegExp(`\\binsert\\s+into\\s+public\\.${table}\\b`, 'gi'),
    },
    {
      label: 'UPDATE',
      re: new RegExp(`\\bupdate\\s+public\\.${table}\\b`, 'gi'),
    },
    {
      label: 'DELETE FROM',
      re: new RegExp(`\\bdelete\\s+from\\s+public\\.${table}\\b`, 'gi'),
    },
    {
      label: 'ALTER TABLE',
      re: new RegExp(`\\balter\\s+table\\s+(?:if\\s+exists\\s+)?public\\.${table}\\b`, 'gi'),
    },
    {
      label: 'TRUNCATE',
      re: new RegExp(`\\btruncate\\s+(?:table\\s+)?public\\.${table}\\b`, 'gi'),
    },
    {
      label: 'DROP TABLE',
      re: new RegExp(`\\bdrop\\s+table\\s+(?:if\\s+exists\\s+)?public\\.${table}\\b`, 'gi'),
    },
  ];
  for (const { label, re } of forbiddenOps) {
    let m;
    while ((m = re.exec(stripped)) !== null) {
      const lineNo = stripped.slice(0, m.index).split('\n').length;
      failures.push(
        `Phase Boundary violation: forbidden write operation against TPC App table public.${table}: matched "${m[0]}" at line ~${lineNo}`,
      );
    }
  }

  // RLS policy modifications on TPC App tables are forbidden (D-26).
  // CREATE POLICY ... ON public.<table>
  const createPolicyRe = new RegExp(
    `\\bcreate\\s+policy\\b[\\s\\S]{0,200}?\\bon\\s+public\\.${table}\\b`,
    'gi',
  );
  let cp;
  while ((cp = createPolicyRe.exec(stripped)) !== null) {
    const lineNo = stripped.slice(0, cp.index).split('\n').length;
    failures.push(
      `Phase Boundary violation: forbidden RLS policy modification (CREATE POLICY) against TPC App table public.${table} at line ~${lineNo}`,
    );
  }

  // DROP POLICY ... ON public.<table>
  const dropPolicyRe = new RegExp(
    `\\bdrop\\s+policy\\b[\\s\\S]{0,200}?\\bon\\s+public\\.${table}\\b`,
    'gi',
  );
  let dp;
  while ((dp = dropPolicyRe.exec(stripped)) !== null) {
    const lineNo = stripped.slice(0, dp.index).split('\n').length;
    failures.push(
      `Phase Boundary violation: forbidden RLS policy modification (DROP POLICY) against TPC App table public.${table} at line ~${lineNo}`,
    );
  }
}

// Defense-in-depth: forbid CREATE TABLE / DROP COLUMN / ADD COLUMN against
// TPC App tables anywhere (these would be ALTER variants but DDL grammar can
// be sneaky — explicit checks are cheap).
for (const table of TPC_APP_TABLES) {
  const ddlPatterns = [
    {
      label: 'CREATE TABLE',
      re: new RegExp(`\\bcreate\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?public\\.${table}\\b`, 'gi'),
    },
  ];
  for (const { label, re } of ddlPatterns) {
    let m;
    while ((m = re.exec(stripped)) !== null) {
      const lineNo = stripped.slice(0, m.index).split('\n').length;
      failures.push(
        `Phase Boundary violation: forbidden DDL "${label}" against TPC App table public.${table} at line ~${lineNo}`,
      );
    }
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
  `${TAG} OK — no INSERT/UPDATE/DELETE/ALTER/TRUNCATE/DROP/policy ops against any TPC App table (${TPC_APP_TABLES.length} checked).`,
);
exit(0);
