import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChartCard } from '../components/ChartCard';

// Phase 5 Plan 01 Task 3 — ChartCard contract locked by
// .planning/phases/05-trend-analysis/05-UI-SPEC.md § ChartCard component
// (lines 538-566). Pure layout wrapper — no Recharts dependency — so
// future non-Recharts visualizations (plan 05-06 heat map) can reuse it.

describe('ChartCard — title', () => {
  it('renders the title as an h2 with text-sm / font-semibold', () => {
    render(
      <ChartCard title="Net revenue per sale">
        <div>chart body</div>
      </ChartCard>,
    );
    const h = screen.getByRole('heading', {
      level: 2,
      name: 'Net revenue per sale',
    });
    expect(h).toBeInTheDocument();
    expect(h.className).toContain('text-sm');
    expect(h.className).toContain('font-semibold');
  });
});

describe('ChartCard — subtitle', () => {
  it('renders subtitle text when provided', () => {
    render(
      <ChartCard title="t" subtitle="Net revenue with 3-sale rolling trend">
        <div />
      </ChartCard>,
    );
    expect(
      screen.getByText('Net revenue with 3-sale rolling trend'),
    ).toBeInTheDocument();
  });

  it('does not render any subtitle <p> when subtitle is omitted', () => {
    const { container } = render(
      <ChartCard title="t">
        <div />
      </ChartCard>,
    );
    expect(container.querySelector('header p')).toBeNull();
  });
});

describe('ChartCard — action slot', () => {
  it('renders the action node inside the header when provided', () => {
    render(
      <ChartCard title="t" action={<button>Toggle</button>}>
        <div />
      </ChartCard>,
    );
    const btn = screen.getByRole('button', { name: 'Toggle' });
    expect(btn).toBeInTheDocument();
    // Action should be inside the <header>, not alongside the body.
    const header = btn.closest('header');
    expect(header).not.toBeNull();
  });

  it('does not render action when not provided', () => {
    const { container } = render(
      <ChartCard title="t">
        <div />
      </ChartCard>,
    );
    const header = container.querySelector('header');
    expect(header?.querySelector('button')).toBeNull();
  });
});

describe('ChartCard — height variant', () => {
  it('body wrapper uses h-80 by default (sm variant)', () => {
    const { container } = render(
      <ChartCard title="t">
        <div data-testid="body-child" />
      </ChartCard>,
    );
    const bodyChild = container.querySelector('[data-testid="body-child"]');
    const body = bodyChild?.parentElement;
    expect(body).not.toBeNull();
    expect((body as HTMLElement).className).toContain('h-80');
    expect((body as HTMLElement).className).not.toContain('h-[400px]');
  });

  it('body wrapper uses h-[400px] when height="lg"', () => {
    const { container } = render(
      <ChartCard title="t" height="lg">
        <div data-testid="body-child" />
      </ChartCard>,
    );
    const bodyChild = container.querySelector('[data-testid="body-child"]');
    const body = bodyChild?.parentElement;
    expect(body).not.toBeNull();
    expect((body as HTMLElement).className).toContain('h-[400px]');
    expect((body as HTMLElement).className).not.toContain('h-80');
  });
});

describe('ChartCard — children placement', () => {
  it('children render inside the mt-4 body wrapper', () => {
    const { container } = render(
      <ChartCard title="t">
        <span data-testid="chart">hello</span>
      </ChartCard>,
    );
    const chart = container.querySelector('[data-testid="chart"]');
    expect(chart).not.toBeNull();
    const body = chart?.parentElement;
    expect((body as HTMLElement).className).toContain('mt-4');
  });
});

describe('ChartCard — surface classes (shared with ChartSkeleton)', () => {
  it('outer element carries p-6 / rounded-lg / border / bg-white classes', () => {
    const { container } = render(
      <ChartCard title="t">
        <div />
      </ChartCard>,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain('p-6');
    expect(root.className).toContain('rounded-lg');
    expect(root.className).toContain('border');
    expect(root.className).toContain('bg-white');
    expect(root.className).toContain('dark:bg-gray-900');
  });

  it('outer element is a <section> (semantic, for landmark nav)', () => {
    const { container } = render(
      <ChartCard title="t">
        <div />
      </ChartCard>,
    );
    expect(container.firstChild?.nodeName).toBe('SECTION');
  });
});
