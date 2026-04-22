// Phase 5 Plan 05-06 Task 2 — DepartmentHeatMap (TRND-04) contract locked by
// .planning/phases/05-trend-analysis/05-UI-SPEC.md § TRND-04 layout
// (lines 651-737), § Tooltip format strings — TRND-04 row (line 438), and
// § Empty/Error states — TRND-04 rows (lines 413, 422).
//
// Bucket-class placement is covered in src/lib/heat-map-bucket.test.ts.
// This file asserts the grid structure, ARIA wiring, state transitions, and
// metric-dependent tooltip/title strings.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import type { DeptGridRow } from '../hooks/useDepartmentGrid';
import type { Range } from '../lib/period';

// Hoisted mock so vi.mock can reference it.
const { useDepartmentGridMock } = vi.hoisted(() => ({
  useDepartmentGridMock: vi.fn(),
}));

vi.mock('../hooks/useDepartmentGrid', () => ({
  useDepartmentGrid: useDepartmentGridMock,
}));

// Import AFTER the mock so the component binds to the mocked hook.
import { DepartmentHeatMap } from './DepartmentHeatMap';

const RANGE: Range = { start: '2024-01-01', end: '2024-12-31', preset: 'l12m' };

function makeRow(
  saleNumber: string,
  saleDate: string,
  depts: Array<{
    code: string;
    sell_through_pct?: number | null;
    revenue?: number | null;
    total_sold_value?: number | null;
  }>,
): DeptGridRow {
  return {
    sale_number: saleNumber,
    sale_date: saleDate,
    lots_sold: 100,
    sale_departments: depts.map((d) => ({
      department_code: d.code,
      sell_through_pct: d.sell_through_pct ?? null,
      revenue: d.revenue ?? null,
      total_sold_value: d.total_sold_value ?? null,
      lots_sold: 10,
      low_estimate: 100,
      high_estimate: 1000,
    })),
  };
}

function mockState(over: Partial<Record<string, unknown>> = {}) {
  return {
    data: undefined,
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    isSuccess: false,
    isLoading: false,
    isFetching: false,
    ...over,
  };
}

describe('DepartmentHeatMap — pending', () => {
  it('renders the ChartSkeleton with aria-label="Loading chart"', () => {
    useDepartmentGridMock.mockReturnValue(
      mockState({ isPending: true, isLoading: true }),
    );
    render(<DepartmentHeatMap range={RANGE} metric="sell_through" />);
    expect(screen.getByLabelText('Loading chart')).toBeInTheDocument();
  });
});

describe('DepartmentHeatMap — error', () => {
  it('renders ErrorState with the TRND-04 copy; Retry click calls refetch', () => {
    const refetch = vi.fn();
    useDepartmentGridMock.mockReturnValue(
      mockState({ isError: true, error: new Error('boom'), refetch }),
    );
    render(<DepartmentHeatMap range={RANGE} metric="sell_through" />);

    expect(
      screen.getByText("Couldn't load this chart"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Something went wrong fetching department data for the selected range/,
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Retry/ }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});

describe('DepartmentHeatMap — empty', () => {
  it('renders EmptyState with the TRND-04 copy when data has no date-bearing rows', () => {
    useDepartmentGridMock.mockReturnValue(
      mockState({ data: [], isSuccess: true }),
    );
    render(<DepartmentHeatMap range={RANGE} metric="sell_through" />);

    expect(
      screen.getByRole('heading', {
        name: 'No department data in this range',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Try expanding the date filter/),
    ).toBeInTheDocument();
  });

  it('filters out rows with null sale_date and still shows EmptyState', () => {
    useDepartmentGridMock.mockReturnValue(
      mockState({
        data: [
          {
            sale_number: '2024-999',
            sale_date: null,
            lots_sold: null,
            sale_departments: [
              {
                department_code: 'FRN',
                sell_through_pct: 50,
                revenue: 100,
                total_sold_value: 200,
                lots_sold: 5,
                low_estimate: 10,
                high_estimate: 1000,
              },
            ],
          } as DeptGridRow,
        ],
        isSuccess: true,
      }),
    );
    render(<DepartmentHeatMap range={RANGE} metric="sell_through" />);
    expect(
      screen.getByRole('heading', {
        name: 'No department data in this range',
      }),
    ).toBeInTheDocument();
  });
});

describe('DepartmentHeatMap — success (structure)', () => {
  const dataOneSale: DeptGridRow[] = [
    makeRow('2024-001', '2024-03-01', [
      { code: 'FRN', sell_through_pct: 80, revenue: 500, total_sold_value: 900 },
      { code: 'AMER', sell_through_pct: null, revenue: 200, total_sold_value: 300 },
    ]),
  ];

  it('wraps the grid in role="grid" with the documented aria-label', () => {
    useDepartmentGridMock.mockReturnValue(
      mockState({ data: dataOneSale, isSuccess: true }),
    );
    render(<DepartmentHeatMap range={RANGE} metric="sell_through" />);
    const grid = screen.getByRole('grid', {
      name: 'Department performance heat map',
    });
    expect(grid).toBeInTheDocument();
  });

  it('renders all 22 dept rowheaders in alphabetical order (AMER first, TXTL last)', () => {
    useDepartmentGridMock.mockReturnValue(
      mockState({ data: dataOneSale, isSuccess: true }),
    );
    render(<DepartmentHeatMap range={RANGE} metric="sell_through" />);
    const rowheaders = screen.getAllByRole('rowheader');
    expect(rowheaders).toHaveLength(22);
    expect(rowheaders[0].textContent).toBe('AMER');
    expect(rowheaders[21].textContent).toBe('TXTL');
  });

  it('first-column blank header cell is sticky-left', () => {
    useDepartmentGridMock.mockReturnValue(
      mockState({ data: dataOneSale, isSuccess: true }),
    );
    const { container } = render(
      <DepartmentHeatMap range={RANGE} metric="sell_through" />,
    );
    const grid = container.querySelector('[role="grid"]');
    const firstChild = grid?.firstElementChild as HTMLElement | null;
    expect(firstChild).not.toBeNull();
    expect(firstChild?.className).toContain('sticky');
    expect(firstChild?.className).toContain('left-0');
  });

  it('renders one columnheader per sale — 5 sales → 5 columnheaders', () => {
    const fiveSales: DeptGridRow[] = [
      makeRow('S1', '2024-01-01', [
        { code: 'FRN', sell_through_pct: 10, revenue: 1, total_sold_value: 10 },
      ]),
      makeRow('S2', '2024-02-01', [
        { code: 'FRN', sell_through_pct: 30, revenue: 1, total_sold_value: 10 },
      ]),
      makeRow('S3', '2024-03-01', [
        { code: 'FRN', sell_through_pct: 50, revenue: 1, total_sold_value: 10 },
      ]),
      makeRow('S4', '2024-04-01', [
        { code: 'FRN', sell_through_pct: 70, revenue: 1, total_sold_value: 10 },
      ]),
      makeRow('S5', '2024-05-01', [
        { code: 'FRN', sell_through_pct: 90, revenue: 1, total_sold_value: 10 },
      ]),
    ];
    useDepartmentGridMock.mockReturnValue(
      mockState({ data: fiveSales, isSuccess: true }),
    );
    render(<DepartmentHeatMap range={RANGE} metric="sell_through" />);
    const columnheaders = screen.getAllByRole('columnheader');
    expect(columnheaders).toHaveLength(5);
  });
});

describe('DepartmentHeatMap — cell titles + metric switching', () => {
  const dataOneSale: DeptGridRow[] = [
    makeRow('2024-001', '2024-03-01', [
      { code: 'FRN', sell_through_pct: 80, revenue: 500, total_sold_value: 900 },
      { code: 'AMER', sell_through_pct: null, revenue: 200, total_sold_value: 300 },
    ]),
  ];

  it('sell_through metric: FRN cell title contains "Sell-through: 80.0%"', () => {
    useDepartmentGridMock.mockReturnValue(
      mockState({ data: dataOneSale, isSuccess: true }),
    );
    const { container } = render(
      <DepartmentHeatMap range={RANGE} metric="sell_through" />,
    );
    const cells = Array.from(
      container.querySelectorAll('[role="gridcell"]'),
    ) as HTMLElement[];
    const frnCell = cells.find((c) =>
      c.getAttribute('title')?.startsWith('FRN • 2024-001'),
    );
    expect(frnCell).toBeDefined();
    expect(frnCell?.getAttribute('title')).toBe(
      'FRN • 2024-001 — Sell-through: 80.0%',
    );
  });

  it('revenue_share metric: FRN cell title switches to "Revenue share:"', () => {
    useDepartmentGridMock.mockReturnValue(
      mockState({ data: dataOneSale, isSuccess: true }),
    );
    const { container } = render(
      <DepartmentHeatMap range={RANGE} metric="revenue_share" />,
    );
    const cells = Array.from(
      container.querySelectorAll('[role="gridcell"]'),
    ) as HTMLElement[];
    const frnCell = cells.find((c) =>
      c.getAttribute('title')?.startsWith('FRN • 2024-001'),
    );
    expect(frnCell).toBeDefined();
    // FRN revenue 500, total sale revenue = 500 + 200 = 700 → 0.714... → "71.4%"
    expect(frnCell?.getAttribute('title')).toBe(
      'FRN • 2024-001 — Revenue share: 71.4%',
    );
  });

  it('no-data cell (null sell_through_pct) renders with hatch style + em-dash title', () => {
    useDepartmentGridMock.mockReturnValue(
      mockState({ data: dataOneSale, isSuccess: true }),
    );
    const { container } = render(
      <DepartmentHeatMap range={RANGE} metric="sell_through" />,
    );
    const cells = Array.from(
      container.querySelectorAll('[role="gridcell"]'),
    ) as HTMLElement[];
    const amerCell = cells.find((c) =>
      c.getAttribute('title')?.startsWith('AMER • 2024-001'),
    );
    expect(amerCell).toBeDefined();
    expect(amerCell?.className).toContain('bg-gray-50');
    // Title should end with em-dash (U+2014) per formatPercent null-path.
    expect(amerCell?.getAttribute('title')).toBe(
      'AMER • 2024-001 — Sell-through: —',
    );
    // Inline hatch style applied.
    expect(amerCell?.style.backgroundImage).toContain(
      'repeating-linear-gradient(45deg',
    );
  });
});
