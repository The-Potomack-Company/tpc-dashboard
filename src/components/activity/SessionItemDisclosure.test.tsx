import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionItemDisclosure } from './SessionItemDisclosure';
import type { ItemListRow } from '../../services/activity/queries';

// Phase 3 / Plan 03-06 / Task 2 — SessionItemDisclosure tests.
//
// D-09: lazy fetch — useSessionPhotos only runs when this component
// mounts. Tested by counting hook invocations across mount cycles.

const useSessionPhotosMock = vi.fn();
vi.mock('../../hooks/activity/useSessionPhotos', () => ({
  useSessionPhotos: (id: string | undefined) => useSessionPhotosMock(id),
}));

// Stub ThumbnailTile so we don't need to mock supabase storage here.
vi.mock('./ThumbnailTile', () => ({
  ThumbnailTile: ({ photo, isDev }: { photo: { id: string }; isDev: boolean }) => (
    <div data-testid={`thumbnail-tile-${photo.id}`} data-isdev={String(isDev)} />
  ),
}));

// Stub RawItemInspector so we don't need to render the modal.
vi.mock('./RawItemInspector', () => ({
  RawItemInspector: ({ item }: { item: { id: string } }) => (
    <div data-testid={`raw-item-inspector-${item.id}`} />
  ),
}));

const ITEM: ItemListRow = {
  id: 'i1',
  receipt_number: 'R001',
  title: 'Painting',
  ai_status: 'done',
  description: 'desc',
  category: 'Art',
  estimate: '$100',
  measurements: '24x36',
  transcript: 'tr',
  created_at: '2026-03-01T00:00:00Z',
  photo_count: 3,
};

beforeEach(() => {
  useSessionPhotosMock.mockReset();
});

describe('<SessionItemDisclosure>', () => {
  it('Test 14: useSessionPhotos invoked exactly once with item.id (lazy mount per D-09)', () => {
    useSessionPhotosMock.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<SessionItemDisclosure item={ITEM} isDev={false} />);
    expect(useSessionPhotosMock).toHaveBeenCalledWith('i1');
    expect(useSessionPhotosMock).toHaveBeenCalledTimes(1);
  });

  it('Test 15a: renders thumbnail strip with one ThumbnailTile per photo (failed photos still get a tile)', () => {
    useSessionPhotosMock.mockReturnValue({
      data: [
        { id: 'p1', storage_path: 'a/full.jpg', thumbnail_path: 'a/thumb.webp', upload_status: 'uploaded' },
        { id: 'p2', storage_path: 'b/full.jpg', thumbnail_path: 'b/thumb.webp', upload_status: 'failed' },
        { id: 'p3', storage_path: 'c/full.jpg', thumbnail_path: 'c/thumb.webp', upload_status: 'pending' },
      ],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<SessionItemDisclosure item={ITEM} isDev={false} />);
    // ThumbnailTile is rendered per-photo (it internally handles failed state with no signing).
    expect(screen.getByTestId('thumbnail-tile-p1')).toBeInTheDocument();
    expect(screen.getByTestId('thumbnail-tile-p2')).toBeInTheDocument();
    expect(screen.getByTestId('thumbnail-tile-p3')).toBeInTheDocument();
  });

  it('Test 15b: renders "no photos" message when data is empty array', () => {
    useSessionPhotosMock.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<SessionItemDisclosure item={ITEM} isDev={false} />);
    expect(screen.getByText(/No photos for this item/i)).toBeInTheDocument();
  });

  it('Test 15c: renders skeleton placeholders when loading', () => {
    useSessionPhotosMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });
    const { container } = render(
      <SessionItemDisclosure item={ITEM} isDev={false} />,
    );
    // Skeleton tiles use motion-safe:animate-pulse class.
    expect(container.querySelector('.motion-safe\\:animate-pulse')).toBeInTheDocument();
  });

  it('Test 15d: renders <ErrorState> on error per locked contract', () => {
    useSessionPhotosMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('boom'),
      refetch: vi.fn(),
    });
    render(<SessionItemDisclosure item={ITEM} isDev={false} />);
    expect(screen.getByText(/Couldn't load photos/i)).toBeInTheDocument();
  });

  it('Test 16: when isDev=true, renders RawItemInspector below the thumbnail strip', () => {
    useSessionPhotosMock.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<SessionItemDisclosure item={ITEM} isDev={true} />);
    expect(screen.getByTestId('raw-item-inspector-i1')).toBeInTheDocument();
  });

  it('Test 16b: when isDev=false, RawItemInspector is NOT rendered', () => {
    useSessionPhotosMock.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<SessionItemDisclosure item={ITEM} isDev={false} />);
    expect(screen.queryByTestId('raw-item-inspector-i1')).not.toBeInTheDocument();
  });

  it('Test 17: when isDev=true, ThumbnailTile receives isDev=true (caption rendered downstream)', () => {
    useSessionPhotosMock.mockReturnValue({
      data: [
        { id: 'p1', storage_path: 'a/full.jpg', thumbnail_path: 'a/thumb.webp', upload_status: 'uploaded' },
      ],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<SessionItemDisclosure item={ITEM} isDev={true} />);
    const tile = screen.getByTestId('thumbnail-tile-p1');
    expect(tile).toHaveAttribute('data-isdev', 'true');
  });

  it('Test 18: when isDev=false, ThumbnailTile receives isDev=false (no caption surfaces)', () => {
    useSessionPhotosMock.mockReturnValue({
      data: [
        { id: 'p1', storage_path: 'a/full.jpg', thumbnail_path: 'a/thumb.webp', upload_status: 'uploaded' },
      ],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<SessionItemDisclosure item={ITEM} isDev={false} />);
    const tile = screen.getByTestId('thumbnail-tile-p1');
    expect(tile).toHaveAttribute('data-isdev', 'false');
  });
});
