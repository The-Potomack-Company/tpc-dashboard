import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DateRangeFilter } from '../components/DateRangeFilter';
import { rangeFromPreset, type Range } from '../lib/period';

// Phase 5 Plan 05-02 — DateRangeFilter contract locked by
// 05-UI-SPEC.md § DateRangeFilter component (lines 739-808),
// § Copywriting Contract → DateRangeFilter (lines 337-356),
// and § Interaction Contract (lines 448-465).
//
// Mirrors the WAI-ARIA radiogroup pattern from src/components/PeriodSelector.tsx.

const L12M_DEFAULT: Range = rangeFromPreset('l12m');

describe('DateRangeFilter — render + structure', () => {
  it('renders 5 preset buttons in order YTD / L6M / L12M / L24M / All time', () => {
    render(<DateRangeFilter value={L12M_DEFAULT} onChange={() => {}} />);
    const presets = screen.getAllByRole('radio');
    expect(presets).toHaveLength(5);
    expect(presets[0].textContent).toBe('YTD');
    expect(presets[1].textContent).toBe('L6M');
    expect(presets[2].textContent).toBe('L12M');
    expect(presets[3].textContent).toBe('L24M');
    expect(presets[4].textContent).toBe('All time');
  });

  it('default value l12m → L12M button is active (aria-checked + tabIndex=0)', () => {
    render(<DateRangeFilter value={L12M_DEFAULT} onChange={() => {}} />);
    const l12m = screen.getByRole('radio', { name: 'L12M' });
    expect(l12m.getAttribute('aria-checked')).toBe('true');
    expect(l12m.getAttribute('tabindex')).toBe('0');
    const ytd = screen.getByRole('radio', { name: 'YTD' });
    expect(ytd.getAttribute('aria-checked')).toBe('false');
    expect(ytd.getAttribute('tabindex')).toBe('-1');
  });

  it('fieldset has aria-label "Select date range"', () => {
    const { container } = render(
      <DateRangeFilter value={L12M_DEFAULT} onChange={() => {}} />,
    );
    const fieldset = container.querySelector('fieldset');
    expect(fieldset).not.toBeNull();
    expect(fieldset?.getAttribute('aria-label')).toBe('Select date range');
  });

  it('each preset has the correct title attribute', () => {
    render(<DateRangeFilter value={L12M_DEFAULT} onChange={() => {}} />);
    const presets = screen.getAllByRole('radio');
    expect(presets[0].getAttribute('title')).toBe('Year to date');
    expect(presets[1].getAttribute('title')).toBe('Last 6 months');
    expect(presets[2].getAttribute('title')).toBe('Last 12 months');
    expect(presets[3].getAttribute('title')).toBe('Last 24 months');
    expect(presets[4].getAttribute('title')).toBe('All time');
  });

  it('dividers: preset 2..5 have border-l; preset 1 does not', () => {
    render(<DateRangeFilter value={L12M_DEFAULT} onChange={() => {}} />);
    const [ytd, l6m, l12m, l24m, all] = screen.getAllByRole('radio');
    expect(ytd.className).not.toMatch(/\bborder-l\b/);
    expect(l6m.className).toContain('border-l');
    expect(l12m.className).toContain('border-l');
    expect(l24m.className).toContain('border-l');
    expect(all.className).toContain('border-l');
  });

  it('renders a Custom button with aria-expanded=false by default', () => {
    render(<DateRangeFilter value={L12M_DEFAULT} onChange={() => {}} />);
    const custom = screen.getByRole('button', { name: /custom/i });
    expect(custom).toBeInTheDocument();
    expect(custom.getAttribute('aria-expanded')).toBe('false');
    expect(custom.getAttribute('aria-haspopup')).toBe('dialog');
  });

  it('each preset has focus-visible ring classes (accent reservation #2)', () => {
    render(<DateRangeFilter value={L12M_DEFAULT} onChange={() => {}} />);
    for (const btn of screen.getAllByRole('radio')) {
      const cls = btn.className;
      expect(cls).toContain('focus-visible:ring-2');
      expect(cls).toContain('focus-visible:ring-accent');
      expect(cls).toContain('focus-visible:ring-inset');
    }
  });
});

describe('DateRangeFilter — preset clicks emit rangeFromPreset()', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-22T12:00:00'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  // Use fireEvent (not userEvent) in fake-timer blocks — userEvent has its own
  // internal scheduler that deadlocks when the global timer queue is mocked.
  it('clicking YTD emits { preset: "ytd", start: "2026-01-01", end: "2026-04-22" }', () => {
    const onChange = vi.fn();
    render(<DateRangeFilter value={L12M_DEFAULT} onChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: 'YTD' }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        preset: 'ytd',
        start: '2026-01-01',
        end: '2026-04-22',
      }),
    );
  });

  it('clicking All time emits { preset: "all", start: null, end: null }', () => {
    const onChange = vi.fn();
    render(<DateRangeFilter value={L12M_DEFAULT} onChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: 'All time' }));
    expect(onChange).toHaveBeenCalledWith({
      preset: 'all',
      start: null,
      end: null,
    });
  });
});

describe('DateRangeFilter — keyboard navigation', () => {
  it('ArrowRight from active L12M moves to L24M and emits', async () => {
    const onChange = vi.fn();
    render(<DateRangeFilter value={L12M_DEFAULT} onChange={onChange} />);
    const active = screen.getByRole('radio', { name: 'L12M' });
    active.focus();
    const user = userEvent.setup();
    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenCalled();
    const last = onChange.mock.calls[onChange.mock.calls.length - 1][0] as Range;
    expect(last.preset).toBe('l24m');
  });

  it('ArrowLeft wraps from YTD → All time', async () => {
    const onChange = vi.fn();
    render(<DateRangeFilter value={rangeFromPreset('ytd')} onChange={onChange} />);
    const active = screen.getByRole('radio', { name: 'YTD' });
    active.focus();
    const user = userEvent.setup();
    await user.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenCalled();
    const last = onChange.mock.calls[onChange.mock.calls.length - 1][0] as Range;
    expect(last.preset).toBe('all');
  });

  it('Home jumps to first preset (ytd)', async () => {
    const onChange = vi.fn();
    render(<DateRangeFilter value={L12M_DEFAULT} onChange={onChange} />);
    const active = screen.getByRole('radio', { name: 'L12M' });
    active.focus();
    const user = userEvent.setup();
    await user.keyboard('{Home}');
    const last = onChange.mock.calls[onChange.mock.calls.length - 1][0] as Range;
    expect(last.preset).toBe('ytd');
  });

  it('End jumps to last preset (all)', async () => {
    const onChange = vi.fn();
    render(<DateRangeFilter value={rangeFromPreset('ytd')} onChange={onChange} />);
    const active = screen.getByRole('radio', { name: 'YTD' });
    active.focus();
    const user = userEvent.setup();
    await user.keyboard('{End}');
    const last = onChange.mock.calls[onChange.mock.calls.length - 1][0] as Range;
    expect(last.preset).toBe('all');
  });
});

describe('DateRangeFilter — custom disclosure panel', () => {
  it('clicking Custom opens a panel with Start/End inputs and Apply/Reset buttons', async () => {
    const user = userEvent.setup();
    render(<DateRangeFilter value={L12M_DEFAULT} onChange={() => {}} />);
    const custom = screen.getByRole('button', { name: /custom/i });
    await user.click(custom);

    expect(custom.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByLabelText('Start')).toBeInTheDocument();
    expect(screen.getByLabelText('End')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply range' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset' })).toBeInTheDocument();
  });

  it('Start after End → Apply shows role=alert and does NOT call onChange', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<DateRangeFilter value={L12M_DEFAULT} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: /custom/i }));

    const start = screen.getByLabelText('Start') as HTMLInputElement;
    const end = screen.getByLabelText('End') as HTMLInputElement;
    // fireEvent.change sets `<input type=date>` reliably in jsdom;
    // userEvent.type doesn't synthesize the full yyyy-mm-dd spinner flow.
    fireEvent.change(start, { target: { value: '2024-01-01' } });
    fireEvent.change(end, { target: { value: '2023-01-01' } });
    await user.click(screen.getByRole('button', { name: 'Apply range' }));

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toBe('Start date must be on or before end date.');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('valid Start ≤ End → Apply emits { preset: "custom", ... } and closes the panel', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<DateRangeFilter value={L12M_DEFAULT} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: /custom/i }));

    const start = screen.getByLabelText('Start') as HTMLInputElement;
    const end = screen.getByLabelText('End') as HTMLInputElement;
    fireEvent.change(start, { target: { value: '2024-01-01' } });
    fireEvent.change(end, { target: { value: '2024-12-31' } });
    await user.click(screen.getByRole('button', { name: 'Apply range' }));

    expect(onChange).toHaveBeenCalledWith({
      start: '2024-01-01',
      end: '2024-12-31',
      preset: 'custom',
    });
    // Panel is closed — Start/End inputs gone.
    expect(screen.queryByLabelText('Start')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('End')).not.toBeInTheDocument();
  });

  it('Reset emits rangeFromPreset("l12m") and closes the panel', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <DateRangeFilter
        value={{ start: '2024-01-01', end: '2024-12-31', preset: 'custom' }}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByRole('button', { name: /custom/i }));
    await user.click(screen.getByRole('button', { name: 'Reset' }));

    expect(onChange).toHaveBeenCalled();
    const last = onChange.mock.calls[onChange.mock.calls.length - 1][0] as Range;
    expect(last.preset).toBe('l12m');
    // Panel closed.
    expect(screen.queryByLabelText('Start')).not.toBeInTheDocument();
  });

  it('clicking a preset while panel is open also closes the panel', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<DateRangeFilter value={L12M_DEFAULT} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: /custom/i }));
    expect(screen.getByLabelText('Start')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'YTD' }));
    expect(screen.queryByLabelText('Start')).not.toBeInTheDocument();
  });
});

describe('DateRangeFilter — custom status line', () => {
  it('when value.preset="custom" and panel closed, renders status line with formatDate(start)/end', () => {
    render(
      <DateRangeFilter
        value={{ start: '2024-01-01', end: '2024-12-31', preset: 'custom' }}
        onChange={() => {}}
      />,
    );
    // U+2013 en-dash per UI-SPEC
    expect(
      screen.getByText('Custom range: Jan 1, 2024 – Dec 31, 2024'),
    ).toBeInTheDocument();
  });

  it('when preset is not "custom", no status line', () => {
    render(<DateRangeFilter value={L12M_DEFAULT} onChange={() => {}} />);
    expect(screen.queryByText(/Custom range:/)).not.toBeInTheDocument();
  });
});

describe('DateRangeFilter — onChange discipline', () => {
  it('does NOT fire onChange on initial render', () => {
    const onChange = vi.fn();
    render(<DateRangeFilter value={L12M_DEFAULT} onChange={onChange} />);
    expect(onChange).not.toHaveBeenCalled();
  });
});
