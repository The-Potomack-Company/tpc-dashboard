import { describe, it, expect } from 'vitest';
import {
  formatDelta,
  type DeltaDirection,
  type DeltaType,
  type FormattedDelta,
} from '../lib/format';

// Phase 4 Plan 02 Task 2 — delta formatter contract locked by
// .planning/phases/04-kpi-landing-page/04-UI-SPEC.md § Copywriting Contract
// → Delta semantics (lines 249–264) and 04-RESEARCH.md § Pattern 5.

// Type smoke test — referenced so the imports are kept and TS surface narrows.
const _typeCheck: { a: DeltaDirection; b: DeltaType; c: FormattedDelta } = {
  a: 'up',
  b: 'relative',
  c: { glyph: '—', text: '', direction: 'none', aria: 'No baseline comparison' },
};
void _typeCheck;

describe('formatDelta — relative (currency / count KPIs)', () => {
  it('positive 25% — glyph ▲, text 25.0%, direction up, aria "Up 25.0% versus previous"', () => {
    const r = formatDelta(1000, 800, 'relative');
    expect(r.glyph).toBe('▲');
    expect(r.text).toBe('25.0%');
    expect(r.direction).toBe('up');
    expect(r.aria).toBe('Up 25.0% versus previous');
  });

  it('negative 20% — glyph ▼, text 20.0%, direction down, aria "Down 20.0% versus previous"', () => {
    const r = formatDelta(800, 1000, 'relative');
    expect(r.glyph).toBe('▼');
    expect(r.text).toBe('20.0%');
    expect(r.direction).toBe('down');
    expect(r.aria).toBe('Down 20.0% versus previous');
  });

  it('current=0 previous=100 → glyph ▼, text 100.0%, direction down (valid 100% decline, NOT no-baseline)', () => {
    const r = formatDelta(0, 100, 'relative');
    expect(r.glyph).toBe('▼');
    expect(r.text).toBe('100.0%');
    expect(r.direction).toBe('down');
    expect(r.aria).toBe('Down 100.0% versus previous');
  });

  it('flat 0% change (current === previous) renders as no-baseline em-dash per Assumption A2', () => {
    const r = formatDelta(1000, 1000, 'relative');
    expect(r.glyph).toBe('—');
    expect(r.text).toBe('');
    expect(r.direction).toBe('none');
    expect(r.aria).toBe('No baseline comparison');
  });

  it('previous=0 is no-baseline (divide-by-zero guard) for relative deltas', () => {
    const r = formatDelta(1000, 0, 'relative');
    expect(r.glyph).toBe('—');
    expect(r.text).toBe('');
    expect(r.direction).toBe('none');
  });

  it('rounds to exactly one decimal — 27.58% → 27.6%', () => {
    // (127.58 - 100) / 100 * 100 = 27.58 → toFixed(1) === '27.6'
    const r = formatDelta(127.58, 100, 'relative');
    expect(r.text).toBe('27.6%');
    expect(r.direction).toBe('up');
  });

  it('small positive delta 3.0% — text "3.0%" (decimal zero preserved)', () => {
    const r = formatDelta(103, 100, 'relative');
    expect(r.text).toBe('3.0%');
    expect(r.glyph).toBe('▲');
  });
});

describe('formatDelta — percentage-points (sell-through KPI)', () => {
  it('0.68 → 0.71 → ▲ 3.0pp up', () => {
    const r = formatDelta(0.71, 0.68, 'percentage-points');
    expect(r.glyph).toBe('▲');
    expect(r.text).toBe('3.0pp');
    expect(r.direction).toBe('up');
    expect(r.aria).toBe('Up 3.0pp versus previous');
  });

  it('0.71 → 0.65 → ▼ 6.0pp down', () => {
    const r = formatDelta(0.65, 0.71, 'percentage-points');
    expect(r.glyph).toBe('▼');
    expect(r.text).toBe('6.0pp');
    expect(r.direction).toBe('down');
    expect(r.aria).toBe('Down 6.0pp versus previous');
  });

  it('flat 0pp change renders as no-baseline em-dash', () => {
    const r = formatDelta(0.68, 0.68, 'percentage-points');
    expect(r.glyph).toBe('—');
    expect(r.text).toBe('');
    expect(r.direction).toBe('none');
  });

  it('previous=0 is NOT no-baseline for percentage-points (subtraction, no division)', () => {
    // 0.03 - 0 = 0.03 → 3.0pp up. Unlike 'relative', 'percentage-points'
    // can handle previous=0 because it's subtraction, not division.
    const r = formatDelta(0.03, 0, 'percentage-points');
    expect(r.glyph).toBe('▲');
    expect(r.text).toBe('3.0pp');
    expect(r.direction).toBe('up');
  });
});

describe('formatDelta — no-baseline', () => {
  it('current null → no-baseline with direction none and empty text', () => {
    const r = formatDelta(null, 1000, 'relative');
    expect(r.glyph).toBe('—');
    expect(r.text).toBe('');
    expect(r.direction).toBe('none');
    expect(r.aria).toBe('No baseline comparison');
  });

  it('previous null → no-baseline', () => {
    const r = formatDelta(1000, null, 'relative');
    expect(r.glyph).toBe('—');
    expect(r.direction).toBe('none');
  });

  it('both undefined → no-baseline', () => {
    const r = formatDelta(undefined, undefined, 'percentage-points');
    expect(r.glyph).toBe('—');
    expect(r.direction).toBe('none');
    expect(r.aria).toBe('No baseline comparison');
  });

  it('current null + percentage-points type also returns no-baseline', () => {
    const r = formatDelta(null, 0.68, 'percentage-points');
    expect(r.glyph).toBe('—');
    expect(r.direction).toBe('none');
    expect(r.aria).toBe('No baseline comparison');
  });
});
