import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ModeToggle } from './ModeToggle';

// Phase 3 / Plan 03-06 / Task 1 — ModeToggle tests.
//
// D-20: targets sessions.mode (canonical). D-21: default = 'all'.
// Renders 3 segmented buttons (All / House / Sale) using radiogroup
// semantics so screen readers announce the active selection.

const useModeFilterMock = vi.fn();
vi.mock('../hooks/useModeFilter', () => ({
  useModeFilter: () => useModeFilterMock(),
}));

beforeEach(() => {
  useModeFilterMock.mockReset();
});

describe('<ModeToggle>', () => {
  it('Test 7: renders 3 buttons (All / House / Sale); clicking one calls setMode', async () => {
    const setMode = vi.fn();
    useModeFilterMock.mockReturnValue({ mode: 'all', setMode });
    const user = userEvent.setup();
    render(<ModeToggle />);

    // 3 radio buttons total.
    const buttons = screen.getAllByRole('radio');
    expect(buttons).toHaveLength(3);
    expect(buttons[0]).toHaveTextContent('All');
    expect(buttons[1]).toHaveTextContent('House');
    expect(buttons[2]).toHaveTextContent('Sale');

    await user.click(buttons[1]);
    expect(setMode).toHaveBeenCalledWith('house');

    await user.click(buttons[2]);
    expect(setMode).toHaveBeenCalledWith('sale');

    await user.click(buttons[0]);
    expect(setMode).toHaveBeenCalledWith('all');
  });

  it('Test 8: when mode="all", "All" button is visually selected (accent bg)', () => {
    useModeFilterMock.mockReturnValue({ mode: 'all', setMode: vi.fn() });
    render(<ModeToggle />);
    const allBtn = screen.getByRole('radio', { name: /^All$/ });
    const houseBtn = screen.getByRole('radio', { name: /^House$/ });
    // Phase 7 unified-design: active option uses bg-accent + text-accent-ink
    // (was bg-accent + text-white before the unified migration).
    expect(allBtn.className).toMatch(/bg-accent/);
    expect(allBtn.className).toMatch(/text-accent-ink/);
    expect(houseBtn.className).not.toMatch(/bg-accent\b/);
  });

  it('Test 8b: when mode="house", "House" button is visually selected', () => {
    useModeFilterMock.mockReturnValue({ mode: 'house', setMode: vi.fn() });
    render(<ModeToggle />);
    const houseBtn = screen.getByRole('radio', { name: /^House$/ });
    expect(houseBtn.className).toMatch(/bg-accent/);
  });

  it('Test 9: default state — when mode="all", aria-checked reflects the active state', () => {
    useModeFilterMock.mockReturnValue({ mode: 'all', setMode: vi.fn() });
    render(<ModeToggle />);
    const allBtn = screen.getByRole('radio', { name: /^All$/ });
    const houseBtn = screen.getByRole('radio', { name: /^House$/ });
    const saleBtn = screen.getByRole('radio', { name: /^Sale$/ });
    expect(allBtn).toHaveAttribute('aria-checked', 'true');
    expect(houseBtn).toHaveAttribute('aria-checked', 'false');
    expect(saleBtn).toHaveAttribute('aria-checked', 'false');
  });

  it('Test 10: aria-label on the group is "Filter by session mode"', () => {
    useModeFilterMock.mockReturnValue({ mode: 'all', setMode: vi.fn() });
    render(<ModeToggle />);
    const group = screen.getByRole('radiogroup');
    expect(group).toHaveAttribute('aria-label', 'Filter by session mode');
  });

  it('Test 11: imports useModeFilter from src/hooks/useModeFilter (verified via mock path)', () => {
    // The vi.mock() above targeting '../hooks/useModeFilter' is the verification:
    // if the component imported from anywhere else, the mock would not bind and
    // useModeFilterMock would not be called.
    useModeFilterMock.mockReturnValue({ mode: 'all', setMode: vi.fn() });
    render(<ModeToggle />);
    expect(useModeFilterMock).toHaveBeenCalled();
  });
});
