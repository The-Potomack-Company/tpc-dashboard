import { describe, it, expect } from 'vitest';
import {
  parseMoney,
  parseCount,
  parseMoneyRange,
  parseLotsSold,
  parseAuctionedLots,
} from '../lib/parsers/numeric.js';

describe('parseMoney', () => {
  it('parses standard money with commas', () => {
    expect(parseMoney('$1,234,567.89')).toBe(1234567.89);
  });

  it('treats $.NULL. as null', () => {
    expect(parseMoney('$.NULL.')).toBeNull();
  });

  it('parses negative money with hyphen after $', () => {
    expect(parseMoney('$-1,931.40')).toBe(-1931.4);
  });

  it('parses zero', () => {
    expect(parseMoney('$0.00')).toBe(0);
  });

  it('returns null for empty string', () => {
    expect(parseMoney('')).toBeNull();
  });

  it('returns null for null', () => {
    expect(parseMoney(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(parseMoney(undefined)).toBeNull();
  });

  it('returns null for garbage', () => {
    expect(parseMoney('garbage')).toBeNull();
  });
});

describe('parseCount', () => {
  it('parses a plain integer', () => {
    expect(parseCount('424')).toBe(424);
  });

  it('parses with commas', () => {
    expect(parseCount('1,234')).toBe(1234);
  });

  it('accepts negative counts (Lots Not Paid can be -1)', () => {
    expect(parseCount('-1')).toBe(-1);
  });

  it('returns null for empty string', () => {
    expect(parseCount('')).toBeNull();
  });
});

describe('parseMoneyRange', () => {
  it('parses standard range', () => {
    expect(parseMoneyRange('$629,925-946,355')).toEqual({ low: 629925, high: 946355 });
  });

  it('treats trailing -0 as no upper bound (sentinel)', () => {
    expect(parseMoneyRange('$30,000-0')).toEqual({ low: 30000, high: null });
  });

  it('keeps 0-0 range', () => {
    expect(parseMoneyRange('$0-0')).toEqual({ low: 0, high: 0 });
  });

  it('returns nulls for garbage', () => {
    expect(parseMoneyRange('garbage')).toEqual({ low: null, high: null });
  });
});

describe('parseLotsSold', () => {
  it('parses count and sell-through percent', () => {
    expect(parseLotsSold('424 (99% not incl. withdrawn)')).toEqual({
      count: 424,
      sellThroughPct: 99,
    });
  });

  it('parses decimal sell-through percent', () => {
    expect(parseLotsSold('424 (99.5% not incl. withdrawn)')).toEqual({
      count: 424,
      sellThroughPct: 99.5,
    });
  });

  it('parses count only when no parenthetical', () => {
    expect(parseLotsSold('0')).toEqual({ count: 0, sellThroughPct: null });
  });
});

describe('parseAuctionedLots', () => {
  it('parses count with withdrawn suffix', () => {
    const result = parseAuctionedLots('33 (1 Withdrawn)');
    expect(result.count).toBe(33);
  });

  it('parses plain count', () => {
    const result = parseAuctionedLots('428');
    expect(result.count).toBe(428);
  });
});
