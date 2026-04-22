import { describe, it, expect } from 'vitest';
import {
  CHART_PALETTE,
  CHART_GRID_STROKE,
  CHART_AXIS_TICK_FILL,
  CHART_TOOLTIP_BG,
  CHART_TOOLTIP_TEXT,
  CHART_TOOLTIP_LABEL,
} from '../lib/chart-colors';

// Phase 5 Plan 01 Task 1 — chart-colors.ts contract locked by
// 05-UI-SPEC.md § Color → Chart Palette (lines 199-243). The 8 hex values
// are a stable categorical palette; downstream chart plans import by index.

describe('CHART_PALETTE', () => {
  it('has exactly 8 entries (8-color categorical palette)', () => {
    expect(CHART_PALETTE).toHaveLength(8);
  });

  it('indices 0–7 match UI-SPEC hex values (blue/emerald/amber/rose/violet/cyan/orange/lime)', () => {
    expect(CHART_PALETTE[0]).toBe('#2563eb'); // blue-600 — TRND-01 net revenue, TRND-06 registered bidders
    expect(CHART_PALETTE[1]).toBe('#059669'); // emerald-600 — TRND-02 sell-through, TRND-05 within
    expect(CHART_PALETTE[2]).toBe('#d97706'); // amber-600 — TRND-05 below
    expect(CHART_PALETTE[3]).toBe('#e11d48'); // rose-600 — TRND-05 above
    expect(CHART_PALETTE[4]).toBe('#7c3aed'); // violet-600 — reserved
    expect(CHART_PALETTE[5]).toBe('#0891b2'); // cyan-600 — rolling-3 trend overlay
    expect(CHART_PALETTE[6]).toBe('#ea580c'); // orange-600 — TRND-06 winning buyers
    expect(CHART_PALETTE[7]).toBe('#65a30d'); // lime-600 — reserved
  });
});

describe('chart neutrals', () => {
  it('CHART_GRID_STROKE = #e5e7eb (gray-200)', () => {
    expect(CHART_GRID_STROKE).toBe('#e5e7eb');
  });

  it('CHART_AXIS_TICK_FILL = #6b7280 (gray-500)', () => {
    expect(CHART_AXIS_TICK_FILL).toBe('#6b7280');
  });

  it('CHART_TOOLTIP_BG = #111827 (gray-900)', () => {
    expect(CHART_TOOLTIP_BG).toBe('#111827');
  });

  it('CHART_TOOLTIP_TEXT = #ffffff (white)', () => {
    expect(CHART_TOOLTIP_TEXT).toBe('#ffffff');
  });

  it('CHART_TOOLTIP_LABEL = #e5e7eb (gray-200)', () => {
    expect(CHART_TOOLTIP_LABEL).toBe('#e5e7eb');
  });
});
