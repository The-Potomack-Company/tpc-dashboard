import { useEffect } from 'react';
import { useExtensionGate } from '../hooks/extension/useExtensionGate';
import { DateRangeFilter } from '../components/kit/DateRangeFilter';
import { UserMultiSelect } from '../components/UserMultiSelect';
import { EmptyState } from '../components/EmptyState';
import { EventVolumeChart } from '../components/extension/EventVolumeChart';
import { KpiStrip } from '../components/extension/KpiStrip';
import { ErrorRateChart } from '../components/extension/ErrorRateChart';
import { PerUserTable } from '../components/extension/PerUserTable';
import { RecentErrorsTable } from '../components/extension/RecentErrorsTable';
import { LiveEventFeed } from '../components/extension/LiveEventFeed';
import { DeveloperPanel } from '../components/extension/DeveloperPanel';
import { useAuthStore } from '../stores/authStore';

// Phase 2 / EXT-01..10 — Page shell.
//
// Empty-gate branch is at THE PAGE LEVEL only (D-19 + Pattern 5). Per-chart
// gating is forbidden — N+1 emptiness probes would slow first paint.
//
// Filter row renders even in the empty-gate state (UI-SPEC § Empty gate
// layout) — informational, doesn't error.
//
// Composition order is locked by UI-SPEC § Layout Specifications:
//   header → EXT-01 stacked bar → EXT-02 KPI strip → EXT-03 error rate →
//   EXT-04 per-user (full width) → EXT-05 recent errors (full width, dev-only) →
//   EXT-08 live feed → DeveloperPanel.
//
// DeveloperPanel mounts unconditionally — its internal `isDevAccount(email)`
// gate (D-15, Plan 02-07) decides whether to render anything. The whole
// subtree is absent from the DOM for non-dev users; not display:hidden.
//
// Phase 8 admin-trim — per user directive "admin shouldn't see
// failures/success or time — that's dev only":
//   EXT-03 ErrorRateChart       (rate metric — dev only)
//   EXT-05 RecentErrorsTable    (per-row failure breakdown — dev only)
// Both are rendered for `isDev` accounts only. EXT-04 PerUserTable keeps
// its event-count columns for admin; its trailing "Errors" column self-
// trims to dev-only inside the component.

const PAGE_TITLE = 'Extension — TPC Dashboard';

function PageHeader() {
  return (
    <header className="flex items-end justify-between mb-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">
          Extension Analytics
        </h1>
        <p className="text-sm text-ink-3 mt-1">
          Cataloger Chrome extension activity
        </p>
      </div>
      <div className="flex items-center gap-3">
        <DateRangeFilter />
        <UserMultiSelect />
      </div>
    </header>
  );
}

export function ExtensionPage() {
  const gate = useExtensionGate();
  const isDev = useAuthStore((s) => s.isDev);

  useEffect(() => {
    const previous = document.title;
    document.title = PAGE_TITLE;
    return () => {
      document.title = previous;
    };
  }, []);

  if (gate.isLoading) {
    return (
      <>
        <PageHeader />
        <div
          className="flex items-center justify-center py-24"
          aria-busy="true"
          data-testid="extension-page-loading"
        >
          <span className="sr-only">Loading…</span>
        </div>
      </>
    );
  }

  if (gate.isEmpty) {
    return (
      <>
        <PageHeader />
        <div
          className="flex items-center justify-center py-24"
          data-testid="extension-page-empty"
        >
          <EmptyState heading="No extension events yet">
            <p>
              The TPC AI Cataloger extension hasn't started reporting to this
              dashboard yet. This page will populate automatically once the
              extension v2.0 ships and the team starts cataloging.
            </p>
            <p className="mt-3 text-sm">
              If you expected to see data, contact the engineer running the
              extension repo.
            </p>
          </EmptyState>
        </div>
      </>
    );
  }

  // Gate cleared — full page composition (UI-SPEC § Layout Specifications).
  return (
    <>
      <PageHeader />

      {/* EXT-01 — stacked bar: events by type/day */}
      <section
        className="tpc-card p-4"
        data-testid="ext-01-card"
      >
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="text-sm font-semibold text-ink-2">Event volume</h2>
          <span className="text-sm text-ink-3">Last 14 days</span>
        </div>
        <div className="h-72">
          <EventVolumeChart />
        </div>
      </section>

      {/* EXT-02 — KPI strip */}
      <section
        className="grid grid-cols-2 lg:grid-cols-5 gap-4 mt-6"
        data-testid="ext-02-strip"
      >
        <KpiStrip />
      </section>

      {/* EXT-03 — error rate by event type (Phase 8: dev-only — failure rate) */}
      {isDev && (
        <section
          className="tpc-card p-4 mt-6"
          data-testid="ext-03-card"
        >
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="text-sm font-semibold text-ink-2">
              Error rate by event type
            </h2>
            <span className="text-sm text-ink-3">
              <code>count(error_message IS NOT NULL) / count(*)</code>
            </span>
          </div>
          <div className="h-48">
            <ErrorRateChart />
          </div>
        </section>
      )}

      {/*
        EXT-04 — Per user (own row, full width).
        Wide table; sharing the row with EXT-05 squeezed it. Stacked layout
        gives each table its own horizontal real estate.
      */}
      <section className="tpc-card p-4 mt-8" data-testid="ext-04-card">
        <header className="mb-3">
          <h2 className="text-sm font-semibold text-ink-2">Per user</h2>
        </header>
        <PerUserTable />
      </section>

      {/*
        EXT-05 — Recent errors (own row, full width). Failure breakdown,
        dev-only per Phase 8.
      */}
      {isDev && (
        <section className="tpc-card p-4 mt-6" data-testid="ext-05-card">
          <header className="mb-3">
            <h2 className="text-sm font-semibold text-ink-2">
              Recent errors
            </h2>
            <p className="text-sm text-ink-3">Last 100 errors, newest first</p>
          </header>
          <RecentErrorsTable />
        </section>
      )}

      {/* EXT-08 — live event feed */}
      <div className="mt-8" data-testid="ext-08-feed">
        <LiveEventFeed />
      </div>

      {/* DeveloperPanel — self-gates by isDevAccount; null for non-devs (D-15) */}
      <DeveloperPanel />
    </>
  );
}

export default ExtensionPage;
