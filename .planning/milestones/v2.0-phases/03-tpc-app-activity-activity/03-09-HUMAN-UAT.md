---
status: partial
phase: 03-tpc-app-activity-activity
plan: 09
task: 3
source: [03-09-PLAN.md, 03-VERIFICATION.md, ROADMAP.md § Phase 3 § Success Criteria]
started: 2026-05-01T21:35:00Z
updated: 2026-05-01T21:35:00Z
---

## Current Test

[awaiting human testing — operator UAT pending after /gsd-execute-phase 3 closeout]

## Setup

Before starting:

1. Run `npm run dev` from the repo root
2. Sign in as a TPC admin who has data populated in the shared Supabase project
3. (For Test 7) be prepared to also sign in as `josh@potomackco.com` (allowlisted dev account) and as a non-allowlisted admin
4. Have the browser DevTools open with the Network tab visible (filter by `signed`) — used in Tests 5 and 6

## Tests

### 1. Success Criterion 1 — Today KPI strip + Active Sessions (APP-01 + APP-02)

expected: Visit `/activity`. Page heading reads "Activity" with subtitle "TPC team cataloging activity". The "Today's Snapshot" section shows 4 KPI cards (Sessions today, Items today, Items exported today, % AI done today), each with a "vs yesterday" delta. A small green pulsing dot appears next to "Today's Snapshot". Below it, the "Active sessions" table renders with another green pulsing dot, columns: Session, Mode, Specialist, Items, Created, Updated, Age. Default sort is age desc (oldest first). Clicking a column header reorders. Clicking any row navigates to `/activity/sessions/<id>`.
result: pending

### 2. Success Criterion 2 — Filter URL state (APP-07 + APP-08 + APP-09)

expected: Filter row shows DateRangeFilter (Today / 7d / 30d / Custom), Specialist multi-select ("All specialists"), Mode toggle (All / House / Sale).

(a) Click "30d". URL gains `?range=30d`. Today KPI strip is UNCHANGED (right-now widget — D-14 ignores range). The 14-day stacked bar is UNCHANGED (D-16 fixed-window). Range-driven widgets (AI status donut APP-04, House-vs-Sale APP-12, Export Pipeline APP-05) re-fetch.

(b) Open the Specialist multi-select; check 1–2 specialists. URL gains `?specialists=email1,email2`. EVERY widget re-queries (specialist filter applies to BOTH right-now and range-driven per master rule D-14..D-21).

(c) Click "House" in the mode toggle. URL gains `?mode=house`. Every widget re-queries.

(d) Refresh the page. Filter selections survive (URL is the source of truth — D-21 default).

(e) Browser back button after a series of filter changes restores prior states.
result: pending

### 3. Success Criterion 3 — Charts + Stuck Items alert (APP-03 + APP-04 + APP-05 + APP-12 + APP-11)

expected:

(a) 14-day stacked bar (APP-03) appears below the Stuck Items alert; subheading reads "Last 14 days". Each bar's stack segments correspond to specialists; legend shows display_name (NOT email). Same specialist gets the same color across page reloads (alphabetical-position cycle from `lib/chartPalette.ts`).

(b) AI status donut (APP-04) renders 5 slices: pending (gray), processing (blue), queued (amber), done (green), failed (red — visually distinct via pulled-out outerRadius). Donut center label reads "{X}% AI done" computed from done/total over the selected range.

(c) House-vs-Sale paired KPI (APP-12) shows two tiles side-by-side; House has indigo-600 left border, Sale has teal-600 left border; sub-line "{N} sessions · {N} items".

(d) Export Pipeline horizontal stacked bar (APP-05) shows 5 segments left-to-right: active (slate-400) → submitted (sky-600) → returned (amber-600) → exported (green-600) → completed (slate-500). The completed segment IS visible if production data has any sessions in `completed` state.

(e) Stuck Items alert card (APP-11):
  - When 0 stuck items: "No stuck items" with quiet success state, gray icon, no left border. Card height stays the same as when populated (no reflow on each refetch — D-22).
  - When 1-4 stuck items, all <6h: yellow tone with amber-50 background, amber-500 left border, amber-900 headline, exclamation-triangle icon.
  - When ≥5 stuck items, all <6h: yellow tone (same as 1-4 — D-22 simplification).
  - When any oldest >6h (regardless of count): RED tone with red-50 background, red-500 left border.
  - "View N stuck items →" CTA at bottom; clicking navigates to `/activity/stuck` with NO filter params (D-23 — independent context).
result: pending

### 4. Success Criterion 4 — Session Detail (APP-06 + APP-10)

expected: From `/activity` with `?range=7d&specialists=alice@x.com&mode=house`, click an Active Sessions row.

(a) URL is now `/activity/sessions/{uuid}?range=7d&specialists=alice%40x.com&mode=house` (filter params preserved per D-03).

(b) Sidebar "Activity" entry STAYS highlighted (D-03 — NavLink active class).

(c) Page heading shows the session name; subtitle reads "{mode} · {status} · created {full ET datetime}".

(d) BackLink "← Activity" at top — clicking it returns to `/activity` with the SAME filter params. Browser back button does the same.

(e) Session metadata card on the left shows: Name, Mode, Status, Specialist, Created by, Created (full ET), Last updated, Notes, Review notes.

(f) Photo Coverage panel (APP-10) on the right shows numeric breakdown only — items with photos / total items, items with no photos, by upload status (4 rows: pending / uploading / uploaded / failed). If any photos are `failed`, a red callout appears below the breakdown (D-04).

(g) Item list table below; columns: Receipt #, Title, AI status, Photos.

(h) Click any item row to expand — thumbnail strip appears below the row (D-06 lazy disclosure).
result: pending

### 5. Success Criterion 5 — Photo signed URL strategy: lazy + failed-photo no-fetch (APP-10 + D-09 + D-12 + D-13)

expected: This is the LOAD-BEARING criterion. The most novel technical surface in Phase 3.

(a) On a session with ≥1 photo, expand an item row. Thumbnails appear with a brief shimmer, then the actual image.

(b) Open DevTools → Network tab → filter by `signed`. After expanding the row, you should see exactly one POST request per non-failed photo to `/storage/v1/object/sign/photos/<thumbnail_path>` returning `{ signedUrl }`.

(c) **D-13 invariant** — if any photo has `upload_status='failed'`, that photo's tile shows an inline red chip "Failed upload", and **NO request fires for that photo** in the Network tab.

(d) **D-09 invariant** — On a session expansion, mounting the page (without expanding rows) issues ZERO `createSignedUrl` requests. Confirm by reloading `/activity/sessions/<id>` with DevTools cleared and verifying zero `signed` requests until a row is expanded.

(e) **D-12 invariant** — Each signed URL request targets the `thumbnail_path` (smaller asset), never the `storage_path` (full size). Inspect the request URL to confirm.
result: pending

### 6. Success Criterion 5 — Photo thumbnails refresh on 2-hour tab-resume (LOAD-BEARING — D-08 + D-11)

expected: This is the manual gate that proves `useSignedPhotoUrl`'s `refetchOnWindowFocus: true` override works against a real Supabase Storage signed-URL TTL.

Steps:
1. Open `/activity/sessions/<id>` in a tab. Expand 1-2 item rows so thumbnails render. Note the URL TTL is 1 hour by design (D-11).
2. Switch to a different tab (or laptop screen lock for >50 min) for AT LEAST 50 minutes. Recommended: ≥2 hours for the canonical Success Criterion #5 test.
3. Return to the original tab.
4. Verify the thumbnails are rendered (NOT broken-image icons / NOT 403 errors).
5. In the Network tab, observe a NEW round of `createSignedUrl` POSTs firing on tab-resume (visibilitychange / focus event triggered the refetch — exactly as TanStack Query's `refetchOnWindowFocus: true` override is supposed to do).
6. No 403 errors on any image source.

If this final test fails, Phase 3 is incomplete. The hook `src/hooks/useSignedPhotoUrl.ts` is the single source of truth for this contract.
result: pending

### 7. Critical CONTEXT decision sanity-checks (D-26 + D-33 + D-23 + D-37 + D-22)

expected:

(a) **D-26** (dev gate): sign in as a NON-allowlisted admin. The `<DeveloperPanel>` at the bottom of `/activity` is ABSENT from the DOM (verify via DevTools Element inspector — NOT just `display: hidden`). Sign in as `josh@potomackco.com`. Panel appears at the bottom with "Diagnostics for josh@potomackco.com" subtitle.

(b) **D-33** (`ui_interactions` cross-app): inside the dev panel, expand UI Interactions sub-panel. The Recent Events Feed shows ONLY events from the TPC App (`app_source='tpc-app'`); zero events from this dashboard, zero events from the extension.

(c) **D-23** (StuckItems independent context): set filters on `/activity` (e.g., `?specialists=alice@x.com`). Click Stuck Items alert card CTA. Land on `/activity/stuck` — the URL has NO query params (filter context not inherited). The page shows ALL stuck items regardless of /activity's filter selection.

(d) **D-37** (no full-page empty): if your dev DB has zero sessions today, the Today KPI strip shows individual em-dashes per card; NO full-page empty state (diverges from Phase 2's `D-19` page-level gate).

(e) **D-22** (severity tone): observe stuck-state classification on production data over a few days. Confirm the tone (yellow / red) matches operator gut sense of "this needs attention." If misclassified, tune constants in `src/lib/severity.ts` (deferred per 03-CONTEXT.md "Claude's Discretion").
result: pending

## Production-cleanliness invariant

After UAT, run against the live shared Supabase project:

```sql
-- No write happened to TPC App tables from the dashboard:
select count(*) from public.items where created_at >= now() - interval '1 hour' and id not in (select item_id from public.photos);
-- (returns ≥0 — sanity only; the dashboard is read-only so this exists as a smoke check, not a hard invariant)
```

Confirm no rows were inserted/updated/deleted in `public.items`, `public.sessions`, `public.photos`, or `public.export_history` by the dashboard (Phase Boundary read-only — verified statically by `scripts/verify-activity-table-readonly.mjs`).

result: pending

## Screenshots (to capture during UAT)

- [ ] activity-landing-with-data.png — Today KPI strip + Active Sessions populated
- [ ] activity-filters-applied.png — `?range=30d&specialists=alice@x.com&mode=house` round-tripped
- [ ] stuck-alert-yellow.png — yellow tone, N≥1 oldest <6h
- [ ] stuck-alert-red.png — red tone, oldest >6h
- [ ] session-detail-with-thumbnails.png — expanded row, thumbnails loaded
- [ ] session-detail-failed-photo.png — failed-upload red chip (D-13)
- [ ] dev-panel-expanded.png — josh@ — Failed-AI Breakdown + UI Interactions sub-panels
- [ ] admin-no-dev-panel.png — admin DOM with no `developer-panel` testid

## Summary

total: 7 + 1 (cleanliness check)
passed: 0
issues: 0
pending: 8
skipped: 0
blocked: 0

## Gaps

(none yet — file is in `partial` status until operator runs the UAT)

## How to resume

When ready to execute: run `npm run dev`, open `/activity` in a browser, work through Tests 1-7 + the cleanliness SQL, update each `result: pending` to `pass` or describe the failure. Test 6 (the 2-hour tab-resume) is the load-bearing gate for Success Criterion #5 — if it fails, Phase 3 is incomplete. Then run `/gsd-verify-work 3` to formally close the UAT and mark Phase 3 complete in ROADMAP.md.
