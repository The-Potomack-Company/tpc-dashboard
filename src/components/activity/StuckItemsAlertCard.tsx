// Phase 3 / APP-11 / D-22 / D-23 — severity-toned alert card.
// Filter scope: right-now (ignores ?range=, applies ?specialists= and ?mode=
// via the hook). 2-hour stuck threshold is hard-coded server-side per D-24.
//
// Three render states from classifyStuckSeverity():
//   'none'   — N=0, quiet success (clipboard icon, no left border, no CTA)
//   'yellow' — N>=1 with oldest <= 6h (amber tone + triangle icon + CTA)
//   'red'    — oldest > 6h regardless of N (red tone + triangle + 'needs attention' body)
//
// Plus loading + error states. ALL states maintain min-h-[6rem] (D-22 quiet
// success: prevent layout reflow on each refetch).
//
// CTA navigates to /activity/stuck with NO preserved query params (D-23 — that
// page has its own filter context, not inherited from /activity).
//
// LOCKED ErrorState contract (D-35): heading + body + onRetry; no children;
// no sibling Retry buttons.
//
// No animation on the alert body when not loading per D-22 (severity tone is
// enough; the right-now pip lives on the OTHER right-now widgets, not here).

import { Link } from 'react-router';
import { useStuckItems } from '../../hooks/activity/useStuckItems';
import {
  classifyStuckSeverity,
  STUCK_ITEMS_TONE,
  type StuckSeverity,
} from '../../lib/severity';
import { ErrorState } from '../ErrorState';
import { formatAge } from '../../lib/format';

// Heroicons outline SVGs inlined to avoid a package dependency
// (matches the convention in src/components/SortIndicator.tsx).
function ClipboardIcon(props: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={props.className}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z"
      />
    </svg>
  );
}

function ExclamationTriangleIcon(props: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={props.className}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
      />
    </svg>
  );
}

export function StuckItemsAlertCard() {
  const query = useStuckItems();

  // Loading — maintain min-h-[6rem] with 4-line shimmer (D-22 no-reflow rule)
  if (query.isLoading) {
    return (
      <section
        data-testid="app-11-card"
        className="rounded-lg bg-bg border border-rule p-6 min-h-[6rem] mt-8 motion-safe:animate-pulse"
        aria-busy="true"
      >
        <div className="space-y-2">
          <div className="h-6 w-6 rounded bg-bg-3" />
          <div className="h-7 w-1/3 rounded bg-bg-3" />
          <div className="h-4 w-1/2 rounded bg-bg-3" />
          <div className="h-4 w-24 rounded bg-bg-3" />
        </div>
      </section>
    );
  }

  // Error — locked ErrorState contract; container preserves min-h-[6rem]
  if (query.error) {
    return (
      <section
        data-testid="app-11-card"
        className="rounded-lg bg-bg border border-rule p-6 min-h-[6rem] mt-8"
      >
        <ErrorState
          heading="Couldn't check for stuck items"
          body="The query failed. Retry below."
          onRetry={() => void query.refetch()}
        />
      </section>
    );
  }

  // Derive count + oldestAgeHours client-side from query rows.
  // Empty array → count=0, oldestAgeHours=0; classifier returns 'none'.
  const rows = query.data ?? [];
  const count = rows.length;
  const oldestAgeHours =
    count > 0
      ? Math.max(...rows.map((r) => Number(r.age_seconds) / 3600))
      : 0;

  const severity: StuckSeverity = classifyStuckSeverity({
    count,
    oldestAgeHours,
  });
  const tone = STUCK_ITEMS_TONE[severity];

  // 'none' quiet-success state — clipboard icon, no CTA, no left border.
  if (severity === 'none') {
    return (
      <section
        data-testid="app-11-card"
        className={`rounded-lg ${tone.container} p-6 min-h-[6rem] mt-8 flex items-start gap-4`}
      >
        <ClipboardIcon className={`w-6 h-6 ${tone.icon} flex-shrink-0`} />
        <div className="flex-1">
          <h2 className={`text-2xl font-semibold ${tone.headline}`}>
            No stuck items
          </h2>
          <p className={`text-sm mt-1 ${tone.body}`}>Last checked just now.</p>
        </div>
      </section>
    );
  }

  // Active alert states (yellow / red) — find the oldest row to surface its age.
  const oldestRow = rows.reduce((max, r) =>
    Number(r.age_seconds) > Number(max.age_seconds) ? r : max,
  );
  const oldestAgeStr = formatAge(oldestRow.created_at);
  const bodyCopy =
    severity === 'red'
      ? `Oldest is ${oldestAgeStr} — needs attention.`
      : `Oldest is ${oldestAgeStr}.`;

  return (
    <section
      data-testid="app-11-card"
      className={`rounded-lg ${tone.container} ${tone.leftBorder} p-6 min-h-[6rem] mt-8 flex items-start gap-4`}
    >
      <ExclamationTriangleIcon
        className={`w-6 h-6 ${tone.icon} flex-shrink-0`}
      />
      <div className="flex-1">
        <h2 className={`text-2xl font-semibold ${tone.headline}`}>
          {count} stuck items
        </h2>
        <p className={`text-sm mt-1 ${tone.body}`}>{bodyCopy}</p>
        <Link
          to="/activity/stuck"
          className="text-sm font-semibold text-accent hover:text-accent-hover focus:ring-2 focus:ring-accent rounded outline-none mt-3 inline-block"
        >
          View {count} stuck items →
        </Link>
      </div>
    </section>
  );
}
