import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StuckItemsTable } from './StuckItemsTable';
import type { StuckItemsRow } from '../../services/activity/queries';

// Phase 3 / Plan 03-06 / Task 3 — StuckItemsTable tests.
//
// D-23: 6 admin columns (Receipt #, Title, AI status, Age, Session, Specialist)
//       + 3 dev columns (Category, Estimate, Raw); rows clickable → navigate
//       to /activity/sessions/<row.session_id>.

const useStuckItemsMock = vi.fn();
const useAuthStoreMock = vi.fn();
const navigateMock = vi.fn();

vi.mock('../../hooks/activity/useStuckItems', () => ({
  useStuckItems: () => useStuckItemsMock(),
}));
vi.mock('../../stores/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) => useAuthStoreMock(selector),
}));
vi.mock('react-router', () => ({
  useNavigate: () => navigateMock,
}));

// JSDom does NOT implement HTMLDialogElement — polyfill so PayloadViewerModal
// can mount inside the dev test paths.
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
});

const ROWS: StuckItemsRow[] = [
  {
    item_id: 'i1',
    receipt_number: 'R001',
    title: 'Painting',
    ai_status: 'failed',
    created_at: new Date(Date.now() - 14 * 60 * 60 * 1000).toISOString(),
    session_id: 's1',
    session_name: 'Sale 0301',
    specialist_id: 'u1',
    specialist_display_name: 'Alice',
    category: 'Art',
    estimate: '$100-200',
    photo_paths: [],
    age_seconds: 14 * 3600,
  },
  {
    item_id: 'i2',
    receipt_number: 'R002',
    title: 'Vase',
    ai_status: 'pending',
    created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    session_id: 's2',
    session_name: 'Sale 0302',
    specialist_id: 'u2',
    specialist_display_name: 'Bob',
    category: 'Decorative',
    estimate: '$50-100',
    photo_paths: [],
    age_seconds: 3 * 3600,
  },
];

beforeEach(() => {
  useStuckItemsMock.mockReset();
  useAuthStoreMock.mockReset();
  navigateMock.mockReset();
  // Default: admin (non-dev email).
  useAuthStoreMock.mockImplementation((selector) =>
    selector({ profile: { email: 'admin@example.com' } }),
  );
});

describe('<StuckItemsTable>', () => {
  it('Test 1: renders 6 admin column headers when isDev=false', () => {
    useStuckItemsMock.mockReturnValue({
      data: ROWS,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<StuckItemsTable />);
    // 6 admin columns.
    expect(screen.getByText('Receipt #')).toBeInTheDocument();
    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('AI status')).toBeInTheDocument();
    expect(screen.getByText('Age')).toBeInTheDocument();
    expect(screen.getByText('Session')).toBeInTheDocument();
    expect(screen.getByText('Specialist')).toBeInTheDocument();
    // Dev-only columns absent.
    expect(screen.queryByText('Category')).not.toBeInTheDocument();
    expect(screen.queryByText('Estimate')).not.toBeInTheDocument();
    expect(screen.queryByText('Raw')).not.toBeInTheDocument();
  });

  it('Test 2: renders 9 columns total when isDev=true (6 admin + 3 dev)', () => {
    useAuthStoreMock.mockImplementation((selector) =>
      selector({ profile: { email: 'josh@potomackco.com' } }),
    );
    useStuckItemsMock.mockReturnValue({
      data: ROWS,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<StuckItemsTable />);
    // 6 admin headers.
    expect(screen.getByText('Receipt #')).toBeInTheDocument();
    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('AI status')).toBeInTheDocument();
    expect(screen.getByText('Age')).toBeInTheDocument();
    expect(screen.getByText('Session')).toBeInTheDocument();
    expect(screen.getByText('Specialist')).toBeInTheDocument();
    // 3 dev headers.
    expect(screen.getByText('Category')).toBeInTheDocument();
    expect(screen.getByText('Estimate')).toBeInTheDocument();
    expect(screen.getByText('Raw')).toBeInTheDocument();
  });

  it('Test 3: default sort is age descending (oldest first)', () => {
    useStuckItemsMock.mockReturnValue({
      data: ROWS,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<StuckItemsTable />);
    // The 14h row should appear before the 3h row (oldest first).
    const rows = screen.getAllByRole('row');
    // [0] is header row; [1] should be R001 (14h, oldest), [2] should be R002 (3h).
    expect(rows[1].textContent).toContain('R001');
    expect(rows[2].textContent).toContain('R002');
  });

  it('Test 4: row click navigates to /activity/sessions/<session_id>', async () => {
    useStuckItemsMock.mockReturnValue({
      data: ROWS,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    const user = userEvent.setup();
    render(<StuckItemsTable />);
    const r001Cell = screen.getByText('R001');
    await user.click(r001Cell);
    expect(navigateMock).toHaveBeenCalledWith('/activity/sessions/s1');
  });

  it('Test 5: keyboard Enter/Space on row triggers navigation', async () => {
    useStuckItemsMock.mockReturnValue({
      data: ROWS,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    const user = userEvent.setup();
    render(<StuckItemsTable />);
    // Find the data row containing R001 and focus it.
    const rows = screen.getAllByRole('row');
    rows[1].focus();
    expect(rows[1]).toHaveAttribute('tabIndex', '0');
    await user.keyboard('{Enter}');
    expect(navigateMock).toHaveBeenCalledWith('/activity/sessions/s1');
    navigateMock.mockReset();
    rows[1].focus();
    await user.keyboard(' ');
    expect(navigateMock).toHaveBeenCalledWith('/activity/sessions/s1');
  });

  it('Test 6: loading state renders <TableSkeleton>', () => {
    useStuckItemsMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });
    const { container } = render(<StuckItemsTable />);
    expect(container.querySelector('.motion-safe\\:animate-pulse')).toBeInTheDocument();
  });

  it('Test 7: empty state — heading + body when no rows', () => {
    useStuckItemsMock.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<StuckItemsTable />);
    expect(
      screen.getByRole('heading', { name: /No stuck items/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Everything is moving through the AI pipeline/i),
    ).toBeInTheDocument();
  });

  it('Test 8: error state uses locked <ErrorState>', async () => {
    const refetch = vi.fn();
    useStuckItemsMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('boom'),
      refetch,
    });
    const user = userEvent.setup();
    render(<StuckItemsTable />);
    expect(screen.getByText(/Couldn't load stuck items/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Retry/i }));
    expect(refetch).toHaveBeenCalled();
  });

  it('Test 9: AI status cell renders chip with appropriate tone class', () => {
    useStuckItemsMock.mockReturnValue({
      data: ROWS,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<StuckItemsTable />);
    // Phase 7 unified-design: chip palette adopts token vocabulary.
    const failedChip = screen.getByText('failed');
    expect(failedChip.className).toMatch(/bg-err-wash/);
    const pendingChip = screen.getByText('pending');
    expect(pendingChip.className).toMatch(/bg-bg-3/);
  });

  it('Test 10: dev Raw cell opens PayloadViewerModal; admin sees no Raw cell', async () => {
    useAuthStoreMock.mockImplementation((selector) =>
      selector({ profile: { email: 'josh@potomackco.com' } }),
    );
    useStuckItemsMock.mockReturnValue({
      data: ROWS,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    const user = userEvent.setup();
    render(<StuckItemsTable />);
    // Dev cell rendered as a "View →" button per row.
    const viewButtons = screen.getAllByRole('button', { name: /^View →$/i });
    expect(viewButtons.length).toBe(2);
    // Click the first View → opens the modal with the corresponding row's payload.
    await user.click(viewButtons[0]);
    expect(screen.getByText(/Raw stuck item/i)).toBeInTheDocument();
  });

  it('Test 10b: dev Raw cell click does NOT trigger row navigation (e.stopPropagation)', async () => {
    useAuthStoreMock.mockImplementation((selector) =>
      selector({ profile: { email: 'josh@potomackco.com' } }),
    );
    useStuckItemsMock.mockReturnValue({
      data: ROWS,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    const user = userEvent.setup();
    render(<StuckItemsTable />);
    const viewButtons = screen.getAllByRole('button', { name: /^View →$/i });
    await user.click(viewButtons[0]);
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('Test 11: component reuses useStuckItems (asserted via mock invocation)', () => {
    useStuckItemsMock.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<StuckItemsTable />);
    expect(useStuckItemsMock).toHaveBeenCalled();
  });
});
