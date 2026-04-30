import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserMultiSelect } from './UserMultiSelect';

// Mock both data hooks. The component must read user filter selection +
// available-users option list from these — never from Supabase directly.
const useUserFilterMock = vi.fn();
const usePerUserMock = vi.fn();

vi.mock('../hooks/extension/useUserFilter', () => ({
  useUserFilter: () => useUserFilterMock(),
}));
vi.mock('../hooks/extension/usePerUserSummary', () => ({
  usePerUserSummary: () => usePerUserMock(),
}));

beforeEach(() => {
  useUserFilterMock.mockReset();
  usePerUserMock.mockReset();
  // Default: three users available (two emails + Unknown bucket per D-04).
  usePerUserMock.mockReturnValue({
    data: [
      { user_email_label: 'a@x.com' },
      { user_email_label: 'b@x.com' },
      { user_email_label: 'Unknown' },
    ],
  });
});

describe('<UserMultiSelect>', () => {
  it('shows "All users" placeholder when nothing selected', () => {
    useUserFilterMock.mockReturnValue({ users: [], setUsers: vi.fn() });
    render(<UserMultiSelect />);
    expect(screen.getByRole('button', { name: /Filter by user email/i })).toHaveTextContent('All users');
  });

  it('shows "{n} users" when multiple selected (plural)', () => {
    useUserFilterMock.mockReturnValue({
      users: ['a@x.com', 'b@x.com'],
      setUsers: vi.fn(),
    });
    render(<UserMultiSelect />);
    expect(screen.getByRole('button', { name: /Filter by user email/i })).toHaveTextContent('2 users');
  });

  it('shows "1 user" (singular) when one selected', () => {
    useUserFilterMock.mockReturnValue({
      users: ['a@x.com'],
      setUsers: vi.fn(),
    });
    render(<UserMultiSelect />);
    expect(screen.getByRole('button', { name: /Filter by user email/i })).toHaveTextContent('1 user');
  });

  it('opens popover on click; closes on outside click', async () => {
    useUserFilterMock.mockReturnValue({ users: [], setUsers: vi.fn() });
    const user = userEvent.setup();
    render(<UserMultiSelect />);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Filter by user email/i }));
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    // Outside click — fire on document.body via mousedown (handler listens for mousedown).
    await act(async () => {
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('closes popover on Escape key', async () => {
    useUserFilterMock.mockReturnValue({ users: [], setUsers: vi.fn() });
    const user = userEvent.setup();
    render(<UserMultiSelect />);
    await user.click(screen.getByRole('button', { name: /Filter by user email/i }));
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('toggling a checkbox calls setUsers with the new array (add)', async () => {
    const setUsers = vi.fn();
    useUserFilterMock.mockReturnValue({ users: [], setUsers });
    const user = userEvent.setup();
    render(<UserMultiSelect />);
    await user.click(screen.getByRole('button', { name: /Filter by user email/i }));
    await user.click(screen.getByLabelText('a@x.com'));
    expect(setUsers).toHaveBeenCalledWith(['a@x.com']);
  });

  it('toggling a checked checkbox calls setUsers with the user removed', async () => {
    const setUsers = vi.fn();
    useUserFilterMock.mockReturnValue({ users: ['a@x.com', 'b@x.com'], setUsers });
    const user = userEvent.setup();
    render(<UserMultiSelect />);
    await user.click(screen.getByRole('button', { name: /Filter by user email/i }));
    await user.click(screen.getByLabelText('a@x.com'));
    expect(setUsers).toHaveBeenCalledWith(['b@x.com']);
  });

  it('renders the Unknown option as "Unknown (no email)" in italic gray', async () => {
    useUserFilterMock.mockReturnValue({ users: [], setUsers: vi.fn() });
    const user = userEvent.setup();
    render(<UserMultiSelect />);
    await user.click(screen.getByRole('button', { name: /Filter by user email/i }));
    const unknownLabel = screen.getByText('Unknown (no email)');
    expect(unknownLabel).toBeInTheDocument();
    // The label span uses italic + text-gray-500 per UI-SPEC.
    expect(unknownLabel.className).toMatch(/italic/);
    expect(unknownLabel.className).toMatch(/text-gray-500/);
  });

  it('selecting Unknown adds "Unknown" to the URL via setUsers', async () => {
    const setUsers = vi.fn();
    useUserFilterMock.mockReturnValue({ users: [], setUsers });
    const user = userEvent.setup();
    render(<UserMultiSelect />);
    await user.click(screen.getByRole('button', { name: /Filter by user email/i }));
    // The checkbox is associated with the label — getByLabelText matches the visible label text.
    await user.click(screen.getByLabelText('Unknown (no email)'));
    expect(setUsers).toHaveBeenCalledWith(['Unknown']);
  });

  it('trigger button has sr-only "Filter by user email" label', () => {
    useUserFilterMock.mockReturnValue({ users: [], setUsers: vi.fn() });
    render(<UserMultiSelect />);
    // sr-only label associates via htmlFor → matched by accessible name.
    const trigger = screen.getByRole('button', { name: /Filter by user email/i });
    expect(trigger).toBeInTheDocument();
  });

  it('still works when usePerUserSummary returns no data (data: undefined)', async () => {
    usePerUserMock.mockReturnValue({ data: undefined });
    useUserFilterMock.mockReturnValue({ users: [], setUsers: vi.fn() });
    const user = userEvent.setup();
    render(<UserMultiSelect />);
    await user.click(screen.getByRole('button', { name: /Filter by user email/i }));
    expect(screen.getByText(/no users available/i)).toBeInTheDocument();
  });

  it('includes already-selected users in the option list even if not in available data (URL-driven survival)', async () => {
    // Edge case: a user navigates with ?users=ghost@x.com but ghost@x.com
    // hasn't appeared in the per-user RPC result. We must still show the
    // option (already checked) so the user can deselect it.
    usePerUserMock.mockReturnValue({ data: [{ user_email_label: 'a@x.com' }] });
    useUserFilterMock.mockReturnValue({ users: ['ghost@x.com'], setUsers: vi.fn() });
    const user = userEvent.setup();
    render(<UserMultiSelect />);
    await user.click(screen.getByRole('button', { name: /Filter by user email/i }));
    expect(screen.getByLabelText('ghost@x.com')).toBeInTheDocument();
  });
});
