import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Phase 2 / EXT-10 — CancellationRateKpis tests.
// Verifies the FLIPPED delta-direction invariant (UI-SPEC § Color: higher
// cancel rate = bad → increase = down/red, decrease = up/green) plus the
// previous_rate=null edge case (RPC returns NULL when prev denominator was 0).

const useCancelMock = vi.fn();
vi.mock('../../hooks/extension/useCancellationRates', () => ({
  useCancellationRates: () => useCancelMock(),
}));

import {
  CancellationRateKpis,
  computeFlippedDelta,
} from './CancellationRateKpis';

beforeEach(() => {
  useCancelMock.mockReset();
});

describe('computeFlippedDelta — FLIPPED delta semantics (higher cancel rate is bad)', () => {
  it('Test 2: current 0.10 vs previous 0.05 → direction "down" (red, cancellations rose)', () => {
    const d = computeFlippedDelta(0.1, 0.05);
    expect(d?.direction).toBe('down');
    expect(d?.value).toBe('+5.0pp');
  });

  it('Test 3: current 0.05 vs previous 0.10 → direction "up" (green, cancellations fell)', () => {
    const d = computeFlippedDelta(0.05, 0.1);
    expect(d?.direction).toBe('up');
    expect(d?.value).toBe('-5.0pp');
  });

  it('Test 4: current 0.05 vs previous 0.05 → direction "flat"', () => {
    const d = computeFlippedDelta(0.05, 0.05);
    expect(d?.direction).toBe('flat');
    expect(d?.value).toBe('0pp');
  });

  it('Test 6 (helper-level): previous null → undefined (no fake delta)', () => {
    expect(computeFlippedDelta(0.1, null)).toBeUndefined();
    expect(computeFlippedDelta(0.1, undefined)).toBeUndefined();
  });
});

describe('<CancellationRateKpis>', () => {
  it('Test 1: renders 2 KpiCards with locked labels and FLIPPED delta', () => {
    useCancelMock.mockReturnValue({
      data: [
        {
          event_type: 'catalog_batch',
          total_count: 100,
          cancelled_count: 5,
          rate: 0.05,
          previous_rate: 0.05,
        },
        {
          event_type: 'portal_upload',
          total_count: 50,
          cancelled_count: 5,
          rate: 0.1,
          previous_rate: 0.05,
        },
      ],
      isLoading: false,
      error: null,
    });
    render(<CancellationRateKpis />);
    expect(screen.getByText('catalog_batch cancel rate')).toBeInTheDocument();
    expect(screen.getByText('portal_upload cancel rate')).toBeInTheDocument();
    // Values render — formatPercent(0.05*100) = '5.0%', formatPercent(0.1*100) = '10.0%'
    expect(screen.getByText('5.0%')).toBeInTheDocument();
    expect(screen.getByText('10.0%')).toBeInTheDocument();
    // portal_upload has +5.0pp delta (current 0.10 vs previous 0.05 — cancellations rose)
    expect(screen.getByText('+5.0pp')).toBeInTheDocument();
    // catalog_batch is flat (0.05 vs 0.05) — '0pp' is rendered
    expect(screen.getByText('0pp')).toBeInTheDocument();
  });

  it('Test 5: total_count=0 renders EMPTY value, no delta (no divide-by-zero)', () => {
    useCancelMock.mockReturnValue({
      data: [
        {
          event_type: 'catalog_batch',
          total_count: 0,
          cancelled_count: 0,
          rate: 0,
          previous_rate: null,
        },
        {
          event_type: 'portal_upload',
          total_count: 0,
          cancelled_count: 0,
          rate: 0,
          previous_rate: null,
        },
      ],
      isLoading: false,
      error: null,
    });
    render(<CancellationRateKpis />);
    // Both cards show '—' as the EMPTY value
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
    // No delta text present (no '...pp' anywhere)
    expect(screen.queryByText(/pp/)).not.toBeInTheDocument();
  });

  it('Test 6: previous_rate null → KpiCard renders without delta (no fake direction)', () => {
    useCancelMock.mockReturnValue({
      data: [
        {
          event_type: 'catalog_batch',
          total_count: 100,
          cancelled_count: 5,
          rate: 0.05,
          previous_rate: null,
        },
        {
          event_type: 'portal_upload',
          total_count: 50,
          cancelled_count: 5,
          rate: 0.1,
          previous_rate: null,
        },
      ],
      isLoading: false,
      error: null,
    });
    render(<CancellationRateKpis />);
    // Values render
    expect(screen.getByText('5.0%')).toBeInTheDocument();
    expect(screen.getByText('10.0%')).toBeInTheDocument();
    // No delta '+...pp' or '-...pp' or '0pp' strings anywhere
    expect(screen.queryByText(/pp/)).not.toBeInTheDocument();
  });

  it('Test 7: useCancellationRates.isLoading renders 2 KpiCard skeletons', () => {
    useCancelMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });
    render(<CancellationRateKpis />);
    // 2 KpiCard skeletons (one per event type)
    expect(screen.getAllByTestId('kpi-card')).toHaveLength(2);
    // Skeleton state has aria-busy="true"
    for (const card of screen.getAllByTestId('kpi-card')) {
      expect(card).toHaveAttribute('aria-busy', 'true');
    }
  });

  it('Test 8: error renders ErrorState with locked Phase 1 contract; Retry calls refetch', async () => {
    const refetch = vi.fn();
    useCancelMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('boom'),
      refetch,
    });
    render(<CancellationRateKpis />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      "Couldn't load cancellation rates",
    );
    await userEvent.click(screen.getByRole('button', { name: /Retry/i }));
    expect(refetch).toHaveBeenCalled();
  });
});
