// Phase 6 Plan 06-04 — Tests for SaleComparePage.
// Contract: .planning/phases/06-department-analysis-sale-comparison/06-04-PLAN.md § Task 6.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Database } from '../db/database.types';

type Sale = Database['public']['Tables']['sales']['Row'];

const { useSalesComparisonMock } = vi.hoisted(() => ({
  useSalesComparisonMock: vi.fn(),
}));
vi.mock('../hooks/useSalesComparison', () => ({
  useSalesComparison: (...args: unknown[]) => useSalesComparisonMock(...args),
}));

import { SaleComparePage } from '../pages/SaleCompare';

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

function renderAt(url: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/sales" element={<div>SALES LIST</div>} />
          <Route path="/sales/compare" element={<SaleComparePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  useSalesComparisonMock.mockReset();
});

describe('SaleComparePage', () => {
  it('T1: no ?sales= param renders Invalid comparison card', () => {
    useSalesComparisonMock.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    renderAt('/sales/compare');
    expect(screen.getByRole('heading', { name: /Invalid comparison/ })).toBeInTheDocument();
  });

  it('T2: ?sales=2024-01 (too-few) renders Invalid comparison', () => {
    useSalesComparisonMock.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    renderAt('/sales/compare?sales=2024-01');
    expect(screen.getByRole('heading', { name: /Invalid comparison/ })).toBeInTheDocument();
  });

  it('T3: too-many sales renders Invalid comparison', () => {
    useSalesComparisonMock.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    renderAt('/sales/compare?sales=2024-01,2024-02,2024-03,2024-04,2024-05');
    expect(screen.getByRole('heading', { name: /Invalid comparison/ })).toBeInTheDocument();
  });

  it('T4: malformed sale renders Invalid comparison', () => {
    useSalesComparisonMock.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    renderAt('/sales/compare?sales=2024-01,%3Cscript%3E');
    expect(screen.getByRole('heading', { name: /Invalid comparison/ })).toBeInTheDocument();
  });

  it('T5: valid ?sales=2024-01,2024-02 with 2 sales renders ComparisonTable', () => {
    useSalesComparisonMock.mockReturnValue({
      data: [
        makeSale({ sale_number: '2024-01', sale_date: '2024-01-15' }),
        makeSale({ sale_number: '2024-02', sale_date: '2024-02-15' }),
      ],
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    renderAt('/sales/compare?sales=2024-01,2024-02');
    expect(screen.getByRole('heading', { name: /Compare Sales/ })).toBeInTheDocument();
    expect(screen.getByText(/Comparing 2 sales/)).toBeInTheDocument();
  });

  it('T6: isPending renders skeleton', () => {
    useSalesComparisonMock.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    const { container } = renderAt('/sales/compare?sales=2024-01,2024-02');
    const shimmers = container.querySelectorAll('.motion-safe\\:animate-pulse');
    expect(shimmers.length).toBeGreaterThan(0);
  });

  it('T7: isError with "not found" message routes to Invalid comparison', () => {
    useSalesComparisonMock.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      error: new Error('One or more sale numbers not found: 2024-99'),
      refetch: vi.fn(),
    });
    renderAt('/sales/compare?sales=2024-01,2024-99');
    expect(screen.getByRole('heading', { name: /Invalid comparison/ })).toBeInTheDocument();
  });
});
