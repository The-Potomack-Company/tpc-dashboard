// Integration tests for scripts/import-pdfs.ts (DATA-01 CLI).
//
// Scenario 1: --dry-run --limit 3 against real PDFs in the developer's
//             ~/Projects/rfc_profiles/rfc_profiles/ directory. Skipped
//             automatically (via test.skipIf) when that directory does
//             not exist so CI / fresh clones don't fail.
//             Asserts: exit 0, 3 progress lines, parsePdf called 3×,
//             importSale never called (dry-run path must not write to DB).
//
// Scenario 2: missing SUPABASE_SERVICE_ROLE_KEY (non-dry-run). Asserts
//             exit 1 + stderr contains the env-var name and recovery
//             instructions (T-05 / T-06 threat model: clear error
//             messages without leaking secrets).
//
// These tests import main() directly (no child_process spawn) so we can
// inject argv, env, and a fake io capture object. That also keeps the
// test fast (no tsx startup per test case).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { existsSync } from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';

// --- Mocks ----------------------------------------------------------------
// We stub import-sale.js because Scenario 1 runs in dry-run mode and MUST
// never reach the DB. If the mock is called, the assertion fails loudly.
const importSaleSpy = vi.fn();
vi.mock('../lib/import-sale.js', () => ({
  importSale: importSaleSpy,
}));

// We spy on parsePdf via vi.spyOn AFTER importing the real module — we do
// NOT mock it because Scenario 1 depends on real parsing of real PDFs.
import * as parsePdfModule from '../lib/parse-pdf.js';

// Import main AFTER the vi.mock calls so import-pdfs.ts picks up the mocked
// import-sale.js module.
const { main } = await import('../import-pdfs.js');

// --- Helpers --------------------------------------------------------------

interface IoCapture {
  stdout: string[];
  stderr: string[];
  out: (s: string) => void;
  err: (s: string) => void;
  stdoutText: () => string;
  stderrText: () => string;
}

function makeIo(): IoCapture {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    stdout,
    stderr,
    out: (s: string) => stdout.push(s),
    err: (s: string) => stderr.push(s),
    stdoutText: () => stdout.join('\n'),
    stderrText: () => stderr.join('\n'),
  };
}

const rfcProfilesDir = join(
  os.homedir(),
  'Projects',
  'rfc_profiles',
  'rfc_profiles',
);
const hasFixtures = existsSync(rfcProfilesDir);

// --- Scenario 1: --dry-run --limit 3 --------------------------------------

describe.skipIf(!hasFixtures)(
  'import-pdfs CLI — Scenario 1: dry-run against real PDFs',
  () => {
    beforeEach(() => {
      importSaleSpy.mockReset();
      vi.restoreAllMocks();
    });

    it(
      'exits 0, parses 3 PDFs, and never calls importSale',
      async () => {
        const parseSpy = vi.spyOn(parsePdfModule, 'parsePdf');
        const io = makeIo();

        const result = await main({
          argv: ['--dry-run', '--limit', '3', '--source', rfcProfilesDir],
          env: { ...process.env },
          io,
        });

        expect(result.exitCode).toBe(0);
        expect(parseSpy).toHaveBeenCalledTimes(3);
        expect(importSaleSpy).not.toHaveBeenCalled();

        // Progress lines: [ 1/3 ] ... [ 2/3 ] ... [ 3/3 ] ...
        const text = io.stdoutText();
        expect(text).toMatch(/\[ 1\/3 \]/);
        expect(text).toMatch(/\[ 2\/3 \]/);
        expect(text).toMatch(/\[ 3\/3 \]/);
      },
      30000,
    );
  },
);

// --- Scenario 2: missing SUPABASE_SERVICE_ROLE_KEY ------------------------

describe('import-pdfs CLI — Scenario 2: missing SUPABASE_SERVICE_ROLE_KEY', () => {
  beforeEach(() => {
    importSaleSpy.mockReset();
  });

  it('exits 1 and prints recovery instructions when the key is missing (non-dry-run)', async () => {
    const io = makeIo();
    // Build an env without the service role key. We also scrub the .env.local
    // path by NOT loading dotenv in main() when a full env is provided (the
    // CLI should trust the caller-provided env as ground truth so the test
    // isn't contaminated by the developer's real .env.local).
    const env: NodeJS.ProcessEnv = { ...process.env };
    delete env.SUPABASE_SERVICE_ROLE_KEY;

    const result = await main({
      argv: [
        '--source',
        rfcProfilesDir, // any path; we never iterate files in this path
        '--limit',
        '1',
      ],
      env,
      io,
    });

    expect(result.exitCode).toBe(1);
    const stderrText = io.stderrText();
    expect(stderrText).toContain('SUPABASE_SERVICE_ROLE_KEY');
    // Recovery instructions mention where to get the key.
    expect(stderrText.toLowerCase()).toMatch(
      /service[_ ]role|supabase dashboard|project settings|get the service/,
    );

    // Importantly: importSale must not have been called — the CLI should
    // bail out BEFORE attempting any DB work.
    expect(importSaleSpy).not.toHaveBeenCalled();
  });
});
