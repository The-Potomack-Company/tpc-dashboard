import { useEffect } from 'react';
import { useParams, useLocation } from 'react-router';
import { BackLink } from '../components/BackLink';
import { SessionMetadataCard } from '../components/activity/SessionMetadataCard';
import { PhotoCoveragePanel } from '../components/activity/PhotoCoveragePanel';
import { SessionItemList } from '../components/activity/SessionItemList';
import { ErrorState } from '../components/ErrorState';
import { EmptyState } from '../components/EmptyState';
import { useSessionDetail } from '../hooks/activity/useSessionDetail';
import { useTimezone } from '../hooks/useTimezone';

// Phase 3 / APP-06 / D-02 / D-03 / D-04 — `/activity/sessions/:id` page shell.
//
// D-02: dedicated nested route under /activity (not a modal).
// D-03: BackLink preserves URL filter params (?range=, ?specialists=, ?mode=)
//   so browser-back lands on /activity with the same filter selection. We
//   read `useLocation().search` from the route's location and pass it
//   verbatim into the BackLink's `to`.
// D-04: layout — metadata card (xl:col-span-2) + PhotoCoveragePanel
//   (xl:col-span-1) in a 3-col grid; SessionItemList full width below.
//
// Timestamp formatting is the page's responsibility (per Plan 03-06's
// SessionMetadataCard — pure presentation, no timezone concern). We
// pre-format `created_at` / `updated_at` here via `useTimezone()` and
// hand the formatted strings to the metadata card.
//
// Loading / not-found / error branches each have their own state per
// 03-UI-SPEC § Loading/Error contracts.

export function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const query = useSessionDetail(id);
  const { formatDateTime } = useTimezone();

  // Document.title swap with cleanup on unmount.
  useEffect(() => {
    const previous = document.title;
    document.title = query.data?.name
      ? `${query.data.name} — TPC Dashboard`
      : 'Session — TPC Dashboard';
    return () => {
      document.title = previous;
    };
  }, [query.data?.name]);

  // D-03 — preserved-params back link. `location.search` already includes
  // the leading '?' when there are params; falsy when there are none.
  const backTo = location.search ? `/activity${location.search}` : '/activity';

  return (
    <main>
      <header className="mb-6">
        <BackLink to={backTo}>Activity</BackLink>
        {query.data && (
          <>
            <nav
              className="text-sm font-semibold text-gray-500 mt-2"
              aria-label="Breadcrumb"
            >
              <span>Activity</span>
              <span aria-hidden="true"> › </span>
              <span className="text-gray-900">{query.data.name}</span>
            </nav>
            <h1 className="text-xl font-semibold text-gray-900 mt-2">
              {query.data.name}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {query.data.mode} · {query.data.status} · created{' '}
              {formatDateTime(new Date(query.data.created_at))}
            </p>
          </>
        )}
      </header>

      {query.isLoading ? (
        <div className="space-y-6 animate-pulse" aria-busy="true">
          <div className="h-72 bg-gray-100 rounded" />
          <div className="h-96 bg-gray-100 rounded" />
        </div>
      ) : query.error ? (
        <ErrorState
          heading="Couldn't load session details"
          body="Retry below."
          onRetry={() => void query.refetch()}
        />
      ) : !query.data ? (
        <EmptyState heading="Session not found">
          <p>That session doesn't exist or you don't have access.</p>
        </EmptyState>
      ) : (
        <>
          {/* Metadata + Photo coverage row (D-04) */}
          <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2">
              <SessionMetadataCard
                session={{
                  ...query.data,
                  created_at: formatDateTime(new Date(query.data.created_at)),
                  updated_at: formatDateTime(new Date(query.data.updated_at)),
                }}
              />
            </div>
            <div className="xl:col-span-1">
              {id && <PhotoCoveragePanel sessionId={id} />}
            </div>
          </section>

          {/* Full-width item list below */}
          {id && <SessionItemList sessionId={id} />}
        </>
      )}
    </main>
  );
}

export default SessionDetailPage;
