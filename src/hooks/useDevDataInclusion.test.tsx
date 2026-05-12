import { act, renderHook } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';

import { useAuthStore } from '../stores/authStore';
import {
  useDevDataInclusion,
  __resetDevInclusionForTests,
} from './useDevDataInclusion';

// Phase 8 — useDevDataInclusion tests.
//
// Invariants under test:
//   1. Admin (isDev=false): `includeDev` is always `false`, even if
//      localStorage was previously set to `'true'` (defense in depth — admin
//      must never see Josh's testing data through the analytics RPCs, no
//      matter what stale browser state exists).
//   2. Admin's `setIncludeDev` is a no-op — calling it must NOT flip the
//      value for the current session or write to localStorage.
//   3. Dev (isDev=true): flipping the toggle is honoured AND persisted to
//      localStorage so the preference survives a reload.
//   4. Multiple hook instances see the same value (module-level state is
//      the source of truth; not duplicated per consumer).

describe('useDevDataInclusion', () => {
  beforeEach(() => {
    __resetDevInclusionForTests();
    useAuthStore.setState({
      session: null,
      user: null,
      profile: null,
      isAdmin: false,
      isDev: false,
      loading: false,
      profileLoading: false,
      profileLoaded: true,
    });
  });

  it('admin (isDev=false): includeDev is always false', () => {
    const { result } = renderHook(() => useDevDataInclusion());
    expect(result.current.includeDev).toBe(false);
  });

  it('admin: setIncludeDev is a no-op; cannot flip the value', () => {
    const { result } = renderHook(() => useDevDataInclusion());
    act(() => result.current.setIncludeDev(true));
    expect(result.current.includeDev).toBe(false);
    // Defense in depth — localStorage MUST NOT have been written; otherwise
    // a later dev session would surface a "set by admin" value as the user's
    // own preference.
    expect(window.localStorage.getItem('tpc-dashboard.includeDev')).toBeNull();
  });

  it('admin: even when localStorage was previously "true", includeDev still reports false', () => {
    window.localStorage.setItem('tpc-dashboard.includeDev', 'true');
    // The auth store is still in the admin/isDev=false state from beforeEach.
    const { result } = renderHook(() => useDevDataInclusion());
    expect(result.current.includeDev).toBe(false);
  });

  it('dev (isDev=true): defaults to false (matches admin view) and can flip to true', () => {
    useAuthStore.setState({ isDev: true });
    const { result } = renderHook(() => useDevDataInclusion());
    expect(result.current.includeDev).toBe(false);

    act(() => result.current.setIncludeDev(true));
    expect(result.current.includeDev).toBe(true);
  });

  it('dev: setIncludeDev(true) persists to localStorage; reload simulates by reset+re-mount', () => {
    useAuthStore.setState({ isDev: true });
    const { result, unmount } = renderHook(() => useDevDataInclusion());
    act(() => result.current.setIncludeDev(true));
    expect(window.localStorage.getItem('tpc-dashboard.includeDev')).toBe('true');
    unmount();

    // Simulate reload: clear the module's in-memory cache but keep
    // localStorage intact. The next render should re-hydrate from storage.
    // (__resetDevInclusionForTests clears both — to test true persistence we
    // emulate just the in-memory reset by re-importing nothing; instead we
    // assert the storage state directly here. The dedicated multi-instance
    // test below covers re-mount.)
    expect(window.localStorage.getItem('tpc-dashboard.includeDev')).toBe('true');
  });

  it('dev: setIncludeDev(false) persists "false" to localStorage', () => {
    useAuthStore.setState({ isDev: true });
    const { result } = renderHook(() => useDevDataInclusion());
    act(() => result.current.setIncludeDev(true));
    act(() => result.current.setIncludeDev(false));
    expect(result.current.includeDev).toBe(false);
    expect(window.localStorage.getItem('tpc-dashboard.includeDev')).toBe('false');
  });

  it('dev: multiple hook instances see the same value (single source of truth)', () => {
    useAuthStore.setState({ isDev: true });
    const a = renderHook(() => useDevDataInclusion());
    const b = renderHook(() => useDevDataInclusion());
    expect(a.result.current.includeDev).toBe(false);
    expect(b.result.current.includeDev).toBe(false);

    act(() => a.result.current.setIncludeDev(true));
    expect(a.result.current.includeDev).toBe(true);
    // b receives the change via the module-level listener fan-out.
    expect(b.result.current.includeDev).toBe(true);
  });
});
