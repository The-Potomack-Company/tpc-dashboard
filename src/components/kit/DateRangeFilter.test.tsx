import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router';
import type { ReactNode } from 'react';
import { DateRangeFilter } from './DateRangeFilter';

function LocationEcho() {
  const loc = useLocation();
  return <div data-testid="location-echo">{loc.search}</div>;
}

function renderInRouter(initialEntries: string[], children: ReactNode) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route
          path="*"
          element={
            <>
              {children}
              <LocationEcho />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('<DateRangeFilter>', () => {
  it('renders 4 preset buttons with correct labels', () => {
    renderInRouter(['/'], <DateRangeFilter />);
    expect(screen.getByTestId('date-range-preset-today').textContent).toBe('Today');
    expect(screen.getByTestId('date-range-preset-7d').textContent).toBe('7d');
    expect(screen.getByTestId('date-range-preset-30d').textContent).toBe('30d');
    expect(screen.getByTestId('date-range-preset-custom').textContent).toBe('Custom');
  });

  it('marks 7d as active by default (no range param → D-17 default)', () => {
    renderInRouter(['/'], <DateRangeFilter />);
    expect(screen.getByTestId('date-range-preset-7d').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('date-range-preset-today').getAttribute('aria-pressed')).toBe('false');
  });

  it('marks custom as active when URL is ?range=custom', () => {
    renderInRouter(['/?range=custom&from=2026-04-01&to=2026-04-15'], <DateRangeFilter />);
    expect(screen.getByTestId('date-range-preset-custom').getAttribute('aria-pressed')).toBe('true');
  });

  it('clicking 30d writes ?range=30d to the URL', async () => {
    const user = userEvent.setup();
    renderInRouter(['/'], <DateRangeFilter />);
    await user.click(screen.getByTestId('date-range-preset-30d'));
    expect(screen.getByTestId('location-echo').textContent).toBe('?range=30d');
  });

  it('clicking Custom opens the popover (does not write URL yet)', async () => {
    const user = userEvent.setup();
    renderInRouter(['/'], <DateRangeFilter />);
    // Before click: no popover
    expect(screen.queryByTestId('date-range-popover')).toBeNull();
    await user.click(screen.getByTestId('date-range-preset-custom'));
    expect(screen.getByTestId('date-range-popover')).toBeInTheDocument();
    // URL unchanged until Apply
    expect(screen.getByTestId('location-echo').textContent).toBe('');
  });

  it('popover contains From + To date inputs and Apply + Cancel buttons', async () => {
    const user = userEvent.setup();
    renderInRouter(['/'], <DateRangeFilter />);
    await user.click(screen.getByTestId('date-range-preset-custom'));
    expect(screen.getByTestId('date-range-from')).toBeInTheDocument();
    expect(screen.getByTestId('date-range-to')).toBeInTheDocument();
    expect(screen.getByTestId('date-range-apply')).toBeInTheDocument();
    expect(screen.getByTestId('date-range-cancel')).toBeInTheDocument();
  });

  it('Apply with valid dates writes ?range=custom&from&to to URL', async () => {
    const user = userEvent.setup();
    renderInRouter(['/'], <DateRangeFilter />);
    await user.click(screen.getByTestId('date-range-preset-custom'));
    const fromInput = screen.getByTestId('date-range-from') as HTMLInputElement;
    const toInput = screen.getByTestId('date-range-to') as HTMLInputElement;
    await user.clear(fromInput);
    await user.type(fromInput, '2026-04-01');
    await user.clear(toInput);
    await user.type(toInput, '2026-04-15');
    await user.click(screen.getByTestId('date-range-apply'));
    const search = screen.getByTestId('location-echo').textContent!;
    const params = new URLSearchParams(search);
    expect(params.get('range')).toBe('custom');
    expect(params.get('from')).toBe('2026-04-01');
    expect(params.get('to')).toBe('2026-04-15');
  });

  it('Cancel dismisses the popover without changing URL', async () => {
    const user = userEvent.setup();
    renderInRouter(['/?range=7d'], <DateRangeFilter />);
    await user.click(screen.getByTestId('date-range-preset-custom'));
    expect(screen.getByTestId('date-range-popover')).toBeInTheDocument();
    await user.click(screen.getByTestId('date-range-cancel'));
    expect(screen.queryByTestId('date-range-popover')).toBeNull();
    // URL still reflects 7d (unchanged).
    expect(screen.getByTestId('location-echo').textContent).toBe('?range=7d');
  });
});
