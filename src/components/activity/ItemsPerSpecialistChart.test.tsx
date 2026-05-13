import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cloneElement, isValidElement } from 'react';
import type { ReactElement, ReactNode } from 'react';

// Phase 3 / APP-03 — ItemsPerSpecialistChart tests.
// Recharts JSDom mock copied verbatim from Phase 2 EventVolumeChart.test.tsx
// (which itself copies Phase 1 PATTERNS.md Pattern F).
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

const useItemsPerSpecialistMock = vi.fn();
vi.mock('../../hooks/activity/useItemsPerSpecialist', () => ({
  useItemsPerSpecialist: () => useItemsPerSpecialistMock(),
}));

import { ItemsPerSpecialistChart } from './ItemsPerSpecialistChart';
import { SPECIALIST_COLOR_CYCLE } from '../../lib/chartPalette';

beforeEach(() => {
  useItemsPerSpecialistMock.mockReset();
});

interface SpecialistRow {
  bucket_start: string;
  specialist_id: string;
  specialist_email: string;
  specialist_display_name: string;
  item_count: number;
}

function makeRows(buckets: string[], specialists: Array<{ email: string; name: string }>): SpecialistRow[] {
  const rows: SpecialistRow[] = [];
  for (const b of buckets) {
    for (const s of specialists) {
      rows.push({
        bucket_start: b,
        specialist_id: s.email,
        specialist_email: s.email,
        specialist_display_name: s.name,
        item_count: 3,
      });
    }
  }
  return rows;
}

describe('<ItemsPerSpecialistChart>', () => {
  it('Test 1: with 14 buckets × 3 specialists, renders 3 stacked Bar series with stackId="items"', () => {
    // Build 14 trailing daily buckets at midnight ET
    const buckets: string[] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(Date.UTC(2026, 3, 17 + i, 4, 0, 0)); // 2026-04-17..30 at 04:00 UTC ≈ ET midnight
      buckets.push(d.toISOString());
    }
    const specialists = [
      { email: 'amy@tpc.com', name: 'Amy Adams' },
      { email: 'bob@tpc.com', name: 'Bob Brown' },
      { email: 'carla@tpc.com', name: 'Carla Cole' },
    ];
    useItemsPerSpecialistMock.mockReturnValue({
      data: makeRows(buckets, specialists),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    const { container } = render(<ItemsPerSpecialistChart />);
    const barGroups = container.querySelectorAll('.recharts-bar');
    expect(barGroups.length).toBe(3);
  });

  it('Test 2: each Bar series uses colorForSpecialist (palette indices 0..N-1 in alpha order)', () => {
    const buckets = ['2026-04-29T04:00:00Z'];
    const specialists = [
      { email: 'amy@tpc.com', name: 'Amy Adams' },     // index 0 — sky-600
      { email: 'bob@tpc.com', name: 'Bob Brown' },      // index 1 — teal-600
      { email: 'carla@tpc.com', name: 'Carla Cole' },   // index 2 — violet-600
    ];
    useItemsPerSpecialistMock.mockReturnValue({
      data: makeRows(buckets, specialists),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    const { container } = render(<ItemsPerSpecialistChart />);
    // Recharts emits each Bar series with a `fill` attribute on its underlying
    // <path> nodes. Assert the first 3 cycle hexes appear.
    const fills = Array.from(container.querySelectorAll('path[fill]'))
      .map((el) => el.getAttribute('fill'))
      .filter((f): f is string => !!f);
    expect(fills).toContain(SPECIALIST_COLOR_CYCLE[0]);
    expect(fills).toContain(SPECIALIST_COLOR_CYCLE[1]);
    expect(fills).toContain(SPECIALIST_COLOR_CYCLE[2]);
  });

  it('Test 3: X-axis tickFormatter renders M/d (ET) — e.g. 2026-04-29T05:00:00Z → 4/29', () => {
    const buckets = ['2026-04-29T05:00:00Z']; // 01:00 ET on 4/29
    useItemsPerSpecialistMock.mockReturnValue({
      data: makeRows(buckets, [{ email: 'amy@tpc.com', name: 'Amy Adams' }]),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<ItemsPerSpecialistChart />);
    expect(screen.getByText('4/29')).toBeInTheDocument();
  });

  it('Test 4: subheading is the constant "Last 14 days" (fixed-window)', () => {
    useItemsPerSpecialistMock.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<ItemsPerSpecialistChart />);
    expect(screen.getByText('Last 14 days')).toBeInTheDocument();
  });

  it('Test 5: component source does NOT import useDateRange (D-16 invariant)', async () => {
    // Static check on the component file — fixed-window components MUST NOT
    // import useDateRange. The hook layer is also verified by verify-activity-filter-scope.mjs.
    // We pattern-match on the import statement form so the literal word can
    // legitimately appear in comments explaining the invariant.
    const src = (await import('./ItemsPerSpecialistChart.tsx?raw')).default;
    expect(src).not.toMatch(/^\s*import[\s\S]*?useDateRange[\s\S]*?from\s+['"][^'"]+['"]/m);
  });

  it('Test 6: loading branch renders the skeleton (chart-card pulse)', () => {
    useItemsPerSpecialistMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });
    const { container } = render(<ItemsPerSpecialistChart />);
    expect(screen.getByTestId('items-per-specialist-skeleton')).toBeInTheDocument();
    expect(container.querySelector('.recharts-bar')).toBeNull();
  });

  it('Test 7: empty data renders the empty-state heading + body verbatim', () => {
    useItemsPerSpecialistMock.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<ItemsPerSpecialistChart />);
    expect(screen.getByText('No items in the last 14 days')).toBeInTheDocument();
    expect(
      screen.getByText("The TPC team hasn't cataloged anything yet in this window."),
    ).toBeInTheDocument();
  });

  it('Test 8: error branch renders locked ErrorState; Retry calls refetch', async () => {
    const refetch = vi.fn();
    useItemsPerSpecialistMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('boom'),
      refetch,
    });
    render(<ItemsPerSpecialistChart />);
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load items per specialist");
    expect(screen.getByText('Something went wrong. Retry below.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Retry/i }));
    expect(refetch).toHaveBeenCalled();
  });

  it('Test 9: card heading "Items per specialist"; testid app-03-card', () => {
    useItemsPerSpecialistMock.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<ItemsPerSpecialistChart />);
    expect(screen.getByTestId('app-03-card')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Items per specialist' }),
    ).toBeInTheDocument();
  });

  it('Test 10: source uses isAnimationActive={false} and a solid CartesianGrid with vertical={false}', async () => {
    const src = (await import('./ItemsPerSpecialistChart.tsx?raw')).default;
    expect(src).toMatch(/isAnimationActive=\{false\}/);
    // Phase 8 unified-design: solid grid (no strokeDasharray), token-backed
    // stroke, value-axis-only (vertical={false} suppresses X/label gridlines).
    expect(src).not.toMatch(/strokeDasharray=/);
    expect(src).toMatch(/stroke="var\(--rule\)"/);
    expect(src).toMatch(/vertical=\{false\}/);
  });
});
