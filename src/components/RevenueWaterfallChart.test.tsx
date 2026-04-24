// Phase 6 Plan 06-05 Task 1 — RevenueWaterfallChart component tests.
// Contract: 06-05-PLAN.md Task 1 <behavior>; 06-UI-SPEC.md § Waterfall color
// rules; 06-UI-SPEC.md § Copywriting → Revenue Breakdown.
// REQ-ID: SALE-06, INTR-03.
//
// Strategy mirrors DepartmentRevenueLineChart.test.tsx:
//   - mock ResponsiveContainer with a fixed-size div so Recharts mounts
//     under jsdom's zero-size viewport,
//   - assert on the role='img' wrapper aria-label + EmptyState DOM +
//     transformToWaterfall call presence — NOT Recharts SVG internals
//     (per 06-VALIDATION.md visual rules remain manual-only).

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Database } from '../db/database.types';

vi.mock('recharts', async () => {
  const actual =
    await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 600, height: 320 }}>{children}</div>
    ),
  };
});

// Hoist a mock for transformToWaterfall so individual tests can stub it.
const { transformToWaterfallMock } = vi.hoisted(() => ({
  transformToWaterfallMock: vi.fn(),
}));
vi.mock('../lib/waterfall', async () => {
  const actual =
    await vi.importActual<typeof import('../lib/waterfall')>('../lib/waterfall');
  return {
    ...actual,
    transformToWaterfall: (sale: unknown) => transformToWaterfallMock(sale),
  };
});

import { RevenueWaterfallChart } from './RevenueWaterfallChart';
import type { WaterfallRow } from '../lib/waterfall';

type Sale = Database['public']['Tables']['sales']['Row'];

function makeSale(overrides: Partial<Sale> = {}): Sale {
  return {
    id: 'id-1',
    sale_number: '2024-0011',
    title: 'Fall Auction',
    sale_date: '2024-01-15',
    lots_auctioned: 10,
    lots_sold: 8,
    lots_unsold: 2,
    total_sold_value: 100000,
    total_unsold_value: 10000,
    total_low_estimate: 80000,
    total_high_estimate: 120000,
    total_reserves: 90000,
    hammer_total: 1000,
    buyer_premium: 250,
    seller_commission: 100,
    insurance: 20,
    lot_charges: 30,
    referral_fees: 50,
    net_revenue: 1050,
    registered_bidders: 40,
    winning_buyers: 20,
    payment_status: 'paid',
    validation_warning: false,
    imported_at: null,
    source_pdf_path: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  } as Sale;
}

const validRows: WaterfallRow[] = [
  { step: 'Hammer', fullLabel: 'Hammer total', base: 0, delta: 1000, runningTotal: 1000, direction: 'start' },
  { step: '+Premium', fullLabel: 'Buyer premium', base: 1000, delta: 250, runningTotal: 1250, direction: 'up' },
  { step: '-Commission', fullLabel: 'Commission', base: 1150, delta: 100, runningTotal: 1150, direction: 'down' },
  { step: '-Insurance', fullLabel: 'Insurance', base: 1130, delta: 20, runningTotal: 1130, direction: 'down' },
  { step: '-Lot charges', fullLabel: 'Lot charges', base: 1100, delta: 30, runningTotal: 1100, direction: 'down' },
  { step: '-Referral', fullLabel: 'Referral fees', base: 1050, delta: 50, runningTotal: 1050, direction: 'down' },
  { step: 'Net revenue', fullLabel: 'Net revenue', base: 0, delta: 1050, runningTotal: 1050, direction: 'end' },
];

beforeEach(() => {
  transformToWaterfallMock.mockReset();
});

describe('RevenueWaterfallChart', () => {
  it('T1: valid sale → renders wrapper with aria-label containing sale_number', () => {
    transformToWaterfallMock.mockReturnValue(validRows);
    render(
      <div style={{ width: 600, height: 320 }}>
        <RevenueWaterfallChart sale={makeSale()} />
      </div>,
    );
    const wrapper = screen.getByRole('img');
    expect(wrapper.getAttribute('aria-label')).toMatch(/2024-0011/);
  });

  it('T2: all-null financial fields → renders EmptyState "No revenue breakdown available"', () => {
    transformToWaterfallMock.mockReturnValue(null);
    render(
      <RevenueWaterfallChart
        sale={makeSale({
          hammer_total: null,
          buyer_premium: null,
          seller_commission: null,
          insurance: null,
          lot_charges: null,
          referral_fees: null,
          net_revenue: null,
        })}
      />,
    );
    expect(
      screen.getByText('No revenue breakdown available'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /This sale is missing one or more financial fields needed to render the waterfall\./,
      ),
    ).toBeInTheDocument();
    // Wrapper role='img' must not appear when EmptyState is shown.
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('T3: component calls transformToWaterfall with the sale prop', () => {
    transformToWaterfallMock.mockReturnValue(validRows);
    const sale = makeSale();
    render(
      <div style={{ width: 600, height: 320 }}>
        <RevenueWaterfallChart sale={sale} />
      </div>,
    );
    expect(transformToWaterfallMock).toHaveBeenCalledWith(sale);
  });

  it('T4: per-row colors map from direction → COLOR_BY_DIRECTION (sanity via no-throw + row count)', () => {
    // Visual cell-color verification stays manual per 06-VALIDATION.md.
    // This test ensures the render path consumes every row without throwing.
    transformToWaterfallMock.mockReturnValue(validRows);
    expect(() => {
      render(
        <div style={{ width: 600, height: 320 }}>
          <RevenueWaterfallChart sale={makeSale()} />
        </div>,
      );
    }).not.toThrow();
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('T5: Recharts BarChart renders inside the wrapper (tooltip wired structurally)', () => {
    transformToWaterfallMock.mockReturnValue(validRows);
    const { container } = render(
      <div style={{ width: 600, height: 320 }}>
        <RevenueWaterfallChart sale={makeSale()} />
      </div>,
    );
    // Recharts injects a .recharts-wrapper once the BarChart mounts under
    // a sized container. That proves the Tooltip/Bar children are part of
    // the render tree. The tooltip content itself is only materialized on
    // hover (manual-verify per 06-VALIDATION.md) — asserting on the chart
    // wrapper is the stable proxy.
    const chartWrapper = container.querySelector('.recharts-wrapper');
    expect(chartWrapper).not.toBeNull();
  });

  it('T6: aria-label includes sale_number and formatted net_revenue', () => {
    transformToWaterfallMock.mockReturnValue(validRows);
    render(
      <div style={{ width: 600, height: 320 }}>
        <RevenueWaterfallChart
          sale={makeSale({ sale_number: '2024-0042', net_revenue: 1050 })}
        />
      </div>,
    );
    const wrapper = screen.getByRole('img');
    const label = wrapper.getAttribute('aria-label') ?? '';
    expect(label).toMatch(/2024-0042/);
    // formatCurrency(1050) → "$1,050.00"
    expect(label).toMatch(/\$1,050\.00/);
  });

  it('T7: when transformToWaterfall returns null (missing field) → EmptyState renders', () => {
    transformToWaterfallMock.mockReturnValue(null);
    render(
      <RevenueWaterfallChart
        sale={makeSale({ net_revenue: null })}
      />,
    );
    expect(
      screen.getByText('No revenue breakdown available'),
    ).toBeInTheDocument();
  });

  it('T8: does not throw when rendered inside a fixed-size wrapper', () => {
    transformToWaterfallMock.mockReturnValue(validRows);
    expect(() => {
      render(
        <div style={{ width: 400, height: 320 }}>
          <RevenueWaterfallChart sale={makeSale()} />
        </div>,
      );
    }).not.toThrow();
  });
});
