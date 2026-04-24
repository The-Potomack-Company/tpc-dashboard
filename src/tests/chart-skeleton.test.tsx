import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChartSkeleton } from '../components/ChartSkeleton';

// Phase 5 Plan 01 Task 3 — ChartSkeleton contract locked by
// .planning/phases/05-trend-analysis/05-UI-SPEC.md § ChartSkeleton
// component (lines 842-853). The shape matches ChartCard exactly so the
// skeleton → chart swap produces no layout shift.

describe('ChartSkeleton — default height (sm)', () => {
  it('renders the outer card with padding/border/bg from UI-SPEC', () => {
    const { container } = render(<ChartSkeleton />);
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain('p-6');
    expect(root.className).toContain('rounded-lg');
    expect(root.className).toContain('border');
    expect(root.className).toContain('bg-white');
    expect(root.className).toContain('dark:bg-gray-900');
  });

  it('body placeholder uses h-80 (matches h-80 chart body) by default', () => {
    const { container } = render(<ChartSkeleton />);
    const body = container.querySelector('[aria-label="Loading chart"]');
    expect(body).not.toBeNull();
    expect((body as HTMLElement).className).toContain('h-80');
    expect((body as HTMLElement).className).not.toContain('h-[400px]');
  });

  it('all three bars are wrapped in motion-safe:animate-pulse', () => {
    const { container } = render(<ChartSkeleton />);
    const pulsing = container.querySelectorAll('.motion-safe\\:animate-pulse');
    expect(pulsing.length).toBe(3);
  });
});

describe('ChartSkeleton — lg height variant', () => {
  it('body placeholder uses h-[400px] when height="lg" (heat-map surface)', () => {
    const { container } = render(<ChartSkeleton height="lg" />);
    const body = container.querySelector('[aria-label="Loading chart"]');
    expect(body).not.toBeNull();
    expect((body as HTMLElement).className).toContain('h-[400px]');
    expect((body as HTMLElement).className).not.toContain('h-80');
  });
});

describe('ChartSkeleton — accessibility', () => {
  it('body carries aria-label="Loading chart" so SR users hear loading state', () => {
    render(<ChartSkeleton />);
    expect(screen.getByLabelText('Loading chart')).toBeInTheDocument();
  });
});
