import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Phase 3 / D-32 / D-34 — UiTopPagesTable tests.
// Mocks useUiTopPages. Range-driven; specialist + mode do NOT apply (D-34 —
// hook does not consume those filters). Verifies TanStack v8 sortable shape,
// default sort, copy, and per-card loading/empty/error states.

const useUiTopPagesMock = vi.fn();
vi.mock('../../hooks/activity/useUiTopPages', () => ({
  useUiTopPages: () => useUiTopPagesMock(),
}));

import { UiTopPagesTable } from './UiTopPagesTable';

beforeEach(() => {
  useUiTopPagesMock.mockReset();
});

const SAMPLE_ROWS = [
  { page_path: '/sessions/abc',  view_count: 120 },
  { page_path: '/items/xyz',     view_count: 45 },
  { page_path: '/dashboard',     view_count: 700 },
  { page_path: '/photos/2',      view_count: 12 },
];

describe('<UiTopPagesTable>', () => {
  it('Test 4a: renders TanStack table with 2 columns: Path, Views', () => {
    useUiTopPagesMock.mockReturnValue({
      data: SAMPLE_ROWS,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<UiTopPagesTable />);
    const headers = screen.getAllByRole('columnheader');
    expect(headers).toHaveLength(2);
    expect(headers[0].textContent).toContain('Path');
    expect(headers[1].textContent).toContain('Views');
  });

  it('Test 4b: default sort is view_count desc (largest count first)', () => {
    useUiTopPagesMock.mockReturnValue({
      data: SAMPLE_ROWS,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<UiTopPagesTable />);
    // First data row should be /dashboard (view_count = 700, the highest).
    const rows = screen.getAllByRole('row');
    // rows[0] is the header; rows[1..] are body rows.
    expect(within(rows[1]).getByText('/dashboard')).toBeInTheDocument();
    expect(within(rows[1]).getByText('700')).toBeInTheDocument();
  });

  it('Test 4c: clicking the Views header toggles ascending sort (smallest first)', async () => {
    useUiTopPagesMock.mockReturnValue({
      data: SAMPLE_ROWS,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<UiTopPagesTable />);
    const viewsHeader = screen.getAllByRole('columnheader')[1];
    // Two clicks to flip from desc → asc.
    await userEvent.click(viewsHeader);
    await userEvent.click(viewsHeader);
    const rows = screen.getAllByRole('row');
    expect(within(rows[1]).getByText('/photos/2')).toBeInTheDocument();
    expect(within(rows[1]).getByText('12')).toBeInTheDocument();
  });

  it('Test 5: heading "Top page paths" + subheading "Top 10 by view count · selected range"', () => {
    useUiTopPagesMock.mockReturnValue({
      data: SAMPLE_ROWS,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<UiTopPagesTable />);
    expect(screen.getByText('Top page paths')).toBeInTheDocument();
    expect(
      screen.getByText('Top 10 by view count · selected range'),
    ).toBeInTheDocument();
  });

  it('Test 6: empty state renders heading "No views in this range" body "Try widening the date range."', () => {
    useUiTopPagesMock.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<UiTopPagesTable />);
    expect(screen.getByText('No views in this range')).toBeInTheDocument();
    expect(screen.getByText('Try widening the date range.')).toBeInTheDocument();
  });

  it('Test 7: loading state renders TableSkeleton with 6 rows', () => {
    useUiTopPagesMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });
    const { container } = render(<UiTopPagesTable />);
    // TableSkeleton renders <tr> children; expect 6 rows × 2 cells × 1 inner skeleton
    const skeletonRows = container.querySelectorAll('tbody tr');
    expect(skeletonRows.length).toBe(6);
  });

  it('Test 8: error state renders locked <ErrorState heading="Couldn\'t load top pages" body="Retry below." onRetry={refetch} />', async () => {
    const refetchSpy = vi.fn();
    useUiTopPagesMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('boom'),
      refetch: refetchSpy,
    });
    render(<UiTopPagesTable />);
    expect(screen.getByText("Couldn't load top pages")).toBeInTheDocument();
    expect(screen.getByText('Retry below.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(refetchSpy).toHaveBeenCalledOnce();
  });
});
