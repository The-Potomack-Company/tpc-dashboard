import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionItemList } from './SessionItemList';
import type { ItemListRow } from '../../services/activity/queries';

// Phase 3 / Plan 03-06 / Task 2 — SessionItemList tests.
//
// Mocks useSessionItems (data hook) and useAuthStore (dev gate via email).
// Stubs SessionItemDisclosure so we can assert the expanded body renders
// without pulling in useSessionPhotos.

const useSessionItemsMock = vi.fn();
const useAuthStoreMock = vi.fn();

vi.mock('../../hooks/activity/useSessionDetail', () => ({
  useSessionItems: (id: string | undefined) => useSessionItemsMock(id),
}));
vi.mock('../../stores/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) => useAuthStoreMock(selector),
}));
vi.mock('./SessionItemDisclosure', () => ({
  SessionItemDisclosure: ({
    item,
    isDev,
  }: {
    item: { id: string };
    isDev: boolean;
  }) => (
    <div data-testid={`disclosure-body-${item.id}`} data-isdev={String(isDev)} />
  ),
}));

const ITEMS: ItemListRow[] = [
  {
    id: 'i1',
    receipt_number: 'R001',
    title: 'Painting',
    ai_status: 'done',
    description: null,
    category: null,
    estimate: null,
    measurements: null,
    transcript: null,
    created_at: '2026-03-01T00:00:00Z',
    photo_count: 3,
  },
  {
    id: 'i2',
    receipt_number: null,
    title: null,
    ai_status: 'failed',
    description: null,
    category: null,
    estimate: null,
    measurements: null,
    transcript: null,
    created_at: '2026-03-02T00:00:00Z',
    photo_count: 0,
  },
];

beforeEach(() => {
  useSessionItemsMock.mockReset();
  useAuthStoreMock.mockReset();
  // Default: admin (non-dev email).
  useAuthStoreMock.mockImplementation((selector) =>
    selector({ profile: { email: 'admin@example.com' } }),
  );
});

describe('<SessionItemList>', () => {
  it('Test 22a: renders 4 admin column headers (Receipt #, Title, AI status, Photos) + Raw header', () => {
    useSessionItemsMock.mockReturnValue({
      data: ITEMS,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<SessionItemList sessionId="s1" />);
    expect(screen.getByText('Receipt #')).toBeInTheDocument();
    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('AI status')).toBeInTheDocument();
    expect(screen.getByText('Photos')).toBeInTheDocument();
    expect(screen.getByText('Raw')).toBeInTheDocument();
  });

  it('Test 22b: receipt_number cell shows EMPTY (em-dash) for null', () => {
    useSessionItemsMock.mockReturnValue({
      data: ITEMS,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<SessionItemList sessionId="s1" />);
    expect(screen.getByText('R001')).toBeInTheDocument();
    // Em-dash appears for the null receipt and null title and 0 photo_count.
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });

  it('Test 23: clicking a row toggles expansion; expanded body renders <SessionItemDisclosure>', async () => {
    useSessionItemsMock.mockReturnValue({
      data: ITEMS,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    const user = userEvent.setup();
    render(<SessionItemList sessionId="s1" />);
    // Initially neither disclosure body is rendered (no row expanded).
    expect(screen.queryByTestId('disclosure-body-i1')).not.toBeInTheDocument();

    // Click first data row (the row containing R001).
    const r001Cell = screen.getByText('R001');
    await user.click(r001Cell);
    expect(screen.getByTestId('disclosure-body-i1')).toBeInTheDocument();

    // Click again to collapse.
    await user.click(r001Cell);
    expect(screen.queryByTestId('disclosure-body-i1')).not.toBeInTheDocument();
  });

  it('Test 24: AI status cell renders chip with appropriate tone class', () => {
    useSessionItemsMock.mockReturnValue({
      data: ITEMS,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<SessionItemList sessionId="s1" />);
    const doneChip = screen.getByText('done');
    expect(doneChip.className).toMatch(/bg-green-100/);
    expect(doneChip.className).toMatch(/text-green-700/);
    const failedChip = screen.getByText('failed');
    expect(failedChip.className).toMatch(/bg-red-100/);
  });

  it('Test 25: photo count cell — 0 renders EMPTY, >0 renders numeric tabular-nums', () => {
    useSessionItemsMock.mockReturnValue({
      data: ITEMS,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<SessionItemList sessionId="s1" />);
    // Item with 3 photos.
    expect(screen.getByText('3')).toBeInTheDocument();
    // Item with 0 photos → em-dash (asserted via at-least-one '—' present).
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('Test 26: loading state renders <TableSkeleton>', () => {
    useSessionItemsMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });
    const { container } = render(<SessionItemList sessionId="s1" />);
    // TableSkeleton uses motion-safe:animate-pulse on its bars.
    expect(container.querySelector('.motion-safe\\:animate-pulse')).toBeInTheDocument();
  });

  it('Test 27: empty state heading + body when 0 items', () => {
    useSessionItemsMock.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<SessionItemList sessionId="s1" />);
    expect(
      screen.getByRole('heading', { name: /No items in this session/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Items appear here as the specialist catalogs them/i))
      .toBeInTheDocument();
  });

  it('Test 28: error state uses locked <ErrorState>', async () => {
    const refetch = vi.fn();
    useSessionItemsMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('boom'),
      refetch,
    });
    const user = userEvent.setup();
    render(<SessionItemList sessionId="s1" />);
    expect(screen.getByText(/Couldn't load items/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Retry/i }));
    expect(refetch).toHaveBeenCalled();
  });

  it('Test 29: Raw column header is ALWAYS rendered; admin cells are blank, dev cells show "expand row →"', () => {
    useSessionItemsMock.mockReturnValue({
      data: ITEMS,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    // First render as admin — Raw header present, cells blank.
    const { unmount } = render(<SessionItemList sessionId="s1" />);
    expect(screen.getByText('Raw')).toBeInTheDocument();
    expect(screen.queryByText(/expand row/i)).not.toBeInTheDocument();
    unmount();

    // Re-render as dev.
    useAuthStoreMock.mockImplementation((selector) =>
      selector({ profile: { email: 'josh@potomackco.com' } }),
    );
    render(<SessionItemList sessionId="s1" />);
    expect(screen.getByText('Raw')).toBeInTheDocument();
    // dev cell hint appears for each item.
    expect(screen.getAllByText(/expand row/i).length).toBeGreaterThan(0);
  });

  it('passes isDev=true to SessionItemDisclosure when caller is a dev account', async () => {
    useSessionItemsMock.mockReturnValue({
      data: ITEMS,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    useAuthStoreMock.mockImplementation((selector) =>
      selector({ profile: { email: 'josh@potomackco.com' } }),
    );
    const user = userEvent.setup();
    render(<SessionItemList sessionId="s1" />);
    // Expand first row.
    await user.click(screen.getByText('R001'));
    const body = screen.getByTestId('disclosure-body-i1');
    expect(body).toHaveAttribute('data-isdev', 'true');
  });
});
