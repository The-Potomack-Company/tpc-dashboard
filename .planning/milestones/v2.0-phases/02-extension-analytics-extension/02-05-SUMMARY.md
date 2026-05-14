---
phase: 02-extension-analytics-extension
plan: 05
subsystem: ui
tags: [tanstack-table-v8, popover, multi-select, payload-viewer, dev-gate, sorting, headless-table, tdd]
requires:
  - phase: 02-extension-analytics-extension
    provides: "useUserFilter (URL state, Plan 02-02); usePerUserSummary + useRecentErrors (RPC hooks, Plan 02-03); isDevAccount + DEV_EMAILS allowlist (Plan 02-02); Phase 1 retained primitives SortIndicator + TableSkeleton + EmptyState + ErrorState; Phase 1 PayloadViewerModal (kit)"
provides:
  - "src/components/UserMultiSelect.tsx — popover-driven ?users= filter (D-04 Unknown bucket selectable; URL-survival of out-of-data selected emails)"
  - "src/components/extension/PerUserTable.tsx — EXT-04 sortable wide-pivot TanStack Table v8 (default sort last_seen_at desc)"
  - "src/components/extension/RecentErrorsTable.tsx — EXT-05+EXT-06 sortable table with cell-level dev-gated payload viewer (D-18 invariant)"
  - "@tanstack/react-table@8.21.3 — only new runtime dep in Phase 2"
affects:
  - "Plan 02-08 (page composition): imports UserMultiSelect into the page header AND the empty-gate header; imports PerUserTable + RecentErrorsTable into the admin surface"
  - "Plan 02-07 (DeveloperPanel): borrows the same popover idiom for ExtensionVersionFilter (a copy/paste analog of UserMultiSelect)"
tech-stack:
  added:
    - "@tanstack/react-table@8.21.3 — headless table v8 (useReactTable + flexRender + getCoreRowModel + getSortedRowModel)"
  patterns:
    - "TanStack Table v8 headless idiom: useReactTable with state.sorting + onSortingChange; flexRender for both header and cell (NEVER cell.renderCell — Pitfall 5)"
    - "Cell-level isDev gate: Payload column declared once, cell renderer returns null when !isDev. Single useReactTable instance regardless of dev/admin (Open Question 2 resolution)"
    - "PayloadViewerModal lifted into the table component (single instance opened by per-row View buttons; modal title derived from row at click time)"
    - "Popover idiom (DateRangeFilter analog): outside-mousedown + Escape close, ref + useEffect cleanup; trigger button + absolute top-full panel"
    - "Already-selected URL filter values survive in option list even when not in current data set (UserMultiSelect lines 27-32) — preserves ability to deselect ghost values"
    - "TableSkeleton wrapping convention: TableSkeleton renders a <tbody>; loading branches wrap it in a <table> for valid HTML"
key-files:
  created:
    - "src/components/UserMultiSelect.tsx"
    - "src/components/UserMultiSelect.test.tsx"
    - "src/components/extension/PerUserTable.tsx"
    - "src/components/extension/PerUserTable.test.tsx"
    - "src/components/extension/RecentErrorsTable.tsx"
    - "src/components/extension/RecentErrorsTable.test.tsx"
  modified:
    - "package.json (added @tanstack/react-table dependency)"
    - "package-lock.json (lockfile updated)"
key-decisions:
  - "TanStack Table v8 default sort cycle (desc → none → asc → desc) is preserved verbatim — RecentErrorsTable test for the Time column adjusted to assert this cycle accurately rather than the plan's prose simplification ('cycles asc/desc'). The framework default is the right behavior; updating the test to match it preserves consistency for future contributors."
  - "Numeric column right-alignment in PerUserTable uses an isNumericColumn(idx) helper (idx 1..6) rather than per-column className. Centralizes the alignment rule and keeps it consistent between thead and tbody."
  - "Already-selected URL filter values survive in UserMultiSelect's option list even when usePerUserSummary doesn't currently return them (e.g., a user navigates with ?users=ghost@x.com where ghost@x.com is outside the active range). Without this, the user couldn't deselect ghost values without manually editing the URL. Test 'includes already-selected users in the option list' locks this behavior."
patterns-established:
  - "TanStack Table v8 headless idiom is now the canonical table pattern for the dashboard. Future plans (Phase 3 /activity, Phase 5 /live) reuse this exact shape: ColumnDef<Row>[] + useReactTable + flexRender."
  - "Cell-level dev gate via isDevAccount(profile?.email) — same pattern can apply to any future per-row affordance that should be admin-invisible / dev-actionable."
  - "Popover analog re-use: UserMultiSelect's open/ref/outside-click idiom was lifted directly from kit/DateRangeFilter (Phase 1). Plan 02-07's ExtensionVersionFilter will lift it again."
requirements-completed: [EXT-04, EXT-05, EXT-06, EXT-07]

# Metrics
duration: 18min
completed: 2026-04-30
---

# Phase 02 Plan 05: Tables + UserMultiSelect Summary

**Three components shipping the second-most-information-dense parts of `/extension`: a popover-driven `?users=` multi-select with `Unknown (no email)` as a first-class option (D-04), a TanStack Table v8 wide-pivot per-user table (EXT-04, default sort last_seen_at desc), and a recent-errors table with a cell-level dev gate (D-18) where admin sees the row but no Payload affordance and dev sees a `View →` button that opens PayloadViewerModal — backed by 35 colocated tests.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-04-30T14:11:09Z (approx — first commit timestamp)
- **Completed:** 2026-04-30T14:28:55Z
- **Tasks:** 4
- **Files created:** 6 source files (3 components + 3 test files)
- **Files modified:** 2 (package.json + package-lock.json)
- **New tests:** 35 (12 + 9 + 14)
- **Project test count:** 178 (was 143; +35; no regressions)

## Accomplishments

- `@tanstack/react-table@8.21.3` installed (only new runtime dep in Phase 2; v8 stable, NOT v9-alpha)
- `UserMultiSelect` driving `?users=` URL state via `useUserFilter`, with the D-04 `Unknown` bucket as a selectable option labeled `Unknown (no email)` (italic gray)
- `PerUserTable` with 8 columns of TanStack Table v8 sortable headless rendering, default-sorted last_seen_at desc, and the D-04 italic-gray Unknown row treatment on the User cell
- `RecentErrorsTable` proving the D-18 admin/dev row-click split is enforced at the cell level (not the table boundary): one `useReactTable` instance, cell renderer returns `null` when `!isDev`, and PayloadViewerModal is lifted into the table component as a single instance opened by per-row View buttons
- All 3 components honor the LOCKED Phase 1 ErrorState contract verbatim (`heading: string`, `body: string`, `onRetry: () => void` — no children, no sibling Retry button); verified by tests asserting the built-in Retry button click invokes `query.refetch()`

## Task Commits

Each task was committed atomically. TDD tasks have RED + GREEN commits:

1. **Task 1: Install `@tanstack/react-table@^8.21.3`** — `c184d48` (chore)
2. **Task 2: UserMultiSelect (TDD)**
   - RED: `f48012a` (test)
   - GREEN: `bbc111b` (feat)
3. **Task 3: PerUserTable (TDD)**
   - RED: `4c33825` (test)
   - GREEN: `7d5e279` (feat)
4. **Task 4: RecentErrorsTable (TDD)**
   - RED: `46be950` (test)
   - GREEN: `0f883fc` (feat)

7 commits total. No REFACTOR commits — implementations matched the canonical RESEARCH.md and PATTERNS.md excerpts on first GREEN pass.

## Files Created/Modified

### New source files
- `src/components/UserMultiSelect.tsx` — popover-driven `?users=` filter (consumes `useUserFilter` + `usePerUserSummary`; URL-survival of out-of-data selected emails)
- `src/components/extension/PerUserTable.tsx` — EXT-04 wide-pivot table with TanStack Table v8 (`User | catalog_single | catalog_batch | portal_upload | spreadsheet_transform | data_import | Errors | Last seen`)
- `src/components/extension/RecentErrorsTable.tsx` — EXT-05+EXT-06 sortable table with cell-level isDev gate; lifted PayloadViewerModal

### New test files
- `src/components/UserMultiSelect.test.tsx` — 12 tests
- `src/components/extension/PerUserTable.test.tsx` — 9 tests
- `src/components/extension/RecentErrorsTable.test.tsx` — 14 tests

### Modified files
- `package.json` — added `@tanstack/react-table@^8.21.3` to `dependencies`
- `package-lock.json` — lockfile updated

## Verification

| Step | Command | Result |
|------|---------|--------|
| 3 new test files | `npx vitest --run src/components/UserMultiSelect.test.tsx src/components/extension/PerUserTable.test.tsx src/components/extension/RecentErrorsTable.test.tsx` | **35 passed** (12 + 9 + 14) |
| Full project test suite | `npx vitest --run` | **178 passed** (24 files), no regressions (was 143; +35 new) |
| Project typecheck | `npx tsc -b --noEmit` | clean |
| Production build | `npm run build` (includes prebuild verifiers + tsc + vite) | clean (`dist/index-BcMrUMpt.js` 265.51 kB; tree-shaken — table code not yet imported by `App.tsx`) |
| TanStack Table v8 version pin | `npm ls @tanstack/react-table` | `@tanstack/react-table@8.21.3` (NOT 9.0.0-alpha) |
| Pitfall 5 — `flexRender` is the v8 API | `grep -c "flexRender" src/components/extension/PerUserTable.tsx`; `grep -c "renderCell\|renderHeader" src/components/extension/PerUserTable.tsx` | 3 / 0 (PerUserTable); 3 / 0 (RecentErrorsTable) — `flexRender` used for both header AND cell, no v7/v9-alpha API leakage |
| Single `useReactTable` instance per table | `grep -n "useReactTable" src/components/extension/RecentErrorsTable.tsx` | 1 import line + 1 call site (line 132) — proves the dev gate is per-cell, not at the table boundary (Open Question 2 resolution) |
| Runtime resolution | `node -e "require('@tanstack/react-table')"` | exits 0 |

### D-18 admin/dev branching — both code paths exercised by tests

| Test | Branch | Expectation |
|------|--------|-------------|
| `admin: Payload header renders but cells have no "View →" affordance (D-18)` | admin | `getByRole('columnheader', { name: /^Payload/ })` exists; `queryByRole('button', { name: /View/i })` returns null |
| `dev: each row has a "View →" button with aria-haspopup="dialog" (D-18)` | dev | `getAllByRole('button', { name: /View/i })` returns SAMPLE_ROWS.length buttons |
| `dev: clicking View → opens PayloadViewerModal with row-derived title and payload` | dev | After click, `dialog.hasAttribute('open')` becomes true; modal title matches `${event_type} payload — ${user_email ?? 'unknown'}`; modal body contains the row's `items_content` JSON |
| `dev: row with null user_email shows "unknown" in modal title` | dev | Title shows literal `'unknown'` for the null-email row |
| `uses ONE useReactTable instance regardless of dev/admin` | both | `container.querySelectorAll('table')` returns 1 table on each rerender (admin → dev) |

## Pattern Conformance

- **`UserMultiSelect`** matches PATTERNS.md lines 387-431 verbatim (DateRangeFilter popover idiom — outside-mousedown + Escape, trigger button + `absolute top-full` panel). Plus the URL-survival logic for already-selected ghost values (locked by a dedicated test).
- **`PerUserTable`** matches RESEARCH.md lines 730-805 verbatim plus the D-04 Unknown italic-gray treatment, the `isNumericColumn(idx)` right-alignment helper, and the locked Phase 1 ErrorState contract.
- **`RecentErrorsTable`** matches RESEARCH.md lines 730-805 + 1162-1170 (Q9 — single table instance, per-cell dev gate). PayloadViewerModal is lifted into this component as a single instance owned by the table; the parent page (Plan 02-08) does NOT own the modal.

## Decisions Made

1. **TanStack Table v8 default sort cycle preserved verbatim.** The plan's prose said "clicking the Time column header cycles asc/desc"; the actual v8 default cycle when starting from a sorted column is `desc → none → asc → desc`. The RecentErrorsTable sort-cycle test was adjusted to assert the actual framework cycle. This is the right behavior — overriding it would require a custom `sortingFns`/`sortDescFirst` config and break the consistency with PerUserTable (whose User column starts unsorted and cycles `unsorted → asc → desc → unsorted`, also v8 default).

2. **`isNumericColumn(idx)` helper centralizes right-alignment in PerUserTable.** Indices 1..6 (5 event-type counts + Errors column) are numeric and right-aligned; idx 0 (User) and idx 7 (Last seen, treated as left-aligned timestamp text) are not. Same helper applied to both `<th>` and `<td>` so column alignment can never drift between header and body.

3. **Already-selected URL filter values survive in UserMultiSelect's option list.** If a user navigates with `?users=ghost@x.com` but ghost@x.com isn't in the current `usePerUserSummary` result set, the option still renders as checked so they can deselect it. Without this, the only way to clear a ghost selection would be to manually edit the URL. Locked by a dedicated test ("includes already-selected users in the option list even if not in available data").

4. **TanStack Table v8 lint warning is unavoidable.** `react-hooks/incompatible-library` flags `useReactTable()` with the warning "TanStack Table's `useReactTable()` API returns functions that cannot be memoized safely". This is a known v8 ↔ React Compiler/eslint-plugin-react-hooks interop warning, not a usage error. Per the plan's stack constraint (TanStack Table v8.21.3 is locked), the warning is inherent. Documented here so future contributors don't try to fix it inside the table components.

## Deviations from Plan

None of substance. The plan's `<action>` blocks were followed as written. Two minor adjustments captured for completeness:

### Test-side adjustment

**1. RecentErrorsTable Time-column sort-cycle test rewritten to match v8 default cycle.**
- **Found during:** Task 4 GREEN run
- **Issue:** Initial test asserted `desc → asc` after one click, but TanStack Table v8 default cycle from a sorted column is `desc → none → asc → desc`. The plan's prose ("cycles asc/desc") simplified this.
- **Fix:** Updated the test to assert the full 4-step cycle (`desc → none → asc → desc`). The implementation is unchanged — the test now matches the framework's actual behavior.
- **Files modified:** `src/components/extension/RecentErrorsTable.test.tsx` (test only)
- **Verification:** All 14 RecentErrorsTable tests now pass.
- **Committed in:** `0f883fc` (Task 4 GREEN — test patch shipped alongside the implementation)

### Implementation-side adjustment

**2. TableSkeleton wrapped in `<table>` in loading branches.**
- **Found during:** Task 3 implementation (PerUserTable) and applied identically in Task 4 (RecentErrorsTable)
- **Issue:** `TableSkeleton` renders a `<tbody>`. Returning it directly from a component yields invalid HTML (a `<tbody>` outside a `<table>`).
- **Fix:** Wrapped `<TableSkeleton ...>` in a `<table className="w-full text-sm">` in both loading branches.
- **Files modified:** `src/components/extension/PerUserTable.tsx`, `src/components/extension/RecentErrorsTable.tsx`
- **Verification:** Loading branch tests confirm 5 × N pulse bars render; HTML is valid.
- **Committed in:** `7d5e279` (PerUserTable GREEN), `0f883fc` (RecentErrorsTable GREEN)

---

**Total deviations:** 2 minor adjustments (1 test-side correction to match v8 framework behavior; 1 implementation-side wrap for valid HTML). Neither is a Rule-1/2/3 fix — both are intrinsic to the framework usage and could be considered plan refinements.
**Impact on plan:** Zero — every plan must-have is honored, every behavior the plan specified is now locked by tests.

## Issues Encountered

- **Pre-existing lint error in `src/components/kit/DateRangeFilter.tsx:37`** (`react-hooks/set-state-in-effect`). Already documented in `.planning/phases/02-extension-analytics-extension/deferred-items.md` from Plan 02-02. Not in scope here.
- **Two new lint warnings** flagged by `react-hooks/incompatible-library` against `useReactTable()` itself in PerUserTable.tsx and RecentErrorsTable.tsx. Inherent to TanStack Table v8 usage; cannot be resolved without changing the API or downgrading. Not an error — warning only. See decision #4 above.
- **Bundle size unchanged after install.** The new components are not yet imported by `App.tsx` (Plan 02-08 wires them in). Tree-shaking removes `@tanstack/react-table` from the production bundle on this plan; the package will land in the bundle when Plan 02-08 imports the components.

## TDD Gate Compliance

Three independent TDD cycles, one per Task 2/3/4. Every implementation commit (`feat`) is preceded by a failing-test commit (`test`). RED commits were verified to fail (module-not-found errors) before GREEN was written:

- Task 2 RED: `f48012a` (UserMultiSelect.test.tsx fails — `Failed to resolve import "./UserMultiSelect"`)
- Task 2 GREEN: `bbc111b` (12 tests pass)
- Task 3 RED: `4c33825` (PerUserTable.test.tsx fails — module not found)
- Task 3 GREEN: `7d5e279` (9 tests pass)
- Task 4 RED: `46be950` (RecentErrorsTable.test.tsx fails — module not found)
- Task 4 GREEN: `0f883fc` (14 tests pass)

Task 1 (npm install) is not TDD — it is a `chore` commit covering infrastructure setup.

## Threat Model Compliance

| Threat ID | Mitigation Status | Evidence |
|-----------|-------------------|----------|
| T-02-18 (Information Disclosure — admin sees `items_content` in DOM) | accept | `RecentErrorsTable.tsx` line 126 reads `row.items_content` from `info.row.original` only inside the cell renderer that early-returns `null` when `!isDev`. The data IS in the React tree (the column is part of the `useReactTable` row model), but admin cannot trigger the modal without `isDev`. RLS already grants admin SELECT access (Phase 1 INFR-05) — no new disclosure. Documented as accepted in plan threat model. |
| T-02-19 (Elevation of Privilege — spoofed `profile.email`) | accept | RLS `analytics_admin_select` is the authoritative gate; `isDevAccount` is UX-organizational. A spoofer who flips the dev flag still sees only what RLS already allows. |
| T-02-20 (Tampering — future code uses `cell.renderCell()` v7/v9 API) | mitigate | `grep -c "renderCell\|renderHeader" src/components/extension/PerUserTable.tsx` and `RecentErrorsTable.tsx` both report 0. `flexRender` is used for header AND cell render in both files (3 occurrences each). TS would refuse `cell.renderCell()` because the v8 type does not expose it. |
| T-02-21 (Information Disclosure — error_message contents) | accept | Same exposure as the existing schema; admin already has SELECT access. The Error column applies CSS `truncate` and a `title` tooltip showing the full text on hover — same shape as the live schema, no new disclosure. |

## Stub Tracking

No stubs introduced. All three components consume real data hooks and render real columns:
- `UserMultiSelect` reads from `useUserFilter` (URL state) and `usePerUserSummary` (RPC); no hardcoded user lists, no mock data, no placeholder text masquerading as a feature.
- `PerUserTable` reads from `usePerUserSummary` (RPC); all 8 columns are wired to actual `PerUserRow` keys.
- `RecentErrorsTable` reads from `useRecentErrors` (RPC) and `useAuthStore` (real Zustand store); the Payload column's `null` return on admin is intentional D-18 behavior, NOT a stub. The cell renderer for dev users wires `items_content` into the modal.

## Threat Flags

None. All three components consume existing hooks (no new Supabase queries), use existing modal/skeleton/empty/error primitives (no new UI surfaces), and respect the D-01 / D-02 / D-03 invariants enforced upstream by Plan 02-01 (SQL) and Plan 02-03 (services). No new file access patterns, no new auth paths, no schema changes.

## Next Phase Readiness

- Plan 02-08 (page composition) can now import `<UserMultiSelect>` (header), `<PerUserTable>` (admin surface), and `<RecentErrorsTable>` (admin surface) directly. None of the three takes data props — they internally consume their hooks, so the page composition is purely structural (layout grid + Cards wrapping each).
- Plan 02-07 (DeveloperPanel) can lift the `UserMultiSelect` popover idiom into `ExtensionVersionFilter` — the open/ref/outside-click/Escape pattern is the same.
- The `Cell.renderCell` v7/v9-alpha API is now provably absent from the codebase (0 occurrences in PerUserTable + RecentErrorsTable). Future Phase 3/5 tables should keep using `flexRender`.

## Self-Check: PASSED

Files created (verified via `[ -f path ]`):
- FOUND: src/components/UserMultiSelect.tsx
- FOUND: src/components/UserMultiSelect.test.tsx
- FOUND: src/components/extension/PerUserTable.tsx
- FOUND: src/components/extension/PerUserTable.test.tsx
- FOUND: src/components/extension/RecentErrorsTable.tsx
- FOUND: src/components/extension/RecentErrorsTable.test.tsx

Commits (verified via `git log --oneline | grep`):
- FOUND: c184d48 (chore — Task 1: install @tanstack/react-table)
- FOUND: f48012a (test — Task 2 RED)
- FOUND: bbc111b (feat — Task 2 GREEN)
- FOUND: 4c33825 (test — Task 3 RED)
- FOUND: 7d5e279 (feat — Task 3 GREEN)
- FOUND: 46be950 (test — Task 4 RED)
- FOUND: 0f883fc (feat — Task 4 GREEN)

Test count delta verified: 143 → 178 (+35; matches 12 + 9 + 14).

---
*Phase: 02-extension-analytics-extension*
*Plan: 05*
*Status: COMPLETE*
