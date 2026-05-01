import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// Phase 3 / Plan 03-06 / Task 2 — ThumbnailTile tests.
//
// **LOAD-BEARING TEST 9**: D-13 invariant — for failed photos, the
// underlying createSignedUrl must NEVER be called. We mock the supabase
// storage layer at the module boundary so we can directly assert
// createSignedUrlMock.mock.calls.length === 0.
//
// Tests 10-13 exercise the success / loading / error / pending-overlay paths.

const createSignedUrlMock = vi.fn();

vi.mock('../../lib/supabase', () => ({
  supabase: {
    storage: {
      from: (_bucket: string) => ({
        createSignedUrl: createSignedUrlMock,
      }),
    },
  },
}));

import { ThumbnailTile } from './ThumbnailTile';

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
        refetchOnWindowFocus: false,
      },
    },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  createSignedUrlMock.mockReset();
  createSignedUrlMock.mockResolvedValue({
    data: { signedUrl: 'https://example.com/signed.webp' },
    error: null,
  });
});

describe('<ThumbnailTile>', () => {
  it('Test 9 (LOAD-BEARING D-13): when upload_status="failed", createSignedUrl is NEVER called', async () => {
    const Wrapper = makeWrapper();
    render(
      <ThumbnailTile
        photo={{
          id: 'p1',
          storage_path: 'sess1/item1/full.jpg',
          thumbnail_path: 'sess1/item1/thumb.webp',
          upload_status: 'failed',
        }}
      />,
      { wrapper: Wrapper },
    );
    // Wait a microtask so any errant queryFn would have started.
    await new Promise((r) => setTimeout(r, 10));
    expect(createSignedUrlMock).not.toHaveBeenCalled();
    // Failed-upload chip renders.
    expect(screen.getByLabelText(/Failed upload/i)).toBeInTheDocument();
    expect(screen.getByText(/Failed upload/i)).toBeInTheDocument();
  });

  it('Test 10: when upload_status="uploaded", calls createSignedUrl with thumbnail_path; renders <img> on success', async () => {
    const Wrapper = makeWrapper();
    const { container } = render(
      <ThumbnailTile
        photo={{
          id: 'p2',
          storage_path: 'sess1/item1/full.jpg',
          thumbnail_path: 'sess1/item1/thumb.webp',
          upload_status: 'uploaded',
        }}
      />,
      { wrapper: Wrapper },
    );
    // Initially shimmer.
    expect(screen.getByTestId('thumbnail-shimmer')).toBeInTheDocument();
    // After resolving the mock, image should appear. Empty-alt images are
    // removed from the a11y tree (presentation role), so query the DOM directly.
    let img: HTMLImageElement | null = null;
    await vi.waitFor(() => {
      img = container.querySelector('img');
      expect(img).not.toBeNull();
    });
    expect(img!).toHaveAttribute('src', 'https://example.com/signed.webp');
    expect(img!).toHaveAttribute('loading', 'lazy');
    expect(img!.className).toMatch(/object-cover/);
    // The hook was called with the thumbnail path.
    expect(createSignedUrlMock).toHaveBeenCalledWith(
      'sess1/item1/thumb.webp',
      3600,
    );
  });

  it('Test 11: when createSignedUrl rejects, renders retry chip with aria-label', async () => {
    createSignedUrlMock.mockReset();
    createSignedUrlMock.mockResolvedValue({
      data: null,
      error: new Error('storage failure'),
    });
    const Wrapper = makeWrapper();
    const { container } = render(
      <ThumbnailTile
        photo={{
          id: 'p3',
          storage_path: 'sess1/item1/full.jpg',
          thumbnail_path: 'sess1/item1/thumb.webp',
          upload_status: 'uploaded',
        }}
      />,
      { wrapper: Wrapper },
    );
    // The hook configures retry: 1 (D-11); allow time for the backoff before
    // the error state settles.
    const retryBtn = await screen.findByRole(
      'button',
      { name: /Retry loading thumbnail/i },
      { timeout: 4000 },
    );
    expect(retryBtn).toBeInTheDocument();
    expect(retryBtn).toHaveTextContent(/Couldn't load/i);

    // Click triggers a retry.
    createSignedUrlMock.mockReset();
    createSignedUrlMock.mockResolvedValue({
      data: { signedUrl: 'https://example.com/recovered.webp' },
      error: null,
    });
    const user = userEvent.setup();
    await user.click(retryBtn);
    let img: HTMLImageElement | null = null;
    await vi.waitFor(() => {
      img = container.querySelector('img');
      expect(img).not.toBeNull();
    });
    expect(img!).toHaveAttribute('src', 'https://example.com/recovered.webp');
  });

  it('Test 12: when <img onError> fires, swaps to retry chip (refetch invoked)', async () => {
    const Wrapper = makeWrapper();
    const { container } = render(
      <ThumbnailTile
        photo={{
          id: 'p4',
          storage_path: 'sess1/item1/full.jpg',
          thumbnail_path: 'sess1/item1/thumb.webp',
          upload_status: 'uploaded',
        }}
      />,
      { wrapper: Wrapper },
    );
    let img: HTMLImageElement | null = null;
    await vi.waitFor(() => {
      img = container.querySelector('img');
      expect(img).not.toBeNull();
    });
    expect(createSignedUrlMock).toHaveBeenCalledTimes(1);

    // Reset so we can detect the refetch from onError.
    createSignedUrlMock.mockClear();
    createSignedUrlMock.mockResolvedValue({
      data: { signedUrl: 'https://example.com/recovered.webp' },
      error: null,
    });

    // Fire native error event on the <img>.
    await act(async () => {
      fireEvent.error(img!);
    });

    // The component's onError invokes query.refetch() — which results in
    // a second createSignedUrl call.
    await new Promise((r) => setTimeout(r, 50));
    expect(createSignedUrlMock).toHaveBeenCalled();
  });

  it('Test 13a: when upload_status="pending", calls createSignedUrl AND adds opacity-60', async () => {
    const Wrapper = makeWrapper();
    const { container } = render(
      <ThumbnailTile
        photo={{
          id: 'p5',
          storage_path: 'sess1/item1/full.jpg',
          thumbnail_path: 'sess1/item1/thumb.webp',
          upload_status: 'pending',
        }}
      />,
      { wrapper: Wrapper },
    );
    expect(createSignedUrlMock).toHaveBeenCalled();
    // Shimmer state initially renders with opacity-60 overlay.
    const shimmer = screen.getByTestId('thumbnail-shimmer');
    expect(shimmer.className).toMatch(/opacity-60/);
    // After resolution the img also has opacity-60.
    let img: HTMLImageElement | null = null;
    await vi.waitFor(() => {
      img = container.querySelector('img');
      expect(img).not.toBeNull();
    });
    expect(img!.className).toMatch(/opacity-60/);
  });

  it('Test 13b: when upload_status="uploading", same opacity-60 treatment', async () => {
    const Wrapper = makeWrapper();
    const { container } = render(
      <ThumbnailTile
        photo={{
          id: 'p6',
          storage_path: 'sess1/item1/full.jpg',
          thumbnail_path: 'sess1/item1/thumb.webp',
          upload_status: 'uploading',
        }}
      />,
      { wrapper: Wrapper },
    );
    expect(createSignedUrlMock).toHaveBeenCalled();
    let img: HTMLImageElement | null = null;
    await vi.waitFor(() => {
      img = container.querySelector('img');
      expect(img).not.toBeNull();
    });
    expect(img!.className).toMatch(/opacity-60/);
  });

  it('Test 13c: when isDev=true and upload_status="failed", caption shows storage_path', () => {
    const Wrapper = makeWrapper();
    render(
      <ThumbnailTile
        photo={{
          id: 'p7',
          storage_path: 'sess1/item1/full.jpg',
          thumbnail_path: 'sess1/item1/thumb.webp',
          upload_status: 'failed',
        }}
        isDev
      />,
      { wrapper: Wrapper },
    );
    expect(createSignedUrlMock).not.toHaveBeenCalled();
    expect(screen.getByText('sess1/item1/full.jpg')).toBeInTheDocument();
  });
});
