---
phase: 06-department-analysis-sale-comparison
plan: 05
subsystem: ui, charts

tags:
  - recharts
  - waterfall
  - collapsible
  - a11y
  - tdd
  - vitest

# Dependency graph
requires:
  - phase: 03-sale-views
    provides: src/pages/SaleDetail.tsx (existing page) + SaleSummaryCard + DepartmentTable + BackLink + useSale hook
  - phase: 05-trend-analysis
    provides: ChartCard surface tokens (p-6 rounded-lg border bg-white) + CHART_PALETTE / CHART_GRID_STROKE / CHART_AXIS_TICK_FILL from src/lib/chart-colors.ts
  - phase: 06-01
    provides: src/lib/waterfall.ts — transformToWaterfall(sale) + WaterfallRow + WaterfallDirection types

provides:
  - src/components/RevenueWaterfallChart.tsx — SALE-06 waterfall chart body
  - Collapsible Revenue Breakdown section on /sales/:saleNumber — completes Sale Detail page

affects:
  - Phase 6 Plan 06 (Phase Review / UAT) — Revenue Breakdown is the final anchor on the Sale Detail surface

# Tech tracking
tech-stack:
  added: []  # no new packages — Recharts, EmptyState, waterfall helper all pre-existing
  patterns:
    - "Recharts transparent-padding-bar waterfall: invisible <Bar dataKey='base' fill='transparent'> stacked under <Bar dataKey='delta'> with per-row <Cell> colors keyed to direction"
    - "isAnimationActive={false} on BOTH bars (critical — avoids first-frame flash where delta animates from y=0 before the base-bar offset is applied)"
    - "Inline tooltip component (WaterfallTooltip) reading payload[0].payload.direction for sign prefix + running-total suppression on start/end steps — shared ChartTooltip not reused because each hover has TWO payload entries (base + delta) but UI-SPEC requires one tooltip row per step"
    - "Inline card (not <ChartCard>) for collapsible sections where collapsed state must unmount the body — ChartCard always emits h-80 body div which would leave 320px of empty space when collapsed"
    - "Native <button> chevron toggle → free Enter/Space semantics; aria-expanded + aria-label both flip on state; SVG rotate-180 + transition-transform duration-200 on expand"
    - "View-local UI state: useState initializes false on every mount → every /sales/:saleNumber visit starts collapsed (deep-link opt-in deliberately out of scope per UI-SPEC § Interaction Contract line 444)"

key-files:
  created:
    - src/components/RevenueWaterfallChart.tsx
    - src/components/RevenueWaterfallChart.test.tsx
  modified:
    - src/pages/SaleDetail.tsx (imports + useState + new <section> after Department Table)
    - src/tests/sale-detail-page.test.tsx (4 new tests + module-level mock for RevenueWaterfallChart)

decisions:
  - "Inline card over ChartCard composition — collapsed state requires header-only (44px h-11) with chart body fully unmounted; ChartCard's always-on `<div className='mt-4 h-80'>{children}</div>` body slot would leave empty 320px. Inline mirrors ChartCard's surface tokens verbatim (p-6 rounded-lg border bg-white dark:bg-gray-900)."
  - "Inline tooltip over shared ChartTooltip — each Recharts hover payload contains TWO entries (base + delta) for stacked bars, but UI-SPEC requires ONE tooltip row per step showing fullLabel + signed delta + running total (with running-total suppressed on start/end). Reading payload[0].payload directly and branching on row.direction is cleaner than a payloadFilter prop."
  - "COLOR_BY_DIRECTION lookup table (start/end=blue-600, up=emerald-600, down=rose-600) using named CHART_PALETTE indices rather than hex literals — makes the choice grep-auditable against the UI-SPEC § Waterfall color rules table."
  - "Module-level vi.mock for RevenueWaterfallChart in sale-detail-page.test.tsx — keeps the page-composition tests focused on collapsible + aria semantics without double-testing the chart (which has its own test file). Mock renders role='img' with sale_number in aria-label so the expand assertion can query it stably."
  - "Deep-link opt-in (URL param / localStorage for expanded state) is NOT implemented — per UI-SPEC line 444 the expansion is view-local and every visit starts collapsed. Rationale: avoids accumulating minor view-state params in URLs; the expand action is a one-click cost."

metrics:
  duration: ~26 min (both tasks, including Task 1 RED→GREEN from the preceding continuation slot)
  completed: 2026-04-23

# Requirement traceability
requirements:
  SALE-06: "Revenue Breakdown collapsible section on Sale Detail — RevenueWaterfallChart + chevron toggle, collapsed by default."
  INTR-03: "Waterfall tooltip shows step fullLabel + signed delta currency + running-total line (suppressed on start/end)."
---

# Phase 6 Plan 06-05: Revenue Waterfall on Sale Detail Summary

Ships SALE-06 and closes out the Sale Detail page: a collapsible Revenue Breakdown section anchored below the Department Table, built on the Recharts transparent-padding-bar waterfall pattern and fed by Phase 6 Plan 06-01's `transformToWaterfall(sale)` helper.

## What shipped

- **`RevenueWaterfallChart` component** (`src/components/RevenueWaterfallChart.tsx`)
  - Props: `{ sale: Database['public']['Tables']['sales']['Row'] }`.
  - Flow: `rows = transformToWaterfall(sale)` → `null` branch renders EmptyState, else renders the chart.
  - Recharts `<BarChart>` with two stacked `<Bar>` elements:
    - `dataKey="base"` (transparent padding — lifts the visible bar to the running-total floor).
    - `dataKey="delta"` with per-row `<Cell>` colors from `COLOR_BY_DIRECTION`.
  - Both bars use `isAnimationActive={false}` — critical per 06-RESEARCH § Pattern 2 to avoid the first-frame flash where the delta bar would briefly animate from y=0 before the base-bar offset applied.
  - Color mapping:
    | Direction | Color | Palette index |
    |-----------|-------|---------------|
    | `start` | blue-600 (`#2563eb`) | `CHART_PALETTE[0]` |
    | `up` | emerald-600 (`#059669`) | `CHART_PALETTE[1]` |
    | `down` | rose-600 (`#e11d48`) | `CHART_PALETTE[3]` |
    | `end` | blue-600 | `CHART_PALETTE[0]` |
  - Wrapper `<div role="img" aria-label="Revenue breakdown waterfall for sale {sale_number} — net revenue {formatCurrency(net_revenue)}">` for AT.

- **`WaterfallTooltip` (inline, same file)**
  - Reads `payload[0].payload` (Recharts passes TWO entries for stacked bars but both carry the same `WaterfallRow` — we just ignore the second).
  - Header: `row.fullLabel`.
  - Delta line: `{sign}{formatCurrency(row.delta)}` with sign = `+` for `up`, `-` for `down`, empty for `start`/`end`.
  - Running-total line: `Running total: {formatCurrency(row.runningTotal)}` — suppressed on `start` and `end` per UI-SPEC line 394.

- **Empty-state branch**
  - Triggered when `transformToWaterfall(sale)` returns `null` (any of the 7 required financial fields is null).
  - Renders `<EmptyState heading="No revenue breakdown available">` with body `"This sale is missing one or more financial fields needed to render the waterfall."`

- **Collapsible Revenue Breakdown section on `/sales/:saleNumber`** (`src/pages/SaleDetail.tsx`)
  - Appended below the existing Department Table section.
  - State: `const [isWaterfallExpanded, setIsWaterfallExpanded] = useState(false)` — collapsed by default on every mount.
  - Chevron: native `<button>` with:
    - `aria-expanded={isWaterfallExpanded}` (flips `false` ↔ `true`).
    - `aria-label="Expand revenue breakdown"` (collapsed) ↔ `"Collapse revenue breakdown"` (expanded).
    - `aria-controls="revenue-waterfall-body"` wired to the `id` on the body wrapper.
    - Enter/Space come free from `<button>` semantics.
    - SVG `<path d="M5 7.5L10 12.5L15 7.5">` rotates 180° (`rotate-180` class) on expand with `transition-transform duration-200`.
  - Collapsed hint `"Tap to see the path from hammer to net"` sits next to the chevron in the header-right; hidden when expanded.
  - Body (`<div id="revenue-waterfall-body" className="mt-4 h-80">` with `<RevenueWaterfallChart sale={sale} />`) mounts only when expanded — collapsed state has NO body in the DOM, matching UI-SPEC's 44px `h-11` spec.

## Was ChartCard extended with an `actions` slot?

**No — inline card used instead.**

ChartCard already exposes an `action?: ReactNode` slot (singular, not `actions`). It could carry the chevron. However, ChartCard's body markup is fixed: `<div className={`mt-4 ${bodyHeight}`}>{children}</div>`. When collapsed, passing `children={null}` would still render an empty 320px-tall `mt-4 h-80` div, contradicting the UI-SPEC 44px `h-11` collapsed-header spec and breaking the test that asserts the chart body is NOT in the DOM.

Two alternatives were on the table:

1. Extend ChartCard with a `collapsible?` / `defaultCollapsed?` prop pair that conditionally unmounts the body (option a in the plan).
2. Inline a local card mirroring ChartCard's surface tokens exactly (option b in the plan).

Chose **option b** for scope-contained reasons:
- Option a would touch `ChartCard` and its tests, expanding blast radius beyond SALE-06.
- The inline card is ~20 lines of JSX — not a maintenance burden.
- The inline card matches ChartCard's surface verbatim: `p-6 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900`, same `<h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">` heading shape. Visual parity is preserved.

If a second collapsible chart card surfaces later, the refactor to promote this into ChartCard becomes cheap.

## Collapsed-by-default + aria-expanded contract

| State | `aria-expanded` | `aria-label` | Chevron rotation | Body in DOM? | Collapsed hint visible? |
|-------|-----------------|--------------|------------------|--------------|-------------------------|
| Initial / on mount / on navigation to new sale | `"false"` | `"Expand revenue breakdown"` | 0° (no `rotate-180`) | NO | YES |
| After click / Enter / Space | `"true"` | `"Collapse revenue breakdown"` | 180° | YES | NO |

- **View-local state only.** Every visit to `/sales/:saleNumber` starts collapsed. No URL param, no localStorage persistence. Per UI-SPEC § Interaction Contract line 444.
- **Keyboard:** native `<button>` → Enter/Space activate the onClick handler. Tab order: existing Phase 3 order → chevron button → (if expanded) chart body (non-focusable, `role="img"`) → end.
- **Reduced motion:** the chevron rotation uses `transition-transform duration-200` which Tailwind respects via `motion-reduce:transition-none` chain at the framework level; no custom gating needed.

## Null-guard empty-state behavior

`transformToWaterfall(sale)` returns `null` if ANY of the 7 required financial fields is null:
`hammer_total`, `buyer_premium`, `seller_commission`, `insurance`, `lot_charges`, `referral_fees`, `net_revenue`.

When expanded and rows are null:
- The chart wrapper (`role="img"` div + Recharts `<BarChart>`) is NOT rendered.
- An `<EmptyState>` renders inside the body slot:
  - Heading: `"No revenue breakdown available"`.
  - Body: `"This sale is missing one or more financial fields needed to render the waterfall."`
- The card header (title + chevron) stays unchanged — the user can still collapse.

When collapsed and rows would be null:
- Indistinguishable from any other collapsed state. Collapsing hides the empty message; expanding surfaces it.

## Requirement traceability

| REQ-ID | Where satisfied |
|--------|-----------------|
| SALE-06 | `src/components/RevenueWaterfallChart.tsx` (chart body) + `src/pages/SaleDetail.tsx` (collapsible integration) |
| INTR-03 | `WaterfallTooltip` inline component in `src/components/RevenueWaterfallChart.tsx` — fullLabel + signed delta + running-total line (suppressed on start/end) |

## Commits

| Task | Step | Commit | Scope |
|------|------|--------|-------|
| 1 | RED | `2de8580` | `src/components/RevenueWaterfallChart.test.tsx` — 8 failing tests |
| 1 | GREEN | `ace0f99` | `src/components/RevenueWaterfallChart.tsx` — component implementation |
| 2 | RED | `4c850b4` | `src/tests/sale-detail-page.test.tsx` — 4 new failing tests + RevenueWaterfallChart mock |
| 2 | GREEN | `dae8d6f` | `src/pages/SaleDetail.tsx` — imports + useState + new `<section>` after Department Table |

## Verification

- **`npx vitest run src/components/RevenueWaterfallChart.test.tsx`** → 8/8 pass
- **`npx vitest run src/tests/sale-detail-page.test.tsx`** → 11/11 pass (7 existing + 4 new; no regression)
- **`npx vitest run src/components/RevenueWaterfallChart.test.tsx src/tests/sale-detail-page.test.tsx`** → 19/19 pass
- **`npx vitest run`** (full suite) → **640/640 pass across 68 test files**
- **`npx tsc --noEmit`** → clean (zero errors)
- **`grep -c "RevenueWaterfallChart" src/pages/SaleDetail.tsx`** → 2 (≥ 2 required — import + JSX render)
- **`grep -c "Revenue breakdown" src/pages/SaleDetail.tsx`** → 1 (≥ 1 required — section heading)

## Deviations from Plan

None — plan executed as written, with the following explicitly-plan-authorized discretion calls:

- Plan Task 2 `<action>` paragraph on ChartCard composition explicitly offers options (a) extend ChartCard or (b) inline card, with the direction "Prefer (a) if ChartCard already exposes actions; otherwise implement a local inline card". ChartCard's existing `action` slot (singular) could have carried the chevron, but its always-on body div is incompatible with the UI-SPEC's 44px collapsed-header spec. Chose (b) for reasons documented in the decisions list above. Plan-authorized, not a deviation.
- Plan Task 1 `<behavior>` explicitly marks the tooltip-component decision as "Choose the cleaner path" between wrapping ChartTooltip with a payloadFilter vs an inline tooltip. Task 1 chose the inline tooltip (documented in that commit's top-of-file comment) — plan-authorized, not a deviation.

## Manual-verify items (stay on the 06-VALIDATION.md checklist)

- Visual cell-color verification (blue-600 terminals / emerald-600 up / rose-600 down) — SVG color introspection is flaky under jsdom; UI-SPEC classifies this as a visual-review item.
- Recharts tooltip hover display (step full name + signed delta + running-total line, running-total suppressed on step 1 + step 7) — jsdom can't drive the hover-layout pipeline reliably; tests assert structural wiring (tooltip component present) and leave visual behavior to manual verification per 06-VALIDATION.md.
- Chevron rotation + max-height transition smoothness — CSS animation, visual-review.

## Known Stubs

None — the chart is fully wired to real sale data via `useSale` → `transformToWaterfall` → `<RevenueWaterfallChart>`; no placeholder empty arrays or hardcoded mock values flow to the UI.

## Self-Check: PASSED

- `src/components/RevenueWaterfallChart.tsx` — FOUND
- `src/components/RevenueWaterfallChart.test.tsx` — FOUND
- `src/pages/SaleDetail.tsx` — FOUND (modified, RevenueWaterfallChart imported + rendered in new section)
- `src/tests/sale-detail-page.test.tsx` — FOUND (11 tests; 4 new for Revenue Breakdown)
- Commit `2de8580` — FOUND (Task 1 RED)
- Commit `ace0f99` — FOUND (Task 1 GREEN)
- Commit `4c850b4` — FOUND (Task 2 RED)
- Commit `dae8d6f` — FOUND (Task 2 GREEN)
