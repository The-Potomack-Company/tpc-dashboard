import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KpiCard } from '../components/KpiCard';
import { KpiCardSkeleton } from '../components/KpiCardSkeleton';

// Phase 4 Plan 03 Task 2 — KpiCard + KpiCardSkeleton contracts locked by
// 04-UI-SPEC.md § Layout Specifications (lines 362–398) + § Copywriting
// Contract Delta semantics, and 04-RESEARCH.md § Code Examples Pattern 2
// (KpiCard consumer wiring) + § Pitfall 6 (sell-through uses percentage-points,
// not relative).

describe('KpiCard — up direction (currency)', () => {
  it('renders label, pre-formatted value, and ▲ glyph with green color class + Up aria-label including periodLabel', () => {
    const { container } = render(
      <KpiCard
        label="Total revenue"
        value="$1,234,567.89"
        current={1234567.89}
        previous={1000000}
        deltaType="relative"
        periodLabel="12mo"
      />,
    );
    expect(screen.getByText('Total revenue')).toBeInTheDocument();
    expect(screen.getByText('$1,234,567.89')).toBeInTheDocument();
    // Delta span carries aria-label with direction word + periodLabel
    const deltaSpan = container.querySelector('[aria-label]');
    expect(deltaSpan).not.toBeNull();
    const aria = deltaSpan?.getAttribute('aria-label') ?? '';
    expect(aria).toMatch(/^Up /);
    expect(aria).toContain('12mo');
    // Glyph + percentage appear in the span
    expect(deltaSpan?.textContent).toContain('▲');
    // 23.5% delta from 1000000 → 1234567.89
    expect(deltaSpan?.textContent).toMatch(/23\.5%/);
    // Green color class applied
    expect(deltaSpan?.className).toContain('text-green-600');
    expect(deltaSpan?.className).toContain('dark:text-green-500');
  });

  it('renders " vs previous 12mo" suffix in muted gray', () => {
    const { container } = render(
      <KpiCard
        label="Total revenue"
        value="$1,000,000.00"
        current={1500}
        previous={1000}
        deltaType="relative"
        periodLabel="12mo"
      />,
    );
    // Suffix text appears
    expect(container.textContent).toContain('vs previous 12mo');
    // Suffix span carries muted gray color
    const suffixes = Array.from(container.querySelectorAll('span')).filter((s) =>
      (s.textContent ?? '').includes('vs previous'),
    );
    expect(suffixes.length).toBeGreaterThan(0);
    expect(suffixes[0].className).toContain('text-gray-500');
    expect(suffixes[0].className).toContain('dark:text-gray-400');
  });
});

describe('KpiCard — down direction (percentage-points for sell-through)', () => {
  it('0.65 vs 0.71 type=percentage-points → ▼ 6.0pp red color + Down aria-label', () => {
    const { container } = render(
      <KpiCard
        label="Avg sell-through"
        value="65.0%"
        current={0.65}
        previous={0.71}
        deltaType="percentage-points"
        periodLabel="6mo"
      />,
    );
    const deltaSpan = container.querySelector('[aria-label]');
    expect(deltaSpan).not.toBeNull();
    expect(deltaSpan?.textContent).toContain('▼');
    expect(deltaSpan?.textContent).toMatch(/6\.0pp/);
    const aria = deltaSpan?.getAttribute('aria-label') ?? '';
    expect(aria).toMatch(/^Down /);
    expect(aria).toContain('6mo');
    expect(deltaSpan?.className).toContain('text-red-600');
    expect(deltaSpan?.className).toContain('dark:text-red-500');
  });
});

describe('KpiCard — no-baseline', () => {
  it('current=null previous=null → em-dash with gray color + "No baseline comparison" aria', () => {
    const { container } = render(
      <KpiCard
        label="Total revenue"
        value="—"
        current={null}
        previous={null}
        deltaType="relative"
        periodLabel="12mo"
      />,
    );
    const deltaSpan = container.querySelector('[aria-label]');
    expect(deltaSpan?.textContent?.trim()).toBe('—');
    expect(deltaSpan?.getAttribute('aria-label')).toBe('No baseline comparison');
    expect(deltaSpan?.className).toContain('text-gray-500');
    expect(deltaSpan?.className).toContain('dark:text-gray-400');
  });

  it('current=0 previous=0 type=relative → em-dash (divide-by-zero guard)', () => {
    const { container } = render(
      <KpiCard
        label="Total lots sold"
        value="0"
        current={0}
        previous={0}
        deltaType="relative"
        periodLabel="YTD"
      />,
    );
    const deltaSpan = container.querySelector('[aria-label]');
    expect(deltaSpan?.textContent?.trim()).toBe('—');
    expect(deltaSpan?.getAttribute('aria-label')).toBe('No baseline comparison');
  });

  it('no-baseline suppresses the " vs previous ..." suffix', () => {
    const { container } = render(
      <KpiCard
        label="Total revenue"
        value="—"
        current={null}
        previous={100}
        deltaType="relative"
        periodLabel="12mo"
      />,
    );
    expect(container.textContent).not.toContain('vs previous');
  });
});

describe('KpiCard — container shape + accessibility', () => {
  it('container has p-6, rounded-lg, border, min-h-[128px], space-y-2 classes', () => {
    const { container } = render(
      <KpiCard
        label="Total revenue"
        value="$0.00"
        current={0}
        previous={0}
        deltaType="relative"
        periodLabel="YTD"
      />,
    );
    const card = container.firstElementChild as HTMLElement;
    expect(card).not.toBeNull();
    const cls = card.className;
    expect(cls).toContain('p-6');
    expect(cls).toContain('rounded-lg');
    expect(cls).toContain('border');
    expect(cls).toContain('min-h-[128px]');
    expect(cls).toContain('space-y-2');
  });

  it('container is NOT focusable — no tabIndex and no role=button (UI-SPEC: not interactive)', () => {
    const { container } = render(
      <KpiCard
        label="Total revenue"
        value="$0.00"
        current={1500}
        previous={1000}
        deltaType="relative"
        periodLabel="12mo"
      />,
    );
    const card = container.firstElementChild as HTMLElement;
    expect(card.getAttribute('tabindex')).toBeNull();
    expect(card.getAttribute('role')).not.toBe('button');
    // Also must not be wrapped in an <a> or <button>
    expect(card.tagName).toBe('DIV');
  });

  it('value element uses text-2xl font-semibold tabular-nums classes', () => {
    const { container } = render(
      <KpiCard
        label="Total revenue"
        value="$1,234.00"
        current={1500}
        previous={1000}
        deltaType="relative"
        periodLabel="12mo"
      />,
    );
    const valueEl = screen.getByText('$1,234.00');
    expect(valueEl.className).toContain('text-2xl');
    expect(valueEl.className).toContain('font-semibold');
    expect(valueEl.className).toContain('tabular-nums');
    // Sanity — container contains this node
    expect(container.contains(valueEl)).toBe(true);
  });

  it('label element uses text-sm font-semibold classes', () => {
    render(
      <KpiCard
        label="Total revenue"
        value="$0.00"
        current={0}
        previous={0}
        deltaType="relative"
        periodLabel="YTD"
      />,
    );
    const labelEl = screen.getByText('Total revenue');
    expect(labelEl.className).toContain('text-sm');
    expect(labelEl.className).toContain('font-semibold');
  });
});

describe('KpiCardSkeleton', () => {
  it('renders three motion-safe:animate-pulse bars inside a p-6 min-h-[128px] container', () => {
    const { container } = render(<KpiCardSkeleton />);
    const card = container.firstElementChild as HTMLElement;
    const cls = card.className;
    expect(cls).toContain('p-6');
    expect(cls).toContain('rounded-lg');
    expect(cls).toContain('border');
    expect(cls).toContain('min-h-[128px]');
    expect(cls).toContain('space-y-2');

    const bars = container.querySelectorAll('.motion-safe\\:animate-pulse');
    expect(bars.length).toBe(3);
    // Bars use gray background shimmer pattern
    bars.forEach((bar) => {
      expect(bar.className).toContain('bg-gray-200');
      expect(bar.className).toContain('dark:bg-gray-700');
      expect(bar.className).toContain('rounded');
    });
  });

  it('shimmer bar widths follow the label → value → delta pattern (w-24 / w-32 / w-40)', () => {
    const { container } = render(<KpiCardSkeleton />);
    const bars = Array.from(
      container.querySelectorAll('.motion-safe\\:animate-pulse'),
    );
    expect(bars.length).toBe(3);
    expect(bars[0].className).toContain('h-3');
    expect(bars[0].className).toContain('w-24');
    expect(bars[1].className).toContain('h-4');
    expect(bars[1].className).toContain('w-32');
    expect(bars[2].className).toContain('h-3');
    expect(bars[2].className).toContain('w-40');
  });
});
