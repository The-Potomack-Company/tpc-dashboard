import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { KpiCard } from './KpiCard';

describe('<KpiCard>', () => {
  it('renders skeleton with animate-pulse when loading', () => {
    render(<KpiCard label="Sessions today" value={42} loading />);
    const card = screen.getByTestId('kpi-card');
    expect(card.getAttribute('aria-busy')).toBe('true');
    const skeletonValue = screen.getByTestId('kpi-card-skeleton-value');
    expect(skeletonValue.className).toContain('animate-pulse');
    // Value text must NOT be rendered in loading state
    expect(screen.queryByTestId('kpi-card-value')).toBeNull();
  });

  it('renders label and value text when not loading', () => {
    render(<KpiCard label="Sessions today" value={42} />);
    expect(screen.getByText('Sessions today')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-card-value').textContent).toBe('42');
  });

  it('renders string values without modification', () => {
    render(<KpiCard label="Revenue" value="$1,234" />);
    expect(screen.getByTestId('kpi-card-value').textContent).toBe('$1,234');
  });

  it('colors delta green on up direction', () => {
    render(
      <KpiCard
        label="Items"
        value={100}
        delta={{ value: '+12%', direction: 'up' }}
      />,
    );
    const delta = screen.getByTestId('kpi-card-delta');
    const span = delta.querySelector('span:first-child')!;
    expect(span.className).toContain('text-green');
    expect(span.textContent).toBe('+12%');
  });

  it('colors delta red on down direction', () => {
    render(
      <KpiCard
        label="Errors"
        value={5}
        delta={{ value: '-50%', direction: 'down' }}
      />,
    );
    const delta = screen.getByTestId('kpi-card-delta');
    const span = delta.querySelector('span:first-child')!;
    expect(span.className).toContain('text-red');
  });

  it('colors delta neutral gray on flat direction', () => {
    render(
      <KpiCard
        label="Items"
        value={100}
        delta={{ value: '0', direction: 'flat' }}
      />,
    );
    const delta = screen.getByTestId('kpi-card-delta');
    const span = delta.querySelector('span:first-child')!;
    expect(span.className).toContain('text-gray');
  });

  it('renders optional delta.label alongside the value', () => {
    render(
      <KpiCard
        label="Items"
        value={100}
        delta={{ value: '+12%', direction: 'up', label: 'vs last week' }}
      />,
    );
    expect(screen.getByText('vs last week')).toBeInTheDocument();
  });

  it('renders sparkline slot when sparkline prop is provided', () => {
    render(
      <KpiCard
        label="Items"
        value={100}
        sparkline={<div data-testid="test-spark">SPARK</div>}
      />,
    );
    const slot = screen.getByTestId('kpi-card-sparkline-slot');
    expect(slot).toBeInTheDocument();
    expect(slot.querySelector('[data-testid="test-spark"]')).not.toBeNull();
  });

  it('omits delta section when delta prop is absent', () => {
    render(<KpiCard label="Items" value={100} />);
    expect(screen.queryByTestId('kpi-card-delta')).toBeNull();
  });

  it('omits sparkline slot when sparkline prop is absent', () => {
    render(<KpiCard label="Items" value={100} />);
    expect(screen.queryByTestId('kpi-card-sparkline-slot')).toBeNull();
  });
});
