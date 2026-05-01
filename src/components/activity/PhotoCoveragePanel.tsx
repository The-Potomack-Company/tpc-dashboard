import { usePhotoCoverage } from '../../hooks/activity/usePhotoCoverage';
import { ErrorState } from '../ErrorState';
import { EmptyState } from '../EmptyState';
import { formatCount } from '../../lib/format';

// Phase 3 / APP-10 / D-04 / D-25 — photo coverage stats panel.
//
// D-25: NUMERIC ONLY — no thumbnail grid here. The thumbnail strip lives
// inside SessionItemDisclosure (per-row expansion). This panel surfaces:
//   - Items with photos: {n_with} / {total}
//   - Items with no photos: {n_without}
//   - Upload-status breakdown: pending / uploading / uploaded / failed
//   - Red callout when status_failed > 0
//
// Loading: animate-pulse skeleton placeholders.
// Error:   locked ErrorState contract (D-35 — heading + body + onRetry).
// Empty:   EmptyState when items_total === 0.

function PhotoIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="w-5 h-5 text-gray-400"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
      />
    </svg>
  );
}

interface Props {
  sessionId: string;
}

export function PhotoCoveragePanel({ sessionId }: Props) {
  const query = usePhotoCoverage(sessionId);

  return (
    <section
      className="rounded-lg border border-gray-200 bg-white p-6"
      data-testid="photo-coverage-panel"
    >
      <header className="flex items-center gap-2 mb-4">
        <PhotoIcon />
        <h2 className="text-sm font-semibold text-gray-700">Photo coverage</h2>
      </header>

      {query.isLoading ? (
        <div className="space-y-2 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-6 bg-gray-200 rounded" />
          ))}
        </div>
      ) : query.error ? (
        <ErrorState
          heading="Couldn't load photo coverage"
          body="Retry below."
          onRetry={() => void query.refetch()}
        />
      ) : !query.data || Number(query.data.items_total) === 0 ? (
        <EmptyState heading="No items in this session">
          <p>Photo coverage appears once items are added.</p>
        </EmptyState>
      ) : (
        (() => {
          const c = query.data;
          const total = Number(c.items_total);
          const withPhotos = Number(c.items_with_photos);
          const withoutPhotos = Number(c.items_without_photos);
          const failedCount = Number(c.status_failed);

          return (
            <div className="space-y-4">
              <div>
                <div className="text-sm font-semibold text-gray-700">Items with photos</div>
                <div className="text-2xl font-semibold tabular-nums text-gray-900">
                  {formatCount(withPhotos)} / {formatCount(total)}
                </div>
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-700">Items with no photos</div>
                <div className="text-2xl font-semibold tabular-nums text-gray-900">
                  {formatCount(withoutPhotos)}
                </div>
              </div>
              <div className="border-t border-gray-200 pt-4">
                <div className="text-sm font-semibold text-gray-700 mb-2">By upload status</div>
                <ul className="space-y-1 text-sm text-gray-700">
                  {(['pending', 'uploading', 'uploaded', 'failed'] as const).map((s) => {
                    const key =
                      `status_${s}` as 'status_pending' | 'status_uploading' | 'status_uploaded' | 'status_failed';
                    const n = Number(c[key]);
                    return (
                      <li key={s} className="flex items-center justify-between">
                        <span className="lowercase">{s}</span>
                        <span className="flex items-center gap-2">
                          <span className="tabular-nums">{formatCount(n)}</span>
                          {s === 'failed' && n > 0 && (
                            <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-semibold">
                              {n} failed
                            </span>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {failedCount > 0 && (
                  <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3 mt-3">
                    {failedCount} {failedCount === 1 ? 'photo' : 'photos'} couldn't upload. Check the affected items in the list below.
                  </p>
                )}
              </div>
            </div>
          );
        })()
      )}
    </section>
  );
}
