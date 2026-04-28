---
phase: 01-infrastructure-shared-ui-kit
plan: 05
subsystem: ui-kit
tags: [INFR-03, ui-kit, recharts, sparkline, kpi-card, payload-modal, date-range-filter, vitest, tailwind-v4]

requires:
  - phase: 01-infrastructure-shared-ui-kit
    provides: "src/hooks/useDateRange (plan 01-04 — DateRangeFilter consumes URL-state hook)"
  - phase: 01-infrastructure-shared-ui-kit
    provides: "src/hooks/useTimezone (plan 01-04 — drafts mirror current ET-resolved range)"
provides:
  - "src/components/kit/Sparkline — bare Recharts LineChart, no axes/grid/tooltip, ResponsiveContainer-sized"
  - "src/components/kit/KpiCard — presentational label/value/delta/sparkline-slot card with loading skeleton"
  - "src/components/kit/PayloadViewerModal — native <dialog>-based JSON pretty-print + clipboard copy"
  - "src/components/kit/DateRangeFilter — segmented Today/7d/30d/Custom presets + popover with native date inputs, URL-bound"
affects:
  - "Phase 2 (/extension) — KPI strip, Recent Errors payload viewer, date filter all consume these primitives"
  - "Phase 3 (/activity) — Today KPI strip (APP-01), date filter, sparklines"
  - "Phase 5 (/live) — pace sparkline, KPI tiles, anomaly payload viewer"
  - "Plan 01-06 — /kit demo route imports all four for visual verification"

tech-stack:
  added:
    - "recharts ^3.8.1 (root package.json — pinned to CLAUDE.md authority)"
  patterns:
    - "Recharts ResponsiveContainer mock for JSDom — inject explicit width/height into the LineChart child via cloneElement so the chart can size without layout measurement"
    - "Native HTML <dialog> with showModal()/close() effects + JSDom polyfill in beforeEach"
    - "userEvent.setup({ writeToClipboard: false }) + Object.defineProperty(navigator, 'clipboard', ...) — works around JSDom's read-only clipboard accessor"
    - "URL-bound presentational components (no controlled props on filter) — internal hook consumption keeps callers from wiring URL manually"
    - "data-testid attributes for stable test selection without depending on Tailwind class string drift"

key-files:
  created:
    - "src/components/kit/Sparkline.tsx — Recharts LineChart wrapper, isAnimationActive={false}, no axes/grid/tooltip"
    - "src/components/kit/Sparkline.test.tsx — 6 Vitest specs (default sizing, SVG path, axis absence, empty data, className, custom dims)"
    - "src/components/kit/KpiCard.tsx — D-13 presentational shape with delta direction → Tailwind color map"
    - "src/components/kit/KpiCard.test.tsx — 10 Vitest specs (loading skeleton, render, all 3 delta directions, label, slots, absences)"
    - "src/components/kit/PayloadViewerModal.tsx — native <dialog>, JSON.stringify(payload, null, 2), navigator.clipboard.writeText, no syntax highlighting"
    - "src/components/kit/PayloadViewerModal.test.tsx — 9 Vitest specs (open/close, JSON body, close button, backdrop, clipboard, titles, native close event)"
    - "src/components/kit/DateRangeFilter.tsx — 4 preset buttons + custom popover with two <input type=date>, consumes useDateRange"
    - "src/components/kit/DateRangeFilter.test.tsx — 8 Vitest specs (preset render/labels, default 7d active, custom-URL active, preset URL write, popover open without URL change, popover fields, Apply round-trip, Cancel-no-mutation)"
  modified:
    - "package.json — recharts ^3.8.1 added to dependencies"
    - "package-lock.json — lockfile resolution for recharts subgraph (40 packages added)"

key-decisions:
  - "Sparkline test mocks Recharts ResponsiveContainer to inject explicit width/height props into its LineChart child via cloneElement. JSDom returns 0 for clientWidth/Height, so the real ResponsiveContainer never reaches a positive size and the SVG never renders. The component under test still imports the real ResponsiveContainer in production — the mock is test-environment-only."
  - "PayloadViewerModal copy-to-clipboard test uses userEvent.setup({ writeToClipboard: false }) AND defineProperty on navigator.clipboard (JSDom 28+ exposes navigator.clipboard as a read-only getter, blocking Object.assign; userEvent v14 also installs its own clipboard fake during setup that masks our stub if not disabled)."
  - "DateRangeFilter is presentational with no controlled props — it reads/writes URL via useDateRange directly. Callers drop <DateRangeFilter /> in a route and the URL becomes the single source of truth (D-18 + D-20)."
  - "All four components expose data-testid attributes for stable test selection without depending on Tailwind class strings that may drift through visual iteration."

patterns-established:
  - "src/components/kit/ subfolder for v2.0 shared primitives (visual separation from v1.0 components retained per D-25)"
  - "Tailwind v4 utility classes inline in JSX — no @apply, no tw() helper (CLAUDE.md convention)"
  - "delta-direction → color map: up=text-green-600, down=text-red-600, flat=text-gray-500. Semantic mapping (up=good vs up=bad) is caller's responsibility."
  - "loading skeleton pattern: 3 animate-pulse bars with role='busy' on container, value testid hidden in loading state"
  - "Recharts isAnimationActive={false} mandatory for KPI sparklines — anti-flicker on filter changes"

requirements-completed: [INFR-03]

duration: 9min
completed: 2026-04-28
---

# Phase 1 Plan 05: Shared UI-Kit Primitives (INFR-03) — Summary

**Four typed Tailwind v4 React components — `<Sparkline>` (Recharts LineChart, no axes), `<KpiCard>` (label/value/delta/sparkline-slot with loading skeleton), `<PayloadViewerModal>` (native &lt;dialog&gt; + 2-space JSON pretty-print + clipboard copy), and `<DateRangeFilter>` (segmented Today/7d/30d/Custom presets + popover with native date inputs, URL-bound via useDateRange) — each with a colocated Vitest+RTL behavior suite.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-04-28T18:51:08Z
- **Completed:** 2026-04-28T18:59:51Z
- **Tasks:** 5
- **Files modified:** 2 (package.json, package-lock.json)
- **Files created:** 8 (4 components + 4 colocated test files)

## Accomplishments

- recharts pinned at `^3.8.1` (CLAUDE.md Charting authority) — only frontend chart dep added in this plan.
- All four UI-kit primitives authored under `src/components/kit/` with typed props matching D-12/D-13/D-14/D-18 contracts byte-for-byte.
- 33 new Vitest specs added; full Phase 1 suite now 81/81 passing across 12 test files.
- TypeScript compilation clean (`tsc -b`); Vite production build succeeds; prebuild service-role guard stays green.
- DateRangeFilter consumes `useDateRange` (plan 01-04) — first downstream consumer of the URL-state hook, validating its contract end-to-end.

## Task Commits

Each task was committed atomically:

1. **Task 1: Install recharts@^3.8.1** — `818e1f4` (chore)
2. **Task 2: Sparkline.tsx + 6-spec test** — `c3784a9` (feat)
3. **Task 3: KpiCard.tsx + 10-spec test** — `bd4963f` (feat)
4. **Task 4: PayloadViewerModal.tsx + 9-spec test** — `e41b688` (feat)
5. **Task 5: DateRangeFilter.tsx + 8-spec test** — `b72682d` (feat)

_Note: Plan TDD model is "author component + colocated test in one task." Each commit lands the matching pair plus any required test infrastructure._

## Files Created/Modified

### Created

- `src/components/kit/Sparkline.tsx` — Recharts `<LineChart>` + `<Line>` inside `<ResponsiveContainer>`, no axes/grid/tooltip, `isAnimationActive={false}`. Default `width='100%'`, `height={32}`, `stroke='currentColor'`. Wraps in a `data-testid="sparkline"` div with `aria-hidden="true"` (decorative — real numbers live in the parent KpiCard).
- `src/components/kit/Sparkline.test.tsx` — 6 specs. Mocks `ResponsiveContainer` to inject explicit `width`/`height` props into the child chart via `cloneElement`, working around JSDom's zero-layout limitation.
- `src/components/kit/KpiCard.tsx` — Presentational card with the D-13 verbatim prop shape. Loading state renders 3 `animate-pulse` skeleton bars; non-loading renders label (uppercase tracking), `text-3xl` value, optional delta colored per direction, optional sparkline slot. `aria-busy="true"` during loading.
- `src/components/kit/KpiCard.test.tsx` — 10 specs covering: loading skeleton, label/value render, string vs number value, all 3 delta directions, optional delta label, sparkline slot rendering, delta absence, sparkline-slot absence.
- `src/components/kit/PayloadViewerModal.tsx` — Native `<dialog ref>` with effect-driven `showModal()`/`close()` sync to the `open` prop. Renders `JSON.stringify(payload, null, 2)` inside a `<pre>` (React text-content escaping covers T-1-XSS). Copy button writes via `navigator.clipboard.writeText` and flips to "Copied!" for 2 seconds. Click on the dialog element itself (backdrop) and the native `close` event (Esc) both invoke `onClose`. Default title `"Payload"`.
- `src/components/kit/PayloadViewerModal.test.tsx` — 9 specs. `beforeEach` polyfills `HTMLDialogElement.prototype.showModal/close` (JSDom gap) with explicit `this: HTMLDialogElement` typing. Clipboard test uses `userEvent.setup({ writeToClipboard: false })` plus `Object.defineProperty(navigator, 'clipboard', ...)` to work around JSDom 28+'s read-only clipboard accessor and userEvent v14's clipboard fake.
- `src/components/kit/DateRangeFilter.tsx` — 4 segmented preset buttons (Today / 7d / 30d / Custom) with `aria-pressed` reflecting the current `range` from `useDateRange`. Clicking Custom opens a popover with two `<input type="date">` (From / To) plus Apply / Cancel. Apply calls `setCustom(new Date(from + 'T00:00:00'), new Date(to + 'T23:59:59'))`. Outside-click and Escape dismiss the popover without mutating the URL.
- `src/components/kit/DateRangeFilter.test.tsx` — 8 specs. Uses `MemoryRouter` + a `<LocationEcho>` helper that prints `useLocation().search` so tests can assert URL state directly.

### Modified

- `package.json` — `recharts: ^3.8.1` added to `dependencies`.
- `package-lock.json` — 40 packages added across the recharts subgraph.

## Decisions Made

- **Recharts ResponsiveContainer JSDom mock pattern**: a test-time mock injects explicit width/height into the `<LineChart>` child via `cloneElement`. The component remains unchanged; only the test bypasses JSDom's zero-layout. Future Recharts components in plans 01-06 / 02 / 03 / 05 should reuse this pattern (or an equivalent shared helper) verbatim.
- **Tailwind v4 inline classes throughout** — no `@apply`, no helper functions. Matches CLAUDE.md convention and the v1.0 components (`TableSkeleton`, `FilterInput`).
- **Semantic neutrality of delta direction colors** — `KpiCard` always renders `up=green / down=red / flat=gray`. If a metric is "up=bad" (e.g., error rate), the caller passes `direction='down'` for an increase. KpiCard never inspects what the metric means.
- **`<DateRangeFilter>` is fully URL-driven, not controlled** — no `value` / `onChange` props. Drop it anywhere within a router-wrapped tree and the URL becomes the single source of truth. Callers consume the same state via `useDateRange()` separately.
- **`PayloadViewerModal` default title `"Payload"`** rather than throwing on missing title — Phase 2 EXT-06 will pass a more specific title (e.g., "Event details — catalog_batch") but a sensible default keeps the kit demo (plan 01-06) trivial.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Tooling] Recharts cannot render under JSDom without a layout shim**
- **Found during:** Task 2 (Sparkline test)
- **Issue:** Initial test failed with "expected null not to be null" on the SVG query because Recharts `ResponsiveContainer` reports zero clientWidth/clientHeight under JSDom and bails out of rendering the chart body. Adding a fixed-size parent wrapper alone was not enough — Recharts 3.x still skipped the SVG.
- **Fix:** Added a `vi.mock('recharts', ...)` block that replaces `ResponsiveContainer` with a div that uses `cloneElement` to inject explicit `width={200}` / `height={32}` props into its `LineChart` child. The component under test is unchanged; only test-time rendering is patched. Documented as a reusable pattern in the file for future Recharts test files.
- **Files modified:** `src/components/kit/Sparkline.test.tsx`
- **Verification:** All 6 Sparkline specs pass; chart's `<svg>` and `<path>` are now queryable.
- **Committed in:** `c3784a9` (Task 2 commit)

**2. [Rule 3 — Tooling] navigator.clipboard is read-only in JSDom 28+**
- **Found during:** Task 4 (PayloadViewerModal copy test)
- **Issue:** Plan-template snippet `Object.assign(navigator, { clipboard: { writeText } })` threw `TypeError: Cannot set property clipboard of #<Navigator> which has only a getter`. After switching to `Object.defineProperty`, the test still saw 0 calls because `userEvent.setup()` v14 installs its own clipboard fake during setup that mask the stub.
- **Fix:** Changed to `userEvent.setup({ writeToClipboard: false })` (suppresses user-event's clipboard system), THEN `Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true, writable: true })` (works around JSDom's getter-only accessor). Stub installed AFTER setup so it isn't overwritten.
- **Files modified:** `src/components/kit/PayloadViewerModal.test.tsx`
- **Verification:** All 9 PayloadViewerModal specs pass; the `writeText` mock receives the JSON-stringified payload exactly once.
- **Committed in:** `e41b688` (Task 4 commit)

**3. [Rule 1 — Bug] HTMLDialogElement polyfill `this` typing under tsc strict**
- **Found during:** Task 5 verification (`npm run build` after authoring all four components)
- **Issue:** `tsc -b` failed with `error TS2683: 'this' implicitly has type 'any' because it does not have a type annotation.` on the JSDom polyfill installed in `PayloadViewerModal.test.tsx` `beforeEach`. The original cast `as () => void` masked the implicit-any but not under strict mode.
- **Fix:** Added explicit `this: HTMLDialogElement` parameter typing to both `showModal` and `close` polyfill functions. No runtime change.
- **Files modified:** `src/components/kit/PayloadViewerModal.test.tsx`
- **Verification:** `npm run build` exits 0; `npm test` 81/81 still green.
- **Committed in:** `b72682d` (Task 5 commit — bundled with DateRangeFilter since the build verification was the discovery point)

---

**Total deviations:** 3 auto-fixed (1 Rule 1 build typing, 2 Rule 3 test infrastructure)
**Impact on plan:** All three are test-environment / build adapters required to run the plan-specified test patterns under JSDom 28 + Vitest 4 + tsc strict. No scope creep — component implementations are the plan-specified code byte-for-byte.

## Issues Encountered

- None beyond the three deviations above. All four component contracts (D-12, D-13, D-14, D-18) implemented exactly as the plan specified.

## Threat Mitigations Applied

| Threat ID | Mitigation |
| --------- | ---------- |
| T-1-XSS (PayloadViewerModal) | `<pre>{JSON.stringify(payload, null, 2)}</pre>` relies on React's default text-content escaping. Acceptance grep confirmed `dangerouslySetInnerHTML` is absent from the file. |
| T-1-CLIPBOARD | Copy is intentional user action via `navigator.clipboard.writeText`; clipboard-blocked browsers swallow silently (button stays "Copy") — graceful degradation, no information leak. |
| T-1-URL-TAMPER | All URL mutations go through `useDateRange.setRange` / `setCustom` (validated by plan 01-04). Native `<input type="date">` lets the browser reject malformed entries before they reach setCustom; `setCustom` constructs `new Date(...)` which the upstream hook validates. |
| T-1-SRK | Components live in `src/`; static-grepped for `SUPABASE_SERVICE_ROLE_KEY` — none present. Plan 01-02's prebuild guard stays clean (`npm run build` confirms). |

## Success Criteria Addressed

- [x] `package.json` contains `recharts@^3.8.1`
- [x] `src/components/kit/` contains 4 .tsx + 4 .test.tsx files (8 total), all passing
- [x] `<Sparkline>` renders Recharts `<LineChart>` with no axis/grid/tooltip; `isAnimationActive={false}`
- [x] `<KpiCard>` matches D-13 prop shape with loading skeleton + delta direction colors (text-green-600 / text-red-600 / text-gray-500)
- [x] `<PayloadViewerModal>` uses native `<dialog>` with Esc/backdrop close, `JSON.stringify(payload, null, 2)` in `<pre>`, `navigator.clipboard.writeText` copy
- [x] `<DateRangeFilter>` consumes `useDateRange` and renders segmented preset buttons + custom popover with native date inputs
- [x] `npm run test` full Phase 1 suite passes: 81/81 across 12 files
- [x] `npm run build` succeeds (tsc strict + vite, prebuild guard included)
- [ ] ROADMAP Phase 1 Success Criterion 2 — components exist with typed props + Tailwind v4. Visual + `/kit` demo validation deferred to plan 01-06.

## User Setup Required

None — purely additive frontend changes. No new env vars, no dashboard configuration, no migrations.

## Next Phase Readiness

**Unblocks plan 01-06** — `/kit` demo route can now `import { Sparkline, KpiCard, PayloadViewerModal, DateRangeFilter } from '../components/kit/...'` and render each in multiple states.

**Unblocks Phase 2** (`/extension`) — KPI strip (EXT-02) consumes `KpiCard` + `Sparkline`; Recent Errors table (EXT-06) opens `PayloadViewerModal`; the page-wide filter is `DateRangeFilter`.

**Unblocks Phase 3** (`/activity`) — Today KPI strip (APP-01) is the same `KpiCard` pattern.

**Unblocks Phase 5** (`/live`) — pace sparkline (LIVE-04) and anomaly payload viewer (LIVE-07) consume these primitives.

No blockers introduced. No new external services. Phase 1 plan 01-06 (final plan in this phase) remains: ship the dev-only `/kit` demo route + a tree-shake verifier ensuring the route is stripped from production bundles.

## Self-Check: PASSED

- FOUND: `src/components/kit/Sparkline.tsx`
- FOUND: `src/components/kit/Sparkline.test.tsx`
- FOUND: `src/components/kit/KpiCard.tsx`
- FOUND: `src/components/kit/KpiCard.test.tsx`
- FOUND: `src/components/kit/PayloadViewerModal.tsx`
- FOUND: `src/components/kit/PayloadViewerModal.test.tsx`
- FOUND: `src/components/kit/DateRangeFilter.tsx`
- FOUND: `src/components/kit/DateRangeFilter.test.tsx`
- FOUND: commit `818e1f4` (Task 1 — recharts install)
- FOUND: commit `c3784a9` (Task 2 — Sparkline)
- FOUND: commit `bd4963f` (Task 3 — KpiCard)
- FOUND: commit `e41b688` (Task 4 — PayloadViewerModal)
- FOUND: commit `b72682d` (Task 5 — DateRangeFilter + build typing fix)

---
*Phase: 01-infrastructure-shared-ui-kit*
*Completed: 2026-04-28*
