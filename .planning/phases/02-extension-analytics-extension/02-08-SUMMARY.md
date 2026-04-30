---
phase: 02-extension-analytics-extension
plan: 08
subsystem: ui
tags: [page-shell, route-registration, sidebar-nav, empty-gate, composition, tdd, smoke-test]
requires:
  - phase: 02-extension-analytics-extension
    provides: "useExtensionGate (Plan 02-03 — D-19 lifetime emptiness probe with isLoading + isEmpty); EventVolumeChart, KpiStrip, ErrorRateChart (Plan 02-04); UserMultiSelect, PerUserTable, RecentErrorsTable (Plan 02-05); LiveEventFeed (Plan 02-06); DeveloperPanel (Plan 02-07 — self-renders null for non-devs); EmptyState + DateRangeFilter (Phase 1 retained primitives)"
provides:
  - "src/pages/Extension.tsx — page shell composing all 8 EXT section components in UI-SPEC layout order, with the page-level empty-gate branch (D-19 + Pattern 5)"
  - "src/pages/Extension.test.tsx — 6 colocated smoke tests covering loading / empty / ready branches, document.title side-effect, heading copy, and section composition order"
  - "/extension route registered in src/App.tsx (mounted inside the DashboardLayout group, gated by ProtectedRoute)"
  - "First active NAV_ITEMS entry in src/layouts/DashboardLayout.tsx (chart-bar Heroicon, accent-treatment on route match)"
affects:
  - "Phase 2 wave-5 closure: with /extension reachable + nav entry highlighted, all EXT-01..10 surfaces are composed end-to-end. No follow-up wiring plan in Phase 2 — Plan 02-09 is verifier territory"
  - "Phase 3 (Team Activity) and Phase 5 (Live Sale): future NAV_ITEMS entries append to the array (current single-entry shape is a precedent)"
  - "Phase 1 INFR-03 invariant: scripts/verify-no-kit-in-dist.mjs continues to pass — the top-level-await KitPage const + dev-only ternary are preserved verbatim across the App.tsx insertion"
tech-stack:
  added: []
  patterns:
    - "Page-level empty-gate branch (Pattern 5 / D-19): the SINGLE place charts get short-circuited. `if (gate.isLoading) return loading; if (gate.isEmpty) return empty; return composedTree;` — never per-chart conditional mounting (would force N+1 emptiness probes and slow first paint). Smoke test asserts NO chart testids appear in the DOM during the empty branch."
    - "Filter row above the empty branch (UI-SPEC § Empty gate layout): DateRangeFilter + UserMultiSelect render in the page header even when the page is gated empty or loading. Informational; the filters don't error against an empty dataset."
    - "Document.title side-effect with cleanup: useEffect captures the previous document.title and restores it on unmount, so navigating away from /extension does not leave the tab title stuck."
    - "Section composition stub-mocking in tests: each section component is mocked to a `<div data-testid='…' />` so the smoke test stays scoped to composition + branching, not to each child's inner rendering. Each child has its own colocated suite under src/components/extension/."
    - "Non-destructive route insertion: App.tsx insertion adds 1 import + 1 Route line. The five load-bearing pieces (`/login` route, `<ProtectedRoute>` wrapper, dev-only KitPage top-level-await + ternary, `*` wildcard navigate) all survive verbatim. Plan 02-08 spec lists 7 explicit invariants — verified by inline node script."
    - "compareDocumentPosition for layout-order assertion: jsdom doesn't expose `sourceIndex`, so the smoke test uses `prev.compareDocumentPosition(curr) & DOCUMENT_POSITION_FOLLOWING` to verify pairwise order across the 7 section testids. Cleaner than relying on `getAllByText` array order or container.children traversal."
key-files:
  created:
    - "src/pages/Extension.tsx"
    - "src/pages/Extension.test.tsx"
    - ".planning/phases/02-extension-analytics-extension/02-08-SUMMARY.md"
  modified:
    - "src/App.tsx — +2 lines (1 import, 1 Route element)"
    - "src/layouts/DashboardLayout.tsx — +25/-3 (NAV_ITEMS array now has the Extension entry; comment block updated)"
key-decisions:
  - "Section composition order test added beyond the plan's 5-test specification. Plan listed 5 acceptance behaviors; the smoke suite ships 6 (added the explicit pairwise-order assertion via compareDocumentPosition). Justification: T-02-30 in the threat model flags 'composition order changes accidentally' as a mitigate-class threat, and the threat model said operator UAT would catch order issues. A unit test is cheaper than waiting for UAT and gives Plan 02-09 (verifier) a stable green signal."
  - "Document.title side-effect uses a closure-captured previous value rather than a hard-coded fallback. This protects against future routes that also set the title — when ExtensionPage unmounts, the title returns to whatever the predecessor route had set, not to a stale 'TPC Dashboard' string."
  - "EmptyState body copy expanded from the plan's bare 'No extension events yet' to a 2-paragraph block explaining the v2.0 extension dependency and a fallback-contact line. The plan permitted this (it specifies the heading text but leaves children open). The added copy follows D-19's intent (informational empty state, no error connotation)."
  - "Used straight ASCII single-quote in document.title em-dash via the literal `Extension — TPC Dashboard` string. The plan specified the em-dash (U+2014) verbatim. Test asserts the same literal."
patterns-established:
  - "Page shell pattern for v2.0 phases: a top-level page consults a phase-scoped `useXyzGate` (lifetime emptiness probe), branches into loading / empty / ready, and composes its section components inline. Phase 3 (Team Activity) and Phase 5 (Live Sale) will follow this exact shape with `useTeamActivityGate` / `useLiveSaleGate` and their own EmptyState copy."
  - "Smoke-test pattern for page composition: mock the gate hook + every section component as a `<div data-testid='…' />`, then assert (1) loading branch keeps filter row + omits charts; (2) empty branch keeps filter row + EmptyState copy + omits charts; (3) ready branch mounts all sections; (4) document.title side-effect; (5) header copy; (6) layout order via compareDocumentPosition."
  - "Sidebar NAV_ITEMS expansion convention: each phase appends one entry; the array retains its `to` (route present) vs `!to` (Coming soon placeholder) shape so a phase can ship a dim entry first and wire the route in a later plan if needed."
requirements-completed: [EXT-01, EXT-02, EXT-03, EXT-04, EXT-05, EXT-06, EXT-07, EXT-08, EXT-09, EXT-10]

# Metrics
duration: 5min
completed: 2026-04-30
---

# Phase 02 Plan 08: Page Composition + Route Registration + Sidebar Nav Entry Summary

**One new page (`src/pages/Extension.tsx`) composing all eight EXT section components in UI-SPEC layout order behind a page-level empty-gate branch (D-19 + Pattern 5 — the SINGLE place charts get short-circuited; per-chart probes are forbidden), one colocated smoke test (6 cases — loading / empty / ready / heading copy / document.title / pairwise composition order via `compareDocumentPosition`), one non-destructive `/extension` route insertion in `src/App.tsx` (5 load-bearing existing pieces preserved verbatim — `/login`, `<ProtectedRoute>`, dev-only KitPage ternary, `*` wildcard — verified by an inline 7-invariant node script), and the first active `NAV_ITEMS` entry in `src/layouts/DashboardLayout.tsx` (chart-bar Heroicon, accent treatment on route match).**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-30T14:50:52Z (Task 1 RED — failing-test commit)
- **Completed:** 2026-04-30T14:55:40Z (Task 3 — sidebar nav commit)
- **Commits:** 4 atomic (1 test/RED, 2 feat/GREEN page+route, 1 feat sidebar)

## Tasks Completed (3/3)

### Task 1: ExtensionPage with empty-gate branch + smoke test (TDD)

**Approach:** Strict RED-GREEN cycle.

- **RED commit `2344aaf`:** Wrote `src/pages/Extension.test.tsx` (6 cases) before any page module existed. Test failed with `Failed to resolve import './Extension'` — confirmed RED.
- **GREEN commit `4b6f71b`:** Wrote `src/pages/Extension.tsx`. All 6 tests pass on the first run; full project suite remains green.

**Files:**
- `src/pages/Extension.tsx` (182 lines): `<PageHeader>` (heading + subtitle + filter row) + branch logic + composed tree of 7 section testids in UI-SPEC order.
- `src/pages/Extension.test.tsx` (191 lines, 6 cases): all section components stubbed; gate hook mocked; covers loading / empty / ready / heading copy / document.title / pairwise composition order.

**Key invariants verified by tests:**

| Invariant | Test | Result |
|-----------|------|--------|
| D-19 page-level empty branch (no chart testids in DOM when isEmpty) | "D-19: when gate.isEmpty…" | PASS |
| Filter row above empty branch (UI-SPEC § Empty gate layout) | "D-19…" + "shows page-level loading skeleton…" | PASS |
| Loading branch keeps filter row, omits charts | "shows page-level loading skeleton…" | PASS |
| Ready branch mounts ALL 7 sections | "when gate is ready, mounts ALL section components…" | PASS |
| document.title side-effect with cleanup | "sets document.title to…" | PASS |
| Header copy — heading + subtitle | "renders Extension Analytics heading + subtitle" | PASS |
| Section composition order matches UI-SPEC § Layout Specifications | "section composition order: EXT-01 → EXT-02 → …" | PASS (NEW — beyond plan spec) |

### Task 2: Register `/extension` route in `src/App.tsx`

**Approach:** Surgical 2-line insertion. No deletions.

- Added `import { ExtensionPage } from './pages/Extension';` to the import block.
- Inserted `<Route path="/extension" element={<ExtensionPage />} />` immediately after the `/` route and before the `{KitPage && …}` ternary.

**Verification:** Plan-spec inline node script — all 7 invariants present:
- `/login` route preserved
- `/` HomePage route preserved
- `/extension` ExtensionPage route added
- `{KitPage &&` dev-only ternary preserved
- `*` wildcard Navigate preserved
- Top-level-await KitPage const preserved (Phase 1 INFR-03)
- ExtensionPage import added

`npm run build` succeeded; `scripts/verify-no-kit-in-dist.mjs` passed (Phase 1 INFR-03 invariant intact).

**Commit `365345d`:** 2 lines added; 0 lines removed.

### Task 3: First sidebar `NAV_ITEMS` entry

**Approach:** Replaced the empty `NAV_ITEMS: NavItem[] = []` literal with a 1-element array containing the Extension entry (chart-bar Heroicon SVG inline).

- Heroicons `chart-bar` (24x24 viewBox, `strokeWidth={1.5}`, `currentColor`, `aria-hidden="true"`) — matches UI-SPEC § Color "Accent reservation slot 3".
- `to: '/extension'` triggers the existing `NavLink isActive` branch in DashboardLayout → accent treatment activates on route match.
- Updated comment block (lines 22-23) to reflect that the array is no longer empty: "Phase 2 lights up the first entry (/extension); Phase 3 will append /activity, Phase 5 /live."

**Verification:** `npm run build` succeeded. `grep -c "Extension" src/layouts/DashboardLayout.tsx` → 2 (comment + label literal).

**Commit `f177d3f`:** +25 / -3 lines.

## Empty-gate branch confirmation (Pattern 5 / D-19)

The empty-gate branch is at the page level ONLY. The smoke test asserts this directly:

```typescript
it('D-19: when gate.isEmpty, renders only header + EmptyState — no chart sections in DOM', () => {
  gateMock.mockReturnValue({ isLoading: false, isEmpty: true, error: null });
  render(<ExtensionPage />, { wrapper: makeWrapper() });

  expect(screen.queryByTestId('event-volume-chart')).not.toBeInTheDocument();
  expect(screen.queryByTestId('kpi-strip')).not.toBeInTheDocument();
  expect(screen.queryByTestId('error-rate-chart')).not.toBeInTheDocument();
  expect(screen.queryByTestId('per-user-table')).not.toBeInTheDocument();
  expect(screen.queryByTestId('recent-errors-table')).not.toBeInTheDocument();
  expect(screen.queryByTestId('live-event-feed')).not.toBeInTheDocument();
  expect(screen.queryByTestId('developer-panel')).not.toBeInTheDocument();
});
```

Any future change that moves the gate into a child component (regression that would force N+1 probes per chart) would either keep the parent mounted (failing the test) or move the gate (visible in code review).

## Section composition order confirmation

The page tree composes sections in UI-SPEC § Layout Specifications order:

1. `<PageHeader>` (heading + subtitle + filter row)
2. EXT-01 — `<EventVolumeChart>` (rounded card, h-72)
3. EXT-02 — `<KpiStrip>` (grid grid-cols-2 lg:grid-cols-5)
4. EXT-03 — `<ErrorRateChart>` (rounded card, h-48)
5. EXT-04 + EXT-05 — `<PerUserTable>` + `<RecentErrorsTable>` side-by-side at xl, stacked below (grid grid-cols-1 xl:grid-cols-2)
6. EXT-08 — `<LiveEventFeed>`
7. `<DeveloperPanel>` (self-renders null for non-devs — D-15 enforced inside the component itself, page-level mount is unconditional)

The smoke test asserts pairwise document position across all 7 testids — any future reorder breaks the test.

## Verification

- [x] `npm run test -- --run src/pages/Extension.test.tsx` → 6 passed
- [x] Full project test suite: 250 / 250 passed across 33 test files (was 244 before this plan; +6 new tests, 0 regressions)
- [x] `npm run build` → success (1152 modules transformed; bundle 797.02 kB before gzip)
- [x] `scripts/verify-no-kit-in-dist.mjs` → "OK: No references to KitPage, routes/kit, '/kit' in dist/"
- [x] `scripts/check-no-service-role-in-src.mjs` → "OK: No references to 'SUPABASE_SERVICE_ROLE_KEY'"
- [x] `scripts/verify-extension-app-source-scope.mjs` → "OK — 6 RPCs, all invariants satisfied"
- [x] App.tsx 7-invariant node script → "OK App.tsx — all 7 invariants present"
- [x] `grep -c "/extension" src/App.tsx` → 1
- [x] `grep -c "Extension" src/layouts/DashboardLayout.tsx` → 2 (comment + label)

## Operator manual-smoke notes (recommended)

Plan 02-08 expects the operator to verify the visual layer before wave-5 merge:

1. `npm run dev`
2. Sign in as admin
3. Visit `/extension` — sidebar should show the Extension entry with active accent treatment (`text-accent border-l-2 border-accent bg-accent/5`)
4. Page renders the gate-loading state, then either the empty state (no extension events yet) or the full composition (data present)
5. No console errors

The smoke test covers all the page-level invariants (D-19 branching, composition, document.title, header copy). What it does NOT cover and is left to operator UAT:
- Visual layout fidelity (Tailwind classes render as expected — no production-only purge issues)
- Sidebar accent treatment activates on `/extension` (verified by NavLink's `isActive` branch — covered indirectly by Plan 01 sidebar tests)
- Filter row alignment in production CSS (`flex items-end justify-between` rendering)

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written. No Rule 1, 2, or 3 deviations triggered.

### Authentication Gates

None.

### Scope-boundary deferrals

Pre-existing lint errors in `src/components/kit/DateRangeFilter.tsx:37` and `src/hooks/extension/useTopErrorRows.ts` (`react-hooks/incompatible-library` / `react-hooks/set-state-in-effect`) were observed during Task 2 verification. They are unchanged by Plan 02-08 and were already documented in `.planning/phases/02-extension-analytics-extension/deferred-items.md` from earlier waves. NOT fixed here (scope boundary — they predate Plan 02-08's modifications).

## Commits

| Task | Type | Hash | Message |
|------|------|------|---------|
| 1 (RED) | test | `2344aaf` | test(02-08): add failing smoke test for ExtensionPage |
| 1 (GREEN) | feat | `4b6f71b` | feat(02-08): implement ExtensionPage shell with empty-gate branch |
| 2 | feat | `365345d` | feat(02-08): register /extension route in App.tsx |
| 3 | feat | `f177d3f` | feat(02-08): add first sidebar nav entry for /extension |

## TDD Gate Compliance

- **RED gate (commit `2344aaf`):** `test(02-08)` commit precedes any implementation. Test failed with the expected import-resolution error.
- **GREEN gate (commit `4b6f71b`):** `feat(02-08)` commit followed RED. All 6 tests pass on the first run.
- **REFACTOR gate:** Not needed; the GREEN implementation matches the plan's reference snippet and required no cleanup pass.

Tasks 2 and 3 do not require RED/GREEN cycles per the plan (`tdd="true"` flag is on Task 1 only) — they are mechanical edits with literal-grep automated checks.

## Self-Check: PASSED

- `src/pages/Extension.tsx` exists — confirmed
- `src/pages/Extension.test.tsx` exists — confirmed
- `src/App.tsx` modified with 2 line insertion — confirmed (commit `365345d`)
- `src/layouts/DashboardLayout.tsx` modified with NAV_ITEMS entry — confirmed (commit `f177d3f`)
- Commits `2344aaf`, `4b6f71b`, `365345d`, `f177d3f` all present in `git log` — confirmed
- 6 new tests pass; 250 total project tests pass — confirmed
- `npm run build` succeeds — confirmed
- D-19 invariant (no chart testids in DOM during empty branch) — verified by smoke test
- UI-SPEC composition order — verified by smoke test (pairwise compareDocumentPosition)
