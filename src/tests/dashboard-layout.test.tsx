// Integration tests for src/layouts/DashboardLayout.tsx after Wave 4
// refactor: active Sales NavLink, disabled other nav entries, responsive
// icon-rail collapse at md: breakpoint, preserved header user menu.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import { useAuthStore } from '../stores/authStore';

// authStore reads supabase at module load; mock the client to avoid network.
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(async () => ({ error: null })),
      signOut: vi.fn(async () => ({ error: null })),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    })),
  },
}));

import { DashboardLayout } from '../layouts/DashboardLayout';

function renderLayout(path: string = '/sales') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<DashboardLayout />}>
          <Route path="/sales" element={<div>Sales Content</div>} />
          <Route path="/" element={<div>Home</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('DashboardLayout (Wave 4)', () => {
  beforeEach(() => {
    useAuthStore.setState({
      session: { access_token: 't' } as never,
      user: { id: 'u1', email: 'admin@example.com' } as never,
      profile: { id: 'u1', role: 'admin', display_name: 'Admin User', is_active: true } as never,
      isAdmin: true,
      loading: false,
      profileLoading: false,
      profileLoaded: true,
      signIn: vi.fn(async () => ({ error: null })),
      signOut: vi.fn(async () => undefined),
    });
  });

  it('renders Sales as an active NavLink to /sales', () => {
    renderLayout('/sales');
    const salesLink = screen.getByRole('link', { name: /Sales/i });
    expect(salesLink).toHaveAttribute('href', '/sales');
    // Active state: className contains accent styling
    const cls = salesLink.className;
    expect(cls).toMatch(/text-accent|border-accent|bg-accent/);
  });

  it('renders disabled (aria-disabled) nav entries for not-yet-built phases', () => {
    renderLayout('/sales');
    // Phase 5 (plan 05-07) flipped Trends to an active NavLink — it is no
    // longer in the disabled set.
    const disabledLabels = ['Departments', 'Team', 'Reports', 'Custom Charts'];
    for (const label of disabledLabels) {
      const el = screen.getByText(label).closest('[aria-disabled]');
      expect(el).not.toBeNull();
      expect(el?.getAttribute('aria-disabled')).toBe('true');
    }
  });

  it('renders Trends as an active NavLink to /trends (Phase 5 plan 05-07)', () => {
    renderLayout('/sales');
    const trendsLink = screen.getByRole('link', { name: /Trends/i });
    expect(trendsLink).toHaveAttribute('href', '/trends');
  });

  it('has responsive sidebar grid classes on the root container', () => {
    const { container } = renderLayout('/sales');
    // Root grid should have BOTH md-collapsed and lg-expanded column tracks
    const root = container.querySelector('[class*="grid-cols"]');
    expect(root).not.toBeNull();
    expect(root?.className).toMatch(/lg:grid-cols-\[15rem_1fr\]/);
    expect(root?.className).toMatch(/grid-cols-\[4rem_1fr\]/);
  });

  it('renders user-menu avatar button (Phase 1 regression guard)', () => {
    renderLayout('/sales');
    expect(screen.getByLabelText('Open account menu')).toBeInTheDocument();
  });

  it('nav-item labels hidden at md, visible at lg (hidden lg:inline)', () => {
    renderLayout('/sales');
    // Every visible label span should be wrapped so it only shows at lg:
    // We check that the "Trends" text node lives inside a span with hidden lg:inline.
    const trendsText = screen.getByText('Trends');
    expect(trendsText.className).toMatch(/hidden lg:inline/);
  });

  it('disabled nav items keep a Coming soon aside at lg:', () => {
    renderLayout('/sales');
    // At least one "Coming soon" aside renders (hidden at md, shown at lg)
    const asides = screen.getAllByText('Coming soon');
    expect(asides.length).toBeGreaterThan(0);
    // Each aside has the hidden lg:inline class so it only shows at lg
    for (const a of asides) {
      expect(a.className).toMatch(/hidden lg:inline/);
    }
  });

  it('each nav item has an inline svg icon (icon rail at md)', () => {
    const { container } = renderLayout('/sales');
    // Each of the 6 nav entries should have an SVG. Nav lives inside <nav>.
    const nav = container.querySelector('nav');
    expect(nav).not.toBeNull();
    const svgs = nav?.querySelectorAll('svg') ?? [];
    // 6 nav items → at least 6 icons (active NavLink + 5 disabled spans each have one)
    expect(svgs.length).toBeGreaterThanOrEqual(6);
  });
});
