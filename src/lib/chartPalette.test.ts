import { describe, it, expect } from 'vitest';
import {
  AI_STATUS_COLOR,
  SESSION_STATUS_COLOR,
  SESSION_MODE_COLOR,
  SPECIALIST_COLOR_CYCLE,
  colorForSpecialist,
} from './chartPalette';
import type { AiStatus, SessionStatus, SessionMode } from './chartPalette';

// Phase 3 / Plan 03-02 / D-104 + Open Q1 — Chart palette invariants.
// Source of truth: 03-UI-SPEC.md § Chart Palettes (lines 290-385).
// Open Q1 lock: SESSION_STATUS_COLOR includes 'completed' as 5th key
// (#64748b slate-500) — referenced by TPC App migration
// 20260320000000_add_completed_status.sql.

describe('AI_STATUS_COLOR', () => {
  it("AI_STATUS_COLOR.failed === '#dc2626' (red-600)", () => {
    expect(AI_STATUS_COLOR.failed).toBe('#dc2626');
  });

  it('all 5 AI status keys defined with 7-char hex strings', () => {
    const keys: AiStatus[] = ['pending', 'processing', 'queued', 'done', 'failed'];
    for (const k of keys) {
      const v = AI_STATUS_COLOR[k];
      expect(v).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('keys exactly match the AiStatus type union', () => {
    expect(Object.keys(AI_STATUS_COLOR).sort()).toEqual(
      ['pending', 'processing', 'queued', 'done', 'failed'].sort(),
    );
  });
});

describe('SESSION_STATUS_COLOR', () => {
  it("includes 'completed' as 5th key (#64748b — Open Q1 lock)", () => {
    expect(SESSION_STATUS_COLOR.completed).toBe('#64748b');
  });

  it('all 5 SessionStatus keys present (active, submitted, returned, exported, completed)', () => {
    const keys: SessionStatus[] = [
      'active',
      'submitted',
      'returned',
      'exported',
      'completed',
    ];
    for (const k of keys) {
      const v = SESSION_STATUS_COLOR[k];
      expect(v).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(Object.keys(SESSION_STATUS_COLOR).sort()).toEqual(keys.sort());
  });

  it('categorical reuse: submitted=#0284c7, returned=#d97706, exported=#16a34a, active=#94a3b8', () => {
    expect(SESSION_STATUS_COLOR.submitted).toBe('#0284c7');
    expect(SESSION_STATUS_COLOR.returned).toBe('#d97706');
    expect(SESSION_STATUS_COLOR.exported).toBe('#16a34a');
    expect(SESSION_STATUS_COLOR.active).toBe('#94a3b8');
  });
});

describe('SESSION_MODE_COLOR', () => {
  it("SESSION_MODE_COLOR.house === '#4f46e5' (indigo-600 — distinct from accent #2563eb)", () => {
    expect(SESSION_MODE_COLOR.house).toBe('#4f46e5');
  });
  it("SESSION_MODE_COLOR.sale === '#0d9488' (teal-600)", () => {
    expect(SESSION_MODE_COLOR.sale).toBe('#0d9488');
  });
  it('exactly 2 SessionMode keys (house, sale)', () => {
    const keys: SessionMode[] = ['house', 'sale'];
    expect(Object.keys(SESSION_MODE_COLOR).sort()).toEqual(keys.sort());
  });
});

describe('SPECIALIST_COLOR_CYCLE', () => {
  it('length === 8', () => {
    expect(SPECIALIST_COLOR_CYCLE).toHaveLength(8);
  });

  it("first element === '#0284c7' (sky-600)", () => {
    expect(SPECIALIST_COLOR_CYCLE[0]).toBe('#0284c7');
  });

  it("last element === '#475569' (slate-600 — UI-SPEC commits slate-600 at END)", () => {
    expect(SPECIALIST_COLOR_CYCLE[7]).toBe('#475569');
  });

  it('every entry is a 7-char hex string', () => {
    for (const v of SPECIALIST_COLOR_CYCLE) {
      expect(v).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe('colorForSpecialist', () => {
  it("colorForSpecialist('a@x.com', ['a@x.com','b@x.com','c@x.com']) === sky-600 (#0284c7)", () => {
    const sorted = ['a@x.com', 'b@x.com', 'c@x.com'];
    expect(colorForSpecialist('a@x.com', sorted)).toBe('#0284c7');
  });

  it("colorForSpecialist('b@x.com', ['a@x.com','b@x.com']) === teal-600 (#0d9488 — index 1)", () => {
    const sorted = ['a@x.com', 'b@x.com'];
    expect(colorForSpecialist('b@x.com', sorted)).toBe('#0d9488');
  });

  it('deterministic — same input always returns same output', () => {
    const sorted = ['z@x.com', 'a@x.com'];
    const first = colorForSpecialist('z@x.com', sorted);
    const second = colorForSpecialist('z@x.com', sorted);
    expect(first).toBe(second);
  });

  it("absent email falls back to SPECIALIST_COLOR_CYCLE[0] (per UI-SPEC 'if (i < 0) return cycle[0]')", () => {
    const sorted = ['a@x.com', 'b@x.com'];
    expect(colorForSpecialist('absent@x.com', sorted)).toBe(
      SPECIALIST_COLOR_CYCLE[0],
    );
  });

  it('cycles when index exceeds length-1 (modulo)', () => {
    // Construct 9-specialist sorted list; the 9th maps back to cycle[0].
    const sorted = [
      'a@x.com',
      'b@x.com',
      'c@x.com',
      'd@x.com',
      'e@x.com',
      'f@x.com',
      'g@x.com',
      'h@x.com',
      'i@x.com',
    ];
    expect(colorForSpecialist('i@x.com', sorted)).toBe(
      SPECIALIST_COLOR_CYCLE[0],
    );
  });
});
