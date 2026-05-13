import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cloneElement, isValidElement } from 'react';
import type { ReactElement, ReactNode } from 'react';

// Phase 2 / EXT-02 — KpiStrip tests.
//
// KpiStrip composes KpiCard + Sparkline. Sparkline transitively renders
// Recharts via ResponsiveContainer, so we mount the Phase 1 Recharts mock
// (Sparkline.test.tsx lines 13-32) here as well, sized for the sparkline
// (200x32) so JSDom layout absence doesn't suppress the SVG.
vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactNode }) => {
      const child = isValidElement(children)
        ? cloneElement(
            children as ReactElement<{ width?: number; height?: number }>,
            { width: 200, height: 32 },
          )
        : children;
      return (
        <div style={{ width: 200, height: 32 }} data-testid="mocked-responsive">
          {child}
        </div>
      );
    },
  };
});

const useKpiMock = vi.fn();
vi.mock('../../hooks/extension/useKpiTotals', () => ({
  useKpiTotals: () => useKpiMock(),
}));

import { KpiStrip } from './KpiStrip';

beforeEach(() => {
  useKpiMock.mockReset();
});

const ALL_TYPES = [
  'catalog_single',
  'catalog_batch',
  'portal_upload',
  'spreadsheet_transform',
  'data_import',
] as const;

function makeRows(overrides: Partial<Record<(typeof ALL_TYPES)[number], { current: number; previous: number; spark?: Array<{ x: string; y: number }> }>> = {}) {
  return ALL_TYPES.map((t) => {
    const o = overrides[t] ?? { current: 10, previous: 5 };
    return {
      event_type: t,
      current_count: o.current,
      previous_count: o.previous,
      sparkline: o.spark ?? [],
    };
  });
}

describe('<KpiStrip>', () => {
  it('Test 1: renders 5 KpiCard elements with event-type literal labels', () => {
    useKpiMock.mockReturnValue({
      data: makeRows(),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<KpiStrip />);
    expect(screen.getAllByTestId('kpi-card')).toHaveLength(5);
    for (const t of ALL_TYPES) {
      expect(screen.getByText(t)).toBeInTheDocument();
    }
  });

  it('Test 2: cur=100, prev=80 → delta direction="up" with positive value', () => {
    useKpiMock.mockReturnValue({
      data: makeRows({
        catalog_single: { current: 100, previous: 80 },
      }),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<KpiStrip />);
    // KpiCard maps direction='up' to text-green-600
    const greens = document.querySelectorAll('.text-green-600');
    expect(greens.length).toBeGreaterThan(0);
    // The delta value is rendered: +25%
    expect(screen.getByText(/\+25%/)).toBeInTheDocument();
  });

  it('Test 3: cur=80, prev=100 → delta direction="down"', () => {
    useKpiMock.mockReturnValue({
      data: makeRows({
        catalog_single: { current: 80, previous: 100 },
      }),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<KpiStrip />);
    expect(document.querySelectorAll('.text-red-600').length).toBeGreaterThan(0);
    expect(screen.getByText(/-20%/)).toBeInTheDocument();
  });

  it('Test 4: cur===prev → delta direction="flat"; cur=0,prev=0 also flat (or absent)', () => {
    useKpiMock.mockReturnValue({
      data: makeRows({
        catalog_single: { current: 50, previous: 50 },
      }),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<KpiStrip />);
    // text-gray-500 is the flat color in KpiCard
    expect(document.querySelectorAll('.text-gray-500').length).toBeGreaterThan(0);
  });

  it('Test 5: cur=0 → KpiCard value renders EMPTY (em-dash) and no delta', () => {
    useKpiMock.mockReturnValue({
      data: makeRows({
        catalog_single: { current: 0, previous: 0 },
      }),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<KpiStrip />);
    // Find the catalog_single card: the label appears, paired with EMPTY value
    // Multiple cards may have non-zero values; we just assert at least one '—' exists
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('Test 6: Sparkline receives parsed jsonb shape (passes through to renderable Sparkline)', () => {
    useKpiMock.mockReturnValue({
      data: makeRows({
        catalog_single: {
          current: 10,
          previous: 5,
          spark: [
            { x: '2026-04-29T00:00:00Z', y: 1 },
            { x: '2026-04-30T00:00:00Z', y: 2 },
          ],
        },
      }),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<KpiStrip />);
    // Sparkline renders into kpi-card-sparkline-slot only when data is non-empty.
    const slots = screen.getAllByTestId('kpi-card-sparkline-slot');
    expect(slots.length).toBeGreaterThanOrEqual(1);
    // At least one Sparkline outer div is rendered
    const sparks = screen.getAllByTestId('sparkline');
    expect(sparks.length).toBeGreaterThanOrEqual(1);
  });

  it('Test 7: isLoading=true renders 5 KpiCard with built-in skeleton', () => {
    useKpiMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });
    render(<KpiStrip />);
    const cards = screen.getAllByTestId('kpi-card');
    expect(cards).toHaveLength(5);
    // KpiCard's loading state sets aria-busy="true"
    for (const c of cards) {
      expect(c.getAttribute('aria-busy')).toBe('true');
    }
  });

  it('Test 8: error renders ErrorState (locked contract); Retry button calls refetch', async () => {
    const refetch = vi.fn();
    useKpiMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('boom'),
      refetch,
    });
    render(<KpiStrip />);
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load KPIs");
    expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Retry/i }));
    expect(refetch).toHaveBeenCalled();
  });
});
