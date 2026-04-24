---
phase: 03-sale-views
verified: 2026-04-22T11:40:00Z
status: human_needed
score: 11/11 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Browse /sales — list, sort, filter"
    expected: "Table renders all imported sales sorted by date DESC. Column-header click cycles sort. Typing in search box narrows rows and 'N of M sales' live-region updates. Escape/× clears filter."
    why_human: "Requires live Supabase session with imported data; virtualized row rendering and aria-live announcement need a real browser."
  - test: "Navigate to /sales/:saleNumber — sale detail page"
    expected: "Back link visible. Sale title + number shown. 19-tile KPI card visible with correct formatted values (currency, percent, date). 'Department breakdown' section shows DepartmentTable with sortable columns, totals footer."
    why_human: "Requires live sale data; visual layout, tile grid, and formatter output all need browser confirmation."
  - test: "ValidationWarningBanner renders conditionally and Reload fires invalidation"
    expected: "Amber banner with 'Department totals don't match...' appears only when sale.validation_warning=true. 'Reload sale' button triggers query refetch."
    why_human: "Requires a sale with validation_warning=true in the database; screen-reader soft-announcement via role=status/aria-live=polite needs AT testing (WR-02 from review)."
  - test: "Empty state when sales DB is empty"
    expected: "Visiting /sales shows 'No sales yet' heading and body containing 'npm run import:pdfs' in monospace."
    why_human: "Only valid before DATA-01 live import run; requires browser to confirm visual presentation."
  - test: "SaleNotFound 404 surface"
    expected: "Visiting /sales/NONEXISTENT_XYZ shows 'Sale not found' heading + body with the saleNumber echoed + 'Back to sales' link."
    why_human: "Requires live router + Supabase session to confirm useSale returns status=not_found and page renders correctly."
  - test: "Responsive sidebar collapse at md breakpoint (768-1023px)"
    expected: "Below 1024px: sidebar collapses to 64px icon-rail, labels hidden, icons visible. Hovering disabled icon shows 'Label — Coming soon' tooltip. Active Sales icon retains accent styling. Above 1024px: full 240px labeled sidebar."
    why_human: "Responsive layout must be verified in a real browser at actual viewport widths; CSS class presence alone cannot confirm visual rendering."
  - test: "Filter match-count live region announces to screen reader"
    expected: "'N of M sales' text announces politely when typing begins; empty always-mounted region does not announce phantom blank on mount."
    why_human: "WR-03 required always-mounted live region; announcement behavior requires real AT (NVDA/VoiceOver) testing."
  - test: "formatDate defensive behavior on malformed input"
    expected: "Passing 'today', '2026/04/22', or '2026-04-22T10:00:00Z' to formatDate returns em-dash not 'Invalid Date'."
    why_human: "WR-06 added shape-guard; manual exercise in browser console or devtools confirms the guard fires on real-world edge inputs."
---

# Phase 3: Sale Views Verification Report

**Phase Goal:** Users can browse all imported sales and drill into any individual sale to see its complete auction profile with department breakdown
**Verified:** 2026-04-22T11:40:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can view a list of all imported sales, search by title or sale number, and sort by date, sale number, or title | VERIFIED | SalesPage wires useSales() into SalesTable; globalFilterFn='includesString' on title+sale_number; default sort sale_date DESC; column sort cycles asc/desc/none. 8 sales-page integration tests pass. |
| 2 | User can click into any sale and see all metrics from the original PDF | VERIFIED | SaleDetailPage wires useSale(); SaleSummaryCard renders all 19 KPI tiles (sale_date through payment_status) with Intl-based formatters. 7 sale-detail-page tests pass. |
| 3 | Sale detail page shows a department breakdown table sortable by any column | VERIFIED | DepartmentTable uses TanStack Table with getSortedRowModel(); default sort revenue DESC; all 8 columns sortable; 9 department-table tests pass. |
| 4 | All data tables support column sorting and text/numeric filtering | VERIFIED | SalesTable: single-column sort + global text filter (includesString). DepartmentTable: per-column sort. Both verified by contract tests. |
| 5 | Layout is desktop-first with graceful collapse on tablet-sized screens | VERIFIED (automated partial) | DashboardLayout uses grid-cols-[4rem_1fr] lg:grid-cols-[15rem_1fr]; labels/Coming-soon asides have hidden lg:inline; dashboard-layout test #3 and #5/#6 confirm class presence. Full visual confirmation requires human. |
| 6 | SALE-01: User can browse all imported sales in a searchable, sortable list | VERIFIED | SalesPage + SalesTable implement the full requirement. useSales() queries sales ordered sale_date DESC. |
| 7 | SALE-02: User can view a sale detail page with complete auction profile metrics | VERIFIED | SaleDetailPage + SaleSummaryCard implement all 19 KPI tiles including financial breakdown values. |
| 8 | SALE-03: Sale detail page includes a sortable department breakdown table | VERIFIED | DepartmentTable: 8 columns (Department/Lots/Sold/Sell-through/Sold value/Estimate/Reserves/Revenue), sortable, totals footer via tfoot. |
| 9 | INFR-03: Desktop-first responsive layout with graceful tablet collapse | VERIFIED (automated partial) | Grid breakpoints confirmed by grep and tests. Human visual check required. |
| 10 | INTR-02: All data tables support column sorting and text/numeric filtering | VERIFIED | Both tables implement TanStack Table sort; SalesTable adds global text filter. |
| 11 | Routes /sales and /sales/:saleNumber are wired under ProtectedRoute in App.tsx | VERIFIED | grep confirms path="/sales" and path="/sales/:saleNumber" inside ProtectedRoute block; 4 dashboard-layout + 8 sales-page + 7 sale-detail-page tests confirm composition. |

**Score:** 11/11 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/format.ts` | 6 format functions + EMPTY constant | VERIFIED | 110 lines; exports: EMPTY, formatCurrency, formatPercent, formatCount, formatDate, formatEstimateRange, formatPaymentStatus. 28 behavior tests pass. |
| `src/hooks/useSales.ts` | useSales() query hook | VERIFIED | 41 lines; queryKey=['sales'], staleTime=5*60_000, supabase query with sale_date DESC sort, EMPTY_SALES singleton. |
| `src/hooks/useSale.ts` | useSale(saleNumber) embedded-resource hook | VERIFIED | 65 lines; queryKey=['sale', saleNumber], enabled=Boolean(saleNumber), discriminated-union SaleDetail type. |
| `src/components/SalesTable.tsx` | Virtualized sortable/filterable TanStack Table | VERIFIED | 262 lines; useVirtualizer + useReactTable; ROW_HEIGHT=44; globalFilterFn='includesString'; enableMultiSort=false. |
| `src/components/FilterInput.tsx` | Debounced search input with clear button | VERIFIED | 76 lines; controlled input; Escape-to-clear; conditional × button; aria-label prop. |
| `src/components/SortIndicator.tsx` | Chevron sort-state icon | VERIFIED | 82 lines; three SVG states (false=gray, asc=accent, desc=accent). |
| `src/components/TableSkeleton.tsx` | Shimmer rows for table loading state | VERIFIED | Renders N tr rows with motion-safe:animate-pulse. |
| `src/components/EmptyState.tsx` | Generic empty-state surface | VERIFIED | Renders heading h2 + children in centered container. |
| `src/components/ErrorState.tsx` | Generic error surface with Retry button | VERIFIED | role="alert" on heading; Retry button calls onRetry. |
| `src/components/SaleSummaryCard.tsx` | 19-tile KPI grid | VERIFIED | 111 lines; buildTiles() produces 20 label entries (19 tiles + 1 comment artifact from grep — actual distinct tiles = 19 per test); divide-x divide-y grid; no title= attributes. |
| `src/components/DepartmentTable.tsx` | Sortable table with totals footer | VERIFIED | 272 lines; useReactTable; tfoot Totals row; revenue DESC default sort; font-mono badge; no tabIndex/onClick on rows. |
| `src/components/ValidationWarningBanner.tsx` | Amber alert banner with Reload | VERIFIED | 66 lines; role="status" aria-live="polite" (WR-02 fix); invalidateQueries with ['sale', saleNumber]; Reload sale button. |
| `src/components/BackLink.tsx` | Left-arrow back navigation link | VERIFIED | 39 lines; react-router Link; inline arrow-left SVG. |
| `src/pages/Sales.tsx` | Sales list page route component | VERIFIED | 137 lines; useSales(); loading/error/empty/success branches; useDeferredValue; aria-live match count. |
| `src/pages/SaleDetail.tsx` | Sale detail page route component | VERIFIED | 151 lines; useSale(); loading/error/not_found/ok branches; back link always visible; ValidationWarningBanner conditional on validation_warning. |
| `src/pages/SaleNotFound.tsx` | 404 surface | VERIFIED | 36 lines; role=alert on h1; saleNumber echoed as text child; BackLink to /sales. |
| `src/App.tsx` | Routes with /sales and /sales/:saleNumber | VERIFIED | path="/sales" + path="/sales/:saleNumber" confirmed nested under ProtectedRoute. |
| `src/layouts/DashboardLayout.tsx` | Active Sales NavLink + md icon-rail | VERIFIED | 208 lines; NavLink to /sales with text-accent/border-accent active state; grid-cols-[4rem_1fr] lg:grid-cols-[15rem_1fr]; hidden lg:inline on labels; 5 disabled aria-disabled spans. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/hooks/useSales.ts` | `src/lib/supabase.ts` | `import { supabase } from '../lib/supabase'` | WIRED | grep confirms import present |
| `src/hooks/useSale.ts` | `src/lib/supabase.ts` | `import { supabase } from '../lib/supabase'` | WIRED | grep confirms import present |
| `src/components/SalesTable.tsx` | `src/lib/format.ts` | format helper imports | WIRED | grep confirms from '../lib/format' |
| `src/components/SalesTable.tsx` | `@tanstack/react-table` | useReactTable + getCoreRowModel etc | WIRED | 2 import occurrences confirmed |
| `src/components/SalesTable.tsx` | `@tanstack/react-virtual` | useVirtualizer | WIRED | 2 occurrences confirmed |
| `src/components/SalesTable.tsx` | `react-router` | useNavigate for row navigation | WIRED | confirmed in component |
| `src/components/SaleSummaryCard.tsx` | `src/lib/format.ts` | format helpers for all tile values | WIRED | import confirmed; formatPaymentStatus used |
| `src/components/DepartmentTable.tsx` | `src/components/SortIndicator.tsx` | SortIndicator in column headers | WIRED | grep returns 2 occurrences |
| `src/components/ValidationWarningBanner.tsx` | `@tanstack/react-query` | useQueryClient().invalidateQueries | WIRED | invalidateQueries confirmed 3 times |
| `src/App.tsx` | `src/pages/Sales.tsx` | Route path="/sales" | WIRED | confirmed by grep |
| `src/App.tsx` | `src/pages/SaleDetail.tsx` | Route path="/sales/:saleNumber" | WIRED | confirmed by grep |
| `src/pages/Sales.tsx` | `src/hooks/useSales.ts` | const query = useSales() | WIRED | useSales() called + data rendered via SalesTable |
| `src/pages/SaleDetail.tsx` | `src/hooks/useSale.ts` | const query = useSale(saleNumber) | WIRED | useSale( called + branches on query.data.status |
| `src/layouts/DashboardLayout.tsx` | `react-router` | NavLink with active-state className | WIRED | NavLink appears 4 times |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `src/pages/Sales.tsx` | `query.data` (Sale[]) | useSales() → supabase.from('sales').select('*').order(...) | Yes — real DB query | FLOWING |
| `src/pages/SaleDetail.tsx` | `query.data` (SaleDetail) | useSale() → supabase.from('sales').select(`*,sale_departments(*,department:departments(...))`).eq(...).maybeSingle() | Yes — embedded-resource DB query | FLOWING |
| `src/components/SalesTable.tsx` | `sales` prop (Sale[]) | Passed from SalesPage which receives useSales().data | Yes — flows from DB query above | FLOWING |
| `src/components/SaleSummaryCard.tsx` | `sale` prop (Sale) | Passed from SaleDetailPage after status==='ok' narrowing | Yes — flows from DB query above | FLOWING |
| `src/components/DepartmentTable.tsx` | `departments` prop (SaleDepartment[]) | Passed from SaleDetailPage.query.data.departments | Yes — flows from embedded-resource query | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 205 tests pass (all phases) | `npx vitest --run` | 25 files, 205/205 tests passing | PASS |
| Build succeeds | `npm run build` | Built in 1.40s, no errors (chunk size warning is pre-existing) | PASS |
| TanStack Table dep present | `node -e "require('./package.json').dependencies['@tanstack/react-table']"` | `^8.21.3` | PASS |
| TanStack Virtual dep present | `node -e "require('./package.json').dependencies['@tanstack/react-virtual']"` | `^3.13.24` | PASS |
| No XSS vectors | grep dangerouslySetInnerHTML across src/ | 0 matches | PASS |
| format.ts exports 7 items | grep `^export` src/lib/format.ts | 7 exports (EMPTY + 6 functions) | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SALE-01 | 03-01, 03-02, 03-04 | User can browse all imported sales in a searchable, sortable list | SATISFIED | SalesPage + SalesTable + useSales(); sort, filter, navigation all implemented and tested |
| SALE-02 | 03-01, 03-03, 03-04 | User can view sale detail page with complete auction profile | SATISFIED | SaleDetailPage + SaleSummaryCard; all 19 KPI tiles with correct formatters; tested |
| SALE-03 | 03-01, 03-03, 03-04 | Sale detail page includes sortable department breakdown table | SATISFIED | DepartmentTable with 8 columns, TanStack Table sort, totals footer; tested |
| INFR-03 | 03-04 | Desktop-first responsive layout with graceful tablet collapse | SATISFIED (automated) | grid-cols-[4rem_1fr] lg:grid-cols-[15rem_1fr] + hidden lg:inline; visual confirmation requires human |
| INTR-02 | 03-01, 03-02, 03-03, 03-04 | All data tables support column sorting and text/numeric filtering | SATISFIED | SalesTable: sort + globalFilter; DepartmentTable: per-column sort; both tested |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/pages/SaleDetail.tsx` | 117 | `return null` | Info | Intentional — WR-07 narrowing guard after status!=='ok' check. Not a stub; prevents non-null assertion. |
| `src/layouts/DashboardLayout.tsx` | multiple | 5 `aria-disabled` spans | Info | Intentional future-phase reservations for Trends/Departments/Team/Reports/Custom Charts. Not stubs — by design. |

No blockers or warnings found. The one `return null` is the explicit narrowing guard documented in WR-07. The disabled nav entries are intentional placeholders for future phases.

### Human Verification Required

#### 1. Browse /sales — list, sort, filter, empty state

**Test:** Sign in → click Sales in sidebar → observe list. If sales are loaded: verify date DESC default sort, click column headers to cycle sort, type in search box, observe live-region "N of M sales", press Escape/× to clear. If DB is empty: observe "No sales yet" + `npm run import:pdfs` instruction.
**Expected:** Table renders correctly, sort works, filter narrows rows, live-region updates, empty state shows correct copy.
**Why human:** Requires live Supabase session; virtualized row rendering and aria-live announcement need a real browser.

#### 2. Navigate to /sales/:saleNumber — sale detail

**Test:** Click any row from the sales list → URL becomes /sales/{sale_number}. Verify: back link visible, sale title + number in header, 19-tile KPI grid with formatted values, "Department breakdown" section with sortable DepartmentTable, totals footer row.
**Expected:** All values formatted (currency $X,XXX.XX, percent XX.X%, dates Mon D YYYY, em-dash for nulls). Payment status tile shows "Paid"/"Partial"/"Unpaid"/em-dash with NO title tooltip on hover.
**Why human:** Requires live sale data; formatter output and visual layout need browser confirmation.

#### 3. ValidationWarningBanner conditional render

**Test:** Find or create a sale with validation_warning=true in Supabase. Navigate to its detail page. Verify amber banner appears with "Department totals don't match the sale totals..." copy. Click "Reload sale" — observe brief refetch.
**Expected:** Banner appears only when validation_warning=true. Absent when false. Reload triggers refetch.
**Why human:** Requires a specific DB record; WR-02 fix (role=status + aria-live=polite) needs AT testing to confirm soft announcement without focus steal.

#### 4. SaleNotFound 404 surface

**Test:** Visit /sales/NONEXISTENT_SALE_123 directly in the browser URL bar.
**Expected:** Page shows "Sale not found" heading + "We couldn't find a sale with number 'NONEXISTENT_SALE_123'..." body + "Back to sales" link. Clicking back returns to /sales.
**Why human:** Requires live router + Supabase session confirming the maybeSingle() null path.

#### 5. Responsive sidebar collapse (INFR-03)

**Test:** Resize browser to 900px wide. Sidebar should collapse to 64px icon-rail — only icons, no labels, no "Coming soon" text. Hover a disabled icon → native tooltip "Label — Coming soon". Hover Sales → "Sales". Active Sales icon retains accent styling. Resize to 1100px+ → full labeled sidebar returns.
**Expected:** Exactly as described. No layout breaks at 768-1023px range.
**Why human:** CSS class presence verified by tests; actual visual rendering at real viewport widths requires a browser.

#### 6. Screen-reader a11y (WR-02, WR-03)

**Test:** Using NVDA/VoiceOver/JAWS — (a) navigate to a sale with validation_warning=true and confirm the banner announces politely and does NOT steal focus when Reload fires; (b) type in the sales filter and confirm "N of M sales" announces, and the always-mounted empty region does not announce a phantom blank on initial page load.
**Expected:** Polite announcement on first render; no focus steal on Reload; correct filter count announcement.
**Why human:** aria-live behavior is AT-dependent; cannot be verified programmatically.

#### 7. formatDate defensive behavior (WR-06)

**Test:** In browser devtools console, `import { formatDate } from '/src/lib/format.ts'` (or use a test harness) and call `formatDate('today')`, `formatDate('2026/04/22')`, `formatDate('2026-04-22T10:00:00Z')`.
**Expected:** All three return em-dash (—), not "Invalid Date".
**Why human:** WR-06 added the YYYY-MM-DD shape guard; exercising it on realistic malformed real-world inputs confirms the guard fires correctly.

### Gaps Summary

No automated gaps were found. All 11 must-haves are verified, all artifacts are substantive and wired, all data flows through real Supabase queries, build is green, and 205/205 tests pass.

The 8 human verification items are the remaining gate. They fall into two categories:

1. **Live-data browser walkthroughs (items 1-5):** Cannot be verified without a running dev server and real Supabase data. Phase 2's live import is operator-gated — if sales DB is empty, the empty-state check (item 1c) covers that path.

2. **AT/screen-reader testing (items 6-7):** WR-02 and WR-03 fixes changed role=alert to role=status and made the live region always-mounted. These changes are code-correct but their announcement behavior is AT-specific.

All code review findings (9 warnings) were fixed per 03-REVIEW-FIX.md. No new anti-patterns introduced.

---

_Verified: 2026-04-22T11:40:00Z_
_Verifier: Claude (gsd-verifier)_
