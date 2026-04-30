---
phase: 3
slug: tpc-app-activity-activity
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-30
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Synthesized from `03-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 + @testing-library/react 16.3.2 + @testing-library/user-event 14.6.1 + jsdom 28.1.0 |
| **Config file** | `vitest.config.ts` (Phase 1; reuse) |
| **Quick run command** | `npm run test -- {file pattern}` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~30-60 seconds (full suite, after Phase 3 adds ~80-100 tests) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- {file pattern}` (the specific component/hook the task touched)
- **After every plan wave:** Run `npm run test` (full suite)
- **Before `/gsd-verify-work`:** Full suite green + all 6 new static verifiers green
- **Max feedback latency:** 60 seconds (full suite)

---

## Per-Task Verification Map

| Req / Decision | Behavior | Test Type | Automated Command | File Exists | Status |
|---------------|----------|-----------|-------------------|-------------|--------|
| APP-01 | Today KPI strip renders 4 KpiCards with prev-day delta direction | unit (component + hook mock) | `npm run test -- src/components/activity/TodayKpiStrip.test.tsx` | ❌ Wave 0 | ⬜ pending |
| APP-02 | Active Sessions table renders sortable columns; default sort = age desc | unit (component) | `npm run test -- src/components/activity/ActiveSessionsTable.test.tsx` | ❌ Wave 0 | ⬜ pending |
| APP-03 | 14-day stacked bar renders 14 buckets × N specialists (zero-cells filled) | unit (component + hook mock) | `npm run test -- src/components/activity/ItemsPerSpecialistChart.test.tsx` | ❌ Wave 0 | ⬜ pending |
| APP-04 | AI status donut renders 5 slices; failed slice has +outerRadius | unit (component) | `npm run test -- src/components/activity/AiStatusDonut.test.tsx` | ❌ Wave 0 | ⬜ pending |
| APP-05 | Export pipeline horizontal stacked bar renders 4 (or 5) status segments | unit (component) | `npm run test -- src/components/activity/ExportPipelineChart.test.tsx` | ❌ Wave 0 | ⬜ pending |
| APP-06 | Session Detail page renders metadata + items list; back link preserves URL params | unit + integration (page + hook mock) | `npm run test -- src/pages/SessionDetail.test.tsx` | ❌ Wave 0 | ⬜ pending |
| APP-07 | URL `?range=7d&specialists=a,b&mode=house` round-trips | unit (hook) | `npm run test -- src/hooks/useSpecialistFilter.test.tsx src/hooks/useModeFilter.test.tsx` | ❌ Wave 0 | ⬜ pending |
| APP-08 | Specialist multi-select shows active specialists only; renders display_name | unit (component + hook mock) | `npm run test -- src/components/SpecialistMultiSelect.test.tsx` | ❌ Wave 0 | ⬜ pending |
| APP-09 | Mode toggle sets `?mode=house\|sale\|all`; default = all | unit (component) | `npm run test -- src/components/ModeToggle.test.tsx` | ❌ Wave 0 | ⬜ pending |
| APP-10 | Photo Coverage panel shows ≥1/0 split + upload_status breakdown + failed callout | unit (component + hook mock) | `npm run test -- src/components/activity/PhotoCoveragePanel.test.tsx` | ❌ Wave 0 | ⬜ pending |
| APP-11 | Stuck items alert card classifies severity (none/yellow/red); CTA links to /activity/stuck | unit (component) + unit (severity classifier) | `npm run test -- src/lib/severity.test.ts src/components/activity/StuckItemsAlertCard.test.tsx` | ❌ Wave 0 | ⬜ pending |
| APP-12 | House-vs-Sale split renders 2 paired KpiCards with mode color borders | unit (component) | `npm run test -- src/components/activity/HouseSaleSplit.test.tsx` | ❌ Wave 0 | ⬜ pending |
| D-08 | Photo signed URL refetches on `visibilitychange` after staleTime | unit (hook + fake timers) | `npm run test -- src/hooks/useSignedPhotoUrl.test.tsx` | ❌ Wave 0 — **load-bearing** | ⬜ pending |
| D-09 | Mounting Session Detail does NOT call createSignedUrl; row expansion does | unit (page + storage mock) | `npm run test -- src/pages/SessionDetail.test.tsx` (assert call count = 0 on mount, > 0 after row click) | ❌ Wave 0 | ⬜ pending |
| D-13 | createSignedUrl is NEVER called for upload_status='failed' photos | unit (component + storage mock) | `npm run test -- src/components/activity/SessionItemDisclosure.test.tsx` | ❌ Wave 0 | ⬜ pending |
| D-14..D-21 | Filter scope discipline — every chart hook reads only its declared filters | static (JSDoc grep) + unit (hook) | `node scripts/verify-activity-filter-scope.mjs` (NEW) | ❌ Wave 0 | ⬜ pending |
| D-19 | Specialist multi-select excludes role='admin' and is_active=false | unit (hook + DB mock) | `npm run test -- src/hooks/activity/useActiveSpecialists.test.tsx` | ❌ Wave 0 | ⬜ pending |
| D-20 | Mode filter targets sessions.mode, not items.mode | static (SQL grep) | `node scripts/verify-activity-mode-filter.mjs` (NEW) | ❌ Wave 0 | ⬜ pending |
| D-24 | Stuck items 2h threshold is hard-coded inside the RPC, NOT a parameter | static (SQL grep) + unit (RPC seed test) | `node scripts/verify-activity-stuck-threshold-hardcoded.mjs` (NEW) | ❌ Wave 0 | ⬜ pending |
| D-26 | DeveloperPanel renders only when isDevAccount(profile.email) | unit (component + auth-store mock) | `npm run test -- src/components/activity/DeveloperPanel.test.tsx` | ❌ Wave 0 | ⬜ pending |
| D-30 | Every Phase 3 RPC uses 3-arg date_trunc('day' \| 'hour', x, 'America/New_York') | static (SQL grep) | `node scripts/verify-activity-bucket-tz.mjs` (NEW — extends Phase 2 verifier) | ❌ Wave 0 | ⬜ pending |
| D-33 | Every ui_interactions query scopes by app_source = 'tpc-app' | static (SQL grep + JSDoc grep) | `node scripts/verify-activity-app-source-scope.mjs` (NEW — mirrors Phase 2's verifier) | ❌ Wave 0 | ⬜ pending |
| D-35 | ErrorState used everywhere with the locked contract; no sibling Retry buttons | static (TS grep) + unit (component) | `node scripts/verify-activity-error-state-contract.mjs` (NEW) | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

### Test files (one per chart/component/hook/page)

- [ ] `src/services/activity/queries.test.ts` — fixtures for RPC arg shape
- [ ] `src/hooks/activity/*.test.tsx` — one per hook, queryKey shape + filter folding
- [ ] `src/hooks/useSignedPhotoUrl.test.tsx` — **load-bearing**: covers `enabled=false` path, `refetchOnWindowFocus: true` override (synthetic focus event after `staleTime`), `gcTime` cleanup
- [ ] `src/hooks/useSpecialistFilter.test.tsx` + `useModeFilter.test.tsx` — URL round-trip
- [ ] `src/components/activity/*.test.tsx` — one per ~22 components
- [ ] `src/lib/severity.test.ts` — 5 invariant tests from UI-SPEC § Severity Tone Constants
- [ ] `src/lib/chartPalette.test.ts` — `colorForSpecialist` stable output for fixed sortedEmails
- [ ] `src/lib/format.test.ts` — `formatAge` covers the 4 buckets (s/m/h/d format)
- [ ] `src/pages/Activity.test.tsx` — section composition, filter row, dev-panel gate
- [ ] `src/pages/SessionDetail.test.tsx` — back link preserves URL params, row expansion, no eager createSignedUrl on mount
- [ ] `src/pages/StuckItems.test.tsx` — table renders, row click navigates

### Static verifiers (NEW — model after Phase 2's `verify-extension-app-source-scope.mjs`)

- [ ] `scripts/verify-activity-app-source-scope.mjs` — every `ui_interactions` SQL or builder includes `app_source = 'tpc-app'`
- [ ] `scripts/verify-activity-bucket-tz.mjs` — every aggregation RPC uses 3-arg `date_trunc(... 'America/New_York')`
- [ ] `scripts/verify-activity-stuck-threshold-hardcoded.mjs` — `interval '2 hours'` literal inside `get_stuck_items` body, NOT a parameter
- [ ] `scripts/verify-activity-mode-filter.mjs` — no RPC body filters on `items.mode` (D-20)
- [ ] `scripts/verify-activity-filter-scope.mjs` — every `src/hooks/activity/*.ts` has a `@filterScope` JSDoc tag
- [ ] `scripts/verify-activity-error-state-contract.mjs` — every `<ErrorState>` use has 3 required props; no caller renders sibling Retry

*Recharts JSDom mock (Phase 1 / 01-05 pattern) is reused verbatim — no extension needed for `ItemsPerSpecialistChart`, `AiStatusDonut`, `ExportPipelineChart`, `WalkthroughFunnel` tests.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Photo thumbnails repaint after 2-hour tab-resume without flash or 403 | APP-D-08 / Success Criterion #5 | Synthetic `visibilitychange` Vitest test exercises the hook; the **real** 2-hour boundary is a clock-time, network-dependent event that automation can only approximate. UAT on a real session with photos is the final gate. | (1) Open `/activity/sessions/:id` for a session with ≥1 photo. (2) Expand any item row to load thumbnails. (3) Switch to a different browser tab. (4) Wait ≥2h (or open a fresh tab and modify system clock — admin-discretion). (5) Return to the original tab. (6) Verify thumbnails repaint with no flash, no 403, no console warning. |
| Stuck-items severity tone classification (yellow N≥5 / red oldest>6h) feels right to operators | APP-D-22 | Numeric thresholds chosen from a guess; only operator UAT confirms whether they map to lived experience. | After deploy, sit with operator over a real-data session of `/activity`. Confirm the alert tone matches their gut sense of "this needs attention." Tune constants in `src/lib/severity.ts` if misclassified. |
| Walkthrough funnel step list and ordering | D-32 / Discretion | Step list must be enumerated by reading TPC App's `Walkthrough.tsx` emitter at plan time; ordering choice is admin's preference. | Plan-time: `grep -rn walkthrough_step ~/Projects/TPC_App/TPC_App/src/`. Implement RPC. UAT: confirm funnel reads top-to-bottom in chronological order an admin would expect. |
| Recent Events Feed scroll feel during real `ui_interactions` traffic | D-32 | High-volume table; only real traffic confirms whether 10s `refetchInterval` feels appropriate. | After deploy, observe the Recent Events Feed during business hours. If feed scrolls too aggressively, raise `REFETCH_INTERVAL_MS` constant. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
