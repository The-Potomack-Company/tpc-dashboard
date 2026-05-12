import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router';
import type { ReactNode } from 'react';

// Phase 3 / APP-02 — ActiveSessionsTable tests.
//
// Mirrors PerUserTable test structure: mock the data hook, render under
// MemoryRouter (table uses useNavigate for row clicks), assert UI-SPEC
// verbatim copy + the locked ErrorState contract (D-35).

const useActiveSessionsMock = vi.fn();
vi.mock('../../hooks/activity/useActiveSessions', () => ({
  useActiveSessions: () => useActiveSessionsMock(),
}));

const navigateMock = vi.fn();
vi.mock('react-router', async () => {
  const actual =
    await vi.importActual<typeof import('react-router')>('react-router');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

import { ActiveSessionsTable } from './ActiveSessionsTable';

function Wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

beforeEach(() => {
  useActiveSessionsMock.mockReset();
  navigateMock.mockReset();
});

// Build a sample with deterministic ages (created_at deltas relative to NOW).
function makeSample() {
  const now = Date.now();
  return [
    // Newest (1 hour ago)
    {
      session_id: 'sess-young',
      name: 'Young session',
      mode: 'house',
      assigned_to_id: 'p1',
      assigned_to_display_name: 'Alice',
      item_count: 3,
      status: 'active',
      created_at: new Date(now - 1 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(now - 30 * 60 * 1000).toISOString(),
    },
    // Oldest (14 hours ago)
    {
      session_id: 'sess-old',
      name: 'Old session',
      mode: 'sale',
      assigned_to_id: null,
      assigned_to_display_name: null,
      item_count: 7,
      status: 'active',
      created_at: new Date(now - 14 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(now - 4 * 60 * 60 * 1000).toISOString(),
    },
    // Middle (5 hours ago)
    {
      session_id: 'sess-mid',
      name: 'Middle session',
      mode: 'house',
      assigned_to_id: 'p2',
      assigned_to_display_name: 'Bob',
      item_count: 5,
      status: 'active',
      created_at: new Date(now - 5 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(now - 1 * 60 * 60 * 1000).toISOString(),
    },
  ];
}

describe('<ActiveSessionsTable>', () => {
  it("Test 8: renders TanStack Table with 7 columns in UI-SPEC order", () => {
    useActiveSessionsMock.mockReturnValue({
      data: makeSample(),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<ActiveSessionsTable />, { wrapper: Wrapper });
    expect(screen.getAllByRole('columnheader')).toHaveLength(7);
    const headers = screen
      .getAllByRole('columnheader')
      .map((h) => h.textContent?.trim());
    expect(headers).toEqual([
      expect.stringMatching(/^Session/),
      expect.stringMatching(/^Mode/),
      expect.stringMatching(/^Specialist/),
      expect.stringMatching(/^Items/),
      expect.stringMatching(/^Created/),
      expect.stringMatching(/^Updated/),
      expect.stringMatching(/^Age/),
    ]);
  });

  it("Test 9: default sort = age descending (oldest first)", () => {
    useActiveSessionsMock.mockReturnValue({
      data: makeSample(),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<ActiveSessionsTable />, { wrapper: Wrapper });
    const rows = screen.getAllByRole('row').slice(1); // skip header
    // Oldest (14h) first → 'Old session', then Middle (5h), then Young (1h)
    expect(rows[0]).toHaveTextContent('Old session');
    expect(rows[1]).toHaveTextContent('Middle session');
    expect(rows[2]).toHaveTextContent('Young session');

    // The Age column header should display aria-sort='descending'
    const ageHeader = screen.getByRole('columnheader', { name: /^Age/ });
    expect(ageHeader).toHaveAttribute('aria-sort', 'descending');
  });

  it("Test 10: section header = 'Active sessions' + right-now pip + plural-correct subheading", () => {
    useActiveSessionsMock.mockReturnValue({
      data: makeSample(),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    const { container } = render(<ActiveSessionsTable />, { wrapper: Wrapper });
    expect(screen.getByText('Active sessions')).toBeInTheDocument();
    expect(screen.getByText('Live')).toBeInTheDocument();
    // Phase 7 unified-design: right-now pip color migrated from
    // `bg-green-500` to the token-backed `bg-ok` (resolves to var(--ok)
    // under both themes).
    const pip = container.querySelector('.bg-ok');
    expect(pip).not.toBeNull();
    expect(pip?.className).toMatch(/motion-safe:animate-pulse/);
    // Plural subheading
    expect(screen.getByText('3 active sessions')).toBeInTheDocument();
  });

  it("subheading uses singular form for n=1", () => {
    useActiveSessionsMock.mockReturnValue({
      data: makeSample().slice(0, 1),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<ActiveSessionsTable />, { wrapper: Wrapper });
    expect(screen.getByText('1 active session')).toBeInTheDocument();
  });

  it("Test 11: row click navigates to /activity/sessions/<session_id>", async () => {
    useActiveSessionsMock.mockReturnValue({
      data: makeSample(),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    const user = userEvent.setup();
    render(<ActiveSessionsTable />, { wrapper: Wrapper });
    const rows = screen.getAllByRole('row').slice(1);
    // Default sort puts 'Old session' first
    await user.click(rows[0]);
    expect(navigateMock).toHaveBeenCalledWith('/activity/sessions/sess-old');
  });

  it("row keyboard activation (Enter) navigates", async () => {
    useActiveSessionsMock.mockReturnValue({
      data: makeSample(),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    const user = userEvent.setup();
    render(<ActiveSessionsTable />, { wrapper: Wrapper });
    const rows = screen.getAllByRole('row').slice(1);
    rows[0].focus();
    await user.keyboard('{Enter}');
    expect(navigateMock).toHaveBeenCalledWith('/activity/sessions/sess-old');
  });

  it("Test 12: mode cell renders literal lowercase; specialist cell renders display_name; '—' when null", () => {
    useActiveSessionsMock.mockReturnValue({
      data: makeSample(),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<ActiveSessionsTable />, { wrapper: Wrapper });
    // Mode literal lowercase 'house' / 'sale'
    expect(screen.getAllByText('house').length).toBeGreaterThan(0);
    expect(screen.getAllByText('sale').length).toBeGreaterThan(0);
    // Specialist display_name
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    // Specialist null → EM-DASH (Old session has assigned_to_display_name = null)
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it("Test 13: Age cell uses formatAge — 14h ago renders '14h'", () => {
    useActiveSessionsMock.mockReturnValue({
      data: makeSample(),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<ActiveSessionsTable />, { wrapper: Wrapper });
    // The Old session row should show '14h' age
    expect(screen.getByText('14h')).toBeInTheDocument();
    // Middle row (5h)
    expect(screen.getByText('5h')).toBeInTheDocument();
    // Young row (1h)
    expect(screen.getByText('1h')).toBeInTheDocument();
  });

  it("Test 14: empty state with locked UI-SPEC copy", () => {
    useActiveSessionsMock.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<ActiveSessionsTable />, { wrapper: Wrapper });
    expect(
      screen.getByRole('heading', { name: /No active sessions/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/The TPC team isn't cataloging right now\./i),
    ).toBeInTheDocument();
  });

  it("Test 15: loading state renders TableSkeleton with locked column widths", () => {
    useActiveSessionsMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });
    const { container } = render(<ActiveSessionsTable />, { wrapper: Wrapper });
    // 5 rows × 7 cols of pulsing bars per UI-SPEC
    const pulseBars = container.querySelectorAll(
      '.motion-safe\\:animate-pulse',
    );
    // 5 rows × 7 cols = 35 shimmer bars (the right-now pip is also a pulse,
    // but the loading branch shouldn't render the section header — verify
    // there are AT LEAST 35 bars)
    expect(pulseBars.length).toBeGreaterThanOrEqual(35);
  });

  it("Test 16: error state with locked ErrorState contract; Retry calls refetch", async () => {
    const refetch = vi.fn();
    useActiveSessionsMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('boom'),
      refetch,
    });
    const user = userEvent.setup();
    render(<ActiveSessionsTable />, { wrapper: Wrapper });
    expect(screen.getByRole('alert')).toHaveTextContent(
      "Couldn't load active sessions",
    );
    expect(screen.getByText('Retry below.')).toBeInTheDocument();
    // Locked contract: only one Retry button (ErrorState's own)
    const retryButtons = screen.getAllByRole('button', { name: /Retry/i });
    expect(retryButtons).toHaveLength(1);
    await user.click(retryButtons[0]);
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
