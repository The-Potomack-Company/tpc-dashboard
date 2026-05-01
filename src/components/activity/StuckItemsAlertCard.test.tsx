import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router';
import type { ReactNode } from 'react';

// Phase 3 / APP-11 — StuckItemsAlertCard tests.
//
// 3 severity states from classifyStuckSeverity():
//   'none'   — N=0
//   'yellow' — N>=1 with oldest <= 6h
//   'red'    — oldest > 6h regardless of count
//
// + loading + error states. All states maintain min-h-[6rem] (D-22, no reflow).

const useStuckItemsMock = vi.fn();
vi.mock('../../hooks/activity/useStuckItems', () => ({
  useStuckItems: () => useStuckItemsMock(),
}));

import { StuckItemsAlertCard } from './StuckItemsAlertCard';

function Wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

beforeEach(() => {
  useStuckItemsMock.mockReset();
});

// Build a stuck-items row with controlled age_seconds + created_at offset.
function makeRow(overrides: Partial<Record<string, unknown>> = {}) {
  const ageSeconds = (overrides.age_seconds as number | undefined) ?? 3600;
  return {
    item_id: 'item-1',
    session_id: 'sess-1',
    session_name: 'Session 1',
    receipt_number: 'R-001',
    title: 'Item title',
    ai_status: 'pending',
    category: null,
    estimate: null,
    photo_paths: [],
    specialist_id: 'p1',
    specialist_display_name: 'Alice',
    age_seconds: ageSeconds,
    created_at: new Date(Date.now() - ageSeconds * 1000).toISOString(),
    ...overrides,
  };
}

describe('<StuckItemsAlertCard>', () => {
  it("Test 1: N=0 → 'none' state with quiet-success copy and no CTA", () => {
    useStuckItemsMock.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    const { container } = render(<StuckItemsAlertCard />, { wrapper: Wrapper });
    expect(screen.getByText('No stuck items')).toBeInTheDocument();
    expect(screen.getByText('Last checked just now.')).toBeInTheDocument();
    // No CTA link in 'none' state
    expect(screen.queryByRole('link')).toBeNull();
    // 'none' container: bg-white border border-gray-200, no left border
    const card = container.querySelector('[data-testid="app-11-card"]');
    expect(card).not.toBeNull();
    expect(card?.className).toMatch(/bg-white/);
    expect(card?.className).toMatch(/border-gray-200/);
    expect(card?.className).not.toMatch(/border-l-4/);
    // min-h-[6rem]
    expect(card?.className).toMatch(/min-h-\[6rem\]/);
  });

  it("Test 2: yellow state — 3 rows all <6h → amber tone + CTA", () => {
    useStuckItemsMock.mockReturnValue({
      data: [
        makeRow({ age_seconds: 1 * 3600 }),
        makeRow({ age_seconds: 2 * 3600 }),
        makeRow({ age_seconds: 3 * 3600 }),
      ],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    const { container } = render(<StuckItemsAlertCard />, { wrapper: Wrapper });
    expect(screen.getByText('3 stuck items')).toBeInTheDocument();
    // Body uses formatAge: oldest is 3h
    expect(screen.getByText('Oldest is 3h.')).toBeInTheDocument();
    // CTA
    const cta = screen.getByRole('link');
    expect(cta).toHaveTextContent('View 3 stuck items →');
    expect(cta.getAttribute('href')).toBe('/activity/stuck');
    // Yellow tone classes (amber)
    const card = container.querySelector('[data-testid="app-11-card"]');
    expect(card?.className).toMatch(/bg-amber-50/);
    expect(card?.className).toMatch(/border-amber-200/);
    expect(card?.className).toMatch(/border-l-4/);
    expect(card?.className).toMatch(/border-l-amber-500/);
  });

  it("Test 3: red state — 7 rows oldest at 8h → red tone + CTA + 'needs attention' body", () => {
    useStuckItemsMock.mockReturnValue({
      data: [
        makeRow({ age_seconds: 1 * 3600 }),
        makeRow({ age_seconds: 2 * 3600 }),
        makeRow({ age_seconds: 3 * 3600 }),
        makeRow({ age_seconds: 4 * 3600 }),
        makeRow({ age_seconds: 5 * 3600 }),
        makeRow({ age_seconds: 7 * 3600 }),
        makeRow({ age_seconds: 8 * 3600 }),
      ],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    const { container } = render(<StuckItemsAlertCard />, { wrapper: Wrapper });
    expect(screen.getByText('7 stuck items')).toBeInTheDocument();
    expect(
      screen.getByText('Oldest is 8h — needs attention.'),
    ).toBeInTheDocument();
    const cta = screen.getByRole('link');
    expect(cta).toHaveTextContent('View 7 stuck items →');
    expect(cta.getAttribute('href')).toBe('/activity/stuck');
    // Red tone classes
    const card = container.querySelector('[data-testid="app-11-card"]');
    expect(card?.className).toMatch(/bg-red-50/);
    expect(card?.className).toMatch(/border-red-200/);
    expect(card?.className).toMatch(/border-l-4/);
    expect(card?.className).toMatch(/border-l-red-500/);
  });

  it("Test 4: boundary — 5 rows, oldest exactly 6h → yellow (strict > on age)", () => {
    // Exactly 6h: 6 * 3600 = 21600 seconds
    useStuckItemsMock.mockReturnValue({
      data: [
        makeRow({ age_seconds: 6 * 3600 }),
        makeRow({ age_seconds: 5 * 3600 }),
        makeRow({ age_seconds: 4 * 3600 }),
        makeRow({ age_seconds: 3 * 3600 }),
        makeRow({ age_seconds: 2 * 3600 }),
      ],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    const { container } = render(<StuckItemsAlertCard />, { wrapper: Wrapper });
    // Should be YELLOW (classifier returns 'yellow' at exactly 6h)
    const card = container.querySelector('[data-testid="app-11-card"]');
    expect(card?.className).toMatch(/bg-amber-50/);
    expect(card?.className).not.toMatch(/bg-red-50/);
  });

  it("Test 5: boundary — 1 row, oldest at 6.0001h → red (any age > 6h flips red)", () => {
    // 6.0001h → 6.0001 * 3600 = 21600.36 seconds
    const ageSeconds = 6.0001 * 3600;
    useStuckItemsMock.mockReturnValue({
      data: [makeRow({ age_seconds: ageSeconds })],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    const { container } = render(<StuckItemsAlertCard />, { wrapper: Wrapper });
    const card = container.querySelector('[data-testid="app-11-card"]');
    expect(card?.className).toMatch(/bg-red-50/);
    expect(card?.className).not.toMatch(/bg-amber-50/);
  });

  it("Test 6: CTA href is '/activity/stuck' with NO preserved query params (D-23)", () => {
    useStuckItemsMock.mockReturnValue({
      data: [makeRow({ age_seconds: 3600 })],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<StuckItemsAlertCard />, { wrapper: Wrapper });
    const cta = screen.getByRole('link');
    expect(cta.getAttribute('href')).toBe('/activity/stuck');
    // Hard assertion: no query separator
    expect(cta.getAttribute('href')).not.toContain('?');
  });

  it("Test 7: min-h-[6rem] is present across all 4 states", () => {
    // none state
    useStuckItemsMock.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    let { container, unmount } = render(<StuckItemsAlertCard />, {
      wrapper: Wrapper,
    });
    let card = container.querySelector('[data-testid="app-11-card"]');
    expect(card?.className).toMatch(/min-h-\[6rem\]/);
    unmount();

    // yellow state
    useStuckItemsMock.mockReturnValue({
      data: [makeRow({ age_seconds: 3600 })],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    ({ container, unmount } = render(<StuckItemsAlertCard />, {
      wrapper: Wrapper,
    }));
    card = container.querySelector('[data-testid="app-11-card"]');
    expect(card?.className).toMatch(/min-h-\[6rem\]/);
    unmount();

    // red state
    useStuckItemsMock.mockReturnValue({
      data: [makeRow({ age_seconds: 8 * 3600 })],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    ({ container, unmount } = render(<StuckItemsAlertCard />, {
      wrapper: Wrapper,
    }));
    card = container.querySelector('[data-testid="app-11-card"]');
    expect(card?.className).toMatch(/min-h-\[6rem\]/);
    unmount();

    // loading state
    useStuckItemsMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });
    ({ container } = render(<StuckItemsAlertCard />, { wrapper: Wrapper }));
    card = container.querySelector('[data-testid="app-11-card"]');
    expect(card?.className).toMatch(/min-h-\[6rem\]/);
  });

  it("Test 8: loading state renders shimmer skeleton with motion-safe:animate-pulse", () => {
    useStuckItemsMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });
    const { container } = render(<StuckItemsAlertCard />, { wrapper: Wrapper });
    const card = container.querySelector('[data-testid="app-11-card"]');
    expect(card?.className).toMatch(/motion-safe:animate-pulse/);
    expect(card?.getAttribute('aria-busy')).toBe('true');
  });

  it("Test 9: error renders ErrorState (locked contract); maintains min-h-[6rem]", async () => {
    const refetch = vi.fn();
    useStuckItemsMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('boom'),
      refetch,
    });
    const user = userEvent.setup();
    const { container } = render(<StuckItemsAlertCard />, { wrapper: Wrapper });
    expect(screen.getByRole('alert')).toHaveTextContent(
      "Couldn't check for stuck items",
    );
    expect(screen.getByText('The query failed. Retry below.')).toBeInTheDocument();
    // min-h preserved
    const card = container.querySelector('[data-testid="app-11-card"]');
    expect(card?.className).toMatch(/min-h-\[6rem\]/);
    // Locked contract: only one Retry button
    const retryButtons = screen.getAllByRole('button', { name: /Retry/i });
    expect(retryButtons).toHaveLength(1);
    await user.click(retryButtons[0]);
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("Test 10: NO motion-safe:animate-pulse on the body when not loading (yellow state)", () => {
    useStuckItemsMock.mockReturnValue({
      data: [makeRow({ age_seconds: 3600 })],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    const { container } = render(<StuckItemsAlertCard />, { wrapper: Wrapper });
    const card = container.querySelector('[data-testid="app-11-card"]');
    expect(card?.className).not.toMatch(/motion-safe:animate-pulse/);
  });

  it("Test 11: 'none' uses clipboard icon (gray-400); yellow/red use exclamation-triangle (amber-600/red-600)", () => {
    // none
    useStuckItemsMock.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    let { container, unmount } = render(<StuckItemsAlertCard />, {
      wrapper: Wrapper,
    });
    let svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('class')).toMatch(/text-gray-400/);
    unmount();

    // yellow
    useStuckItemsMock.mockReturnValue({
      data: [makeRow({ age_seconds: 3600 })],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    ({ container, unmount } = render(<StuckItemsAlertCard />, {
      wrapper: Wrapper,
    }));
    svg = container.querySelector('svg');
    expect(svg?.getAttribute('class')).toMatch(/text-amber-600/);
    unmount();

    // red
    useStuckItemsMock.mockReturnValue({
      data: [makeRow({ age_seconds: 8 * 3600 })],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    ({ container } = render(<StuckItemsAlertCard />, { wrapper: Wrapper }));
    svg = container.querySelector('svg');
    expect(svg?.getAttribute('class')).toMatch(/text-red-600/);
  });
});
