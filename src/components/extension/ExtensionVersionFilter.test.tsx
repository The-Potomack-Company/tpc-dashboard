import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Phase 2 / EXT-09 — ExtensionVersionFilter tests.
// Mocks both the URL-state hook (useVersionFilter, Plan 02-02) and the
// option-list hook (useDistinctVersions, Plan 02-03) so this test exercises
// only the popover behavior. Confirms the component does NOT call supabase
// directly (Checker WARNING #4 — option list comes from useDistinctVersions
// hook, never an inline `.from('analytics_events')` query).

const useVersionFilterMock = vi.fn();
const useDistinctVersionsMock = vi.fn();

vi.mock('../../hooks/extension/useVersionFilter', () => ({
  useVersionFilter: () => useVersionFilterMock(),
}));
vi.mock('../../hooks/extension/useDistinctVersions', () => ({
  useDistinctVersions: () => useDistinctVersionsMock(),
}));

import { ExtensionVersionFilter } from './ExtensionVersionFilter';

beforeEach(() => {
  useVersionFilterMock.mockReset();
  useDistinctVersionsMock.mockReset();
  useDistinctVersionsMock.mockReturnValue({
    data: ['2.0.2', '2.0.1'],
    isLoading: false,
    error: null,
  });
});

describe('<ExtensionVersionFilter>', () => {
  it('Test 1: with no ?versions= URL param, trigger shows "All versions" placeholder', () => {
    useVersionFilterMock.mockReturnValue({ versions: [], setVersions: vi.fn() });
    render(<ExtensionVersionFilter />);
    expect(
      screen.getByRole('button', { name: 'Filter by extension version' }),
    ).toHaveTextContent('All versions');
  });

  it('Test 2: with ?versions=2.0.1,2.0.2, trigger shows "2 versions"', () => {
    useVersionFilterMock.mockReturnValue({
      versions: ['2.0.1', '2.0.2'],
      setVersions: vi.fn(),
    });
    render(<ExtensionVersionFilter />);
    expect(
      screen.getByRole('button', { name: 'Filter by extension version' }),
    ).toHaveTextContent('2 versions');
  });

  it('Test 2b: with ?versions=2.0.1 (singular), trigger shows "1 version"', () => {
    useVersionFilterMock.mockReturnValue({
      versions: ['2.0.1'],
      setVersions: vi.fn(),
    });
    render(<ExtensionVersionFilter />);
    expect(
      screen.getByRole('button', { name: 'Filter by extension version' }),
    ).toHaveTextContent('1 version');
  });

  it('Test 3: clicking the trigger opens the popover; Escape closes', async () => {
    useVersionFilterMock.mockReturnValue({ versions: [], setVersions: vi.fn() });
    render(<ExtensionVersionFilter />);
    const trigger = screen.getByRole('button', {
      name: 'Filter by extension version',
    });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    await userEvent.click(trigger);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('Test 3b: clicking outside the popover closes it', async () => {
    useVersionFilterMock.mockReturnValue({ versions: [], setVersions: vi.fn() });
    render(
      <div>
        <ExtensionVersionFilter />
        <div data-testid="outside">outside</div>
      </div>,
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Filter by extension version' }),
    );
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('Test 4: toggling a version checkbox calls setVersions with the new array', async () => {
    const setVersions = vi.fn();
    useVersionFilterMock.mockReturnValue({ versions: [], setVersions });
    render(<ExtensionVersionFilter />);
    await userEvent.click(
      screen.getByRole('button', { name: 'Filter by extension version' }),
    );
    await userEvent.click(screen.getByLabelText('2.0.1'));
    expect(setVersions).toHaveBeenCalledWith(['2.0.1']);
  });

  it('Test 4b: toggling an already-selected version removes it', async () => {
    const setVersions = vi.fn();
    useVersionFilterMock.mockReturnValue({
      versions: ['2.0.1', '2.0.2'],
      setVersions,
    });
    render(<ExtensionVersionFilter />);
    await userEvent.click(
      screen.getByRole('button', { name: 'Filter by extension version' }),
    );
    await userEvent.click(screen.getByLabelText('2.0.1'));
    expect(setVersions).toHaveBeenCalledWith(['2.0.2']);
  });

  it('Test 5: trigger has sr-only label "Filter by extension version"', () => {
    useVersionFilterMock.mockReturnValue({ versions: [], setVersions: vi.fn() });
    render(<ExtensionVersionFilter />);
    // sr-only <label htmlFor="..."> + aria-label on the button both serve the same name
    const trigger = screen.getByRole('button', {
      name: 'Filter by extension version',
    });
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('Test 6: option list comes from useDistinctVersions (no inline supabase calls)', async () => {
    useVersionFilterMock.mockReturnValue({ versions: [], setVersions: vi.fn() });
    useDistinctVersionsMock.mockReturnValue({
      data: ['3.0.0', '2.5.1', '2.0.0'],
      isLoading: false,
      error: null,
    });
    render(<ExtensionVersionFilter />);
    await userEvent.click(
      screen.getByRole('button', { name: 'Filter by extension version' }),
    );
    expect(screen.getByLabelText('3.0.0')).toBeInTheDocument();
    expect(screen.getByLabelText('2.5.1')).toBeInTheDocument();
    expect(screen.getByLabelText('2.0.0')).toBeInTheDocument();
  });

  it('Test 6b: already-selected versions absent from option list still appear (URL-driven survival)', async () => {
    useVersionFilterMock.mockReturnValue({
      versions: ['9.9.9'],
      setVersions: vi.fn(),
    });
    useDistinctVersionsMock.mockReturnValue({
      data: ['2.0.2', '2.0.1'],
      isLoading: false,
      error: null,
    });
    render(<ExtensionVersionFilter />);
    await userEvent.click(
      screen.getByRole('button', { name: 'Filter by extension version' }),
    );
    // ghost version still listed so the user can deselect it
    expect(screen.getByLabelText('9.9.9')).toBeInTheDocument();
  });

  it('Test 6c: empty option list shows "No versions available"', async () => {
    useVersionFilterMock.mockReturnValue({ versions: [], setVersions: vi.fn() });
    useDistinctVersionsMock.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });
    render(<ExtensionVersionFilter />);
    await userEvent.click(
      screen.getByRole('button', { name: 'Filter by extension version' }),
    );
    expect(screen.getByText('No versions available')).toBeInTheDocument();
  });
});
