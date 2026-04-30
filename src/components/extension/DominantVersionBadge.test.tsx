import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Phase 2 / EXT-09 — DominantVersionBadge tests.
// Mocks useDominantVersion (Plan 02-03) so tests focus purely on the chip render.

const useDominantVersionMock = vi.fn();
vi.mock('../../hooks/extension/useDominantVersion', () => ({
  useDominantVersion: () => useDominantVersionMock(),
}));

import { DominantVersionBadge } from './DominantVersionBadge';

beforeEach(() => {
  useDominantVersionMock.mockReset();
});

describe('<DominantVersionBadge>', () => {
  it('Test 7: renders "Dominant: v2.0.1" when hook returns a row', () => {
    useDominantVersionMock.mockReturnValue({
      data: { extension_version: '2.0.1', event_count: 42 },
      isLoading: false,
      error: null,
    });
    render(<DominantVersionBadge />);
    expect(screen.getByTestId('dominant-version-badge')).toHaveTextContent(
      'Dominant: v2.0.1',
    );
  });

  it('Test 8: renders "Dominant: —" when hook returns null', () => {
    useDominantVersionMock.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    });
    render(<DominantVersionBadge />);
    expect(screen.getByTestId('dominant-version-badge')).toHaveTextContent(
      'Dominant: —',
    );
  });

  it('Test 8b: renders "Dominant: —" when extension_version is empty/falsy', () => {
    useDominantVersionMock.mockReturnValue({
      data: { extension_version: '', event_count: 0 },
      isLoading: false,
      error: null,
    });
    render(<DominantVersionBadge />);
    expect(screen.getByTestId('dominant-version-badge')).toHaveTextContent(
      'Dominant: —',
    );
  });

  it('Test 9: badge styling matches UI-SPEC chip vocabulary; non-interactive <span>', () => {
    useDominantVersionMock.mockReturnValue({
      data: { extension_version: '2.0.1', event_count: 42 },
      isLoading: false,
      error: null,
    });
    render(<DominantVersionBadge />);
    const badge = screen.getByTestId('dominant-version-badge');
    // Non-interactive (not a button)
    expect(badge.tagName).toBe('SPAN');
    // UI-SPEC § Color: text-sm font-semibold + bg-gray-100 text-gray-700
    expect(badge.className).toContain('text-sm');
    expect(badge.className).toContain('font-semibold');
    expect(badge.className).toContain('bg-gray-100');
    expect(badge.className).toContain('text-gray-700');
  });
});
