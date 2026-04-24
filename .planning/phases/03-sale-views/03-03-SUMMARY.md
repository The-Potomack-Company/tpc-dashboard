---
phase: 03
plan: 03
subsystem: sale-views
tags:
  - tanstack-table
  - kpi-grid
  - validation-banner
  - tdd
  - a11y
  - threat-model
wave: 3
depends_on:
  - 03-01
  - 03-02
dependency_graph:
  requires:
    - "src/lib/format.ts — 6 formatters + EMPTY (Plan 01)"
    - "src/db/database.types.ts — Sale + SaleDepartment row types (Phase 1)"
    - "src/components/SortIndicator.tsx — sort-state chevron (Plan 02)"
    - "@tanstack/react-table@^8 (Plan 01 installed)"
    - "@tanstack/react-query@^5 — useQueryClient for banner reload"
  provides:
    - "src/components/BackLink.tsx — react-router Link primitive with inline arrow-left SVG"
    - "src/components/ValidationWarningBanner.tsx — amber role=alert banner with Reload-sale button that invalidates ['sale', saleNumber]"
    - "src/components/SaleSummaryCard.tsx — 19-tile KPI grid for sale detail page"
    - "src/components/DepartmentTable.tsx — sortable 8-column dept breakdown with tfoot totals"
  affects:
    - "Wave 4 (SaleDetail page) composes BackLink + ValidationWarningBanner + SaleSummaryCard + DepartmentTable inside ProtectedRoute"
tech-stack:
  added: []
  patterns:
    - "TDD RED → GREEN commit split for every component with a dedicated test file"
    - "divide-x divide-y grid dividers (replaces prior gap-px approach): 1px cell borders without spacing token"
    - "Footer totals computed from source array (not filtered/sorted row model) — sum remains invariant under user sort"
    - "sortDescFirst: false on DepartmentTable so user-driven clicks cycle asc → desc (while default sort is still revenue DESC via initial state)"
    - "sell_through_pct (stored 0-100) divided by 100 at column accessor before formatPercent (which expects 0-1 ratio)"
    - "Controlled stubs via whitelist: formatPaymentStatus renders only known enum values; any unknown/null falls through to EMPTY"
key-files:
  created:
    - path: src/components/BackLink.tsx
      purpose: "Reusable back-navigation link — react-router Link + Heroicons arrow-left"
    - path: src/components/ValidationWarningBanner.tsx
      purpose: "Amber role=alert banner with Reload button invalidating the sale query"
    - path: src/components/SaleSummaryCard.tsx
      purpose: "19-tile KPI grid rendered inside a rounded overflow-hidden card with divide-based cell dividers"
    - path: src/components/DepartmentTable.tsx
      purpose: "Sortable 8-column breakdown TanStack Table with tfoot totals and read-only rows"
    - path: src/tests/validation-warning-banner.test.tsx
      purpose: "6 behavior tests — role=alert, locked copy, Reload invalidates the correct query key, amber surface"
    - path: src/tests/sale-summary-card.test.tsx
      purpose: "15 behavior tests — 19 locked labels, sell-through compute, every formatter class, null-safe, no title= tooltip, responsive divide grid"
    - path: src/tests/department-table.test.tsx
      purpose: "10 behavior tests — exact UI-SPEC headers, default revenue DESC, sort toggle cycle, tfoot totals invariant under sort, sell_through_pct ratio conversion, null-safe cells, read-only rows, estimate range format"
  modified: []
decisions:
  - "sortDescFirst: false on DepartmentTable — the default TanStack Table behavior for numeric columns (descending first) was replaced so user-driven clicks cycle asc → desc, matching the plan's test expectation. The revenue-DESC default sort is preserved via initial sorting state."
  - "Task 1 coupled BackLink + ValidationWarningBanner into a single GREEN commit — BackLink has no dedicated test file per plan (exercised in Wave 4); banner implementation satisfies the only new test file added in that step."
  - "Comments referencing 'tabIndex' and 'dangerouslySetInnerHTML' were rewritten to avoid the literal substrings after initial checks — those static greps are part of the plan's acceptance criteria and any mention (even in a comment) would have failed the signal-of-safety check."
metrics:
  duration: "~11 minutes"
  completed: "2026-04-22"
  tasks: 2
  test_files: 3
  tests: 31
  components_created: 4
---

# Phase 03 Plan 03: Sale Detail Components Summary

Wave 3 ships the four sale-detail-page building blocks: `BackLink` (nav primitive), `ValidationWarningBanner` (amber role=alert with Reload-sale button), `SaleSummaryCard` (19-tile KPI grid), and `DepartmentTable` (sortable 8-column breakdown with totals footer). 31 behavior tests across 3 new test files, all green; full suite 183/183.

## What was built

### Components

| Component | Export | Purpose |
|-----------|--------|---------|
| `BackLink` | `BackLink({ to, children })` | react-router `<Link>` prefixed with an inline Heroicons arrow-left SVG (stroke-width 1.5, w-4 h-4). Accent focus ring. |
| `ValidationWarningBanner` | `ValidationWarningBanner({ saleNumber })` | Amber `role="alert"` banner carrying the UI-SPEC locked copy and a Reload button that calls `useQueryClient().invalidateQueries({ queryKey: ['sale', saleNumber] })`. |
| `SaleSummaryCard` | `SaleSummaryCard({ sale })` | Rounded-card-wrapping `grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 divide-x divide-y` of 19 tiles. Null-safe throughout. No HTML title attribute anywhere. |
| `DepartmentTable` | `DepartmentTable({ departments })` | TanStack Table v8, 8 columns, default revenue DESC, `enableMultiSort: false`, `sortDescFirst: false`. Footer totals computed from the source array. Rows are read-only (no tabIndex, no onClick, no cursor-pointer). |

### SaleSummaryCard — 19-tile label order

The canonical tile order (used by Wave 4 integration tests when asserting label visibility):

1. Sale date
2. Lots auctioned
3. Lots sold
4. Lots unsold
5. Sell-through rate
6. Total sold value
7. Total unsold value
8. Estimate range
9. Reserves
10. Hammer total
11. Buyer premium
12. Commission (maps to `sale.seller_commission`)
13. Insurance
14. Lot charges
15. Referral fees
16. Net revenue
17. Registered bidders
18. Buyers (maps to `sale.winning_buyers`)
19. Payment status

Sell-through rate is computed at render time (`lots_sold / lots_auctioned` with a divide-by-zero guard). Every other tile reads directly from its `sales` row column and flows through the corresponding formatter in `src/lib/format.ts`.

### DepartmentTable — 8-column order

| # | Column | Accessor | Format |
|---|--------|----------|--------|
| 1 | Department | code + display_name | font-mono code badge + plain text name |
| 2 | Lots | `lots_auctioned` | `formatCount` |
| 3 | Sold | `lots_sold` | `formatCount` |
| 4 | Sell-through | `sell_through_pct / 100` | `formatPercent` (ratio input) |
| 5 | Sold value | `total_sold_value` | `formatCurrency` |
| 6 | Estimate | `(low_estimate, high_estimate)` | `formatEstimateRange` |
| 7 | Reserves | `reserves` | `formatCurrency` |
| 8 | Revenue | `revenue` | `formatCurrency` |

All numeric columns (2-8) carry `meta: { numeric: true }` and render right-aligned with `tabular-nums`. The Department column sorts on display_name (fall-back to code); Estimate sorts on low_estimate as a consistent numeric key (fall-back to high).

### Footer totals

`<tfoot>` renders a "Totals" row sourced from the **full** `departments` array — independent of TanStack Table's sorted/filtered row model. This makes totals data-level invariants: user sort clicks can never change them.

Summed columns: Lots, Sold, Sold value, Reserves, Revenue. Intentionally NOT summed (footer shows EMPTY): Sell-through (percentages don't sum) and Estimate (ranges don't sum meaningfully). `sum()` returns `null` when no row contributes a number, so `formatCount` / `formatCurrency` renders em-dash for fully-null columns.

## Commit trail

Per-task TDD RED/GREEN split plus two chore commits for static-check hygiene:

| # | Commit | Description |
|---|--------|-------------|
| 1 | `8e01023` | test(03-03): add failing tests for ValidationWarningBanner |
| 2 | `4c4fe7e` | feat(03-03): implement BackLink + ValidationWarningBanner |
| 3 | `8bcc4b2` | test(03-03): add failing tests for SaleSummaryCard |
| 4 | `f55b875` | feat(03-03): implement SaleSummaryCard with 19 KPI tiles |
| 5 | `b545091` | test(03-03): add failing tests for DepartmentTable |
| 6 | `54f5898` | feat(03-03): implement DepartmentTable with sort + tfoot totals |
| 7 | `bd25c3f` | chore(03-03): scrub tabIndex mention from DepartmentTable comment |
| 8 | `56066ff` | chore(03-03): scrub dangerouslySetInnerHTML mentions from comments |

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 1 - Bug] sortDescFirst default on numeric columns**

- **Found during:** Task 2 GREEN (after initial implementation)
- **Issue:** TanStack Table v8 defaults `sortDescFirst: true` for numeric columns. With the plan's implementation as written, clicking a numeric header (e.g. Lots) went straight to `aria-sort="descending"` instead of `ascending`. The plan's explicit behavior test "Click Lots header → aria-sort=ascending" failed.
- **Fix:** Added `sortDescFirst: false` to `useReactTable`. Default sort (revenue DESC) is preserved via the initial `sorting` state; only user-driven clicks were affected.
- **Files modified:** `src/components/DepartmentTable.tsx`
- **Commit:** `54f5898` (bundled with GREEN implementation)

**2. [Rule 3 - Missing dependency] node_modules not installed in worktree**

- **Found during:** Task 2 (first `npx vitest` after adding `@tanstack/react-table` import)
- **Issue:** Worktree's `node_modules/` had only Vite cache; parent repo's node_modules was hoisted-resolving `@tanstack/react-query` but not `@tanstack/react-table` (parent was stale vs. its own package.json). Task 1 happened to work because it only used react-query (which the parent did have). Task 2's `@tanstack/react-table` import blew up the build.
- **Fix:** Ran `npm install` in the worktree to populate all deps from package-lock.json.
- **Files modified:** none (deps installed at runtime, no repo change)
- **Commit:** n/a

### Static-check hygiene

Two chore commits (`bd25c3f`, `56066ff`) rewrote code comments to remove literal substrings (`tabIndex`, `dangerouslySetInnerHTML`) that the plan's acceptance greps require to be 0. The comments originally asserted the API's absence; they now say the same thing with different wording. No behavior change.

## Threat model execution

| Threat | Disposition | Mitigation applied |
|--------|-------------|---------------------|
| T-03-01 XSS via sale.title, department.display_name | mitigate | All dynamic values rendered through React JSX text nodes (auto-escaped). `dangerouslySetInnerHTML` count across Plan 03 files: **0**. |
| T-03-02 Client RBAC bypass | accept | These are pure display components; RBAC is enforced at the page level by ProtectedRoute (Wave 4). |
| T-03-06 Malicious payment_status enum | mitigate | Inherited mitigation: SaleSummaryCard renders `formatPaymentStatus(sale.payment_status)`, a whitelist in `src/lib/format.ts` that returns EMPTY for any value outside {paid, partial, unpaid}. |

## Acceptance evidence

```
== Wave 3 tests ==
Tests  31 passed (31)

== No XSS ==
PASS  (grep -rq dangerouslySetInnerHTML across 4 Plan 03 files: 0 matches)

== No title= in SaleSummaryCard ==
PASS  (grep title= in src/components/SaleSummaryCard.tsx: 0 matches)

== Full suite ==
Tests  183 passed (183) across 22 test files

== Lint ==
0 errors, 3 warnings (all pre-existing: SalesTable and authStore)

== Build ==
tsc -b && vite build: exit 0 (144 modules transformed, dist built)
```

### Plan acceptance grep matrix

| Check | Required | Actual |
|-------|----------|--------|
| `export function BackLink` | present | 1 |
| `export function ValidationWarningBanner` | present | 1 |
| `export function SaleSummaryCard` | present | 1 |
| `export function DepartmentTable` | present | 1 |
| `role="alert"` in ValidationWarningBanner | 1 | 1 |
| `invalidateQueries` in banner | ≥1 | 3 |
| `queryKey: ['sale', saleNumber]` in banner | ≥1 | 2 |
| `divide-x divide-y` in SaleSummaryCard | ≥1 | 1 |
| `formatPaymentStatus` in SaleSummaryCard | 1 | 1 |
| `title=` in SaleSummaryCard | 0 | 0 |
| tile labels in SaleSummaryCard | 19 | 19 |
| `useReactTable` in DepartmentTable | ≥1 | 2 |
| `<tfoot` in DepartmentTable | 1 | 1 |
| `>Totals<` in DepartmentTable | 1 | 1 |
| `id: 'revenue', desc: true` in DepartmentTable | 1 | 1 |
| `font-mono` in DepartmentTable | ≥1 | 2 |
| `tabIndex` in DepartmentTable | 0 | 0 |
| `onClick=.*navigate` in DepartmentTable | 0 | 0 |
| `sell_through_pct == null ? null : row.sell_through_pct / 100` | 1 | 1 |

All 19 checks pass.

## Known stubs

None. Every component is fully wired — no hardcoded empty arrays, no placeholder text in rendered output, no "coming soon" strings. Null/undefined handling is semantic (em-dash placeholder from `EMPTY`), not a stub.

## Self-Check: PASSED

### Files created verified

- FOUND: src/components/BackLink.tsx
- FOUND: src/components/ValidationWarningBanner.tsx
- FOUND: src/components/SaleSummaryCard.tsx
- FOUND: src/components/DepartmentTable.tsx
- FOUND: src/tests/validation-warning-banner.test.tsx
- FOUND: src/tests/sale-summary-card.test.tsx
- FOUND: src/tests/department-table.test.tsx

### Commits verified (present on HEAD)

- FOUND: 8e01023  test(03-03): add failing tests for ValidationWarningBanner
- FOUND: 4c4fe7e  feat(03-03): implement BackLink + ValidationWarningBanner
- FOUND: 8bcc4b2  test(03-03): add failing tests for SaleSummaryCard
- FOUND: f55b875  feat(03-03): implement SaleSummaryCard with 19 KPI tiles
- FOUND: b545091  test(03-03): add failing tests for DepartmentTable
- FOUND: 54f5898  feat(03-03): implement DepartmentTable with sort + tfoot totals
- FOUND: bd25c3f  chore(03-03): scrub tabIndex mention from DepartmentTable comment
- FOUND: 56066ff  chore(03-03): scrub dangerouslySetInnerHTML mentions from comments
