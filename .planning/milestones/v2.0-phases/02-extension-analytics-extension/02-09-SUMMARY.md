---
phase: 02-extension-analytics-extension
plan: 09
subsystem: extension-analytics
tags: [smoke-test, integration, verification, phase-closeout, operator-checkpoint]
requires:
  - phase: 02-extension-analytics-extension
    provides: "All 8 prior plans (02-01..02-08) merged: SQL RPCs (02-01), URL filter hooks + dev allowlist (02-02), services + chart/feed hooks (02-03), admin chart components (02-04), tables + UserMultiSelect (02-05), LiveEventFeed (02-06), DeveloperPanel + EXT-09 + EXT-10 (02-07), page shell + route + sidebar nav (02-08); src/lib/supabase exports the anon client (Phase 1); src/stores/authStore exposes profile.email"
provides:
  - "src/pages/Extension.smoke.test.tsx — integration smoke test mounting REAL ExtensionPage with REAL chart/table/feed/dev-panel children, stubbing only Supabase at the network boundary"
  - ".planning/phases/02-extension-analytics-extension/02-VERIFICATION.md — phase-closing verification report cross-referencing the 6 ROADMAP success criteria with implemented surfaces + per-decision invariant table (D-01..D-21) + 173 Phase 2 tests / 254 project total"
affects:
  - "Phase 2 closeout: 8 of 9 plans now have programmatic verification through colocated tests + this integration smoke. Plan 02-09 Task 2 (operator manual smoke at /extension against the live shared Supabase project) remains OPEN — it cannot be automated and is the final gate before Phase 2 sign-off"
  - "Phase 3 (TPC App Activity) reuses the integration-smoke shape: real components + stub at the supabase boundary + Recharts JSDom mock. The 4-test pattern (gate-has-rows / gate-empty / gate-error / filter-change-refetch) is replicated by Phase 3's analog page smoke"
tech-stack:
  added: []
  patterns:
    - "Integration smoke pattern: import the real page, mount it inside MemoryRouter + QueryClientProvider, stub ONLY supabase (../lib/supabase) and the auth store. All chart/table/feed components are real — only the network is mocked. console.error spy in Test 1 catches React warnings (key prop, hook violations) that unit tests with stub children miss"
    - "Smart chain mock: from() returns a chain that records its calls and decides fixture data based on chain composition (gate probe = .select('id') + .limit(1) → returns gateRows; everything else → selectData). Per-test override via the supabaseStub.current swap pattern (vi.hoisted)"
    - "RPC routing by name: rpc.mockImplementation((name, args) => …) lets us return shape-appropriate fixtures per RPC (e.g. get_per_user_summary returns PerUserRow shape so UserMultiSelect's option list works in Test 4)"
    - "Filter-change-triggers-refetch verification at the integration layer: mount the REAL UserMultiSelect, toggle a user, await the next fetch tick, scan recorded calls for .in('user_email', [...]) OR rpc({p_users: [...]}) — both shapes are valid filter propagation"
key-files:
  created:
    - "src/pages/Extension.smoke.test.tsx (350 lines, 4 test cases)"
    - ".planning/phases/02-extension-analytics-extension/02-VERIFICATION.md (160 lines)"
    - ".planning/phases/02-extension-analytics-extension/02-09-SUMMARY.md (this file)"
  modified: []
key-decisions:
  - "Smart-chain routing implemented: the supabase from() mock differentiates the gate probe from other selects by detecting the chain pattern (`.select('id') + .limit(1)`). Without this, fixture rows for the gate probe would also surface in RecentErrorsTable's chain → the table's `formatTimestampShort(undefined)` would throw at render time. The smart chain keeps the smoke test focused on composition rather than per-query data plumbing"
  - "RPC mock routes by RPC name: get_per_user_summary returns one PerUserRow with user_email_label='user@x.com' so UserMultiSelect renders an option list with that email. All other RPC calls return [] (per-card empty branches render harmlessly via D-20)"
  - "vi.hoisted + per-test stub swap pattern (supabaseStub.current = makeSupabaseStub({...})) chosen over re-mocking the module per test. This sidesteps Vitest's hoisting + module-cache interactions that would otherwise complicate per-test fixtures"
  - "console.error spy mock added to Test 1 to catch React warnings during a clean mount. Unit tests with stub children would miss things like missing `key` props, hook violations, prop-type mismatches that only surface when the real component tree is mounted"
patterns-established:
  - "Page-level integration smoke pattern: future phases (Phase 3 /activity, Phase 5 /live) replicate the 4-case shape (gate-has-rows / gate-empty / gate-error / filter-change-refetch) with their own page-level gate hook + filter selector. The smart chain routing is reusable verbatim"
  - "Phase-closeout VERIFICATION pattern: ROADMAP success criteria mapped to implementations + tests + smoke + manual UAT, plus a per-decision invariant table with file/test cites. Mirrors Phase 1's 01-VERIFICATION.md structure"
requirements-completed: [EXT-01, EXT-02, EXT-03, EXT-04, EXT-05, EXT-06, EXT-07, EXT-08, EXT-09, EXT-10]

# Metrics
duration_minutes: 9
completed: 2026-04-30
---

# Phase 02 Plan 09: Integration Smoke + VERIFICATION + Operator Manual Smoke Summary

**Status: PARTIALLY COMPLETE — Task 1 (integration smoke) and Task 3 (VERIFICATION.md) DONE and committed; Task 2 (operator manual smoke at `/extension` against the live shared Supabase project) is OPEN and returned to the orchestrator as a checkpoint. Phase 2 cannot be marked fully closed until the operator runs through the 10-step verification at Plan 02-09 Task 2 `<how-to-verify>` and confirms `count = 0` for `user_email = 'test@example.com'` against the live `analytics_events` table (Checker WARNING #8 invariant — no production writes).**

## What Shipped (Tasks 1 + 3)

### Task 1: Integration smoke test — `src/pages/Extension.smoke.test.tsx`

The ONLY file in Phase 2 that imports the REAL chart/table/feed/dev-panel components AND a real router AND a real `QueryClient`. Mock is at the lowest reasonable boundary: the Supabase client module (`../lib/supabase`) and the auth store (Zustand). All other components mount for real.

**4 test cases:**

| # | Test | What it proves |
|---|------|----------------|
| 1 | `mounts all sections without errors when gate has rows` | Real component composition does not throw; all 6 admin-surface testids present (`ext-01-card`, `ext-02-strip`, `ext-03-card`, `ext-04-card`, `ext-05-card`, `ext-08-feed`); DeveloperPanel returns null for admin email; no console.error |
| 2 | `shows empty state when gate returns 0 rows` | D-19 + Pattern 5: when gate fetch returns `[]`, page renders empty-state copy `No extension events yet` and NO chart testids appear in DOM |
| 3 | `does not crash when gate probe errors` | Gate fetch error does NOT throw during render — page surfaces the error state or composed-tree-with-per-card-errors; no exception escapes |
| 4 | `filter change re-fetches all charts (EXT-07 integration)` | Mounts the REAL UserMultiSelect, opens the popover, toggles `user@x.com`, awaits the next fetch tick. Asserts at least ONE new call carries the user filter via `.in('user_email', ['user@x.com'])` (raw select) OR `p_users: ['user@x.com']` (RPC). Proves filter-change-triggers-refetch through the composed page (covers EXT-07 at the integration layer) |

**All 4 tests pass.** The Recharts JSDom mock pattern is the only chart-rendering shim — chart components are real (EventVolumeChart, KpiStrip, ErrorRateChart, LiveEventFeed all mount).

### Task 3: Phase-closing VERIFICATION report — `.planning/phases/02-extension-analytics-extension/02-VERIFICATION.md`

160 lines. Cross-references:

- **6 ROADMAP success criteria** (Phase 2 § Success Criteria lines 54-60) mapped to implementations + per-component tests + integration smoke + the open operator manual smoke
- **Per-decision invariant table** covering D-01 through D-21 with the file/test that proves each (e.g. D-01: SQL static verifier + queries.test.ts + 7 hits in queries.ts; D-15: DeveloperPanel returns null + literal-grep verifier returning 0 for `display:hidden`)
- **Test count summary by plan**: 173 Phase 2 tests across 22 colocated test files; 254 project total (81 from Phase 1)
- **Cross-cutting invariants**: D-01 enforced at SQL + TS + prebuild verifier; D-02 declared once + defense-in-depth in chart components; ErrorState locked contract honored everywhere; TanStack Table v8 pinned + `flexRender` API in use; useDistinctVersions is sole source of EXT-09 option list
- **Build & test pipeline status table**
- **Operator sign-off checklist** (5 unchecked boxes — gated on Task 2)
- **Per-plan summary deep-dive index** linking all 9 02-NN-SUMMARY.md files

## What's OPEN (Task 2)

**Operator manual smoke at `/extension` against the live shared Supabase project** — the only test in Phase 2 that touches the live DB. Cannot be automated. Returned to the orchestrator as a checkpoint for the operator to execute against their browser.

The 10-step verification is in Plan 02-09 Task 2 `<how-to-verify>`:

1. Sign in as dev account `josh@potomackco.com` via `npm run dev` → navigate to `/extension`
2. Confirm sidebar accent treatment activates (`text-accent border-l-2 border-accent bg-accent/5`)
3. Confirm page chrome (heading `Extension Analytics`, subtitle `Cataloger Chrome extension activity`, browser tab `Extension — TPC Dashboard`, both filters render)
4. If live table is empty for `app_source='tpc-extension'`: confirm centered `<EmptyState>` with heading `No extension events yet` + filter row still rendered above it
5. If data present: confirm EXT-01 stacked bar (14 daily buckets / 24 hourly for `?range=today`), EXT-02 5 KPI cards, EXT-03 horizontal bars, EXT-04 user table (Unknown italic-gray), EXT-05 newest 100 errors
6. **Live feed Pause/Resume timing** — Checker WARNING #8 / NO production writes. Choose ONE of: Option A (dev/staging Supabase project — preferred), Option B (passive wait for natural extension activity), Option C (atomic SQL block with rollback — visibility-limited, documents the attempt only). Verify post-smoke `count = 0` for `user_email = 'test@example.com'` against the live `analytics_events` table
7. Dev panel: scroll to bottom, confirm collapsed row, dominant-version chip, expand, version filter + cancellation-rate KPIs visible, toggling version updates the rest of the page
8. Payload viewer: click `View →` in EXT-05, confirm modal opens with pretty-printed JSON, Copy button, Escape closes
9. Sign out, sign in as a non-dev admin. Confirm: same chrome; DeveloperPanel NOT in DOM (DevTools Elements search); EXT-05 Payload column header visible but `View →` cells blank; EXT-08 row clicks no-op
10. URL filter sharing: apply user + version filters as dev, copy URL, open in new tab as admin. Same filters apply but admin has no version filter UI (D-17 accepted trade-off)

**Acceptance:** reply `approved` once all 10 steps pass, screenshots saved (live-feed running, paused, dev panel expanded, admin DOM without dev panel), and the production-cleanliness `count = 0` check returns clean.

## Performance

- **Duration:** ~9 min (executor — Tasks 1 + 3 only; Task 2 is operator-driven)
- **Started:** 2026-04-30T15:01:19Z
- **Tasks 1 + 3 completed:** 2026-04-30T15:10:02Z
- **Tasks completed (executor):** 2 of 3 (Task 2 returned as checkpoint)
- **Files created:** 3 (smoke test + VERIFICATION + this summary)
- **Files modified:** 0

## Verification

| Step | Command | Result |
|------|---------|--------|
| Smoke test (4 cases) | `npx vitest --run src/pages/Extension.smoke.test.tsx` | **4 passed** |
| Full project test suite | `npx vitest --run` | **254 passed** (34 files), no regressions (was 250; +4 new) |
| Project typecheck | `npx tsc -b --noEmit` | clean |
| Lint, scoped to new file | `npx eslint src/pages/Extension.smoke.test.tsx` | clean |
| VERIFICATION.md required sections present | inline node script (plan automated check) | OK |

## Commits

| Task | Type | Hash | Message |
|------|------|------|---------|
| 1 | test | `19d7964` | test(02-09): add integration smoke for ExtensionPage with real components |
| 3 | docs | `9b7e3eb` | docs(02-09): add Phase 2 VERIFICATION report |

Task 2 is operator-driven; no executor commit.

## TDD Gate Compliance

The plan tagged Task 1 with `tdd="true"`. Strict TDD interpretation (write test first, verify failure, then implement) is moot here because Task 1 ships ONLY a test against an already-implemented module (`src/pages/Extension.tsx` from Plan 02-08). The test was written first, and on the very first run failed at Test 4 — the failure surface was a real bug in the fixture/chain plumbing (RecentErrorsTable's `formatTimestampShort` choked on a row that lacked `created_at`). The test was iterated until it captured the integration contract correctly; the page implementation itself was not modified. This counts as a (legitimate) "test asserts existing behavior" rather than a new feature TDD cycle, and is acknowledged here.

For Task 3, no TDD applies — it ships a documentation artifact.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Smart-chain routing in supabase from() mock**

- **Found during:** Task 1 first run of Test 4
- **Issue:** Test 4 fixture provided `selectData: [{ user_email_label, extension_version }]`, which was returned from EVERY `from('analytics_events')` chain — including RecentErrorsTable's. RecentErrorsTable's `created_at` cell renderer called `formatTimestampShort(undefined)` → `formatInTimeZone` threw `RangeError: Invalid time value`, which propagated to React rendering and destroyed the DOM tree. The popover button was no longer findable in subsequent assertions because the React tree was gone.
- **Fix:** Replaced the dumb chain mock with a smart chain that detects the gate probe pattern (`.select('id') + .limit(1)` → returns `gateRows`) vs other selects (returns `selectData`, default empty array). The PerUserSummary fixture moved to the RPC mock keyed by name (`get_per_user_summary`). RecentErrorsTable + LiveEventFeed now receive `[]` and render their empty branches harmlessly.
- **Files modified:** `src/pages/Extension.smoke.test.tsx` only
- **Commit:** folded into `19d7964`

**2. [Rule 1 — Bug] Unused `_table` parameter lint error**

- **Found during:** Task 1 post-tests `npx eslint`
- **Issue:** Two `from: vi.fn().mockImplementation((_table: string) => …)` arrow functions had unused `_table` params. The repo's ESLint config (`@typescript-eslint/no-unused-vars` default) does not exempt `_`-prefixed args, so both reported errors.
- **Fix:** Removed the unused param. The mock function works the same way without it (the table arg goes unused regardless because the smart chain only inspects chain composition).
- **Files modified:** `src/pages/Extension.smoke.test.tsx`
- **Commit:** folded into `19d7964`

### Architectural changes

None.

### Authentication gates

None — the smoke test stubs the auth store at the module boundary; no real auth flow is exercised.

## Threat Model Compliance

| Threat ID | Mitigation Status | Evidence |
|-----------|-------------------|----------|
| T-02-32 (Tampering — smoke test passes due to over-mocking) | mitigate | Smoke explicitly mocks ONLY at the supabase boundary + auth-store boundary; chart/table/feed/dev-panel components are REAL. console.error spy in Test 1 catches React warnings (key prop, hook violations). The 4-case spread (gate-has-rows / gate-empty / gate-error / filter-change-refetch) covers the three branches a unit-test stub composition would miss |
| T-02-33 (Information Disclosure — operator pollutes production analytics_events during step 6) | mitigate (BLOCKED on operator) | Plan 02-09 Task 2 step 6 rewritten to forbid production writes; Options A/B/C documented; acceptance criterion in `<resume-signal>` requires `count = 0` for `user_email = 'test@example.com'` post-smoke. THIS IS THE OPEN GATE — until operator confirms cleanliness, Phase 2 cannot be marked closed |
| T-02-34 (Repudiation — VERIFICATION.md claims green status without operator sign-off) | mitigate | Task 3 VERIFICATION.md includes the explicit operator sign-off checklist (5 unchecked boxes); the file is incomplete until ticked. `/gsd-verify-work` should refuse to advance if the checklist has empty boxes |

## Stub Tracking

No stubs introduced. The smoke test asserts real-component composition; the VERIFICATION.md is a real prose-and-table document with concrete file/test cites for every invariant.

## Threat Flags

None new. The integration smoke introduces no network endpoints, no auth paths, no schema, no file access patterns. The VERIFICATION report is documentation only.

## Self-Check: PASSED

Files created (verified via `[ -f path ]`):
- FOUND: src/pages/Extension.smoke.test.tsx
- FOUND: .planning/phases/02-extension-analytics-extension/02-VERIFICATION.md
- FOUND: .planning/phases/02-extension-analytics-extension/02-09-SUMMARY.md

Commits (verified via `git log --oneline | grep`):
- FOUND: 19d7964 (test — Task 1)
- FOUND: 9b7e3eb (docs — Task 3)

Test count delta verified: 250 → 254 (+4; matches Test 1 + Test 2 + Test 3 + Test 4).

OPEN: Plan 02-09 Task 2 (operator manual smoke). Returned to the orchestrator as a checkpoint. Phase 2 cannot be marked closed until the operator completes the 10-step verification and reports `approved` with the `count = 0` production-cleanliness invariant satisfied.

---
*Phase: 02-extension-analytics-extension*
*Plan: 09*
*Status: PARTIALLY COMPLETE — Task 2 operator manual smoke OPEN*
