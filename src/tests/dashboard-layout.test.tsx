// Integration tests for src/layouts/DashboardLayout.tsx after Wave 4
// refactor: active Sales NavLink, disabled other nav entries, responsive
// icon-rail collapse at md: breakpoint, preserved header user menu.
// Phase 5 plan 05-07 flipped Trends to an active NavLink; Phase 6 plan
// 06-06 flipped Departments to an active NavLink.

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
          <Route path="/trends" element={<div>Trends Content</div>} />
          <Route path="/departments" element={<div>Departments Content</div>} />
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
    // Phase 5 (plan 05-07) flipped Trends to an active NavLink; Phase 6
    // (plan 06-06) flipped Departments to an active NavLink. Neither is
    // in the disabled set anymore. Team / Reports / Custom Charts remain.
    const disabledLabels = ['Team', 'Reports', 'Custom Charts'];
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

  it('renders Departments as an active NavLink to /departments (Phase 6 plan 06-06)', () => {
    renderLayout('/sales');
    const deptLink = screen.getByRole('link', { name: /Departments/i });
    expect(deptLink).toHaveAttribute('href', '/departments');
  });

  it('Departments NavLink uses accent active-state styling when current route', () => {
    renderLayout('/departments');
    const deptLink = screen.getByRole('link', { name: /Departments/i });
    // Active state must reuse accent reservation #3 (border-l-2 border-accent
    // + text-accent), matching the Sales/Trends active-state convention.
    expect(deptLink.className).toMatch(/text-accent|border-accent|bg-accent/);
  });

  it('Departments entry is NOT aria-disabled and has no Coming soon aside', () => {
    renderLayout('/sales');
    const deptLink = screen.getByRole('link', { name: /Departments/i });
    expect(deptLink.getAttribute('aria-disabled')).toBeNull();
    // Ensure the "Coming soon" aside was removed for Departments — the
    // link itself must not contain that text.
    expect(deptLink.textContent ?? '').not.toMatch(/Coming soon/i);
  });

  it('exactly 3 Coming soon asides remain (Team, Reports, Custom Charts)', () => {
    renderLayout('/sales');
    const asides = screen.getAllByText('Coming soon');
    // Regression guard: only the 3 not-yet-built phases keep the aside.
    expect(asides.length).toBe(3);
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
    // 6 nav items → at least 6 icons (3 active NavLinks Sales/Trends/Departments
    // + 3 disabled spans Team/Reports/Custom Charts each have one).
    expect(svgs.length).toBeGreaterThanOrEqual(6);
  });
});
