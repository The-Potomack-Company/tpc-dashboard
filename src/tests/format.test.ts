import { describe, it, expect } from 'vitest';
import {
  EMPTY,
  formatCurrency,
  formatPercent,
  formatCount,
  formatDate,
  formatEstimateRange,
  formatPaymentStatus,
} from '../lib/format';

// Phase 3 Plan 01 Task 2 — formatter behavior contract locked by
// .planning/phases/03-sale-views/03-UI-SPEC.md § Typography numeric formatting table
// and this plan's <behavior> block.

describe('EMPTY constant', () => {
  it('equals U+2014 em-dash exactly', () => {
    expect(EMPTY).toBe('—');
    // Defensive: ensure it is not a hyphen or the U+2013 en-dash.
    expect(EMPTY).not.toBe('-');
    expect(EMPTY).not.toBe('–');
    expect(EMPTY).not.toBe('N/A');
  });
});

describe('formatCurrency', () => {
  it('formats a positive amount as USD with grouping and two decimals', () => {
    expect(formatCurrency(1234567.89)).toBe('$1,234,567.89');
  });

  it('formats zero with two decimals', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });

  it('returns EMPTY for null', () => {
    expect(formatCurrency(null)).toBe(EMPTY);
  });

  it('returns EMPTY for undefined', () => {
    expect(formatCurrency(undefined)).toBe(EMPTY);
  });
});

describe('formatPercent', () => {
  it('formats a ratio to one-decimal percentage', () => {
    expect(formatPercent(0.684)).toBe('68.4%');
  });

  it('formats 1 as 100.0%', () => {
    expect(formatPercent(1)).toBe('100.0%');
  });

  it('formats 0 as 0.0%', () => {
    expect(formatPercent(0)).toBe('0.0%');
  });

  it('returns EMPTY for null', () => {
    expect(formatPercent(null)).toBe(EMPTY);
  });

  it('returns EMPTY for undefined', () => {
    expect(formatPercent(undefined)).toBe(EMPTY);
  });
});

describe('formatCount', () => {
  it('formats a thousands-grouped integer', () => {
    expect(formatCount(1247)).toBe('1,247');
  });

  it('formats zero', () => {
    expect(formatCount(0)).toBe('0');
  });

  it('returns EMPTY for null', () => {
    expect(formatCount(null)).toBe(EMPTY);
  });

  it('returns EMPTY for undefined', () => {
    expect(formatCount(undefined)).toBe(EMPTY);
  });
});

describe('formatDate', () => {
  it('formats an ISO date string as "Mon D, YYYY" without TZ shift', () => {
    expect(formatDate('2022-11-16')).toBe('Nov 16, 2022');
  });

  it('returns EMPTY for null', () => {
    expect(formatDate(null)).toBe(EMPTY);
  });

  it('returns EMPTY for undefined', () => {
    expect(formatDate(undefined)).toBe(EMPTY);
  });

  it('returns EMPTY for a garbage string (NaN-safe)', () => {
    expect(formatDate('not-a-date')).toBe(EMPTY);
  });
});

describe('formatEstimateRange', () => {
  const EN_DASH = '–';

  it('joins low and high with a U+2013 en-dash between formatted currency values', () => {
    expect(formatEstimateRange(500000, 800000)).toBe(
      '$500,000.00 ' + EN_DASH + ' $800,000.00',
    );
  });

  it('returns the single high value when low is null', () => {
    expect(formatEstimateRange(null, 800000)).toBe('$800,000.00');
  });

  it('returns the single low value when high is null', () => {
    expect(formatEstimateRange(500000, null)).toBe('$500,000.00');
  });

  it('returns EMPTY when both are null', () => {
    expect(formatEstimateRange(null, null)).toBe(EMPTY);
  });
});

describe('formatPaymentStatus', () => {
  it('maps "paid" to "Paid"', () => {
    expect(formatPaymentStatus('paid')).toBe('Paid');
  });

  it('maps "partial" to "Partial"', () => {
    expect(formatPaymentStatus('partial')).toBe('Partial');
  });

  it('maps "unpaid" to "Unpaid"', () => {
    expect(formatPaymentStatus('unpaid')).toBe('Unpaid');
  });

  it('returns EMPTY for null', () => {
    expect(formatPaymentStatus(null)).toBe(EMPTY);
  });

  it('returns EMPTY for undefined', () => {
    expect(formatPaymentStatus(undefined)).toBe(EMPTY);
  });

  it('returns EMPTY for an unrecognized value (defensive)', () => {
    expect(formatPaymentStatus('garbage')).toBe(EMPTY);
  });
});
