import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DepartmentRankingsTable } from './DepartmentRankingsTable';
import type { DepartmentRanking } from '../hooks/useDepartmentRankings';

// Phase 6 Plan 06-02 — DepartmentRankingsTable contract locked by
// 06-UI-SPEC.md § DepartmentRankingsTable, § Copywriting → /departments page,
// § Interaction Contract (row click toggles cross-filter), and
// 06-RESEARCH.md Pitfall 7 (null display_name fallback).

function makeRow(overrides: Partial<DepartmentRanking> = {}): DepartmentRanking {
  return {
    department_code: 'ASN',
    display_name: 'Asian Art',
    sales_count: 5,
    total_revenue: 100_000,
    avg_sell_through: 0.68,
    lots_above_estimate: 12,
    ...overrides,
  };
}

const DEFAULT_ROWS: DepartmentRanking[] = [
  makeRow({
    department_code: 'ASN',
    display_name: 'Asian Art',
    sales_count: 5,
    total_revenue: 500_000,
    avg_sell_through: 0.72,
    lots_above_estimate: 22,
  }),
  makeRow({
    department_code: 'FRN',
    display_name: 'Furniture',
    sales_count: 7,
    total_revenue: 300_000,
    avg_sell_through: 0.55,
    lots_above_estimate: 10,
  }),
  makeRow({
    department_code: 'PNT',
    display_name: 'Paintings',
    sales_count: 4,
    total_revenue: 120_000,
    avg_sell_through: 0.61,
    lots_above_estimate: 5,
  }),
];

describe('DepartmentRankingsTable — state branches', () => {
  it('T1: renders skeleton when isPending && rows.length === 0', () => {
    const { container } = render(
      <DepartmentRankingsTable
        rows={[]}
        metric="revenue"
        selectedDept={null}
        onToggleSelection={() => {}}
        isPending={true}
        isError={false}
      />,
    );
    // Skeleton uses motion-safe:animate-pulse on each shimmer bar.
    const pulses = container.querySelectorAll(
      '.motion-safe\\:animate-pulse',
    );
    expect(pulses.length).toBeGreaterThan(0);
  });

  it('T2: renders ErrorState + Retry fires onRetry when isError', () => {
    const onRetry = vi.fn();
    render(
      <DepartmentRankingsTable
        rows={[]}
        metric="revenue"
        selectedDept={null}
        onToggleSelection={() => {}}
        isPending={false}
        isError={true}
        onRetry={onRetry}
      />,
    );
    // ErrorState renders <h2 role="alert"> — the default heading role is
    // suppressed when role="alert" is applied explicitly. Query by alert role.
    expect(screen.getByRole('alert').textContent).toMatch(
      /Couldn't load departments/i,
    );
    fireEvent.click(screen.getByRole('button', { name: /^Retry$/ }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('T3: renders empty state when rows.length === 0 && !isPending && !isError', () => {
    render(
      <DepartmentRankingsTable
        rows={[]}
        metric="revenue"
        selectedDept={null}
        onToggleSelection={() => {}}
        isPending={false}
        isError={false}
      />,
    );
    expect(
      screen.getByRole('heading', {
        name: /No department data in this range/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Try expanding the date filter/i),
    ).toBeInTheDocument();
  });
});

describe('DepartmentRankingsTable — rendering', () => {
  it('T4: renders column headers in UI-SPEC order', () => {
    render(
      <DepartmentRankingsTable
        rows={DEFAULT_ROWS}
        metric="revenue"
        selectedDept={null}
        onToggleSelection={() => {}}
        isPending={false}
        isError={false}
      />,
    );
    expect(
      screen.getByRole('columnheader', { name: /Department/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: /^Sales/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: /Total revenue/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: /Avg sell-through/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: /Above estimate/ }),
    ).toBeInTheDocument();
  });

  it('T5: default sort with metric="revenue" puts highest total_revenue first', () => {
    render(
      <DepartmentRankingsTable
        rows={DEFAULT_ROWS}
        metric="revenue"
        selectedDept={null}
        onToggleSelection={() => {}}
        isPending={false}
        isError={false}
      />,
    );
    // WR-01: Data rows use native <tr> semantics (role="row"), not role="button".
    // Filter out the header row via name match against dept codes.
    const rows = screen.getAllByRole('row', {
      name: /^(ASN|FRN|PNT)/,
    });
    // Highest total_revenue is ASN (500k), then FRN (300k), then PNT (120k).
    expect(rows[0].textContent).toMatch(/ASN/);
    expect(rows[1].textContent).toMatch(/FRN/);
    expect(rows[2].textContent).toMatch(/PNT/);
  });

  it('T6: click total_revenue header toggles ASC then DESC', async () => {
    render(
      <DepartmentRankingsTable
        rows={DEFAULT_ROWS}
        metric="revenue"
        selectedDept={null}
        onToggleSelection={() => {}}
        isPending={false}
        isError={false}
      />,
    );
    const user = userEvent.setup();
    const header = screen.getByRole('columnheader', {
      name: /Total revenue/,
    });
    const headerButton = within(header).getByRole('button');

    // Default is DESC (revenue metric). First click flips to ASC.
    await user.click(headerButton);
    let rows = screen.getAllByRole('row', { name: /^(ASN|FRN|PNT)/ });
    expect(rows[0].textContent).toMatch(/PNT/); // smallest revenue first

    // Second click flips back to DESC.
    await user.click(headerButton);
    rows = screen.getAllByRole('row', { name: /^(ASN|FRN|PNT)/ });
    expect(rows[0].textContent).toMatch(/ASN/);
  });
});

describe('DepartmentRankingsTable — filter', () => {
  it('T7: filter narrows rows and shows match count', async () => {
    const user = userEvent.setup();
    render(
      <DepartmentRankingsTable
        rows={DEFAULT_ROWS}
        metric="revenue"
        selectedDept={null}
        onToggleSelection={() => {}}
        isPending={false}
        isError={false}
      />,
    );
    const input = screen.getByRole('searchbox', {
      name: /Filter departments by code or name/i,
    });
    await user.type(input, 'ASN');

    // Only ASN row remains.
    expect(
      screen.queryAllByRole('row', { name: /^FRN/ }).length,
    ).toBe(0);
    expect(
      screen.queryAllByRole('row', { name: /^PNT/ }).length,
    ).toBe(0);
    expect(
      screen.queryAllByRole('row', { name: /^ASN/ }).length,
    ).toBe(1);

    // Match count pattern: "{shown} of {total} departments"
    expect(screen.getByText(/1 of 3 departments/i)).toBeInTheDocument();
  });

  it('filter that matches nothing shows "No matches" empty state', async () => {
    const user = userEvent.setup();
    render(
      <DepartmentRankingsTable
        rows={DEFAULT_ROWS}
        metric="revenue"
        selectedDept={null}
        onToggleSelection={() => {}}
        isPending={false}
        isError={false}
      />,
    );
    const input = screen.getByRole('searchbox', {
      name: /Filter departments by code or name/i,
    });
    await user.type(input, 'ZZZNOMATCH');

    expect(
      screen.getByRole('heading', { name: /No matches/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Try a different search term/i),
    ).toBeInTheDocument();
  });
});

describe('DepartmentRankingsTable — selection', () => {
  it('T8: row click fires onToggleSelection with department_code', () => {
    const onToggleSelection = vi.fn();
    render(
      <DepartmentRankingsTable
        rows={DEFAULT_ROWS}
        metric="revenue"
        selectedDept={null}
        onToggleSelection={onToggleSelection}
        isPending={false}
        isError={false}
      />,
    );
    const asnRow = screen.getAllByRole('row', { name: /^ASN/ })[0];
    fireEvent.click(asnRow);
    expect(onToggleSelection).toHaveBeenCalledWith('ASN');
  });

  it('T9: selectedDept="ASN" highlights the ASN row with bg-accent/5 + border-l-2', () => {
    render(
      <DepartmentRankingsTable
        rows={DEFAULT_ROWS}
        metric="revenue"
        selectedDept="ASN"
        onToggleSelection={() => {}}
        isPending={false}
        isError={false}
      />,
    );
    const asnRow = screen.getAllByRole('row', { name: /^ASN/ })[0];
    expect(asnRow.className).toContain('bg-accent/5');
    expect(asnRow.className).toContain('border-l-2');
    expect(asnRow.className).toContain('border-accent');
    // WR-01: row semantics preserved — aria-selected reflects selection state.
    expect(asnRow.getAttribute('aria-selected')).toBe('true');

    const frnRow = screen.getAllByRole('row', { name: /^FRN/ })[0];
    expect(frnRow.className).not.toContain('bg-accent/5');
    expect(frnRow.getAttribute('aria-selected')).toBe('false');
  });

  it('T10: Enter on a focused row fires onToggleSelection', () => {
    const onToggleSelection = vi.fn();
    render(
      <DepartmentRankingsTable
        rows={DEFAULT_ROWS}
        metric="revenue"
        selectedDept={null}
        onToggleSelection={onToggleSelection}
        isPending={false}
        isError={false}
      />,
    );
    const frnRow = screen.getAllByRole('row', { name: /^FRN/ })[0];
    fireEvent.keyDown(frnRow, { key: 'Enter' });
    expect(onToggleSelection).toHaveBeenCalledWith('FRN');
  });

  it('Space on a focused row fires onToggleSelection', () => {
    const onToggleSelection = vi.fn();
    render(
      <DepartmentRankingsTable
        rows={DEFAULT_ROWS}
        metric="revenue"
        selectedDept={null}
        onToggleSelection={onToggleSelection}
        isPending={false}
        isError={false}
      />,
    );
    const pntRow = screen.getAllByRole('row', { name: /^PNT/ })[0];
    fireEvent.keyDown(pntRow, { key: ' ' });
    expect(onToggleSelection).toHaveBeenCalledWith('PNT');
  });
});

describe('DepartmentRankingsTable — edge cases', () => {
  it('T11: null display_name falls back to department_code (no "null" text)', () => {
    const rows: DepartmentRanking[] = [
      makeRow({
        department_code: 'XYZ',
        display_name: null,
        total_revenue: 200,
      }),
    ];
    const { container } = render(
      <DepartmentRankingsTable
        rows={rows}
        metric="revenue"
        selectedDept={null}
        onToggleSelection={() => {}}
        isPending={false}
        isError={false}
      />,
    );
    // Row must render and mention XYZ; it must NOT contain the literal "null".
    const row = screen.getByRole('row', { name: /^XYZ/ });
    expect(row.textContent).toContain('XYZ');
    expect(row.textContent).not.toMatch(/\bnull\b/);
    // Sanity — no "null" string leaks anywhere in the table container.
    expect(container.textContent).not.toMatch(/\bnull\b/);
  });

  it('null avg_sell_through renders em-dash and sorts last', async () => {
    const user = userEvent.setup();
    const rows: DepartmentRanking[] = [
      makeRow({ department_code: 'ADEP', avg_sell_through: 0.5 }),
      makeRow({ department_code: 'BDEP', avg_sell_through: null }),
      makeRow({ department_code: 'CDEP', avg_sell_through: 0.9 }),
    ];
    render(
      <DepartmentRankingsTable
        rows={rows}
        metric="sell_through"
        selectedDept={null}
        onToggleSelection={() => {}}
        isPending={false}
        isError={false}
      />,
    );
    // Em-dash is in the cell for BDEP.
    const bRow = screen.getByRole('row', { name: /^BDEP/ });
    expect(bRow.textContent).toContain('—');

    // Default sort sell_through DESC puts CDEP first, ADEP second, BDEP (null) last.
    let rowEls = screen.getAllByRole('row', {
      name: /^(ADEP|BDEP|CDEP)/,
    });
    expect(rowEls[0].textContent).toMatch(/^CDEP/);
    expect(rowEls[1].textContent).toMatch(/^ADEP/);
    expect(rowEls[2].textContent).toMatch(/^BDEP/);

    // After toggling to ASC, BDEP (null) still sorts last.
    const header = screen.getByRole('columnheader', {
      name: /Avg sell-through/,
    });
    const headerButton = within(header).getByRole('button');
    await user.click(headerButton);
    rowEls = screen.getAllByRole('row', {
      name: /^(ADEP|BDEP|CDEP)/,
    });
    expect(rowEls[rowEls.length - 1].textContent).toMatch(/^BDEP/);
  });

  it('changing metric prop resets default sort to that metric DESC', () => {
    const { rerender } = render(
      <DepartmentRankingsTable
        rows={DEFAULT_ROWS}
        metric="revenue"
        selectedDept={null}
        onToggleSelection={() => {}}
        isPending={false}
        isError={false}
      />,
    );
    // Revenue-sorted: ASN first (500k).
    let rows = screen.getAllByRole('row', { name: /^(ASN|FRN|PNT)/ });
    expect(rows[0].textContent).toMatch(/^ASN/);

    rerender(
      <DepartmentRankingsTable
        rows={DEFAULT_ROWS}
        metric="lots_above_estimate"
        selectedDept={null}
        onToggleSelection={() => {}}
        isPending={false}
        isError={false}
      />,
    );
    // lots_above_estimate DESC: ASN (22) > FRN (10) > PNT (5) — ASN still first.
    rows = screen.getAllByRole('row', { name: /^(ASN|FRN|PNT)/ });
    expect(rows[0].textContent).toMatch(/^ASN/);

    rerender(
      <DepartmentRankingsTable
        rows={[
          makeRow({
            department_code: 'ADEP',
            total_revenue: 999,
            lots_above_estimate: 1,
          }),
          makeRow({
            department_code: 'BDEP',
            total_revenue: 1,
            lots_above_estimate: 999,
          }),
        ]}
        metric="lots_above_estimate"
        selectedDept={null}
        onToggleSelection={() => {}}
        isPending={false}
        isError={false}
      />,
    );
    rows = screen.getAllByRole('row', { name: /^(ADEP|BDEP)/ });
    expect(rows[0].textContent).toMatch(/^BDEP/); // BDEP has 999 lots above estimate
  });
});
