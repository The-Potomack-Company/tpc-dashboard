import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { DepartmentTable } from '../components/DepartmentTable';
import type { Database } from '../db/database.types';

type SaleDepartment = Database['public']['Tables']['sale_departments']['Row'] & {
  department?: {
    code: string;
    display_name: string | null;
    auto_discovered: boolean;
  } | null;
};

function makeDept(overrides: Partial<SaleDepartment> = {}): SaleDepartment {
  return {
    id: `d-${overrides.department_code ?? 'ASN'}`,
    sale_id: 's-1',
    department_code: 'ASN',
    department_id: 'dept-1',
    department: {
      code: overrides.department_code ?? 'ASN',
      display_name: 'Asian',
      auto_discovered: false,
    },
    lots_auctioned: null,
    lots_sold: null,
    low_estimate: null,
    high_estimate: null,
    reserves: null,
    revenue: null,
    sell_through_pct: null,
    total_sold_value: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('DepartmentTable', () => {
  it('renders exact column headers from UI-SPEC', () => {
    render(<DepartmentTable departments={[]} />);
    const headers = [
      'Department',
      'Lots',
      'Sold',
      'Sell-through',
      'Sold value',
      'Estimate',
      'Reserves',
      'Revenue',
    ];
    const rendered = screen
      .getAllByRole('columnheader')
      .map((h) => h.textContent ?? '');
    for (const h of headers) {
      // Exact header text match — "Sold" and "Sold value" must both appear
      // as distinct columns, so look for a columnheader that starts with the
      // header label rather than a substring regex (which would double-match).
      expect(
        rendered.some((text) => text.trim().startsWith(h)),
      ).toBe(true);
    }
    expect(rendered).toHaveLength(8);
  });

  it('default sort is revenue DESC with aria-sort descending', () => {
    const depts: SaleDepartment[] = [
      makeDept({ department_code: 'A', revenue: 100 }),
      makeDept({ department_code: 'B', revenue: 300 }),
      makeDept({ department_code: 'C', revenue: 200 }),
    ];
    render(<DepartmentTable departments={depts} />);
    const revenueHeader = screen.getByRole('columnheader', {
      name: /Revenue/,
    });
    expect(revenueHeader).toHaveAttribute('aria-sort', 'descending');

    // Read body rows — first cell sibling should reflect sorted order
    const rows = screen.getAllByRole('row');
    // rows[0] is the thead row; rows[last] is the tfoot row
    const bodyRows = rows.slice(1, rows.length - 1);
    const revenuesInOrder = bodyRows.map((r) => {
      const cells = within(r).getAllByRole('cell');
      // Revenue is the 8th (index 7) column
      return cells[7].textContent;
    });
    expect(revenuesInOrder[0]).toContain('300');
    expect(revenuesInOrder[1]).toContain('200');
    expect(revenuesInOrder[2]).toContain('100');
  });

  it('column sort toggles: click Lots → ascending, click again → descending', () => {
    const depts: SaleDepartment[] = [
      makeDept({ department_code: 'A', lots_auctioned: 10, revenue: 1 }),
      makeDept({ department_code: 'B', lots_auctioned: 30, revenue: 2 }),
      makeDept({ department_code: 'C', lots_auctioned: 20, revenue: 3 }),
    ];
    render(<DepartmentTable departments={depts} />);
    const lotsHeader = screen.getByRole('columnheader', { name: /Lots/ });
    const revenueHeader = screen.getByRole('columnheader', {
      name: /Revenue/,
    });

    const lotsButton = within(lotsHeader).getByRole('button');
    fireEvent.click(lotsButton);
    expect(lotsHeader).toHaveAttribute('aria-sort', 'ascending');
    expect(revenueHeader).toHaveAttribute('aria-sort', 'none');

    fireEvent.click(lotsButton);
    expect(lotsHeader).toHaveAttribute('aria-sort', 'descending');
  });

  it('footer row renders <tfoot> with Totals label and summed lots/sold', () => {
    const depts: SaleDepartment[] = [
      makeDept({ department_code: 'A', lots_auctioned: 10, lots_sold: 5 }),
      makeDept({ department_code: 'B', lots_auctioned: 20, lots_sold: 15 }),
      makeDept({ department_code: 'C', lots_auctioned: 30, lots_sold: 25 }),
    ];
    const { container } = render(<DepartmentTable departments={depts} />);
    const tfoot = container.querySelector('tfoot');
    expect(tfoot).toBeTruthy();
    expect(tfoot?.textContent).toContain('Totals');
    // lots total
    expect(tfoot?.textContent).toContain('60');
    // sold total
    expect(tfoot?.textContent).toContain('45');
  });

  it('footer totals use the full departments array, independent of sort order', () => {
    const depts: SaleDepartment[] = [
      makeDept({
        department_code: 'A',
        lots_auctioned: 10,
        total_sold_value: 100,
        revenue: 50,
      }),
      makeDept({
        department_code: 'B',
        lots_auctioned: 20,
        total_sold_value: 200,
        revenue: 150,
      }),
    ];
    const { container } = render(<DepartmentTable departments={depts} />);

    // Change sort; totals should not change.
    const lotsHeader = screen.getByRole('columnheader', { name: /Lots/ });
    fireEvent.click(within(lotsHeader).getByRole('button'));

    const tfoot = container.querySelector('tfoot');
    // lots total 10+20 = 30
    expect(tfoot?.textContent).toContain('30');
    // sold value total $100+$200 = $300.00
    expect(tfoot?.textContent).toContain('$300.00');
    // revenue total $50+$150 = $200.00
    expect(tfoot?.textContent).toContain('$200.00');
  });

  it('renders department code (font-mono) + display_name in Department cell', () => {
    const depts: SaleDepartment[] = [
      makeDept({
        department_code: 'ASN',
        department: {
          code: 'ASN',
          display_name: 'Asian',
          auto_discovered: false,
        },
      }),
    ];
    const { container } = render(<DepartmentTable departments={depts} />);
    // First body cell contains both code and display name
    const rows = screen.getAllByRole('row');
    const bodyRow = rows[1];
    const deptCell = within(bodyRow).getAllByRole('cell')[0];
    expect(deptCell.textContent).toContain('ASN');
    expect(deptCell.textContent).toContain('Asian');
    // font-mono applied to code badge somewhere in the cell
    expect(container.querySelector('.font-mono')).toBeTruthy();
  });

  it('divides sell_through_pct by 100 before formatting (68.4 → 68.4%)', () => {
    const depts: SaleDepartment[] = [
      makeDept({ department_code: 'ASN', sell_through_pct: 68.4 }),
    ];
    render(<DepartmentTable departments={depts} />);
    expect(screen.getByText('68.4%')).toBeInTheDocument();
  });

  it('renders EMPTY placeholders for rows with every numeric field null', () => {
    const depts: SaleDepartment[] = [
      makeDept({ department_code: 'ASN' }), // all nulls by default
    ];
    render(<DepartmentTable departments={depts} />);
    const rows = screen.getAllByRole('row');
    const bodyRow = rows[1];
    const cells = within(bodyRow).getAllByRole('cell');
    // columns 1-7 are numeric (Department is col 0) — all should render em-dash
    for (let i = 1; i < 8; i++) {
      expect(cells[i].textContent).toContain('—');
    }
  });

  it('rows are read-only — no tabIndex, no onClick, no cursor-pointer', () => {
    const depts: SaleDepartment[] = [
      makeDept({ department_code: 'ASN', revenue: 100 }),
      makeDept({ department_code: 'PNT', revenue: 200 }),
    ];
    const { container } = render(<DepartmentTable departments={depts} />);
    const bodyRows = container.querySelectorAll('tbody tr');
    for (const row of bodyRows) {
      expect(row.getAttribute('tabindex')).toBeNull();
      expect(row.getAttribute('onclick')).toBeNull();
      const classes = row.className ?? '';
      expect(classes).not.toMatch(/cursor-pointer/);
    }
  });

  it('estimate column renders the low–high range', () => {
    const depts: SaleDepartment[] = [
      makeDept({
        department_code: 'ASN',
        low_estimate: 5000,
        high_estimate: 8000,
      }),
    ];
    render(<DepartmentTable departments={depts} />);
    expect(screen.getByText('$5,000.00 – $8,000.00')).toBeInTheDocument();
  });
});
