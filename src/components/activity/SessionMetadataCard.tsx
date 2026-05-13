import type { SessionDetailRow } from '../../services/activity/queries';
import { EMPTY } from '../../lib/format';

// Phase 3 / APP-06 / D-04 — session metadata field grid.
//
// Pure presentation component. The page (Plan 03-08) is responsible for
// ET-formatting `created_at` / `updated_at` before passing them in (keeps
// this component free of timezone concerns and testable without a date
// library).
//
// Null/empty values render as EMPTY (U+2014 em dash) per UI-SPEC §
// Typography "Null / missing".

interface Props {
  session: SessionDetailRow;
}

export function SessionMetadataCard({ session }: Props) {
  const fields: ReadonlyArray<readonly [string, string | null | undefined]> = [
    ['Name', session.name],
    ['Mode', session.mode],
    ['Status', session.status],
    ['Specialist', session.assigned_to_display_name],
    ['Created by', session.created_by_display_name],
    ['Created', session.created_at],
    ['Last updated', session.updated_at],
    ['Notes', session.notes],
    ['Review notes', session.review_notes],
  ];

  return (
    <section
      className="rounded-lg border border-rule bg-bg p-6"
      data-testid="session-metadata-card"
    >
      <h2 className="text-sm font-semibold text-ink-2 mb-4">Session details</h2>
      <dl className="grid grid-cols-1 gap-y-3">
        {fields.map(([label, value]) => (
          <div key={label} className="flex flex-col">
            <dt className="text-sm font-semibold text-ink-2">{label}</dt>
            <dd className="text-sm text-ink">
              {value == null || value === '' ? EMPTY : value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
