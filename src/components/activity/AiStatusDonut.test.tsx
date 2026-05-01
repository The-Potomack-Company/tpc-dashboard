import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cloneElement, isValidElement } from 'react';
import type { ReactElement, ReactNode } from 'react';

// Phase 3 / APP-04 — AiStatusDonut tests.
// Recharts mock injects explicit width/height into the chart child since
// JSDom does not implement layout. Sized for the 288px chart-card body.
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

const useAiStatusDistributionMock = vi.fn();
vi.mock('../../hooks/activity/useAiStatusDistribution', () => ({
  useAiStatusDistribution: () => useAiStatusDistributionMock(),
}));

import { AiStatusDonut } from './AiStatusDonut';
import { AI_STATUS_COLOR } from '../../lib/chartPalette';

beforeEach(() => {
  useAiStatusDistributionMock.mockReset();
});

const FULL_ROWS = [
  { ai_status: 'pending', item_count: 5 },
  { ai_status: 'processing', item_count: 3 },
  { ai_status: 'queued', item_count: 2 },
  { ai_status: 'done', item_count: 70 },
  { ai_status: 'failed', item_count: 20 },
];

describe('<AiStatusDonut>', () => {
  it('Test 11: renders 5 Cells inside the Pie with fills matching AI_STATUS_COLOR', () => {
    useAiStatusDistributionMock.mockReturnValue({
      data: FULL_ROWS,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    const { container } = render(<AiStatusDonut />);
    // Recharts renders one <path class="recharts-sector"> per Cell.
    const sectors = container.querySelectorAll('.recharts-sector');
    expect(sectors.length).toBe(5);
    const fills = Array.from(sectors)
      .map((el) => el.getAttribute('fill'))
      .filter((f): f is string => !!f);
    expect(fills).toContain(AI_STATUS_COLOR.pending);
    expect(fills).toContain(AI_STATUS_COLOR.processing);
    expect(fills).toContain(AI_STATUS_COLOR.queued);
    expect(fills).toContain(AI_STATUS_COLOR.done);
    expect(fills).toContain(AI_STATUS_COLOR.failed);
  });

  it('Test 12: failed Cell uses outerRadius="85%" — verified at the source level (Recharts renders absolute pixels at runtime)', async () => {
    // Per-Cell `outerRadius` on a string-percent value is a Recharts feature,
    // but the rendered SVG path uses absolute pixels at runtime — there's no
    // stable DOM attribute to assert. Verify the contract at the source level
    // via Vite's `?raw` import.
    const src = (await import('./AiStatusDonut.tsx?raw')).default;
    expect(src).toMatch(/slice\.name === 'failed' \? '85%' : '80%'/);
  });

  it('Test 13: center label renders {X}% (Math.round(done/total*100)) and "AI done"', () => {
    // 70 done out of 5+3+2+70+20 = 100 → 70%
    useAiStatusDistributionMock.mockReturnValue({
      data: FULL_ROWS,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<AiStatusDonut />);
    expect(screen.getByText('70%')).toBeInTheDocument();
    expect(screen.getByText('AI done')).toBeInTheDocument();
  });

  it('Test 14: when total=0, renders EmptyState in the card body (NOT a zero-arc)', () => {
    useAiStatusDistributionMock.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    const { container } = render(<AiStatusDonut />);
    expect(screen.getByText('No items in this range')).toBeInTheDocument();
    expect(screen.getByText('Try widening the date range.')).toBeInTheDocument();
    // No PieChart rendered
    expect(container.querySelector('.recharts-sector')).toBeNull();
    // Center label is absent
    expect(screen.queryByTestId('ai-status-center-label')).toBeNull();
  });

  it('Test 15: subheading reads "Items created in selected range"', () => {
    useAiStatusDistributionMock.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<AiStatusDonut />);
    expect(screen.getByText('Items created in selected range')).toBeInTheDocument();
  });

  it('Test 16: card heading "AI status"; testid app-04-card', () => {
    useAiStatusDistributionMock.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<AiStatusDonut />);
    expect(screen.getByTestId('app-04-card')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'AI status' })).toBeInTheDocument();
  });

  it('Test 17: AiStatusDonut is range-driven via useAiStatusDistribution (the hook reads useDateRange — verified in its own test)', () => {
    // The donut never imports useDateRange directly — that contract lives
    // in the hook layer (src/hooks/activity/useAiStatusDistribution.ts).
    // Smoke test: rendering the component invokes the mocked hook.
    useAiStatusDistributionMock.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<AiStatusDonut />);
    expect(useAiStatusDistributionMock).toHaveBeenCalled();
  });

  it('Test 18a: loading renders the skeleton', () => {
    useAiStatusDistributionMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });
    render(<AiStatusDonut />);
    expect(screen.getByTestId('ai-status-skeleton')).toBeInTheDocument();
  });

  it('Test 18b: error branch renders locked ErrorState; Retry calls refetch', async () => {
    const refetch = vi.fn();
    useAiStatusDistributionMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('boom'),
      refetch,
    });
    render(<AiStatusDonut />);
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load AI status");
    expect(screen.getByText('Retry below.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Retry/i }));
    expect(refetch).toHaveBeenCalled();
  });

  it('Test 19: NO locally-coined hex literals in the source — every color routes through AI_STATUS_COLOR', async () => {
    const src = (await import('./AiStatusDonut.tsx?raw')).default;
    expect(src).not.toMatch(/#[0-9a-fA-F]{6}/);
  });
});
