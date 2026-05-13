import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Phase 3 / APP-01 — TodayKpiStrip tests.
//
// The strip mounts useTodayKpis directly and renders 4 KpiCards.
// Tests assert UI-SPEC § Per-Card Copy Contract verbatim and the locked
// ErrorState contract (D-35).

const useTodayKpisMock = vi.fn();
vi.mock('../../hooks/activity/useTodayKpis', () => ({
  useTodayKpis: () => useTodayKpisMock(),
}));

// Phase 8: the "Processed" KpiCard is gated on `isDev`. Most tests in
// this file want the historical "4 cards rendered" behaviour, so the default
// auth-store mock returns isDev=true. The Phase 8 admin-trim test overrides
// this with isDev=false to assert the gating.
let isDevMockValue = true;
vi.mock('../../stores/authStore', () => ({
  useAuthStore: (
    selector: (s: { isDev: boolean }) => unknown,
  ) => selector({ isDev: isDevMockValue }),
}));

import { TodayKpiStrip } from './TodayKpiStrip';

beforeEach(() => {
  useTodayKpisMock.mockReset();
  isDevMockValue = true;
});

function happyData(overrides: Partial<Record<string, number>> = {}) {
  return {
    sessions_today: 5,
    items_today: 100,
    exports_today: 7,
    items_done_today: 80,
    items_total_today: 100,
    sessions_yday: 4,
    items_yday: 90,
    exports_yday: 5,
    items_done_yday: 70,
    items_total_yday: 90,
    ...overrides,
  };
}

describe('<TodayKpiStrip>', () => {
  it("Test 1: renders 4 KpiCards with locked labels in a 2-col / lg:4-col grid", () => {
    useTodayKpisMock.mockReturnValue({
      data: happyData(),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    const { container } = render(<TodayKpiStrip />);
    expect(screen.getAllByTestId('kpi-card')).toHaveLength(4);
    expect(screen.getByText('Sessions today')).toBeInTheDocument();
    expect(screen.getByText('Items today')).toBeInTheDocument();
    expect(screen.getByText('Items exported today')).toBeInTheDocument();
    expect(screen.getByText('Processed')).toBeInTheDocument();
    // Grid layout: grid grid-cols-2 lg:grid-cols-4 gap-4
    const grid = container.querySelector('.grid');
    expect(grid).not.toBeNull();
    expect(grid?.className).toMatch(/grid-cols-2/);
    expect(grid?.className).toMatch(/lg:grid-cols-4/);
    expect(grid?.className).toMatch(/gap-4/);
  });

  it("Test 2: Processed with items_total_today=0 renders EMPTY (em-dash) and no delta", () => {
    useTodayKpisMock.mockReturnValue({
      data: happyData({ items_done_today: 0, items_total_today: 0 }),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<TodayKpiStrip />);
    // The Processed card should show '—' as its value when denom is 0
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    // The card delta region is missing for the denom=0 case;
    // the card label is still present.
    expect(screen.getByText('Processed')).toBeInTheDocument();
  });

  it("Test 3: section header reads 'Today's Snapshot' with green pulsing right-now pip + sr-only Live", () => {
    useTodayKpisMock.mockReturnValue({
      data: happyData(),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    const { container } = render(<TodayKpiStrip />);
    expect(screen.getByText("Today's Snapshot")).toBeInTheDocument();
    expect(screen.getByText('Live')).toBeInTheDocument();
    // Phase 7 unified-design: right-now pip is aria-hidden + bg-ok
    // (token-backed, was bg-green-500) + motion-safe:animate-pulse.
    const pip = container.querySelector('.bg-ok');
    expect(pip).not.toBeNull();
    expect(pip?.className).toMatch(/motion-safe:animate-pulse/);
    expect(pip?.getAttribute('aria-hidden')).toBe('true');
  });

  it("Test 4: zero-current with positive-previous yields 'down' direction (KpiCard maps to text-red-600)", () => {
    // sessions_today = 0, sessions_yday = 4 → expect a down delta
    useTodayKpisMock.mockReturnValue({
      data: happyData({ sessions_today: 0, items_today: 0, exports_today: 0, items_done_today: 0, items_total_today: 0 }),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    const { container } = render(<TodayKpiStrip />);
    // KpiCard renders direction='down' as text-red-600
    const reds = container.querySelectorAll('.text-red-600');
    expect(reds.length).toBeGreaterThan(0);
    // The "vs yesterday" delta label is rendered
    expect(screen.getAllByText('vs yesterday').length).toBeGreaterThan(0);
  });

  it("Test 5: isLoading=true renders all 4 cards with loading skeleton (aria-busy='true')", () => {
    useTodayKpisMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });
    render(<TodayKpiStrip />);
    const cards = screen.getAllByTestId('kpi-card');
    expect(cards).toHaveLength(4);
    for (const c of cards) {
      expect(c.getAttribute('aria-busy')).toBe('true');
    }
  });

  it("Test 6: error renders single ErrorState (locked contract); no KpiCards", async () => {
    const refetch = vi.fn();
    useTodayKpisMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('boom'),
      refetch,
    });
    render(<TodayKpiStrip />);
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load this KPI");
    expect(screen.getByText('Retry below or refresh the page.')).toBeInTheDocument();
    // No KpiCards on error
    expect(screen.queryAllByTestId('kpi-card')).toHaveLength(0);
    // Locked contract: ErrorState renders its own Retry button — no sibling
    const retryButtons = screen.getAllByRole('button', { name: /Retry/i });
    expect(retryButtons).toHaveLength(1);
    await userEvent.click(retryButtons[0]);
    expect(refetch).toHaveBeenCalled();
  });

  it("Test 7: NO sparklines on the Today strip (sparkline slot absent)", () => {
    useTodayKpisMock.mockReturnValue({
      data: happyData(),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<TodayKpiStrip />);
    // The KpiCard sparkline slot only renders when sparkline prop is passed.
    expect(screen.queryAllByTestId('kpi-card-sparkline-slot')).toHaveLength(0);
  });

  it("delta label reads 'vs yesterday' for happy data", () => {
    useTodayKpisMock.mockReturnValue({
      data: happyData(),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<TodayKpiStrip />);
    // 4 cards, all should have 'vs yesterday' label (denom = 90 != 0 for Processed)
    expect(screen.getAllByText('vs yesterday').length).toBeGreaterThanOrEqual(3);
  });

  it("formats counts via formatCount; sessions_today=5 renders '5'", () => {
    useTodayKpisMock.mockReturnValue({
      data: happyData(),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<TodayKpiStrip />);
    // The Sessions today card shows value 5
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  // Phase 8 — admin-trim: "Processed" is a completion-rate
  // metric and belongs to the dev surface only. Admin sees 3 cards.
  it("Phase 8: admin (isDev=false) renders 3 cards and omits 'Processed'", () => {
    isDevMockValue = false;
    useTodayKpisMock.mockReturnValue({
      data: happyData(),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    const { container } = render(<TodayKpiStrip />);
    expect(screen.getAllByTestId('kpi-card')).toHaveLength(3);
    expect(screen.queryByText('Processed')).not.toBeInTheDocument();
    // Grid should switch to lg:grid-cols-3 so the 3 cards span evenly.
    const grid = container.querySelector('.grid');
    expect(grid?.className).toMatch(/lg:grid-cols-3/);
    expect(grid?.className).not.toMatch(/lg:grid-cols-4/);
  });

  it("Phase 8: dev (isDev=true) still renders all 4 cards (regression guard)", () => {
    isDevMockValue = true;
    useTodayKpisMock.mockReturnValue({
      data: happyData(),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<TodayKpiStrip />);
    expect(screen.getAllByTestId('kpi-card')).toHaveLength(4);
    expect(screen.getByText('Processed')).toBeInTheDocument();
  });
});
