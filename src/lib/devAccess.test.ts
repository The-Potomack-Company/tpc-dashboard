import { describe, it, expect } from 'vitest';
import { isDevAccount, DEV_EMAILS } from './devAccess';

describe('isDevAccount', () => {
  it('returns true for the allowlisted email', () => {
    expect(isDevAccount('josh@potomackco.com')).toBe(true);
  });

  it('is case-insensitive (RFC 5321)', () => {
    expect(isDevAccount('JOSH@POTOMACKCO.COM')).toBe(true);
    expect(isDevAccount('Josh@Potomackco.com')).toBe(true);
  });

  it('returns false for non-allowlist emails', () => {
    expect(isDevAccount('admin@example.com')).toBe(false);
  });

  it('returns false for null / undefined / empty string', () => {
    expect(isDevAccount(null)).toBe(false);
    expect(isDevAccount(undefined)).toBe(false);
    expect(isDevAccount('')).toBe(false);
  });
});

describe('DEV_EMAILS', () => {
  it('contains exactly the locked Phase 2 allowlist', () => {
    expect(DEV_EMAILS).toEqual(['josh@potomackco.com']);
  });
});
