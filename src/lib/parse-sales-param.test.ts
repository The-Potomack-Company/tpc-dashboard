// Phase 6 Plan 06-04 — Tests for parseSalesParam.
// Contract: .planning/phases/06-department-analysis-sale-comparison/06-04-PLAN.md
// § Task 1 behavior block.

import { describe, it, expect } from 'vitest';
import { parseSalesParam, CSV_SEPARATOR } from './parse-sales-param';

describe('parseSalesParam', () => {
  it('T1: null input returns invalid/empty', () => {
    expect(parseSalesParam(null)).toEqual({ kind: 'invalid', reason: 'empty' });
  });

  it("T2: '' input returns invalid/empty", () => {
    expect(parseSalesParam('')).toEqual({ kind: 'invalid', reason: 'empty' });
  });

  it('T3: whitespace-only input returns invalid/empty', () => {
    expect(parseSalesParam('   ')).toEqual({
      kind: 'invalid',
      reason: 'empty',
    });
  });

  it('T4: single sale number returns invalid/too-few', () => {
    expect(parseSalesParam('2024-01')).toEqual({
      kind: 'invalid',
      reason: 'too-few',
    });
  });

  it('T5: five sale numbers returns invalid/too-many', () => {
    expect(
      parseSalesParam('2024-01,2024-02,2024-03,2024-04,2024-05'),
    ).toEqual({ kind: 'invalid', reason: 'too-many' });
  });

  it('T6: two valid sale numbers returns ok with preserved order', () => {
    const result = parseSalesParam('2024-01,2024-02');
    expect(result).toEqual({
      kind: 'ok',
      saleNumbers: ['2024-01', '2024-02'],
    });
  });

  it('T7: preserves caller-supplied order (not sorted)', () => {
    const result = parseSalesParam('2024-02,2024-01');
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.saleNumbers).toEqual(['2024-02', '2024-01']);
    }
  });

  it('T8: malformed token with <script> returns invalid/malformed', () => {
    expect(parseSalesParam('2024-01,<script>')).toEqual({
      kind: 'invalid',
      reason: 'malformed',
    });
  });

  it('T9: duplicate entries are deduped preserving first-seen order', () => {
    const result = parseSalesParam('2024-01,2024-01,2024-02');
    expect(result).toEqual({
      kind: 'ok',
      saleNumbers: ['2024-01', '2024-02'],
    });
  });

  it('T10: IT-prefixed codes with hyphen are accepted', () => {
    const result = parseSalesParam('IT-001,IT-002');
    expect(result).toEqual({
      kind: 'ok',
      saleNumbers: ['IT-001', 'IT-002'],
    });
  });

  it('CSV_SEPARATOR is the comma character', () => {
    expect(CSV_SEPARATOR).toBe(',');
  });
});
