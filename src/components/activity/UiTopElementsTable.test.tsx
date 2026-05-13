import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Phase 3 / D-32 / D-34 — UiTopElementsTable tests.
// Mocks useUiTopElements. Range-driven; specialist + mode do NOT apply (D-34).

const useUiTopElementsMock = vi.fn();
vi.mock('../../hooks/activity/useUiTopElements', () => ({
  useUiTopElements: () => useUiTopElementsMock(),
}));

import { UiTopElementsTable } from './UiTopElementsTable';

beforeEach(() => {
  useUiTopElementsMock.mockReset();
});

const SAMPLE_ROWS = [
  { element_id: 'btn-save',   click_count: 42 },
  { element_id: 'btn-cancel', click_count: 7 },
  { element_id: 'menu-open',  click_count: 99 },
  { element_id: 'tab-photos', click_count: 11 },
];

describe('<UiTopElementsTable>', () => {
  it('Test 9a: renders TanStack table with 2 columns: Element ID, Clicks', () => {
    useUiTopElementsMock.mockReturnValue({
      data: SAMPLE_ROWS,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<UiTopElementsTable />);
    const headers = screen.getAllByRole('columnheader');
    expect(headers).toHaveLength(2);
    expect(headers[0].textContent).toContain('Element ID');
    expect(headers[1].textContent).toContain('Clicks');
  });

  it('Test 9b: default sort is click_count desc (largest count first)', () => {
    useUiTopElementsMock.mockReturnValue({
      data: SAMPLE_ROWS,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<UiTopElementsTable />);
    const rows = screen.getAllByRole('row');
    // First body row should be menu-open (click_count = 99).
    expect(within(rows[1]).getByText('menu-open')).toBeInTheDocument();
    expect(within(rows[1]).getByText('99')).toBeInTheDocument();
  });

  it('Test 10: heading "Top element clicks" + subheading "Top 20 by click count · selected range"', () => {
    useUiTopElementsMock.mockReturnValue({
      data: SAMPLE_ROWS,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<UiTopElementsTable />);
    expect(screen.getByText('Top element clicks')).toBeInTheDocument();
    expect(
      screen.getByText('Top 20 by click count · selected range'),
    ).toBeInTheDocument();
  });

  it('Test 11: empty state renders heading "No clicks in this range" body "Try widening the date range."', () => {
    useUiTopElementsMock.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<UiTopElementsTable />);
    expect(screen.getByText('No clicks in this range')).toBeInTheDocument();
    expect(screen.getByText('Try widening the date range.')).toBeInTheDocument();
  });

  it('Test 12a: loading state renders TableSkeleton with 8 rows', () => {
    useUiTopElementsMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });
    const { container } = render(<UiTopElementsTable />);
    const skeletonRows = container.querySelectorAll('tbody tr');
    expect(skeletonRows.length).toBe(8);
  });

  it("Test 12b: error state renders locked <ErrorState heading=\"Couldn't load top elements\" body=\"Retry below.\" onRetry={refetch} />", async () => {
    const refetchSpy = vi.fn();
    useUiTopElementsMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('boom'),
      refetch: refetchSpy,
    });
    render(<UiTopElementsTable />);
    expect(screen.getByText("Couldn't load top elements")).toBeInTheDocument();
    expect(screen.getByText('Retry below.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(refetchSpy).toHaveBeenCalledOnce();
  });
});
