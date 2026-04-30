import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router';
import type { ReactNode } from 'react';
import { useUserFilter } from './useUserFilter';

// Mirrors src/hooks/useDateRange.test.tsx lines 9-27. Same wrapper convention.
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

function useUserFilterWithLocation() {
  const ufv = useUserFilter();
  const loc = useLocation();
  return { ...ufv, search: loc.search };
}

describe('useUserFilter', () => {
  it('returns empty array when no ?users= param is present', () => {
    const { result } = renderHook(() => useUserFilter(), {
      wrapper: makeWrapper(['/']),
    });
    expect(result.current.users).toEqual([]);
  });

  it('parses ?users=a@x.com,b@y.com into [a@x.com, b@y.com] in URL insertion order (D-17)', () => {
    const { result } = renderHook(() => useUserFilter(), {
      wrapper: makeWrapper(['/?users=a@x.com,b@y.com']),
    });
    expect(result.current.users).toEqual(['a@x.com', 'b@y.com']);
  });

  it('setUsers([c@z.com]) writes ?users=c@z.com and replaces previous values', () => {
    const { result } = renderHook(() => useUserFilterWithLocation(), {
      wrapper: makeWrapper(['/?users=a@x.com,b@y.com']),
    });
    act(() => result.current.setUsers(['c@z.com']));
    const params = new URLSearchParams(result.current.search);
    expect(params.get('users')).toBe('c@z.com');
  });

  it('setUsers([]) removes the ?users= param entirely (no empty value left behind)', () => {
    const { result } = renderHook(() => useUserFilterWithLocation(), {
      wrapper: makeWrapper(['/?users=a@x.com&range=7d']),
    });
    act(() => result.current.setUsers([]));
    const params = new URLSearchParams(result.current.search);
    expect(params.has('users')).toBe(false);
    expect(params.get('range')).toBe('7d'); // sibling preserved
  });

  it('setUsers does NOT touch range / from / to / versions siblings (single-closure preserves)', () => {
    const { result } = renderHook(() => useUserFilterWithLocation(), {
      wrapper: makeWrapper(['/?range=custom&from=2026-04-01&to=2026-04-15&versions=2.0.1']),
    });
    act(() => result.current.setUsers(['a@x.com']));
    const params = new URLSearchParams(result.current.search);
    expect(params.get('range')).toBe('custom');
    expect(params.get('from')).toBe('2026-04-01');
    expect(params.get('to')).toBe('2026-04-15');
    expect(params.get('versions')).toBe('2.0.1');
    expect(params.get('users')).toBe('a@x.com');
  });

  it('handles ?users= (empty value) by returning [] — guard against ".split(",")" producing [""]', () => {
    const { result } = renderHook(() => useUserFilter(), {
      wrapper: makeWrapper(['/?users=']),
    });
    expect(result.current.users).toEqual([]);
  });

  it('round-trips: read URL → users array; setUsers(arr) → URL → re-read produces same array', () => {
    const { result } = renderHook(() => useUserFilterWithLocation(), {
      wrapper: makeWrapper(['/']),
    });
    act(() => result.current.setUsers(['a@x.com', 'b@y.com']));
    expect(result.current.users).toEqual(['a@x.com', 'b@y.com']);
    // URL value should round-trip; URLSearchParams.get returns decoded.
    expect(new URLSearchParams(result.current.search).get('users')).toBe('a@x.com,b@y.com');
  });
});
