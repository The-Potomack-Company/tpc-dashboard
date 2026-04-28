// scripts/verify-no-kit-in-dist.mjs
// Phase 1 / INFR-03 — post-build tree-shake verifier.
// Asserts the production dist/ bundle does NOT contain any reference to the
// dev-only /kit demo page. Run after `npm run build`.
// Usage: node scripts/verify-no-kit-in-dist.mjs

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { exit } from 'node:process';

const DIST = 'dist';

// Forbidden substrings — any of these in the production bundle means the
// dev gate failed to tree-shake. "KitPage" is the exported symbol; "routes/kit"
// would be emitted by some chunker configs; `"/kit"` (quoted) is the route
// path literal inside App.tsx that would only exist if the conditional route
// registered.
const FORBIDDEN = ['KitPage', 'routes/kit', '"/kit"'];

// Only scan text-like bundle artifacts. Source maps (.map) can legitimately
// contain symbol names for debugging — exclude them from the check.
const SCAN_EXTS = /\.(js|mjs|cjs|html|css)$/;

if (!existsSync(DIST)) {
  console.error(`FATAL: ${DIST}/ does not exist. Run \`npm run build\` first.`);
  exit(1);
}

let hits = 0;

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    let s;
    try {
      s = statSync(p);
    } catch {
      continue;
    }
    if (s.isDirectory()) {
      walk(p);
      continue;
    }
    if (!SCAN_EXTS.test(entry)) continue;
    const contents = readFileSync(p, 'utf8');
    for (const needle of FORBIDDEN) {
      if (contents.includes(needle)) {
        console.error(`LEAK: '${needle}' found in production bundle: ${p}`);
        hits++;
      }
    }
  }
}

walk(DIST);

if (hits > 0) {
  console.error(`\n${hits} leak(s) detected. The /kit page was NOT tree-shaken from the production bundle.`);
  console.error('Check src/App.tsx: confirm the import.meta.env.DEV guard + top-level await pattern is intact.');
  exit(1);
}

console.log(`OK: No references to ${FORBIDDEN.join(', ')} in ${DIST}/. /kit is dev-only.`);
exit(0);
