import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// Phase 2 / Plan 02-03 / Task 2 — useExtensionGate.test.tsx
// Mocks fetchExtensionGate so each render has a controllable resolution.
const fetchGateMock = vi.fn();
vi.mock('../../services/extension/queries', () => ({
  fetchExtensionGate: (...args: unknown[]) => fetchGateMock(...args),
}));

import { useExtensionGate } from './useExtensionGate';

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  fetchGateMock.mockReset();
});

describe('useExtensionGate', () => {
  it('returns isLoading: true on first render', () => {
    fetchGateMock.mockResolvedValue({ hasAny: true });
    const { result } = renderHook(() => useExtensionGate(), { wrapper: makeWrapper() });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isEmpty).toBe(false);
  });

  it('flips to isEmpty: true when fetchExtensionGate resolves with hasAny: false', async () => {
    fetchGateMock.mockResolvedValue({ hasAny: false });
    const { result } = renderHook(() => useExtensionGate(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isEmpty).toBe(true);
    expect(result.current.error).toBeFalsy();
  });

  it('flips to isEmpty: false when fetchExtensionGate resolves with hasAny: true', async () => {
    fetchGateMock.mockResolvedValue({ hasAny: true });
    const { result } = renderHook(() => useExtensionGate(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isEmpty).toBe(false);
    expect(result.current.error).toBeFalsy();
  });

  it('surfaces the error when fetchExtensionGate rejects', async () => {
    const err = new Error('gate fail');
    fetchGateMock.mockRejectedValue(err);
    const { result } = renderHook(() => useExtensionGate(), { wrapper: makeWrapper() });
    // The hook explicitly sets retry: 1 per D-19, so we wait long enough for
    // the retry + final error to surface (default exponential backoff ~1s).
    await waitFor(() => expect(result.current.error).toBeTruthy(), { timeout: 5000 });
    expect(result.current.error).toBe(err);
    // While error is present, isEmpty should NOT be true (gate is in error state, not empty state)
    expect(result.current.isEmpty).toBe(false);
  });
});
