import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { cloneElement, isValidElement } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { Sparkline } from './Sparkline';

// JSDom does not implement layout — clientWidth/Height return 0, so Recharts
// `<ResponsiveContainer>` would never reach a positive size and the inner
// `<svg>` never renders. Mock ResponsiveContainer to inject explicit
// width/height props onto its child chart so the chart can size itself
// without relying on layout measurement. The component under test still
// imports the real ResponsiveContainer in production.
vi.mock('recharts', async () => {
  const actual =
    await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactNode }) => {
      const child = isValidElement(children)
        ? cloneElement(children as ReactElement<{ width?: number; height?: number }>, {
            width: 200,
            height: 32,
          })
        : children;
      return (
        <div style={{ width: 200, height: 32 }} data-testid="mocked-responsive">
          {child}
        </div>
      );
    },
  };
});

describe('<Sparkline>', () => {
  // Even with the mock, Sparkline's own outer <div> still receives the props.
  // We don't need a parent-size wrapper anymore — leaving it for clarity.
  function withParentSize(children: ReactNode) {
    return (
      <div style={{ width: 200, height: 40 }}>
        {children}
      </div>
    );
  }

  it('renders a container div with default width/height', () => {
    render(withParentSize(<Sparkline data={[]} />));
    const container = screen.getByTestId('sparkline');
    expect(container).toBeInTheDocument();
    // height default = 32, width default = '100%'
    expect(container.style.height).toBe('32px');
    expect(container.style.width).toBe('100%');
  });

  it('renders an SVG path when given non-empty data', () => {
    const { container: domContainer } = render(
      withParentSize(
        <Sparkline
          data={[
            { x: 1, y: 5 },
            { x: 2, y: 10 },
            { x: 3, y: 7 },
          ]}
        />,
      ),
    );
    const container = screen.getByTestId('sparkline');
    // Recharts renders an <svg> inside ResponsiveContainer with at least one
    // <path> (the Line). Search both the sparkline subtree and the wider
    // render output as a defensive fallback against future portal changes.
    const svg = container.querySelector('svg') ?? domContainer.querySelector('svg');
    expect(svg).not.toBeNull();
    const paths = svg!.querySelectorAll('path');
    expect(paths.length).toBeGreaterThan(0);
  });

  it('does NOT render axis / grid / tooltip elements (D-12 bare minimal)', () => {
    render(
      withParentSize(
        <Sparkline
          data={[
            { x: 1, y: 5 },
            { x: 2, y: 10 },
          ]}
        />,
      ),
    );
    const container = screen.getByTestId('sparkline');
    // Recharts applies class names like `recharts-cartesian-axis`, `recharts-cartesian-grid`,
    // `recharts-tooltip-wrapper`. None of these should appear.
    expect(container.querySelector('.recharts-cartesian-axis')).toBeNull();
    expect(container.querySelector('.recharts-cartesian-grid')).toBeNull();
    expect(container.querySelector('.recharts-tooltip-wrapper')).toBeNull();
  });

  it('renders without throwing on empty data array', () => {
    expect(() =>
      render(withParentSize(<Sparkline data={[]} />)),
    ).not.toThrow();
  });

  it('applies custom className to the container', () => {
    render(withParentSize(<Sparkline data={[]} className="text-emerald-500 custom-sparkline" />));
    const container = screen.getByTestId('sparkline');
    expect(container.className).toContain('text-emerald-500');
    expect(container.className).toContain('custom-sparkline');
  });

  it('applies custom height and width props', () => {
    render(withParentSize(<Sparkline data={[]} width={120} height={50} />));
    const container = screen.getByTestId('sparkline');
    expect(container.style.height).toBe('50px');
    expect(container.style.width).toBe('120px');
  });
});
