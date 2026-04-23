import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { DepartmentRanking } from '../hooks/useDepartmentRankings';

// Phase 6 Plan 06-02 Task 3 (T1-T9) + 06-03 Task 4 (T10-T14) —
// integration test for DepartmentsPage composition.
// Contract: .planning/phases/06-department-analysis-sale-comparison/06-UI-SPEC.md
//   § /departments Layout, § Copywriting → /departments page, § Interaction
//   Contract (cross-filter chip appears + clears; chip click; 9th chip click).
// REQ-IDs covered: DEPT-01 (rankings table), DEPT-02 (chip bar + line chart),
//   DEPT-03 (stacked bar chart mounted), INTR-01 (row highlight + chip +
//   chart highlightedDept propagation end-to-end).
//
// Strategy: mock useDepartmentRankings at the module boundary so the page
// re-renders synchronously with mock data. The chart components are mocked
// with test doubles that echo their props into the DOM via data-* attributes
// so T10/T12 can assert prop propagation at page-composition level without
// booting Recharts. DepartmentChipBar is kept real so click / max-8 flow is
// exercised end-to-end.

// Mock must be declared before the component import so vi.mock hoists it.
vi.mock('../hooks/useDepartmentRankings', async () => {
  const actual = await vi.importActual<
    typeof import('../hooks/useDepartmentRankings')
  >('../hooks/useDepartmentRankings');
  return {
    ...actual,
    useDepartmentRankings: vi.fn(),
  };
});

// Chart-component test doubles: echo critical props to the DOM so page-level
// prop propagation is assertable without booting Recharts. `vi.hoisted`
// keeps the doubles referenceable inside the module factories (vi.mock
// factories must be fully self-contained — outer closures aren't available
// when the factory runs).
vi.mock('../components/DepartmentRevenueLineChart', () => ({
  DepartmentRevenueLineChart: (props: {
    selectedDeptCodes: readonly string[];
    highlightedDept: string | null;
  }) => (
    <div
      data-testid="mock-revenue-line-chart"
      data-selected={props.selectedDeptCodes.join(',')}
      data-highlighted={props.highlightedDept ?? ''}
    />
  ),
}));

vi.mock('../components/DepartmentShareStackedBarChart', () => ({
  DepartmentShareStackedBarChart: (props: {
    highlightedDept: string | null;
    topN?: number;
  }) => (
    <div
      data-testid="mock-share-stacked-chart"
      data-highlighted={props.highlightedDept ?? ''}
      data-topn={String(props.topN ?? '')}
    />
  ),
}));

import { useDepartmentRankings } from '../hooks/useDepartmentRankings';
import { DepartmentsPage } from '../pages/Departments';

const mockUseDepartmentRankings = vi.mocked(useDepartmentRankings);

function makeRow(
  overrides: Partial<DepartmentRanking> = {},
): DepartmentRanking {
  return {
    department_code: 'ASN',
    display_name: 'Asian Art',
    sales_count: 5,
    total_revenue: 500_000,
    avg_sell_through: 0.7,
    lots_above_estimate: 22,
    ...overrides,
  };
}

const ROWS: DepartmentRanking[] = [
  makeRow({
    department_code: 'ASN',
    display_name: 'Asian Art',
    total_revenue: 500_000,
    lots_above_estimate: 22,
  }),
  makeRow({
    department_code: 'FRN',
    display_name: 'Furniture',
    total_revenue: 300_000,
    lots_above_estimate: 10,
  }),
  makeRow({
    department_code: 'PNT',
    display_name: 'Paintings',
    total_revenue: 120_000,
    lots_above_estimate: 5,
  }),
];

function setMockResult(
  partial: Partial<ReturnType<typeof useDepartmentRankings>>,
) {
  // Minimal TanStack Query return surface — the page only reads data /
  // isPending / isError / refetch, so the rest can be any-shaped stubs.
  mockUseDepartmentRankings.mockReturnValue({
    data: [],
    isPending: false,
    isError: false,
    refetch: vi.fn(),
    ...partial,
  } as unknown as ReturnType<typeof useDepartmentRankings>);
}

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/departments']}>
        <DepartmentsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockUseDepartmentRankings.mockReset();
  setMockResult({ data: ROWS });
});

describe('Departments page (integration)', () => {
  it('T1: renders heading "Departments" + DateRangeFilter + DeptRankingMetricToggle', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Departments' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('group', { name: 'Select date range' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('radiogroup', { name: 'Select ranking metric' }),
    ).toBeInTheDocument();
  });

  it('T2: when isPending+empty → TableSkeleton renders in the table section', () => {
    setMockResult({ data: [], isPending: true });
    const { container } = renderPage();
    const pulses = container.querySelectorAll(
      '.motion-safe\\:animate-pulse',
    );
    expect(pulses.length).toBeGreaterThan(0);
  });

  it('T3: when hook returns rows → the rankings table renders them', () => {
    renderPage();
    // Each row renders as a role="button" element containing the dept code.
    expect(
      screen.getByRole('button', { name: /^ASN/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^FRN/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^PNT/ }),
    ).toBeInTheDocument();
  });

  it('T4: default metric is Revenue (aria-checked=true)', () => {
    renderPage();
    const revenue = screen.getByRole('radio', { name: 'Revenue' });
    expect(revenue.getAttribute('aria-checked')).toBe('true');
  });

  it('T5: switching metric re-sorts the table default column', async () => {
    const user = userEvent.setup();
    // Construct rows where revenue-order and lots-order disagree so the
    // test actually observes a re-sort.
    setMockResult({
      data: [
        makeRow({
          department_code: 'ASN',
          total_revenue: 999,
          lots_above_estimate: 1,
        }),
        makeRow({
          department_code: 'FRN',
          total_revenue: 1,
          lots_above_estimate: 999,
        }),
      ],
    });
    renderPage();

    // Revenue DESC → ASN first.
    let rows = screen.getAllByRole('button', { name: /^(ASN|FRN)/ });
    expect(rows[0].textContent).toMatch(/^ASN/);

    await user.click(
      screen.getByRole('radio', { name: 'Lots above estimate' }),
    );
    rows = screen.getAllByRole('button', { name: /^(ASN|FRN)/ });
    expect(rows[0].textContent).toMatch(/^FRN/);
  });

  it('T6: clicking a row toggles selectedDept; chip appears then clears on re-click', async () => {
    const user = userEvent.setup();
    renderPage();

    // No chip initially.
    expect(
      screen.queryByText(/Filtering: ASN/i),
    ).not.toBeInTheDocument();

    const asnRow = screen.getByRole('button', { name: /^ASN/ });
    await user.click(asnRow);
    expect(screen.getByText(/Filtering: ASN/i)).toBeInTheDocument();

    // Click same row again → chip disappears.
    await user.click(screen.getByRole('button', { name: /^ASN/ }));
    expect(
      screen.queryByText(/Filtering: ASN/i),
    ).not.toBeInTheDocument();
  });

  it('T7: clicking the chip × close button clears selectedDept', async () => {
    const user = userEvent.setup();
    renderPage();

    const asnRow = screen.getByRole('button', { name: /^ASN/ });
    await user.click(asnRow);
    expect(screen.getByText(/Filtering: ASN/i)).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: 'Clear department filter' }),
    );
    expect(
      screen.queryByText(/Filtering: ASN/i),
    ).not.toBeInTheDocument();
  });

  it('sets document.title to "Departments — TPC Dashboard" on mount', () => {
    renderPage();
    expect(document.title).toBe('Departments — TPC Dashboard');
  });

  it('calls useDepartmentRankings with a Range carrying the L12M preset', () => {
    renderPage();
    expect(mockUseDepartmentRankings).toHaveBeenCalled();
    const firstCall = mockUseDepartmentRankings.mock.calls[0];
    const arg = firstCall[0];
    expect(arg.preset).toBe('l12m');
    expect(typeof arg.start).toBe('string');
    expect(typeof arg.end).toBe('string');
  });

  // ──────────────────────────────────────────────────────────────────────
  // 06-03 Task 4 — chart composition + end-to-end INTR-01 cross-filter.
  // ──────────────────────────────────────────────────────────────────────

  it('T10: renders both ChartCards with exact titles "Department revenue over time" AND "Department share of sale"', () => {
    renderPage();
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: 'Department revenue over time',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: 'Department share of sale',
      }),
    ).toBeInTheDocument();
    // Both mocked chart bodies mount inside their cards.
    expect(screen.getByTestId('mock-revenue-line-chart')).toBeInTheDocument();
    expect(screen.getByTestId('mock-share-stacked-chart')).toBeInTheDocument();
  });

  it('T11: when rankings returns 6 depts, chip bar renders 6 chips with the top-5 aria-checked=true', () => {
    setMockResult({
      data: [
        makeRow({ department_code: 'ASN', total_revenue: 900 }),
        makeRow({ department_code: 'FRN', total_revenue: 800 }),
        makeRow({ department_code: 'PNT', total_revenue: 700 }),
        makeRow({ department_code: 'CER', total_revenue: 600 }),
        makeRow({ department_code: 'SIL', total_revenue: 500 }),
        makeRow({ department_code: 'DRW', total_revenue: 400 }),
      ],
    });
    renderPage();

    // Chip bar group + 6 switch buttons.
    const group = screen.getByRole('group', {
      name: 'Department series selection',
    });
    expect(group).toBeInTheDocument();
    const chips = screen.getAllByRole('switch');
    expect(chips).toHaveLength(6);

    // Top-5 by revenue-DESC order: ASN, FRN, PNT, CER, SIL — active.
    // DRW — inactive (6th, not in default top-5).
    const active = ['ASN', 'FRN', 'PNT', 'CER', 'SIL'];
    for (const code of active) {
      const chip = screen.getByRole('switch', {
        name: new RegExp(`^${code}`),
      });
      expect(chip.getAttribute('aria-checked')).toBe('true');
    }
    expect(
      screen
        .getByRole('switch', { name: /^DRW/ })
        .getAttribute('aria-checked'),
    ).toBe('false');
  });

  it('T12: clicking an inactive chip adds it to selectedDeptCodes passed to the line chart', async () => {
    const user = userEvent.setup();
    setMockResult({
      data: [
        makeRow({ department_code: 'ASN', total_revenue: 900 }),
        makeRow({ department_code: 'FRN', total_revenue: 800 }),
        makeRow({ department_code: 'PNT', total_revenue: 700 }),
        makeRow({ department_code: 'CER', total_revenue: 600 }),
        makeRow({ department_code: 'SIL', total_revenue: 500 }),
        makeRow({ department_code: 'DRW', total_revenue: 400 }),
      ],
    });
    renderPage();

    // Initially, DRW is not in the top-5 default → not in data-selected.
    const chartBefore = screen.getByTestId('mock-revenue-line-chart');
    expect(chartBefore.getAttribute('data-selected')).not.toMatch(/\bDRW\b/);

    // Click DRW chip → toggles it in; chart receives updated prop.
    await user.click(screen.getByRole('switch', { name: /^DRW/ }));
    const chartAfter = screen.getByTestId('mock-revenue-line-chart');
    expect(chartAfter.getAttribute('data-selected')).toMatch(/\bDRW\b/);
  });

  it('T13: max-8 flow — 9th chip click surfaces the status-line with exact copy', async () => {
    const user = userEvent.setup();
    // Nine depts in rankings. The page defaults chipSelectedDepts to top-5;
    // we select 3 more manually to reach 8, then click the 9th.
    setMockResult({
      data: [
        makeRow({ department_code: 'D1', total_revenue: 900 }),
        makeRow({ department_code: 'D2', total_revenue: 800 }),
        makeRow({ department_code: 'D3', total_revenue: 700 }),
        makeRow({ department_code: 'D4', total_revenue: 600 }),
        makeRow({ department_code: 'D5', total_revenue: 500 }),
        makeRow({ department_code: 'D6', total_revenue: 400 }),
        makeRow({ department_code: 'D7', total_revenue: 300 }),
        makeRow({ department_code: 'D8', total_revenue: 200 }),
        makeRow({ department_code: 'D9', total_revenue: 100 }),
      ],
    });
    renderPage();

    // Default is top-5 (D1-D5). Click D6, D7, D8 to reach 8 total.
    for (const code of ['D6', 'D7', 'D8']) {
      await user.click(screen.getByRole('switch', { name: new RegExp(`^${code}`) }));
    }

    // No status-line yet.
    expect(
      screen.queryByText('Max 8 departments — deselect one first'),
    ).not.toBeInTheDocument();

    // 9th click fires onMaxExceeded → page sets maxNotice.
    await user.click(screen.getByRole('switch', { name: /^D9/ }));
    expect(
      screen.getByText('Max 8 departments — deselect one first'),
    ).toBeInTheDocument();
  });

  it('T14: cross-filter end-to-end — row click propagates highlightedDept to both charts; re-click clears', async () => {
    const user = userEvent.setup();
    renderPage();

    // Baseline: no highlight.
    expect(
      screen.getByTestId('mock-revenue-line-chart').getAttribute('data-highlighted'),
    ).toBe('');
    expect(
      screen.getByTestId('mock-share-stacked-chart').getAttribute('data-highlighted'),
    ).toBe('');

    // Click ASN row → selectedDept=ASN → both charts receive highlightedDept=ASN.
    await user.click(screen.getByRole('button', { name: /^ASN/ }));
    expect(
      screen.getByTestId('mock-revenue-line-chart').getAttribute('data-highlighted'),
    ).toBe('ASN');
    expect(
      screen.getByTestId('mock-share-stacked-chart').getAttribute('data-highlighted'),
    ).toBe('ASN');

    // Click same row again → clears to null → both charts see empty.
    await user.click(screen.getByRole('button', { name: /^ASN/ }));
    expect(
      screen.getByTestId('mock-revenue-line-chart').getAttribute('data-highlighted'),
    ).toBe('');
    expect(
      screen.getByTestId('mock-share-stacked-chart').getAttribute('data-highlighted'),
    ).toBe('');
  });
});
