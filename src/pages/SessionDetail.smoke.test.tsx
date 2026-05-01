import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionDetailPage } from './SessionDetail';

// Phase 3 / Plan 03-09 — End-to-end integration smoke for `/activity/sessions/:id`.
//
// Mirrors src/pages/Extension.smoke.test.tsx mocking shape. Real components,
// real router, real QueryClient. Lowest-boundary mock = ../lib/supabase.
//
// CRITICAL invariants under test (LOAD-BEARING):
//   - D-09 lazy fetch: createSignedUrl is NOT called on mount; it IS called
//     after a row expansion. Test 8 + Test 9 are the canonical assertions.
//   - D-12 thumbnail-only: createSignedUrl is called with `thumbnail_path`,
//     never with `storage_path`.
//   - D-13 failed-photo no-fetch: createSignedUrl is NEVER called for a
//     photo whose `upload_status === 'failed'`.
//
// To keep the createSignedUrl mock identity stable across the whole suite
// (the tests `expect(createSignedUrlMock).toHaveBeenCalledWith(...)` against
// THIS exact instance), we declare the mock at module scope and the
// supabaseStub builder routes `storage.from('photos').createSignedUrl` to it
// every time. DO NOT replace mockResolvedValue with a fresh function inside
// any test.

// -----------------------------------------------------------------------------
// Hoisted mocks — load-bearing per the comment above.
// -----------------------------------------------------------------------------
const mocks = vi.hoisted(() => {
  const createSignedUrlMock = vi.fn();
  return { createSignedUrlMock };
});

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

interface StubAuthState {
  profile: { email: string | null } | null;
  session: { user: { id: string } } | null;
  isAdmin: boolean;
}

const authStub = vi.hoisted(() => ({
  current: {
    profile: { email: 'admin@potomackco.com' as string | null },
    session: { user: { id: 'admin-1' } },
    isAdmin: true,
  } as StubAuthState,
}));

vi.mock('../stores/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) =>
    selector(authStub.current),
}));

// -----------------------------------------------------------------------------
// Fixtures + supabase stub builder. Tests can pass overrides for the items
// list (so SessionItemList renders rows we can click) and for the photos
// list (so D-13 / D-09 / D-12 invariants can be exercised).
// -----------------------------------------------------------------------------
type ChainCall = { method: string; args: unknown[] };

interface PhotoRow {
  id: string;
  item_id: string;
  storage_path: string;
  thumbnail_path: string;
  upload_status: 'uploaded' | 'failed' | 'pending' | 'uploading';
  sort_order: number;
}

interface ItemRow {
  id: string;
  receipt_number: string;
  title: string;
  ai_status: string;
  description: string | null;
  category: string | null;
  estimate: string | null;
  measurements: string | null;
  transcript: string | null;
  created_at: string;
  photos: Array<{ count: number }>;
}

const DEFAULT_SESSION_ROW = {
  session_id: 'abc-123',
  name: 'Demo Session',
  mode: 'house',
  status: 'active',
  notes: '',
  review_notes: '',
  assigned_to_id: 'p-1',
  assigned_to_display_name: 'Alice',
  created_by_id: 'p-1',
  created_by_display_name: 'Alice',
  created_at: '2026-04-29T15:00:00Z',
  updated_at: '2026-04-29T15:00:00Z',
};

function defaultItems(): ItemRow[] {
  return [
    {
      id: 'item-1',
      receipt_number: 'R-1',
      title: 'Vase',
      ai_status: 'done',
      description: 'desc',
      category: 'cat',
      estimate: '$10',
      measurements: 'sm',
      transcript: 't',
      created_at: '2026-04-29T15:00:00Z',
      photos: [{ count: 2 }],
    },
  ];
}

function makeSupabaseStub(opts: {
  sessionRow?: typeof DEFAULT_SESSION_ROW | null;
  items?: ItemRow[];
  photosByItemId?: Record<string, PhotoRow[]>;
  signedUrl?: string;
} = {}) {
  const sessionData =
    opts.sessionRow === undefined ? DEFAULT_SESSION_ROW : opts.sessionRow;
  const items = opts.items ?? defaultItems();
  const photosByItemId = opts.photosByItemId ?? {};

  const rpcMock = vi.fn().mockImplementation((name: string) => {
    const map: Record<string, unknown[]> = {
      get_session_detail: sessionData ? [sessionData] : [],
      get_photo_coverage: [
        {
          items_total: 2,
          items_with_photos: 1,
          items_without_photos: 1,
          status_pending: 0,
          status_uploading: 0,
          status_uploaded: 1,
          status_failed: 1,
        },
      ],
    };
    return Promise.resolve({ data: map[name] ?? [], error: null });
  });

  const fromMock = vi.fn().mockImplementation((tableName: string) => {
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
        localCalls.push(call);
        return chain;
      };
    }
    (chain as { then: (cb: (v: unknown) => unknown) => Promise<unknown> }).then = (
      cb,
    ) => {
      let data: unknown = [];
      if (tableName === 'items') {
        // fetchSessionItems
        data = items;
      } else if (tableName === 'photos') {
        // fetchSessionPhotos — find the eq('item_id', x) call to route
        // photos for that item.
        const itemIdEq = localCalls.find(
          (c) => c.method === 'eq' && c.args[0] === 'item_id',
        );
        const itemId = itemIdEq?.args[1] as string | undefined;
        data = (itemId && photosByItemId[itemId]) ?? [];
      }
      return Promise.resolve({ data, error: null }).then(cb);
    };
    return chain;
  });

  // Storage `from('photos').createSignedUrl(path, ttl)` — always routes to
  // the hoisted mock so tests can assert call counts and arguments.
  mocks.createSignedUrlMock.mockResolvedValue({
    data: { signedUrl: opts.signedUrl ?? 'https://example.com/signed' },
    error: null,
  });

  const storageMock = {
    from: vi.fn().mockReturnValue({
      createSignedUrl: mocks.createSignedUrlMock,
    }),
  };

  return {
    rpc: rpcMock,
    from: fromMock,
    auth: {},
    storage: storageMock,
  };
}

function renderAt(url: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <MemoryRouter initialEntries={[url]}>
      <QueryClientProvider client={client}>
        <Routes>
          <Route path="/activity/sessions/:id" element={<SessionDetailPage />} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  authStub.current = {
    profile: { email: 'admin@potomackco.com' },
    session: { user: { id: 'admin-1' } },
    isAdmin: true,
  };
  mocks.createSignedUrlMock.mockReset();
  supabaseStub.current = makeSupabaseStub() as unknown as typeof supabaseStub.current;
});

afterEach(() => {
  supabaseStub.current = makeSupabaseStub() as unknown as typeof supabaseStub.current;
});

describe('SessionDetailPage — integration smoke', () => {
  it('Test 6 — mounts page; metadata + photo coverage + item list all render', async () => {
    renderAt('/activity/sessions/abc-123?range=7d&specialists=a%40x.com&mode=house');

    // Heading + subtitle
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Demo Session', level: 1 }),
      ).toBeInTheDocument();
    });

    // Metadata card, photo coverage panel, item list — all in the DOM.
    expect(screen.getByTestId('session-metadata-card')).toBeInTheDocument();
    expect(screen.getByTestId('photo-coverage-panel')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('session-item-list')).toBeInTheDocument();
    });
  });

  it('Test 7 — BackLink preserves URL filter params (D-03)', async () => {
    renderAt('/activity/sessions/abc-123?range=7d&specialists=a%40x.com&mode=house');

    // BackLink renders as a <Link> with text "Activity"; React Router
    // resolves `to` against location and serializes into href on the
    // rendered <a>.
    const backLink = await screen.findByRole('link', { name: /Activity/i });
    const href = backLink.getAttribute('href') ?? '';
    expect(href).toContain('/activity');
    expect(href).toContain('range=7d');
    expect(href).toContain('specialists=a%40x.com');
    expect(href).toContain('mode=house');
  });

  it('Test 8 — does NOT call createSignedUrl on mount (D-09 lazy fetch — LOAD-BEARING)', async () => {
    // Even with one happy photo, mounting the page should NOT call
    // createSignedUrl until a row is expanded.
    supabaseStub.current = makeSupabaseStub({
      photosByItemId: {
        'item-1': [
          {
            id: 'p1',
            item_id: 'item-1',
            storage_path: 'a/full.jpg',
            thumbnail_path: 'a/thumb.webp',
            upload_status: 'uploaded',
            sort_order: 0,
          },
        ],
      },
    }) as unknown as typeof supabaseStub.current;

    renderAt('/activity/sessions/abc-123');

    // Wait for the item list to fully render (so useSessionPhotos would
    // have been READY to fire if eager).
    await waitFor(() => {
      expect(screen.getByText(/Vase/)).toBeInTheDocument();
    });

    // D-09 invariant: no row was expanded → createSignedUrl was NEVER called.
    expect(mocks.createSignedUrlMock).not.toHaveBeenCalled();
  });

  it('Test 9 — calls createSignedUrl with thumbnail_path after row expansion (D-09 + D-12 — LOAD-BEARING)', async () => {
    supabaseStub.current = makeSupabaseStub({
      photosByItemId: {
        'item-1': [
          {
            id: 'p1',
            item_id: 'item-1',
            storage_path: 'sess/full.jpg',
            thumbnail_path: 'sess/thumb.webp',
            upload_status: 'uploaded',
            sort_order: 0,
          },
        ],
      },
    }) as unknown as typeof supabaseStub.current;

    const user = userEvent.setup();
    renderAt('/activity/sessions/abc-123');

    // Wait for the item row to render then click to expand.
    const titleCell = await screen.findByText(/Vase/);
    const tr = titleCell.closest('tr');
    expect(tr).not.toBeNull();
    await user.click(tr!);

    // After expansion, ThumbnailTile mounts useSignedPhotoUrl with
    // path=thumbnail_path (D-12 — never storage_path) and TTL=3600s (D-11).
    await waitFor(() => {
      expect(mocks.createSignedUrlMock).toHaveBeenCalledWith(
        'sess/thumb.webp',
        3600,
      );
    });
    // D-12 invariant — calls thumbnail_path, NOT storage_path.
    expect(mocks.createSignedUrlMock).not.toHaveBeenCalledWith(
      'sess/full.jpg',
      3600,
    );
  });

  it('Test 10 — NEVER calls createSignedUrl for failed photos (D-13 — LOAD-BEARING)', async () => {
    supabaseStub.current = makeSupabaseStub({
      photosByItemId: {
        'item-1': [
          {
            id: 'p1',
            item_id: 'item-1',
            storage_path: 'a/full.jpg',
            thumbnail_path: 'a/thumb.webp',
            upload_status: 'uploaded',
            sort_order: 0,
          },
          {
            id: 'p2',
            item_id: 'item-1',
            storage_path: 'b/full.jpg',
            thumbnail_path: 'b/thumb.webp',
            upload_status: 'failed', // D-13 — never sign this one
            sort_order: 1,
          },
        ],
      },
    }) as unknown as typeof supabaseStub.current;

    const user = userEvent.setup();
    renderAt('/activity/sessions/abc-123');

    const titleCell = await screen.findByText(/Vase/);
    const tr = titleCell.closest('tr');
    expect(tr).not.toBeNull();
    await user.click(tr!);

    // Uploaded photo IS signed.
    await waitFor(() => {
      expect(mocks.createSignedUrlMock).toHaveBeenCalledWith(
        'a/thumb.webp',
        3600,
      );
    });
    // D-13 invariant: failed photo's thumbnail is NEVER signed.
    expect(mocks.createSignedUrlMock).not.toHaveBeenCalledWith(
      'b/thumb.webp',
      3600,
    );
    expect(mocks.createSignedUrlMock).not.toHaveBeenCalledWith(
      'b/full.jpg',
      3600,
    );
  });

  it('Test 11 — renders not-found state when session detail returns null', async () => {
    supabaseStub.current = makeSupabaseStub({
      sessionRow: null, // get_session_detail returns []
    }) as unknown as typeof supabaseStub.current;

    renderAt('/activity/sessions/does-not-exist');

    await waitFor(() => {
      expect(screen.getByText(/Session not found/i)).toBeInTheDocument();
    });
  });
});

