import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PhotoCoveragePanel } from './PhotoCoveragePanel';

// Phase 3 / Plan 03-06 / Task 2 — PhotoCoveragePanel tests.
//
// D-25: numeric only, no thumbnail grid. Mock `usePhotoCoverage` directly.

const usePhotoCoverageMock = vi.fn();
vi.mock('../../hooks/activity/usePhotoCoverage', () => ({
  usePhotoCoverage: (id: string | undefined) => usePhotoCoverageMock(id),
}));

beforeEach(() => {
  usePhotoCoverageMock.mockReset();
});

describe('<PhotoCoveragePanel>', () => {
  it('Test 4: renders heading + items-with/without-photos counts', () => {
    usePhotoCoverageMock.mockReturnValue({
      data: {
        items_total: 10,
        items_with_photos: 7,
        items_without_photos: 3,
        status_pending: 1,
        status_uploading: 0,
        status_uploaded: 6,
        status_failed: 0,
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<PhotoCoveragePanel sessionId="s1" />);
    expect(screen.getByRole('heading', { name: /Photo coverage/i })).toBeInTheDocument();
    expect(screen.getByText(/Items with photos/i)).toBeInTheDocument();
    // 7 / 10 numeric.
    const withCount = screen.getByText('7 / 10');
    expect(withCount).toBeInTheDocument();
    expect(screen.getByText(/Items with no photos/i)).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('Test 5: lists 4 upload-status rows (pending/uploading/uploaded/failed)', () => {
    usePhotoCoverageMock.mockReturnValue({
      data: {
        items_total: 10,
        items_with_photos: 7,
        items_without_photos: 3,
        status_pending: 1,
        status_uploading: 2,
        status_uploaded: 6,
        status_failed: 4,
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<PhotoCoveragePanel sessionId="s1" />);
    expect(screen.getByText('pending')).toBeInTheDocument();
    expect(screen.getByText('uploading')).toBeInTheDocument();
    expect(screen.getByText('uploaded')).toBeInTheDocument();
    expect(screen.getByText('failed')).toBeInTheDocument();
  });

  it('Test 6a: renders red callout + chip when status_failed > 0 (singular: 1 photo)', () => {
    usePhotoCoverageMock.mockReturnValue({
      data: {
        items_total: 10,
        items_with_photos: 7,
        items_without_photos: 3,
        status_pending: 0,
        status_uploading: 0,
        status_uploaded: 9,
        status_failed: 1,
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<PhotoCoveragePanel sessionId="s1" />);
    expect(
      screen.getByText(/1 photo couldn't upload/i),
    ).toBeInTheDocument();
    // Red chip with "1 failed" text.
    expect(screen.getByText('1 failed')).toBeInTheDocument();
  });

  it('Test 6b: renders red callout when status_failed > 1 (plural: photos)', () => {
    usePhotoCoverageMock.mockReturnValue({
      data: {
        items_total: 10,
        items_with_photos: 7,
        items_without_photos: 3,
        status_pending: 0,
        status_uploading: 0,
        status_uploaded: 5,
        status_failed: 5,
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<PhotoCoveragePanel sessionId="s1" />);
    expect(
      screen.getByText(/5 photos couldn't upload/i),
    ).toBeInTheDocument();
  });

  it('Test 6c: NO callout when status_failed = 0', () => {
    usePhotoCoverageMock.mockReturnValue({
      data: {
        items_total: 10,
        items_with_photos: 7,
        items_without_photos: 3,
        status_pending: 0,
        status_uploading: 0,
        status_uploaded: 10,
        status_failed: 0,
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<PhotoCoveragePanel sessionId="s1" />);
    expect(
      screen.queryByText(/couldn't upload/i),
    ).not.toBeInTheDocument();
  });

  it('Test 7: empty state when items_total === 0', () => {
    usePhotoCoverageMock.mockReturnValue({
      data: {
        items_total: 0,
        items_with_photos: 0,
        items_without_photos: 0,
        status_pending: 0,
        status_uploading: 0,
        status_uploaded: 0,
        status_failed: 0,
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<PhotoCoveragePanel sessionId="s1" />);
    expect(
      screen.getByRole('heading', { name: /No items in this session/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Photo coverage appears once items are added/i)).toBeInTheDocument();
  });

  it('Test 8a: loading state renders skeleton', () => {
    usePhotoCoverageMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });
    const { container } = render(<PhotoCoveragePanel sessionId="s1" />);
    // Skeleton uses animate-pulse — at least one element with that class.
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('Test 8b: error state uses locked <ErrorState> contract (heading + body + onRetry)', async () => {
    const refetch = vi.fn();
    usePhotoCoverageMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('boom'),
      refetch,
    });
    const user = userEvent.setup();
    render(<PhotoCoveragePanel sessionId="s1" />);
    expect(screen.getByText(/Couldn't load photo coverage/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Retry/i }));
    expect(refetch).toHaveBeenCalled();
  });
});
