import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Phase 3 / D-26 / D-28 / D-31 — DeveloperPanel tests.
// Mocks the two child sub-surfaces (FailedAiBreakdown, UiInteractionsPanel)
// so this test focuses ONLY on the panel chrome (render gate, collapse/expand,
// aria-labels, chevron rotation, subtitle copy).
// Auth store is mocked through the selector idiom (mirrors Phase 2 pattern).

vi.mock('./FailedAiBreakdown', () => ({
  FailedAiBreakdown: () => <div data-testid="failed-ai-breakdown-stub" />,
}));
vi.mock('./UiInteractionsPanel', () => ({
  UiInteractionsPanel: () => <div data-testid="ui-interactions-panel-stub" />,
}));

const authMock = vi.fn();
vi.mock('../../stores/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) => selector(authMock()),
}));

import { DeveloperPanel } from './DeveloperPanel';

beforeEach(() => {
  authMock.mockReset();
});

describe('<DeveloperPanel> — D-26 render gate', () => {
  it('Test 1: returns null when isDevAccount returns false (non-dev email)', () => {
    authMock.mockReturnValue({ profile: { email: 'admin@example.com' } });
    const { container } = render(<DeveloperPanel />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId('developer-panel')).not.toBeInTheDocument();
  });

  it('Test 1b: returns null when profile is null', () => {
    authMock.mockReturnValue({ profile: null });
    const { container } = render(<DeveloperPanel />);
    expect(container.firstChild).toBeNull();
  });

  it('Test 1c: returns null when profile.email is null', () => {
    authMock.mockReturnValue({ profile: { email: null } });
    const { container } = render(<DeveloperPanel />);
    expect(container.firstChild).toBeNull();
  });
});

describe('<DeveloperPanel> — chrome and content', () => {
  it('Test 2: renders panel chrome when isDevAccount returns true (collapsed: chevron + title + subtitle)', () => {
    authMock.mockReturnValue({ profile: { email: 'josh@potomackco.com' } });
    render(<DeveloperPanel />);
    expect(screen.getByTestId('developer-panel')).toBeInTheDocument();
    expect(screen.getByText('Developer panel')).toBeInTheDocument();
  });

  it('Test 5: subtitle reads "Diagnostics for {profile.email}" with the actual dev email', () => {
    authMock.mockReturnValue({ profile: { email: 'josh@potomackco.com' } });
    render(<DeveloperPanel />);
    expect(
      screen.getByText('Diagnostics for josh@potomackco.com'),
    ).toBeInTheDocument();
  });

  it('Test 3: initial state is collapsed (sub-surfaces not in DOM); clicking expands and reveals both', async () => {
    authMock.mockReturnValue({ profile: { email: 'josh@potomackco.com' } });
    render(<DeveloperPanel />);
    expect(screen.queryByTestId('failed-ai-breakdown-stub')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ui-interactions-panel-stub')).not.toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: 'Expand developer panel' });
    await userEvent.click(toggle);
    expect(screen.getByTestId('failed-ai-breakdown-stub')).toBeInTheDocument();
    expect(screen.getByTestId('ui-interactions-panel-stub')).toBeInTheDocument();
  });

  it('Test 4: aria-expanded reflects state; aria-controls points to the body section ID', async () => {
    authMock.mockReturnValue({ profile: { email: 'josh@potomackco.com' } });
    render(<DeveloperPanel />);
    const toggle = screen.getByRole('button', { name: 'Expand developer panel' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    const ariaControls = toggle.getAttribute('aria-controls');
    expect(ariaControls).toBeTruthy();
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveAttribute('aria-label', 'Collapse developer panel');
    const body = document.getElementById(ariaControls!);
    expect(body).not.toBeNull();
    expect(body).toContainElement(screen.getByTestId('failed-ai-breakdown-stub'));
  });

  it('Test 6: NO localStorage persistence — every fresh mount = collapsed state, even after a previous mount expanded it', async () => {
    authMock.mockReturnValue({ profile: { email: 'josh@potomackco.com' } });
    // First mount: expand the panel.
    const first = render(<DeveloperPanel />);
    const firstToggle = screen.getByRole('button', { name: 'Expand developer panel' });
    await userEvent.click(firstToggle);
    expect(firstToggle).toHaveAttribute('aria-expanded', 'true');
    first.unmount();
    // Second fresh mount: must start collapsed (no persistence read on mount).
    render(<DeveloperPanel />);
    const secondToggle = screen.getByRole('button', { name: 'Expand developer panel' });
    expect(secondToggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('failed-ai-breakdown-stub')).not.toBeInTheDocument();
  });

  it('Test 7: chevron rotates 90deg when expanded (rotate-90 class applied to the chevron svg)', async () => {
    authMock.mockReturnValue({ profile: { email: 'josh@potomackco.com' } });
    render(<DeveloperPanel />);
    const toggle = screen.getByRole('button', { name: 'Expand developer panel' });
    const chevronCollapsed = toggle.querySelector('svg');
    expect(chevronCollapsed).not.toBeNull();
    expect(chevronCollapsed!.getAttribute('class')).not.toContain('rotate-90');
    await userEvent.click(toggle);
    const chevronExpanded = toggle.querySelector('svg');
    expect(chevronExpanded!.getAttribute('class')).toContain('rotate-90');
  });

  it('Test 7b: case-insensitive email gate (RFC 5321) — JOSH@potomackco.com renders panel', () => {
    authMock.mockReturnValue({ profile: { email: 'JOSH@potomackco.com' } });
    render(<DeveloperPanel />);
    expect(screen.getByTestId('developer-panel')).toBeInTheDocument();
  });

  it('Test 7c: panel chrome uses border-card vocabulary (rounded-lg + border + bg-white + mt-8 spacing)', () => {
    authMock.mockReturnValue({ profile: { email: 'josh@potomackco.com' } });
    render(<DeveloperPanel />);
    const panel = screen.getByTestId('developer-panel');
    expect(panel.className).toContain('rounded-lg');
    expect(panel.className).toContain('border');
    expect(panel.className).toContain('border-gray-200');
    expect(panel.className).toContain('bg-white');
    expect(panel.className).toContain('mt-8');
  });
});
