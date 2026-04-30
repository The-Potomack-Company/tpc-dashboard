import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cloneElement, isValidElement } from 'react';
import type { ReactElement, ReactNode } from 'react';

// Phase 2 / EXT-03 — ErrorRateChart tests.
// Reuses the Phase 1 Recharts JSDom mock pattern verbatim (Sparkline.test.tsx
// lines 13-32) sized for the chart-card body height (h-72 = 288px).
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

const useErrorRateMock = vi.fn();
vi.mock('../../hooks/extension/useErrorRate', () => ({
  useErrorRate: () => useErrorRateMock(),
}));

import { ErrorRateChart } from './ErrorRateChart';

beforeEach(() => {
  useErrorRateMock.mockReset();
});

const ROWS = [
  { event_type: 'catalog_single', errors: 1, total: 100, rate: 0.01 },
  { event_type: 'catalog_batch', errors: 6, total: 100, rate: 0.06 },
  { event_type: 'portal_upload', errors: 0, total: 50, rate: 0.0 },
  { event_type: 'spreadsheet_transform', errors: 12, total: 100, rate: 0.12 },
  { event_type: 'data_import', errors: 2, total: 80, rate: 0.025 },
];

describe('<ErrorRateChart>', () => {
  it('Test 1: renders exactly one Bar series (single bar group, dataKey="rate_pct")', () => {
    useErrorRateMock.mockReturnValue({
      data: ROWS,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    const { container } = render(<ErrorRateChart />);
    // Recharts renders one <g class="recharts-bar"> per Bar element. We render
    // exactly one Bar (single series — bars are per-data-row, NOT per-series).
    const barGroups = container.querySelectorAll('.recharts-bar');
    expect(barGroups.length).toBe(1);
  });

  it('Test 2: BarChart uses layout="vertical" (Recharts horizontal-bars idiom)', () => {
    useErrorRateMock.mockReturnValue({
      data: ROWS,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    const { container } = render(<ErrorRateChart />);
    // Recharts emits the layout direction as a class on the wrapper svg or
    // via the data-orientation attribute on the cartesian layout. The most
    // stable signal is the YAxis having type="category" (vertical layout
    // requires category Y axis).
    const yAxis = container.querySelector('.recharts-yAxis');
    expect(yAxis).not.toBeNull();
    // YAxis tick labels should contain the event_type literals
    expect(screen.getByText('catalog_single')).toBeInTheDocument();
    expect(screen.getByText('spreadsheet_transform')).toBeInTheDocument();
  });

  it('Test 3: each row has a value label rendered as XX.X%', () => {
    useErrorRateMock.mockReturnValue({
      data: ROWS,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<ErrorRateChart />);
    // formatPercent(rate*100, 1) produces XX.X% — assert at least the high-rate
    // and low-rate values are visible.
    expect(screen.getByText('12.0%')).toBeInTheDocument();
    expect(screen.getByText('1.0%')).toBeInTheDocument();
  });

  it('Test 4: empty data renders the empty-state copy "No events in this range"', () => {
    useErrorRateMock.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<ErrorRateChart />);
    expect(screen.getByText('No events in this range')).toBeInTheDocument();
  });

  it('Test 5a: loading branch renders skeleton', () => {
    useErrorRateMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });
    render(<ErrorRateChart />);
    expect(screen.getByTestId('error-rate-skeleton')).toBeInTheDocument();
  });

  it('Test 5b: error branch renders ErrorState (locked contract); Retry calls refetch', async () => {
    const refetch = vi.fn();
    useErrorRateMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('boom'),
      refetch,
    });
    render(<ErrorRateChart />);
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load error rates");
    expect(screen.getByText('Something went wrong. Retry below.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Retry/i }));
    expect(refetch).toHaveBeenCalled();
  });

  it('Test 6: bar fill is the locked neutral gray #9ca3af and high rate uses red text', () => {
    useErrorRateMock.mockReturnValue({
      data: ROWS,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    const { container } = render(<ErrorRateChart />);
    // The Recharts Bar `fill` prop renders to the underlying <rect>'s fill
    // attribute. At least one rectangle should have fill="#9ca3af".
    const rects = container.querySelectorAll('rect[fill="#9ca3af"]');
    expect(rects.length).toBeGreaterThan(0);
    // High-rate text (>= 5%) uses fill-red-600 class on the label <text>.
    // catalog_batch is 6%, spreadsheet_transform is 12% → 2 high-rate labels.
    const highTexts = container.querySelectorAll('text.fill-red-600');
    expect(highTexts.length).toBeGreaterThanOrEqual(2);
  });
});
