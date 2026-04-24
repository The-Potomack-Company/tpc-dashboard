import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SaleSummaryCard } from '../components/SaleSummaryCard';
import type { Database } from '../db/database.types';

type Sale = Database['public']['Tables']['sales']['Row'];

function makeSale(overrides: Partial<Sale> = {}): Sale {
  return {
    id: 'id-1',
    sale_number: '22OCT',
    title: 'Fall Auction',
    sale_date: null,
    lots_auctioned: null,
    lots_sold: null,
    lots_unsold: null,
    total_sold_value: null,
    total_unsold_value: null,
    total_low_estimate: null,
    total_high_estimate: null,
    total_reserves: null,
    hammer_total: null,
    buyer_premium: null,
    seller_commission: null,
    insurance: null,
    lot_charges: null,
    referral_fees: null,
    net_revenue: null,
    registered_bidders: null,
    winning_buyers: null,
    payment_status: null,
    validation_warning: false,
    imported_at: null,
    source_pdf_path: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

const ALL_LABELS = [
  'Sale date',
  'Lots auctioned',
  'Lots sold',
  'Lots unsold',
  'Sell-through rate',
  'Total sold value',
  'Total unsold value',
  'Estimate range',
  'Reserves',
  'Hammer total',
  'Buyer premium',
  'Commission',
  'Insurance',
  'Lot charges',
  'Referral fees',
  'Net revenue',
  'Registered bidders',
  'Buyers',
  'Payment status',
];

describe('SaleSummaryCard', () => {
  it('renders all 19 locked tile labels', () => {
    render(<SaleSummaryCard sale={makeSale()} />);
    for (const label of ALL_LABELS) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('formats sale_date via formatDate (no TZ shift)', () => {
    render(<SaleSummaryCard sale={makeSale({ sale_date: '2024-02-15' })} />);
    expect(screen.getByText('Feb 15, 2024')).toBeInTheDocument();
  });

  it('computes sell-through rate from lots_sold / lots_auctioned', () => {
    render(
      <SaleSummaryCard
        sale={makeSale({ lots_sold: 100, lots_auctioned: 125 })}
      />,
    );
    expect(screen.getByText('80.0%')).toBeInTheDocument();
  });

  it('leaves sell-through EMPTY when lots_auctioned is 0', () => {
    render(
      <SaleSummaryCard sale={makeSale({ lots_sold: 0, lots_auctioned: 0 })} />,
    );
    // Sell-through tile shows em-dash when divisor is 0
    const tile = screen.getByText('Sell-through rate').closest('div');
    expect(tile?.textContent).toContain('—');
  });

  it('formats total_sold_value as currency', () => {
    render(
      <SaleSummaryCard sale={makeSale({ total_sold_value: 1234567.89 })} />,
    );
    expect(screen.getByText('$1,234,567.89')).toBeInTheDocument();
  });

  it('formats estimate range with en-dash', () => {
    render(
      <SaleSummaryCard
        sale={makeSale({
          total_low_estimate: 500000,
          total_high_estimate: 800000,
        })}
      />,
    );
    expect(
      screen.getByText('$500,000.00 – $800,000.00'),
    ).toBeInTheDocument();
  });

  it('renders Paid for paid status with no title attribute', () => {
    render(<SaleSummaryCard sale={makeSale({ payment_status: 'paid' })} />);
    const paidNode = screen.getByText('Paid');
    expect(paidNode).toBeInTheDocument();
    expect(paidNode.getAttribute('title')).toBeNull();
  });

  it('renders Partial for partial status', () => {
    render(
      <SaleSummaryCard sale={makeSale({ payment_status: 'partial' })} />,
    );
    expect(screen.getByText('Partial')).toBeInTheDocument();
  });

  it('renders Unpaid for unpaid status', () => {
    render(<SaleSummaryCard sale={makeSale({ payment_status: 'unpaid' })} />);
    expect(screen.getByText('Unpaid')).toBeInTheDocument();
  });

  it('renders EMPTY for null payment_status', () => {
    render(<SaleSummaryCard sale={makeSale({ payment_status: null })} />);
    const tile = screen.getByText('Payment status').closest('div');
    expect(tile?.textContent).toContain('—');
  });

  it('renders all currency formatters for every monetary field', () => {
    render(
      <SaleSummaryCard
        sale={makeSale({
          total_sold_value: 100,
          total_unsold_value: 200,
          total_reserves: 300,
          hammer_total: 400,
          buyer_premium: 500,
          seller_commission: 600,
          insurance: 700,
          lot_charges: 800,
          referral_fees: 900,
          net_revenue: 1000,
        })}
      />,
    );
    for (const amount of [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]) {
      const formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(amount);
      expect(screen.getByText(formatted)).toBeInTheDocument();
    }
  });

  it('formats counts for lots, bidders, buyers', () => {
    render(
      <SaleSummaryCard
        sale={makeSale({
          lots_auctioned: 1234,
          lots_sold: 500,
          lots_unsold: 734,
          registered_bidders: 420,
          winning_buyers: 88,
        })}
      />,
    );
    expect(screen.getByText('1,234')).toBeInTheDocument();
    expect(screen.getByText('500')).toBeInTheDocument();
    expect(screen.getByText('734')).toBeInTheDocument();
    expect(screen.getByText('420')).toBeInTheDocument();
    expect(screen.getByText('88')).toBeInTheDocument();
  });

  it('renders without throwing when every field is null', () => {
    expect(() => render(<SaleSummaryCard sale={makeSale()} />)).not.toThrow();
  });

  it('outer card has rounded border + overflow-hidden classes', () => {
    const { container } = render(<SaleSummaryCard sale={makeSale()} />);
    const card = container.firstChild as HTMLElement;
    const classes = card.className;
    expect(classes).toMatch(/rounded-lg/);
    expect(classes).toMatch(/border/);
    expect(classes).toMatch(/overflow-hidden/);
  });

  it('grid container has responsive cols + divide classes per UI-SPEC', () => {
    const { container } = render(<SaleSummaryCard sale={makeSale()} />);
    const grid = container.querySelector('.grid');
    expect(grid).toBeTruthy();
    const classes = grid?.className ?? '';
    expect(classes).toMatch(/grid-cols-2/);
    expect(classes).toMatch(/md:grid-cols-3/);
    expect(classes).toMatch(/lg:grid-cols-4/);
    expect(classes).toMatch(/divide-x/);
    expect(classes).toMatch(/divide-y/);
  });
});
