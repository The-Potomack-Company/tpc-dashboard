// src/components/activity/UiRecentEventsFeed.tsx
// Phase 3 / D-32 dev — live tail of ui_interactions.
//
// Mirrors src/components/extension/LiveEventFeed.tsx (Phase 2 EXT-08) verbatim
// in visual idiom: live indicator dot, Pause/Resume button, max-h-[28rem]
// scroll body, row click → PayloadViewerModal. Differences:
//   - Data shape is `ui_interactions` rows (not extension events).
//   - Subtitle copy reflects ui_interactions wording.
//   - Interaction-type chip palette per UI-SPEC § Recent Events Feed
//     (walkthrough_step uses amber-800 for AA contrast on amber-100).
//   - Row click ALWAYS opens PayloadViewerModal — no admin/dev split here:
//     the parent <DeveloperPanel> render-conditional gate ensures this
//     component only renders for dev accounts (D-26).
//
// Polling mechanics live in useUiRecentEventsFeed (Plan 03-03 hook). This
// component is purely presentational — no setInterval, no setTimeout, no
// invalidateQueries. The hook is the single source of polling state.
//
// D-33 invariant (`app_source = 'tpc-app'` filter on ui_interactions): enforced
// in the services-layer fetch (Plan 03-03 / queries.ts line 419) and the
// queries.test.ts D-33 invariant test. This component is unaware of the filter.

import { useState } from 'react';
import { useUiRecentEventsFeed } from '../../hooks/activity/useUiRecentEventsFeed';
import { PayloadViewerModal } from '../kit/PayloadViewerModal';
import { TableSkeleton } from '../TableSkeleton';
import { ErrorState } from '../ErrorState';
import { formatTimestampShort, EMPTY } from '../../lib/format';
import type { UiInteractionFeedRow } from '../../services/activity/queries';

// UI-SPEC § Color "Recent Events Feed interaction-type chip palette" — verbatim.
// walkthrough_step uses amber-800 (NOT -700) per UI-SPEC § Accessibility AA
// contrast, mirroring Phase 2 spreadsheet_transform exception.
const TYPE_TONE: Record<string, string> = {
  view:             'bg-slate-100 text-slate-700',
  click:            'bg-sky-100 text-sky-700',
  focus:            'bg-teal-100 text-teal-700',
  blur:             'bg-gray-100 text-gray-500',
  submit:           'bg-violet-100 text-violet-700',
  walkthrough_step: 'bg-amber-100 text-amber-800',
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
      aria-label={paused ? 'Resume' : 'Pause'}
      className="h-8 px-3 inline-flex items-center gap-1 rounded-md border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-accent outline-none"
    >
      {paused ? 'Resume' : 'Pause'}
    </button>
  );
}

export function UiRecentEventsFeed() {
  const { data, isLoading, error, refetch, paused, pause, resume } =
    useUiRecentEventsFeed();
  const [modal, setModal] = useState<ModalState>({
    open: false,
    title: '',
    payload: null,
  });

  const rows = data ?? [];
  // UI-SPEC § Copywriting Recent Events Feed — verbatim subtitles.
  const subtitle = paused
    ? `Paused · ${rows.length} events shown at pause time`
    : 'Tailing latest 50 ui_interactions · refreshes every 10s';

  function handleRowClick(row: UiInteractionFeedRow) {
    setModal({
      open: true,
      title: `UI interaction — ${row.interaction_type}`,
      payload: row,
    });
  }

  return (
    <section
      className="rounded border border-gray-200 bg-white"
      data-testid="ui-recent-events-feed"
    >
      <header className="flex items-center justify-between border-b border-gray-200 px-4 h-12">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className={
              paused
                ? 'h-2 w-2 rounded-full bg-gray-400'
                : 'h-2 w-2 rounded-full bg-green-500 motion-safe:animate-pulse'
            }
          />
          <span className="sr-only">{paused ? 'Paused' : 'Live'}</span>
          <h4 className="text-sm font-semibold text-gray-700">Recent UI events</h4>
          <p
            className="text-xs text-gray-500 ml-2"
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
          // TableSkeleton renders <tbody>; wrap in <table> to keep DOM valid.
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
                onRetry. NO children syntax, NO sibling Retry button (D-35). */}
            <ErrorState
              heading="Couldn't load UI events"
              body="Polling failed. Retry below to start tailing again."
              onRetry={() => void refetch()}
            />
          </div>
        )}
        {!isLoading && !error && rows.length === 0 && (
          <div className="flex items-center justify-center py-6">
            <p className="italic text-gray-500">Waiting for events…</p>
          </div>
        )}
        {!error && rows.length > 0 && (
          <ul role="list">
            {rows.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => handleRowClick(row)}
                  aria-haspopup="dialog"
                  className="w-full flex items-center gap-3 h-10 px-4 hover:bg-gray-50 focus:bg-gray-50 focus:ring-2 focus:ring-accent outline-none border-b border-gray-100 text-left"
                >
                  <span className="text-xs text-gray-500 tabular-nums w-24 flex-shrink-0">
                    {formatTimestampShort(row.created_at)}
                  </span>
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded ${
                      TYPE_TONE[row.interaction_type] ?? 'bg-gray-100 text-gray-700'
                    } w-32 flex-shrink-0 text-center`}
                  >
                    {row.interaction_type}
                  </span>
                  <span className="text-sm text-gray-700 w-48 flex-shrink-0 truncate">
                    {row.user_email ?? 'unknown'}
                  </span>
                  <span className="text-sm text-gray-500 font-mono truncate">
                    {row.page_path ?? EMPTY}
                  </span>
                </button>
              </li>
            ))}
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
