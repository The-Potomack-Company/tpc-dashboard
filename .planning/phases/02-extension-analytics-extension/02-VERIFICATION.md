---
phase: 02-extension-analytics-extension
status: pending-checker-review
verified: 2026-04-30
plans: 9
test_count: 173
project_test_count_total: 254
---

# Phase 2 — Verification

Phase goal (ROADMAP § Phase 2): admin opens `/extension` and understands at a glance how the TPC AI Cataloger Chrome extension is being used — volume by event type, error rates, per-user usage, recent errors with payloads, and a live event feed — filtered by date range, user, and extension version. A render-gated developer panel surfaces extension-version filtering, dominant-version badge, and cancellation-rate KPIs (EXT-09 + EXT-10).

This document cross-references the 6 ROADMAP success criteria with the implemented surfaces, the per-decision invariants (D-01 through D-21), and the test/colocated coverage that proves each.

## ROADMAP Success Criteria (6 / 6)

1. **EXT-01 + EXT-02 — admin lands on `/extension` and sees a 14-day stacked bar chart of event volume by event_type plus five event-type KPI cards (one per event type) with counts, previous-period deltas, and sparklines.**
   - Status: ✅ green
   - Implementation: Plan 02-04 (`EventVolumeChart`, `KpiStrip`)
   - Hooks: Plan 02-03 (`useEventVolume`, `useKpiTotals`)
   - SQL: Plan 02-01 (`get_event_volume_daily`, `get_kpi_totals` — D-05 previous-period inside the RPC)
   - Tests: `src/components/extension/EventVolumeChart.test.tsx` (6), `src/components/extension/KpiStrip.test.tsx` (8), `src/hooks/extension/useEventVolume.test.tsx` (4)
   - Smoke: `src/pages/Extension.smoke.test.tsx` Test 1 (`mounts all sections without errors when gate has rows`) confirms `ext-01-card` and `ext-02-strip` testids present after gate clears
   - Page composition: Plan 02-08 (`src/pages/Extension.tsx`) section composition order locked by `Extension.test.tsx` `compareDocumentPosition` assertion

2. **EXT-07 filter responsiveness — admin can change the date range and user filter and every chart/table on the page updates to reflect the new selection, with the filter state reflected in the URL.**
   - Status: ✅ green
   - Implementation: Plan 02-02 (`useUserFilter`, `useVersionFilter` URL-state hooks following `useDateRange` precedent), Plan 02-05 (`UserMultiSelect` popover), Plan 02-07 (`ExtensionVersionFilter` popover, dev-only)
   - QueryKey folding: Plan 02-03 — every chart hook places sorted users/versions arrays into its `queryKey` so a filter change naturally invalidates dependent charts (RESEARCH Pitfall 3)
   - Tests: `src/hooks/extension/useUserFilter.test.tsx` (7), `src/hooks/extension/useVersionFilter.test.tsx` (6), `src/components/UserMultiSelect.test.tsx` (12), `src/components/extension/ExtensionVersionFilter.test.tsx` (11), `src/hooks/extension/useEventVolume.test.tsx` (4 — Pitfall 3 sorted-array invariant), `src/hooks/extension/__tests__/all-hooks-smoke.test.tsx` (7 — parameterized over all 7 chart hooks proving each receives URL-order arrays at the fetch boundary)
   - Smoke: `src/pages/Extension.smoke.test.tsx` Test 4 (`filter change re-fetches all charts (EXT-07 integration)`) mounts the REAL `<UserMultiSelect>` against the composed page, toggles a user, awaits the next fetch tick, and asserts at least one new call carries the user filter via `.in('user_email', [...])` or RPC `p_users` arg

3. **EXT-03 + EXT-04 + EXT-05 + EXT-06 — admin sees error rate per event type, a per-user table (count per event type, total errors, last-seen-at), a Recent Errors table with view-payload action, and a payload-viewer modal with pretty-printed JSON + copy-to-clipboard.**
   - Status: ✅ green
   - Implementation: Plan 02-04 (`ErrorRateChart`), Plan 02-05 (`PerUserTable`, `RecentErrorsTable` with cell-level dev-gated payload viewer)
   - Modal lift: Plan 02-05 lifts the Phase 1 `<PayloadViewerModal>` into `RecentErrorsTable` as a single instance opened by per-row `View →` buttons (D-18 invariant — admin sees the row but no affordance, dev sees the affordance)
   - SQL: Plan 02-01 (`get_error_rate_by_type`, `get_per_user_summary`)
   - Tests: `src/components/extension/ErrorRateChart.test.tsx` (7), `src/components/extension/PerUserTable.test.tsx` (9), `src/components/extension/RecentErrorsTable.test.tsx` (14 — both admin and dev cell-level branches exercised)
   - D-18 admin/dev split tested directly: 5 RecentErrorsTable cases cover Payload header without affordance (admin), View → button presence (dev), modal open + title + payload + null-email title (dev), single `useReactTable` instance regardless of branch

4. **EXT-08 live feed — admin watches a live event feed that tails analytics_events near-real-time (5–10 s), shows latest 50 newest-first, has a working Pause button, and opens the payload viewer on row click (dev only per D-18).**
   - Status: ✅ green
   - Implementation: Plan 02-03 (`useLiveFeed` mechanics — function-form `refetchInterval`, Resume `invalidateQueries` for immediate refetch), Plan 02-06 (`LiveEventFeed` chrome + dev-row gate)
   - D-09 / D-10 / D-11 invariants: TanStack `refetchInterval` (NOT Realtime); 10s cadence; Pause sets `refetchInterval: false`, Resume re-enables AND immediately refetches
   - Tests: `src/hooks/extension/useLiveFeed.test.tsx` (2 fake-timer cases — 10s interval refetch, Pause halts polling and Resume immediate refetch), `src/components/extension/LiveEventFeed.test.tsx` (10 — running/paused dot palette, sr-only labels, aria-live subtitle, admin no-op vs dev modal-open, error state with locked Phase 1 ErrorState contract)
   - Manual smoke (Plan 02-09 Task 2 — OPEN): operator must confirm Pause/Resume timing feels natural at 10s against the live shared Supabase project

5. **EXT-09 + EXT-10 dev-panel surfaces — admin filters by extension_version and sees a dominant-version badge; admin sees cancellation-rate KPIs for `catalog_batch` (W2) and `portal_upload` (W3).**
   - Status: ✅ green
   - Implementation: Plan 02-07 (`DeveloperPanel` collapsible section + `ExtensionVersionFilter` popover + `DominantVersionBadge` chip + `CancellationRateKpis` two-card grid with FLIPPED delta direction)
   - Dev gate: Plan 02-02 `isDevAccount(email)` + DEV_EMAILS allowlist (D-15 + D-16) — `DeveloperPanel` returns `null` for non-devs (NOT `display:hidden`); the whole subtree is absent from the DOM
   - SQL: Plan 02-01 (`get_dominant_version`, `get_cancellation_rates` extended with `previous_rate` column for D-05 prev-period mirroring)
   - Tests: `src/components/extension/DeveloperPanel.test.tsx` (11 — covering null, admin email, dev email, mid-session profile transition, expand/collapse, accessibility), `src/components/extension/ExtensionVersionFilter.test.tsx` (11 — sourcing options from `useDistinctVersions` only, no inline supabase), `src/components/extension/DominantVersionBadge.test.tsx` (4), `src/components/extension/CancellationRateKpis.test.tsx` (9 — FLIPPED delta direction with three direction cases plus null prior period)
   - Note: `useDistinctVersions` is the SOLE source of the EXT-09 option list (Plan 02-03 Checker WARNING #4 fix — no inline `supabase.from()` calls in `ExtensionVersionFilter`)

6. **D-19 empty state — when lifetime = 0 rows for `app_source='tpc-extension'`, the page shows graceful "No extension events yet" empty state.**
   - Status: ✅ green
   - Implementation: Plan 02-03 (`useExtensionGate` lifetime probe with `staleTime: Infinity`, defensive `!error` clause so an error during the gate fetch surfaces as the error state, not as `isEmpty: true`), Plan 02-08 (page-level empty branch — the SINGLE place charts get short-circuited; per-chart probes are forbidden)
   - Tests: `src/hooks/extension/useExtensionGate.test.tsx` (4 — loading / hasAny:false / hasAny:true / error path with retry:1 timeout), `src/pages/Extension.test.tsx` (6 — D-19 invariant: no chart testids appear in the DOM during the empty branch), `src/pages/Extension.smoke.test.tsx` Test 2 (real-component empty branch — 6 chart testids absent)

## Per-Decision Invariants (D-01 through D-21)

| Decision | Description | Verified By | Status |
|----------|-------------|-------------|--------|
| D-01 | `app_source = 'tpc-extension'` on every query | Plan 02-01 static SQL verifier (`scripts/verify-extension-app-source-scope.mjs`, wired into `npm run prebuild`) + Plan 02-03 `services/extension/queries.test.ts` (18 cases including D-01 occurrences) + grep `tpc-extension` returns ≥7 hits in `queries.ts` | ✅ |
| D-02 | 5-event vocabulary excludes `catalog_item` | `EXTENSION_EVENT_TYPES` constant in `services/extension/queries.ts` (single source of truth) + RPC migration `where event_type = any(...)` filter + `EventVolumeChart` defensive pivot drop verified by EventVolumeChart Test 6 (catalog_item injection → still 5 bar groups) | ✅ |
| D-03 | Error signal = `error_message IS NOT NULL` | RPC `get_error_rate_by_type` predicate + `fetchRecentErrors` `.not('error_message','is',null)` + `RecentErrorsTable` queries.ts JSDoc | ✅ |
| D-04 | NULL emails → `Unknown` bucket | `get_per_user_summary` `coalesce(user_email,'Unknown')` (Plan 02-01 SQL) + UI italic-gray `Unknown (no email)` treatment in `UserMultiSelect` (Plan 02-05) verified by UserMultiSelect Test "renders Unknown option as italic-gray" | ✅ |
| D-05 | Previous-period = same length immediately preceding | `get_kpi_totals` `prev_from = p_from - (p_to - p_from)` (Plan 02-01) + `get_cancellation_rates` mirrors the same CTE (Plan 02-01 Checker BLOCKER #1 fix) | ✅ |
| D-06 | Dominant version = max count under filter; ties = latest semver | RPC `get_dominant_version` `order by count desc, string_to_array(version,'.') desc nulls last` (Plan 02-01) | ✅ |
| D-07 | Cancellation rate denominator includes NULL `cancelled` rows | RPC `get_cancellation_rates` (numerator filtered by `cancelled = true`, denominator unfiltered) — verified by Plan 02-01 SQL + Plan 02-07 `CancellationRateKpis` 9 tests | ✅ |
| D-08 | Range-aware bucket: hourly for `today`, daily otherwise | RPC `p_bucket` arg (Plan 02-01) + `useEventVolume` derives `bucket = range === 'today' ? 'hour' : 'day'` (Plan 02-03) + `EventVolumeChart` tickFormatter switches `M/d` ↔ `h a` (Plan 02-04) — verified by EventVolumeChart Test 5 + useEventVolume Test 2 | ✅ |
| D-09 | Live feed = TanStack `refetchInterval`, NOT Realtime | `useLiveFeed.ts` Pattern 4 verbatim (Plan 02-03) — no `supabase.channel(...)` calls; the only feed mechanism is `useQuery` + `refetchInterval` | ✅ |
| D-10 | Refetch interval = 10s | `useLiveFeed.ts` `refetchInterval: () => paused ? false : 10_000` — verified by `useLiveFeed.test.tsx` Test 1 fake-timer cycle | ✅ |
| D-11 | Resume jumps to "latest now" via `invalidateQueries` | `useLiveFeed.ts` resume callback `setPaused(false); void qc.invalidateQueries({ queryKey: FEED_KEY })` — verified by `useLiveFeed.test.tsx` Test 2 | ✅ |
| D-12 | Many TanStack queries (one per chart), aggregations via RPC | 9 hook files in `src/hooks/extension/` + 1 service module (`services/extension/queries.ts`) with 4 aggregation RPC builders + 2 raw select builders + 1 gate probe + 1 distinct-versions builder | ✅ |
| D-13 | Server-side bucketing via `date_trunc(..., 'America/New_York')` 3-arg form | RPC migration `20260429120000_create_extension_rpcs.sql` + Plan 02-01 static verifier check 4 (D-13 3-arg form, `AT TIME ZONE` does NOT appear) | ✅ |
| D-14 | Codebase layout: `services/extension/queries.ts` + `hooks/extension/*` | All 11 hook files reside under `src/hooks/extension/`; the single service module is `src/services/extension/queries.ts` (Plan 02-03) | ✅ |
| D-15 | DeveloperPanel render-gated by `isDevAccount` (NOT `display:hidden`) | `DeveloperPanel.tsx` line 50 `if (!isDevAccount(email)) return null` — verified by `DeveloperPanel.test.tsx` Tests 1 + 1b + 2 (3 null-render branches) plus literal-grep verifier returning 0 for `display:hidden` / `hidden="true"` / `className=".*hidden"` (Plan 02-07 BLOCKER #3 fix) | ✅ |
| D-16 | Email allowlist `['josh@potomackco.com']` lowercase comparison | `src/lib/devAccess.ts` (Plan 02-02) lowercases input + DEV_EMAILS — verified by `devAccess.test.ts` Test "is case-insensitive (RFC 5321)" + `DeveloperPanel.test.tsx` Test 9 (`JOSH@potomackco.com` uppercase still renders panel) | ✅ |
| D-17 | Filters URL-driven (no Zustand) | `useUserFilter.ts`, `useVersionFilter.ts`, `useDateRange.ts` all use `useSearchParams` — verified by Plan 02-02 hook tests covering URL round-trip + sibling preservation | ✅ |
| D-18 | Admin row click no-op; dev row click opens payload modal | `RecentErrorsTable.tsx` cell-level gate (Payload column declared once; cell renderer returns `null` when `!isDev`) + `LiveEventFeed.tsx` per-element render branch (admin `<div>`, dev `<button aria-haspopup="dialog">`) — verified by RecentErrorsTable Tests "admin: Payload header renders but cells have no View" + "dev: each row has a View button" + LiveEventFeed Tests 5 + 6 | ✅ |
| D-19 | Empty gate full-page state via `useExtensionGate` | `useExtensionGate.ts` (Plan 02-03) + `Extension.tsx` page-level branch (Plan 02-08) — 3 layers of test coverage: `useExtensionGate.test.tsx` (4), `Extension.test.tsx` (D-19 invariant — no chart testids in DOM during empty branch), `Extension.smoke.test.tsx` Test 2 (real-component empty branch — 6 chart testids absent) | ✅ |
| D-20 | Per-card empties when range narrows | All 5 admin chart/table components (`EventVolumeChart`, `KpiStrip`, `ErrorRateChart`, `PerUserTable`, `RecentErrorsTable`) own their empty branches with `<EmptyState>`; `LiveEventFeed` renders italic-gray `Waiting for events…` — verified by component tests' empty cases | ✅ |
| D-21 | Per-card error states with Retry | All chart/table/feed components invoke `<ErrorState>` on `query.error` with the locked `(heading, body, onRetry)` contract; the Phase 1 component renders its own Retry button internally — `grep -c "<ErrorState"` across `src/components/extension/*.tsx` returns 8 (one per chart/table/feed/dev-card source file) | ✅ |

## Test Count by Plan

| Plan | Source files | Test files | Tests |
|------|--------------|------------|-------|
| 02-01 | 1 SQL migration + 1 static verifier script | static-only (no `*.test.*` shipped — invariants enforced by `scripts/verify-extension-app-source-scope.mjs` in the prebuild chain) | n/a |
| 02-02 | 4 modules (`useUserFilter`, `useVersionFilter`, `devAccess`, `format`) | 4 | 27 (7 + 6 + 5 + 9) |
| 02-03 | 11 modules (1 service + 10 hooks) | 5 | 35 (18 + 4 + 4 + 2 + 7) |
| 02-04 | 3 components | 3 | 21 (6 + 8 + 7) |
| 02-05 | 3 components + 1 dep install | 3 | 35 (12 + 9 + 14) |
| 02-06 | 1 component | 1 | 10 |
| 02-07 | 4 components + 1 helper | 4 | 35 (11 + 11 + 4 + 9) |
| 02-08 | 1 page + 2 surgical edits (`App.tsx`, `DashboardLayout.tsx`) | 1 | 6 |
| 02-09 | 0 source (this plan ships only test + verification) | 1 | 4 |
| **Total Phase 2** | **~24 source modules + 2 surgical edits + 1 SQL migration** | **22 colocated test files** | **173 tests** |

Project test count after Phase 2: **254 tests across 34 files** (81 from Phase 1 + 173 from Phase 2).

## Cross-Cutting Invariants Verified

- **D-01 SQL invariant** enforced at three layers: SQL migration (Plan 02-01), TS service module JSDoc + reviewer convention (Plan 02-03), static prebuild verifier (`scripts/verify-extension-app-source-scope.mjs` — runs on every `npm run build`)
- **D-02 5-event vocabulary** declared once in `services/extension/queries.ts` as `EXTENSION_EVENT_TYPES`; defense-in-depth re-declared as `EVENT_TYPE_ORDER` in `EventVolumeChart` and `KpiStrip` so a Recharts-side render path can never see a sixth literal even if the RPC payload were tampered with
- **`<ErrorState>` locked contract** `{ heading, body, onRetry }` honored by every chart/table/feed component — no children, no sibling Retry buttons (Phase 1 component renders one internally); `grep -c "<ErrorState"` returns 8 across `src/components/extension/*.tsx`
- **TanStack Table v8 pinned** at `8.21.3` (Plan 02-05); `flexRender` is the API in use; `cell.renderCell()` v7/v9-alpha API is provably absent (`grep -c "renderCell\|renderHeader"` returns 0 across `PerUserTable.tsx` + `RecentErrorsTable.tsx`)
- **No `display:hidden` for the dev gate** — `DeveloperPanel` returns `null`; the literal-grep verifier in Plan 02-07 returns 0 for `display:hidden` / `hidden="true"` / `className=".*hidden"`
- **`useDistinctVersions` is the SOLE source of EXT-09 option list** — `grep -c "supabase" src/components/extension/ExtensionVersionFilter.tsx` returns 0 (Plan 02-03 Checker WARNING #4 fix)

## Build & Test Pipeline

| Check | Command | Result |
|-------|---------|--------|
| Full project test suite | `npx vitest --run` | 254 / 254 passing across 34 files |
| Smoke (real-components + stubbed Supabase) | `npx vitest --run src/pages/Extension.smoke.test.tsx` | 4 / 4 passing |
| Project typecheck | `npx tsc -b --noEmit` | clean |
| Lint, scoped to new file | `npx eslint src/pages/Extension.smoke.test.tsx` | clean |
| Prebuild verifiers | `node scripts/check-no-service-role-in-src.mjs && node scripts/verify-extension-app-source-scope.mjs` | both exit 0 |
| Production build | `npm run build` | (pending — operator may run; not gating this VERIFICATION report) |

## Open Items / Follow-ups

- **Cancellation-rate prev-period delta** — Plan 02-01 SQL extended `get_cancellation_rates` with a `previous_rate` column, mirrored from `get_kpi_totals` (D-05 semantics). Plan 02-07 wires the FLIPPED-direction delta into `CancellationRateKpis`. No follow-up needed.
- **Empty-state polling** — D-19 trade-off accepted (`staleTime: Infinity`). Once a session sees `isEmpty = false`, it never re-checks. The user must refresh the tab if the extension v2.0 ships during the open session. Operator UAT (Task 2) may flag if this surprises anyone — revisit with a `staleTime: 5min` if needed.
- **Server-side pagination for EXT-05** — Recent Errors table ships with a flat `LIMIT 100`. If error volumes regularly exceed 100 in the active range, add cursor-based pagination in a follow-up plan.
- **Operator manual smoke (Plan 02-09 Task 2)** — OPEN. The integration smoke test (Task 1) and the colocated unit/component tests prove every page-level invariant programmatically. What testing CAN'T cover automatically: (a) the empty-gate copy reads naturally to a non-engineer reader, (b) the dev panel actually appears for `josh@potomackco.com` and is hidden for any other email when running against the live shared project, (c) the live feed visually pulses + Pause/Resume timing feels natural at 10s, (d) the payload viewer pretty-prints + copy-to-clipboard works with real `items_content` JSON, (e) sidebar accent activates correctly for `/extension`. See Plan 02-09 Task 2 `<how-to-verify>` for the 10-step operator checklist.
- **Production-cleanliness invariant for Task 2 step 6** (Checker WARNING #8): operator must verify `count = 0` for `user_email = 'test@example.com'` in the live shared `public.analytics_events` table after the manual smoke. Step 6 documents Option A (dev/staging project) / Option B (passive wait) / Option C (atomic insert + rollback) — NO production writes permitted.

## Operator Sign-Off

- [ ] Manual smoke test (Plan 02-09 Task 2) all 10 steps verified
- [ ] Screenshots captured (live-feed running, paused, dev panel expanded, admin DOM without dev panel)
- [ ] Tested both URL-filter-sharing flows (dev → admin)
- [ ] Confirmed `npm run build` succeeds end-to-end
- [ ] Production-cleanliness check: `count = 0` for `user_email = 'test@example.com'` in live `public.analytics_events`

**Phase 2 status:** READY FOR `/gsd-verify-work` *after* operator sign-off on Task 2.

## Source Summaries (per-plan deep-dive)

For per-plan implementation detail, deviations, and threat-model coverage, see:

- `.planning/phases/02-extension-analytics-extension/02-01-SUMMARY.md` — Aggregation RPCs + static D-01 verifier
- `.planning/phases/02-extension-analytics-extension/02-02-SUMMARY.md` — Foundation modules (URL filter hooks, dev allowlist, formatters)
- `.planning/phases/02-extension-analytics-extension/02-03-SUMMARY.md` — Services + hooks (10 query/RPC builders, 11 hooks, all-hooks-smoke)
- `.planning/phases/02-extension-analytics-extension/02-04-SUMMARY.md` — Admin charts (EventVolumeChart, KpiStrip, ErrorRateChart)
- `.planning/phases/02-extension-analytics-extension/02-05-SUMMARY.md` — Tables + UserMultiSelect (TanStack Table v8 install)
- `.planning/phases/02-extension-analytics-extension/02-06-SUMMARY.md` — LiveEventFeed (presentational polled feed)
- `.planning/phases/02-extension-analytics-extension/02-07-SUMMARY.md` — DeveloperPanel + EXT-09 + EXT-10 (D-15 render gate, FLIPPED delta direction)
- `.planning/phases/02-extension-analytics-extension/02-08-SUMMARY.md` — Page composition + route registration + sidebar nav
- `.planning/phases/02-extension-analytics-extension/02-09-SUMMARY.md` — Integration smoke + this VERIFICATION.md + operator manual checkpoint

---

*Verified: 2026-04-30*
*Verifier: Claude (gsd-execute-phase, Opus 4.7 1M context) — programmatic invariants only; operator sign-off on Task 2 still required for full Phase 2 closeout*
