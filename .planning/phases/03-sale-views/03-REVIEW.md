---
phase: 3
depth: standard
status: issues_found
files_reviewed: 18
reviewed_at: 2026-04-22
findings:
  critical: 0
  warning: 9
  info: 10
  total: 19
files_reviewed_list:
  - src/App.tsx
  - src/components/BackLink.tsx
  - src/components/DepartmentTable.tsx
  - src/components/EmptyState.tsx
  - src/components/ErrorState.tsx
  - src/components/FilterInput.tsx
  - src/components/SaleSummaryCard.tsx
  - src/components/SalesTable.tsx
  - src/components/SortIndicator.tsx
  - src/components/TableSkeleton.tsx
  - src/components/ValidationWarningBanner.tsx
  - src/hooks/useSale.ts
  - src/hooks/useSales.ts
  - src/layouts/DashboardLayout.tsx
  - src/lib/format.ts
  - src/pages/SaleDetail.tsx
  - src/pages/SaleNotFound.tsx
  - src/pages/Sales.tsx
---

# Phase 3 Code Review

No blocking issues. Recommend addressing WR-01, WR-02, WR-04, WR-07 before merge; others are follow-up polish.

## Warnings

### WR-01: Sell-through treats lots_sold=0 as missing (SalesTable)

- **File:** `src/components/SalesTable.tsx:96-99`
- **Issue:** Accessor `row.lots_auctioned && row.lots_sold ? row.lots_sold / row.lots_auctioned : null` returns null when `lots_sold === 0` (a valid 0% sell-through). Disagrees with `SaleSummaryCard.tsx:46-50` which handles this correctly.
- **Fix:** Guard only `lots_auctioned > 0`:
```ts
accessorFn: (row) =>
  row.lots_sold != null && row.lots_auctioned != null && row.lots_auctioned > 0
    ? row.lots_sold / row.lots_auctioned
    : null,
```

### WR-02: ValidationWarningBanner focus lost on Reload

- **File:** `src/components/ValidationWarningBanner.tsx:25-57`
- **Issue:** `role="alert"` is assertive and re-interrupts on every mount. After clicking Reload sale, focus can fall to `document.body` if the banner unmounts.
- **Fix:** Change to `role="status" aria-live="polite"` OR capture focus with a `buttonRef` and call `buttonRef.current?.focus()` after `invalidateQueries`.

### WR-03: Filter match-count live region detached + remount announcement loss

- **File:** `src/pages/Sales.tsx:65-73`
- **Issue:** Live region conditionally rendered — some ATs treat conditional mounting as removal rather than update.
- **Fix:** Always mount, toggle content via text + `sr-only`:
```tsx
<p aria-live="polite" aria-atomic="true" className={`... ${filter && count > 0 ? '' : 'sr-only'}`}>
  {filter && count > 0 ? `${filteredCount} of ${count} sales` : ''}
</p>
```

### WR-04: Virtualization transform math invariant not commented

- **File:** `src/components/SalesTable.tsx:197-217`
- **Issue:** `translateY(vRow.start - index * vRow.size)` works only because all rows share `vRow.size`. Non-obvious invariant.
- **Fix:** Add inline comment anchoring the invariant (no logic change).

### WR-05: SalesTable scroll container `max-h-[calc(100dvh-16rem)]` breaks when filter row stacks below md:

- **File:** `src/components/SalesTable.tsx:149`
- **Issue:** Double-scrollbar UX at `< md:` (still inside supported range since md: = 768px).
- **Fix:** Make `DashboardLayout` main a flex column and give SalesTable scroll container `flex-1` rather than the `calc()` height.

### WR-06: formatDate silently breaks on non-date strings

- **File:** `src/lib/format.ts:62-67`
- **Issue:** Blind `T00:00:00` concat — any non-`YYYY-MM-DD` input becomes `Invalid Date`.
- **Fix:** Regex-validate `^\d{4}-\d{2}-\d{2}$` first:
```ts
const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
if (!match) return EMPTY;
```

### WR-07: SaleDetail uses non-null assertion `query.data!`

- **File:** `src/pages/SaleDetail.tsx:114`
- **Issue:** After branch guards, TS cannot narrow `query.data`. A future state (isPaused, race between isLoading/isFetching) could crash.
- **Fix:**
```ts
if (query.data?.status !== 'ok') return null;
const { sale, departments } = query.data;
```

### WR-08: useSales returns inline `[]` — loses reference stability

- **File:** `src/hooks/useSales.ts:23-29`
- **Issue:** `return data ?? []` creates a new reference on each refetch.
- **Fix:** Module-level `EMPTY_SALES` singleton.

### WR-09: FilterInput Escape handler can double-clear with native `type="search"`

- **File:** `src/components/FilterInput.tsx:34-36, 41-47`
- **Issue:** Native Safari clear + manual handler both fire.
- **Fix:** Guard handler with `value !== ''` and `e.preventDefault()`.

## Info

### IN-01: DashboardLayout mojibake in `title` attribute

- **File:** `src/layouts/DashboardLayout.tsx:19, 139`
- **Issue:** `â€"` (bad em-dash) in `title={`${item.label} â€" Coming soon`}`. Screen readers will read the garbage.
- **Fix:** Replace with proper em-dash `—`.

### IN-02: DashboardLayout uses `role="menu"` without keyboard handlers

- **File:** `src/layouts/DashboardLayout.tsx:173-187`
- **Issue:** `role="menu"` creates an ARIA contract (Arrow keys / Esc / Home / End) that's not implemented.
- **Fix:** Either implement handlers or drop the role in favor of `aria-expanded` popover pattern.

### IN-03: SortIndicator prop type tight but silently accepts `true`

- **File:** `src/components/SortIndicator.tsx:11-21`
- **Issue:** Contract mismatch possibility if caller forgets narrowing. Not a bug today.
- **Fix:** None required; documentation via types.

### IN-04: format.ts mixes em-dash (EMPTY) and en-dash (range sep) — fragile

- **File:** `src/lib/format.ts:34, 80-82`
- **Fix:** Extract both as named constants with comments explaining the distinction.

### IN-05: SalesTable module augmentation phantom generics

- **File:** `src/components/SalesTable.tsx:53-61`
- **Issue:** `_phantomData?: TData` pattern works but pollutes autocomplete.
- **Fix:** Keep as-is OR follow DepartmentTable's inline-cast pattern for consistency.

### IN-06: TableSkeleton uses array index for keys

- **File:** `src/components/TableSkeleton.tsx:24-34`
- **Issue:** Fine here (fixed-length), but trips strict react/no-array-index-key.
- **Fix:** `key={`row-${i}`}` documents intent.

### IN-07: SaleNotFound + ErrorState use `role="alert"` on heading

- **File:** `src/pages/SaleNotFound.tsx:21-25`; `src/components/ErrorState.tsx:17-22`
- **Issue:** Override of `<h1>` heading semantics by `role="alert"` may confuse AT document-structure navigation.
- **Fix:** Keep heading semantics, add a separate `sr-only role="alert"` div.

### IN-08: Virtualized tab order drops rows outside viewport+overscan

- **File:** `src/components/SalesTable.tsx:202`
- **Issue:** Known limitation of virtualization.
- **Fix:** No code change. UI-SPEC already acknowledges. Future: Arrow-key row nav.

### IN-09: useSale destructuring assumes only sale_departments embed

- **File:** `src/hooks/useSale.ts:59-62`
- **Fix:** Narrow cast + explicit type:
```ts
const { sale_departments = [], ...rest } = data as Sale & { sale_departments: SaleDepartment[] | null };
return { status: 'ok', sale: rest as Sale, departments: sale_departments ?? [] };
```

### IN-10: ValidationWarningBanner uses straight apostrophe

- **File:** `src/components/ValidationWarningBanner.tsx:46`
- **Issue:** Cosmetic consistency with UI-SPEC typographic decisions.
- **Fix:** Optional — confirm UI-SPEC source text.

## Positive Observations

- XSS surface closed (no dangerouslySetInnerHTML, no innerHTML, all values flow through React children)
- Query keys stable and parameterized
- Null-safety in formatters
- 404 via `.maybeSingle()` + discriminated union
- Parameterized `.eq()` (no SQL injection, no ReDoS)
- RLS reliance documented
- Dept table correctly read-only (no hover/tabIndex/click)
- `motion-safe:animate-pulse` for reduced-motion

## Severity Counts

| Severity | Count |
|----------|-------|
| Critical | 0     |
| Warning  | 9     |
| Info     | 10    |
| **Total**| **19**|
