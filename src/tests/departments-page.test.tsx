import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { DepartmentRanking } from '../hooks/useDepartmentRankings';

// Phase 6 Plan 06-02 Task 3 — integration test for DepartmentsPage composition.
// Contract: .planning/phases/06-department-analysis-sale-comparison/06-UI-SPEC.md
//   § /departments Layout, § Copywriting → /departments page, § Interaction
//   Contract (cross-filter chip appears + clears).
// REQ-IDs covered: DEPT-01 (rankings table), INTR-01 (row highlight + chip).
//
// Strategy: mock useDepartmentRankings at the module boundary so the page
// re-renders synchronously with mock data. DeptRankingMetricToggle,
// DateRangeFilter, and DepartmentRankingsTable are kept real so keyboard /
// click behavior is exercised end-to-end through the page.

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
});
