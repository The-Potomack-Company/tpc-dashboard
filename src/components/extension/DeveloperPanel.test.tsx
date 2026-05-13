import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Phase 2 / D-15 / D-16 — DeveloperPanel tests.
// Mocks the three child components so this test focuses ONLY on the panel's
// chrome (render gate, collapse/expand, aria-labels, chevron rotation).
// Auth store is mocked through the selector idiom — `useAuthStore(s => ...)`
// receives the latest factory output each render.

vi.mock('./DominantVersionBadge', () => ({
  DominantVersionBadge: () => <div data-testid="dom-badge" />,
}));
vi.mock('./ExtensionVersionFilter', () => ({
  ExtensionVersionFilter: () => <div data-testid="ver-filter" />,
}));
vi.mock('./CancellationRateKpis', () => ({
  CancellationRateKpis: () => <div data-testid="cancel-kpis" />,
}));

const authMock = vi.fn();
vi.mock('../../stores/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) => selector(authMock()),
}));

import { DeveloperPanel } from './DeveloperPanel';

beforeEach(() => {
  authMock.mockReset();
});

describe('<DeveloperPanel> — D-15 render gate', () => {
  it('Test 1: returns null when profile is null', () => {
    authMock.mockReturnValue({ profile: null });
    const { container } = render(<DeveloperPanel />);
    expect(container.firstChild).toBeNull();
  });

  it('Test 1b: returns null when profile.email is null', () => {
    authMock.mockReturnValue({ profile: { email: null } });
    const { container } = render(<DeveloperPanel />);
    expect(container.firstChild).toBeNull();
  });

  it('Test 2: returns null when email not in dev allowlist', () => {
    authMock.mockReturnValue({
      profile: { email: 'admin@example.com' },
    });
    const { container } = render(<DeveloperPanel />);
    expect(container.firstChild).toBeNull();
  });
});

describe('<DeveloperPanel> — chrome and content', () => {
  it('Test 3: renders collapsed panel for dev email with title, subtitle, dominant badge', () => {
    authMock.mockReturnValue({
      profile: { email: 'josh@potomackco.com' },
    });
    render(<DeveloperPanel />);
    expect(screen.getByTestId('developer-panel')).toBeInTheDocument();
    expect(screen.getByText('Developer panel')).toBeInTheDocument();
    expect(
      screen.getByText('Diagnostics for josh@potomackco.com'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('dom-badge')).toBeInTheDocument();
  });

  it('Test 4: collapsed by default — body content (filter + KPIs) NOT in DOM', () => {
    authMock.mockReturnValue({
      profile: { email: 'josh@potomackco.com' },
    });
    render(<DeveloperPanel />);
    expect(screen.queryByTestId('ver-filter')).not.toBeInTheDocument();
    expect(screen.queryByTestId('cancel-kpis')).not.toBeInTheDocument();
  });

  it('Test 5: clicking the title row expands; chevron rotates 180°; body content mounts', async () => {
    authMock.mockReturnValue({
      profile: { email: 'josh@potomackco.com' },
    });
    render(<DeveloperPanel />);
    const toggle = screen.getByRole('button', {
      name: 'Expand developer panel',
    });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    // Chevron NOT rotated when collapsed
    const chevronCollapsed = toggle.querySelector('svg');
    expect(chevronCollapsed?.getAttribute('class')).not.toContain('rotate-180');
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveAttribute('aria-label', 'Collapse developer panel');
    // Body mounts
    expect(screen.getByTestId('ver-filter')).toBeInTheDocument();
    expect(screen.getByTestId('cancel-kpis')).toBeInTheDocument();
    // Section headings render verbatim per UI-SPEC
    expect(screen.getByText('Extension version')).toBeInTheDocument();
    expect(screen.getByText('Cancellation rates')).toBeInTheDocument();
    // Chevron rotated when expanded
    const chevronExpanded = toggle.querySelector('svg');
    expect(chevronExpanded?.getAttribute('class')).toContain('rotate-180');
  });

  it('Test 6: clicking again collapses; aria-expanded toggles', async () => {
    authMock.mockReturnValue({
      profile: { email: 'josh@potomackco.com' },
    });
    render(<DeveloperPanel />);
    const toggle = screen.getByRole('button', {
      name: 'Expand developer panel',
    });
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveAttribute('aria-label', 'Expand developer panel');
    expect(screen.queryByTestId('ver-filter')).not.toBeInTheDocument();
  });

  it('Test 7: aria-controls + body id wire up correctly', async () => {
    authMock.mockReturnValue({
      profile: { email: 'josh@potomackco.com' },
    });
    render(<DeveloperPanel />);
    const toggle = screen.getByRole('button', {
      name: 'Expand developer panel',
    });
    const ariaControls = toggle.getAttribute('aria-controls');
    expect(ariaControls).toBeTruthy();
    await userEvent.click(toggle);
    const body = document.getElementById(ariaControls!);
    expect(body).not.toBeNull();
    expect(body).toContainElement(screen.getByTestId('ver-filter'));
  });

  it('Test 8: D-16 / Pitfall 10 — re-renders when profile transitions null → dev email', () => {
    authMock.mockReturnValue({ profile: null });
    const { rerender, container } = render(<DeveloperPanel />);
    expect(container.firstChild).toBeNull();
    authMock.mockReturnValue({
      profile: { email: 'josh@potomackco.com' },
    });
    rerender(<DeveloperPanel />);
    expect(screen.getByTestId('developer-panel')).toBeInTheDocument();
  });

  it('Test 9: case-insensitive email comparison (RFC 5321)', () => {
    authMock.mockReturnValue({
      profile: { email: 'JOSH@potomackco.com' },
    });
    render(<DeveloperPanel />);
    expect(screen.getByTestId('developer-panel')).toBeInTheDocument();
  });

  it('Test 10: panel chrome uses border-card vocabulary (no inverted card, no warning band)', () => {
    authMock.mockReturnValue({
      profile: { email: 'josh@potomackco.com' },
    });
    render(<DeveloperPanel />);
    const panel = screen.getByTestId('developer-panel');
    // Phase 7 unified-design: gray/white surfaces shift to token vocabulary
    // (border-rule + bg-bg). `rounded-lg` continues to ship from Tailwind.
    expect(panel.className).toContain('rounded-lg');
    expect(panel.className).toContain('border');
    expect(panel.className).toContain('border-rule');
    expect(panel.className).toContain('bg-bg');
  });
});
