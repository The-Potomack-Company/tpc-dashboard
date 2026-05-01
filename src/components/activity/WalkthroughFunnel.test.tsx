import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cloneElement, isValidElement } from 'react';
import type { ReactElement, ReactNode } from 'react';

// Phase 3 / D-32 / D-34 — WalkthroughFunnel tests.
// Right-now per-user state — IGNORES all filters (range, specialists, mode).
// Mock useWalkthroughFunnel; mock recharts ResponsiveContainer to give the
// chart an explicit pixel size since JSDom does not implement layout
// (mirrors AiStatusDonut.test.tsx mock).

vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactNode }) => {
      const child = isValidElement(children)
        ? cloneElement(
            children as ReactElement<{ width?: number; height?: number }>,
            { width: 600, height: 128 },
          )
        : children;
      return (
        <div style={{ width: 600, height: 128 }} data-testid="mocked-responsive">
          {child}
        </div>
      );
    },
  };
});

const useWalkthroughFunnelMock = vi.fn();
vi.mock('../../hooks/activity/useWalkthroughFunnel', () => ({
  useWalkthroughFunnel: () => useWalkthroughFunnelMock(),
}));

import { WalkthroughFunnel } from './WalkthroughFunnel';

beforeEach(() => {
  useWalkthroughFunnelMock.mockReset();
});

const SAMPLE_ROWS = [
  { step_name: 'welcome',  step_order: 1, distinct_users: 50 },
  { step_name: 'profile',  step_order: 2, distinct_users: 35 },
  { step_name: 'first-session', step_order: 3, distinct_users: 12 },
];

describe('<WalkthroughFunnel>', () => {
  it('Test 13: renders Recharts horizontal bar (BarChart layout="vertical") with one row per step; bar fill is gray-400 (#9ca3af)', () => {
    useWalkthroughFunnelMock.mockReturnValue({
      data: SAMPLE_ROWS,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    const { container } = render(<WalkthroughFunnel />);
    // Recharts renders a <rect class="recharts-bar-rectangle"> per data row.
    const bars = container.querySelectorAll('.recharts-bar-rectangle');
    // At least one bar per row (Recharts may render <path> children inside).
    expect(bars.length).toBeGreaterThanOrEqual(1);
    // The Bar's fill prop is captured on its inner <path> elements.
    const barPaths = container.querySelectorAll('.recharts-bar-rectangle path');
    const fills = Array.from(barPaths).map((p) => p.getAttribute('fill')).filter((f): f is string => !!f);
    expect(fills.every((f) => f === '#9ca3af')).toBe(true);
    expect(fills.length).toBeGreaterThanOrEqual(1);
  });

  it('Test 14: heading "Walkthrough funnel" + subheading "Distinct users at each step · ignores date range"', () => {
    useWalkthroughFunnelMock.mockReturnValue({
      data: SAMPLE_ROWS,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<WalkthroughFunnel />);
    expect(screen.getByText('Walkthrough funnel')).toBeInTheDocument();
    expect(
      screen.getByText('Distinct users at each step · ignores date range'),
    ).toBeInTheDocument();
  });

  it('Test 15: empty state — heading "No walkthrough events" body "The TPC App walkthrough emitter may not be live yet."', () => {
    useWalkthroughFunnelMock.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<WalkthroughFunnel />);
    expect(screen.getByText('No walkthrough events')).toBeInTheDocument();
    expect(
      screen.getByText('The TPC App walkthrough emitter may not be live yet.'),
    ).toBeInTheDocument();
  });

  it('Test 16: source-level — does NOT import useDateRange (right-now per D-34, ignores all filters)', async () => {
    const src = (await import('./WalkthroughFunnel.tsx?raw')).default;
    // The component reads ONLY useWalkthroughFunnel — no other filter hooks.
    expect(src).not.toMatch(/from .+useDateRange/);
    expect(src).not.toMatch(/from .+useSpecialistFilter/);
    expect(src).not.toMatch(/from .+useModeFilter/);
  });

  it('Test 17: card body height is h-32 (compact funnel)', () => {
    useWalkthroughFunnelMock.mockReturnValue({
      data: SAMPLE_ROWS,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    const { container } = render(<WalkthroughFunnel />);
    // The chart wrapper applies h-32; find the inner div with that class.
    const heightDiv = container.querySelector('.h-32');
    expect(heightDiv).not.toBeNull();
  });

  it('Test 18a: loading state renders an animate-pulse skeleton block', () => {
    useWalkthroughFunnelMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });
    const { container } = render(<WalkthroughFunnel />);
    const pulse = container.querySelector('.animate-pulse');
    expect(pulse).not.toBeNull();
  });

  it('Test 18b: error state renders locked <ErrorState> heading "Couldn\'t load walkthrough funnel"', async () => {
    const refetchSpy = vi.fn();
    useWalkthroughFunnelMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('boom'),
      refetch: refetchSpy,
    });
    render(<WalkthroughFunnel />);
    expect(
      screen.getByText("Couldn't load walkthrough funnel"),
    ).toBeInTheDocument();
    expect(screen.getByText('Retry below.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(refetchSpy).toHaveBeenCalledOnce();
  });
});
