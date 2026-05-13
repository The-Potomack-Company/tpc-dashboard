---
phase: 03
plan: 01
subsystem: sale-views
tags:
  - tanstack-query
  - tanstack-table
  - tanstack-virtual
  - formatters
  - intl
  - ui-spec
wave: 1
depends_on: []
dependency_graph:
  requires: []
  provides:
    - "src/lib/format.ts — shared Intl formatters + EMPTY em-dash constant"
    - "src/hooks/useSales.ts — sales list query hook (['sales'], 5min staleTime)"
    - "src/hooks/useSale.ts — single-sale + departments hook (embedded resource, one round trip)"
    - "@tanstack/react-table + @tanstack/react-virtual deps"
    - "UI-SPEC payment_status section (enum-only, no tooltip)"
  affects:
    - "All Wave 2-4 plans can now import the format helpers and the two hooks"
tech-stack:
  added:
    - "@tanstack/react-table@^8.21.3"
    - "@tanstack/react-virtual@^3.13.24"
  patterns:
    - "PostgREST embedded-resource query for single-round-trip detail fetch"
    - "Intl.NumberFormat / Intl.DateTimeFormat instances allocated once at module scope"
    - "TanStack Query hooks with staleTime overrides that inherit the QueryClient defaults for retry/refetchOnWindowFocus"
    - "TDD (RED → GREEN) commit split for tests vs implementation"
key-files:
  created:
    - path: src/lib/format.ts
      purpose: "Shared formatters (currency, percent, count, date, estimate range, payment status) + EMPTY constant"
    - path: src/hooks/useSales.ts
      purpose: "useSales() — TanStack Query hook keyed ['sales']"
    - path: src/hooks/useSale.ts
      purpose: "useSale(saleNumber) — embedded-resource hook keyed ['sale', saleNumber]"
    - path: src/tests/format.test.ts
      purpose: "28 unit tests covering every formatter behavior contract"
    - path: src/tests/use-sales.test.tsx
      purpose: "3 contract tests for useSales (key, sort, error, null-data default)"
    - path: src/tests/use-sale.test.tsx
      purpose: "5 contract tests for useSale (ok / not_found / error / enabled:false / null sale_departments)"
  modified:
    - path: .planning/phases/03-sale-views/03-UI-SPEC.md
      purpose: "Payment status tile row (line 275) + resolution paragraph (line 279) updated per OQ1 — enum-only rendering, no title tooltip, no JSON counts"
    - path: package.json
      purpose: "Added @tanstack/react-table@^8.21.3 and @tanstack/react-virtual@^3.13.24 to dependencies"
    - path: package-lock.json
      purpose: "Lockfile update for the two new deps and their transitive closure"
decisions:
  - summary: "Render payment_status as a bare human-cased label (Paid / Partial / Unpaid / em-dash); drop the legacy title tooltip and JSON counts references from UI-SPEC."
    rationale: "OQ1 resolution — Phase 2 shipped sales.payment_status as a bare enum string, not JSON counts. Keeping the old tooltip guidance would invite dangerouslySetInnerHTML or JSON.parse on an enum."
  - summary: "Use the single embedded-resource PostgREST query for useSale (one round trip) rather than parallel sale-then-departments fetches."
    rationale: "One cache entry, one HTTP call, native 404 via maybeSingle(), no UI flicker. Recommended variant in 03-RESEARCH.md Pattern 3."
  - summary: "formatPercent accepts a 0..1 ratio (not a 0..100 percentage)."
    rationale: "The sales list computes sell-through as lots_sold/lots_auctioned already-ratioed; sale_departments.sell_through_pct (0-100) must be divided by 100 at the caller. Documented inline in format.ts."
  - summary: "EMPTY = U+2014 em-dash; formatEstimateRange separator = U+2013 en-dash."
    rationale: "Two visually-similar but semantically distinct codepoints. EMPTY signals 'missing'; the range en-dash signals 'through'. Tests pin both explicitly."
metrics:
  tasks_planned: 3
  tasks_completed: 3
  commits: 5
  tests_added: 36
  tests_total_passing: 132
  completed_date: "2026-04-22"
---

# Phase 03 Plan 01: Wave 1 Foundation Summary

Wave 1 foundation: installed TanStack Table v8 + TanStack Virtual v3, shipped the shared `Intl`-based formatter module with the em-dash/en-dash codepoint contract, wired the two TanStack Query hooks (sales list, embedded-resource single-sale) that Waves 2-4 consume, and amended the UI-SPEC payment_status section so Wave 3's KPI summary card renders the bare enum instead of the never-shipped JSON counts.

## What Was Built

### Task 1 — Dependencies + UI-SPEC amendment

- `npm install @tanstack/react-table@^8.21.3 @tanstack/react-virtual@^3.13.24` (both MIT, both ship TS types; no `@types/*` needed).
- `package.json` `dependencies` now lists both under their pinned minor ranges; `package-lock.json` resolved the full transitive closure (+334 packages, no vulnerabilities).
- `03-UI-SPEC.md` amended (lines 275 + 279) to reflect OQ1's Option A:
  - **Payment status tile row** now: `Label only — human-formatted enum string (Paid, Partial, Unpaid, —) via formatPaymentStatus(). No tooltip.`
  - **Resolution paragraph** now documents that Phase 2 shipped the column as a bare enum (`'paid' | 'partial' | 'unpaid' | null`) and explicitly forbids `JSON.parse(payment_status)` or `title`-attribute tooltips. Reassessment hook left in for Phase 5+.

Commit: `dd6c126` — `chore(03-01): install TanStack Table + Virtual and amend UI-SPEC payment_status`.

### Task 2 — `src/lib/format.ts` (TDD)

Seven exports, all null/undefined-safe, all pinned by 28 behavior tests.

| Export | Contract |
|--------|----------|
| `EMPTY` | `"—"` exactly (em-dash). Tests explicitly reject `-`, `–` (en-dash), and `"N/A"`. |
| `formatCurrency(value)` | `Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })`. `1234567.89 → "$1,234,567.89"`, `null/undefined → EMPTY`. |
| `formatPercent(ratio)` | Accepts 0..1 ratio, emits 1-decimal percent. `0.684 → "68.4%"`, `1 → "100.0%"`, `0 → "0.0%"`. |
| `formatCount(value)` | Thousands-grouped integer formatter. `1247 → "1,247"`, `0 → "0"`. |
| `formatDate(isoDate)` | `Nov 16, 2022` format. Appends `T00:00:00` to avoid TZ shift on date-only ISO. NaN-safe (`"not-a-date" → EMPTY`). |
| `formatEstimateRange(low, high)` | `$low – $high` with U+2013 en-dash separator. Single-sided fallback; both null → EMPTY. |
| `formatPaymentStatus(value)` | `PAYMENT_STATUS_LABELS` map: `paid → Paid`, `partial → Partial`, `unpaid → Unpaid`. Anything else (null, undefined, `'garbage'`, any future enum value we don't know) → EMPTY. Defensive by design. |

TDD split: `8b823f0` commits the 28 failing tests; `55e3aa1` commits the implementation that turns them green.

### Task 3 — `useSales` + `useSale` hooks (TDD)

```ts
// src/hooks/useSales.ts
useQuery<Sale[]>({
  queryKey: ['sales'],
  staleTime: 5 * 60_000,
  queryFn: async () => {
    const { data, error } = await supabase
      .from('sales').select('*')
      .order('sale_date', { ascending: false, nullsFirst: false });
    if (error) throw error;
    return data ?? [];
  },
});
```

```ts
// src/hooks/useSale.ts
useQuery<SaleDetail>({
  queryKey: ['sale', saleNumber],
  staleTime: 5 * 60_000,
  enabled: Boolean(saleNumber),
  queryFn: async () => {
    const { data, error } = await supabase
      .from('sales')
      .select(`*, sale_departments ( *, department:departments ( code, display_name, auto_discovered ) )`)
      .eq('sale_number', saleNumber)
      .maybeSingle();
    if (error) throw error;
    if (!data) return { status: 'not_found' };
    const { sale_departments, ...sale } = data;
    return { status: 'ok', sale, departments: sale_departments ?? [] };
  },
});
```

`SaleDetail` is a discriminated union: `{ status: 'ok', sale, departments } | { status: 'not_found' }`. Consumers branch on `.status` before reading `.sale` / `.departments`.

TDD split: `47e9081` commits 8 failing hook tests; `0fe840b` commits the two hook modules. Tests cover query keys, sort order, error propagation, null-data default, embedded-resource shape transformation (sale/departments split), 404 branch, `enabled: false` when `saleNumber` is empty, and null `sale_departments` coalesce.

## Tests Added + Passing

| File | Tests | Pass |
|------|-------|------|
| `src/tests/format.test.ts` | 28 | 28 |
| `src/tests/use-sales.test.tsx` | 3 | 3 |
| `src/tests/use-sale.test.tsx` | 5 | 5 |
| **Plan total** | **36** | **36** |
| Full suite (16 files) | 132 | 132 |

No regressions in Phase 1 / Phase 2 tests.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Test infrastructure bug] Shared chain mock leaked across tests**

- **Found during:** Task 3 GREEN run.
- **Issue:** In `src/tests/use-sale.test.tsx`, the 4th test (`enabled: false`) called `maybeSingleMock.mockResolvedValueOnce(...)`, but because the hook is disabled, the mock value wasn't consumed — it stayed queued and was handed to the next test's `maybeSingle` call via FIFO, which caused the 5th test to see `{ data: null }` instead of the sale payload it queued.
- **Fix:** Removed the unused `mockResolvedValueOnce` from the 4th test; added a comment explaining why queuing a response would mask real bugs. Also moved to a shared-chain object with `beforeEach` re-installing `mockImplementation` after `vi.clearAllMocks()` wipes it.
- **Files modified:** `src/tests/use-sale.test.tsx` (test-only, no hook code touched).
- **Commit:** Fix landed inside `47e9081` + `0fe840b` together.

### Design-level deviations

None. Plan executed exactly as written. OQ1, OQ2, OQ3 resolutions were all honored.

## Self-Check: PASSED

- **Files verified to exist:**
  - `FOUND: src/lib/format.ts`
  - `FOUND: src/hooks/useSales.ts`
  - `FOUND: src/hooks/useSale.ts`
  - `FOUND: src/tests/format.test.ts`
  - `FOUND: src/tests/use-sales.test.tsx`
  - `FOUND: src/tests/use-sale.test.tsx`
- **Commits verified via `git log --oneline`:**
  - `FOUND: dd6c126` (Task 1 — deps + UI-SPEC)
  - `FOUND: 8b823f0` (Task 2 RED)
  - `FOUND: 55e3aa1` (Task 2 GREEN)
  - `FOUND: 47e9081` (Task 3 RED)
  - `FOUND: 0fe840b` (Task 3 GREEN)
- **Acceptance criteria from plan:**
  - `@tanstack/react-table@^8.21.3` + `@tanstack/react-virtual@^3.13.24` present in package.json dependencies — VERIFIED via `node -e` check.
  - `formatPaymentStatus` appears twice in `03-UI-SPEC.md` (table row + resolution paragraph) — VERIFIED.
  - Stale references (`JSON counts`) removed from UI-SPEC — VERIFIED (grep returned 0).
  - `src/lib/format.ts` has 7 top-level `^export` lines — VERIFIED.
  - `queryKey: ['sales']`, `queryKey: ['sale', saleNumber]`, `5 * 60_000`, `enabled: Boolean(saleNumber)`, `status: 'not_found'` — each grep returned expected counts.
  - `npx vitest --run` exits 0 with 132/132 tests passing — VERIFIED.
  - `npm run build` succeeds (`tsc -b && vite build`) — VERIFIED.
  - `npm run lint` — 0 errors. 1 pre-existing warning in `src/stores/authStore.ts:65` (unused eslint-disable directive in Phase 1 code) — out of scope for this plan.
