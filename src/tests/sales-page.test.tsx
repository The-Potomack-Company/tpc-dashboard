import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Database } from '../db/database.types';

const navigateMock = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: (args: { count: number }) => ({
    getVirtualItems: () => Array.from({ length: args.count }, (_, index) => ({
      index, start: index * 44, size: 44, end: (index + 1) * 44, key: index, lane: 0,
    })),
    getTotalSize: () => args.count * 44,
    measureElement: () => {},
  }),
}));

const { useSalesMock } = vi.hoisted(() => ({ useSalesMock: vi.fn() }));
vi.mock('../hooks/useSales', () => ({ useSales: () => useSalesMock() }));

import { SalesPage } from '../pages/Sales';

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

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/sales']}>
        <Routes>
          <Route path="/sales" element={<SalesPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => { vi.clearAllMocks(); });

describe('SalesPage', () => {
  it('renders TableSkeleton while useSales is loading', () => {
    useSalesMock.mockReturnValue({ isLoading: true, isError: false, isSuccess: false, data: undefined, error: null, refetch: vi.fn() });
    const { container } = renderPage();
    const shimmers = container.querySelectorAll('.motion-safe\\:animate-pulse');
    expect(shimmers.length).toBeGreaterThanOrEqual(10);
  });

  it('renders No sales yet empty state when useSales resolves with empty array', () => {
    useSalesMock.mockReturnValue({ isLoading: false, isError: false, isSuccess: true, data: [], error: null, refetch: vi.fn() });
    renderPage();
    expect(screen.getByRole('heading', { name: 'No sales yet' })).toBeInTheDocument();
    expect(screen.getByText(/npm run import:pdfs/)).toBeInTheDocument();
  });

  it('renders error state with Retry button when useSales fails', () => {
    const refetch = vi.fn();
    useSalesMock.mockReturnValue({ isLoading: false, isError: true, isSuccess: false, data: undefined, error: new Error('boom'), refetch });
    renderPage();
    expect(screen.getByRole('heading', { name: "Couldn't load sales" })).toBeInTheDocument();
    expect(screen.getByText(/Something went wrong talking to the database/)).toBeInTheDocument();
    const retry = screen.getByRole('button', { name: /Retry/ });
    fireEvent.click(retry);
    expect(refetch).toHaveBeenCalled();
  });

  it('renders SalesTable with subtitle when useSales resolves with rows', () => {
    const sales = [
      makeSale({ sale_number: 'A', title: 'Alpha', sale_date: '2024-03-01' }),
      makeSale({ sale_number: 'B', title: 'Bravo', sale_date: '2024-02-01' }),
      makeSale({ sale_number: 'C', title: 'Charlie', sale_date: '2024-01-01' }),
    ];
    useSalesMock.mockReturnValue({ isLoading: false, isError: false, isSuccess: true, data: sales, error: null, refetch: vi.fn() });
    renderPage();
    expect(screen.getByText('3 sales imported')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Sale #/ })).toBeInTheDocument();
    expect(screen.getAllByRole('row').length).toBe(4);
  });

  it('filter narrows rows via useDeferredValue', async () => {
    const sales = [
      makeSale({ sale_number: 'S1', title: 'Vintage Posters' }),
      makeSale({ sale_number: 'S2', title: 'Modern Art' }),
      makeSale({ sale_number: 'S3', title: 'Another Vintage' }),
    ];
    useSalesMock.mockReturnValue({ isLoading: false, isError: false, isSuccess: true, data: sales, error: null, refetch: vi.fn() });
    const user = userEvent.setup();
    renderPage();
    const input = screen.getByLabelText('Filter sales by title or sale number');
    await user.type(input, 'vintage');
    await waitFor(() => {
      expect(screen.getAllByRole('row').length).toBe(3);
    });
  });

  it('live region shows n of total sales when filter non-empty', async () => {
    const sales = [
      makeSale({ sale_number: 'S1', title: 'Vintage Posters' }),
      makeSale({ sale_number: 'S2', title: 'Modern Art' }),
      makeSale({ sale_number: 'S3', title: 'Another Vintage' }),
    ];
    useSalesMock.mockReturnValue({ isLoading: false, isError: false, isSuccess: true, data: sales, error: null, refetch: vi.fn() });
    const user = userEvent.setup();
    const { container } = renderPage();
    expect(container.querySelector('[aria-live="polite"]')).toBeNull();
    const input = screen.getByLabelText('Filter sales by title or sale number');
    await user.type(input, 'vintage');
    await waitFor(() => {
      const liveRegion = container.querySelector('[aria-live="polite"]');
      expect(liveRegion).not.toBeNull();
      expect(liveRegion?.textContent).toMatch(/2 of 3 sales/);
    });
  });

  it('row click navigates to /sales/sale_number', () => {
    const sales = [makeSale({ sale_number: '22OCT', title: 'Fall Sale' })];
    useSalesMock.mockReturnValue({ isLoading: false, isError: false, isSuccess: true, data: sales, error: null, refetch: vi.fn() });
    renderPage();
    const rows = screen.getAllByRole('row');
    fireEvent.click(rows[1]);
    expect(navigateMock).toHaveBeenCalledWith('/sales/22OCT');
  });

  it('header always shows the Sales heading', () => {
    useSalesMock.mockReturnValue({ isLoading: false, isError: false, isSuccess: true, data: [], error: null, refetch: vi.fn() });
    renderPage();
    const heading = screen.getByRole('heading', { level: 1, name: 'Sales' });
    expect(heading).toBeInTheDocument();
  });
});
