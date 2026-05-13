import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RecentErrorsTable } from './RecentErrorsTable';
import { useAuthStore } from '../../stores/authStore';

// Mock the data hook — table reads rows + states from here.
const useRecentErrorsMock = vi.fn();
vi.mock('../../hooks/extension/useRecentErrors', () => ({
  useRecentErrors: () => useRecentErrorsMock(),
}));

// Don't mock useAuthStore — the real Zustand store is reset per-test via
// useAuthStore.setState (matching the protected-route test pattern in
// src/tests/protected-route.test.tsx).

// JSDom does NOT implement HTMLDialogElement.showModal/.close natively —
// polyfill them so PayloadViewerModal effects can run without throwing.
beforeEach(() => {
  if (typeof HTMLDialogElement !== 'undefined') {
    if (!HTMLDialogElement.prototype.showModal) {
      HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
        this.setAttribute('open', '');
      };
    }
    if (!HTMLDialogElement.prototype.close) {
      HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
        this.removeAttribute('open');
        this.dispatchEvent(new Event('close'));
      };
    }
  }
  useRecentErrorsMock.mockReset();
});

const SAMPLE_ROWS = [
  {
    id: 'r1',
    created_at: '2026-04-29T10:00:00Z',
    user_email: 'a@x.com',
    event_type: 'catalog_batch',
    error_message: 'timeout fetching item',
    extension_version: '2.0.1',
    items_content: { batch_id: 'b1', items: 3 },
  },
  {
    id: 'r2',
    created_at: '2026-04-28T10:00:00Z',
    user_email: null,
    event_type: 'portal_upload',
    error_message: 'auth failed',
    extension_version: '2.0.0',
    items_content: { upload_id: 'u1' },
  },
  {
    id: 'r3',
    created_at: '2026-04-27T10:00:00Z',
    user_email: 'b@x.com',
    event_type: 'catalog_single',
    error_message: 'parse error',
    extension_version: '2.0.1',
    items_content: { item_id: 'i9' },
  },
];

function setProfileEmail(email: string | null) {
  useAuthStore.setState({
    profile:
      email == null
        ? null
        : ({
            id: 'p1',
            email,
            role: 'admin',
            created_at: '2026-01-01',
          } as never),
  });
}

describe('<RecentErrorsTable>', () => {
  it('renders 6 column headers in order: Time | User | Event | Error | Version | Payload', () => {
    setProfileEmail('admin@example.com');
    useRecentErrorsMock.mockReturnValue({
      data: SAMPLE_ROWS,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<RecentErrorsTable />);
    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent?.trim());
    expect(headers).toEqual([
      expect.stringMatching(/^Time/),
      expect.stringMatching(/^User/),
      expect.stringMatching(/^Event/),
      expect.stringMatching(/^Error/),
      expect.stringMatching(/^Version/),
      expect.stringMatching(/^Payload/),
    ]);
  });

  it('renders one row per error fixture', () => {
    setProfileEmail('admin@example.com');
    useRecentErrorsMock.mockReturnValue({
      data: SAMPLE_ROWS,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<RecentErrorsTable />);
    // 1 thead row + 3 tbody rows = 4 total.
    expect(screen.getAllByRole('row')).toHaveLength(4);
  });

  it('User column renders EMPTY (em dash) when user_email is null', () => {
    setProfileEmail('admin@example.com');
    useRecentErrorsMock.mockReturnValue({
      data: SAMPLE_ROWS,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<RecentErrorsTable />);
    // r2 has null user_email; the User cell shows '—'.
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  // D-18 INVARIANT — admin: Payload column header rendered, but NO View → button in cells.
  it('admin: Payload header renders but cells have no "View →" affordance (D-18)', () => {
    setProfileEmail('admin@example.com');
    useRecentErrorsMock.mockReturnValue({
      data: SAMPLE_ROWS,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<RecentErrorsTable />);
    expect(screen.getByRole('columnheader', { name: /^Payload/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /View/i })).not.toBeInTheDocument();
  });

  // D-18 INVARIANT — dev: each row has a View → button.
  it('dev: each row has a "View →" button with aria-haspopup="dialog" (D-18)', () => {
    setProfileEmail('josh@potomackco.com');
    useRecentErrorsMock.mockReturnValue({
      data: SAMPLE_ROWS,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<RecentErrorsTable />);
    const buttons = screen.getAllByRole('button', { name: /View/i });
    expect(buttons).toHaveLength(SAMPLE_ROWS.length);
    for (const b of buttons) {
      expect(b).toHaveAttribute('aria-haspopup', 'dialog');
    }
  });

  it('dev: clicking View → opens PayloadViewerModal with row-derived title and payload', async () => {
    setProfileEmail('josh@potomackco.com');
    useRecentErrorsMock.mockReturnValue({
      data: SAMPLE_ROWS,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    const user = userEvent.setup();
    render(<RecentErrorsTable />);
    // Modal not yet open.
    const modal = screen.getByTestId('payload-modal') as HTMLDialogElement;
    expect(modal.hasAttribute('open')).toBe(false);

    // Click the FIRST View button — corresponds to the first rendered row.
    // After default sort by created_at desc, row r1 (newest) is first.
    const firstViewButton = screen.getAllByRole('button', { name: /View/i })[0];
    await user.click(firstViewButton);

    expect(modal.hasAttribute('open')).toBe(true);
    // Title format: `${event_type} payload — ${user_email ?? 'unknown'}`.
    expect(screen.getByText('catalog_batch payload — a@x.com')).toBeInTheDocument();
    // Payload body shows JSON.stringify of items_content.
    const body = screen.getByTestId('payload-modal-body');
    expect(body.textContent).toContain('"batch_id": "b1"');
  });

  it('dev: row with null user_email shows "unknown" in modal title', async () => {
    setProfileEmail('josh@potomackco.com');
    useRecentErrorsMock.mockReturnValue({
      data: [SAMPLE_ROWS[1]], // only r2 (null email)
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    const user = userEvent.setup();
    render(<RecentErrorsTable />);
    await user.click(screen.getByRole('button', { name: /View/i }));
    expect(screen.getByText('portal_upload payload — unknown')).toBeInTheDocument();
  });

  it('default sorts by created_at desc (newest on top)', () => {
    setProfileEmail('admin@example.com');
    useRecentErrorsMock.mockReturnValue({
      data: SAMPLE_ROWS,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<RecentErrorsTable />);
    const rows = screen.getAllByRole('row').slice(1); // skip header
    expect(rows[0]).toHaveTextContent('catalog_batch'); // r1
    expect(rows[1]).toHaveTextContent('portal_upload'); // r2
    expect(rows[2]).toHaveTextContent('catalog_single'); // r3
  });

  it('clicking the Time column header cycles sort state (desc → none → asc → desc)', async () => {
    setProfileEmail('admin@example.com');
    useRecentErrorsMock.mockReturnValue({
      data: SAMPLE_ROWS,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    const user = userEvent.setup();
    render(<RecentErrorsTable />);
    const timeHeader = screen.getByRole('columnheader', { name: /^Time/ });
    // Default sort is desc.
    expect(timeHeader).toHaveAttribute('aria-sort', 'descending');
    // TanStack Table v8 default cycle: desc → none → asc → desc.
    await user.click(timeHeader);
    expect(timeHeader).toHaveAttribute('aria-sort', 'none');
    await user.click(timeHeader);
    expect(timeHeader).toHaveAttribute('aria-sort', 'ascending');
    await user.click(timeHeader);
    expect(timeHeader).toHaveAttribute('aria-sort', 'descending');
  });

  it('Payload column header is NOT sortable', () => {
    setProfileEmail('josh@potomackco.com');
    useRecentErrorsMock.mockReturnValue({
      data: SAMPLE_ROWS,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<RecentErrorsTable />);
    const payloadHeader = screen.getByRole('columnheader', { name: /^Payload/ });
    // Non-sortable column has no aria-sort attribute (or it's 'none').
    const ariaSort = payloadHeader.getAttribute('aria-sort');
    expect(ariaSort === null || ariaSort === 'none').toBe(true);
  });

  it('renders TableSkeleton when isLoading', () => {
    setProfileEmail('admin@example.com');
    useRecentErrorsMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });
    const { container } = render(<RecentErrorsTable />);
    const pulseBars = container.querySelectorAll('.motion-safe\\:animate-pulse');
    // 5 skeleton rows × 6 columns.
    expect(pulseBars.length).toBe(5 * 6);
  });

  it('renders EmptyState with the locked copy when data is empty', () => {
    setProfileEmail('admin@example.com');
    useRecentErrorsMock.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<RecentErrorsTable />);
    expect(screen.getByRole('heading', { name: /No errors in this range/i })).toBeInTheDocument();
    expect(
      screen.getByText(/Nothing in the selected window\. The extension is having a quiet stretch\./i),
    ).toBeInTheDocument();
  });

  it('renders ErrorState (locked Phase 1 contract) on error and Retry calls refetch', async () => {
    const refetch = vi.fn();
    setProfileEmail('admin@example.com');
    useRecentErrorsMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('boom'),
      refetch,
    });
    const user = userEvent.setup();
    render(<RecentErrorsTable />);
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load recent errors");
    expect(screen.getByText('Retry below.')).toBeInTheDocument();
    const retryButtons = screen.getAllByRole('button', { name: /Retry/i });
    expect(retryButtons).toHaveLength(1);
    await user.click(retryButtons[0]);
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('uses ONE useReactTable instance regardless of dev/admin (no dual-table branching)', () => {
    // Sanity: both paths render a single <table> in the body. Loading/Empty/
    // Error wrappers don't apply because data is non-empty here.
    setProfileEmail('admin@example.com');
    useRecentErrorsMock.mockReturnValue({
      data: SAMPLE_ROWS,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    const { container, rerender } = render(<RecentErrorsTable />);
    expect(container.querySelectorAll('table')).toHaveLength(1);

    setProfileEmail('josh@potomackco.com');
    rerender(<RecentErrorsTable />);
    expect(container.querySelectorAll('table')).toHaveLength(1);
  });
});
