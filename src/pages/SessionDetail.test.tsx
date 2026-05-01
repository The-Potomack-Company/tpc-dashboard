import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { SessionDetailPage } from './SessionDetail';
import type { SessionDetailRow } from '../services/activity/queries';

// Phase 3 / Plan 03-08 — SessionDetail page composition smoke test.
//
// Mocks `useSessionDetail` so we can flip between loading / error / not-
// found / loaded branches; mocks the heavy children so this is a focused
// page-level test. Covers Tests 1-8 from the plan's <behavior>.

const sessionDetailMock = vi.fn();
const sessionItemsMock = vi.fn();
vi.mock('../hooks/activity/useSessionDetail', () => ({
  useSessionDetail: (id: string | undefined) => sessionDetailMock(id),
  useSessionItems: (id: string | undefined) => sessionItemsMock(id),
}));

vi.mock('../components/activity/SessionMetadataCard', () => ({
  SessionMetadataCard: ({ session }: { session: SessionDetailRow }) => (
    <div data-testid="session-metadata-card">
      <span data-testid="metadata-name">{session.name}</span>
      <span data-testid="metadata-created-at">{session.created_at}</span>
      <span data-testid="metadata-updated-at">{session.updated_at}</span>
    </div>
  ),
}));
vi.mock('../components/activity/PhotoCoveragePanel', () => ({
  PhotoCoveragePanel: ({ sessionId }: { sessionId: string }) => (
    <div data-testid="photo-coverage-panel" data-session-id={sessionId} />
  ),
}));
vi.mock('../components/activity/SessionItemList', () => ({
  SessionItemList: ({ sessionId }: { sessionId: string }) => (
    <div data-testid="session-item-list" data-session-id={sessionId} />
  ),
}));

function makeWrapper(initialEntries: string[]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={initialEntries}>
      <QueryClientProvider client={client}>
        <Routes>
          <Route path="/activity/sessions/:id" element={children} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

const SAMPLE_SESSION: SessionDetailRow = {
  session_id: 'abc-123',
  name: 'Sale 4001 — Day 1',
  mode: 'sale',
  status: 'active',
  assigned_to_id: 'spec-1',
  assigned_to_display_name: 'Alice Specialist',
  created_by_id: 'admin-1',
  created_by_display_name: 'Bob Admin',
  notes: 'Initial intake',
  review_notes: '',
  created_at: '2026-04-29T14:00:00Z',
  updated_at: '2026-04-29T15:30:00Z',
};

describe('SessionDetailPage', () => {
  const originalTitle = document.title;

  beforeEach(() => {
    sessionDetailMock.mockReset();
    sessionItemsMock.mockReset();
    sessionItemsMock.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    document.title = originalTitle;
  });

  afterEach(() => {
    document.title = originalTitle;
  });

  it('Test 1: reads :id param and calls useSessionDetail with that id', () => {
    sessionDetailMock.mockReturnValue({
      data: SAMPLE_SESSION,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<SessionDetailPage />, {
      wrapper: makeWrapper(['/activity/sessions/abc-123']),
    });

    expect(sessionDetailMock).toHaveBeenCalledWith('abc-123');
  });

  it('Test 2: BackLink preserves URL search params (D-03)', () => {
    sessionDetailMock.mockReturnValue({
      data: SAMPLE_SESSION,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<SessionDetailPage />, {
      wrapper: makeWrapper([
        '/activity/sessions/abc-123?range=7d&specialists=a@x.com&mode=house',
      ]),
    });

    const back = screen.getByRole('link', { name: /Activity/i });
    expect(back).toBeInTheDocument();
    // The back link href must contain the preserved search params.
    expect(back.getAttribute('href')).toBe(
      '/activity?range=7d&specialists=a@x.com&mode=house',
    );
  });

  it('Test 2b: BackLink to /activity (no search) when no URL params', () => {
    sessionDetailMock.mockReturnValue({
      data: SAMPLE_SESSION,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<SessionDetailPage />, {
      wrapper: makeWrapper(['/activity/sessions/abc-123']),
    });

    const back = screen.getByRole('link', { name: /Activity/i });
    expect(back.getAttribute('href')).toBe('/activity');
  });

  it('Test 3: renders heading + breadcrumb + subtitle when session loads', () => {
    sessionDetailMock.mockReturnValue({
      data: SAMPLE_SESSION,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<SessionDetailPage />, {
      wrapper: makeWrapper(['/activity/sessions/abc-123']),
    });

    expect(
      screen.getByRole('heading', { name: 'Sale 4001 — Day 1', level: 1 }),
    ).toBeInTheDocument();
    // Breadcrumb: Activity › {session.name}
    const breadcrumb = screen.getByLabelText(/breadcrumb/i);
    expect(breadcrumb.textContent).toContain('Activity');
    expect(breadcrumb.textContent).toContain('Sale 4001 — Day 1');
    // Subtitle: mode · status · created {formatDateTime(...)}
    const subtitle = screen.getByText((content) =>
      content.includes('sale') &&
      content.includes('active') &&
      content.includes('created'),
    );
    expect(subtitle).toBeInTheDocument();
  });

  it('Test 4: document.title is "{session.name} — TPC Dashboard" when loaded; falls back to "Session — TPC Dashboard" while loading', () => {
    // Loading branch
    sessionDetailMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });
    const { unmount } = render(<SessionDetailPage />, {
      wrapper: makeWrapper(['/activity/sessions/abc-123']),
    });
    expect(document.title).toBe('Session — TPC Dashboard');
    unmount();

    // Loaded branch
    sessionDetailMock.mockReturnValue({
      data: SAMPLE_SESSION,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<SessionDetailPage />, {
      wrapper: makeWrapper(['/activity/sessions/abc-123']),
    });
    expect(document.title).toBe('Sale 4001 — Day 1 — TPC Dashboard');
  });

  it('Test 4b: document.title is restored on unmount', () => {
    document.title = 'Original';
    sessionDetailMock.mockReturnValue({
      data: SAMPLE_SESSION,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    const { unmount } = render(<SessionDetailPage />, {
      wrapper: makeWrapper(['/activity/sessions/abc-123']),
    });
    expect(document.title).toBe('Sale 4001 — Day 1 — TPC Dashboard');
    unmount();
    expect(document.title).toBe('Original');
  });

  it('Test 5: composes SessionMetadataCard + PhotoCoveragePanel + SessionItemList', () => {
    sessionDetailMock.mockReturnValue({
      data: SAMPLE_SESSION,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    const { container } = render(<SessionDetailPage />, {
      wrapper: makeWrapper(['/activity/sessions/abc-123']),
    });

    const metadata = screen.getByTestId('session-metadata-card');
    const coverage = screen.getByTestId('photo-coverage-panel');
    const itemList = screen.getByTestId('session-item-list');

    expect(metadata).toBeInTheDocument();
    expect(coverage).toBeInTheDocument();
    expect(itemList).toBeInTheDocument();

    // Coverage + ItemList both receive sessionId prop
    expect(coverage.getAttribute('data-session-id')).toBe('abc-123');
    expect(itemList.getAttribute('data-session-id')).toBe('abc-123');

    // Order: metadata + coverage are siblings in the same row, then item list below
    const metadataRel = metadata.compareDocumentPosition(itemList);
    expect(metadataRel & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    const coverageRel = coverage.compareDocumentPosition(itemList);
    expect(coverageRel & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );

    // Confirm everything lives inside <main>
    const main = container.querySelector('main');
    expect(main).not.toBeNull();
    expect(main!.contains(metadata)).toBe(true);
  });

  it('Test 6: when useSessionDetail returns null (not found), renders EmptyState', () => {
    sessionDetailMock.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<SessionDetailPage />, {
      wrapper: makeWrapper(['/activity/sessions/missing-id']),
    });

    expect(screen.getByText('Session not found')).toBeInTheDocument();
    expect(
      screen.getByText(/doesn't exist or you don't have access/i),
    ).toBeInTheDocument();
    // Children not rendered.
    expect(screen.queryByTestId('session-metadata-card')).not.toBeInTheDocument();
    expect(screen.queryByTestId('photo-coverage-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('session-item-list')).not.toBeInTheDocument();
  });

  it('Test 7: when useSessionDetail errors, renders ErrorState with onRetry', () => {
    const refetch = vi.fn();
    sessionDetailMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('boom'),
      refetch,
    });
    render(<SessionDetailPage />, {
      wrapper: makeWrapper(['/activity/sessions/abc-123']),
    });

    // ErrorState renders an h2 with role="alert" containing the heading text.
    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert.textContent).toMatch(/Couldn't load session details/i);
    const retry = screen.getByRole('button', { name: /Retry/i });
    retry.click();
    expect(refetch).toHaveBeenCalled();
  });

  it('Test 8: SessionMetadataCard receives ET-formatted timestamps (page formats them)', () => {
    sessionDetailMock.mockReturnValue({
      data: SAMPLE_SESSION,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<SessionDetailPage />, {
      wrapper: makeWrapper(['/activity/sessions/abc-123']),
    });

    // The page wraps the raw ISO with useTimezone().formatDateTime → 'MMM d, yyyy h:mm a ET'
    const createdAt = screen.getByTestId('metadata-created-at');
    const updatedAt = screen.getByTestId('metadata-updated-at');

    // formatDateTime output contains 'ET' suffix and a comma-year token; raw ISO does not.
    expect(createdAt.textContent).toMatch(/ET$/);
    expect(createdAt.textContent).not.toBe(SAMPLE_SESSION.created_at);
    expect(updatedAt.textContent).toMatch(/ET$/);
    expect(updatedAt.textContent).not.toBe(SAMPLE_SESSION.updated_at);
  });

  it('shows a loading skeleton while query.isLoading', () => {
    sessionDetailMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });
    const { container } = render(<SessionDetailPage />, {
      wrapper: makeWrapper(['/activity/sessions/abc-123']),
    });

    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.queryByTestId('session-metadata-card')).not.toBeInTheDocument();
  });
});
