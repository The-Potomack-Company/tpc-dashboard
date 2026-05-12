import { useState } from 'react';
import { useLiveFeed } from '../../hooks/extension/useLiveFeed';
import { useAuthStore } from '../../stores/authStore';
import { isDevAccount } from '../../lib/devAccess';
import { PayloadViewerModal } from '../kit/PayloadViewerModal';
import { TableSkeleton } from '../TableSkeleton';
import { ErrorState } from '../ErrorState';
import { formatTimestampShort, EMPTY } from '../../lib/format';
import type { EventRow } from '../../services/extension/queries';

// Phase 2 / EXT-08 — Live event feed (D-09 / D-10 / D-11).
//
// All polling mechanics live in useLiveFeed (Plan 02-03). This component is
// purely presentational: paint the chrome, render rows, render the
// Pause/Resume button, gate row clicks by isDevAccount.
//
//   - D-09: feed is unfiltered "newest 50" — page filters do not apply here.
//   - D-10: 10s refetch interval, owned by useLiveFeed.
//   - D-11: Pause sets refetchInterval=false, Resume invalidates the query
//           for an immediate refetch — also owned by useLiveFeed.
//   - D-18: admin row click is a no-op; dev row click opens
//           PayloadViewerModal (same gate as RecentErrorsTable).
//
// This file MUST NOT call setInterval, setTimeout, or invalidateQueries —
// the hook is the single source of polling state.

// UI-SPEC § Color "Live-feed event-type badge palette" — verbatim. Note
// `text-amber-800` (NOT -700) on spreadsheet_transform per UI-SPEC §
// Accessibility contrast.
const EVENT_BADGE_CLASSES: Record<string, string> = {
  catalog_single: 'bg-slate-100 text-slate-700',
  catalog_batch: 'bg-sky-100 text-sky-700',
  portal_upload: 'bg-teal-100 text-teal-700',
  spreadsheet_transform: 'bg-amber-100 text-amber-800',
  data_import: 'bg-violet-100 text-violet-700',
  // Fallback for any unexpected event_type (e.g. catalog_item, were it to
  // sneak in). Keeps the row visible without exploding on missing palette.
  unknown: 'bg-bg-3 text-ink-2',
};

interface ModalState {
  open: boolean;
  title: string;
  payload: unknown;
}

interface PauseButtonProps {
  paused: boolean;
  onPause: () => void;
  onResume: () => void;
}

function PauseButton({ paused, onPause, onResume }: PauseButtonProps) {
  return (
    <button
      type="button"
      onClick={paused ? onResume : onPause}
      aria-label={paused ? 'Resume live feed' : 'Pause live feed'}
      className="h-8 px-3 inline-flex items-center gap-1 rounded-md border border-rule text-sm text-ink-2 hover:bg-bg-2 focus:ring-2 focus:ring-accent outline-none"
    >
      {paused ? (
        <>
          <PlayIcon />
          <span>Resume</span>
        </>
      ) : (
        <>
          <PauseIcon />
          <span>Pause</span>
        </>
      )}
    </button>
  );
}

function PauseIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="w-4 h-4"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 5.25v13.5m-7.5-13.5v13.5"
      />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="w-4 h-4"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z"
      />
    </svg>
  );
}

export function LiveEventFeed() {
  const { data, isLoading, error, refetch, paused, pause, resume } = useLiveFeed();
  const email = useAuthStore((s) => (s as { profile: { email?: string } | null }).profile?.email);
  const isDev = isDevAccount(email);
  const [modal, setModal] = useState<ModalState>({
    open: false,
    title: 'Payload',
    payload: null,
  });

  const rows = data ?? [];
  // UI-SPEC § Copywriting "EXT-08 Live Event Feed" — verbatim subtitles.
  const subtitle = paused
    ? `Paused · ${rows.length} events shown at pause time`
    : 'Tailing latest 50 events · refreshes every 10s';

  function handleRowClick(row: EventRow) {
    // D-18 admin no-op — admin path doesn't even render a button, so this
    // guard is a defense-in-depth for any future code path that wires
    // handleRowClick to a non-button element.
    if (!isDev) return;
    setModal({
      open: true,
      title: `${row.event_type} payload — ${row.user_email ?? 'unknown'}`,
      payload: row.items_content,
    });
  }

  return (
    <section
      className="rounded-lg border border-rule bg-bg"
      data-testid="live-event-feed"
    >
      <header className="flex items-center justify-between border-b border-rule px-4 h-12">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className={
              paused
                ? 'h-2 w-2 rounded-full bg-ink-4'
                : 'h-2 w-2 rounded-full bg-ok motion-safe:animate-pulse'
            }
          />
          <span className="sr-only">{paused ? 'Paused' : 'Live'}</span>
          <h2 className="text-sm font-semibold text-ink-2">Live feed</h2>
          <p
            className="text-xs text-ink-3"
            aria-live="polite"
            aria-atomic="true"
          >
            {subtitle}
          </p>
        </div>
        <PauseButton paused={paused} onPause={pause} onResume={resume} />
      </header>
      <div className="max-h-[28rem] overflow-y-auto">
        {isLoading && rows.length === 0 && !error && (
          // TableSkeleton renders <tbody> — wrap in <table> to keep the DOM
          // valid while we wait for the first page of rows.
          <table className="w-full text-sm">
            <TableSkeleton
              rows={6}
              columnWidths={['w-24', 'w-32', 'w-48', 'w-full']}
            />
          </table>
        )}
        {error && (
          <div className="p-4">
            {/* LOCKED Phase 1 ErrorState contract — heading + body string +
                onRetry. NO children syntax, NO sibling Retry button. */}
            <ErrorState
              heading="Couldn't load live feed"
              body="Polling failed. Retry below to start tailing again."
              onRetry={() => void refetch()}
            />
          </div>
        )}
        {!isLoading && !error && rows.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <p className="italic text-ink-3">Waiting for events…</p>
          </div>
        )}
        {!error && rows.length > 0 && (
          <ul role="list">
            {rows.map((row) => {
              const hasError = row.error_message != null;
              // Phase 8: the red error-border + timestamp-in-red row treatment
              // is a failure indicator. Per the user directive "admin shouldn't
              // see failures", admin sees the row as a regular activity row
              // (operational stream stays visible — only the failure styling
              // is suppressed). Dev still sees the error highlight.
              const showErrorIndicator = hasError && isDev;
              const badgeClass =
                EVENT_BADGE_CLASSES[row.event_type] ?? EVENT_BADGE_CLASSES.unknown;
              const baseRowClass = `w-full flex items-center gap-3 h-10 px-4 border-b border-rule ${
                showErrorIndicator ? 'border-l-2 border-l-red-500' : ''
              }`;
              const interactiveClass = isDev
                ? 'hover:bg-bg-2 cursor-pointer focus:ring-2 focus:ring-accent outline-none text-left'
                : '';
              const rowClass = `${baseRowClass} ${interactiveClass}`.trim();
              return (
                <li key={row.id}>
                  {isDev ? (
                    <button
                      type="button"
                      onClick={() => handleRowClick(row as EventRow)}
                      aria-haspopup="dialog"
                      className={rowClass}
                    >
                      <RowContent row={row as EventRow} hasError={showErrorIndicator} badgeClass={badgeClass} />
                    </button>
                  ) : (
                    <div className={rowClass}>
                      <RowContent row={row as EventRow} hasError={showErrorIndicator} badgeClass={badgeClass} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <PayloadViewerModal
        open={modal.open}
        onClose={() => setModal((m) => ({ ...m, open: false }))}
        title={modal.title}
        payload={modal.payload}
      />
    </section>
  );
}

interface RowContentProps {
  row: EventRow;
  hasError: boolean;
  badgeClass: string;
}

// Inner content factored out so the admin (<div>) and dev (<button>) row
// shells can render the same children without duplication.
function RowContent({ row, hasError, badgeClass }: RowContentProps) {
  return (
    <>
      <span
        className={`text-sm tabular-nums ${
          hasError ? 'text-err' : 'text-ink-3'
        }`}
      >
        {formatTimestampShort(row.created_at)}
      </span>
      <span
        className={`text-sm font-semibold rounded px-2 py-0.5 ${badgeClass}`}
      >
        {row.event_type}
      </span>
      <span className="text-sm text-ink-2 truncate">
        {row.user_email ?? EMPTY}
      </span>
    </>
  );
}
