---
phase: 04-kpi-landing-page
verified: 2026-04-22T13:10:00Z
status: human_needed
score: 8/8 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Load / in browser. Wait for KPIs to populate, then click YTD or L6M."
    expected: "Cards remain on screen with old values while refetch is in-flight — no skeleton flash between periods."
    why_human: "placeholderData: keepPreviousData behavior requires a live TanStack Query + real latency; cannot simulate timing in Vitest."
  - test: "Load / in browser with imported sales data. Inspect the 4 KPI cards."
    expected: "Revenue delta arrow is green (up) or red (down), sell-through delta uses pp suffix, no-baseline renders an em-dash. Colors are semantic green-600/red-600/gray-500."
    why_human: "Tailwind color classes are present in the DOM but visual rendering requires a browser. Color blindness and dark-mode paths also need eyeball verification."
  - test: "Click a RecentSaleCard on the landing page."
    expected: "Browser navigates to /sales/{sale_number} and the Sale Detail page loads."
    why_human: "react-router navigation fidelity under real routing (not MemoryRouter) requires end-to-end browser test."
  - test: "Tab to PeriodSelector, use ArrowLeft/ArrowRight to cycle, then Tab to the first RecentSaleCard and press Enter."
    expected: "Focus ring visible on active option; ArrowKeys cycle correctly; Enter on RecentSaleCard navigates."
    why_human: "End-to-end keyboard navigation path across two components requires a real browser with a keyboard; each step is unit-tested in isolation."
  - test: "Load / with OS prefers-reduced-motion enabled."
    expected: "Skeleton shimmer bars do not pulse (motion-safe: prefix disables animation)."
    why_human: "Requires OS-level reduced-motion flag; out of scope for Vitest."
  - test: "Resize browser to tablet width (768px) and below."
    expected: "KPI grid collapses 4-col → 2-col → 1-col; Recent Sales grid collapses 5-col → 2-col → 1-col."
    why_human: "Tailwind responsive breakpoints require a real browser viewport."
---

# Phase 4: KPI Landing Page Verification Report

**Phase Goal:** Users see a high-level performance snapshot the moment they open the dashboard
**Verified:** 2026-04-22T13:10:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | `public.kpi_summary(date,date,date,date)` exists in the linked Supabase project | VERIFIED | `supabase/migrations/20260422000000_kpi_summary_rpc.sql` exists; migration was pushed per 04-01-SUMMARY.md; `database.types.ts` line 590 confirms the RPC is live |
| 2 | Callers with `authenticated` role can EXECUTE `kpi_summary`; public/anon cannot | VERIFIED | Migration contains `revoke all on function public.kpi_summary(date,date,date,date) from public` + `grant execute ... to authenticated`; `private.is_admin()` gate raises for non-admins (3 grep hits in migration) |
| 3 | RPC returns `{current, previous}` × `{revenue, sell_through, lots_sold, sales_count}` as JSONB in one round-trip | VERIFIED | Migration SQL confirmed; `kpiSummarySchema` (kpi-schema.ts) parses this exact shape; 04-01-SUMMARY confirms psql spot-check ran clean |
| 4 | Divide-by-zero on `SUM(lots_auctioned) = 0` produces `sell_through = null`, not a Postgres error | VERIFIED | `nullif(sum(lots_auctioned), 0)` appears in both CTEs (grep count: 3 — 2 CTE occurrences + 1 comment); `kpiSummarySchema` accepts `sell_through: null` (`.nullable()`) |
| 5 | `computePeriodBounds('ytd'\|'l6m'\|'l12m', now)` returns half-open `[start, end)` for current and previous windows | VERIFIED | `src/lib/period.ts` exports `Period`, `PeriodBounds`, `computePeriodBounds`, `toIsoDateLocal`; 14 test cases pass in `period.test.ts`; `toISOString` does NOT appear in implementation body |
| 6 | Landing page shows 4 KPI scorecards (Total revenue, Avg sell-through, Total lots sold, Total sales count) with period-over-period change | VERIFIED | `src/pages/Dashboard.tsx` has 4 explicit `<KpiCard>` blocks with copy-locked labels (lines 91/99/107/115); sell-through uses `deltaType="percentage-points"`, others use `"relative"`; 316/316 tests green including KPI-01 and KPI-02 dashboard integration tests |
| 7 | KPI scorecards show period-over-period change (arrow up/down with %) | VERIFIED | `formatDelta` in `format.ts` drives glyph+text+direction+aria; `KpiCard` renders the colored delta span with `aria-label`; 15 format-delta tests + 12 kpi-card tests all pass |
| 8 | Landing page shows the 5 most recent sales with key metrics | VERIFIED | `RecentSalesPanel` slices via `useMemo` to 5 items; `useSales()` provides data sorted by `sale_date DESC`; `RecentSaleCard` renders sale_number, title, date, net_revenue, sell-through; KPI-03 integration test asserts Sale 5+ is not rendered when 10 sales are provided |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260422000000_kpi_summary_rpc.sql` | kpi_summary RPC definition + grant/revoke | VERIFIED | File exists; contains `create or replace function public.kpi_summary`, `security definer`, `set search_path`, `nullif` in both CTEs, `revoke all`, `grant execute to authenticated`, `private.is_admin()` gate |
| `src/db/database.types.ts` | Type entry for the new RPC | VERIFIED | Line 590: `kpi_summary` under `Database['public']['Functions']` with correct 4-arg shape; `import_sale_with_departments` preserved |
| `src/lib/period.ts` | Period enum + computePeriodBounds pure function | VERIFIED | Exports `Period`, `PeriodBounds`, `computePeriodBounds`, `toIsoDateLocal`; no `toISOString` in implementation |
| `src/lib/format.ts` | formatDelta helper appended | VERIFIED | Exports `DeltaDirection`, `DeltaType` (`'relative'\|'percentage-points'`), `FormattedDelta`, `formatDelta`; pre-existing exports unchanged |
| `src/lib/kpi-schema.ts` | Zod schema + KpiSummary type | VERIFIED | Exports `kpiSummarySchema`, `KpiSummary`, `KpiWindow`; `numericLike` union handles string-numeric; `sell_through` is `.nullable()` |
| `src/hooks/useKpiSummary.ts` | TanStack Query hook wrapping supabase.rpc | VERIFIED | Imports `keepPreviousData` from `@tanstack/react-query`; uses `placeholderData: keepPreviousData`; `queryKey: ['kpi', period]`; calls `supabase.rpc('kpi_summary', ...)` with `toIsoDateLocal` dates; runs `kpiSummarySchema.parse(data)` |
| `src/components/KpiCard.tsx` | Display-only KPI scorecard | VERIFIED | Uses `formatDelta`; container class `p-6 rounded-lg border min-h-[128px] space-y-2`; `aria-label` on delta span; not focusable (no tabIndex/role=button) |
| `src/components/KpiCardSkeleton.tsx` | Shimmer placeholder | VERIFIED | 3 shimmer bars with `motion-safe:animate-pulse`; same outer class shape as `KpiCard` |
| `src/components/PeriodSelector.tsx` | YTD/L6M/L12M segmented control | VERIFIED | `<fieldset>` wrapping `<button role="radio">`; `ArrowLeft`/`ArrowRight`/`Home`/`End` keyboard handlers; active state `bg-gray-50` (NOT accent) |
| `src/components/RecentSaleCard.tsx` | Compact navigable card | VERIFIED | Imports `Link` from `react-router`; `to={'/sales/' + sale.sale_number}`; `focus-visible:ring-accent`; sell-through guards `lots_auctioned > 0` |
| `src/components/RecentSaleCardSkeleton.tsx` | Shimmer placeholder | VERIFIED | 5 shimmer bars; outer class matches `RecentSaleCard` (`p-4 rounded-lg border min-h-[128px] space-y-1`) |
| `src/components/RecentSalesPanel.tsx` | Section heading + grid + states | VERIFIED | `useMemo` with `[sales]` dep; imports all 4 sub-components; error heading "Couldn't load recent sales"; `lg:grid-cols-5 gap-4` grid |
| `src/pages/Dashboard.tsx` | Route component for / | VERIFIED | 137 lines (> 80 min); exports `DashboardPage` (named) + `export default DashboardPage`; `useState<Period>('l12m')` default; 4 explicit `<KpiCard>` blocks |
| `src/tests/dashboard-page.test.tsx` | Integration test | VERIFIED | 12 cases; KPI-01/KPI-02/KPI-03 explicitly labeled in `it()` descriptions; independent-failure tests present; period-click test asserts `useKpiSummaryMock` called with `'ytd'` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `supabase/migrations/20260422000000_kpi_summary_rpc.sql` | `public.sales` | aggregate queries over `sale_date` window | VERIFIED | `from public.sales` in migration |
| `src/db/database.types.ts` | `Database['public']['Functions']` | regenerated types include kpi_summary | VERIFIED | Line 590 confirms entry under `Functions` block |
| `src/hooks/useKpiSummary.ts` | `src/lib/supabase.ts` | `supabase.rpc('kpi_summary', ...)` | VERIFIED | Line 40: `supabase.rpc('kpi_summary', { period_start, period_end, compare_start, compare_end })` |
| `src/hooks/useKpiSummary.ts` | `src/lib/kpi-schema.ts` | `kpiSummarySchema.parse(data)` | VERIFIED | Line 47: `return kpiSummarySchema.parse(data)` |
| `src/hooks/useKpiSummary.ts` | `src/lib/period.ts` | `computePeriodBounds` + `toIsoDateLocal` | VERIFIED | Lines 4–5: both imported and called in queryFn |
| `src/components/KpiCard.tsx` | `src/lib/format.ts` | `formatDelta(current, previous, type)` | VERIFIED | Line 1 import; line 44: `const delta = formatDelta(current, previous, deltaType)` |
| `src/components/RecentSaleCard.tsx` | react-router `Link` | `to={'/sales/' + sale.sale_number}` | VERIFIED | Imports `Link from 'react-router'`; renders `to={'/sales/${sale.sale_number}'}` |
| `src/components/RecentSalesPanel.tsx` | `src/hooks/useSales.ts` | `useSales()` data sliced to 5 via useMemo | VERIFIED | `useSales` invoked in Dashboard.tsx; `sales` prop passed to RecentSalesPanel; `useMemo` slices at panel boundary |
| `src/pages/Dashboard.tsx` | `src/hooks/useKpiSummary.ts` | `useKpiSummary(period)` | VERIFIED | Line 2 import; line 48: `const kpi = useKpiSummary(period)` |
| `src/pages/Dashboard.tsx` | `src/hooks/useSales.ts` | `useSales()` | VERIFIED | Line 3 import; line 49: `const sales = useSales()` |
| `src/App.tsx` | `src/pages/Dashboard.tsx` | `Route path='/' element={<DashboardPage />}` | VERIFIED | `App.tsx` line 3: named import; line 15: route wiring; file was NOT modified in Phase 4 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `src/pages/Dashboard.tsx` | `kpi.data` | `useKpiSummary(period)` → `supabase.rpc('kpi_summary', ...)` → Postgres aggregate over `public.sales` | Yes — RPC pushed to Supabase, `kpi_summary` aggregates real `sales` rows | FLOWING |
| `src/pages/Dashboard.tsx` | `sales.data` | `useSales()` → existing Phase 3 query over `public.sales` | Yes — same Supabase query established in Phase 3 | FLOWING |
| `src/components/RecentSalesPanel.tsx` | `recent` (via `useMemo`) | `sales` prop sliced to first 5 | Yes — stable reference from parent `useSales()` | FLOWING |

Note: Data flow to live Supabase depends on the operator having run the PDF import (DATA-01, deferred in Phase 2). If no sales are imported, real queries return empty aggregates and `RecentSalesPanel` shows the "No sales yet" empty state — which is correct behavior, not a stub.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 316 tests pass | `npx vitest --run` | 34 files, 316 tests, 0 failures | PASS |
| No new lint errors | `npm run lint` | 0 errors, 3 pre-existing warnings (SalesTable, authStore) | PASS |
| Build produces dist/ | `npm run build` | 251 modules, dist/index.html + assets produced | PASS |
| `keepPreviousData: true` absent (v5 clean) | `grep -rn "keepPreviousData: true" src/` | 0 code matches (1 JSDoc warning comment only) | PASS |
| `toISOString` absent from period.ts body | `grep -n "toISOString" src/lib/period.ts` | 0 code matches (1 docstring warning only) | PASS |
| 4 explicit KpiCard blocks | `grep -c "<KpiCard" src/pages/Dashboard.tsx` | 4 (plus skeleton and comment counts) | PASS |

Step 7b: No server needed — all behavioral checks ran against the static build and test suite.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| KPI-01 | 04-01, 04-02, 04-03, 04-04 | Landing page shows KPI scorecards: total revenue, avg sell-through, total lots sold, total sales count | SATISFIED | 4 `<KpiCard>` blocks with copy-locked labels; integration test `it('KPI-01: renders 4 KpiCards with labels in the fixed order')` passes |
| KPI-02 | 04-01, 04-02, 04-03, 04-04 | KPI scorecards show period-over-period change (arrow up/down with %) | SATISFIED | `formatDelta` drives glyph/text/direction; sell-through uses `percentage-points` (pp suffix); revenue uses `relative` (% suffix); integration test `it('KPI-02: ...')` passes |
| KPI-03 | 04-03, 04-04 | Landing page shows most recent sales with key metrics at a glance | SATISFIED | `RecentSalesPanel` + `useSales()` + `useMemo` slice; `RecentSaleCard` renders 5 fields; integration test `it('KPI-03: ...')` passes |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/lib/period.ts` line 71 | 71 | `toISOString` appears in docstring | Info | Warning comment to future developers — not a runtime call; `toIsoDateLocal` implementation body is clean |
| `src/hooks/useKpiSummary.ts` line 30 | 30 | `toISOString` appears in JSDoc | Info | Same — documentation of the anti-pattern to avoid, not usage |

No blockers, no stubs, no orphaned components, no hardcoded empty data arrays in render paths.

### Human Verification Required

6 items require browser/OS testing. None block the code being correct — they verify visual, responsive, and timing behaviors that cannot be asserted in Vitest.

#### 1. Period Swap — No Skeleton Flash

**Test:** Load `/`, wait for KPIs to populate (non-skeleton state), then click YTD or L6M.
**Expected:** Cards remain on screen with previous-period values while the refetch runs. No brief skeleton state between periods.
**Why human:** `placeholderData: keepPreviousData` behavior requires real TanStack Query network latency to observe; Vitest mocks resolve synchronously.

#### 2. Delta Arrow Colors

**Test:** Load `/` with imported sales data. Inspect the 4 KPI cards with a real browser devtools.
**Expected:** Positive delta → green-600 text; negative delta → red-600 text; no-baseline → gray-500 text. Verify in both light and dark mode.
**Why human:** Tailwind utility classes are in the DOM and can be grep'd, but rendered color output requires a browser.

#### 3. Recent Sale Click-Through

**Test:** Click a `RecentSaleCard` tile on the landing page.
**Expected:** Browser navigates to `/sales/{sale_number}` and the Sale Detail page loads correctly.
**Why human:** `react-router` navigation with a real history stack (not MemoryRouter) requires end-to-end browser test.

#### 4. Keyboard Navigation End-to-End

**Test:** Tab to `PeriodSelector`, use ArrowLeft/ArrowRight to cycle options, then Tab past it to the first `RecentSaleCard`, then press Enter.
**Expected:** Focus ring visible on active PeriodSelector option; ArrowKeys cycle without mouse; Enter on RecentSaleCard navigates to sale detail.
**Why human:** End-to-end keyboard journey across two separate components — each is unit-tested individually but the cross-component tab order requires a real browser.

#### 5. Reduced-Motion Skeleton Suppression

**Test:** Enable OS-level `prefers-reduced-motion: reduce`. Load `/` before data returns.
**Expected:** Skeleton shimmer bars are static (no `animate-pulse` animation).
**Why human:** The `motion-safe:animate-pulse` Tailwind prefix reads from the OS media query; requires OS-level flag toggle.

#### 6. Responsive Grid Collapse

**Test:** Load `/` and resize browser width from 1440px down through 768px to 375px.
**Expected:** KPI grid: 4-col (lg) → 2-col (md) → 1-col (below md). Recent Sales grid: 5-col (lg) → 2-col (md) → 1-col.
**Why human:** Tailwind responsive breakpoints (`md:`, `lg:`) require a real browser viewport; Vitest runs in jsdom which has no layout engine.

### Gaps Summary

No gaps. All 8 must-have truths are VERIFIED, all artifacts are substantive and wired, data flows from Postgres through the RPC to the Dashboard, and 316 tests pass with lint and build green.

The `human_needed` status reflects 6 visual/behavioral items that require browser verification before final QA sign-off. These are not missing implementation — they are testing modalities that Vitest cannot exercise.

---

_Verified: 2026-04-22T13:10:00Z_
_Verifier: Claude (gsd-verifier)_
