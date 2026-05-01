import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router';
import type { ReactNode } from 'react';
import { useSpecialistFilter } from './useSpecialistFilter';

// Phase 3 / APP-08 / D-21 — URL-state specialist filter, comma-separated
// single-key form. Mirrors src/hooks/extension/useUserFilter.test.tsx exactly.

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

function useSpecialistFilterWithLocation() {
  const sfv = useSpecialistFilter();
  const loc = useLocation();
  return { ...sfv, search: loc.search };
}

describe('useSpecialistFilter', () => {
  it('returns empty array when no ?specialists= param is present', () => {
    const { result } = renderHook(() => useSpecialistFilter(), {
      wrapper: makeWrapper(['/']),
    });
    expect(result.current.specialists).toEqual([]);
  });

  it('parses ?specialists=a@x.com,b@x.com into [a@x.com, b@x.com] in URL insertion order (D-21)', () => {
    const { result } = renderHook(() => useSpecialistFilter(), {
      wrapper: makeWrapper(['/?specialists=a@x.com,b@x.com']),
    });
    expect(result.current.specialists).toEqual(['a@x.com', 'b@x.com']);
  });

  it('setSpecialists([c@z.com]) writes ?specialists=c@z.com and replaces previous values', () => {
    const { result } = renderHook(() => useSpecialistFilterWithLocation(), {
      wrapper: makeWrapper(['/?specialists=a@x.com,b@x.com']),
    });
    act(() => result.current.setSpecialists(['c@z.com']));
    const params = new URLSearchParams(result.current.search);
    expect(params.get('specialists')).toBe('c@z.com');
  });

  it('setSpecialists([]) removes the ?specialists= param entirely (no empty value left behind)', () => {
    const { result } = renderHook(() => useSpecialistFilterWithLocation(), {
      wrapper: makeWrapper(['/?specialists=a@x.com&range=7d']),
    });
    act(() => result.current.setSpecialists([]));
    const params = new URLSearchParams(result.current.search);
    expect(params.has('specialists')).toBe(false);
    expect(params.get('range')).toBe('7d'); // sibling preserved
  });

  it('setSpecialists does NOT touch range / from / to / mode siblings (single-closure preserves)', () => {
    const { result } = renderHook(() => useSpecialistFilterWithLocation(), {
      wrapper: makeWrapper(['/?range=custom&from=2026-04-01&to=2026-04-15&mode=house']),
    });
    act(() => result.current.setSpecialists(['a@x.com']));
    const params = new URLSearchParams(result.current.search);
    expect(params.get('range')).toBe('custom');
    expect(params.get('from')).toBe('2026-04-01');
    expect(params.get('to')).toBe('2026-04-15');
    expect(params.get('mode')).toBe('house');
    expect(params.get('specialists')).toBe('a@x.com');
  });

  it('handles ?specialists= (empty value) by returning [] — guard against ".split(",")" producing [""]', () => {
    const { result } = renderHook(() => useSpecialistFilter(), {
      wrapper: makeWrapper(['/?specialists=']),
    });
    expect(result.current.specialists).toEqual([]);
  });

  it('round-trips: read URL → specialists array; setSpecialists(arr) → URL → re-read produces same array', () => {
    const { result } = renderHook(() => useSpecialistFilterWithLocation(), {
      wrapper: makeWrapper(['/']),
    });
    act(() => result.current.setSpecialists(['a@x.com', 'b@y.com']));
    expect(result.current.specialists).toEqual(['a@x.com', 'b@y.com']);
    expect(new URLSearchParams(result.current.search).get('specialists')).toBe(
      'a@x.com,b@y.com',
    );
  });
});
