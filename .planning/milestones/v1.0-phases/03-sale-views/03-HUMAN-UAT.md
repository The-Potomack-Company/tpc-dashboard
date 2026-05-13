---
status: partial
phase: 03-sale-views
source: [03-VERIFICATION.md]
started: 2026-04-22T00:00:00Z
updated: 2026-04-22T00:00:00Z
---

## Current Test

[awaiting human testing — 6 items; most gated on Phase 2 live import + browser session]

## Tests

### 1. Browse /sales (SALE-01)

expected: list renders 457 rows (or empty state if Phase 2 import still deferred), sort by columns, debounced filter works.
result: [pending]
instructions: `npm run dev`, navigate to `/sales`, verify sort indicators toggle asc/desc/unsorted, type in filter and confirm match count updates.

### 2. Sale detail page (SALE-02, SALE-03)

expected: `/sales/{sale_number}` shows 19-tile KPI grid with all sale metrics + dept table sorted by revenue DESC.
result: [pending]
instructions: click any sale row from the list; verify summary card values against the source PDF; click department column headers to toggle sort.

### 3. ValidationWarningBanner (SALE-02)

expected: amber banner renders only when sale has `validation_warning=true`; Reload button invalidates the query and refetches.
result: [pending]
instructions: find a sale with `validation_warning=true` (`SELECT sale_number FROM sales WHERE validation_warning = true LIMIT 1;`); visit that sale; click Reload sale.

### 4. SaleNotFound 404

expected: `/sales/NONEXISTENT_XYZ` shows "Sale not found" heading + back link.
result: [pending]
instructions: visit `/sales/BOGUSXYZ` in browser; confirm back link returns to `/sales`.

### 5. Responsive sidebar collapse (INFR-03)

expected: at 768-1023px the sidebar collapses to a 64px icon rail; at >=1024px it expands to full 240px.
result: [pending]
instructions: resize browser viewport; confirm icon rail at tablet widths, full sidebar at desktop.

### 6. Screen-reader a11y spot check

expected: `role="status" aria-live="polite"` on ValidationWarningBanner announces politely; filter match count announced politely; sort changes announced.
result: [pending]
instructions: use VoiceOver / NVDA to walk through /sales and a sale detail page.

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps

- Items 1-3 depend on Phase 2 live import (deferred). Can be tested with even 1-2 sales imported manually (e.g., `npm run import:pdfs -- --limit 3`).
- Items 4-6 can be tested against empty DB.
