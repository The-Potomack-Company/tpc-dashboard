import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChartTooltip } from '../components/ChartTooltip';

// Phase 5 Plan 01 Task 2 — ChartTooltip contract locked by
// .planning/phases/05-trend-analysis/05-01-PLAN.md <behavior> block and
// 05-UI-SPEC.md § ChartTooltip component (lines 814-840).
//
// Recharts injects { active, label, payload } at runtime via <Tooltip
// content={<ChartTooltip ... />}>. Consumers supply headerFormatter
// (required) and valueFormatter (optional). When inactive or payload is
// empty, the component renders null — Recharts convention.

describe('ChartTooltip — active with payload', () => {
  it('renders header (via headerFormatter) and a row per payload entry', () => {
    const { container } = render(
      <ChartTooltip
        active
        label="2024-10-15"
        payload={[
          { name: 'Net revenue', value: 123456, dataKey: 'net', color: '#2563eb' },
          { name: '3-sale avg', value: 100000, dataKey: 'avg', color: '#0891b2' },
        ]}
        headerFormatter={(label) => `Header ${label}`}
        valueFormatter={(row) => `$${row.value}`}
      />,
    );
    expect(container.firstChild).not.toBeNull();
    expect(screen.getByText('Header 2024-10-15')).toBeInTheDocument();
    expect(screen.getByText('Net revenue:')).toBeInTheDocument();
    expect(screen.getByText('3-sale avg:')).toBeInTheDocument();
    expect(screen.getByText('$123456')).toBeInTheDocument();
    expect(screen.getByText('$100000')).toBeInTheDocument();
  });

  it('falls back to String(row.value) when valueFormatter is omitted', () => {
    render(
      <ChartTooltip
        active
        label="2024-10-15"
        payload={[{ name: 'Registered bidders', value: 42, dataKey: 'reg', color: '#2563eb' }]}
        headerFormatter={() => 'H'}
      />,
    );
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('header formatter receives the first payload row as the second argument', () => {
    render(
      <ChartTooltip
        active
        label="2024-10-15"
        payload={[{ name: 'Net revenue', value: 1, dataKey: 'net', color: '#2563eb', payload: { sale_number: '2024-045' } }]}
        headerFormatter={(label, first) =>
          `${label} · Sale ${first?.payload?.sale_number ?? '??'}`
        }
      />,
    );
    expect(screen.getByText('2024-10-15 · Sale 2024-045')).toBeInTheDocument();
  });
});

describe('ChartTooltip — inactive or empty renders null', () => {
  it('returns null when active is false', () => {
    const { container } = render(
      <ChartTooltip
        active={false}
        label="2024-10-15"
        payload={[{ name: 'x', value: 1, dataKey: 'x' }]}
        headerFormatter={() => 'H'}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('returns null when active is omitted (undefined)', () => {
    const { container } = render(
      <ChartTooltip
        payload={[{ name: 'x', value: 1, dataKey: 'x' }]}
        headerFormatter={() => 'H'}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('returns null when payload is empty array', () => {
    const { container } = render(
      <ChartTooltip active payload={[]} headerFormatter={() => 'H'} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('returns null when payload is undefined', () => {
    const { container } = render(
      <ChartTooltip active headerFormatter={() => 'H'} />,
    );
    expect(container.firstChild).toBeNull();
  });
});

describe('ChartTooltip — color dot uses row.color', () => {
  it('row dot carries inline backgroundColor matching the payload color', () => {
    const { container } = render(
      <ChartTooltip
        active
        label="2024-10-15"
        payload={[
          { name: 'Net revenue', value: 1, dataKey: 'net', color: '#2563eb' },
          { name: 'Trend', value: 2, dataKey: 'tr', color: '#0891b2' },
        ]}
        headerFormatter={() => 'H'}
      />,
    );
    const dots = container.querySelectorAll('span.w-2.h-2');
    expect(dots).toHaveLength(2);
    // jsdom lowercases hex and normalizes the inline style string.
    expect((dots[0] as HTMLElement).style.backgroundColor).toBe('rgb(37, 99, 235)');
    expect((dots[1] as HTMLElement).style.backgroundColor).toBe('rgb(8, 145, 178)');
  });
});

describe('ChartTooltip — UI-SPEC surface classes', () => {
  it('outer div carries the dark-surface classes from UI-SPEC line 817', () => {
    const { container } = render(
      <ChartTooltip
        active
        label="x"
        payload={[{ name: 'n', value: 1, dataKey: 'd', color: '#2563eb' }]}
        headerFormatter={() => 'H'}
      />,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain('px-3');
    expect(root.className).toContain('py-2');
    expect(root.className).toContain('rounded-lg');
    expect(root.className).toContain('bg-gray-900');
    expect(root.className).toContain('dark:bg-gray-100');
    expect(root.className).toContain('border');
    expect(root.className).toContain('shadow-lg');
  });

  it('value span has tabular-nums + ml-auto for right-aligned numeric column', () => {
    render(
      <ChartTooltip
        active
        label="x"
        payload={[{ name: 'n', value: 42, dataKey: 'd', color: '#2563eb' }]}
        headerFormatter={() => 'H'}
        valueFormatter={() => 'VAL'}
      />,
    );
    const val = screen.getByText('VAL');
    expect(val.className).toContain('tabular-nums');
    expect(val.className).toContain('ml-auto');
  });
});

describe('ChartTooltip — accessibility', () => {
  it('root is announced politely (aria-live=polite) so SR users hear hover changes', () => {
    const { container } = render(
      <ChartTooltip
        active
        label="x"
        payload={[{ name: 'n', value: 1, dataKey: 'd', color: '#2563eb' }]}
        headerFormatter={() => 'H'}
      />,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute('aria-live')).toBe('polite');
  });
});
