import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SpecialistMultiSelect } from './SpecialistMultiSelect';

// Phase 3 / Plan 03-06 / Task 1 — SpecialistMultiSelect tests.
//
// Mock the two hooks the component reads:
//   - useSpecialistFilter (URL-state — selected specialists + setter)
//   - useActiveSpecialists (TanStack Query — option list)
//
// D-19: option list filters admins server-side via the hook's RPC. The
// component just renders whatever rows the hook returns. Filter param
// value is email (Pitfall 5); the popover label shows display_name.

const useSpecialistFilterMock = vi.fn();
const useActiveSpecialistsMock = vi.fn();

vi.mock('../hooks/useSpecialistFilter', () => ({
  useSpecialistFilter: () => useSpecialistFilterMock(),
}));
vi.mock('../hooks/activity/useActiveSpecialists', () => ({
  useActiveSpecialists: () => useActiveSpecialistsMock(),
}));

beforeEach(() => {
  useSpecialistFilterMock.mockReset();
  useActiveSpecialistsMock.mockReset();
  // Default: three active specialists, no admin in the result (admins
  // already filtered server-side).
  useActiveSpecialistsMock.mockReturnValue({
    data: [
      { id: 'u1', email: 'alice@potomackco.com', display_name: 'Alice' },
      { id: 'u2', email: 'bob@potomackco.com', display_name: 'Bob' },
      { id: 'u3', email: 'carol@potomackco.com', display_name: 'Carol' },
    ],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  });
});

describe('<SpecialistMultiSelect>', () => {
  it('Test 1a: shows "All specialists" trigger when no filters set', () => {
    useSpecialistFilterMock.mockReturnValue({
      specialists: [],
      setSpecialists: vi.fn(),
    });
    render(<SpecialistMultiSelect />);
    expect(
      screen.getByRole('button', { name: /Filter by specialist/i }),
    ).toHaveTextContent('All specialists');
  });

  it('Test 1b: shows "1 specialist" (singular) when one selected', () => {
    useSpecialistFilterMock.mockReturnValue({
      specialists: ['alice@potomackco.com'],
      setSpecialists: vi.fn(),
    });
    render(<SpecialistMultiSelect />);
    expect(
      screen.getByRole('button', { name: /Filter by specialist/i }),
    ).toHaveTextContent('1 specialist');
  });

  it('Test 1c: shows "{n} specialists" (plural) when multiple selected', () => {
    useSpecialistFilterMock.mockReturnValue({
      specialists: ['alice@potomackco.com', 'bob@potomackco.com'],
      setSpecialists: vi.fn(),
    });
    render(<SpecialistMultiSelect />);
    expect(
      screen.getByRole('button', { name: /Filter by specialist/i }),
    ).toHaveTextContent('2 specialists');
  });

  it('Test 1d: popover renders display_name labels (NOT email) per D-19', async () => {
    useSpecialistFilterMock.mockReturnValue({
      specialists: [],
      setSpecialists: vi.fn(),
    });
    const user = userEvent.setup();
    render(<SpecialistMultiSelect />);
    await user.click(
      screen.getByRole('button', { name: /Filter by specialist/i }),
    );
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Carol')).toBeInTheDocument();
    // Email should NOT appear as the visible label.
    expect(screen.queryByText('alice@potomackco.com')).not.toBeInTheDocument();
  });

  it('Test 2: opens popover on click; closes on outside click and Escape', async () => {
    useSpecialistFilterMock.mockReturnValue({
      specialists: [],
      setSpecialists: vi.fn(),
    });
    const user = userEvent.setup();
    render(<SpecialistMultiSelect />);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    // Click trigger → popover opens.
    await user.click(
      screen.getByRole('button', { name: /Filter by specialist/i }),
    );
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    // Outside click → closes (handler listens for mousedown).
    await act(async () => {
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    // Re-open and test Escape.
    await user.click(
      screen.getByRole('button', { name: /Filter by specialist/i }),
    );
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('Test 3a: toggling an unchecked option calls setSpecialists with email added', async () => {
    const setSpecialists = vi.fn();
    useSpecialistFilterMock.mockReturnValue({
      specialists: [],
      setSpecialists,
    });
    const user = userEvent.setup();
    render(<SpecialistMultiSelect />);
    await user.click(
      screen.getByRole('button', { name: /Filter by specialist/i }),
    );
    await user.click(screen.getByLabelText('Alice'));
    expect(setSpecialists).toHaveBeenCalledWith(['alice@potomackco.com']);
  });

  it('Test 3b: toggling a checked option calls setSpecialists with email removed', async () => {
    const setSpecialists = vi.fn();
    useSpecialistFilterMock.mockReturnValue({
      specialists: ['alice@potomackco.com', 'bob@potomackco.com'],
      setSpecialists,
    });
    const user = userEvent.setup();
    render(<SpecialistMultiSelect />);
    await user.click(
      screen.getByRole('button', { name: /Filter by specialist/i }),
    );
    await user.click(screen.getByLabelText('Alice'));
    expect(setSpecialists).toHaveBeenCalledWith(['bob@potomackco.com']);
  });

  it('Test 4: renders all rows returned by useActiveSpecialists (admin exclusion enforced upstream)', async () => {
    useSpecialistFilterMock.mockReturnValue({
      specialists: [],
      setSpecialists: vi.fn(),
    });
    const user = userEvent.setup();
    render(<SpecialistMultiSelect />);
    await user.click(
      screen.getByRole('button', { name: /Filter by specialist/i }),
    );
    // The mock returned 3 rows; all 3 should render.
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(3);
  });

  it('Test 5: loading state renders placeholder', async () => {
    useSpecialistFilterMock.mockReturnValue({
      specialists: [],
      setSpecialists: vi.fn(),
    });
    useActiveSpecialistsMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });
    const user = userEvent.setup();
    render(<SpecialistMultiSelect />);
    await user.click(
      screen.getByRole('button', { name: /Filter by specialist/i }),
    );
    expect(screen.getByText(/Loading specialists/i)).toBeInTheDocument();
  });

  it('Test 6: error state renders inline error chip + retry affordance', async () => {
    const refetch = vi.fn();
    useSpecialistFilterMock.mockReturnValue({
      specialists: [],
      setSpecialists: vi.fn(),
    });
    useActiveSpecialistsMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('boom'),
      refetch,
    });
    const user = userEvent.setup();
    render(<SpecialistMultiSelect />);
    await user.click(
      screen.getByRole('button', { name: /Filter by specialist/i }),
    );
    expect(screen.getByText(/Couldn't load specialists/i)).toBeInTheDocument();
    const retryBtn = screen.getByRole('button', { name: /retry/i });
    await user.click(retryBtn);
    expect(refetch).toHaveBeenCalled();
  });
});
