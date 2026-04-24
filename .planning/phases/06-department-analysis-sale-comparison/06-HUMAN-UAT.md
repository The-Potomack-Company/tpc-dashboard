---
status: partial
phase: 06-department-analysis-sale-comparison
source: [06-VERIFICATION.md, 06-06-PLAN.md Task 2]
started: 2026-04-23T12:35:00Z
updated: 2026-04-23T12:35:00Z
---

## Current Test

[awaiting human testing — deferred during /gsd-autonomous run on 2026-04-23]

## Tests

### 1. 7-flow smoke check (Phase 6 end-to-end)
expected: |
  Flow 1 — Sidebar 'Departments' NavLink navigates to /departments (no "Coming soon").
  Flow 2 — /departments renders rankings table + metric toggle (3 options) + date filter + chip bar (top-5 default) + line chart (DEPT-02) + stacked bar (DEPT-03). Row-click cross-filter dims non-matching series, adds chip, clearing works, 9th chip shows max-8 notice.
  Flow 3 — /sales checkboxes + sticky footer + max-4 cap + Compare (N) button navigates to /sales/compare?sales=....
  Flow 4 — /sales/compare renders Compare Sales heading + Comparing N sales + metric-group rows (Sale metadata / Lot metrics / Financial breakdown / Participation) + adjacent-pair deltas (columns 2-4 only) + emerald/rose/gray colors + `pp` suffix on sell-through.
  Flow 5 — Invalid URL branches (/sales/compare?sales=only-one, no params, malformed) all render 'Invalid comparison' card with Back to sales.
  Flow 6 — Revenue Breakdown card on Sale Detail: collapsed by default, chevron expands 7-bar waterfall, tooltip shows step name + signed delta + running total, chevron collapses, navigating to another sale resets to collapsed.
  Flow 7 — Cross-regression: Trends page still loads; Sales page without selection still works; auth gates still redirect unauthenticated users.
result: [pending]
why_human: Visual behavior (opacity dimming animation, bar colors, tooltip rendering under real browser layout, sticky-footer interplay with scroll, chart transitions) cannot be verified by automated tests. Listed as manual-only in 06-VALIDATION.md. Plan 06-06 Task 2 was deferred by the user during the /gsd-autonomous run.

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
