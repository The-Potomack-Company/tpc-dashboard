// scripts/import-pdfs.ts — CLI entry point for the PDF import pipeline (DATA-01).
//
// Iterates the RFC auction profile PDFs, invokes parsePdf + importSale per
// file, logs progress, and records a single scraper_runs row covering the
// run. Supports --dry-run (no DB writes) and --limit (process first N files).
//
// Threat-model mitigations embedded in this file:
//   T-05 (wrong-DB target): pre-flight banner prints source + target +
//                           mode + file count, then a 3-second Ctrl+C window
//                           before any DB write.
//   T-06 (secret exposure): banner logs SUPABASE_URL only, NEVER the service
//                           role key. We never dump the environment object
//                           to stdout/stderr. Verbose mode uses an explicit
//                           allowlist.
//   T-03 (malformed PDF):   parsePdf catches its own errors and returns a
//                           { status: 'failed' } variant — we never re-throw,
//                           so one bad file can't abort a 457-file batch.
//   T-08 (abort mid-run):   orphaned 'running' rows in scraper_runs are
//                           accepted — each sale is its own atomic unit.
//
// The file exports `main()` so the integration test can invoke it with a
// synthetic argv/env/io triple. When run directly via tsx, the bottom-of-
// file guard kicks off main() with real process state.

import { parseArgs } from 'node:util';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import os from 'node:os';
import { config as loadEnv } from 'dotenv';
import { parsePdf } from './lib/parse-pdf.js';

// --- Types ----------------------------------------------------------------

export interface RunSummary {
  total: number;
  inserted: number;
  skipped_duplicate: number;
  skipped_empty: number;
  failed: number;
  validation_warnings: number;
  dry_run_ok: number;
  duration_ms: number;
  failures: Array<{ sale_number: string; error: string }>;
}

export interface MainOverrides {
  argv?: string[];
  env?: NodeJS.ProcessEnv;
  io?: {
    out: (s: string) => void;
    err: (s: string) => void;
  };
  /**
   * Skip the 3-second banner pause. Tests override this so they don't
   * block for 3 seconds each. Defaults to false in real runs.
   */
  skipBannerDelay?: boolean;
}

interface ParsedArgs {
  source: string;
  dryRun: boolean;
  limit: number | undefined;
  verbose: boolean;
  toleranceDollars: number;
  help: boolean;
}

const HELP_TEXT = `
Usage: npm run import:pdfs -- [options]

Options:
  --source <dir>                    Directory containing RFC auction profile PDFs.
                                    Default: ~/Projects/rfc_profiles/rfc_profiles
  --dry-run                         Parse + validate only. No DB writes.
  --limit <N>                       Process first N PDFs (sorted by filename).
  --verbose                         Print extra per-file diagnostic info.
  --cross-validation-tolerance <D>  Dollar tolerance for dept-sum vs sale totals.
                                    Default: 0.25
  --help                            Print this help and exit.
`.trim();

// --- Entry point ----------------------------------------------------------

export async function main(
  overrides: MainOverrides = {},
): Promise<{ exitCode: number; summary?: RunSummary }> {
  const argv = overrides.argv ?? process.argv.slice(2);
  const io = overrides.io ?? {
    out: (s: string) => console.log(s),
    err: (s: string) => console.error(s),
  };

  // Parse flags first so --help works without any side effects.
  let parsed: ParsedArgs;
  try {
    parsed = parseArgv(argv);
  } catch (err) {
    io.err(`ERROR: ${err instanceof Error ? err.message : String(err)}`);
    io.err('');
    io.err(HELP_TEXT);
    return { exitCode: 1 };
  }

  if (parsed.help) {
    io.out(HELP_TEXT);
    return { exitCode: 0 };
  }

  // Load dotenv ONLY if the caller did not supply an env override. Tests
  // pass an explicit env so we don't want .env.local to clobber it.
  if (!overrides.env) {
    loadEnv({ path: '.env.local' });
  }
  const env = overrides.env ?? process.env;

  // Env-var check: required for non-dry-run; skipped for --dry-run since
  // that path never talks to Supabase.
  if (!parsed.dryRun) {
    if (!env.SUPABASE_SERVICE_ROLE_KEY) {
      io.err('ERROR: SUPABASE_SERVICE_ROLE_KEY missing from .env.local');
      io.err('');
      io.err('Recovery:');
      io.err('  1. Open Supabase dashboard -> Project Settings -> API');
      io.err('  2. Copy the `service_role` secret (NOT the anon key)');
      io.err('  3. Add to .env.local: SUPABASE_SERVICE_ROLE_KEY=<paste>');
      io.err('  4. Retry: npm run import:pdfs');
      return { exitCode: 1 };
    }
  }

  // --- File enumeration ---------------------------------------------------
  let allFiles: string[];
  try {
    const entries = await readdir(parsed.source);
    allFiles = entries.filter((n) => /\.PDF$/i.test(n)).sort();
  } catch (err) {
    io.err(
      `ERROR: could not read source directory ${parsed.source}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    return { exitCode: 1 };
  }

  if (allFiles.length === 0) {
    io.err(`ERROR: no .PDF files found in ${parsed.source}`);
    return { exitCode: 1 };
  }

  const files =
    parsed.limit !== undefined ? allFiles.slice(0, parsed.limit) : allFiles;

  // --- Banner (T-05 mitigation) ------------------------------------------
  const supabaseUrl =
    env.SUPABASE_URL ?? env.VITE_SUPABASE_URL ?? '<not configured>';
  printBanner(io, {
    source: parsed.source,
    supabaseUrl,
    totalFiles: allFiles.length,
    iterFiles: files.length,
    dryRun: parsed.dryRun,
    toleranceDollars: parsed.toleranceDollars,
    verbose: parsed.verbose,
  });

  // Live runs get a 3-second delay so the operator can Ctrl+C out of
  // a mis-targeted import. Dry runs and tests skip the delay.
  if (!parsed.dryRun && !overrides.skipBannerDelay) {
    await new Promise((r) => setTimeout(r, 3000));
  }

  // --- scraper_runs lifecycle (live only) --------------------------------
  // Lazy-load the admin client so unit tests that never hit the DB path
  // never trigger the module-level env-var guard inside supabase-admin.ts.
  let runId: string | null = null;
  let importSaleFn: typeof import('./lib/import-sale.js').importSale | null =
    null;
  type SupabaseAdminClient =
    typeof import('./lib/supabase-admin.js').supabaseAdmin;
  let admin: SupabaseAdminClient | null = null;

  if (!parsed.dryRun) {
    try {
      const importSaleModule = await import('./lib/import-sale.js');
      importSaleFn = importSaleModule.importSale;

      const adminModule = await import('./lib/supabase-admin.js');
      admin = adminModule.supabaseAdmin;

      // WR-04: sales_found reflects the corpus size (pre-limit), not the
      // subset this run chose to process. An operator inspecting the DB
      // should see "how many PDFs are in the source directory", not
      // "how many this particular invocation asked for". The actually-
      // processed count lands in logs.processed.
      const { data, error } = await admin
        .from('scraper_runs')
        .insert({ status: 'running', sales_found: allFiles.length })
        .select('id')
        .single();

      if (error || !data) {
        io.err(
          `ERROR: failed to create scraper_runs row: ${
            error?.message ?? 'unknown'
          }`,
        );
        return { exitCode: 1 };
      }
      runId = data.id;
    } catch (err) {
      io.err(
        `ERROR: failed to initialise Supabase admin client: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return { exitCode: 1 };
    }
  } else {
    // Dry-run path: we still import importSale lazily so the test's
    // vi.mock() hook captures the spy — but we NEVER invoke it.
    try {
      const importSaleModule = await import('./lib/import-sale.js');
      importSaleFn = importSaleModule.importSale;
    } catch {
      // In a dry-run-only dev environment, supabase-admin.js may not be
      // loadable. That's fine; we simply never call importSale.
      importSaleFn = null;
    }
  }

  // --- Per-file loop ------------------------------------------------------
  const startedAt = Date.now();
  const summary: RunSummary = {
    total: files.length,
    inserted: 0,
    skipped_duplicate: 0,
    skipped_empty: 0,
    failed: 0,
    validation_warnings: 0,
    dry_run_ok: 0,
    duration_ms: 0,
    failures: [],
  };
  const toleranceCents = Math.round(parsed.toleranceDollars * 100);

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const saleNumber = file.replace(/_Profile_.*\.PDF$/i, '');
    const progress = `[ ${i + 1}/${files.length} ] ${saleNumber.padEnd(8)}`;

    const parsedResult = await parsePdf(join(parsed.source, file));

    if (parsedResult.status === 'empty') {
      summary.skipped_empty++;
      io.out(`${progress} -> skipped: empty_placeholder`);
      continue;
    }
    if (parsedResult.status === 'failed') {
      summary.failed++;
      summary.failures.push({
        sale_number: saleNumber,
        error: parsedResult.error,
      });
      io.out(`${progress} -> failed: ${parsedResult.error}`);
      continue;
    }

    if (parsed.dryRun) {
      summary.dry_run_ok++;
      io.out(
        `${progress} -> (dry-run) ok: ${parsedResult.departments.length} depts`,
      );
      continue;
    }

    // Live path: importSaleFn must be loaded at this point.
    if (!importSaleFn) {
      summary.failed++;
      summary.failures.push({
        sale_number: saleNumber,
        error: 'importSale unavailable (live run without admin client)',
      });
      io.out(`${progress} -> failed: importSale unavailable`);
      continue;
    }

    const result = await importSaleFn(parsedResult.sale, parsedResult.departments, {
      toleranceCents,
    });

    if (result.ok === true) {
      summary.inserted++;
      if (result.validationWarning) {
        summary.validation_warnings++;
        io.out(
          `${progress} -> inserted (WARN: ${result.mismatches?.join('; ') ?? 'validation_warning'})`,
        );
      } else {
        io.out(`${progress} -> inserted`);
      }
    } else if (result.reason === 'duplicate') {
      summary.skipped_duplicate++;
      io.out(`${progress} -> skipped: duplicate`);
    } else {
      summary.failed++;
      summary.failures.push({
        sale_number: saleNumber,
        error: result.error,
      });
      io.out(`${progress} -> failed: ${result.error}`);
    }
  }

  summary.duration_ms = Date.now() - startedAt;

  // --- scraper_runs finalisation (live only) -----------------------------
  if (!parsed.dryRun && admin !== null && runId !== null) {
    const status: 'success' | 'partial' | 'failure' = computeStatus(summary);
    const { error } = await admin
      .from('scraper_runs')
      .update({
        status,
        finished_at: new Date().toISOString(),
        sales_imported: summary.inserted,
        // WR-04: include skipped/failed counts in error_message so an
        // operator glancing at scraper_runs can distinguish "healthy
        // idempotency replay" (lots of duplicates) from "parse
        // regression" (failures) without opening the logs jsonb. null
        // only when the run had neither failures nor empty skips.
        error_message: buildErrorMessage(summary),
        logs: summaryToLogs(summary),
      })
      .eq('id', runId);
    if (error) {
      io.err(
        `WARN: failed to finalise scraper_runs row ${runId}: ${error.message}`,
      );
    }
  }

  // --- Final summary table ------------------------------------------------
  printSummary(io, summary, parsed.dryRun);

  const exitCode = summary.failed > 0 ? 1 : 0;
  return { exitCode, summary };
}

// --- Helpers --------------------------------------------------------------

function parseArgv(argv: string[]): ParsedArgs {
  const { values } = parseArgs({
    args: argv,
    options: {
      source: {
        type: 'string',
        default: `${os.homedir()}/Projects/rfc_profiles/rfc_profiles`,
      },
      'dry-run': { type: 'boolean', default: false },
      limit: { type: 'string' },
      verbose: { type: 'boolean', default: false },
      'cross-validation-tolerance': { type: 'string', default: '0.25' },
      help: { type: 'boolean', default: false },
    },
    strict: true,
    allowPositionals: false,
  });

  let limit: number | undefined;
  if (values.limit !== undefined) {
    limit = Number.parseInt(values.limit as string, 10);
    if (!Number.isFinite(limit) || limit <= 0) {
      throw new Error(`--limit must be a positive integer, got: ${values.limit}`);
    }
  }

  const toleranceDollars = Number.parseFloat(
    values['cross-validation-tolerance'] as string,
  );
  if (!Number.isFinite(toleranceDollars) || toleranceDollars < 0) {
    throw new Error(
      `--cross-validation-tolerance must be >= 0, got: ${values['cross-validation-tolerance']}`,
    );
  }

  return {
    source: values.source as string,
    dryRun: values['dry-run'] as boolean,
    limit,
    verbose: values.verbose as boolean,
    toleranceDollars,
    help: values.help as boolean,
  };
}

interface BannerInput {
  source: string;
  supabaseUrl: string;
  totalFiles: number;
  iterFiles: number;
  dryRun: boolean;
  toleranceDollars: number;
  verbose: boolean;
}

function printBanner(
  io: { out: (s: string) => void },
  b: BannerInput,
): void {
  const line = '='.repeat(60);
  io.out(line);
  io.out('PDF IMPORT PIPELINE');
  io.out(line);
  io.out(`Source directory: ${b.source}`);
  io.out(`Target Supabase:  ${b.supabaseUrl}`);
  io.out(
    `Files found:      ${b.totalFiles} PDFs${
      b.iterFiles !== b.totalFiles ? ` (processing first ${b.iterFiles})` : ''
    }`,
  );
  io.out(`Mode:             ${b.dryRun ? 'DRY-RUN (no DB writes)' : 'LIVE (writing to DB)'}`);
  io.out(`Cross-val tol:    +/- $${b.toleranceDollars.toFixed(2)}`);
  io.out(line);
  if (!b.dryRun) {
    io.out('Starting in 3 seconds... Press Ctrl+C to abort.');
  }
}

function printSummary(
  io: { out: (s: string) => void },
  s: RunSummary,
  dryRun: boolean,
): void {
  const line = '='.repeat(60);
  io.out('');
  io.out(line);
  io.out('SUMMARY');
  io.out(line);
  io.out(`Total files:                ${s.total}`);
  if (dryRun) {
    io.out(`Parsed ok (dry-run):        ${s.dry_run_ok}`);
  } else {
    io.out(`Inserted:                   ${s.inserted}`);
    io.out(`Skipped (duplicate):        ${s.skipped_duplicate}`);
  }
  io.out(`Skipped (empty placeholder):${String(s.skipped_empty).padStart(4)}`);
  io.out(`Failed:                     ${s.failed}`);
  if (!dryRun) {
    io.out(`Validation warnings:        ${s.validation_warnings}`);
  }
  io.out(`Duration:                   ${formatDuration(s.duration_ms)}`);
  io.out(line);

  if (s.failures.length > 0) {
    io.out('');
    io.out('Failures:');
    for (const f of s.failures) {
      io.out(`  - ${f.sale_number}: ${f.error}`);
    }
  }
}

function computeStatus(s: RunSummary): 'success' | 'partial' | 'failure' {
  if (s.inserted === 0 && s.failed > 0) return 'failure';
  if (s.failed > 0 || s.skipped_empty > 0) return 'partial';
  return 'success';
}

function summaryToLogs(s: RunSummary): Record<string, unknown> {
  return {
    total: s.total,
    // WR-04: `processed` mirrors `total` but names the concept
    // explicitly. scraper_runs.sales_found is now the corpus size
    // (pre-limit); `logs.processed` is how many this run actually
    // iterated over (post-limit).
    processed: s.total,
    inserted: s.inserted,
    skipped_duplicate: s.skipped_duplicate,
    skipped_empty: s.skipped_empty,
    failed: s.failed,
    validation_warnings: s.validation_warnings,
    duration_ms: s.duration_ms,
    failures: s.failures,
  };
}

// WR-04: build a single-line summary of non-success outcomes for
// scraper_runs.error_message. Returns null only when the run was
// completely clean (no failures, no empty placeholders). Duplicates
// are mentioned as context: "healthy idempotency replay" should not
// look identical to "parse regression".
function buildErrorMessage(s: RunSummary): string | null {
  if (s.failed === 0 && s.skipped_empty === 0) return null;
  const parts: string[] = [];
  if (s.failed > 0) parts.push(`${s.failed} failed`);
  if (s.skipped_empty > 0) parts.push(`${s.skipped_empty} empty`);
  if (s.skipped_duplicate > 0) parts.push(`${s.skipped_duplicate} duplicates`);
  return parts.join(', ');
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const sec = totalSeconds % 60;
  if (m === 0) return `${sec}s`;
  return `${m}m${String(sec).padStart(2, '0')}s`;
}

// --- Direct-run guard -----------------------------------------------------

const invokedDirectly =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  typeof process.argv[1] === 'string' &&
  /import-pdfs\.(ts|js|mjs|cjs)$/i.test(process.argv[1]);

if (invokedDirectly) {
  main()
    .then((r) => process.exit(r.exitCode))
    .catch((err) => {
      console.error('Fatal:', err);
      process.exit(1);
    });
}
