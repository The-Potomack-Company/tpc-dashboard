# Phase 3: TPC App Activity (`/activity`) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-30
**Phase:** 03-tpc-app-activity-activity
**Areas discussed:** Session Detail surface, Photo signed-URL strategy, Filter scope (right-now vs range), Stuck Items affordance + link target, Admin/dev surface split (added by user)

---

## Session Detail surface

### Q1 — How should Session Detail open from a row click?

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated route /activity/sessions/:id | Bookmarkable URL, browser back works, full-width grid | ✓ |
| Drawer (right-side overlay) | Faster context-switch but cramped photo grid, no shareable URL | |
| Modal (centered) | Even less room for photo grid; bad fit for the data shape | |

**User's choice:** Dedicated route /activity/sessions/:id (Recommended)

### Q2 — Route relationship to /activity filter state?

| Option | Description | Selected |
|--------|-------------|----------|
| Nested under /activity, preserves filters | Filter URL state intact across nav; back returns with filters | ✓ |
| Top-level /sessions/:id with back link | Cleaner URL but loses filter state | |
| Nested but resets filters on entry | Lower complexity but breaks breadcrumb back-nav | |

**User's choice:** Nested under /activity, preserves filters in URL (Recommended)

### Q3 — Item list display inside Session Detail?

| Option | Description | Selected |
|--------|-------------|----------|
| TanStack Table v8, sortable, paginated | Reuses Phase 2 plan 02-05 dep; consistent with PerUserTable / RecentErrorsTable | ✓ |
| Simple HTML table | OK if <50 items; sale sessions can have many more | |
| Card grid | Heavy; signs URLs for every item on first paint | |

**User's choice:** TanStack Table, sortable, paginated (Recommended)

### Q4 — Photo Coverage panel placement?

| Option | Description | Selected |
|--------|-------------|----------|
| Right of session metadata, above item list | At-a-glance with metadata; failed-photo callout above the fold | ✓ |
| Below item list as footer | Reading-order narrative but pushes failed-photo callout below fold | |
| Tabs (Items / Photos / Metadata) | Clean if photo content grows; loses at-a-glance view | |

**User's choice:** Right of session metadata, above item list (Recommended)

### Q5 — Thumbnails: in coverage panel, per-item, or none?

| Option | Description | Selected |
|--------|-------------|----------|
| Counts + breakdowns only on coverage panel; thumbnails per-item lazy | Per-item disclosure; signed URLs only fetch on attention | ✓ |
| Full thumbnail grid + per-item | Heavy first paint; hundreds of thumbnails possible | |
| No thumbnails on Session Detail | Conflicts with Success Criterion #5; would re-scope phase | |

**User's choice:** Counts + breakdowns only; thumbnails per-item (Recommended)

**Notes:** Drives the photo signed-URL strategy decisively toward "lazy, on-demand, per-photo".

---

## Photo signed-URL strategy

### Q1 — Primary mechanism for keeping thumbnails renderable after 2-hour idle?

| Option | Description | Selected |
|--------|-------------|----------|
| Refetch-on-window-focus + per-photo TanStack Query | TTL=3600s; focus event refetches stale URLs; no infra change | ✓ |
| Long TTL signed URLs (24h) | Single sign covers a workday; longer leak window | |
| Server-side proxy / RPC returning blobs | Edge function deploy; doubles egress; overkill for admin-only tool | |

**User's choice:** Refetch-on-window-focus + per-photo TanStack Query (Recommended)

### Q2 — Eager on mount, or lazy on item-row expand?

| Option | Description | Selected |
|--------|-------------|----------|
| Lazy on item-row expansion | Aligns with Area 1 thumbnail decision; minimizes cold-mount cost | ✓ |
| Eager on Session Detail mount | All thumbnails warm; blasts bucket on every page entry | |

**User's choice:** Lazy on item-row expansion (Recommended)

### Q3 — Hook location?

| Option | Description | Selected |
|--------|-------------|----------|
| New shared hook src/hooks/useSignedPhotoUrl.ts | Reusable across phases; mirrors TPC App's usePhotoUrl shape | ✓ |
| Inline inside src/hooks/activity/ | Tighter scoping; future consumer would have to copy/move | |
| Service-layer fetcher only, no hook | Loses encapsulation; focus-refetch policy easy to forget | |

**User's choice:** New shared hook src/hooks/useSignedPhotoUrl.ts (Recommended)

### Q4 — Cache parameters?

| Option | Description | Selected |
|--------|-------------|----------|
| TTL=3600s, staleTime=50min, refetchOnWindowFocus=true | 10min buffer pre-expiry; focus-event override; matches TPC App TTL | ✓ |
| TTL=7200s (2h), staleTime=1h, refetchOnWindowFocus=true | Buffer survives 2h tab-resume directly; longer-lived URLs in memory | |
| TTL=3600s, no focus refetch, retry-on-error | Simpler; flash of broken thumbnails on idle | |

**User's choice:** TTL=3600s, staleTime=50min, refetchOnWindowFocus=true (Recommended)

### Q5 — Path target: thumbnail_path, both, or full storage_path?

| Option | Description | Selected |
|--------|-------------|----------|
| thumbnail_path only | Small (<200KB); satisfies APP-10; full-size deferred to v2.1+ | ✓ |
| Both — thumbnail default, full-size on click | Doubles hook surface; no APP-* in Phase 3 asks for full-size | |
| Always full-size storage_path | Largest egress, slowest paint; no good reason | |

**User's choice:** thumbnail_path only (Recommended)

---

## Filter scope (right-now vs range)

### Q1 — Today KPI strip: anchored to today or follows date range?

| Option | Description | Selected |
|--------|-------------|----------|
| Stay anchored to today | "Today" is in APP-01 title; today vs yesterday delta | ✓ |
| Follow date range — becomes "Selected Range KPIs" | Single coherent filter; reinterprets APP-01 wording | |
| Hybrid — Today row + Range row | Doubles top-of-page real estate; overkill for v2.0 | |

**User's choice:** Stay anchored to today (Recommended)

### Q2 — Active Sessions table: follows date range or always-current?

| Option | Description | Selected |
|--------|-------------|----------|
| Always-current; ignores date range | Operational view; admins want "who's mid-session right now?" | ✓ |
| Filter by sessions.created_at within range | Hides genuinely active sessions predating range | |
| Filter by sessions.updated_at within range | Closer to operational intent but still hides idle-but-active | |

**User's choice:** Always-current; ignores date range (Recommended)

### Q3 — APP-03 14-day items chart: fixed window or follows range?

| Option | Description | Selected |
|--------|-------------|----------|
| Always trailing 14 days; ignores range | APP-03 wording is fixed-window; mirrors Phase 2 EXT-01 | ✓ |
| Follow date range; adapt buckets | Reframes APP-03's "14 days" as a default | |

**User's choice:** Always trailing 14 days; ignores date range (Recommended)

### Q4 — Master rule for filter scope?

| Option | Description | Selected |
|--------|-------------|----------|
| Range applies to created_at aggregates only; right-now widgets ignore | Stuck Items independent rule; specialist+mode apply to both | ✓ |
| Range applies everywhere except APP-01 Today KPI | Breaks APP-02 operational intent | |
| Range applies everywhere; "Today" is a sub-widget | Treats range as global lens; conflicts with APP-02 | |

**User's choice:** Range applies to created_at-based aggregates only (Recommended)

---

## Stuck Items affordance + link target

### Q1 — Where does the alert card link go?

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated route /activity/stuck | Bookmarkable, focused page, room for triage | ✓ |
| Modal on /activity | Modal-on-modal awkward for row-click drill | |
| In-place expansion of alert card | Breaks if list is long; interleaves with charts | |
| Filter ?stuck=1 on existing item list | Phase 3 doesn't ship a page-level item list | |

**User's choice:** Dedicated route /activity/stuck (Recommended)

### Q2 — /activity/stuck page columns?

| Option | Description | Selected |
|--------|-------------|----------|
| receipt_number, title, ai_status, age, session.name, specialist | Mirrors APP-06 + age + session-context for triage | ✓ |
| Minimal: receipt + title + ai_status + age | Slower triage; admin clicks to find owner | |
| Wide: + mode, category, AI error/transcript | Debugging columns; not Phase 3 scope (defer to ItemDetail) | |

**User's choice:** receipt_number, title, ai_status, age, session.name, specialist (Recommended)

### Q3 — Alert card content?

| Option | Description | Selected |
|--------|-------------|----------|
| Count + age-of-oldest + severity tone + CTA | Quiet success state at N=0 prevents reflow | ✓ |
| Hidden when N=0; full alert when N>0 | Causes layout shift on each refetch | |
| Count only + link | Loses signal | |

**User's choice:** Count badge + age-of-oldest + 'View N stuck items' CTA (Recommended)

### Q4 — Data source: RPC or raw select?

| Option | Description | Selected |
|--------|-------------|----------|
| RPC get_stuck_items(p_specialists, p_mode), 2h hard-coded | Card and page can never drift; mirrors Phase 2 D-12 | ✓ |
| Raw .from() with embedded joins | Inline; brittle if RLS friction on join chain | |

**User's choice:** Server-side RPC get_stuck_items (Recommended)

---

## Admin/dev surface split (user-added)

User raised this after the four pre-selected areas closed: "same as phase 2, i want a split between admin view and dev view with the email gate". User also surfaced an additional data source: "there is also a ui activity table in supabase now, the dev should see this on the dashboard too" → identified as `public.ui_interactions` (TPC App migration `20260424000001_create_ui_interactions.sql`).

### Q1 — Which Phase 3 capabilities belong on the dev-only surface? (multi-select)

| Option | Description | Selected |
|--------|-------------|----------|
| Raw item-row inspector (transcript + raw JSON) | Closest analog to Phase 2 EXT-06 payload viewer | ✓ |
| Stuck-items deep diagnostics | Failed-photo paths, category, estimate, raw JSON | ✓ |
| Failed-AI breakdown panel on /activity | Dev-only triage panel (parallel to EXT-10 KPIs in Phase 2) | ✓ |
| Photo storage-path debugging | Raw paths under each thumbnail; signs full-size | ✓ |

**User's choice:** All four. Plus user-added: `ui_interactions` panel.

### Q2 — Where does ui_interactions surface for dev users?

| Option | Description | Selected |
|--------|-------------|----------|
| Inside /activity DeveloperPanel | Single dev surface; reuses isDevAccount gate | ✓ |
| Its own /dev/ui-activity route | Premature for v2.0 | |
| Defer to follow-up phase | User explicitly asked for it now | |

**User's choice:** Inside the /activity DeveloperPanel (Recommended)

### Q3 — Which ui_interactions aggregations? (multi-select)

| Option | Description | Selected |
|--------|-------------|----------|
| Top page_paths by view count | Cheap, high signal | ✓ |
| Top element_ids by click count | Cheap, high signal for friction triage | ✓ |
| Walkthrough_step funnel | Drop-off in onboarding; pairs with profiles.walkthrough_completed | ✓ |
| Recent events feed (last 50, 10s refetch) | Mirrors Phase 2 EXT-08; high volume on this table | ✓ |

**User's choice:** All four.

### Q4 — Filter scope for the ui_interactions panel?

| Option | Description | Selected |
|--------|-------------|----------|
| Respects page-level date range; ignores specialist + mode | ui_interactions joins user_id, not items.created_by; not session-scoped | ✓ |
| Independent panel-internal filters | More wiring; panel grows beyond accordion size | |
| No filters; "all time, all users" | 30d retention makes "all time" trailing-30d; loses slicing | |

**User's choice:** Respects page-level date range; ignores specialist + mode (Recommended)

### Q5 — app_source filter on ui_interactions?

| Option | Description | Selected |
|--------|-------------|----------|
| Hard filter app_source='tpc-app' on every query | Mirrors Phase 2 D-01 invariant; prevents future-source noise | ✓ |
| No filter — read all sources | Silently mixes future non-tpc-app inserts | |

**User's choice:** Yes, hard filter app_source='tpc-app' on every query (Recommended)

---

## Claude's Discretion

Areas where the user deferred to Claude or where the decision is plan-time:

- Tailwind layout class choices (chart grid, KPI strip, card spacing, alert tone hex values)
- Stuck Items severity thresholds (default N≥5 yellow / oldest>6h red — adjustable)
- Pagination sizes for `/activity/stuck` and Session Detail item list (default 50)
- Recharts color choices for AI status donut (failed = red + visually distinct, e.g., pulled-out slice)
- Active Sessions default sort (age descending = oldest first)
- Whether `<DeveloperPanel>` open-state persists in localStorage
- Walkthrough funnel exact step list (finalize after reading TPC App emitter source)
- Whether `get_stuck_items` is one RPC vs a paired summary RPC for the card (plan-time)
- Whether `ui_interactions.user_email` derivation joins `auth.users` or trusts the column TPC App writes (plan-time)
- Photo coverage panel exact visual treatment of the failed-state callout (color, copy)
- Recent-events-feed `refetchInterval` constant value (left tunable)

## Deferred Ideas

(See CONTEXT.md `<deferred>` for the full list. Highlights:)

- Specialist activity heatmap (APP-FUT-01)
- Per-specialist sparkline roster (APP-FUT-02)
- Session age distribution histogram (APP-FUT-03)
- Export history table (APP-FUT-04)
- Specialist-only view (AUTH-FUT-01)
- Full-size photo lightbox / ItemDetail drilldown (v2.1+)
- /dev/ui-activity standalone route (promote from panel if it grows)
- Configurable Stuck Items 2h threshold
- Walkthrough funnel time-to-completion histogram
- ui_interactions per-element friction view (avg time-on-element)
- Cross-app comparison (`tpc-app` vs `tpc-extension` activity)
- refetchInterval on right-now widgets (default staleTime: 60s; tunable later)
- Roles-based dev panel gating (deferred to whenever the email allowlist proves insufficient)
- Generalize useSignedPhotoUrl → useSignedStorageUrl(bucket, path, ttl)
