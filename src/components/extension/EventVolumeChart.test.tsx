import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cloneElement, isValidElement } from 'react';
import type { ReactElement, ReactNode } from 'react';

// Phase 2 / EXT-01 — EventVolumeChart tests.
//
// Recharts mock pattern is verbatim from src/components/kit/Sparkline.test.tsx
// lines 13-32 (Phase 1 PATTERNS.md Pattern F). JSDom doesn't implement layout,
// so ResponsiveContainer must inject explicit width/height onto its child chart.
// Cloned dimensions match the chart-card body height of `h-72` = 288px.
vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactNode }) => {
      const child = isValidElement(children)
        ? cloneElement(
            children as ReactElement<{ width?: number; height?: number }>,
            { width: 800, height: 288 },
          )
        : children;
      return (
        <div style={{ width: 800, height: 288 }} data-testid="mocked-responsive">
          {child}
        </div>
      );
    },
  };
});

const useEventVolumeMock = vi.fn();
const useDateRangeMock = vi.fn();
vi.mock('../../hooks/extension/useEventVolume', () => ({
  useEventVolume: () => useEventVolumeMock(),
}));
vi.mock('../../hooks/useDateRange', () => ({
  useDateRange: () => useDateRangeMock(),
}));

import { EventVolumeChart } from './EventVolumeChart';

beforeEach(() => {
  useEventVolumeMock.mockReset();
  useDateRangeMock.mockReset();
  useDateRangeMock.mockReturnValue({
    range: '7d',
    from: new Date('2026-04-23T00:00:00Z'),
    to: new Date('2026-04-30T00:00:00Z'),
    setRange: vi.fn(),
    setCustom: vi.fn(),
  });
});

function makeVolumeRows(buckets: string[]): Array<{
  bucket_start: string;
  event_type: string;
  event_count: number;
}> {
  const types = [
    'catalog_single',
    'catalog_batch',
    'portal_upload',
    'spreadsheet_transform',
    'data_import',
  ];
  const rows: Array<{ bucket_start: string; event_type: string; event_count: number }> = [];
  for (const b of buckets) {
    for (const t of types) {
      rows.push({ bucket_start: b, event_type: t, event_count: 3 });
    }
  }
  return rows;
}

describe('<EventVolumeChart>', () => {
  it('Test 1: renders 5 stacked Bar elements with stackId="events"', () => {
    const buckets = ['2026-04-23T00:00:00Z', '2026-04-24T00:00:00Z'];
    useEventVolumeMock.mockReturnValue({
      data: makeVolumeRows(buckets),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    const { container } = render(<EventVolumeChart />);
    // 5 series → at least 5 rendered bar groups; each Bar element has class
    // "recharts-bar". Recharts renders one <g class="recharts-bar"> per Bar.
    const barGroups = container.querySelectorAll('.recharts-bar');
    expect(barGroups.length).toBe(5);
  });

  it('Test 2: loading branch renders skeleton, NOT the BarChart', () => {
    useEventVolumeMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });
    const { container } = render(<EventVolumeChart />);
    expect(screen.getByTestId('event-volume-skeleton')).toBeInTheDocument();
    // No BarChart render
    expect(container.querySelector('.recharts-bar')).toBeNull();
  });

  it('Test 3: empty data renders the empty-state copy "No events in this range"', () => {
    useEventVolumeMock.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<EventVolumeChart />);
    expect(screen.getByText('No events in this range')).toBeInTheDocument();
  });

  it('Test 4: error branch renders ErrorState (locked contract); Retry calls refetch', async () => {
    const refetch = vi.fn();
    useEventVolumeMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('boom'),
      refetch,
    });
    render(<EventVolumeChart />);
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load event volume");
    expect(
      screen.getByText('Something went wrong loading the chart. Retry below.'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Retry/i }));
    expect(refetch).toHaveBeenCalled();
  });

  it('Test 5: tickFormatter for range=today produces an H A token (e.g. "2 PM")', () => {
    useDateRangeMock.mockReturnValue({
      range: 'today',
      from: new Date('2026-04-30T00:00:00Z'),
      to: new Date('2026-04-30T23:59:59Z'),
      setRange: vi.fn(),
      setCustom: vi.fn(),
    });
    // Use a single bucket at 18:00 UTC = 2 PM ET (during EDT, UTC-4)
    useEventVolumeMock.mockReturnValue({
      data: makeVolumeRows(['2026-04-30T18:00:00Z']),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<EventVolumeChart />);
    // The XAxis tick text contains an AM/PM token rather than M/D.
    expect(screen.getByText(/\d{1,2}\s?(AM|PM)/i)).toBeInTheDocument();
  });

  it('Test 6: defensive — catalog_item rows are NOT rendered as a series', () => {
    const buckets = ['2026-04-23T00:00:00Z'];
    const base = makeVolumeRows(buckets);
    // Inject an off-vocabulary event_type that the RPC must never emit.
    base.push({
      bucket_start: '2026-04-23T00:00:00Z',
      event_type: 'catalog_item',
      event_count: 99,
    });
    useEventVolumeMock.mockReturnValue({
      data: base,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    const { container } = render(<EventVolumeChart />);
    // Still exactly 5 bar groups — catalog_item dropped by pivotForRecharts
    const barGroups = container.querySelectorAll('.recharts-bar');
    expect(barGroups.length).toBe(5);
    // The catalog_item literal must not appear in the legend either
    expect(screen.queryByText('catalog_item')).toBeNull();
  });
});
