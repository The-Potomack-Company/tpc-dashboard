// Phase 6 Plan 06-04 — Tests for ComparisonTable.
// Contract: .planning/phases/06-department-analysis-sale-comparison/06-04-PLAN.md § Task 5.

import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { Database } from '../db/database.types';
import { ComparisonTable } from './ComparisonTable';

type Sale = Database['public']['Tables']['sales']['Row'];

function makeSale(overrides: Partial<Sale> = {}): Sale {
  return {
    id: 'id-' + (overrides.sale_number ?? 'x'),
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

describe('ComparisonTable', () => {
  it('T1: 2 sales — first column has no deltas; second column has deltas', () => {
    const sales = [
      makeSale({ sale_number: '2024-01', net_revenue: 100, sale_date: '2024-01-15' }),
      makeSale({ sale_number: '2024-02', net_revenue: 150, sale_date: '2024-02-15' }),
    ];
    render(<ComparisonTable sales={sales} />);

    const row = screen.getByRole('row', { name: /Net revenue/ });
    const cells = within(row).getAllByRole('cell');
    expect(cells[1].textContent).toContain('$100');
    expect(cells[1].textContent).not.toMatch(/[+-]\d/);
    expect(cells[2].textContent).toContain('$150');
    expect(cells[2].textContent).toMatch(/\+50\.0%/);
  });

  it('T2: 3 sales — column 3 delta vs column 2 (adjacent-pair)', () => {
    const sales = [
      makeSale({ sale_number: '2024-01', net_revenue: 100 }),
      makeSale({ sale_number: '2024-02', net_revenue: 150 }),
      makeSale({ sale_number: '2024-03', net_revenue: 150 }),
    ];
    render(<ComparisonTable sales={sales} />);

    const row = screen.getByRole('row', { name: /Net revenue/ });
    const cells = within(row).getAllByRole('cell');
    expect(cells[3].textContent).toContain('$150');
    expect(cells[3].textContent).toMatch(/0\.0%/);
    expect(cells[3].textContent).not.toMatch(/\+50/);
  });

  it('T3: 4 sales — each column 2/3/4 has delta', () => {
    const sales = [
      makeSale({ sale_number: 'S1', net_revenue: 100 }),
      makeSale({ sale_number: 'S2', net_revenue: 120 }),
      makeSale({ sale_number: 'S3', net_revenue: 150 }),
      makeSale({ sale_number: 'S4', net_revenue: 180 }),
    ];
    render(<ComparisonTable sales={sales} />);

    const row = screen.getByRole('row', { name: /Net revenue/ });
    const cells = within(row).getAllByRole('cell');
    expect(cells[2].textContent).toMatch(/\+20\.0%/);
    expect(cells[3].textContent).toMatch(/\+25\.0%/);
    expect(cells[4].textContent).toMatch(/\+20\.0%/);
  });

  it('T4: metadata row (Sale date) has no delta', () => {
    const sales = [
      makeSale({ sale_number: '2024-01', sale_date: '2024-01-01' }),
      makeSale({ sale_number: '2024-02', sale_date: '2024-06-15' }),
    ];
    render(<ComparisonTable sales={sales} />);

    const row = screen.getByRole('row', { name: /Sale date/ });
    const cells = within(row).getAllByRole('cell');
    expect(cells[1].textContent).not.toMatch(/[+-]\d+(\.\d+)?%/);
    expect(cells[2].textContent).not.toMatch(/[+-]\d+(\.\d+)?%/);
  });

  it('T5: up delta has emerald class', () => {
    const sales = [
      makeSale({ sale_number: 'S1', net_revenue: 100 }),
      makeSale({ sale_number: 'S2', net_revenue: 120 }),
    ];
    const { container } = render(<ComparisonTable sales={sales} />);
    const emerald = container.querySelectorAll('[class*="emerald"]');
    expect(emerald.length).toBeGreaterThan(0);
  });

  it('T6: down delta has rose class', () => {
    const sales = [
      makeSale({ sale_number: 'S1', net_revenue: 100 }),
      makeSale({ sale_number: 'S2', net_revenue: 90 }),
    ];
    const { container } = render(<ComparisonTable sales={sales} />);
    const rose = container.querySelectorAll('[class*="rose"]');
    expect(rose.length).toBeGreaterThan(0);
  });

  it('T7: flat delta has gray class AND 0.0% text', () => {
    const sales = [
      makeSale({ sale_number: 'S1', net_revenue: 100 }),
      makeSale({ sale_number: 'S2', net_revenue: 100 }),
    ];
    const { container } = render(<ComparisonTable sales={sales} />);
    const row = screen.getByRole('row', { name: /Net revenue/ });
    const cells = within(row).getAllByRole('cell');
    expect(cells[2].textContent).toMatch(/0\.0%/);
    const grayDeltas = container.querySelectorAll('[class*="text-gray-400"]');
    expect(grayDeltas.length).toBeGreaterThan(0);
  });

  it('T8: null value renders em-dash', () => {
    const sales = [
      makeSale({ sale_number: 'S1', net_revenue: 100 }),
      makeSale({ sale_number: 'S2', net_revenue: null }),
    ];
    render(<ComparisonTable sales={sales} />);
    const row = screen.getByRole('row', { name: /Net revenue/ });
    const cells = within(row).getAllByRole('cell');
    expect(cells[2].textContent).toContain('—');
  });

  it('T9: group heading rows appear in locked order', () => {
    const sales = [
      makeSale({ sale_number: 'S1' }),
      makeSale({ sale_number: 'S2' }),
    ];
    render(<ComparisonTable sales={sales} />);

    const meta = screen.getByText(/^Sale metadata$/);
    const lot = screen.getByText(/^Lot metrics$/);
    const fin = screen.getByText(/^Financial breakdown$/);
    const part = screen.getByText(/^Participation$/);

    const posMeta = meta.compareDocumentPosition(lot);
    const posLot = lot.compareDocumentPosition(fin);
    const posFin = fin.compareDocumentPosition(part);
    expect(posMeta & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(posLot & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(posFin & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('T10: metric labels include UI-SPEC-locked names', () => {
    const sales = [
      makeSale({ sale_number: 'S1' }),
      makeSale({ sale_number: 'S2' }),
    ];
    render(<ComparisonTable sales={sales} />);

    const labels = [
      'Sale date',
      'Title',
      'Payment status',
      'Lots auctioned',
      'Lots sold',
      'Lots unsold',
      'Sell-through %',
      'Total sold value',
      'Total unsold value',
      'Total reserves',
      'Hammer total',
      'Buyer premium',
      'Commission',
      'Insurance',
      'Lot charges',
      'Referral fees',
      'Net revenue',
      'Registered bidders',
      'Winning buyers',
    ];
    for (const label of labels) {
      expect(screen.getByRole('row', { name: new RegExp(label) })).toBeInTheDocument();
    }
  });
});
