// Phase 6 Plan 06-03 Task 1 — DepartmentChipBar contract tests.
// Contract: .planning/phases/06-department-analysis-sale-comparison/06-UI-SPEC.md
//   § DepartmentChipBar chip color rules (active/inactive/disabled/focused),
//   § Spacing Scale → DepartmentChipBar,
//   § Copywriting → DepartmentChipBar aria-label template + Max 8 notice,
//   § Interaction Contract → chip click / 9th click / keyboard.
// REQ-ID: DEPT-02 (series selection UI).
//
// Renders a multi-select row of clickable chips, one per available department.
// Active chips show a CHART_PALETTE color dot; inactive chips have no dot.
// Clicking a 9th inactive chip while 8 are already selected fires
// onMaxExceeded and does NOT call onToggle. The status-line copy is
// rendered by the parent (DepartmentsPage), not inside this component.

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  DepartmentChipBar,
  type DepartmentChip,
} from './DepartmentChipBar';

const AVAILABLE: DepartmentChip[] = [
  { code: 'ASN', displayName: 'Asian Art' },
  { code: 'FRN', displayName: 'Furniture' },
  { code: 'PNT', displayName: 'Paintings' },
];

const colorForCode = (code: string) => {
  // Fixed map per test — keeps assertions deterministic.
  const map: Record<string, string> = {
    ASN: '#2563eb',
    FRN: '#059669',
    PNT: '#d97706',
  };
  return map[code] ?? '#000000';
};

describe('DepartmentChipBar', () => {
  it('T1: renders one button per chip in `available`', () => {
    render(
      <DepartmentChipBar
        available={AVAILABLE}
        selected={[]}
        onToggle={vi.fn()}
        colorForCode={colorForCode}
      />,
    );
    // role='switch' buttons scoped to the chip group.
    const group = screen.getByRole('group', {
      name: 'Department series selection',
    });
    const chips = screen.getAllByRole('switch');
    expect(chips).toHaveLength(3);
    expect(group).toContainElement(chips[0]);
  });

  it('T2: aria-checked is true only for chips in `selected`', () => {
    render(
      <DepartmentChipBar
        available={AVAILABLE}
        selected={['ASN', 'PNT']}
        onToggle={vi.fn()}
        colorForCode={colorForCode}
      />,
    );
    expect(
      screen.getByRole('switch', { name: /^ASN/ }).getAttribute('aria-checked'),
    ).toBe('true');
    expect(
      screen.getByRole('switch', { name: /^FRN/ }).getAttribute('aria-checked'),
    ).toBe('false');
    expect(
      screen.getByRole('switch', { name: /^PNT/ }).getAttribute('aria-checked'),
    ).toBe('true');
  });

  it('T3: active chips render a color-dot element matching colorForCode', () => {
    const { container } = render(
      <DepartmentChipBar
        available={AVAILABLE}
        selected={['ASN']}
        onToggle={vi.fn()}
        colorForCode={colorForCode}
      />,
    );
    // Dot is an aria-hidden span with inline background-color on the active chip.
    const asnChip = screen.getByRole('switch', { name: /^ASN/ });
    const asnDot = asnChip.querySelector('[aria-hidden="true"]');
    expect(asnDot).not.toBeNull();
    // Inline style carries the color — case-insensitive match on the hex.
    expect(asnDot!.getAttribute('style')?.toLowerCase()).toContain('#2563eb');

    // Inactive chips do NOT render a dot.
    const frnChip = screen.getByRole('switch', { name: /^FRN/ });
    expect(frnChip.querySelector('[aria-hidden="true"]')).toBeNull();
    // Sanity: the overall component container still mounted.
    expect(container).toBeTruthy();
  });

  it('T4: clicking an inactive chip with selected.length < 8 fires onToggle', async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    render(
      <DepartmentChipBar
        available={AVAILABLE}
        selected={['ASN']}
        onToggle={onToggle}
        colorForCode={colorForCode}
      />,
    );
    await user.click(screen.getByRole('switch', { name: /^FRN/ }));
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith('FRN');
  });

  it('T5: clicking an active chip fires onToggle (to remove)', async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    render(
      <DepartmentChipBar
        available={AVAILABLE}
        selected={['ASN']}
        onToggle={onToggle}
        colorForCode={colorForCode}
      />,
    );
    await user.click(screen.getByRole('switch', { name: /^ASN/ }));
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith('ASN');
  });

  it('T6: clicking an inactive chip with selected.length === 8 fires onMaxExceeded (not onToggle)', async () => {
    const onToggle = vi.fn();
    const onMaxExceeded = vi.fn();
    const user = userEvent.setup();

    // Build 9 available depts; select 8 of them so the 9th is disabled.
    const nine: DepartmentChip[] = [
      { code: 'D1', displayName: 'One' },
      { code: 'D2', displayName: 'Two' },
      { code: 'D3', displayName: 'Three' },
      { code: 'D4', displayName: 'Four' },
      { code: 'D5', displayName: 'Five' },
      { code: 'D6', displayName: 'Six' },
      { code: 'D7', displayName: 'Seven' },
      { code: 'D8', displayName: 'Eight' },
      { code: 'D9', displayName: 'Nine' },
    ];
    render(
      <DepartmentChipBar
        available={nine}
        selected={['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8']}
        onToggle={onToggle}
        onMaxExceeded={onMaxExceeded}
        maxSelected={8}
        colorForCode={colorForCode}
      />,
    );
    await user.click(screen.getByRole('switch', { name: /^D9/ }));
    expect(onToggle).not.toHaveBeenCalled();
    expect(onMaxExceeded).toHaveBeenCalledTimes(1);
  });

  it('T7: null displayName → aria-label equals the code (no " — null")', () => {
    const chips: DepartmentChip[] = [{ code: 'NEW', displayName: null }];
    render(
      <DepartmentChipBar
        available={chips}
        selected={[]}
        onToggle={vi.fn()}
        colorForCode={colorForCode}
      />,
    );
    const chip = screen.getByRole('switch');
    expect(chip.getAttribute('aria-label')).toBe('NEW');
    expect(chip.getAttribute('aria-label')).not.toMatch(/null/i);
  });

  it('T8: keyboard Space on a focused inactive chip with free slots fires onToggle', async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    render(
      <DepartmentChipBar
        available={AVAILABLE}
        selected={[]}
        onToggle={onToggle}
        colorForCode={colorForCode}
      />,
    );
    const frn = screen.getByRole('switch', { name: /^FRN/ });
    frn.focus();
    // Native <button type="button"> treats Space as click on keydown by default
    // in the browser; user-event's keyboard() emulation triggers the click.
    await user.keyboard(' ');
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith('FRN');
  });
});
