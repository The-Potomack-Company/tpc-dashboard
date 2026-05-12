import { useEffect } from 'react';
import { DateRangeFilter } from '../components/kit/DateRangeFilter';
import { SpecialistMultiSelect } from '../components/SpecialistMultiSelect';
import { ModeToggle } from '../components/ModeToggle';
import { TodayKpiStrip } from '../components/activity/TodayKpiStrip';
import { ActiveSessionsTable } from '../components/activity/ActiveSessionsTable';
import { StuckItemsAlertCard } from '../components/activity/StuckItemsAlertCard';
import { ItemsPerSpecialistChart } from '../components/activity/ItemsPerSpecialistChart';
import { AiStatusDonut } from '../components/activity/AiStatusDonut';
import { HouseSaleSplit } from '../components/activity/HouseSaleSplit';
import { ExportPipelineChart } from '../components/activity/ExportPipelineChart';
import { DeveloperPanel } from '../components/activity/DeveloperPanel';
import { useAuthStore } from '../stores/authStore';

// Phase 3 / APP-01..12 — `/activity` page shell.
//
// D-01 locks the section composition order:
//   header → TodayKpiStrip → ActiveSessionsTable → StuckItemsAlertCard →
//   ItemsPerSpecialistChart → (AiStatusDonut + HouseSaleSplit paired) →
//   ExportPipelineChart → DeveloperPanel.
//
// D-37 (divergence from Phase 2 D-19) — NO full-page empty gate. Each
// section owns its per-card empty/loading/error states. The TPC App tables
// (sessions/items) are populated from day one of TPC App use; an empty
// dataset would be a genuine anomaly worth surfacing per-card, not by
// hiding the entire page.
//
// DeveloperPanel is mounted unconditionally; its internal `isDevAccount`
// gate (D-26) decides whether to render anything. The whole subtree is
// absent from the DOM for non-dev users; not display:hidden.
//
// Phase 8: AiStatusDonut is a completion/success-rate widget (slices show
// pending/processing/queued/done/FAILED with a center-label "% AI done")
// and per user directive "admin shouldn't see failures/success or time —
// that's dev only", it renders for `isDev` accounts only. The paired
// xl:grid-cols-2 row collapses to a single column for admin so the
// remaining HouseSaleSplit doesn't end up as a lonely 50%-width tile.

const PAGE_TITLE = 'Activity — TPC Dashboard';

function PageHeader() {
  return (
    <header className="flex items-end justify-between mb-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">Activity</h1>
        <p className="text-sm text-ink-3 mt-1">
          TPC team cataloging activity
        </p>
      </div>
      <div className="flex items-center gap-3">
        <DateRangeFilter />
        <SpecialistMultiSelect />
        <ModeToggle />
      </div>
    </header>
  );
}

export function ActivityPage() {
  // Phase 8 — `isDev` gates the perf/success/failure widgets. Sourced from
  // the authStore (email allowlist via isDevAccount), independent of isAdmin.
  const isDev = useAuthStore((s) => s.isDev);

  useEffect(() => {
    const previous = document.title;
    document.title = PAGE_TITLE;
    return () => {
      document.title = previous;
    };
  }, []);

  return (
    <main>
      <PageHeader />

      {/* APP-01 — Today KPI strip (self-trims the "% AI done today" card for non-dev) */}
      <TodayKpiStrip />

      {/* APP-02 — Active sessions table */}
      <ActiveSessionsTable />

      {/* APP-11 — Stuck items alert card */}
      <StuckItemsAlertCard />

      {/* APP-03 — 14-day items-per-specialist stacked bar */}
      <ItemsPerSpecialistChart />

      {/*
        APP-04 + APP-12 — paired row.
        Dev: side-by-side at xl (AiStatusDonut + HouseSaleSplit).
        Admin: single-column with just HouseSaleSplit — AiStatusDonut shows
        success/failure rates and is dev-only per Phase 8 directive.
      */}
      <section
        className={`grid grid-cols-1 gap-6 mt-8 ${isDev ? 'xl:grid-cols-2' : ''}`}
      >
        {isDev && <AiStatusDonut />}
        <HouseSaleSplit />
      </section>

      {/* APP-05 — Export pipeline horizontal stacked bar */}
      <ExportPipelineChart />

      {/* DeveloperPanel — self-gates by isDevAccount; null for non-devs (D-26) */}
      <DeveloperPanel />
    </main>
  );
}

export default ActivityPage;
