// scripts/check-no-service-role-in-src.mjs
// Phase 1 / INFR-06 — prebuild guard.
// Walks src/ and checks index.html + vite.config.ts for any reference to
// SUPABASE_SERVICE_ROLE_KEY. Exits 1 on any match (blocks `npm run build`).
//
// Cross-platform: pure Node fs; no grep, no bash, no PowerShell gotchas.
// Wired into root package.json as `prebuild` so `npm run build` runs it first.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { exit } from 'node:process';

const TARGET = 'SUPABASE_SERVICE_ROLE_KEY';
const SOURCE_EXTS = /\.(ts|tsx|js|jsx|cjs|mjs)$/;
const SKIP_DIRS = new Set(['node_modules', 'dist', '.next', '.turbo']);

let hits = 0;

function reportHit(path) {
  console.error(`FATAL: '${TARGET}' must not appear in src/ or the frontend config. Found in: ${path}`);
  hits++;
}

function walkDir(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    let s;
    try {
      s = statSync(p);
    } catch {
      continue;
    }
    if (s.isDirectory()) {
      if (SKIP_DIRS.has(entry)) continue;
      walkDir(p);
    } else if (SOURCE_EXTS.test(entry)) {
      const contents = readFileSync(p, 'utf8');
      if (contents.includes(TARGET)) reportHit(p);
    }
  }
}

function checkFile(path) {
  if (!existsSync(path)) return;
  const contents = readFileSync(path, 'utf8');
  if (contents.includes(TARGET)) reportHit(path);
}

// Scan src/ recursively.
walkDir('src');

// Scan top-level frontend config files explicitly (Open Question 4 resolution).
checkFile('index.html');
checkFile('vite.config.ts');

if (hits > 0) {
  console.error(`\n${hits} file(s) contain the forbidden string. See scraper/README.md for the rule.`);
  exit(1);
}

console.log(`OK: No references to '${TARGET}' in src/, index.html, or vite.config.ts.`);
exit(0);
