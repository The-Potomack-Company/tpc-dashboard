#!/usr/bin/env node
// scripts/verify-activity-error-state-contract.mjs
// Phase 3 / D-35 — verify every <ErrorState ... /> use across the activity
// surface has all 3 required props (heading, body, onRetry) AND no sibling
// JSX element labeled "Retry" (a button or link with text "Retry") in the
// same enclosing JSX block.
//
// LOCKED `<ErrorState>` CONTRACT (CONTEXT D-35):
//   <ErrorState heading="..." body="..." onRetry={...} />
//   The component renders its own internal Retry button. NO sibling Retry
//   buttons. NO children syntax. NO missing props.
//
// Scope (globbed):
//   - src/components/activity/**/*.tsx
//   - src/pages/Activity.tsx
//   - src/pages/SessionDetail.tsx
//   - src/pages/StuckItems.tsx
//
// Wave 1 state: components/pages absent — verifier exits 0 with notice.
// Wired into root package.json `prebuild` chain in Task 4 of Plan 03-02.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { exit } from 'node:process';

const TAG = '[verify-activity-error-state-contract]';

const COMPONENTS_DIR = 'src/components/activity';
const PAGE_FILES = [
  'src/pages/Activity.tsx',
  'src/pages/SessionDetail.tsx',
  'src/pages/StuckItems.tsx',
];

function walkTsx(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) {
      out.push(...walkTsx(p));
    } else if (
      ent.isFile() &&
      p.endsWith('.tsx') &&
      !p.endsWith('.test.tsx')
    ) {
      out.push(p);
    }
  }
  return out;
}

const files = [
  ...walkTsx(COMPONENTS_DIR),
  ...PAGE_FILES.filter((p) => existsSync(p)),
];

if (files.length === 0) {
  console.log(
    `${TAG} OK — no activity components or pages exist yet (pre-Wave-3 state).`,
  );
  exit(0);
}

const failures = [];

// Match every <ErrorState ... /> open-tag (self-closing OR with attributes
// spanning multiple lines). Capture the attribute block so we can scan for
// required props.
const ERROR_STATE_OPEN = /<ErrorState\b([\s\S]*?)\/>/g;

for (const file of files) {
  const raw = readFileSync(file, 'utf8');
  const lines = raw.split(/\r?\n/);

  // Helper: line number for a string offset.
  function offsetToLine(offset) {
    return raw.slice(0, offset).split(/\r?\n/).length;
  }

  let m;
  while ((m = ERROR_STATE_OPEN.exec(raw)) !== null) {
    const attrs = m[1];
    const lineNum = offsetToLine(m.index);
    const site = `${file}:${lineNum}`;

    // Each of the 3 required props must appear in the captured attribute block.
    if (!/\bheading\s*=\s*[\{"']/.test(attrs)) {
      failures.push(
        `${site}: <ErrorState> missing required prop "heading" — D-35 contract: { heading: string; body: string; onRetry: () => void }`,
      );
    }
    if (!/\bbody\s*=\s*[\{"']/.test(attrs)) {
      failures.push(
        `${site}: <ErrorState> missing required prop "body"`,
      );
    }
    if (!/\bonRetry\s*=\s*\{/.test(attrs)) {
      failures.push(
        `${site}: <ErrorState> missing required prop "onRetry"`,
      );
    }

    // Sibling Retry detection — scan the SAME enclosing JSX block (a window
    // of ±25 lines is a good first-cut; D-35 prohibits sibling Retry
    // buttons/links anywhere "near" an ErrorState).
    const startLine = Math.max(0, lineNum - 25);
    const endLine = Math.min(lines.length, lineNum + 25);
    const window = lines.slice(startLine, endLine).join('\n');

    // Detect sibling buttons/links labeled "Retry":
    //   <button ...>Retry</button>
    //   <a ...>Retry</a>
    //   <Link ...>Retry</Link>
    //   <SomeButton ...>Retry</SomeButton>
    // The ±25-line window is wider than the ErrorState tag itself — false
    // positives are possible if a sibling component happens to have a
    // "Retry" label legitimately. In that case, refactor to use the
    // ErrorState's built-in retry.
    const siblingRetry = />\s*Retry\s*</;
    if (siblingRetry.test(window)) {
      failures.push(
        `${site}: D-35 violation — found a sibling "Retry" JSX element near <ErrorState> in ${file}. The locked ErrorState contract REQUIRES the component's own internal Retry button to be the sole Retry affordance. Remove the sibling element OR move the retry logic into ErrorState's onRetry callback.`,
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
  `${TAG} OK — ${files.length} files scanned; every <ErrorState> has heading + body + onRetry; no sibling Retry siblings detected.`,
);
exit(0);
