import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router';
import type { ReactNode } from 'react';
import { useDateRange } from './useDateRange';

// Helper: render a hook inside a MemoryRouter entry + surface the current
// search string so assertions can read `?range=...&from=...&to=...`.
function makeWrapper(initialEntries: string[]) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="*" element={<>{children}</>} />
        </Routes>
      </MemoryRouter>
    );
  };
}

// Separate helper hook that returns both the useDateRange value AND the
// current location.search so tests can assert URL mutations.
function useDateRangeWithLocation() {
  const drv = useDateRange();
  const loc = useLocation();
  return { ...drv, search: loc.search };
}

describe('useDateRange', () => {
  it('defaults to 7d when no range param is present (D-17)', () => {
    const { result } = renderHook(() => useDateRange(), {
      wrapper: makeWrapper(['/']),
    });
    expect(result.current.range).toBe('7d');
  });

  it('reads range=today from URL', () => {
    const { result } = renderHook(() => useDateRange(), {
      wrapper: makeWrapper(['/?range=today']),
    });
    expect(result.current.range).toBe('today');
  });

  it('30d preset sets from ~29 days before to (span of 30 days inclusive)', () => {
    const { result } = renderHook(() => useDateRange(), {
      wrapper: makeWrapper(['/?range=30d']),
    });
    const msPerDay = 24 * 60 * 60 * 1000;
    const spanDays = Math.round(
      (result.current.to.getTime() - result.current.from.getTime()) / msPerDay,
    );
    // endOfDay - startOfDay over 30 inclusive days = ~29.999... days, rounds to 30.
    expect(spanDays).toBe(30);
  });

  it('custom range parses ISO dates from URL', () => {
    const { result } = renderHook(() => useDateRange(), {
      wrapper: makeWrapper(['/?range=custom&from=2026-04-01&to=2026-04-15']),
    });
    expect(result.current.range).toBe('custom');
    // `from` is start-of-day local; ISO date portion should match input.
    // We compare YYYY-MM-DD of from.
    const fromIso = `${result.current.from.getFullYear()}-${String(result.current.from.getMonth() + 1).padStart(2, '0')}-${String(result.current.from.getDate()).padStart(2, '0')}`;
    expect(fromIso).toBe('2026-04-01');
  });

  it('custom with missing from/to falls back to 7d behavior silently', () => {
    const { result } = renderHook(() => useDateRange(), {
      wrapper: makeWrapper(['/?range=custom']),
    });
    // range reflects URL (custom) but from/to fall back to 7d resolution.
    expect(result.current.range).toBe('custom');
    const msPerDay = 24 * 60 * 60 * 1000;
    const spanDays = Math.round(
      (result.current.to.getTime() - result.current.from.getTime()) / msPerDay,
    );
    expect(spanDays).toBe(7);
  });

  it('invalid preset (?range=banana) falls back to 7d', () => {
    const { result } = renderHook(() => useDateRange(), {
      wrapper: makeWrapper(['/?range=banana']),
    });
    expect(result.current.range).toBe('7d');
  });

  it('setRange(30d) from a custom URL writes ?range=30d and removes from/to (single-closure merge)', () => {
    const { result } = renderHook(() => useDateRangeWithLocation(), {
      wrapper: makeWrapper(['/?range=custom&from=2026-04-01&to=2026-04-15']),
    });
    act(() => result.current.setRange('30d'));
    expect(result.current.search).toBe('?range=30d');
    // Assert from/to are not in the URL
    const params = new URLSearchParams(result.current.search);
    expect(params.has('from')).toBe(false);
    expect(params.has('to')).toBe(false);
  });

  it('setCustom writes range=custom + from + to in one URL mutation', () => {
    const { result } = renderHook(() => useDateRangeWithLocation(), {
      wrapper: makeWrapper(['/?range=7d']),
    });
    act(() =>
      result.current.setCustom(new Date('2026-04-01T12:00:00'), new Date('2026-04-15T12:00:00')),
    );
    const params = new URLSearchParams(result.current.search);
    expect(params.get('range')).toBe('custom');
    expect(params.get('from')).toBe('2026-04-01');
    expect(params.get('to')).toBe('2026-04-15');
  });

  it('URL idempotency: setRange(7d) when already on 7d updates URL to ?range=7d exactly', () => {
    const { result } = renderHook(() => useDateRangeWithLocation(), {
      wrapper: makeWrapper(['/']),
    });
    // Start with no params (resolves to 7d).
    expect(result.current.range).toBe('7d');
    act(() => result.current.setRange('7d'));
    // URL now explicitly carries ?range=7d.
    expect(result.current.search).toBe('?range=7d');
  });
});
