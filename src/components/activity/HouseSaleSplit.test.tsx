import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Phase 3 / APP-12 — HouseSaleSplit tests. No Recharts mock needed (paired-KPI
// layout is plain JSX divs, NOT a chart).

const useHouseSaleSplitMock = vi.fn();
vi.mock('../../hooks/activity/useHouseSaleSplit', () => ({
  useHouseSaleSplit: () => useHouseSaleSplitMock(),
}));

import { HouseSaleSplit } from './HouseSaleSplit';

beforeEach(() => {
  useHouseSaleSplitMock.mockReset();
});

const ROWS = [
  { mode: 'house', n_sessions: 5, n_items: 42 },
  { mode: 'sale', n_sessions: 3, n_items: 28 },
];

describe('<HouseSaleSplit>', () => {
  it('Test 1: renders 2 paired tiles inside a single bordered card; each shows label + sub-line', () => {
    useHouseSaleSplitMock.mockReturnValue({
      data: ROWS,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<HouseSaleSplit />);
    const houseTile = screen.getByTestId('house-sale-tile-house');
    const saleTile = screen.getByTestId('house-sale-tile-sale');
    expect(houseTile).toHaveTextContent('House');
    expect(houseTile).toHaveTextContent('5 sessions · 42 items');
    expect(saleTile).toHaveTextContent('Sale');
    expect(saleTile).toHaveTextContent('3 sessions · 28 items');
  });

  it('Test 2: house tile uses border-l-indigo-600; sale tile uses border-l-teal-600', () => {
    useHouseSaleSplitMock.mockReturnValue({
      data: ROWS,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<HouseSaleSplit />);
    expect(screen.getByTestId('house-sale-tile-house').className).toMatch(
      /border-l-4/,
    );
    expect(screen.getByTestId('house-sale-tile-house').className).toMatch(
      /border-l-indigo-600/,
    );
    expect(screen.getByTestId('house-sale-tile-sale').className).toMatch(
      /border-l-4/,
    );
    expect(screen.getByTestId('house-sale-tile-sale').className).toMatch(
      /border-l-teal-600/,
    );
  });

  it('Test 3: card heading "House vs sale"; subheading "Selected range"', () => {
    useHouseSaleSplitMock.mockReturnValue({
      data: ROWS,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<HouseSaleSplit />);
    expect(screen.getByRole('heading', { name: 'House vs sale' })).toBeInTheDocument();
    expect(screen.getByText('Selected range')).toBeInTheDocument();
  });

  it('Test 4: when both modes have zero sessions, renders EmptyState replacing the tiles', () => {
    useHouseSaleSplitMock.mockReturnValue({
      data: [
        { mode: 'house', n_sessions: 0, n_items: 0 },
        { mode: 'sale', n_sessions: 0, n_items: 0 },
      ],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<HouseSaleSplit />);
    expect(screen.getByText('No sessions in this range')).toBeInTheDocument();
    expect(screen.getByText('Try widening the date range.')).toBeInTheDocument();
    expect(screen.queryByTestId('house-sale-tile-house')).toBeNull();
    expect(screen.queryByTestId('house-sale-tile-sale')).toBeNull();
  });

  it('Test 5: loading renders 2 skeleton placeholders inside the bordered card', () => {
    useHouseSaleSplitMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });
    render(<HouseSaleSplit />);
    expect(screen.getByTestId('house-sale-skeleton-house')).toBeInTheDocument();
    expect(screen.getByTestId('house-sale-skeleton-sale')).toBeInTheDocument();
    // Tiles should NOT render in loading state
    expect(screen.queryByTestId('house-sale-tile-house')).toBeNull();
  });

  it('Test 6: error renders locked ErrorState; Retry calls refetch', async () => {
    const refetch = vi.fn();
    useHouseSaleSplitMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('boom'),
      refetch,
    });
    render(<HouseSaleSplit />);
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load house vs sale");
    expect(screen.getByText('Retry below.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Retry/i }));
    expect(refetch).toHaveBeenCalled();
  });

  it('Test 7: HouseSaleSplit consumes useHouseSaleSplit (range-driven via the hook)', () => {
    useHouseSaleSplitMock.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<HouseSaleSplit />);
    expect(useHouseSaleSplitMock).toHaveBeenCalled();
  });
});
