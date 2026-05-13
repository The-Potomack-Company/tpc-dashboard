import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cloneElement, isValidElement } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ExtensionPage } from './Extension';

// Phase 2 / Plan 02-09 — End-to-end integration smoke test.
//
// This is the ONLY file in Phase 2 that imports the REAL chart/table/feed/
// dev-panel components AND a real router AND a real QueryClient. The mock
// is at the lowest reasonable boundary: the Supabase client module
// (../lib/supabase). The auth store is also stubbed (Zustand) so the
// dev-panel render gate is deterministic.
//
// Goal: prove that the components compose without runtime errors —
// no version mismatch, no missing prop, no missing import. Per-component
// behavior is covered by colocated suites under src/components/extension/
// and src/hooks/extension/.

// -----------------------------------------------------------------------------
// Recharts JSDom mock — chart components mount for real here. JSDom does not
// implement layout (clientWidth/Height return 0), so ResponsiveContainer would
// never reach a positive size. Mock it to inject explicit width/height props
// onto its child chart so the chart can size itself without layout measurement.
// Pattern lifted from src/components/kit/Sparkline.test.tsx lines 13-32.
// -----------------------------------------------------------------------------
vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactNode }) => {
      const child = isValidElement(children)
        ? cloneElement(children as ReactElement<{ width?: number; height?: number }>, {
            width: 800,
            height: 288,
          })
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
// Supabase boundary mock — the ONLY network mock in this file. The chainable
// mock resolves to fixture data per query type. We swap supabaseStub.current
// per test to flip between gate-has-rows / gate-empty / gate-error / filter-
// recording branches without re-mocking the module.
// -----------------------------------------------------------------------------
const supabaseStub = vi.hoisted(() => ({
  current: { rpc: vi.fn(), from: vi.fn(), auth: {} } as unknown as {
    rpc: ReturnType<typeof vi.fn>;
    from: ReturnType<typeof vi.fn>;
    auth: object;
  },
}));

vi.mock('../lib/supabase', () => ({
  get supabase() {
    return supabaseStub.current;
  },
}));

// -----------------------------------------------------------------------------
// Auth-store stub — non-dev admin email so DeveloperPanel renders null.
// The store's `profile` type technically doesn't expose `email` directly, but
// DeveloperPanel reads it via an inline cast (see DeveloperPanel.tsx line 47).
//
// Phase 8: ExtensionPage now also reads `isDev` from the auth store. Wrapped
// in `current` so individual tests can flip between admin (default) and dev
// without re-mocking the module.
// -----------------------------------------------------------------------------
const authStub = vi.hoisted(() => ({
  current: {
    profile: { email: 'admin@example.com' as string | null },
    isDev: false,
  },
}));
vi.mock('../stores/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) =>
    selector(authStub.current),
}));

// -----------------------------------------------------------------------------
// Helpers — chainable supabase select mock. The chain mirrors the methods used
// by services/extension/queries.ts: select, eq, not, in, gte, lte, order, limit.
// `then` resolves to { data, error } so `await chain` works as PostgREST does.
// -----------------------------------------------------------------------------
type ChainCall = { method: string; args: unknown[] };

function makeSupabaseStub(opts: {
  gateRows?: unknown[];
  rpcData?: unknown[];
  selectData?: unknown[];
  recorder?: ChainCall[];
}) {
  const rpcMock = vi.fn().mockImplementation((name: string, args: Record<string, unknown>) => {
    opts.recorder?.push({ method: 'rpc', args: [name, args] });
    return Promise.resolve({ data: opts.rpcData ?? [], error: null });
  });
  return {
    rpc: rpcMock,
    from: vi.fn().mockImplementation(() => {
      // Smart chain: routes the gate probe to gateRows and other selects to
      // selectData based on the chain composition. The gate probe is the only
      // call site that selects 'id' AND limits to 1; everything else gets
      // selectData (empty by default — RecentErrorsTable / LiveFeed render
      // their empty branches without throwing).
      const localCalls: ChainCall[] = [];
      const chain: Record<string, unknown> = {};
      const passthrough = ['select', 'eq', 'not', 'in', 'gte', 'lte', 'order', 'limit'] as const;
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
      (chain as { then: (cb: (v: unknown) => unknown) => Promise<unknown> }).then = (cb) => {
        const selectArgs = localCalls.find((c) => c.method === 'select')?.args[0];
        const limitArg = localCalls.find((c) => c.method === 'limit')?.args[0];
        const isGateProbe = selectArgs === 'id' && limitArg === 1;
        const data = isGateProbe ? (opts.gateRows ?? []) : (opts.selectData ?? []);
        return Promise.resolve({ data, error: null }).then(cb);
      };
      return chain;
    }),
    auth: {},
  };
}

function makeWrapper(initialEntries: string[] = ['/extension']) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={initialEntries}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </MemoryRouter>
  );
}

describe('ExtensionPage — integration smoke', () => {
  beforeEach(() => {
    // Default: gate has rows; RPCs and selects return empty arrays. The page
    // mounts cleanly with per-card empty states (Pattern D-20).
    supabaseStub.current = makeSupabaseStub({
      gateRows: [{ id: '1' }],
      rpcData: [],
      selectData: [],
    });
    // Default auth: admin (non-dev). Individual tests can override.
    authStub.current = {
      profile: { email: 'admin@example.com' },
      isDev: false,
    };
  });

  afterEach(() => {
    supabaseStub.current = makeSupabaseStub({});
  });

  it('admin (default) mounts operational sections without errors; perf widgets gated out per Phase 8', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<ExtensionPage />, { wrapper: makeWrapper() });

    // Wait for the gate probe to resolve (loading skeleton disappears).
    await waitFor(() => {
      expect(screen.queryByTestId('extension-page-loading')).not.toBeInTheDocument();
    });

    // Operational widgets — admin still sees these.
    expect(screen.getByTestId('ext-01-card')).toBeInTheDocument();
    expect(screen.getByTestId('ext-02-strip')).toBeInTheDocument();
    expect(screen.getByTestId('ext-04-card')).toBeInTheDocument();
    expect(screen.getByTestId('ext-08-feed')).toBeInTheDocument();

    // Phase 8 trim — failure-rate chart + recent errors are dev-only.
    expect(screen.queryByTestId('ext-03-card')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ext-05-card')).not.toBeInTheDocument();

    // DeveloperPanel returns null for the admin email — testid absent.
    expect(screen.queryByTestId('developer-panel')).not.toBeInTheDocument();

    // No unexpected console errors (catches React key prop warnings, hook
    // violations, prop-type errors that unit tests with stub children miss).
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('dev mounts ALL sections including ErrorRateChart + RecentErrorsTable (Phase 8 regression guard)', async () => {
    authStub.current = {
      profile: { email: 'josh@potomackco.com' },
      isDev: true,
    };
    render(<ExtensionPage />, { wrapper: makeWrapper() });
    await waitFor(() => {
      expect(screen.queryByTestId('extension-page-loading')).not.toBeInTheDocument();
    });
    expect(screen.getByTestId('ext-01-card')).toBeInTheDocument();
    expect(screen.getByTestId('ext-02-strip')).toBeInTheDocument();
    expect(screen.getByTestId('ext-03-card')).toBeInTheDocument();
    expect(screen.getByTestId('ext-04-card')).toBeInTheDocument();
    expect(screen.getByTestId('ext-05-card')).toBeInTheDocument();
    expect(screen.getByTestId('ext-08-feed')).toBeInTheDocument();
  });

  it('shows empty state when gate returns 0 rows', async () => {
    supabaseStub.current = makeSupabaseStub({
      gateRows: [],
      rpcData: [],
      selectData: [],
    });

    render(<ExtensionPage />, { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(screen.getByText('No extension events yet')).toBeInTheDocument();
    });

    // The CRITICAL D-19 invariant: no chart testids may appear when the page
    // is gated empty. Pattern 5 — empty-gate branch is the SINGLE place
    // charts get short-circuited.
    expect(screen.queryByTestId('ext-01-card')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ext-02-strip')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ext-03-card')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ext-04-card')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ext-05-card')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ext-08-feed')).not.toBeInTheDocument();
  });

  it('does not crash when gate probe errors', async () => {
    // Make the from() chain reject with a Supabase-shape error.
    supabaseStub.current = {
      rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
      from: vi.fn().mockImplementation(() => {
        const chain: Record<string, unknown> = {};
        const passthrough = ['select', 'eq', 'not', 'in', 'gte', 'lte', 'order', 'limit'] as const;
        for (const m of passthrough) {
          (chain as Record<string, () => unknown>)[m] = () => chain;
        }
        // Resolve with `error` set rather than throwing — this is the shape
        // PostgREST returns. Hooks see `error` and surface it via `query.error`.
        (chain as { then: (cb: (v: unknown) => unknown) => Promise<unknown> }).then = (cb) =>
          Promise.resolve({ data: null, error: new Error('boom') }).then(cb);
        return chain;
      }),
      auth: {},
    } as unknown as typeof supabaseStub.current;

    // Contract: page does NOT throw during render even when the gate probe
    // returns an error. The gate may surface either the loading state or the
    // composed tree with per-card errors — both are acceptable; no thrown
    // exception is the invariant.
    expect(() => render(<ExtensionPage />, { wrapper: makeWrapper() })).not.toThrow();
  });

  it('filter change re-fetches all charts (EXT-07 integration)', async () => {
    const recorder: ChainCall[] = [];

    // Stub: gate has rows; the per-user RPC returns one fixture row so
    // UserMultiSelect's option list shows user@x.com. Raw selects return
    // empty arrays (RecentErrorsTable + LiveFeed render their empty states
    // without throwing).
    supabaseStub.current = {
      rpc: vi.fn().mockImplementation((name: string, args: Record<string, unknown>) => {
        recorder.push({ method: 'rpc', args: [name, args] });
        if (name === 'get_per_user_summary') {
          // Shape from get_per_user_summary RPC — UserMultiSelect reads
          // user_email_label off this cache.
          return Promise.resolve({
            data: [
              {
                user_email_label: 'user@x.com',
                catalog_single: 0,
                catalog_batch: 0,
                portal_upload: 0,
                spreadsheet_transform: 0,
                data_import: 0,
                total_errors: 0,
                last_seen_at: '2026-04-29T12:00:00Z',
              },
            ],
            error: null,
          });
        }
        return Promise.resolve({ data: [], error: null });
      }),
      from: vi.fn().mockImplementation(() => {
        // Smart chain: tracks the calls applied to this chain, then resolves
        // with shape-appropriate fixture data based on what was requested.
        // Gate probe (.select('id') + .limit(1)) → returns one row so the
        // page renders the composed tree.
        // Recent errors (.not('error_message','is',null)) → empty (no errors).
        // Live feed (.order('created_at') + .limit(50)) → empty.
        // Distinct versions (.select('extension_version')) → empty.
        const localCalls: ChainCall[] = [];
        const chain: Record<string, unknown> = {};
        const passthrough = ['select', 'eq', 'not', 'in', 'gte', 'lte', 'order', 'limit'] as const;
        for (const m of passthrough) {
          (chain as Record<string, (...a: unknown[]) => unknown>)[m] = (
            ...args: unknown[]
          ) => {
            const call = { method: m, args };
            recorder.push(call);
            localCalls.push(call);
            return chain;
          };
        }
        (chain as { then: (cb: (v: unknown) => unknown) => Promise<unknown> }).then = (cb) => {
          // Decide fixture based on chain composition. The gate probe is the
          // only call site that selects `'id'` AND limits to 1.
          const selectArgs = localCalls.find((c) => c.method === 'select')?.args[0];
          const limitArg = localCalls.find((c) => c.method === 'limit')?.args[0];
          const isGateProbe = selectArgs === 'id' && limitArg === 1;
          const data = isGateProbe ? [{ id: '1' }] : [];
          return Promise.resolve({ data, error: null }).then(cb);
        };
        return chain;
      }),
      auth: {},
    } as unknown as typeof supabaseStub.current;

    // Mount with ?range=7d so the date range is locked (otherwise the user
    // event might race with a default-range write).
    render(<ExtensionPage />, { wrapper: makeWrapper(['/extension?range=7d']) });

    // Wait for the gate probe + initial chart fetches to settle.
    await waitFor(() => {
      expect(screen.queryByTestId('extension-page-loading')).not.toBeInTheDocument();
    });

    // Snapshot calls so we can compare BEFORE vs AFTER filter change.
    // Wait briefly for initial fetches to land.
    await waitFor(() => {
      expect(recorder.length).toBeGreaterThan(0);
    });
    const callsBefore = recorder.length;

    // Real UserMultiSelect is mounted — open the popover and toggle a user.
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Filter by user email' }));

    // The option list dedupes via Set; user@x.com may appear once.
    const checkbox = await screen.findByRole('checkbox', { name: /user@x\.com/ });
    await user.click(checkbox);

    // Close the popover.
    await user.keyboard('{Escape}');

    // Await the next fetch tick — TanStack should re-fire chart hooks with
    // the new queryKey (the user filter folded into the key invalidates).
    await waitFor(() => {
      expect(recorder.length).toBeGreaterThan(callsBefore);
    });

    // Verify at least ONE new call carries the user filter. Either as
    // .in('user_email', ['user@x.com']) for raw selects OR p_users:
    // ['user@x.com'] for RPC calls. Both shapes are valid filter propagation
    // and prove EXT-07 wiring through the composed page.
    const newCalls = recorder.slice(callsBefore);
    const hasUserFilter = newCalls.some((c) => {
      if (c.method === 'in' && c.args[0] === 'user_email' && Array.isArray(c.args[1])) {
        return (c.args[1] as string[]).includes('user@x.com');
      }
      if (c.method === 'rpc') {
        const rpcArgs = c.args[1] as { p_users?: string[] } | undefined;
        return Array.isArray(rpcArgs?.p_users) && rpcArgs.p_users.includes('user@x.com');
      }
      return false;
    });
    expect(hasUserFilter).toBe(true);
  });
});
