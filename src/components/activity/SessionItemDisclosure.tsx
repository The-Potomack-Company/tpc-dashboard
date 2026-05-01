import { useSessionPhotos } from '../../hooks/activity/useSessionPhotos';
import { ThumbnailTile } from './ThumbnailTile';
import { RawItemInspector } from './RawItemInspector';
import { ErrorState } from '../ErrorState';
import type { ItemListRow } from '../../services/activity/queries';

// Phase 3 / D-06 / D-09 / D-28 — per-row expansion body for SessionItemList.
//
// Mounts only when an item row is expanded — the SessionItemList only
// renders this component inside the conditional `row.getIsExpanded()`
// branch, so `useSessionPhotos(item.id)` does NOT fire until the user
// expands the row (D-09 lazy fetch timing).
//
// Layout:
//   - Thumbnail strip (horizontal flex, one ThumbnailTile per photo)
//   - When isDev: RawItemInspector below the strip
//
// Loading / error / empty: handled inline (compact treatment to fit a
// table row body — no big EmptyState card here).

interface Props {
  item: ItemListRow;
  isDev: boolean;
}

export function SessionItemDisclosure({ item, isDev }: Props) {
  const photosQuery = useSessionPhotos(item.id);

  return (
    <div
      className="bg-gray-50 p-4 space-y-4"
      data-testid={`item-disclosure-${item.id}`}
    >
      {photosQuery.isLoading ? (
        <div className="flex gap-2">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="bg-gray-200 h-20 w-20 rounded motion-safe:animate-pulse"
            />
          ))}
        </div>
      ) : photosQuery.error ? (
        <ErrorState
          heading="Couldn't load photos"
          body="Retry below."
          onRetry={() => void photosQuery.refetch()}
        />
      ) : (photosQuery.data ?? []).length === 0 ? (
        <p className="text-sm text-gray-500 italic">No photos for this item.</p>
      ) : (
        <div
          className="flex gap-2 overflow-x-auto"
          role="list"
          aria-label="Item thumbnails"
        >
          {(photosQuery.data ?? []).map((photo) => (
            <div key={photo.id} role="listitem">
              <ThumbnailTile photo={photo} isDev={isDev} />
            </div>
          ))}
        </div>
      )}
      {isDev && <RawItemInspector item={item} />}
    </div>
  );
}
