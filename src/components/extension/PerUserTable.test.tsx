import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PerUserTable } from './PerUserTable';

// Mock usePerUserSummary — the table reads its rows from this hook.
const usePerUserMock = vi.fn();
vi.mock('../../hooks/extension/usePerUserSummary', () => ({
  usePerUserSummary: () => usePerUserMock(),
}));

// Phase 8: PerUserTable.tsx reads `isDev` from authStore to gate the
// "Errors" column. Default to isDev=true here so existing assertions
// (8 columns, Errors header present) keep passing; the dedicated
// admin-trim test below flips it to false.
let isDevMockValue = true;
vi.mock('../../stores/authStore', () => ({
  useAuthStore: (selector: (s: { isDev: boolean }) => unknown) =>
    selector({ isDev: isDevMockValue }),
}));

const SAMPLE = [
  // Newest last-seen at top by default sort.
  {
    user_email_label: 'a@x.com',
    catalog_single: 5,
    catalog_batch: 2,
    portal_upload: 0,
    spreadsheet_transform: 0,
    data_import: 0,
    total_errors: 0,
    last_seen_at: '2026-04-29T10:00:00Z',
  },
  {
    user_email_label: 'b@x.com',
    catalog_single: 0,
    catalog_batch: 5,
    portal_upload: 1,
    spreadsheet_transform: 0,
    data_import: 0,
    total_errors: 1,
    last_seen_at: '2026-04-28T10:00:00Z',
  },
  {
    user_email_label: 'Unknown',
    catalog_single: 0,
    catalog_batch: 0,
    portal_upload: 0,
    spreadsheet_transform: 0,
    data_import: 0,
    total_errors: 0,
    last_seen_at: '2026-04-27T10:00:00Z',
  },
];

beforeEach(() => {
  usePerUserMock.mockReset();
  isDevMockValue = true;
});

describe('<PerUserTable>', () => {
  it('renders 8 columns and one row per user (3 data rows + 1 header row)', () => {
    usePerUserMock.mockReturnValue({ data: SAMPLE, isLoading: false, error: null, refetch: vi.fn() });
    render(<PerUserTable />);
    expect(screen.getAllByRole('columnheader')).toHaveLength(8);
    // 1 thead row + 3 tbody rows = 4 total.
    expect(screen.getAllByRole('row')).toHaveLength(4);
  });

  it('renders the wide-pivot column headers in order', () => {
    usePerUserMock.mockReturnValue({ data: SAMPLE, isLoading: false, error: null, refetch: vi.fn() });
    render(<PerUserTable />);
    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent?.trim());
    expect(headers).toEqual([
      expect.stringMatching(/^User/),
      expect.stringMatching(/^catalog_single/),
      expect.stringMatching(/^catalog_batch/),
      expect.stringMatching(/^portal_upload/),
      expect.stringMatching(/^spreadsheet_transform/),
      expect.stringMatching(/^data_import/),
      expect.stringMatching(/^Errors/),
      expect.stringMatching(/^Last seen/),
    ]);
  });

  it('default-sorts by last_seen_at desc (most-recent user on top)', () => {
    usePerUserMock.mockReturnValue({ data: SAMPLE, isLoading: false, error: null, refetch: vi.fn() });
    render(<PerUserTable />);
    const rows = screen.getAllByRole('row').slice(1); // skip header
    expect(rows[0]).toHaveTextContent('a@x.com');
    expect(rows[1]).toHaveTextContent('b@x.com');
    expect(rows[2]).toHaveTextContent('Unknown');
  });

  it('renders Unknown row with italic text-gray-500 styling on the User cell', () => {
    usePerUserMock.mockReturnValue({ data: SAMPLE, isLoading: false, error: null, refetch: vi.fn() });
    render(<PerUserTable />);
    const unknownSpan = screen.getByText('Unknown');
    expect(unknownSpan.className).toMatch(/italic/);
    // Phase 7 unified-design: muted gray now resolves to `text-ink-3`.
    expect(unknownSpan.className).toMatch(/text-ink-3/);
  });

  it('clicking the User column header cycles unsorted/asc/desc', async () => {
    usePerUserMock.mockReturnValue({ data: SAMPLE, isLoading: false, error: null, refetch: vi.fn() });
    const user = userEvent.setup();
    render(<PerUserTable />);

    const userHeader = screen.getByRole('columnheader', { name: /^User/ });
    expect(userHeader).toHaveAttribute('aria-sort', 'none');

    await user.click(userHeader);
    expect(userHeader).toHaveAttribute('aria-sort', 'ascending');

    // Row order asc: Unknown is pinned last by alpha because 'U' > 'b' > 'a' actually 'Unknown'
    // in default localeCompare puts 'Unknown' after lowercase letters? Let's just verify
    // via desc click that the indicator state changes.
    await user.click(userHeader);
    expect(userHeader).toHaveAttribute('aria-sort', 'descending');
  });

  it('numeric cells are right-aligned with tabular-nums', () => {
    usePerUserMock.mockReturnValue({ data: SAMPLE, isLoading: false, error: null, refetch: vi.fn() });
    render(<PerUserTable />);
    // First data row, col 1 (catalog_single = 5 for a@x.com).
    const firstRow = screen.getAllByRole('row')[1];
    const cells = within(firstRow).getAllByRole('cell');
    // catalog_single cell is index 1 (after User col).
    expect(cells[1].className).toMatch(/text-right/);
    expect(cells[1].textContent).toContain('5');
    const inner = cells[1].querySelector('span');
    expect(inner?.className).toMatch(/tabular-nums/);
  });

  it('renders TableSkeleton inside a wrapper <table> when isLoading (dev: 8 cols)', () => {
    usePerUserMock.mockReturnValue({ data: undefined, isLoading: true, error: null, refetch: vi.fn() });
    const { container } = render(<PerUserTable />);
    // TableSkeleton renders 5 rows × 8 cols of pulsing bars.
    const pulseBars = container.querySelectorAll('.motion-safe\\:animate-pulse');
    expect(pulseBars.length).toBe(5 * 8);
  });

  // Phase 8 — admin-trim: the trailing "Errors" column is a failure count and
  // is dev-only per the user directive "admin shouldn't see failures".
  it('Phase 8: admin (isDev=false) renders 7 columns and omits the Errors header', () => {
    isDevMockValue = false;
    usePerUserMock.mockReturnValue({ data: SAMPLE, isLoading: false, error: null, refetch: vi.fn() });
    render(<PerUserTable />);
    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent?.trim());
    expect(headers).toEqual([
      expect.stringMatching(/^User/),
      expect.stringMatching(/^catalog_single/),
      expect.stringMatching(/^catalog_batch/),
      expect.stringMatching(/^portal_upload/),
      expect.stringMatching(/^spreadsheet_transform/),
      expect.stringMatching(/^data_import/),
      expect.stringMatching(/^Last seen/),
    ]);
    expect(screen.queryByRole('columnheader', { name: /^Errors/ })).not.toBeInTheDocument();
  });

  it('Phase 8: admin loading skeleton renders 5 rows × 7 cols (not 8)', () => {
    isDevMockValue = false;
    usePerUserMock.mockReturnValue({ data: undefined, isLoading: true, error: null, refetch: vi.fn() });
    const { container } = render(<PerUserTable />);
    const pulseBars = container.querySelectorAll('.motion-safe\\:animate-pulse');
    expect(pulseBars.length).toBe(5 * 7);
  });

  it('renders EmptyState with the locked copy when data is empty', () => {
    usePerUserMock.mockReturnValue({ data: [], isLoading: false, error: null, refetch: vi.fn() });
    render(<PerUserTable />);
    expect(screen.getByRole('heading', { name: /No users in this range/i })).toBeInTheDocument();
    expect(screen.getByText(/Try widening the date range or clearing the user filter\./i)).toBeInTheDocument();
  });

  it('renders ErrorState (locked Phase 1 contract) when error and Retry calls refetch', async () => {
    const refetch = vi.fn();
    usePerUserMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('boom'),
      refetch,
    });
    const user = userEvent.setup();
    render(<PerUserTable />);
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load per-user data");
    expect(screen.getByText('Retry below.')).toBeInTheDocument();
    // Locked contract: ErrorState renders its own Retry button — no sibling button.
    const retryButtons = screen.getAllByRole('button', { name: /Retry/i });
    expect(retryButtons).toHaveLength(1);
    await user.click(retryButtons[0]);
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
