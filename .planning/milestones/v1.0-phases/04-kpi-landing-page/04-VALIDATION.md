---
phase: 4
slug: kpi-landing-page
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-22
---

# Phase 4 — Validation Strategy

## Test Infrastructure

| Property | Value |
|----------|-------|
| Framework | Vitest 4 + Testing Library (already installed) |
| Config | `vite.config.ts` projects (src under jsdom) |
| Quick command | `npm test -- src` |
| Full command | `npm test && npm run lint && npm run build` |
| Est runtime | ~5s unit, ~25s full gate |

## Sampling Rate

- Per task commit: `npm test -- src`
- Per wave merge: full gate
- Phase gate: full gate green + manual QA once Phase 2 live data exists

## Per-Task Verification Map

| Plan | Wave | Requirement | Test file | Automated |
|------|------|-------------|-----------|-----------|
| migrations | 1 | — (schema) | `npm test -- schema-shape` | grep `kpi_summary` in `src/db/database.types.ts` |
| period | 2 | KPI-01, KPI-02 | `src/tests/period.test.ts` | unit |
| delta-formatter | 2 | KPI-02 | `src/tests/format-delta.test.ts` | unit |
| schema | 2 | KPI-01/02 | `src/tests/kpi-schema.test.ts` | unit |
| useKpiSummary | 3 | KPI-01/02 | `src/tests/use-kpi-summary.test.tsx` | mocked supabase |
| KpiCard | 3 | KPI-01/02 | `src/tests/kpi-card.test.tsx` | unit |
| PeriodSelector | 3 | KPI-01 | `src/tests/period-selector.test.tsx` | unit |
| RecentSalesPanel | 3 | KPI-03 | `src/tests/recent-sales-panel.test.tsx` | unit |
| Dashboard | 4 | KPI-01/02/03 | `src/tests/dashboard-page.test.tsx` | integration |

## Wave 0 Requirements

- [ ] `src/tests/period.test.ts`
- [ ] `src/tests/format-delta.test.ts`
- [ ] `src/tests/kpi-schema.test.ts`
- [ ] `src/tests/use-kpi-summary.test.tsx`
- [ ] `src/tests/kpi-card.test.tsx`
- [ ] `src/tests/period-selector.test.tsx`
- [ ] `src/tests/recent-sales-panel.test.tsx`
- [ ] `src/tests/dashboard-page.test.tsx`

## Manual-Only Verifications

| Behavior | Req | Instructions |
|----------|-----|--------------|
| Period selector swaps KPI values | KPI-01 | In browser at `/`, toggle YTD/L6M/L12M; confirm values change; cards stay visible (no skeleton flash) |
| Delta arrow color + direction | KPI-02 | Visual compare current period vs previous; confirm green ▲ / red ▼ / gray — correct |
| Recent sales click-through | KPI-03 | Click any recent-sale card; confirm route = `/sales/{sale_number}` |

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s

**Approval:** approved 2026-04-22
