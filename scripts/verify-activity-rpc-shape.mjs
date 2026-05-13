#!/usr/bin/env node
// scripts/verify-activity-rpc-shape.mjs
// Phase 3 / APP-01..12 — static SQL grep verifier.
// Validates the activity RPC migration shape: each of the 13 RPCs is declared,
// each is `language sql stable security invoker`, and each has a matching
// `grant execute on function public.<name>(...) to authenticated`.
//
// Why `security invoker`: the RPC body runs in the calling user's role
// context, so the existing TPC App admin-read-all RLS policies on profiles /
// sessions / items / photos / export_history / ui_interactions gate row
// visibility. A `security definer` declaration would bypass those policies
// and surface non-admin data to non-admins.
//
// Why explicit `grant execute`: PostgREST won't expose the function over the
// REST surface unless the role can EXECUTE it. The TPC App's RLS only
// matters once the call reaches PG; the grant is the gate at the outer
// PostgREST layer.
//
// Usage: node scripts/verify-activity-rpc-shape.mjs
// Exit codes: 0 = all invariants satisfied, 1 = at least one failure.

import { readFileSync, existsSync } from 'node:fs';
import { exit } from 'node:process';

const TAG = '[verify-activity-rpc-shape]';
const MIGRATION_PATH = 'supabase/migrations/20260430120000_phase_3_activity_rpcs.sql';

const RPC_NAMES = [
  'get_today_kpis',
  'get_active_sessions',
  'get_items_per_specialist_14d',
  'get_ai_status_distribution',
  'get_export_pipeline',
  'get_house_sale_split',
  'get_stuck_items',
  'get_failed_ai_breakdown',
  'get_session_detail',
  'get_photo_coverage',
  'get_ui_top_pages',
  'get_ui_top_elements',
  'get_walkthrough_funnel',
];

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

// Check 1 — every RPC has a `create or replace function public.<name>` declaration.
for (const name of RPC_NAMES) {
  const re = new RegExp(
    `create\\s+or\\s+replace\\s+function\\s+public\\.${name}\\s*\\(`,
    'i',
  );
  if (!re.test(stripped)) {
    failures.push(`Missing function declaration: ${name}`);
  }
}

// Check 2 — every RPC body declares `language sql stable security invoker`.
// We check this per-function by slicing from the declaration to the next
// `$$;` and asserting the volatility/security clause appears in that slice.
// A whole-file count would mask a missing per-function declaration if some
// other clause inflated the total.
for (const name of RPC_NAMES) {
  const declRe = new RegExp(
    `create\\s+or\\s+replace\\s+function\\s+public\\.${name}\\s*\\(`,
    'i',
  );
  const declMatch = declRe.exec(stripped);
  if (!declMatch) continue; // already reported above
  const after = stripped.slice(declMatch.index);
  const endIdx = after.indexOf('$$;');
  if (endIdx === -1) {
    failures.push(`Could not locate function body terminator ($$;) for: ${name}`);
    continue;
  }
  const slice = after.slice(0, endIdx);
  const langRe = /language\s+sql\s+stable\s+security\s+invoker/i;
  if (!langRe.test(slice)) {
    failures.push(`Missing 'language sql stable security invoker' for: ${name}`);
  }
}

// Check 3 — every RPC has a matching `grant execute on function
// public.<name>(...) to authenticated` somewhere in the file. The argument
// list isn't validated structurally here; a separate signature-shape check
// would require a real SQL parser. We just assert the grant statement exists.
for (const name of RPC_NAMES) {
  const re = new RegExp(
    `grant\\s+execute\\s+on\\s+function\\s+public\\.${name}\\s*\\(`,
    'i',
  );
  if (!re.test(stripped)) {
    failures.push(`Missing grant execute for: ${name}`);
  }
}

// Check 4 — global sanity: total `language sql stable security invoker`
// occurrences ≥ RPC_NAMES.length. This catches a class of bug where one
// RPC's clause was accidentally deleted but another's was duplicated.
const langGlobalMatches =
  stripped.match(/language\s+sql\s+stable\s+security\s+invoker/gi) || [];
if (langGlobalMatches.length < RPC_NAMES.length) {
  failures.push(
    `Volatility/security invariant: "language sql stable security invoker" appears ${langGlobalMatches.length} times; expected ≥${RPC_NAMES.length}`,
  );
}

// Check 5 — Phase 3 must NOT declare any RPC as `security definer`. RLS gates
// row visibility via the calling JWT; a definer bypass would surface
// non-admin data to non-admins.
const definerRe = /security\s+definer/gi;
let dm;
while ((dm = definerRe.exec(stripped)) !== null) {
  const lineNo = stripped.slice(0, dm.index).split('\n').length;
  failures.push(
    `Forbidden "security definer" detected at line ~${lineNo} — Phase 3 RPCs MUST be security invoker so RLS stays authoritative`,
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
  `${TAG} OK — ${RPC_NAMES.length} RPCs, all security invoker, all granted to authenticated.`,
);
exit(0);
