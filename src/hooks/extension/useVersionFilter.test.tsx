import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router';
import type { ReactNode } from 'react';
import { useVersionFilter } from './useVersionFilter';

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

function useVersionFilterWithLocation() {
  const vfv = useVersionFilter();
  const loc = useLocation();
  return { ...vfv, search: loc.search };
}

describe('useVersionFilter', () => {
  it('returns empty array when no ?versions= param is present', () => {
    const { result } = renderHook(() => useVersionFilter(), {
      wrapper: makeWrapper(['/']),
    });
    expect(result.current.versions).toEqual([]);
  });

  it('parses ?versions=2.0.1,2.0.2 into [2.0.1, 2.0.2] in URL insertion order (D-17)', () => {
    const { result } = renderHook(() => useVersionFilter(), {
      wrapper: makeWrapper(['/?versions=2.0.1,2.0.2']),
    });
    expect(result.current.versions).toEqual(['2.0.1', '2.0.2']);
  });

  it('setVersions([2.0.3]) writes ?versions=2.0.3 and replaces previous values', () => {
    const { result } = renderHook(() => useVersionFilterWithLocation(), {
      wrapper: makeWrapper(['/?versions=2.0.1,2.0.2']),
    });
    act(() => result.current.setVersions(['2.0.3']));
    const params = new URLSearchParams(result.current.search);
    expect(params.get('versions')).toBe('2.0.3');
  });

  it('setVersions([]) does NOT touch the users param (single-closure preserves siblings)', () => {
    const { result } = renderHook(() => useVersionFilterWithLocation(), {
      wrapper: makeWrapper(['/?users=a@x.com&versions=2.0.1']),
    });
    act(() => result.current.setVersions([]));
    const params = new URLSearchParams(result.current.search);
    expect(params.has('versions')).toBe(false);
    expect(params.get('users')).toBe('a@x.com');
  });

  it('setVersions does NOT touch range / from / to siblings', () => {
    const { result } = renderHook(() => useVersionFilterWithLocation(), {
      wrapper: makeWrapper(['/?range=custom&from=2026-04-01&to=2026-04-15&users=a@x.com']),
    });
    act(() => result.current.setVersions(['2.0.1']));
    const params = new URLSearchParams(result.current.search);
    expect(params.get('range')).toBe('custom');
    expect(params.get('from')).toBe('2026-04-01');
    expect(params.get('to')).toBe('2026-04-15');
    expect(params.get('users')).toBe('a@x.com');
    expect(params.get('versions')).toBe('2.0.1');
  });

  it('handles ?versions= (empty value) by returning [] — guard against split producing [""]', () => {
    const { result } = renderHook(() => useVersionFilter(), {
      wrapper: makeWrapper(['/?versions=']),
    });
    expect(result.current.versions).toEqual([]);
  });
});
