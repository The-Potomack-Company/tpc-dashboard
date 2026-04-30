import { describe, it, expect } from 'vitest';
import { formatPercent, formatCount, formatTimestampShort, EMPTY } from './format';

describe('formatPercent', () => {
  it('returns one-decimal percent by default', () => {
    expect(formatPercent(12.345)).toBe('12.3%');
  });

  it('respects custom precision', () => {
    expect(formatPercent(12.345, 2)).toBe('12.35%');
    expect(formatPercent(0, 0)).toBe('0%');
  });

  it('returns EMPTY for null, undefined, and NaN', () => {
    expect(formatPercent(null)).toBe(EMPTY);
    expect(formatPercent(undefined)).toBe(EMPTY);
    expect(formatPercent(Number.NaN)).toBe(EMPTY);
  });
});

describe('formatCount', () => {
  it('comma-groups thousands in en-US locale', () => {
    expect(formatCount(1247)).toBe('1,247');
    expect(formatCount(1000000)).toBe('1,000,000');
    expect(formatCount(0)).toBe('0');
  });

  it('returns EMPTY for null/undefined/NaN', () => {
    expect(formatCount(null)).toBe(EMPTY);
    expect(formatCount(undefined)).toBe(EMPTY);
    expect(formatCount(Number.NaN)).toBe(EMPTY);
  });
});

describe('formatTimestampShort', () => {
  it('formats UTC ISO into MM/dd HH:mm in America/New_York (EDT in April)', () => {
    // 2026-04-29T18:15:00Z is 14:15 EDT (UTC-4)
    expect(formatTimestampShort('2026-04-29T18:15:00Z')).toBe('04/29 14:15');
  });

  it('formats UTC ISO during EST (January, UTC-5)', () => {
    // 2026-01-15T18:15:00Z is 13:15 EST
    expect(formatTimestampShort('2026-01-15T18:15:00Z')).toBe('01/15 13:15');
  });

  it('accepts Date and ISO string interchangeably for the same instant', () => {
    const iso = '2026-04-29T18:15:00Z';
    expect(formatTimestampShort(new Date(iso))).toBe(formatTimestampShort(iso));
  });
});

describe('EMPTY', () => {
  it('is the U+2014 em-dash character exactly', () => {
    expect(EMPTY).toBe('—');
    expect(EMPTY.charCodeAt(0)).toBe(0x2014);
  });
});
