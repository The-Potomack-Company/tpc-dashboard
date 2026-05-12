import { useState } from 'react';
import { useSignedPhotoUrl } from '../../hooks/useSignedPhotoUrl';
import type { PhotoMetaRow } from '../../services/activity/queries';

// Phase 3 / D-13 — single-photo signed-URL consumer.
//
// IMPORTANT: D-13 invariant — when `photo.upload_status === 'failed'`,
// NEVER call useSignedPhotoUrl. The hook's `enabled` arg short-circuits
// the queryFn so createSignedUrl is never called for failed photos.
// Test 9 in ThumbnailTile.test.tsx is the load-bearing assertion.
//
// State machine:
//   - upload_status='failed'                 → red "Failed upload" chip; NO signing
//   - upload_status='uploaded' + loading     → shimmer
//   - upload_status='uploaded' + success     → <img loading="lazy">
//   - upload_status='uploaded' + error       → red "Couldn't load" retry chip
//   - upload_status='pending'/'uploading'    → same as uploaded but with opacity-60 overlay
//
// Dev affordances: when `isDev=true`, renders a font-mono caption with the
// raw storage path under the tile (D-27 / D-28). Render-conditional pattern
// — the dev DOM never reaches the admin's browser at all (T-03-27).

interface Props {
  photo: Pick<PhotoMetaRow, 'id' | 'storage_path' | 'thumbnail_path' | 'upload_status'>;
  isDev?: boolean;
}

export function ThumbnailTile({ photo, isDev = false }: Props) {
  // Track an out-of-band <img onError> failure so we render the retry chip
  // even when TanStack returned a URL successfully but the browser 403'd
  // at render time (URL expired between fetch and render).
  const [imgErrored, setImgErrored] = useState(false);

  const isFailed = photo.upload_status === 'failed';
  const isPendingOrUploading =
    photo.upload_status === 'pending' || photo.upload_status === 'uploading';

  // D-13: enabled=false short-circuits createSignedUrl when the photo
  // is failed. The hook honors this in its queryFn `enabled` gate.
  const query = useSignedPhotoUrl({
    path: photo.thumbnail_path,
    enabled: !isFailed && !!photo.thumbnail_path,
  });

  if (isFailed) {
    return (
      <div className="flex flex-col gap-1" data-testid="thumbnail-tile-failed">
        <div
          role="img"
          aria-label="Failed upload"
          className="bg-err-wash text-err h-7 px-3 rounded text-sm font-semibold inline-flex items-center"
        >
          Failed upload
        </div>
        {isDev && photo.storage_path && (
          <div className="font-mono text-xs text-ink-3 break-all">{photo.storage_path}</div>
        )}
      </div>
    );
  }

  if (query.isLoading || query.isFetching) {
    return (
      <div
        className={`bg-bg-3 h-20 w-20 rounded motion-safe:animate-pulse ${
          isPendingOrUploading ? 'opacity-60' : ''
        }`}
        data-testid="thumbnail-shimmer"
        aria-busy="true"
      />
    );
  }

  if (query.error || !query.data || imgErrored) {
    return (
      <button
        type="button"
        onClick={() => {
          setImgErrored(false);
          void query.refetch();
        }}
        aria-label="Retry loading thumbnail"
        className="bg-err-wash text-err h-7 px-3 rounded text-sm font-semibold inline-flex items-center hover:bg-red-200 focus:ring-2 focus:ring-accent outline-none"
      >
        Couldn't load
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <img
        src={query.data}
        alt=""
        loading="lazy"
        className={`w-20 h-20 object-cover rounded ${isPendingOrUploading ? 'opacity-60' : ''}`}
        onError={() => {
          // 403 between fetch and render (URL expired). Mark errored so
          // we re-render as the retry chip; refetch is queued so the next
          // attempt populates a fresh URL.
          setImgErrored(true);
          void query.refetch();
        }}
      />
      {isDev && photo.thumbnail_path && (
        <div className="font-mono text-xs text-ink-3 break-all">{photo.thumbnail_path}</div>
      )}
    </div>
  );
}
