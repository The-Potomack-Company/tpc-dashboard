# Phase 2: Extension Analytics (`/extension`) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-29
**Phase:** 02-extension-analytics-extension
**Areas discussed:** Data scoping rules, Live feed mechanism, Query architecture, Empty / partial state UX, Admin / Developer surface split

---

## Data Scoping Rules

### Q1 — How should we filter rows so only extension events reach `/extension`?

| Option | Description | Selected |
|--------|-------------|----------|
| Strict tpc-extension only | Hard-filter `where app_source = 'tpc-extension'`. Drops legacy NULL-source rows. Cleanest invariant. | ✓ |
| Include legacy NULL rows | Filter `app_source = 'tpc-extension' OR app_source IS NULL`. Treats pre-006 rows as extension. | |
| Make it a UI toggle | Top-level scope filter (Extension / All / TPC App). | |

**User's choice:** Strict tpc-extension only.
**Notes:** Lock in `app_source = 'tpc-extension'` on every query. Most-likely-forgotten invariant — calling out in CONTEXT.md specifics for code review.

### Q2 — How should `catalog_item` (W2 child rows) appear in EXT-01's stacked bar?

| Option | Description | Selected |
|--------|-------------|----------|
| Hide catalog_item from top-level charts | 5-event vocabulary; matches REQUIREMENTS.md text. catalog_item reachable via batch drill-down later. | ✓ |
| Include as 6th segment / 6th KPI card | Reflects true emitted vocabulary; double-counts batch activity. | |
| Show as sub-row inside catalog_batch only | Top-level stays 5-wide; surfaced in EXT-04 / EXT-05 with batch context. | |

**User's choice:** Hide catalog_item from top-level charts.

### Q3 — Canonical "error" signal?

| Option | Description | Selected |
|--------|-------------|----------|
| REQUIREMENTS-literal: `error_message IS NOT NULL` | Single source of truth across all event types. Caveat: catalog_item 'skipped' rows carry skip-reason in error_message. | ✓ |
| Field-aware: per-event-type rule | Use `error_count > 0` for batch summaries, `error_message IS NOT NULL` for singles, `item_status = 'error'` for catalog_item. | |
| Strict carve-out | `error_message IS NOT NULL AND (item_status IS NULL OR item_status = 'error')`. Excludes skip-reason rows. | |

**User's choice:** REQUIREMENTS-literal `error_message IS NOT NULL`.

### Q4 — How should `user_email IS NULL` rows show up in EXT-04 / EXT-07?

| Option | Description | Selected |
|--------|-------------|----------|
| Group as "Unknown" | Aggregate NULL-email rows; selectable in EXT-07 multi-select. EXT-04 totals reconcile with EXT-01 totals. | ✓ |
| Drop NULL-email rows entirely | Simpler; EXT-04 totals won't match EXT-01. | |
| Surface separate top-line counter | Drop from table, callout at page header. | |

**User's choice:** Group as "Unknown".

### Q5 — How is "previous period" defined for EXT-02 KPI deltas?

| Option | Description | Selected |
|--------|-------------|----------|
| Same length, immediately preceding | N-day range → prior N days ending day-before-`from`. | ✓ |
| Calendar-aligned previous period | "Same 7 weekdays last week", etc. Trickier for custom ranges. | |
| Fixed previous 7 days regardless of range | Always last 7d. Surprises users on 30d range. | |

**User's choice:** Same length, immediately preceding.

### Q6 — What defines EXT-09 "dominant version"?

| Option | Description | Selected |
|--------|-------------|----------|
| Most events in current selection | Updates as filters change. Matches "reflects current selection" reading. | ✓ |
| Most recent users-on-version | Steadier signal; tracks installs not events. | |
| Latest semver in selection | Tracks rollout, not usage. | |

**User's choice:** Most events in current selection.

### Q7 — EXT-10 cancellation-rate denominator?

| Option | Description | Selected |
|--------|-------------|----------|
| count(cancelled=true) / count(*) per event_type | Two KPIs, strict per-type. REQUIREMENTS-literal. | ✓ |
| Combined W2+W3 single KPI | One number; loses per-workflow signal. | |
| Exclude rows where cancelled IS NULL | Cleaner ratio; suppresses pre-feature legacy rows. | |

**User's choice:** count(cancelled=true) / count(*) per event_type.

### Q8 — EXT-02 sparkline behavior when range = today?

| Option | Description | Selected |
|--------|-------------|----------|
| Hourly buckets when range=today, daily otherwise | Resolution decided in SQL aggregation. | ✓ |
| Always daily, hide sparkline when range=today | Simplest; visual discontinuity. | |
| Always daily — today gets 1-point sparkline | Lazy; visually broken. | |

**User's choice:** Hourly buckets when range = today.

---

## Live Feed Mechanism

### Q9 — Push (Realtime) or pull (refetchInterval) for the live feed?

| Option | Description | Selected |
|--------|-------------|----------|
| TanStack refetchInterval | Single useQuery + interval; matches Phase 4 SCRP-16 invalidate-driven precedent for high-volume INSERT tables. | ✓ |
| Supabase Realtime subscription | Lower latency; per-row RLS fan-out cost on a high-volume INSERT table. | |
| Hybrid (initial SELECT + Realtime increments) | Best latency / dedupe complexity. | |

**User's choice:** TanStack refetchInterval.

### Q10 — Refetch interval?

| Option | Description | Selected |
|--------|-------------|----------|
| 7 s (recommended) | Mid-band of EXT-08 5–10 s spec. | |
| 5 s | Fastest end of spec. | |
| 10 s | Slowest end of spec; less Supabase load. | ✓ |

**User's choice:** 10 s.
**Notes:** Lighter load on Supabase; cataloging is minute-scale so 10 s is plenty. Easy to change later if operator UAT shows lag.

### Q11 — Pause + Resume behavior?

| Option | Description | Selected |
|--------|-------------|----------|
| A — Pause = stop refetch; Resume = jump to latest | `refetchInterval: false` on pause; resume re-enables + immediately refetches. No backlog. | ✓ |
| B — Pause + freeze + "N new events" banner | Separate count probe while paused; shows "23 new events — click to load". | |
| C — Pause = freeze UI, never stop fetching | Always-on poll; freeze rendering only. Wasteful. | |

**User's choice:** Option A.
**Notes:** Asked Claude to elaborate first; full plain-text breakdown given showing query count, backlog handling, and resume window for each option. User selected Option A after the explanation.

### Q12 — Feed initial state on page mount?

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-tailing on mount | Matches "live ops dashboard left open" use case. | ✓ |
| Paused by default | Two extra clicks every visit; avoids surprise polling. | |
| Persist state in URL (`?feed=on|off`) | Bookmarkable; URL noise. | |

**User's choice:** Auto-tailing on mount.

---

## Query Architecture

### Q13 — Page data layer shape?

| Option | Description | Selected |
|--------|-------------|----------|
| Many TanStack queries, raw SELECTs | One useQuery per chart; TanStack handles caching. | ✓ |
| One server-side aggregating RPC | `get_extension_overview` returns whole-page rollup. | |
| One big SELECT + client-side aggregation | Heaviest payload; flexible. | |

**User's choice:** Many TanStack queries, raw SELECTs.

### Q14 — Server-side or client-side bucketing?

| Option | Description | Selected |
|--------|-------------|----------|
| SQL `date_trunc` on the server | Tiny payloads; aligns to ET via `date_trunc(... AT TIME ZONE 'America/New_York')`. | ✓ |
| Fetch raw rows, bucket in JS via date-fns-tz | Heaviest payload; only worth if SQL bucketing limits hit. | |

**User's choice:** SQL date_trunc on the server.

### Q15 — Where do query helpers live?

| Option | Description | Selected |
|--------|-------------|----------|
| `src/services/extension/queries.ts` + colocated hooks in `src/hooks/extension/` | Clean services/hooks/components split; reusable for Phase 3. | ✓ |
| All-in-one hook file per chart | Fewer files; more duplication if hooks share predicates. | |
| Page-component-local hooks | Tightest cohesion; hardest to reuse. | |

**User's choice:** `src/services/extension/queries.ts` + colocated hooks.

### Q16 — How are filters wired across hooks?

| Option | Description | Selected |
|--------|-------------|----------|
| URL is source of truth; each hook reads it | `useDateRange` + new `useUserFilter` + `useVersionFilter`. Filter changes naturally invalidate dependent queryKeys. | ✓ |
| URL + single `useExtensionFilters()` facade | One facade; one place to change shape. | |
| Page-local Zustand store | Two sources of truth — Phase 1 explicitly avoided this. | |

**User's choice:** URL is source of truth; each hook reads it.

### Q17 (follow-up) — Confirm server-side bucketing path

> Surfaced because Supabase JS query builder doesn't support GROUP BY / date_trunc directly — server-side bucketing requires Postgres functions.

| Option | Description | Selected |
|--------|-------------|----------|
| One RPC per aggregation shape | `get_event_volume_daily`, `get_kpi_totals`, `get_error_rate_by_type`, `get_per_user_summary`. ~4 migrations + types regen. | ✓ |
| Client-side bucketing for aggregations only | Ranged SELECT + JS aggregation; risk on 30d high-volume periods. | |
| Switch to single overview RPC | Consolidates migration count; one round-trip per filter change. | |

**User's choice:** One RPC per aggregation shape.

---

## Empty / Partial State UX

### Q18 — Behavior when extension scope is empty lifetime-wide?

| Option | Description | Selected |
|--------|-------------|----------|
| Full-page empty state | Single probe + centered `<EmptyState>` panel; no charts/tables/feed mounted. | ✓ |
| Per-card empty states only | Always render skeleton; per-card "No events yet". Visually noisy. | |
| Hybrid: page-level if all-time empty, per-card when partial | Best UX, two probe queries. | |

**User's choice:** Full-page empty state.

### Q19 — Behavior when lifetime ≠ 0 but selected range is empty?

| Option | Description | Selected |
|--------|-------------|----------|
| Per-card empty messages | Cards show "—"; charts show empty messages; feed shows "Waiting for events…" | ✓ |
| Hide empty chart entirely | Page reflows on filter change. Jumpy. | |
| Show last-non-empty period as ghost | Clever but confusing. | |

**User's choice:** Per-card empty messages.

### Q20 — Loading + error UX?

| Option | Description | Selected |
|--------|-------------|----------|
| Per-card loading + per-card error | Reuse Phase 1 KpiCard `loading` + `<ErrorState>` + Retry. Granular. | ✓ |
| Page-level loading boundary | Cleaner first paint; one slow query blocks everything. | |
| Render as it streams; toast on error | Hidden errors when toasts dismissed. | |

**User's choice:** Per-card loading + per-card error.

### Q21 — Where does the lifetime-empty probe live?

| Option | Description | Selected |
|--------|-------------|----------|
| `useExtensionGate()` hook in `src/hooks/extension/`, `staleTime: Infinity` | One-shot `LIMIT 1` probe; cached for the session. | ✓ |
| Reuse `get_kpi_totals` RPC zero-check | Conflates "empty in this range" with "empty ever". | |
| Skip the gate — always render the page | Goes against ROADMAP success criterion #6. | |

**User's choice:** `useExtensionGate()` hook with `staleTime: Infinity`.

---

## Admin / Developer Surface Split

> User raised this as a meta-concern: "I want to split the dashboard views between what the admin needs to see and what the dev (me) sees. Only relevant info for each when in dashboard."

### Q22 — Mechanism for the split?

| Option | Description | Selected |
|--------|-------------|----------|
| `import.meta.env.DEV` build-mode gate | Like `/kit`; tree-shaken from prod. Only visible on the dev server. | (Recommended initially, then user requested account-based) |
| Tabs within `/extension` | Both ship to prod. | |
| Separate `/extension/dev` route | Cleaner separation; filters don't auto-share. | |
| URL toggle `?view=admin\|dev` | Bookmarkable; ships to prod. | |

**User's choice:** Initially asked "how would `import.meta.env.DEV` be true? Can we link to specific accounts?" — redirected to identity-based gating.

### Q22b (follow-up) — Identity-based gate?

| Option | Description | Selected |
|--------|-------------|----------|
| Email allowlist in `src/lib/devAccess.ts` | Tiny module + hard-coded constant. No migration. Email ships in bundle. | ✓ |
| `profiles.is_developer` column + admin toggle | Future-proof; one migration; types regen. | |
| Combine: build-mode OR identity | Dev sees panels locally + in prod logged in as themselves. | |
| Supabase JWT custom claim | Most "correct"; most invasive. | |

**User's choice:** Email allowlist in `src/lib/devAccess.ts`.
**Notes:** User clarified email is `josh@potomackco.com` (overrides the CLAUDE.md userEmail constant). Allowlist seeded with `['josh@potomackco.com']`.

### Q23 — Placement of dev panels?

| Option | Description | Selected |
|--------|-------------|----------|
| Inline collapsed `<DeveloperPanel>` at the bottom of `/extension` | Filters auto-share; admin never sees it; dev sees admin context next to dev signals. | ✓ |
| Separate `/extension/dev` route | Filters require refilter. | |
| Tabs Overview \| Developer | Filter sharing depends on URL state. | |

**User's choice:** Inline collapsed `<DeveloperPanel>` at the bottom.

### Q24 — Which contested requirements move to dev surface?

| Option | Description | Selected |
|--------|-------------|----------|
| EXT-08 live feed → admin | Operational signal: "someone is working right now." | ✓ |
| EXT-09 extension_version filter → dev only | Filtering by version is a debugging move. | ✓ |
| EXT-10 cancellation-rate KPIs → dev only | UX/debug signal. | ✓ |
| EXT-06 payload viewer → dev only | Raw JSON is dev-flavored. EXT-05 row "view payload" + EXT-08 row click follow this gate. | ✓ |

**User's choice:** All four splits accepted as proposed.

---

## Claude's Discretion

The following were left to Claude during planning/execution:

- Tailwind class choices for chart grid, KPI strip, and table styling — match `/kit` and v1.0 component visual style.
- `<DeveloperPanel>` collapsed/expanded layout details.
- `/extension` nav entry icon choice (emoji / SVG / Heroicon).
- Recent Errors table cap — default `LIMIT 100 ORDER BY created_at DESC`; revisit if too low.
- Per-user table column shape — pivot wide first; fall back to "total + popover" if cramped.
- URL filter param naming — comma-separated single key (`?users=`, `?versions=`).
- RPC argument shape — positional with explicit defaults, shared `(p_from, p_to, p_users, p_versions)` prefix.
- Empty-state copy wording — match Phase 1 plain tone; finalize during execution.

---

## Deferred Ideas

Captured during discussion for future phases:

- Per-item analytics on `catalog_item` rows (avg time, success rate by category) — v2.1+ (EXT-FUT-01 territory).
- Duration analytics from `started_at`/`ended_at`/`engine_*` columns — v2.1+ (EXT-FUT-01).
- Per-user detail route `/extension/users/:email` — v2.1+ (EXT-FUT-04).
- Supabase Realtime on `analytics_events` — revisit only if 10-s feed feels laggy AND Phase 4's Realtime-on-`live_lot_current` proves out the pattern.
- Server-side pagination for Recent Errors table — follow-up if 100 rows insufficient.
- Roles-based dev-panel gating (`profiles.is_developer` column) — swap-in if multiple devs need access AND DB-driven preferred.
- Cross-app comparison view (extension vs TPC_App side-by-side) — possible new route entirely.
- Background-tab feed throttling — TanStack default `refetchIntervalInBackground: false` is sufficient.
- Empty-state polling — accept that `useExtensionGate` `staleTime: Infinity` requires a refresh once the extension v2.0 ships if the tab was open.
