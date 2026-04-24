---
phase: 3
fixed_at: 2026-04-22T11:29:00Z
review_path: .planning/phases/03-sale-views/03-REVIEW.md
iteration: 1
findings_in_scope: 9
fixed: 9
skipped: 0
status: all_fixed
---

# Phase 3: Code Review Fix Report

**Fixed at:** 2026-04-22T11:29:00Z
**Source review:** `.planning/phases/03-sale-views/03-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 9 (0 Critical + 9 Warning)
- Fixed: 9
- Skipped: 0

All 9 warning-severity findings were fixed. Full verification gate passed after the last commit:
- `npx vitest --run`: 25 files, **205/205 tests passing**
- `npm run lint`: **0 errors**, 3 pre-existing warnings (unchanged from baseline)
- `npm run build`: **succeeded** (tsc -b + vite build, no new errors)

No findings were skipped and no files required rollback.

## Fixed Issues

### WR-01: Sell-through treats lots_sold=0 as missing (SalesTable)

**Files modified:** `src/components/SalesTable.tsx`
**Commit:** `f6d111b`
**Applied fix:** Replaced `row.lots_auctioned && row.lots_sold ? ... : null` with an explicit `row.lots_sold != null && row.lots_auctioned != null && row.lots_auctioned > 0` guard so a row with `lots_sold === 0` (a valid 0% sell-through) renders `0.0%` instead of EMPTY. Now matches `SaleSummaryCard`'s derivation exactly. Added an inline comment referencing WR-01 so the intent isn't lost.

### WR-02: ValidationWarningBanner focus lost on Reload

**Files modified:** `src/components/ValidationWarningBanner.tsx`, `src/tests/validation-warning-banner.test.tsx`, `src/tests/sale-detail-page.test.tsx`
**Commits:** `c17d340` (component + banner test), `2de0c3e` (sale-detail test follow-up)
**Applied fix:** Switched the banner container from `role="alert"` (assertive, re-interrupts on every mount) to `role="status"` + `aria-live="polite"` (announces without stealing focus on remount after Reload click). Option 1 from the review's Fix. Updated both test files whose assertions queried `getByRole('alert')` — they now query `getByRole('status')` and additionally assert `aria-live="polite"` as a regression guard. Requires human verification that the Reload flow still surfaces the banner correctly to screen readers in live AT testing.

### WR-03: Filter match-count live region detached + remount announcement loss

**Files modified:** `src/pages/Sales.tsx`, `src/tests/sales-page.test.tsx`
**Commit:** `9b947f8`
**Applied fix:** The `<p aria-live="polite" aria-atomic="true">` live region is now **always mounted**; content toggles between the `"N of M sales"` string and empty string, with the `sr-only` class applied when inactive so visual layout is unchanged. Updated the sales-page test's initial-state assertion — instead of expecting the element to be absent, it now expects the always-mounted empty sr-only element, and asserts sr-only is removed once the filter text populates.

### WR-04: Virtualization transform math invariant not commented

**Files modified:** `src/components/SalesTable.tsx`
**Commit:** `a19feab`
**Applied fix:** No logic change. Added an inline comment above the `virtualItems.map` block documenting the invariant: `translateY(vRow.start - index * vRow.size)` works only because every row has the same fixed `ROW_HEIGHT`. Comment warns that introducing variable-row-height virtualization (e.g. `measureElement` / dynamic sizes) would break the subtraction and require switching to absolute positioning or a per-row cumulative-start offset.

### WR-05: SalesTable `max-h-[calc(100dvh-16rem)]` breaks when filter row stacks below md:

**Files modified:** `src/components/SalesTable.tsx`, `src/layouts/DashboardLayout.tsx`, `src/pages/Sales.tsx`
**Commit:** `8079448`
**Applied fix:** Adopted the reviewer's recommended flex-column strategy:
- `DashboardLayout` main is now `flex-1 overflow-hidden flex flex-col`. The scroll responsibility moved inward to an inner `flex-1 min-h-0 overflow-y-auto` div, and the content wrapper became `max-w-7xl mx-auto px-8 py-8 min-h-full flex flex-col` so pages can claim vertical space via `flex-1`.
- `SalesPage` now wraps its content in `<div className="flex-1 min-h-0 flex flex-col">` (replacing the fragment) so `SalesTable` can claim the leftover height below the header.
- `SalesTable` scroll container changed from `overflow-y-auto max-h-[calc(100dvh-16rem)]` to `flex-1 min-h-0 overflow-y-auto`. No more magic-constant height; no more double-scrollbar when the filter row stacks below `md:`.
- `SaleDetail` and `Dashboard` pages unchanged — their block content still scrolls through the outer wrapper naturally thanks to `min-h-full` on the content div.

Requires human verification: visually test both `/sales` (virtualization still pins thead, scroll fills remaining height, filter row stacking below md no longer produces a second scrollbar) and `/sales/:saleNumber` (long department tables still scroll normally).

### WR-06: formatDate silently breaks on non-date strings

**Files modified:** `src/lib/format.ts`
**Commit:** `ed44708`
**Applied fix:** Added a `/^(\d{4})-(\d{2})-(\d{2})$/` shape guard at the top of `formatDate` so any input that isn't a bare date-only ISO string returns `EMPTY` (the em-dash) instead of silently forming an `Invalid Date` via the `T00:00:00` concat. The existing `Number.isNaN(d.getTime())` guard is retained as a secondary net for structurally-valid-but-impossible dates like `2026-02-30`.

### WR-07: SaleDetail uses non-null assertion `query.data!`

**Files modified:** `src/pages/SaleDetail.tsx`
**Commit:** `c12a842`
**Applied fix:** Replaced `const { sale, departments } = query.data!;` with an explicit narrowing guard `if (query.data?.status !== 'ok') return null; const { sale, departments } = query.data;`. Protects against future TanStack Query states (isPaused, isFetching-without-data races) where `query.data` could be undefined while `isLoading` and `isError` are both false.

### WR-08: useSales returns inline `[]` — loses reference stability

**Files modified:** `src/hooks/useSales.ts`
**Commit:** `4b8cdd3`
**Applied fix:** Introduced a module-level `EMPTY_SALES: readonly Sale[] = Object.freeze([])` singleton. The queryFn now returns `data ?? (EMPTY_SALES as Sale[])` so consumers relying on `Object.is` equality (useMemo deps, selector comparisons) don't thrash on refetch. Freezing the singleton causes any accidental in-place mutation to throw in strict mode rather than fail silently.

### WR-09: FilterInput Escape handler can double-clear with native `type="search"`

**Files modified:** `src/components/FilterInput.tsx`
**Commit:** `e58acbe`
**Applied fix:** Guarded the Escape handler with `value !== ''` so it no-ops when the input is already empty, and added `e.preventDefault()` to suppress Safari's native `<input type="search">` Escape-clear so both handlers can't fire on the same keystroke.

## Skipped Issues

None — all 9 warning findings were fixed.

---

## Human Verification Checklist

Four findings involve runtime behaviors that static analysis + unit tests can't fully validate. Please spot-check before merging:

- [ ] **WR-02 (a11y focus)**: In real screen-reader testing (NVDA / VoiceOver / JAWS), confirm the validation banner announces politely on first render and does **not** re-interrupt or steal focus when Reload fires.
- [ ] **WR-03 (a11y live region)**: In real screen-reader testing, confirm the `"N of M sales"` match-count announces when typing begins, and that the empty always-mounted region doesn't announce a phantom "blank" on mount.
- [ ] **WR-05 (layout)**: Visually test `/sales` and `/sales/:saleNumber` at widths below the `md:` breakpoint (< 768px) — single scrollbar on `/sales`, long dept table on `/sales/:saleNumber` scrolls naturally.
- [ ] **WR-06 (defensive formatting)**: Exercise `formatDate` manually with a malformed string (e.g. `"today"`, `"2026/04/22"`, `"2026-04-22T10:00:00Z"`) to confirm it returns the em-dash rather than rendering `Invalid Date`.

## Commit Trail

```
e58acbe fix(03): WR-09 FilterInput guard Escape to avoid double-clear with native search input
4b8cdd3 fix(03): WR-08 useSales returns frozen EMPTY_SALES singleton for reference stability
c12a842 fix(03): WR-07 narrow SaleDetail on status==='ok' instead of non-null assertion
ed44708 fix(03): WR-06 shape-validate YYYY-MM-DD in formatDate to return EMPTY on non-date input
8079448 fix(03): WR-05 replace SalesTable calc() height with flex-1 min-h-0 to kill double-scroll
2de0c3e fix(03): WR-02 update sale-detail test assertions to role=status
a19feab fix(03): WR-04 document fixed-row-height invariant of virtualization translateY math
9b947f8 fix(03): WR-03 always-mount filter live region to preserve AT announcement
c17d340 fix(03): WR-02 ValidationWarningBanner use role=status polite (no focus steal on reload)
f6d111b fix(03): WR-01 SalesTable sell-through treats lots_sold=0 as valid 0%
```

---

_Fixed: 2026-04-22T11:29:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
