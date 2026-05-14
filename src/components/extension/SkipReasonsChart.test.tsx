import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cloneElement, isValidElement } from 'react';
import type { ReactElement, ReactNode } from 'react';

// category-filtered-batch — SkipReasonsChart tests.
// Recharts ResponsiveContainer is mocked the same way ErrorRateChart.test.tsx
// does it — JSDom has no layout engine.
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

const useSkipReasonsMock = vi.fn();
vi.mock('../../hooks/extension/useSkipReasons', () => ({
  useSkipReasons: () => useSkipReasonsMock(),
}));

import { SkipReasonsChart } from './SkipReasonsChart';

beforeEach(() => {
  useSkipReasonsMock.mockReset();
});

const FULL_TOTALS = {
  no_photos: 3,
  fields_filled: 7,
  manually: 2,
  category_filter: 11,
  classification_failed: 1,
  total: 24,
};

describe('<SkipReasonsChart>', () => {
  it('renders all 5 slices when totals are non-zero', () => {
    useSkipReasonsMock.mockReturnValue({
      data: FULL_TOTALS,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    const { container } = render(<SkipReasonsChart />);

    // Recharts renders one <path class="recharts-sector"> per slice in the Pie.
    const sectors = container.querySelectorAll('.recharts-sector');
    expect(sectors.length).toBe(5);

    // Legend entries — labels render in the SVG legend wrapper.
    expect(screen.getByText('No photos')).toBeInTheDocument();
    expect(screen.getByText('Fields filled')).toBeInTheDocument();
    expect(screen.getByText('Manual skip')).toBeInTheDocument();
    expect(screen.getByText('Category filter')).toBeInTheDocument();
    expect(screen.getByText('Classification failed')).toBeInTheDocument();
  });

  it('renders empty-state when total is 0', () => {
    useSkipReasonsMock.mockReturnValue({
      data: {
        no_photos: 0,
        fields_filled: 0,
        manually: 0,
        category_filter: 0,
        classification_failed: 0,
        total: 0,
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<SkipReasonsChart />);

    expect(screen.getByTestId('skip-reasons-empty')).toBeInTheDocument();
    expect(screen.getByText('No skipped items in this range')).toBeInTheDocument();
  });

  it('renders empty-state when data is undefined (no rows aggregated yet)', () => {
    useSkipReasonsMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<SkipReasonsChart />);
    expect(screen.getByTestId('skip-reasons-empty')).toBeInTheDocument();
  });

  it('renders loading skeleton', () => {
    useSkipReasonsMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });
    render(<SkipReasonsChart />);
    expect(screen.getByTestId('skip-reasons-skeleton')).toBeInTheDocument();
  });

  it('renders ErrorState and Retry calls refetch', async () => {
    const refetch = vi.fn();
    useSkipReasonsMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('boom'),
      refetch,
    });
    render(<SkipReasonsChart />);
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load skip reasons");
    expect(screen.getByText('Something went wrong. Retry below.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Retry/i }));
    expect(refetch).toHaveBeenCalled();
  });

  it('locked palette: 5 slice fills match the chart palette spec', () => {
    useSkipReasonsMock.mockReturnValue({
      data: FULL_TOTALS,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    const { container } = render(<SkipReasonsChart />);

    // One <path> per slice; fill is on the path. We assert each expected hex
    // appears at least once (the order of paths in JSDom mirrors `data` order).
    expect(container.querySelector('path[fill="#9ca3af"]')).not.toBeNull(); // no_photos
    expect(container.querySelector('path[fill="#0d9488"]')).not.toBeNull(); // fields_filled
    expect(container.querySelector('path[fill="#0284c7"]')).not.toBeNull(); // manually
    expect(container.querySelector('path[fill="#7c3aed"]')).not.toBeNull(); // category_filter
    expect(container.querySelector('path[fill="#dc2626"]')).not.toBeNull(); // classification_failed
  });
});
