import { useEffect } from 'react';
import { BackLink } from '../components/BackLink';
import { StuckItemsTable } from '../components/activity/StuckItemsTable';

// Phase 3 / APP-11 / D-07 / D-23 — `/activity/stuck` triage page shell.
//
// D-07: dedicated nested route — bookmarkable, distinct context, room for
//   focused triage work beyond the alert card on /activity.
// D-23: filters from /activity are NOT inherited. The BackLink targets
//   plain `/activity` (no preserved params), and the page does NOT mount
//   the filter row. The StuckItemsTable reads its own URL state, which is
//   empty when the user lands here directly from the alert card CTA — so
//   the table shows ALL stuck items regardless of /activity's filter
//   selection.

const PAGE_TITLE = 'Stuck items — TPC Dashboard';

export function StuckItemsPage() {
  useEffect(() => {
    const previous = document.title;
    document.title = PAGE_TITLE;
    return () => {
      document.title = previous;
    };
  }, []);

  return (
    <main>
      <header className="mb-6">
        <BackLink to="/activity">Activity</BackLink>
        <nav
          className="text-sm font-semibold text-gray-500 mt-2"
          aria-label="Breadcrumb"
        >
          <span>Activity</span>
          <span aria-hidden="true"> › </span>
          <span className="text-gray-900">Stuck items</span>
        </nav>
        <h1 className="text-xl font-semibold text-gray-900 mt-2">
          Stuck items
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Items in 'processing' or 'queued' for more than 2 hours
        </p>
      </header>
      <StuckItemsTable />
    </main>
  );
}

export default StuckItemsPage;
