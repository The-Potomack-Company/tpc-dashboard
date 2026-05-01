import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router';
import type { ReactNode } from 'react';
import { useModeFilter } from './useModeFilter';

// Phase 3 / APP-09 / D-20 — URL-state session-mode toggle. Default = 'all'
// (NO ?mode= URL param). 'house' | 'sale' filters server-side via
// sessions.mode. Defensive parse: invalid values fall back to 'all'.

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

function useModeFilterWithLocation() {
  const mfv = useModeFilter();
  const loc = useLocation();
  return { ...mfv, search: loc.search };
}

describe('useModeFilter', () => {
  it("returns 'all' when no ?mode= param is present (D-21 default)", () => {
    const { result } = renderHook(() => useModeFilter(), {
      wrapper: makeWrapper(['/']),
    });
    expect(result.current.mode).toBe('all');
  });

  it("parses ?mode=house into mode === 'house'", () => {
    const { result } = renderHook(() => useModeFilter(), {
      wrapper: makeWrapper(['/?mode=house']),
    });
    expect(result.current.mode).toBe('house');
  });

  it("parses ?mode=sale into mode === 'sale'", () => {
    const { result } = renderHook(() => useModeFilter(), {
      wrapper: makeWrapper(['/?mode=sale']),
    });
    expect(result.current.mode).toBe('sale');
  });

  it("falls back to 'all' on invalid value (defensive parse)", () => {
    const { result } = renderHook(() => useModeFilter(), {
      wrapper: makeWrapper(['/?mode=invalid']),
    });
    expect(result.current.mode).toBe('all');
  });

  it("setMode('all') removes the ?mode= param entirely", () => {
    const { result } = renderHook(() => useModeFilterWithLocation(), {
      wrapper: makeWrapper(['/?mode=house&range=7d']),
    });
    act(() => result.current.setMode('all'));
    const params = new URLSearchParams(result.current.search);
    expect(params.has('mode')).toBe(false);
    expect(params.get('range')).toBe('7d'); // sibling preserved
  });

  it("setMode('sale') writes ?mode=sale", () => {
    const { result } = renderHook(() => useModeFilterWithLocation(), {
      wrapper: makeWrapper(['/']),
    });
    act(() => result.current.setMode('sale'));
    const params = new URLSearchParams(result.current.search);
    expect(params.get('mode')).toBe('sale');
  });

  it('setMode does NOT touch range / from / to / specialists siblings (single-closure preserves)', () => {
    const { result } = renderHook(() => useModeFilterWithLocation(), {
      wrapper: makeWrapper([
        '/?range=custom&from=2026-04-01&to=2026-04-15&specialists=a@x.com',
      ]),
    });
    act(() => result.current.setMode('house'));
    const params = new URLSearchParams(result.current.search);
    expect(params.get('range')).toBe('custom');
    expect(params.get('from')).toBe('2026-04-01');
    expect(params.get('to')).toBe('2026-04-15');
    expect(params.get('specialists')).toBe('a@x.com');
    expect(params.get('mode')).toBe('house');
  });

  it('round-trips: read URL → mode; setMode(value) → URL → re-read produces same value', () => {
    const { result } = renderHook(() => useModeFilterWithLocation(), {
      wrapper: makeWrapper(['/']),
    });
    act(() => result.current.setMode('house'));
    expect(result.current.mode).toBe('house');
    expect(new URLSearchParams(result.current.search).get('mode')).toBe('house');
  });
});
