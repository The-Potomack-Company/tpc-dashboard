import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Phase 3 / D-29 — FailedAiBreakdown tests.
// Mocks useFailedAiBreakdown and exercises the long-form-row → 3-column-grid
// pivot, plus loading/empty/error per-card states. Component is range-driven;
// it does NOT internally gate by isDev (parent DeveloperPanel handles that).

const useFailedAiBreakdownMock = vi.fn();
vi.mock('../../hooks/activity/useFailedAiBreakdown', () => ({
  useFailedAiBreakdown: () => useFailedAiBreakdownMock(),
}));

import { FailedAiBreakdown } from './FailedAiBreakdown';

beforeEach(() => {
  useFailedAiBreakdownMock.mockReset();
});

const SAMPLE_ROWS = [
  // by specialist (3)
  { dimension: 'specialist', dim_key: 'a-id', dim_label: 'Alice', item_count: 12 },
  { dimension: 'specialist', dim_key: 'b-id', dim_label: 'Bob',   item_count: 5 },
  { dimension: 'specialist', dim_key: 'c-id', dim_label: 'Carol', item_count: 1 },
  // by mode (2)
  { dimension: 'mode', dim_key: 'house', dim_label: 'house', item_count: 9 },
  { dimension: 'mode', dim_key: 'sale',  dim_label: 'sale',  item_count: 9 },
  // by category (2)
  { dimension: 'category', dim_key: 'furniture', dim_label: 'Furniture', item_count: 11 },
  { dimension: 'category', dim_key: 'art',       dim_label: 'Art',       item_count: 7 },
];

describe('<FailedAiBreakdown>', () => {
  it('Test 8: renders 3-column grid (specialist / mode / category) from long-form rows', () => {
    useFailedAiBreakdownMock.mockReturnValue({
      data: SAMPLE_ROWS,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<FailedAiBreakdown />);
    // Column headings
    expect(screen.getByText('By specialist')).toBeInTheDocument();
    expect(screen.getByText('By mode')).toBeInTheDocument();
    expect(screen.getByText('By category')).toBeInTheDocument();
    // dim_label values appear (one per row)
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Carol')).toBeInTheDocument();
    expect(screen.getByText('house')).toBeInTheDocument();
    expect(screen.getByText('sale')).toBeInTheDocument();
    expect(screen.getByText('Furniture')).toBeInTheDocument();
    expect(screen.getByText('Art')).toBeInTheDocument();
  });

  it('Test 9: section heading "Failed-AI breakdown" + subheading "Items where ai_status = \'failed\' · selected range"', () => {
    useFailedAiBreakdownMock.mockReturnValue({
      data: SAMPLE_ROWS,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<FailedAiBreakdown />);
    expect(screen.getByText('Failed-AI breakdown')).toBeInTheDocument();
    expect(
      screen.getByText("Items where ai_status = 'failed' · selected range"),
    ).toBeInTheDocument();
  });

  it('Test 10: each row shows dim_label as label and item_count as value (formatted via formatCount)', () => {
    useFailedAiBreakdownMock.mockReturnValue({
      data: [
        { dimension: 'specialist', dim_key: 'a', dim_label: 'Alice', item_count: 1234 },
      ],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<FailedAiBreakdown />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    // formatCount(1234) → "1,234" (en-US locale)
    expect(screen.getByText('1,234')).toBeInTheDocument();
  });

  it('Test 11: empty state (zero failures) renders <EmptyState heading="No AI failures in this range" body="Healthy AI run." />', () => {
    useFailedAiBreakdownMock.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<FailedAiBreakdown />);
    expect(screen.getByText('No AI failures in this range')).toBeInTheDocument();
    expect(screen.getByText('Healthy AI run.')).toBeInTheDocument();
  });

  it('Test 12: loading state renders 3 skeleton column blocks (animate-pulse)', () => {
    useFailedAiBreakdownMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });
    const { container } = render(<FailedAiBreakdown />);
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBe(3);
  });

  it("Test 13: error state renders locked <ErrorState> with heading + body + onRetry (calls refetch on click)", async () => {
    const refetchSpy = vi.fn();
    useFailedAiBreakdownMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('boom'),
      refetch: refetchSpy,
    });
    render(<FailedAiBreakdown />);
    expect(screen.getByText("Couldn't load failed-AI breakdown")).toBeInTheDocument();
    expect(screen.getByText('Retry below.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(refetchSpy).toHaveBeenCalledOnce();
  });

  it('Test 14: a column with no rows renders italic "None" placeholder', () => {
    useFailedAiBreakdownMock.mockReturnValue({
      // Only specialist rows present — mode + category columns should show "None".
      data: [
        { dimension: 'specialist', dim_key: 'a', dim_label: 'Alice', item_count: 1 },
      ],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<FailedAiBreakdown />);
    const noneEls = screen.getAllByText('None');
    // 2 columns (mode, category) without rows → 2 "None" placeholders
    expect(noneEls.length).toBe(2);
    for (const el of noneEls) {
      expect(el.className).toContain('italic');
    }
  });
});
