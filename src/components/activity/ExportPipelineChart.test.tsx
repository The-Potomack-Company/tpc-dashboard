import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cloneElement, isValidElement } from 'react';
import type { ReactElement, ReactNode } from 'react';

// Phase 3 / APP-05 — ExportPipelineChart tests.
// Recharts JSDom mock — sized for the 128px chart-card body (h-32) since
// ExportPipelineChart is a single horizontal bar (UI-SPEC § Spacing Scale).
vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactNode }) => {
      const child = isValidElement(children)
        ? cloneElement(
            children as ReactElement<{ width?: number; height?: number }>,
            { width: 800, height: 128 },
          )
        : children;
      return (
        <div style={{ width: 800, height: 128 }} data-testid="mocked-responsive">
          {child}
        </div>
      );
    },
  };
});

const useExportPipelineMock = vi.fn();
vi.mock('../../hooks/activity/useExportPipeline', () => ({
  useExportPipeline: () => useExportPipelineMock(),
}));

import { ExportPipelineChart } from './ExportPipelineChart';
import { SESSION_STATUS_COLOR } from '../../lib/chartPalette';

beforeEach(() => {
  useExportPipelineMock.mockReset();
});

const ROWS = [
  { status: 'active', session_count: 10 },
  { status: 'submitted', session_count: 6 },
  { status: 'returned', session_count: 2 },
  { status: 'exported', session_count: 8 },
  { status: 'completed', session_count: 14 },
];

describe('<ExportPipelineChart>', () => {
  it('Test 8: renders 5 stacked Bar series with stackId="pipeline" and SESSION_STATUS_COLOR fills', () => {
    useExportPipelineMock.mockReturnValue({
      data: ROWS,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    const { container } = render(<ExportPipelineChart />);
    const barGroups = container.querySelectorAll('.recharts-bar');
    expect(barGroups.length).toBe(5);
    const fills = Array.from(container.querySelectorAll('path[fill]'))
      .map((el) => el.getAttribute('fill'))
      .filter((f): f is string => !!f);
    expect(fills).toContain(SESSION_STATUS_COLOR.active);
    expect(fills).toContain(SESSION_STATUS_COLOR.submitted);
    expect(fills).toContain(SESSION_STATUS_COLOR.returned);
    expect(fills).toContain(SESSION_STATUS_COLOR.exported);
    expect(fills).toContain(SESSION_STATUS_COLOR.completed);
  });

  it('Test 9: card heading "Export pipeline"; subheading "Sessions by status · selected range"', () => {
    useExportPipelineMock.mockReturnValue({
      data: ROWS,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<ExportPipelineChart />);
    expect(screen.getByRole('heading', { name: 'Export pipeline' })).toBeInTheDocument();
    expect(screen.getByText('Sessions by status · selected range')).toBeInTheDocument();
  });

  it('Test 10: card body uses h-32 (NOT h-72 — single horizontal bar)', () => {
    useExportPipelineMock.mockReturnValue({
      data: ROWS,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<ExportPipelineChart />);
    expect(screen.getByTestId('export-pipeline-body').className).toMatch(/\bh-32\b/);
    expect(screen.getByTestId('export-pipeline-body').className).not.toMatch(/\bh-72\b/);
  });

  it('Test 11: empty (zero sessions) renders EmptyState verbatim', () => {
    useExportPipelineMock.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<ExportPipelineChart />);
    expect(screen.getByText('No sessions in this range')).toBeInTheDocument();
    expect(
      screen.getByText('Try widening the date range or clearing filters.'),
    ).toBeInTheDocument();
  });

  it('Test 12: loading renders the chart-card skeleton', () => {
    useExportPipelineMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });
    const { container } = render(<ExportPipelineChart />);
    expect(screen.getByTestId('export-pipeline-skeleton')).toBeInTheDocument();
    expect(container.querySelector('.recharts-bar')).toBeNull();
  });

  it('Test 13: error renders locked ErrorState; Retry calls refetch', async () => {
    const refetch = vi.fn();
    useExportPipelineMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('boom'),
      refetch,
    });
    render(<ExportPipelineChart />);
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load export pipeline");
    expect(screen.getByText('Retry below.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Retry/i }));
    expect(refetch).toHaveBeenCalled();
  });

  it('Test 14: NO locally-coined hex literals in the source — every color routes through SESSION_STATUS_COLOR', async () => {
    const src = (await import('./ExportPipelineChart.tsx?raw')).default;
    expect(src).not.toMatch(/#[0-9a-fA-F]{6}/);
  });

  it('Test 15: status order matches pipeline progression active → submitted → returned → exported → completed', async () => {
    const src = (await import('./ExportPipelineChart.tsx?raw')).default;
    // Single source-of-truth: the STATUS_ORDER constant declares the progression.
    // Recharts renders Bar children in JSX-source order — the constant order is
    // the rendering order. Multiline regex because the array spans 7 source lines.
    expect(src).toMatch(
      /STATUS_ORDER\s*=\s*\[[\s\S]*?'active'[\s\S]*?'submitted'[\s\S]*?'returned'[\s\S]*?'exported'[\s\S]*?'completed'[\s\S]*?\]/,
    );
  });
});
