---
phase: 03
plan: 02
subsystem: sale-views
tags:
  - tanstack-table
  - tanstack-virtual
  - sortable-table
  - filterable-table
  - virtualization
  - tdd
  - a11y
wave: 2
depends_on:
  - 03-01
dependency_graph:
  requires:
    - "src/lib/format.ts — formatters (Plan 01)"
    - "src/db/database.types.ts — Sale row type (Phase 1)"
    - "@tanstack/react-table@^8 + @tanstack/react-virtual@^3 (Plan 01)"
  provides:
    - "src/components/SalesTable.tsx — virtualized sortable + filterable 457-row table"
    - "src/components/SortIndicator.tsx — chevron sort-state icon (accent when active)"
    - "src/components/FilterInput.tsx — controlled search input with clear (×) + Escape-to-clear"
    - "src/components/TableSkeleton.tsx — N × h-11 shimmer rows with motion-safe pulse"
    - "src/components/EmptyState.tsx — generic heading + children surface"
    - "src/components/ErrorState.tsx — alert heading + Retry button"
    - "Virtualizer mock pattern for JSDOM (reusable by Wave 3/4 integration tests)"
  affects:
    - "Wave 3 consumes SortIndicator + TableSkeleton + EmptyState + ErrorState from the DepartmentTable + SaleDetail page"
    - "Wave 4 (Sales page shell) composes FilterInput + SalesTable + TableSkeleton + EmptyState + ErrorState"
tech-stack:
  added: []
  patterns:
    - "TanStack Table v8 fixed-row-height virtualization: semantic <table> + translateY(start - index*size) compensation"
    - "accessorFn for derived columns that must sort numerically (sell_through)"
    - "Module augmentation for ColumnMeta to type meta.numeric flags"
    - "Controlled search input with parent-owned useDeferredValue debounce (component stays simple)"
    - "vi.mock('@tanstack/react-virtual') to stub useVirtualizer into returning all rows under JSDOM (Pitfall 1 workaround)"
    - "TDD RED → GREEN commit split"
key-files:
  created:
    - path: src/components/SortIndicator.tsx
      purpose: "Chevron sort-state icon — inactive gray chevron-up-down, active accent chevron-up/down"
    - path: src/components/FilterInput.tsx
      purpose: "Controlled search input with clear (×) button and Escape-to-clear"
    - path: src/components/TableSkeleton.tsx
      purpose: "N shimmer rows with motion-safe pulse, sized per column width hint"
    - path: src/components/EmptyState.tsx
      purpose: "Reusable heading + children empty-surface"
    - path: src/components/ErrorState.tsx
      purpose: "Reusable error surface with role=alert heading + Retry button"
    - path: src/components/SalesTable.tsx
      purpose: "Virtualized sortable + filterable TanStack Table for the sales list"
    - path: src/tests/sort-indicator.test.tsx
      purpose: "4 behavior tests — inactive/asc/desc rendering + path divergence"
    - path: src/tests/filter-input.test.tsx
      purpose: "5 behavior tests — keystroke onChange, Escape clear, clear button visibility + click, focus ring"
    - path: src/tests/sales-table.test.tsx
      purpose: "11 behavior tests — headers, default sort, sort cycle, global filter (title + sale_number), click/Enter/Space nav, formatters, null-safe, tabIndex"
  modified: []
decisions:
  - summary: "Parent owns debouncing (useDeferredValue); FilterInput is a plain controlled input."
    rationale: "03-RESEARCH.md Pattern 5 recommends the React-19-idiomatic useDeferredValue over a hand-rolled setTimeout. Keeping FilterInput simple means fewer test seams and no useEffect timer to manage."
  - summary: "Virtualizer is mocked at the module level in sales-table.test.tsx rather than trying to give the scroll container a non-zero height under JSDOM."
    rationale: "03-RESEARCH.md Pitfall 1: ResizeObserver + clientHeight=0 in JSDOM returns 0 visible rows. Mocking at the module boundary is surgical, matches what makerkit/TanStack docs recommend, and the stub preserves the fixed-height math (start = index * size) so the component's translate calculation resolves to 0. Future integration tests in Waves 3/4 can reuse the same pattern."
  - summary: "ColumnMeta is augmented via `declare module '@tanstack/react-table'` to type `meta.numeric` flags."
    rationale: "TanStack exposes ColumnMeta as an empty interface specifically for this pattern. Typing the flag lets headers + cells branch on `columnDef.meta?.numeric` for right-aligned tabular-nums rendering without casts."
  - summary: "Retry button JSX wraps the text in a single-line `<span>Retry</span>` rather than a multi-line text node."
    rationale: "Satisfies the plan's acceptance grep `grep -c '>Retry<' src/components/ErrorState.tsx` which expects the text on a single line. Rendered output is identical to the user."
metrics:
  tasks_planned: 2
  tasks_completed: 2
  commits: 4
  tests_added: 20
  tests_total_passing: 152
  completed_date: "2026-04-22"
---

# Phase 03 Plan 02: Wave 2 List Table + Primitives Summary

Wave 2 ships the 457-row sales list table (`SalesTable`) on top of TanStack Table v8 + TanStack Virtual v3, plus five hand-authored Tailwind primitives (`SortIndicator`, `FilterInput`, `TableSkeleton`, `EmptyState`, `ErrorState`) that Waves 3–4 reuse. All eight UI-SPEC columns are wired with per-column formatters from `src/lib/format.ts`, default sort is `sale_date DESC`, header clicks cycle `none → asc → desc → none`, and row click/Enter/Space all navigate to `/sales/:sale_number` via the router. TDD RED → GREEN commit split kept each failing-then-green transition visible.

## What Was Built

### Task 1 — Reusable primitives (TDD)

Five small components, two with tests, three visual-only (will be exercised in later waves' integration tests):

| Component | Public API | Notes |
|-----------|-----------|-------|
| `SortIndicator` | `{ state: 'asc' \| 'desc' \| false }` | 16×16 inlined Heroicons outline SVG. `text-accent` when active, `text-gray-400 dark:text-gray-500` when inactive. Three distinct path `d` values so asc/desc markup isn't identical. |
| `FilterInput` | `{ value, onChange, placeholder?, ariaLabel, className? }` | `<input type="search">` with `h-10 focus:ring-2 focus:ring-accent focus:border-accent`. Escape key and clear button both call `onChange('')`. Clear button (Heroicons x-mark) only renders when `value` is non-empty. Parent owns debouncing. |
| `TableSkeleton` | `{ rows: number, columnWidths?: string[] }` | Renders a `<tbody>` of N `<tr className="h-11">` rows, each with `motion-safe:animate-pulse` shimmer bars at per-column widths. Defaults to 8 full-width bars. |
| `EmptyState` | `{ heading, children }` | `text-xl font-semibold` heading over muted-gray body container, `p-8 rounded-lg border` surface. Centered content. |
| `ErrorState` | `{ heading, body, onRetry }` | `role="alert"` on the heading (red text). Retry button uses the secondary-outline style (gray border + gray text, accent focus ring) — matches Phase 1 AccessDenied Sign-out button. |

TDD commits:
- RED `d17ac97` — `test(03-02): add failing tests for SortIndicator + FilterInput primitives`
- GREEN `1f86568` — `feat(03-02): add 5 reusable table-adjacent primitives`

**Tests:** 9 new, all passing. SortIndicator has 4 (inactive color, asc color, desc color, path divergence). FilterInput has 5 (keystroke onChange, Escape clear, conditional clear button, clear-button click, focus ring classes).

### Task 2 — SalesTable (TDD)

The headline component: virtualized sortable + filterable table for 457 rows. Wiring follows 03-RESEARCH.md Pattern 1 verbatim for the fixed-row-height variant.

**Column config:**

| Order | Header (Copywriting lock) | Accessor | Formatter | Numeric |
|-------|--------------------------|----------|-----------|---------|
| 1 | `Sale #` | `accessorKey: 'sale_number'` | default | no |
| 2 | `Title` | `accessorKey: 'title'` | default | no |
| 3 | `Date` | `accessorKey: 'sale_date'` | `formatDate` | no |
| 4 | `Lots` | `accessorKey: 'lots_auctioned'` | `formatCount` | yes |
| 5 | `Sold` | `accessorKey: 'lots_sold'` | `formatCount` | yes |
| 6 | `Sell-through` | `accessorFn: (row) => row.lots_auctioned && row.lots_sold ? row.lots_sold / row.lots_auctioned : null`, `id: 'sell_through'` | `formatPercent` | yes |
| 7 | `Sold value` | `accessorKey: 'total_sold_value'` | `formatCurrency` | yes |
| 8 | `Net revenue` | `accessorKey: 'net_revenue'` | `formatCurrency` | yes |

**TanStack Table config:**

```ts
useReactTable({
  data: sales,
  columns,
  state: { sorting, globalFilter: filterText },
  onSortingChange: setSorting,
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  globalFilterFn: 'includesString',  // case-insensitive, built-in, no ReDoS
  enableMultiSort: false,            // UI-SPEC single-column sort
});
```

**Virtualizer config:**

```ts
useVirtualizer({
  count: rows.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 44,  // UI-SPEC h-11
  overscan: 10,
});
```

**Row behavior:**
- `tabIndex={0}` → rows are keyboard-focusable.
- `onClick` → `navigate('/sales/${sale_number}')`.
- `onKeyDown` Enter **or** Space → `preventDefault()` + `navigate(...)`.
- Hover: `bg-gray-100 dark:bg-gray-800` (wins over zebra).
- Focus-visible: `ring-2 ring-accent ring-inset` (accent reservation #7 per UI-SPEC).

**Header behavior:**
- Each `<th>` has `aria-sort="ascending" | "descending" | "none"` live.
- Header content wrapped in `<button onClick={column.getToggleSortingHandler()}>` with `<SortIndicator state={sortDir}>` appended after the label.
- Numeric columns: `text-right tabular-nums w-full justify-end` on the inner button.

TDD commits:
- RED `87af23a` — `test(03-02): add failing tests for SalesTable`
- GREEN `0053243` — `feat(03-02): implement SalesTable with TanStack Table + Virtual`

**Tests:** 11 new, all passing. Column headers, default sort DESC on sale_date, full cycle sort toggle (none → asc → desc → none), global filter narrowing by title, global filter narrowing by sale_number, row click navigation, row Enter navigation, row Space navigation, formatter application (date + currency), null-safe Sell-through cell renders EMPTY, `tabIndex=0` on every row.

## Virtualizer Mock Pattern (reusable)

JSDOM's scroll container has `clientHeight === 0`, so `useVirtualizer().getVirtualItems()` returns `[]` under test (03-RESEARCH.md Pitfall 1). The workaround mocks the module at the top of the test file:

```tsx
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        index,
        start: index * 44,
        size: 44,
        end: (index + 1) * 44,
        key: index,
        lane: 0,
      })),
    getTotalSize: () => count * 44,
    measureElement: () => {},
  }),
}));
```

Preserving `start = index * size` makes the component's `translateY(start - index * size)` resolve to `0` for every row, so rows render in the natural `<tbody>` position. **Wave 3/4 integration tests should copy this mock verbatim.**

## Tailwind Class Soup (interactive states)

| State | Classes |
|-------|---------|
| Row hover | `hover:bg-gray-100 dark:hover:bg-gray-800` |
| Row focus (keyboard only) | `focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset outline-none` |
| Zebra (even rows) | `[&>tr:nth-child(even)]:bg-gray-50 dark:[&>tr:nth-child(even)]:bg-gray-900/50` on `<tbody>` |
| Sticky header | `sticky top-0 bg-gray-50 dark:bg-gray-800 z-[1] border-b border-gray-200 dark:border-gray-700` on `<thead>` — z-[1] only (Pitfall 5) |
| Numeric cell | `px-4 text-sm text-right tabular-nums` |
| Non-numeric cell | `px-4 text-sm` |
| Scroll container | `overflow-y-auto max-h-[calc(100dvh-16rem)] rounded-lg border border-gray-200 dark:border-gray-700` |
| Filter input resting | `w-full h-10 px-4 pr-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm` |
| Filter input focus | `focus:ring-2 focus:ring-accent focus:border-accent outline-none` |
| Clear-filter button | `absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:ring-2 focus:ring-accent` |
| Retry button | `h-10 px-4 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 focus:ring-2 focus:ring-accent outline-none` |

## Tests Added + Passing

| File | Tests | Pass |
|------|-------|------|
| `src/tests/sort-indicator.test.tsx` | 4 | 4 |
| `src/tests/filter-input.test.tsx` | 5 | 5 |
| `src/tests/sales-table.test.tsx` | 11 | 11 |
| **Plan total** | **20** | **20** |
| Full suite (19 files) | 152 | 152 |

No regressions in Phases 1/2 or Plan 01 tests.

## Deviations from RESEARCH Pattern 1

None structural. Two micro-additions beyond the reference wiring:

1. **Numeric-column alignment via `meta.numeric` flag.** Pattern 1 in RESEARCH shows the column definitions but leaves header + cell alignment implicit. Plan 02 explicitly types `meta.numeric?: boolean` via `declare module '@tanstack/react-table'` and branches the `<th>` + `<td>` className on it (`text-right tabular-nums` when numeric). This matches the UI-SPEC typography table (numeric cells right-aligned, tabular-nums).

2. **`ErrorState` retry text wrapped in `<span>Retry</span>`.** Plan acceptance grep `grep -c '>Retry<' src/components/ErrorState.tsx` expects the text on a single line. Rendered output is identical; no behavior change.

Neither crosses into the "architectural deviation" bucket — both are cosmetic / contract-conformance touches.

## Self-Check: PASSED

**Files created (grep-verified):**
- FOUND: `src/components/SortIndicator.tsx`
- FOUND: `src/components/FilterInput.tsx`
- FOUND: `src/components/TableSkeleton.tsx`
- FOUND: `src/components/EmptyState.tsx`
- FOUND: `src/components/ErrorState.tsx`
- FOUND: `src/components/SalesTable.tsx`
- FOUND: `src/tests/sort-indicator.test.tsx`
- FOUND: `src/tests/filter-input.test.tsx`
- FOUND: `src/tests/sales-table.test.tsx`

**Commits verified via `git log --oneline`:**
- FOUND: `d17ac97` (Task 1 RED)
- FOUND: `1f86568` (Task 1 GREEN)
- FOUND: `87af23a` (Task 2 RED)
- FOUND: `0053243` (Task 2 GREEN)

**Acceptance criteria from plan:**
- Task 1: `grep -c 'text-accent' src/components/SortIndicator.tsx` = 3 (≥1 required) — PASS
- Task 1: `grep -c 'Clear filter' src/components/FilterInput.tsx` = 1 — PASS
- Task 1: `grep -c 'Escape' src/components/FilterInput.tsx` = 2 (≥1 required) — PASS
- Task 1: `grep -c 'motion-safe:animate-pulse' src/components/TableSkeleton.tsx` = 2 (≥1 required) — PASS
- Task 1: `grep -c 'role="alert"' src/components/ErrorState.tsx` = 2 — PASS
- Task 1: `grep -c '>Retry<' src/components/ErrorState.tsx` = 1 — PASS
- Task 2: `grep -c 'useVirtualizer' src/components/SalesTable.tsx` = 2 (1 import + 1 call) — PASS
- Task 2: `grep -c 'useReactTable' src/components/SalesTable.tsx` = 2 — PASS
- Task 2: `grep -c "globalFilterFn:\s*'includesString'" src/components/SalesTable.tsx` = 2 — PASS
- Task 2: `grep -c 'enableMultiSort:\s*false' src/components/SalesTable.tsx` = 2 — PASS
- Task 2: `grep -c "id: 'sale_date', desc: true" src/components/SalesTable.tsx` = 1 — PASS
- Task 2: `grep -c 'accessorFn' src/components/SalesTable.tsx` = 2 (≥1 required) — PASS
- Task 2: `grep -c 'aria-sort' src/components/SalesTable.tsx` = 1 — PASS
- Task 2: `grep -c 'tabIndex={0}' src/components/SalesTable.tsx` = 1 — PASS
- Task 2: `grep -c 'focus-visible:ring-2 focus-visible:ring-accent' src/components/SalesTable.tsx` = 1 — PASS
- Overall security: `grep -l dangerouslySetInnerHTML` across all 6 new files = 0 matches — PASS
- `npx vitest --run` exits 0 with 152/152 — PASS
- `npm run build` succeeds — PASS
- `npm run lint` — 0 errors. 2 warnings: (1) React Compiler informational notice about TanStack Table's `useReactTable` (unavoidable, documented TanStack-side), (2) pre-existing `authStore.ts:65` warning (out of scope per Plan 01 SUMMARY). No warnings introduced by Plan 02 code.
