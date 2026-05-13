import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router';
import { DashboardLayout, NAV_ITEMS } from './DashboardLayout';

// Phase 3 / Plan 03-08 / D-03 — DashboardLayout NAV_ITEMS shape + nested-route
// active-state behavior.
//
// The active-state class string is locked by the existing layout
// implementation: `text-accent border-l-2 border-accent bg-accent/5`. We
// match against `border-l-accent` / `text-accent` to be resilient to minor
// formatting changes — but the assertion still fails if the NavLink's
// `end` prop accidentally short-circuits the active state on nested routes.
//
// Auth store is stubbed because DashboardLayout reads `profile`, `user`,
// and `signOut` for the header. We mock those minimally — we're testing
// the sidebar nav, not the header.

vi.mock('../stores/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) =>
    selector({
      profile: { display_name: 'Test User' },
      user: { email: 'test@example.com' },
      signOut: vi.fn(),
    }),
}));

function renderAt(path: string, mountedRoutes: string[]) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<DashboardLayout />}>
          {mountedRoutes.map((route) => (
            <Route
              key={route}
              path={route}
              element={<div data-testid={`route-${route}`}>{route}</div>}
            />
          ))}
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('DashboardLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('NAV_ITEMS shape (Test 1)', () => {
    it('exports NAV_ITEMS as an array', () => {
      expect(Array.isArray(NAV_ITEMS)).toBe(true);
    });

    it('contains an Activity entry with to=/activity', () => {
      const activity = NAV_ITEMS.find((item) => item.label === 'Activity');
      expect(activity).toBeDefined();
      expect(activity?.to).toBe('/activity');
      expect(typeof activity?.Icon).toBe('function');
    });

    it('contains an Extension entry (Phase 2 — must survive)', () => {
      const extension = NAV_ITEMS.find((item) => item.label === 'Extension');
      expect(extension).toBeDefined();
      expect(extension?.to).toBe('/extension');
    });

    it('Activity entry is positioned AFTER Extension (visual order: Extension → Activity)', () => {
      const extensionIdx = NAV_ITEMS.findIndex(
        (i) => i.label === 'Extension',
      );
      const activityIdx = NAV_ITEMS.findIndex((i) => i.label === 'Activity');
      expect(extensionIdx).toBeGreaterThanOrEqual(0);
      expect(activityIdx).toBeGreaterThan(extensionIdx);
    });
  });

  describe('Active-state highlighting (D-03)', () => {
    function getNavLink(label: string): HTMLElement {
      return screen.getByRole('link', { name: label });
    }

    function isActive(link: HTMLElement): boolean {
      // Phase 7 unified-design: the active vocabulary is
      // "text-accent border-l-2 border-accent bg-accent-wash". The wash
      // utility resolves to var(--accent-wash) from the design tokens
      // (was bg-accent/5 before the unified migration). We check for
      // the three structural tokens that together signal "this NavLink
      // is highlighted".
      const cls = link.className;
      return (
        cls.includes('border-accent') &&
        cls.includes('text-accent') &&
        cls.includes('bg-accent-wash')
      );
    }

    it('Test 2: at /activity, the Activity NavLink is highlighted', () => {
      renderAt('/activity', ['/activity']);
      expect(isActive(getNavLink('Activity'))).toBe(true);
    });

    it('Test 3 (D-03): at /activity/sessions/:id, Activity STAYS highlighted', () => {
      renderAt('/activity/sessions/abc-123', ['/activity/sessions/:id']);
      expect(isActive(getNavLink('Activity'))).toBe(true);
    });

    it('Test 4 (D-03): at /activity/stuck, Activity STAYS highlighted', () => {
      renderAt('/activity/stuck', ['/activity/stuck']);
      expect(isActive(getNavLink('Activity'))).toBe(true);
    });

    it('Test 5: at /extension, Extension is highlighted but Activity is NOT', () => {
      renderAt('/extension', ['/extension']);
      expect(isActive(getNavLink('Extension'))).toBe(true);
      expect(isActive(getNavLink('Activity'))).toBe(false);
    });

    it('Test 6: at / (home), Activity is NOT highlighted', () => {
      renderAt('/', ['/']);
      expect(isActive(getNavLink('Activity'))).toBe(false);
      expect(isActive(getNavLink('Extension'))).toBe(false);
    });
  });
});
