---
status: partial
phase: 02-extension-analytics-extension
plan: 09
task: 2
source: [02-09-PLAN.md, 02-09-SUMMARY.md, 02-VERIFICATION.md]
started: 2026-04-30T15:15:00Z
updated: 2026-04-30T15:15:00Z
---

## Current Test

[awaiting human testing — operator deferred UAT during /gsd-execute-phase 2]

## Tests

### 1. Sign in as dev account and navigate to /extension
expected: dev account is `josh@potomackco.com`; page loads at `/extension` route inside `<DashboardLayout>` behind `<ProtectedRoute>`; no auth errors
result: pending

### 2. Sidebar nav accent
expected: first sidebar entry (`Extension Analytics`) shows active styling — `text-accent`, `border-l-2 border-accent`, `bg-accent/5`
result: pending

### 3. Page chrome rendered
expected: page heading `Extension Analytics`, subtitle, browser tab title, and filter row (DateRangeFilter + UserMultiSelect) all render
result: pending

### 4. Empty-state branch (skip if data exists)
expected: if `analytics_events` has 0 rows for `app_source='tpc-extension'`, the page shows the centered `<EmptyState>` with heading `No extension events yet` and a body explaining the v2.0 extension dependency. Filter row STILL renders above the empty branch (UI-SPEC § Empty gate layout)
result: pending

### 5. Charts hydrate (EXT-01..EXT-05)
expected: EXT-01 stacked bar (event volume by event_type), EXT-02 KPI strip (5 KpiCards with sparklines + previous-period deltas), EXT-03 horizontal bar (error rate per event type), EXT-04 PerUserTable (sortable wide-pivot), EXT-05 RecentErrorsTable (sortable). All hydrate without console errors.
result: pending

### 6. Live feed Pause/Resume timing (EXT-08)
expected: green pulsing dot; click Pause → window freezes, dot goes gray, subtitle changes; click Resume → immediately fetches latest 50 (uses `invalidateQueries`). Timing feels natural at ~10s. Choose option A/B/C per Plan 02-09 Task 2 to exercise without writing to production.
result: pending

### 7. Dev panel render gate + version filter + cancellation KPIs
expected: signed in as dev account, scroll to bottom; see `Developer panel` row with `Diagnostics for josh@potomackco.com` subtitle and right-aligned dominant-version chip. Click to expand → ExtensionVersionFilter + 2-card cancellation rate KPI grid. Toggle a version, confirm rest of page (charts, KPIs, error rates) updates because `?versions=` URL state is shared.
result: pending

### 8. Payload viewer modal (EXT-06)
expected: click `View →` in EXT-05 RecentErrorsTable. PayloadViewerModal opens, JSON is pretty-printed, Copy button shows `Copied!` for 2s after click, Escape closes.
result: pending

### 9. Admin signed in: no developer-panel testid in DOM (security regression check)
expected: sign out, sign in as a non-dev admin (any email NOT in `DEV_EMAILS = ['josh@potomackco.com']`). Navigate to `/extension`. DevTools → Elements → search `developer-panel` testid → no match. NOT just `display: hidden` — the panel must not be in the DOM at all (D-15).
result: pending

### 10. URL filter sharing
expected: change date range or version filter; copy URL; open in another tab. Same filters apply because all filters are URL-driven (`?from=`, `?to=`, `?users=`, `?versions=`).
result: pending

## Production-Cleanliness Invariant (Checker WARNING #8)

After the smoke, run this against the live shared Supabase project:
```sql
select count(*) from public.analytics_events where user_email = 'test@example.com';
```

expected: returns `0`. No test rows committed to production.
result: pending

## Screenshots (to capture during UAT)

- [ ] live-feed-running.png — green pulse, recent rows visible
- [ ] live-feed-paused.png — gray dot, paused subtitle
- [ ] dev-panel-expanded.png — both EXT-09 + EXT-10 sections visible
- [ ] admin-no-dev-panel.png — admin view with no `developer-panel` testid in DOM tree

## Summary

total: 10 + 1 (cleanliness check)
passed: 0
issues: 0
pending: 11
skipped: 0
blocked: 0

## Gaps

(none yet — file is in `partial` status until operator runs the UAT)

## How to resume

When ready to execute: run `npm run dev`, open `/extension` in a browser, work through the 10 tests + cleanliness SQL, update each `result: pending` to `pass` or describe the failure. Then run `/gsd-verify-work 2` to formally close the UAT.
