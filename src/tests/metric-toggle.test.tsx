import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MetricToggle } from '../components/MetricToggle';

// Phase 5 Plan 05-02 — MetricToggle contract locked by
// 05-UI-SPEC.md § Metric toggle (TRND-04 only) (lines 396-404).
// Mirrors PeriodSelector's WAI-ARIA radiogroup pattern with 2 options.

describe('MetricToggle — render + structure', () => {
  it('renders 2 options with correct labels', () => {
    render(<MetricToggle value="sell_through" onChange={() => {}} />);
    const options = screen.getAllByRole('radio');
    expect(options).toHaveLength(2);
    expect(options[0].textContent).toBe('Sell-through %');
    expect(options[1].textContent).toBe('Revenue share %');
  });

  it('each option has the correct title attribute', () => {
    render(<MetricToggle value="sell_through" onChange={() => {}} />);
    const [st, rs] = screen.getAllByRole('radio');
    expect(st.getAttribute('title')).toBe(
      'Lots sold divided by lots auctioned, per department',
    );
    expect(rs.getAttribute('title')).toBe(
      'Department revenue divided by sale total revenue',
    );
  });

  it('fieldset has aria-label "Select heat map metric"', () => {
    const { container } = render(
      <MetricToggle value="sell_through" onChange={() => {}} />,
    );
    const fieldset = container.querySelector('fieldset');
    expect(fieldset).not.toBeNull();
    expect(fieldset?.getAttribute('aria-label')).toBe('Select heat map metric');
  });

  it('option 2 has border-l; option 1 does not', () => {
    render(<MetricToggle value="sell_through" onChange={() => {}} />);
    const [st, rs] = screen.getAllByRole('radio');
    expect(st.className).not.toMatch(/\bborder-l\b/);
    expect(rs.className).toContain('border-l');
  });

  it('each option has focus-visible ring classes', () => {
    render(<MetricToggle value="sell_through" onChange={() => {}} />);
    for (const btn of screen.getAllByRole('radio')) {
      expect(btn.className).toContain('focus-visible:ring-2');
      expect(btn.className).toContain('focus-visible:ring-accent');
      expect(btn.className).toContain('focus-visible:ring-inset');
    }
  });
});

describe('MetricToggle — active state', () => {
  it('active option has aria-checked="true" and tabIndex=0', () => {
    render(<MetricToggle value="revenue_share" onChange={() => {}} />);
    const active = screen.getByRole('radio', { name: 'Revenue share %' });
    expect(active.getAttribute('aria-checked')).toBe('true');
    expect(active.getAttribute('tabindex')).toBe('0');
    expect(active.className).toContain('font-semibold');
    expect(active.className).toContain('bg-gray-50');
  });

  it('inactive option has aria-checked="false" and tabIndex=-1', () => {
    render(<MetricToggle value="revenue_share" onChange={() => {}} />);
    const inactive = screen.getByRole('radio', { name: 'Sell-through %' });
    expect(inactive.getAttribute('aria-checked')).toBe('false');
    expect(inactive.getAttribute('tabindex')).toBe('-1');
  });
});

describe('MetricToggle — interaction', () => {
  it('clicking inactive option calls onChange with new value', () => {
    const onChange = vi.fn();
    render(<MetricToggle value="sell_through" onChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Revenue share %' }));
    expect(onChange).toHaveBeenCalledWith('revenue_share');
  });

  it('ArrowRight from sell_through → onChange("revenue_share")', async () => {
    const onChange = vi.fn();
    render(<MetricToggle value="sell_through" onChange={onChange} />);
    const active = screen.getByRole('radio', { name: 'Sell-through %' });
    active.focus();
    const user = userEvent.setup();
    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenCalledWith('revenue_share');
  });

  it('ArrowLeft from revenue_share → onChange("sell_through")', async () => {
    const onChange = vi.fn();
    render(<MetricToggle value="revenue_share" onChange={onChange} />);
    const active = screen.getByRole('radio', { name: 'Revenue share %' });
    active.focus();
    const user = userEvent.setup();
    await user.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenCalledWith('sell_through');
  });

  it('Home jumps to sell_through', async () => {
    const onChange = vi.fn();
    render(<MetricToggle value="revenue_share" onChange={onChange} />);
    const active = screen.getByRole('radio', { name: 'Revenue share %' });
    active.focus();
    const user = userEvent.setup();
    await user.keyboard('{Home}');
    expect(onChange).toHaveBeenCalledWith('sell_through');
  });

  it('End jumps to revenue_share', async () => {
    const onChange = vi.fn();
    render(<MetricToggle value="sell_through" onChange={onChange} />);
    const active = screen.getByRole('radio', { name: 'Sell-through %' });
    active.focus();
    const user = userEvent.setup();
    await user.keyboard('{End}');
    expect(onChange).toHaveBeenCalledWith('revenue_share');
  });

  it('does NOT fire onChange on render', () => {
    const onChange = vi.fn();
    render(<MetricToggle value="sell_through" onChange={onChange} />);
    expect(onChange).not.toHaveBeenCalled();
  });
});
