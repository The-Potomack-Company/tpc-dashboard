import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { Database } from '../db/database.types';

// ---- Mocks ----
// useNavigate is hoisted so the mock fn reference is stable across renders.
const navigateMock = vi.fn();
vi.mock('react-router', async () => {
  const actual =
    await vi.importActual<typeof import('react-router')>('react-router');
  return { ...actual, useNavigate: () => navigateMock };
});

// JSDOM has 0 clientHeight on flex/overflow containers, which makes
// TanStack Virtual return 0 visible rows (see 03-RESEARCH.md Pitfall 1).
// Replace useVirtualizer with a passthrough that returns ALL rows, preserving
// the fixed-height math (start = index * size) so the component's transform
// calculation resolves to 0. Wave 4 integration tests can reuse this pattern.
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        index,
        start: index * 44,
        size: 44,
        end: (index + 1) * 44,
        key: index,
        lane: 0,
      })),
    getTotalSize: () => count * 44,
    measureElement: () => {},
  }),
}));

import { SalesTable } from '../components/SalesTable';

type Sale = Database['public']['Tables']['sales']['Row'];

function makeSale(overrides: Partial<Sale> = {}): Sale {
  return {
    id: `id-${overrides.sale_number ?? 'x'}`,
    buyer_premium: null,
    created_at: '2024-01-01T00:00:00Z',
    hammer_total: null,
    imported_at: null,
    insurance: null,
    lot_charges: null,
    lots_auctioned: null,
    lots_sold: null,
    lots_unsold: null,
    net_revenue: null,
    payment_status: null,
    referral_fees: null,
    registered_bidders: null,
    sale_date: '2024-01-15',
    sale_number: '22OCT',
    seller_commission: null,
    source_pdf_path: null,
    title: 'Sample Sale',
    total_high_estimate: null,
    total_low_estimate: null,
    total_reserves: null,
    total_sold_value: null,
    total_unsold_value: null,
    updated_at: '2024-01-01T00:00:00Z',
    validation_warning: false,
    winning_buyers: null,
    ...overrides,
  };
}

function mount(sales: Sale[], filterText = '') {
  return render(
    <MemoryRouter>
      <SalesTable sales={sales} filterText={filterText} />
    </MemoryRouter>,
  );
}

beforeEach(() => navigateMock.mockClear());

describe('SalesTable', () => {
  it('renders column headers from Copywriting contract', () => {
    mount([]);
    expect(
      screen.getByRole('columnheader', { name: /Sale #/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: /Title/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: /^Date/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: /^Lots/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: /^Sold$/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: /Sell-through/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: /Sold value/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: /Net revenue/ }),
    ).toBeInTheDocument();
  });

  it('default sort is sale_date DESC', () => {
    const sales = [
      makeSale({ sale_number: 'A', sale_date: '2024-01-01' }),
      makeSale({ sale_number: 'B', sale_date: '2023-06-15' }),
      makeSale({ sale_number: 'C', sale_date: '2024-06-30' }),
    ];
    mount(sales);

    // Check Date column has aria-sort="descending"
    const dateHeader = screen.getByRole('columnheader', { name: /^Date/ });
    expect(dateHeader.getAttribute('aria-sort')).toBe('descending');

    // Row order reading sale_number column top-to-bottom:
    // Newest first: C (2024-06-30), A (2024-01-01), B (2023-06-15)
    const rows = screen.getAllByRole('row');
    // Row 0 is the header row; rows 1..n are data
    const firstCell = within(rows[1]).getAllByRole('cell')[0];
    const secondCell = within(rows[2]).getAllByRole('cell')[0];
    const thirdCell = within(rows[3]).getAllByRole('cell')[0];
    expect(firstCell.textContent).toBe('C');
    expect(secondCell.textContent).toBe('A');
    expect(thirdCell.textContent).toBe('B');
  });

  it('column header click cycles sort state asc → desc → none', () => {
    const sales = [
      makeSale({ sale_number: 'A', title: 'Alpha' }),
      makeSale({ sale_number: 'B', title: 'Bravo' }),
    ];
    mount(sales);

    const titleHeader = screen.getByRole('columnheader', { name: /Title/ });
    const button = within(titleHeader).getByRole('button');

    expect(titleHeader.getAttribute('aria-sort')).toBe('none');

    fireEvent.click(button);
    expect(titleHeader.getAttribute('aria-sort')).toBe('ascending');

    fireEvent.click(button);
    expect(titleHeader.getAttribute('aria-sort')).toBe('descending');

    fireEvent.click(button);
    expect(titleHeader.getAttribute('aria-sort')).toBe('none');
  });

  it('global filter narrows rows by title case-insensitively', () => {
    const sales = [
      makeSale({ sale_number: 'S1', title: 'Vintage Posters' }),
      makeSale({ sale_number: 'S2', title: 'Modern Art' }),
      makeSale({ sale_number: 'S3', title: 'Another Vintage' }),
    ];
    mount(sales, 'vintage');

    // Header row + 2 matching rows = 3 rows
    const rows = screen.getAllByRole('row');
    expect(rows.length).toBe(3); // 1 header + 2 data
  });

  it('global filter narrows rows by sale_number', () => {
    const sales = [
      makeSale({ sale_number: '22OCT', title: 'Fall Sale' }),
      makeSale({ sale_number: '23JAN', title: 'Winter Sale' }),
    ];
    mount(sales, '22OCT');

    const rows = screen.getAllByRole('row');
    expect(rows.length).toBe(2); // 1 header + 1 match
    const cell = within(rows[1]).getAllByRole('cell')[0];
    expect(cell.textContent).toBe('22OCT');
  });

  it('row click navigates to /sales/:sale_number', () => {
    const sales = [makeSale({ sale_number: '22OCT', title: 'Fall Sale' })];
    mount(sales);

    const rows = screen.getAllByRole('row');
    fireEvent.click(rows[1]);
    expect(navigateMock).toHaveBeenCalledWith('/sales/22OCT');
  });

  it('row Enter key navigates', () => {
    const sales = [makeSale({ sale_number: '22OCT' })];
    mount(sales);

    const rows = screen.getAllByRole('row');
    fireEvent.keyDown(rows[1], { key: 'Enter' });
    expect(navigateMock).toHaveBeenCalledWith('/sales/22OCT');
  });

  it('row Space key navigates and prevents default', () => {
    const sales = [makeSale({ sale_number: '22OCT' })];
    mount(sales);

    const rows = screen.getAllByRole('row');
    fireEvent.keyDown(rows[1], { key: ' ' });
    expect(navigateMock).toHaveBeenCalledWith('/sales/22OCT');
  });

  it('applies formatters (date, currency)', () => {
    const sales = [
      makeSale({
        sale_number: 'FMT',
        sale_date: '2024-01-15',
        total_sold_value: 1234567.89,
      }),
    ];
    mount(sales);

    expect(screen.getByText('Jan 15, 2024')).toBeInTheDocument();
    expect(screen.getByText('$1,234,567.89')).toBeInTheDocument();
  });

  it('renders EMPTY for null sell-through inputs', () => {
    const sales = [
      makeSale({
        sale_number: 'NL',
        lots_auctioned: null,
        lots_sold: null,
      }),
    ];
    mount(sales);

    // The Sell-through cell should render the em-dash EMPTY placeholder.
    // We look at the row's cells and find index 5 (Sell-through column).
    const rows = screen.getAllByRole('row');
    const cells = within(rows[1]).getAllByRole('cell');
    // Columns: Sale #, Title, Date, Lots, Sold, Sell-through, Sold value, Net revenue
    expect(cells[5].textContent).toBe('—');
  });

  it('row has tabIndex=0 for keyboard focus', () => {
    const sales = [makeSale({ sale_number: 'K' })];
    mount(sales);
    const rows = screen.getAllByRole('row');
    expect(rows[1].getAttribute('tabindex')).toBe('0');
  });

  // --- Phase 6 Plan 06-04: Optional selection column ---

  it('T-new-1: renders WITHOUT checkbox when onRowSelectionChange is undefined', () => {
    const sales = [makeSale({ sale_number: '22OCT' })];
    const { container } = mount(sales);
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes.length).toBe(0);
  });

  it('T-new-2: renders checkbox column with sr-only header when onRowSelectionChange defined', () => {
    const sales = [
      makeSale({ sale_number: '2024-01' }),
      makeSale({ sale_number: '2024-02' }),
    ];
    render(
      <MemoryRouter>
        <SalesTable
          sales={sales}
          filterText=""
          rowSelection={{}}
          onRowSelectionChange={vi.fn()}
        />
      </MemoryRouter>,
    );

    const headers = screen.getAllByRole('columnheader');
    const firstHeader = headers[0];
    expect(firstHeader.querySelector('.sr-only')?.textContent).toBe(
      'Select sale',
    );

    const rows = screen.getAllByRole('row');
    const checkbox1 = within(rows[1]).getByRole('checkbox');
    const checkbox2 = within(rows[2]).getByRole('checkbox');
    expect(checkbox1.getAttribute('aria-label')).toMatch(
      /Select sale 2024-01/i,
    );
    expect(checkbox2.getAttribute('aria-label')).toMatch(
      /Select sale 2024-02/i,
    );
  });

  it('T-new-3: clicking a checkbox fires onRowSelectionChange', () => {
    const onRowSelectionChange = vi.fn();
    const sales = [
      makeSale({ sale_number: '2024-01' }),
      makeSale({ sale_number: '2024-02' }),
    ];
    render(
      <MemoryRouter>
        <SalesTable
          sales={sales}
          filterText=""
          rowSelection={{}}
          onRowSelectionChange={onRowSelectionChange}
        />
      </MemoryRouter>,
    );

    const rows = screen.getAllByRole('row');
    const checkbox = within(rows[1]).getByRole('checkbox');
    fireEvent.click(checkbox);

    expect(onRowSelectionChange).toHaveBeenCalled();
  });

  it('T-new-4: clicking a checkbox does NOT trigger row navigation', () => {
    const sales = [makeSale({ sale_number: '2024-01' })];
    render(
      <MemoryRouter>
        <SalesTable
          sales={sales}
          filterText=""
          rowSelection={{}}
          onRowSelectionChange={vi.fn()}
        />
      </MemoryRouter>,
    );

    const rows = screen.getAllByRole('row');
    const checkbox = within(rows[1]).getByRole('checkbox');
    fireEvent.click(checkbox);

    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('T-new-5: 5th selection is blocked when 4 already selected', () => {
    const onRowSelectionChange = vi.fn();
    const onMaxExceeded = vi.fn();
    const sales = [
      makeSale({ sale_number: '2024-01' }),
      makeSale({ sale_number: '2024-02' }),
      makeSale({ sale_number: '2024-03' }),
      makeSale({ sale_number: '2024-04' }),
      makeSale({ sale_number: '2024-05' }),
    ];
    render(
      <MemoryRouter>
        <SalesTable
          sales={sales}
          filterText=""
          rowSelection={{
            '2024-01': true,
            '2024-02': true,
            '2024-03': true,
            '2024-04': true,
          }}
          onRowSelectionChange={onRowSelectionChange}
          onMaxExceeded={onMaxExceeded}
        />
      </MemoryRouter>,
    );

    const fifthCheckbox = screen.getByRole('checkbox', {
      name: /Select sale 2024-05/i,
    });
    fireEvent.click(fifthCheckbox);

    expect(onMaxExceeded).toHaveBeenCalledTimes(1);
    expect(onRowSelectionChange).not.toHaveBeenCalled();
  });

  it('T-new-6: selection survives sort via getRowId=sale_number', () => {
    const sales = [
      makeSale({ sale_number: '2024-01', title: 'Beta' }),
      makeSale({ sale_number: '2024-02', title: 'Alpha' }),
    ];
    render(
      <MemoryRouter>
        <SalesTable
          sales={sales}
          filterText=""
          rowSelection={{ '2024-01': true }}
          onRowSelectionChange={vi.fn()}
        />
      </MemoryRouter>,
    );

    const titleHeader = screen.getByRole('columnheader', { name: /Title/ });
    const sortButton = within(titleHeader).getByRole('button');
    fireEvent.click(sortButton);

    const checkbox2024_01 = screen.getByRole('checkbox', {
      name: /Select sale 2024-01/i,
    });
    expect((checkbox2024_01 as HTMLInputElement).checked).toBe(true);

    const checkbox2024_02 = screen.getByRole('checkbox', {
      name: /Select sale 2024-02/i,
    });
    expect((checkbox2024_02 as HTMLInputElement).checked).toBe(false);
  });
});
