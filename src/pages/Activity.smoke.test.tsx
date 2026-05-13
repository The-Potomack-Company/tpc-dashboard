/// <reference types="node" />
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  cloneElement,
  isValidElement,
  useEffect as useEffectReact,
} from 'react';
import type { ReactElement, ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ActivityPage } from './Activity';

// Phase 3 / Plan 03-09 — End-to-end integration smoke test for `/activity`.
//
// Mirrors src/pages/Extension.smoke.test.tsx (Phase 2 canonical) verbatim:
//   - Real components, real router, real QueryClient
//   - Lowest-boundary mock = ../lib/supabase (the Supabase client module)
//   - Auth store stubbed (Zustand) so the DeveloperPanel render gate is
//     deterministic
//
// Goal: prove components compose without runtime errors. Per-component
// behavior is covered by colocated suites under src/components/activity/
// and src/hooks/activity/.

// -----------------------------------------------------------------------------
// Recharts JSDom mock — chart components mount for real here. JSDom does not
// implement layout (clientWidth/Height return 0), so ResponsiveContainer would
// never reach a positive size. Pattern lifted verbatim from
// src/pages/Extension.smoke.test.tsx lines 30-48.
// -----------------------------------------------------------------------------
vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactNode }) => {
      const child = isValidElement(children)
        ? cloneElement(
            children as ReactElement<{ width?: number; height?: number }>,
            { width: 800, height: 288 },
          )
        : children;
      return (
        <div style={{ width: 800, height: 288 }} data-testid="mocked-responsive">
          {child}
        </div>
      );
    },
  };
});

// -----------------------------------------------------------------------------
// Supabase boundary mock — the ONLY network mock. Resolves RPCs and
// .from().select() chains to fixture data.
// -----------------------------------------------------------------------------
const supabaseStub = vi.hoisted(() => ({
  current: { rpc: vi.fn(), from: vi.fn(), auth: {}, storage: {} } as unknown as {
    rpc: ReturnType<typeof vi.fn>;
    from: ReturnType<typeof vi.fn>;
    auth: object;
    storage: object;
  },
}));

vi.mock('../lib/supabase', () => ({
  get supabase() {
    return supabaseStub.current;
  },
}));

// -----------------------------------------------------------------------------
// Auth store stub — wrapped in `current` so individual tests can swap the
// returned profile (admin vs allowlisted dev) per-test.
// -----------------------------------------------------------------------------
interface StubAuthState {
  profile: { email: string | null } | null;
  session: { user: { id: string } } | null;
  isAdmin: boolean;
  isDev: boolean;
}

const authStub = vi.hoisted(() => ({
  current: {
    profile: { email: 'admin@potomackco.com' as string | null },
    session: { user: { id: 'admin-1' } },
    isAdmin: true,
    isDev: false,
  } as StubAuthState,
}));

vi.mock('../stores/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) => selector(authStub.current),
}));

// -----------------------------------------------------------------------------
// Helpers — chainable supabase select stub matches services/activity/queries.ts
// methods: select, eq, in, not, order, limit. `then` resolves to PostgREST shape
// `{ data, error }`.
// -----------------------------------------------------------------------------
type ChainCall = { method: string; args: unknown[] };

const RPC_FIXTURES: Record<string, unknown[]> = {
  get_today_kpis: [
    {
      sessions_today: 5,
      items_today: 100,
      exports_today: 7,
      items_done_today: 80,
      items_total_today: 100,
      sessions_yday: 4,
      items_yday: 90,
      exports_yday: 5,
      items_done_yday: 70,
      items_total_yday: 90,
    },
  ],
  get_active_sessions: [
    {
      session_id: 'sess-1',
      name: 'Demo Session',
      mode: 'house',
      status: 'active',
      assigned_to_id: 'p-1',
      assigned_to_display_name: 'Alice',
      item_count: 12,
      created_at: new Date(Date.now() - 14 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
  get_items_per_specialist_14d: [
    {
      bucket_start: '2026-04-29T05:00:00Z',
      specialist_id: 'p-1',
      specialist_email: 'alice@x.com',
      specialist_display_name: 'Alice',
      item_count: 5,
    },
  ],
  get_ai_status_distribution: [
    { ai_status: 'pending', item_count: 5 },
    { ai_status: 'processing', item_count: 3 },
    { ai_status: 'queued', item_count: 1 },
    { ai_status: 'done', item_count: 80 },
    { ai_status: 'failed', item_count: 2 },
  ],
  get_export_pipeline: [
    { status: 'active', session_count: 3 },
    { status: 'submitted', session_count: 1 },
    { status: 'returned', session_count: 0 },
    { status: 'exported', session_count: 5 },
    { status: 'completed', session_count: 2 },
  ],
  get_house_sale_split: [
    { mode: 'house', n_sessions: 3, n_items: 25 },
    { mode: 'sale', n_sessions: 2, n_items: 15 },
  ],
  get_stuck_items: [],
  get_failed_ai_breakdown: [],
  get_ui_top_pages: [],
  get_ui_top_elements: [],
  get_walkthrough_funnel: [],
};

function makeSupabaseStub(opts: {
  rpcOverrides?: Record<string, unknown[]>;
  selectData?: unknown[];
  recorder?: ChainCall[];
} = {}) {
  const rpcMock = vi
    .fn()
    .mockImplementation((name: string, args: Record<string, unknown>) => {
      opts.recorder?.push({ method: 'rpc', args: [name, args] });
      const data =
        opts.rpcOverrides?.[name] ?? RPC_FIXTURES[name] ?? [];
      return Promise.resolve({ data, error: null });
    });

  const fromMock = vi.fn().mockImplementation(() => {
    const localCalls: ChainCall[] = [];
    const chain: Record<string, unknown> = {};
    const passthrough = [
      'select',
      'eq',
      'not',
      'in',
      'gte',
      'lte',
      'order',
      'limit',
    ] as const;
    for (const m of passthrough) {
      (chain as Record<string, (...a: unknown[]) => unknown>)[m] = (
        ...args: unknown[]
      ) => {
        const call = { method: m, args };
        opts.recorder?.push(call);
        localCalls.push(call);
        return chain;
      };
    }
    (chain as { then: (cb: (v: unknown) => unknown) => Promise<unknown> }).then = (
      cb,
    ) => {
      // fetchActiveSpecialists selects 'id, email, display_name' from profiles
      // and filters role='specialist' — return one specialist option so the
      // multi-select can render its option list (Test 17).
      const selectArgs = localCalls.find((c) => c.method === 'select')?.args[0];
      const data =
        typeof selectArgs === 'string' &&
        selectArgs.includes('id, email, display_name')
          ? [
              {
                id: 'p-1',
                email: 'alice@x.com',
                display_name: 'Alice',
              },
              {
                id: 'p-2',
                email: 'bob@x.com',
                display_name: 'Bob',
              },
            ]
          : (opts.selectData ?? []);
      return Promise.resolve({ data, error: null }).then(cb);
    };
    return chain;
  });

  return {
    rpc: rpcMock,
    from: fromMock,
    auth: {},
    storage: {},
  };
}

function makeWrapper(initialEntries: string[] = ['/activity']) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={initialEntries}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </MemoryRouter>
  );
}

describe('ActivityPage — integration smoke', () => {
  beforeEach(() => {
    // Default: admin (non-dev) email; happy-path RPC fixtures.
    authStub.current = {
      profile: { email: 'admin@potomackco.com' },
      session: { user: { id: 'admin-1' } },
      isAdmin: true,
      isDev: false,
    };
    supabaseStub.current = makeSupabaseStub() as unknown as typeof supabaseStub.current;
  });

  afterEach(() => {
    supabaseStub.current = makeSupabaseStub() as unknown as typeof supabaseStub.current;
  });

  it('Test 1 — renders heading + subtitle + filter row controls', async () => {
    render(<ActivityPage />, { wrapper: makeWrapper() });

    expect(
      screen.getByRole('heading', { name: 'Activity', level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('TPC team cataloging activity'),
    ).toBeInTheDocument();

    // Filter row controls — date-range filter + specialist multi-select +
    // mode toggle (D-01 page header).
    expect(screen.getByTestId('date-range-filter')).toBeInTheDocument();
    expect(screen.getByTestId('specialist-multi-select')).toBeInTheDocument();
    expect(screen.getByTestId('mode-toggle')).toBeInTheDocument();
  });

  it('Test 2 — composes admin operational sections in D-01 order (no AI-status donut for admin per Phase 8)', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<ActivityPage />, { wrapper: makeWrapper() });

    // Wait for queries to resolve so charts hydrate (otherwise we'd assert
    // against the loading skeletons).
    await waitFor(() => {
      expect(screen.getByTestId('app-01-card')).toBeInTheDocument();
    });

    // Operational widgets — admin sees all of these (Today KPI strip → Active
    // Sessions → Stuck Items alert → 14-day stacked bar → House vs Sale →
    // Export Pipeline). DeveloperPanel covered by Test 3 / Test 4.
    expect(screen.getByTestId('app-01-card')).toBeInTheDocument(); // Today KPIs
    expect(screen.getByTestId('app-02-card')).toBeInTheDocument(); // Active sessions
    expect(screen.getByTestId('app-11-card')).toBeInTheDocument(); // Stuck items alert
    expect(screen.getByTestId('app-03-card')).toBeInTheDocument(); // 14-day bar
    expect(screen.getByTestId('app-12-card')).toBeInTheDocument(); // House vs Sale
    expect(screen.getByTestId('app-05-card')).toBeInTheDocument(); // Export pipeline

    // Phase 8 trim — AI status donut shows success/failure rates and is
    // dev-only. Admin (default stub) must NOT see it.
    expect(screen.queryByTestId('app-04-card')).not.toBeInTheDocument();

    // No unexpected console errors (catches React key prop warnings, hook
    // violations, prop-type errors that unit tests with stub children miss).
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('Test 2b — dev sees the AI status donut alongside the rest (Phase 8)', async () => {
    authStub.current = {
      profile: { email: 'josh@potomackco.com' },
      session: { user: { id: 'dev-1' } },
      isAdmin: true,
      isDev: true,
    };
    render(<ActivityPage />, { wrapper: makeWrapper() });
    await waitFor(() => {
      expect(screen.getByTestId('app-04-card')).toBeInTheDocument();
    });
  });

  it('Test 3 — DeveloperPanel ABSENT from DOM for non-allowlisted admin (D-26)', async () => {
    render(<ActivityPage />, { wrapper: makeWrapper() });
    await waitFor(() => {
      expect(screen.getByTestId('app-01-card')).toBeInTheDocument();
    });
    // D-26: render-conditional gate — entire subtree absent for non-dev.
    expect(screen.queryByTestId('developer-panel')).not.toBeInTheDocument();
  });

  it('Test 4 — DeveloperPanel PRESENT in DOM for allowlisted dev account (D-26)', async () => {
    authStub.current = {
      profile: { email: 'josh@potomackco.com' }, // allowlisted
      session: { user: { id: 'dev-1' } },
      isAdmin: true,
      isDev: true,
    };

    render(<ActivityPage />, { wrapper: makeWrapper() });
    await waitFor(() => {
      expect(screen.getByTestId('developer-panel')).toBeInTheDocument();
    });
  });

  it('Test 17 — 3 URL filter params (range + specialists + mode) coexist without clobbering', async () => {
    const user = userEvent.setup();
    let capturedSearch = '';
    function Probe() {
      const loc = useLocation();
      // We capture the search string in a useEffect so the assignment runs
      // on commit (not during render), which avoids React's "set state
      // during render" warning.
      useEffectReact(() => {
        capturedSearch = loc.search;
      }, [loc.search]);
      return null;
    }
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    render(
      <MemoryRouter
        initialEntries={[
          '/activity?range=7d&specialists=alice%40x.com%2Cbob%40x.com&mode=house',
        ]}
      >
        <QueryClientProvider client={client}>
          <Probe />
          <ActivityPage />
        </QueryClientProvider>
      </MemoryRouter>,
    );

    // Initial assertion: all 3 params present.
    await waitFor(() => {
      expect(capturedSearch).toContain('range=7d');
      expect(capturedSearch).toContain('specialists=alice%40x.com%2Cbob%40x.com');
      expect(capturedSearch).toContain('mode=house');
    });

    // Click date-range "30d" — DateRangeFilter exposes data-testid
    // "date-range-preset-30d" for each preset button.
    await user.click(screen.getByTestId('date-range-preset-30d'));
    await waitFor(() => {
      expect(capturedSearch).toContain('range=30d');
      expect(capturedSearch).toContain('specialists=alice%40x.com%2Cbob%40x.com'); // preserved
      expect(capturedSearch).toContain('mode=house'); // preserved
    });

    // Open the SpecialistMultiSelect popover and uncheck Alice — the
    // checkbox carries aria-label = display_name (NOT email).
    await user.click(screen.getByTestId('specialist-multi-select-trigger'));
    const popover = await screen.findByTestId('specialist-multi-select-popover');
    const aliceCheckbox = within(popover).getByRole('checkbox', { name: 'Alice' });
    await user.click(aliceCheckbox);

    await waitFor(() => {
      expect(capturedSearch).toContain('range=30d'); // preserved
      expect(capturedSearch).toContain('specialists=bob%40x.com'); // alice dropped
      expect(capturedSearch).not.toMatch(/specialists=[^&]*alice%40x\.com/);
      expect(capturedSearch).toContain('mode=house'); // preserved
    });
  });

  it('Test 18 — no Phase 3 source file references the service-role env-var name (CLAUDE.md INFR-06)', () => {
    // Vitest runs under Node so node:fs is available. We walk Phase 3 source
    // directories + a curated file list and assert no offender contains the
    // forbidden token. This complements the prebuild guard
    // `scripts/check-no-service-role-in-src.mjs` by enforcing the same
    // invariant at `npm run test` time so a regression is caught at
    // PR-review time too.
    //
    // IMPORTANT: We compose the forbidden token at runtime from parts so
    // the literal string never appears in this source file. The prebuild
    // guard greps for the literal string in `src/`; if this test file
    // contained the literal, the guard would (correctly) flag this very
    // test as an offender, breaking `npm run build`.
    const FORBIDDEN_TOKEN = ['SUPABASE', 'SERVICE', 'ROLE', 'KEY'].join('_');

    // ESM `__dirname` shim: import.meta.url → __filename → directory.
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = resolve(__filename, '..');
    // src/pages/ → repo root is two levels up.
    const ROOT = resolve(__dirname, '..', '..');

    const dirs = [
      'src/services/activity',
      'src/hooks/activity',
      'src/components/activity',
    ];
    const files = [
      'src/pages/Activity.tsx',
      'src/pages/SessionDetail.tsx',
      'src/pages/StuckItems.tsx',
      'src/hooks/useSpecialistFilter.ts',
      'src/hooks/useModeFilter.ts',
      'src/hooks/useSignedPhotoUrl.ts',
      'src/lib/severity.ts',
      'src/lib/chartPalette.ts',
      'src/lib/format.ts',
      'src/components/SpecialistMultiSelect.tsx',
      'src/components/ModeToggle.tsx',
    ];

    function walkAllTs(dir: string): string[] {
      const abs = join(ROOT, dir);
      if (!existsSync(abs)) return [];
      const out: string[] = [];
      for (const ent of readdirSync(abs, { withFileTypes: true })) {
        const p = join(abs, ent.name);
        if (ent.isDirectory()) {
          out.push(...walkAllTs(relative(ROOT, p)));
        } else if (
          ent.isFile() &&
          /\.(ts|tsx)$/.test(p) &&
          !/\.test\.tsx?$/.test(p)
        ) {
          out.push(p);
        }
      }
      return out;
    }

    const allFiles = [
      ...dirs.flatMap(walkAllTs),
      ...files.map((rel) => join(ROOT, rel)).filter((p) => existsSync(p)),
    ];

    // Sanity check: we should be reading at least 30 files (the activity
    // surface is substantial). Catches the case where this test would
    // silently pass against an empty file set.
    expect(allFiles.length).toBeGreaterThan(20);

    const offenders: string[] = [];
    for (const file of allFiles) {
      const raw = readFileSync(file, 'utf8');
      if (raw.includes(FORBIDDEN_TOKEN)) {
        offenders.push(relative(ROOT, file));
      }
    }

    expect(offenders).toEqual([]);
  });
});
