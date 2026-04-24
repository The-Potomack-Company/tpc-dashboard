import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PeriodSelector } from '../components/PeriodSelector';

// Phase 4 Plan 03 Task 3 — PeriodSelector contract locked by
// 04-UI-SPEC.md § Layout Specifications (lines 401–438), § Copywriting
// Contract → Period selector, and § Accessibility Floor → period-selector
// WAI-ARIA radiogroup pattern.

describe('PeriodSelector — render + structure', () => {
  it('renders 3 buttons in order YTD / L6M / L12M', () => {
    render(<PeriodSelector value="l12m" onChange={() => {}} />);
    const buttons = screen.getAllByRole('radio');
    expect(buttons).toHaveLength(3);
    expect(buttons[0].textContent).toBe('YTD');
    expect(buttons[1].textContent).toBe('L6M');
    expect(buttons[2].textContent).toBe('L12M');
  });

  it('each button has role=radio and matching title attribute', () => {
    render(<PeriodSelector value="l12m" onChange={() => {}} />);
    const buttons = screen.getAllByRole('radio');
    expect(buttons[0].getAttribute('title')).toBe('Year to date');
    expect(buttons[1].getAttribute('title')).toBe('Last 6 months');
    expect(buttons[2].getAttribute('title')).toBe('Last 12 months');
  });

  it('container is a fieldset with aria-label "Select reporting period"', () => {
    const { container } = render(
      <PeriodSelector value="l12m" onChange={() => {}} />,
    );
    const fieldset = container.querySelector('fieldset');
    expect(fieldset).not.toBeNull();
    expect(fieldset?.getAttribute('aria-label')).toBe('Select reporting period');
  });
});

describe('PeriodSelector — active state', () => {
  it('active option has aria-checked="true", aria-pressed="true", tabIndex=0, font-semibold', () => {
    render(<PeriodSelector value="l6m" onChange={() => {}} />);
    const active = screen.getByRole('radio', { name: 'L6M' });
    expect(active.getAttribute('aria-checked')).toBe('true');
    expect(active.getAttribute('aria-pressed')).toBe('true');
    expect(active.getAttribute('tabindex')).toBe('0');
    expect(active.className).toContain('font-semibold');
  });

  it('inactive options have aria-checked="false" and tabIndex=-1', () => {
    render(<PeriodSelector value="l6m" onChange={() => {}} />);
    const ytd = screen.getByRole('radio', { name: 'YTD' });
    const l12m = screen.getByRole('radio', { name: 'L12M' });
    expect(ytd.getAttribute('aria-checked')).toBe('false');
    expect(ytd.getAttribute('tabindex')).toBe('-1');
    expect(l12m.getAttribute('aria-checked')).toBe('false');
    expect(l12m.getAttribute('tabindex')).toBe('-1');
  });

  it('active option uses bg-gray-50 — NOT accent color (preserves Phase 1/3 accent reservation)', () => {
    render(<PeriodSelector value="ytd" onChange={() => {}} />);
    const active = screen.getByRole('radio', { name: 'YTD' });
    expect(active.className).toContain('bg-gray-50');
    // Active state must not set a background using the accent token.
    // focus-visible:ring-accent is allowed (focus ring, reservation #2);
    // active background coloring is not.
    expect(active.className).not.toMatch(/\bbg-accent\b/);
  });
});

describe('PeriodSelector — option dividers', () => {
  it('options 2 and 3 have border-l; option 1 does not', () => {
    render(<PeriodSelector value="l12m" onChange={() => {}} />);
    const [ytd, l6m, l12m] = screen.getAllByRole('radio');
    expect(ytd.className).not.toMatch(/\bborder-l\b/);
    expect(l6m.className).toContain('border-l');
    expect(l12m.className).toContain('border-l');
  });
});

describe('PeriodSelector — mouse interaction', () => {
  it('clicking an option calls onChange with the option value', () => {
    const onChange = vi.fn();
    render(<PeriodSelector value="l12m" onChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: 'YTD' }));
    expect(onChange).toHaveBeenCalledWith('ytd');
    fireEvent.click(screen.getByRole('radio', { name: 'L6M' }));
    expect(onChange).toHaveBeenCalledWith('l6m');
  });
});

describe('PeriodSelector — keyboard navigation (WAI-ARIA radiogroup)', () => {
  it('ArrowRight on active option moves selection to the next option', async () => {
    const onChange = vi.fn();
    render(<PeriodSelector value="ytd" onChange={onChange} />);
    const active = screen.getByRole('radio', { name: 'YTD' });
    active.focus();
    const user = userEvent.setup();
    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenCalledWith('l6m');
  });

  it('ArrowRight wraps from l12m → ytd', async () => {
    const onChange = vi.fn();
    render(<PeriodSelector value="l12m" onChange={onChange} />);
    const active = screen.getByRole('radio', { name: 'L12M' });
    active.focus();
    const user = userEvent.setup();
    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenCalledWith('ytd');
  });

  it('ArrowLeft wraps from ytd → l12m', async () => {
    const onChange = vi.fn();
    render(<PeriodSelector value="ytd" onChange={onChange} />);
    const active = screen.getByRole('radio', { name: 'YTD' });
    active.focus();
    const user = userEvent.setup();
    await user.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenCalledWith('l12m');
  });

  it('ArrowLeft on middle option moves to previous', async () => {
    const onChange = vi.fn();
    render(<PeriodSelector value="l6m" onChange={onChange} />);
    const active = screen.getByRole('radio', { name: 'L6M' });
    active.focus();
    const user = userEvent.setup();
    await user.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenCalledWith('ytd');
  });

  it('Home jumps to first option (ytd)', async () => {
    const onChange = vi.fn();
    render(<PeriodSelector value="l12m" onChange={onChange} />);
    const active = screen.getByRole('radio', { name: 'L12M' });
    active.focus();
    const user = userEvent.setup();
    await user.keyboard('{Home}');
    expect(onChange).toHaveBeenCalledWith('ytd');
  });

  it('End jumps to last option (l12m)', async () => {
    const onChange = vi.fn();
    render(<PeriodSelector value="ytd" onChange={onChange} />);
    const active = screen.getByRole('radio', { name: 'YTD' });
    active.focus();
    const user = userEvent.setup();
    await user.keyboard('{End}');
    expect(onChange).toHaveBeenCalledWith('l12m');
  });

  it('Space or Enter on focused option invokes onChange (native button behavior)', async () => {
    const onChange = vi.fn();
    render(<PeriodSelector value="l12m" onChange={onChange} />);
    const ytdBtn = screen.getByRole('radio', { name: 'YTD' });
    ytdBtn.focus();
    const user = userEvent.setup();
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith('ytd');
  });
});

describe('PeriodSelector — focus ring', () => {
  it('each option has focus-visible:ring-2 + focus-visible:ring-accent classes (accent reservation #2)', () => {
    render(<PeriodSelector value="l12m" onChange={() => {}} />);
    for (const btn of screen.getAllByRole('radio')) {
      const cls = btn.className;
      expect(cls).toContain('focus-visible:ring-2');
      expect(cls).toContain('focus-visible:ring-accent');
      expect(cls).toContain('focus-visible:ring-inset');
    }
  });
});
