import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { Database } from '../db/database.types';
import { RecentSaleCard } from '../components/RecentSaleCard';
import { RecentSaleCardSkeleton } from '../components/RecentSaleCardSkeleton';

// Phase 4 Plan 03 Task 4 — RecentSaleCard contract locked by
// 04-UI-SPEC.md § Layout Specifications (lines 448–480) + § Copywriting
// Contract → Recent sales panel. Sell-through renders as "—" when
// lots_auctioned is null or 0 (divide-by-zero guard).

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
    lots_auctioned: 200,
    lots_sold: 144,
    lots_unsold: null,
    net_revenue: 214307.5,
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

function renderCard(sale: Sale) {
  return render(
    <MemoryRouter>
      <RecentSaleCard sale={sale} />
    </MemoryRouter>,
  );
}

describe('RecentSaleCard — navigation', () => {
  it('renders as react-router <Link> to /sales/{sale_number}', () => {
    const { container } = renderCard(
      makeSale({ sale_number: '2024-0012', title: 'Winter Sale' }),
    );
    const link = container.querySelector('a');
    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).toBe('/sales/2024-0012');
  });

  it('link container has p-4 rounded-lg border min-h-[128px] space-y-1 classes', () => {
    const { container } = renderCard(makeSale());
    const link = container.querySelector('a') as HTMLElement;
    const cls = link.className;
    expect(cls).toContain('block');
    expect(cls).toContain('p-4');
    expect(cls).toContain('rounded-lg');
    expect(cls).toContain('border');
    expect(cls).toContain('min-h-[128px]');
    expect(cls).toContain('space-y-1');
    expect(cls).toContain('hover:bg-gray-50');
    expect(cls).toContain('focus-visible:ring-accent');
    expect(cls).toContain('focus-visible:ring-inset');
  });
});

describe('RecentSaleCard — content', () => {
  it('renders sale_number with font-semibold Label role classes', () => {
    renderCard(makeSale({ sale_number: '2024-0012' }));
    const el = screen.getByText('2024-0012');
    expect(el.className).toContain('text-sm');
    expect(el.className).toContain('font-semibold');
  });

  it('renders title truncated to a single line with title attribute for full text', () => {
    renderCard(makeSale({ title: 'Important Autumn Sale: Vintage Posters' }));
    const titleEl = screen.getByText('Important Autumn Sale: Vintage Posters');
    expect(titleEl.className).toContain('truncate');
    expect(titleEl.getAttribute('title')).toBe(
      'Important Autumn Sale: Vintage Posters',
    );
    expect(titleEl.className).toContain('text-base');
  });

  it('renders formatted sale_date (e.g. Jan 15, 2024)', () => {
    renderCard(makeSale({ sale_date: '2024-01-15' }));
    expect(screen.getByText('Jan 15, 2024')).toBeInTheDocument();
  });

  it('renders formatCurrency(net_revenue) with font-semibold tabular-nums classes', () => {
    renderCard(makeSale({ net_revenue: 214307.5 }));
    const el = screen.getByText('$214,307.50');
    expect(el.className).toContain('tabular-nums');
    expect(el.className).toContain('font-semibold');
  });

  it('renders sell-through as formatPercent(lots_sold / lots_auctioned) + " sell-through" suffix', () => {
    renderCard(makeSale({ lots_sold: 144, lots_auctioned: 200 }));
    // 144 / 200 = 0.72 → "72.0%"
    expect(screen.getByText(/72\.0% sell-through/)).toBeInTheDocument();
  });
});

describe('RecentSaleCard — null / divide-by-zero handling', () => {
  it('null lots_auctioned → sell-through renders "— sell-through"', () => {
    renderCard(makeSale({ lots_sold: 0, lots_auctioned: null }));
    expect(screen.getByText(/— sell-through/)).toBeInTheDocument();
  });

  it('lots_auctioned === 0 → sell-through renders "— sell-through" (divide-by-zero guard)', () => {
    renderCard(makeSale({ lots_sold: 0, lots_auctioned: 0 }));
    expect(screen.getByText(/— sell-through/)).toBeInTheDocument();
  });

  it('null lots_sold with valid lots_auctioned → sell-through renders "— sell-through"', () => {
    renderCard(makeSale({ lots_sold: null, lots_auctioned: 200 }));
    expect(screen.getByText(/— sell-through/)).toBeInTheDocument();
  });

  it('null net_revenue renders as EMPTY em-dash via formatCurrency(null)', () => {
    const { container } = renderCard(makeSale({ net_revenue: null }));
    // The currency row should contain the em-dash text
    expect(container.textContent).toContain('—');
  });

  it('null sale_date renders as EMPTY', () => {
    const { container } = renderCard(makeSale({ sale_date: null }));
    expect(container.textContent).toContain('—');
  });
});

describe('RecentSaleCardSkeleton', () => {
  it('renders a div (not Link) with matching p-4 rounded-lg min-h-[128px] space-y-1 container', () => {
    const { container } = render(<RecentSaleCardSkeleton />);
    const card = container.firstElementChild as HTMLElement;
    expect(card.tagName).toBe('DIV');
    const cls = card.className;
    expect(cls).toContain('p-4');
    expect(cls).toContain('rounded-lg');
    expect(cls).toContain('border');
    expect(cls).toContain('min-h-[128px]');
    expect(cls).toContain('space-y-1');
  });

  it('contains 5 motion-safe:animate-pulse shimmer bars', () => {
    const { container } = render(<RecentSaleCardSkeleton />);
    const bars = container.querySelectorAll('.motion-safe\\:animate-pulse');
    expect(bars.length).toBe(5);
    bars.forEach((bar) => {
      expect(bar.className).toContain('bg-gray-200');
      expect(bar.className).toContain('dark:bg-gray-700');
      expect(bar.className).toContain('rounded');
    });
  });
});
