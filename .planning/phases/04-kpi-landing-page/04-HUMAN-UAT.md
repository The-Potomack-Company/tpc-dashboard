---
status: partial
phase: 04-kpi-landing-page
source: [04-VERIFICATION.md]
started: 2026-04-22T00:00:00Z
updated: 2026-04-22T00:00:00Z
---

## Current Test

[awaiting browser walkthrough — 6 items; most gated on Phase 2 live data]

## Tests

### 1. Period swap no-skeleton-flash (KPI-01)
expected: toggling YTD/L6M/L12M keeps KPI cards visible with stale values while new period loads.
instructions: `npm run dev`, visit `/`, click period options, confirm no skeleton flash.

### 2. Delta arrow colors (KPI-02)
expected: green ▲ for positive, red ▼ for negative, gray — when no baseline.
instructions: visit `/` with live data; spot-check each of the 4 cards.

### 3. Recent-sale click-through (KPI-03)
expected: clicking any recent-sale card navigates to `/sales/{sale_number}`.
instructions: click a card in the Recent Sales panel.

### 4. Keyboard navigation
expected: Tab cycles period selector → KPI cards (skipped; not focusable) → recent-sale cards; Enter activates.
instructions: keyboard-only walkthrough.

### 5. Reduced-motion skeleton
expected: skeletons have no pulse animation when OS `prefers-reduced-motion: reduce`.
instructions: enable reduced motion in OS settings, reload.

### 6. Responsive grid collapse
expected: KPI row collapses 4→2→1 cols; Recent Sales 5→2→1.
instructions: resize viewport.

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps

- Items 1-3 depend on Phase 2 live import (deferred). Test with even 3 imported sales.
- Items 4-6 testable against empty DB.
