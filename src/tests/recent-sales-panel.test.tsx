import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { Database } from '../db/database.types';
import { RecentSalesPanel } from '../components/RecentSalesPanel';

// Phase 4 Plan 03 Task 5 — RecentSalesPanel contract locked by
// 04-UI-SPEC.md § Layout Specifications (Recent Sales section) + § Copywriting
// Contract → Recent Sales panel, and 04-RESEARCH.md § Pattern 6 (useMemo
// reference stability on .slice(0, 5)).

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
    lots_auctioned: 100,
    lots_sold: 72,
    lots_unsold: null,
    net_revenue: 100000,
    payment_status: null,
    referral_fees: null,
    registered_bidders: null,
    sale_date: '2024-01-15',
    sale_number: overrides.sale_number ?? 'S1',
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

function wrap(ui: React.ReactNode) {
  return <MemoryRouter>{ui}</MemoryRouter>;
}

describe('RecentSalesPanel — loading', () => {
  it('isLoading=true renders 5 shimmer skeletons in the grid', () => {
    const { container } = render(
      wrap(
        <RecentSalesPanel
          sales={undefined}
          isLoading={true}
          error={null}
          onRetry={() => {}}
        />,
      ),
    );
    // The skeleton body contains 5 shimmer bars each, so we assert on the
    // number of skeleton containers — they have the same min-h-[128px] +
    // p-4 shell as RecentSaleCard.
    const shimmers = container.querySelectorAll('.motion-safe\\:animate-pulse');
    // 5 skeletons × 5 bars per skeleton = 25 shimmer bars.
    expect(shimmers.length).toBe(25);
  });
});

describe('RecentSalesPanel — empty', () => {
  it('empty sales array renders EmptyState with heading "No sales yet" and body mentioning npm run import:pdfs', () => {
    render(
      wrap(
        <RecentSalesPanel
          sales={[]}
          isLoading={false}
          error={null}
          onRetry={() => {}}
        />,
      ),
    );
    expect(screen.getByRole('heading', { name: 'No sales yet' })).toBeInTheDocument();
    expect(screen.getByText(/npm run import:pdfs/)).toBeInTheDocument();
  });

  it('EmptyState container wrapper has col-span-full class to span the whole grid', () => {
    const { container } = render(
      wrap(
        <RecentSalesPanel
          sales={[]}
          isLoading={false}
          error={null}
          onRetry={() => {}}
        />,
      ),
    );
    const colspan = container.querySelector('.col-span-full');
    expect(colspan).not.toBeNull();
    // The EmptyState heading lives inside this wrapper
    expect(colspan?.textContent).toContain('No sales yet');
  });
});

describe('RecentSalesPanel — error', () => {
  it('error set renders ErrorState with the locked copy and Retry clicks call onRetry', () => {
    const onRetry = vi.fn();
    render(
      wrap(
        <RecentSalesPanel
          sales={undefined}
          isLoading={false}
          error={new Error('boom')}
          onRetry={onRetry}
        />,
      ),
    );
    expect(screen.getByText("Couldn't load recent sales")).toBeInTheDocument();
    expect(
      screen.getByText(
        /Something went wrong talking to the database\. Retry below, or refresh the page\./,
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Retry/ }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('ErrorState wrapper has col-span-full class', () => {
    const { container } = render(
      wrap(
        <RecentSalesPanel
          sales={undefined}
          isLoading={false}
          error={new Error('boom')}
          onRetry={() => {}}
        />,
      ),
    );
    const colspan = container.querySelector('.col-span-full');
    expect(colspan).not.toBeNull();
    expect(colspan?.textContent).toContain("Couldn't load recent sales");
  });
});

describe('RecentSalesPanel — data', () => {
  it('10 sales input renders exactly 5 RecentSaleCard tiles (slice(0, 5))', () => {
    const sales = Array.from({ length: 10 }, (_, i) =>
      makeSale({ sale_number: `S${i + 1}`, title: `Sale ${i + 1}` }),
    );
    const { container } = render(
      wrap(
        <RecentSalesPanel
          sales={sales}
          isLoading={false}
          error={null}
          onRetry={() => {}}
        />,
      ),
    );
    const links = container.querySelectorAll('a[href^="/sales/"]');
    expect(links.length).toBe(5);
    // First 5 sales by sale_number
    expect(links[0].getAttribute('href')).toBe('/sales/S1');
    expect(links[4].getAttribute('href')).toBe('/sales/S5');
  });

  it('3 sales input renders 3 RecentSaleCard tiles (does not pad)', () => {
    const sales = [
      makeSale({ sale_number: 'A' }),
      makeSale({ sale_number: 'B' }),
      makeSale({ sale_number: 'C' }),
    ];
    const { container } = render(
      wrap(
        <RecentSalesPanel
          sales={sales}
          isLoading={false}
          error={null}
          onRetry={() => {}}
        />,
      ),
    );
    const links = container.querySelectorAll('a[href^="/sales/"]');
    expect(links.length).toBe(3);
  });
});

describe('RecentSalesPanel — layout', () => {
  it('section heading is h2 with text "Recent sales" + text-xl font-semibold', () => {
    render(
      wrap(
        <RecentSalesPanel
          sales={[]}
          isLoading={false}
          error={null}
          onRetry={() => {}}
        />,
      ),
    );
    const heading = screen.getByRole('heading', { level: 2, name: 'Recent sales' });
    expect(heading.className).toContain('text-xl');
    expect(heading.className).toContain('font-semibold');
  });

  it('grid container has grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 classes', () => {
    const { container } = render(
      wrap(
        <RecentSalesPanel
          sales={[]}
          isLoading={false}
          error={null}
          onRetry={() => {}}
        />,
      ),
    );
    // Find the grid container (the one with grid-cols classes)
    const grid = container.querySelector('.grid');
    expect(grid).not.toBeNull();
    const cls = grid?.className ?? '';
    expect(cls).toContain('grid-cols-1');
    expect(cls).toContain('md:grid-cols-2');
    expect(cls).toContain('lg:grid-cols-5');
    expect(cls).toContain('gap-4');
  });
});
