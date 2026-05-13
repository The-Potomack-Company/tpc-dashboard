// src/components/activity/UiInteractionsPanel.tsx
// Phase 3 / D-31 / D-32 — composition wrapper for the 4 ui_interactions sub-panels.
//
// Order (UI-SPEC § ui_interactions panel):
//   1. UiTopPagesTable          (range-driven; D-34 — no specialist/mode)
//   2. UiTopElementsTable       (range-driven; D-34)
//   3. WalkthroughFunnel        (right-now; D-34 ignores ALL filters)
//   4. UiRecentEventsFeed       (live tail; 10s polling, pause/resume)
//
// All four components depend on hooks that already filter
// `app_source = 'tpc-app'` (D-33 invariant — enforced server-side via the SQL
// in Plan 03-01 and on the client via the services layer in Plan 03-03). The
// scope filter is NEVER applied at this layer.
//
// Vertical rhythm: `space-y-6` between sub-panels (mirrors Phase 2 EXT panel).

import { UiTopPagesTable } from './UiTopPagesTable';
import { UiTopElementsTable } from './UiTopElementsTable';
import { WalkthroughFunnel } from './WalkthroughFunnel';
import { UiRecentEventsFeed } from './UiRecentEventsFeed';

export function UiInteractionsPanel() {
  return (
    <section className="space-y-6" data-testid="ui-interactions-panel">
      <header>
        <h3 className="text-sm font-semibold text-ink-2">
          UI interactions (TPC App)
        </h3>
        <p className="text-xs text-ink-3 mt-1">
          app_source = 'tpc-app' · admin-side observation
        </p>
      </header>
      <UiTopPagesTable />
      <UiTopElementsTable />
      <WalkthroughFunnel />
      <UiRecentEventsFeed />
    </section>
  );
}
