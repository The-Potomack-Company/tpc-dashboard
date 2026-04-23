import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeptRankingMetricToggle } from './DeptRankingMetricToggle';

// Phase 6 Plan 06-02 — DeptRankingMetricToggle contract locked by
// 06-UI-SPEC.md § DeptRankingMetricToggle + § Copywriting → /departments page.
// Mirrors MetricToggle's WAI-ARIA radiogroup pattern with 3 options and a
// roving tabindex.

describe('DeptRankingMetricToggle — render + structure', () => {
  it('T1: renders 3 radios with exact labels and container aria-label', () => {
    render(
      <DeptRankingMetricToggle value="revenue" onChange={() => {}} />,
    );
    const group = screen.getByRole('radiogroup', {
      name: 'Select ranking metric',
    });
    expect(group).toBeInTheDocument();

    const options = screen.getAllByRole('radio');
    expect(options).toHaveLength(3);
    expect(options[0].textContent).toBe('Revenue');
    expect(options[1].textContent).toBe('Sell-through');
    expect(options[2].textContent).toBe('Lots above estimate');
  });

  it('T2: aria-checked="true" only on the matching radio; others "false"', () => {
    render(
      <DeptRankingMetricToggle
        value="sell_through"
        onChange={() => {}}
      />,
    );
    const revenue = screen.getByRole('radio', { name: 'Revenue' });
    const sellThrough = screen.getByRole('radio', { name: 'Sell-through' });
    const lots = screen.getByRole('radio', { name: 'Lots above estimate' });
    expect(revenue.getAttribute('aria-checked')).toBe('false');
    expect(sellThrough.getAttribute('aria-checked')).toBe('true');
    expect(lots.getAttribute('aria-checked')).toBe('false');

    // Roving tabindex — only the active one is 0.
    expect(revenue.getAttribute('tabindex')).toBe('-1');
    expect(sellThrough.getAttribute('tabindex')).toBe('0');
    expect(lots.getAttribute('tabindex')).toBe('-1');
  });

  it('T3: clicking a radio fires onChange with the correct value', () => {
    const onChange = vi.fn();
    render(
      <DeptRankingMetricToggle value="revenue" onChange={onChange} />,
    );
    fireEvent.click(
      screen.getByRole('radio', { name: 'Lots above estimate' }),
    );
    expect(onChange).toHaveBeenCalledWith('lots_above_estimate');
  });

  it('T4: ArrowRight wraps from last → first and fires onChange', async () => {
    const onChange = vi.fn();
    render(
      <DeptRankingMetricToggle
        value="lots_above_estimate"
        onChange={onChange}
      />,
    );
    const active = screen.getByRole('radio', {
      name: 'Lots above estimate',
    });
    active.focus();
    const user = userEvent.setup();
    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenCalledWith('revenue');
  });

  it('T5: ArrowLeft wraps from first → last', async () => {
    const onChange = vi.fn();
    render(
      <DeptRankingMetricToggle value="revenue" onChange={onChange} />,
    );
    const active = screen.getByRole('radio', { name: 'Revenue' });
    active.focus();
    const user = userEvent.setup();
    await user.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenCalledWith('lots_above_estimate');
  });

  it('T6: each radio has a non-empty title matching UI-SPEC copy', () => {
    render(
      <DeptRankingMetricToggle value="revenue" onChange={() => {}} />,
    );
    expect(
      screen.getByRole('radio', { name: 'Revenue' }).getAttribute('title'),
    ).toBe('Total revenue across all sales in range');
    expect(
      screen
        .getByRole('radio', { name: 'Sell-through' })
        .getAttribute('title'),
    ).toBe('Average sell-through rate across departments in range');
    expect(
      screen
        .getByRole('radio', { name: 'Lots above estimate' })
        .getAttribute('title'),
    ).toBe(
      'Count of department lots that sold above their high estimate',
    );
  });

  it('ArrowRight from revenue → onChange("sell_through")', async () => {
    const onChange = vi.fn();
    render(
      <DeptRankingMetricToggle value="revenue" onChange={onChange} />,
    );
    const active = screen.getByRole('radio', { name: 'Revenue' });
    active.focus();
    const user = userEvent.setup();
    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenCalledWith('sell_through');
  });

  it('active option uses bg-gray-50 (NOT accent) + font-semibold', () => {
    render(
      <DeptRankingMetricToggle
        value="sell_through"
        onChange={() => {}}
      />,
    );
    const active = screen.getByRole('radio', { name: 'Sell-through' });
    expect(active.className).toContain('bg-gray-50');
    expect(active.className).toContain('font-semibold');
    // Must NOT use accent as the active background.
    expect(active.className).not.toMatch(/\bbg-accent\b/);
  });

  it('each radio has focus-visible accent ring classes', () => {
    render(
      <DeptRankingMetricToggle value="revenue" onChange={() => {}} />,
    );
    for (const btn of screen.getAllByRole('radio')) {
      expect(btn.className).toContain('focus-visible:ring-2');
      expect(btn.className).toContain('focus-visible:ring-accent');
      expect(btn.className).toContain('focus-visible:ring-inset');
    }
  });

  it('does NOT fire onChange on render', () => {
    const onChange = vi.fn();
    render(
      <DeptRankingMetricToggle value="revenue" onChange={onChange} />,
    );
    expect(onChange).not.toHaveBeenCalled();
  });
});
