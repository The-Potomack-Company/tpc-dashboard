---
phase: 2
slug: extension-analytics-extension
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-29
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.0.18 (existing) |
| **Config file** | `vitest.config.ts` (existing — Phase 1) |
| **Quick run command** | `npm run test -- --run --reporter=basic` |
| **Full suite command** | `npm run test:ci` (or `npm run test -- --run`) |
| **Estimated runtime** | ~25–40 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick run command (target: <30s)
- **After every plan wave:** Run full suite command
- **Before `/gsd-verify-work`:** Full suite must be green; `npm run lint && npm run typecheck && npm run build` must all pass
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

> Filled in by gsd-planner during planning. Each task gets a row that maps task → REQ → test command. The plan checker enforces this in step 10.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | EXT-01..10 | — | RPCs filter `app_source='tpc-extension'` strictly | sql/integration | `npm run test -- src/services/extension/rpc.test.ts` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | EXT-D-13 | — | Bucket boundaries land in ET (DST-correct) | unit | `npm run test -- src/services/extension/bucketing.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 1 | EXT-07 | — | URL filter round-trips (`?users=a,b` → `['a','b']`) | unit | `npm run test -- src/hooks/extension/useUserFilter.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 1 | EXT-D-15/16 | T-02-AUTH | `isDevAccount` gate denies non-allowlist | unit | `npm run test -- src/lib/devAccess.test.ts` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 2 | EXT-01..04 | — | Hooks fold filters into queryKey (cache invalidation) | unit | `npm run test -- src/hooks/extension/queries.test.ts` | ❌ W0 | ⬜ pending |
| 02-04-01 | 04 | 2 | EXT-D-19 | — | Empty-state gate (`useExtensionGate`) renders full-page empty when 0 lifetime rows | unit | `npm run test -- src/pages/Extension/Extension.test.tsx` | ❌ W0 | ⬜ pending |
| 02-05-01 | 05 | 3 | EXT-01 | — | Stacked bar excludes `catalog_item` event type | unit | `npm run test -- src/components/extension/EventVolumeChart.test.tsx` | ❌ W0 | ⬜ pending |
| 02-05-02 | 05 | 3 | EXT-02 | — | KPI delta = same-length immediately preceding period (D-05) | unit | `npm run test -- src/components/extension/KpiStrip.test.tsx` | ❌ W0 | ⬜ pending |
| 02-05-03 | 05 | 3 | EXT-03 | — | Error rate uses `error_message IS NOT NULL` (D-03) | unit | `npm run test -- src/components/extension/ErrorRateChart.test.tsx` | ❌ W0 | ⬜ pending |
| 02-06-01 | 06 | 3 | EXT-04 | — | Per-user table groups `user_email IS NULL` as "Unknown" | unit | `npm run test -- src/components/extension/PerUserTable.test.tsx` | ❌ W0 | ⬜ pending |
| 02-06-02 | 06 | 3 | EXT-05/06 | T-02-AUTH | Recent Errors row click: payload affordance shown only for dev accounts (D-18) | unit | `npm run test -- src/components/extension/RecentErrorsTable.test.tsx` | ❌ W0 | ⬜ pending |
| 02-07-01 | 07 | 4 | EXT-08 | — | Live feed Pause/Resume: Resume triggers immediate refetch (D-11) | unit | `npm run test -- src/components/extension/LiveEventFeed.test.tsx` | ❌ W0 | ⬜ pending |
| 02-08-01 | 08 | 4 | EXT-09/10 | T-02-AUTH | DeveloperPanel renders only when `isDevAccount(profile.email)` true | unit | `npm run test -- src/components/extension/DeveloperPanel.test.tsx` | ❌ W0 | ⬜ pending |
| 02-08-02 | 08 | 4 | EXT-09 | — | Dominant-version badge picks max-count under active filter (D-06) | unit | `npm run test -- src/components/extension/DominantVersionBadge.test.tsx` | ❌ W0 | ⬜ pending |
| 02-08-03 | 08 | 4 | EXT-10 | — | Cancellation-rate KPI: per-event-type denominator (D-07) | unit | `npm run test -- src/components/extension/CancellationKpis.test.tsx` | ❌ W0 | ⬜ pending |
| 02-09-01 | 09 | 4 | All EXT | — | Page-level smoke (route mounts, charts hydrate, no console errors) | integration | `npm run test -- src/pages/Extension/Extension.smoke.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

> The planner SHOULD adopt or extend this map; row file paths are illustrative — final task IDs and test paths are owned by the planner.

---

## Wave 0 Requirements

- [ ] `src/services/extension/__tests__/rpc.test.ts` — RPC `app_source` scope verifier (D-01) + `catalog_item` exclusion (D-02)
- [ ] `src/services/extension/__tests__/bucketing.test.ts` — DST/timezone bucketing (D-13)
- [ ] `src/hooks/extension/__tests__/useUserFilter.test.ts` — URL round-trip (D-17)
- [ ] `src/hooks/extension/__tests__/useVersionFilter.test.ts` — URL round-trip (D-17)
- [ ] `src/hooks/extension/__tests__/useExtensionGate.test.ts` — empty-state gate (D-19)
- [ ] `src/lib/devAccess.test.ts` — allowlist gate (D-16)
- [ ] `src/test-utils/recharts-mock.ts` — extend Phase 1 Recharts JSDom mock for stacked bar + sparkline variants if not already covered

*Reuse note:* Phase 1 already ships a Recharts JSDom mock (STATE.md). Wave 0 verifies it covers `<BarChart>` + stacked-series rendering; extend only if gap detected.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live feed visual liveness | EXT-08 | 10s refetchInterval is too long for fast unit tests; verifying actual wall-clock cadence requires a human watching the feed | Open `/extension`; watch live feed; insert a row via Supabase SQL editor; confirm it appears within 10s; click Pause; insert another row; confirm it does NOT appear; click Resume; confirm it appears immediately |
| `<PayloadViewerModal>` JSON pretty-print + copy-to-clipboard | EXT-06 | Clipboard API is hard to assert headlessly; visual JSON formatting is subjective | Click "view payload" on a Recent Errors row (dev account); confirm modal opens with pretty-printed JSON; click Copy; paste elsewhere and confirm content matches |
| Empty-state full-page render | EXT-D-19 | Requires manipulating shared Supabase data or staging an empty project state | Switch to a dev project where `analytics_events` has 0 rows with `app_source='tpc-extension'`; load `/extension`; confirm centered empty state, no chart skeletons |
| Cross-route URL filter sharing | EXT-D-17 | URL-as-state contract has surprising interactions on browser back/forward | Apply user + version filters; copy URL; open new tab; confirm same filters re-applied; click browser Back; confirm filters revert |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter (toggled to true by `/gsd-validate-phase` after planning)

**Approval:** pending
