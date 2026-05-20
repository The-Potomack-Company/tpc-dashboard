# TPC Dashboard

## What This Is

A live-operations dashboard for The Potomack Company. Surfaces three things the TPC team currently has no visibility into: **how the voice cataloger app is being used**, **how the AI cataloger Chrome extension is being used**, and **what's happening on the auction floor while a sale is live**.

## Core Value

Give the TPC team real-time awareness of team activity and live auctions — one screen that shows who's cataloging what, what the extension is processing, and (during a live sale) current lot + bidding state as it unfolds.


<!-- VAULT:decisions-start -->
<!-- Auto-generated from _workspace/Decisions/. Do not hand-edit this block. -->
<!-- To add or supersede a decision, edit the file under _workspace/Decisions/ and
     rerun: python3 /home/spoods/Projects/TPC/.claude/hooks/decisions-to-projects.py -->

## Cross-app decisions (active)

Decisions that apply to **dashboard**. Bodies live in the vault — IDs only here.

- **[D-001](../../_workspace/Decisions/D-001-shared-supabase.md)** — All three TPC apps read/write the same Supabase project; RLS is the only boundary.
- **[D-002](../../_workspace/Decisions/D-002-tpc-app-owns-auth.md)** — TPC Voice Cataloger is the auth-of-record; dashboard shares the same Supabase auth; cataloger maps Chrome Identity to Supabase users at write time.
- **[D-003](../../_workspace/Decisions/D-003-anon-key-public-rls-boundary.md)** _(scope: schema)_ — Treat the Supabase anon key as public; security comes entirely from RLS. Service-role keys never appear in client bundles.
- **[D-004](../../_workspace/Decisions/D-004-cataloger-analytics-insert-only.md)** _(scope: schema)_ — Cataloger writes to an INSERT-only analytics surface; dashboard reads via SELECT-allowed views. Writes are fire-and-forget.
- **[D-005](../../_workspace/Decisions/D-005-hub-strangler-merge.md)** — v3 merges voice-cataloger + dashboard into tpc-hub via strangler pattern — old apps stay in prod until hub reaches feature parity, then 30-day grace before archive.
- **[D-006](../../_workspace/Decisions/D-006-hub-fork-from-cataloger.md)** — tpc-hub repo is forked from tpc-voice-cataloger (heavier app, owns auth per D-002); dashboard screens are ported into the fork; both old repos archived at cutover.
- **[D-007](../../_workspace/Decisions/D-007-hub-adaptive-layout.md)** — Hub uses adaptive per-route layout (specialist default → /sessions, admin → /admin/activity). No explicit Field/Office mode toggle.
- **[D-008](../../_workspace/Decisions/D-008-hub-vite-vercel-functions.md)** — Hub stays on Vite and adds Vercel Functions for /api server-side needs. No Next.js migration. Scraping (RFC) goes to Cloudflare Workers, not Vercel.
- **[D-009](../../_workspace/Decisions/D-009-hub-url-promotion.md)** — At cutover, current tpc-dashboard URL becomes the primary hub URL. Voice-cataloger URL 301s to hub. Custom domain deferred.
- **[D-010](../../_workspace/Decisions/D-010-monorepo-hybrid-scope.md)** — tpc-hub is a Turborepo monorepo (apps/* + packages/*). The extension stays in its own repo so it can move and release independently.
- **[D-011](../../_workspace/Decisions/D-011-monorepo-turborepo-pnpm.md)** — tpc-hub monorepo uses Turborepo + pnpm workspaces. Turbo gives task caching + remote cache; aligns with Vercel-native flows (matches next-forge starter).
- **[D-012](../../_workspace/Decisions/D-012-shared-pkg-accretion.md)** — Shared packages in tpc-hub are accreted, not extracted upfront. Day 1 = @tpc/shared-types only. UI/utils/hooks get a package only when a second consumer actually exists.
- **[D-013](../../_workspace/Decisions/D-013-tpc-ai-proxy-rename.md)** — Centralize all AI-provider traffic through one Cloudflare Worker. Rename existing tpc-gemini-proxy → tpc-ai-proxy to future-proof for mixed providers (Gemini + Claude + OpenAI per task strengths).
- **[D-014](../../_workspace/Decisions/D-014-tpc-ai-proxy-jwt-auth.md)** — tpc-ai-proxy authenticates callers with Supabase JWTs only. JWKS cached in Workers KV ~1hr. CORS-only legacy path is removed entirely once migration completes.
- **[D-015](../../_workspace/Decisions/D-015-tpc-ai-proxy-full-logging.md)** — tpc-ai-proxy logs every AI request to private.api_usage (user_id, ts, model, tokens_in/out, cost_usd, app_source). Full logging for first 6 months while learning usage patterns; sampling later if needed.
- **[D-016](../../_workspace/Decisions/D-016-feature-b-no-supabase-cache.md)** — Invoice fab (Feature B) reads invoices live from RFC every time. No replication to Supabase. RFC stays sole owner of invoice data.
- **[D-017](../../_workspace/Decisions/D-017-feature-b-fab-placement.md)** — Invoice fab UI = button injected into RFC's header bar + Alt+Shift+I shortcut. Mirrors the existing Alt+Shift+G cataloging shortcut convention. No floating overlay.
- **[D-018](../../_workspace/Decisions/D-018-feature-b-print-tabs.md)** — Bulk-print N invoices opens N tabs via chrome.tabs.create(). Extension privilege bypasses popup blocker; each tab shows the browser's native print dialog. Matches RFC's existing one-invoice-per-tab behaviour.
- **[D-019](../../_workspace/Decisions/D-019-feature-c-admin-confirm-trigger.md)** — Batch writes (v3.3 auto-flow voice-cataloger → RFC) are triggered by an admin-only Confirm button after specialist review. Specialists submit; admins approve and trigger.
- **[D-020](../../_workspace/Decisions/D-020-feature-c-approved-status-naming.md)** — Session status after admin confirmation is 'approved' (data model), not 'confirmed' or 'batch_queued'. UI button stays labeled "Confirm".
- **[D-022](../../_workspace/Decisions/D-022-feature-c-undo-authority.md)** — Only the admin who originally confirmed a batch can undo it. RFC fallback when extension unavailable = Supabase reverts immediately + banner shows "RFC needs manual cleanup" with deep-links per item.
- **[D-023](../../_workspace/Decisions/D-023-feature-d-rfc-worker-bot.md)** — RFC receipt prefill (Feature D) runs through a Cloudflare Worker with a dedicated RFC bot account. Worker holds the RFC session + re-auth. Hub/extension/phone all call the Worker — works everywhere (mobile Chrome doesn't support extensions).
- **[D-024](../../_workspace/Decisions/D-024-feature-d-on-blur-trigger.md)** — RFC prefill fires on blur of the receipt# field. Single predictable fetch — no debounce-while-typing, no explicit button.
- **[D-025](../../_workspace/Decisions/D-025-feature-d-silent-fill-except-photos.md)** — RFC prefill silently fills all session fields except photos. Specialist edits inline if needed; photos require an explicit choice (overwrite vs keep).
- **[D-026](../../_workspace/Decisions/D-026-feature-d-bot-account-scope.md)** — One RFC bot account used by all Workers. Different Worker names per workload (tpc-rfc-proxy read-only, tpc-rfc-write-proxy for batch writes / portal upload). One credential to rotate; per-Worker visibility into which feature wrote what.
- **[D-027](../../_workspace/Decisions/D-027-feature-d-bot-write-rule.md)** — RFC bot writes only on explicit user action (admin confirms a batch, user clicks Upload). No autonomous bot writes. Audit table preserves the triggering user.
- **[D-028](../../_workspace/Decisions/D-028-crm-email-hybrid-cc.md)** — CRM email handling — inbound on shared consign@, outbound from specialist's Workspace email with Reply-To and consign@ always CC'd. Hybrid pattern keeps the team in the loop on multi-department consignments.
- **[D-029](../../_workspace/Decisions/D-029-crm-incremental-ship.md)** — Feature E (CRM) ships incrementally in v0.5 → v0.6 → v0.7 slices, not as one big-bang launch. Each slice exposes something testable so assumptions get validated against real consignment email early.
- **[D-033](../../_workspace/Decisions/D-033-extension-cicd-tag-push.md)** — Extension publish to Chrome Web Store triggers on git tag push (e.g. v3.5.1), not on every merge. Manual final approval click in CWS dashboard remains (API can't auto-publish private extensions).
- **[D-034](../../_workspace/Decisions/D-034-tpc-owned-cloud-infra.md)** — All TPC cloud infrastructure (Cloudflare Workers, Vercel projects, third-party APIs) is owned by TPC-controlled accounts, never by personal accounts. Mitigates key-person risk if an individual leaves or their account is locked.
- **[D-035](../../_workspace/Decisions/D-035-feature-e-gmail-sa-dwd.md)** — Feature E v0.5 CRM poller authenticates to Gmail API via a TPC-owned GCP service account with Google Workspace domain-wide delegation, impersonating the shared consign@ inbox. Read-only scope. Worker-friendly (no refresh-token rotation; hand-rolled JWT signed via Web Crypto). Outbound (v0.7+) uses a separate per-user OAuth surface, never this SA.
- **[D-036](../../_workspace/Decisions/D-036-crm-five-department-taxonomy.md)** — CRM v0.5 multi-tag department classifier uses five departments — furniture, decarts, books, fashion, art_sculpture. Diverges from the extension's 4-category photo classifier by splitting out art_sculpture as a discrete category. Extension may additively adopt the same taxonomy later if cataloging volume warrants it.
- **[D-037](../../_workspace/Decisions/D-037-v3-hub-merge-before-features.md)** — v3.0 hub merge ships before any new cross-app feature work on any TPC app. Hotfix lane stays open for production incidents. Sequencing reset established 2026-05-15 to prevent feature-churn and rework against the about-to-be-merged hub.
- **[D-038](../../_workspace/Decisions/D-038-single-supabase-dev-filter.md)** — Single Supabase project for both dev and prod. Dev data (users with empty email or `josh@potomackco.com`) is filtered out at the dashboard/analytics query layer. No separate staging project, no dev-account redirect, no migration approval gate beyond PR review + additive-only constraint. Pragmatic for current scope; revisit when usage grows or compliance demands isolation.
- **[D-039](../../_workspace/Decisions/D-039-aws-migration-deferred.md)** — Long-term direction is to consolidate hosting under a single TPC-owned AWS account (apps + DB + workers) once the v3.0 hub is stable and adoption widens. For MVP / strangler window, the current split (Vercel for apps, Supabase for DB, Cloudflare for workers) is acceptable. Re-surface this decision when the cost / coordination of three vendors starts costing more than the AWS-consolidation lift.
- **[D-040](../../_workspace/Decisions/D-040-admin-only-account-creation.md)** — All TPC accounts are admin-provisioned. There is no public sign-up surface and there never will be — the product is an internal auction-house tool, not a public app. Forgot-password is a useful affordance that can be added post-v3.0; the account-creation workflow itself (specialist invite + initial password set) can ship after the v3.0 merge stabilises.
- **[D-041](../../_workspace/Decisions/D-041-analytics-uses-real-user-data.md)** — Analytics calculations (skip-reason rates, per-user usage curves, perf-improvement signals) must be based on real-user behaviour, not dev-account activity. The admin-visible "operational" surfaces (session list, invoice list, item review) are what the dev-data filter (D-038) protects. The raw analytics_events stream itself can stay hidden from direct admin browsing — admins consume analytics through curated dashboard widgets, not the raw event table.
- **[D-042](../../_workspace/Decisions/D-042-crm-v05-demo-on-dashboard.md)** — One-time override of D-037 (merge-first policy) — build a CRM v0.5 demo slice on the current tpc-dashboard for an internal TPC-team demo this week. Demo is throwaway scaffolding except for the Supabase schema; production CRM v0.5 still ships into the hub at v3.5 per the locked roadmap. App-password Gmail auth replaces D-035 SA+DWD for the demo only. After demo, hub merge work resumes in exact order it was paused (Phase 02 punch-out → Phase 03 plan).

<!-- VAULT:decisions-end -->
## Current Milestone: v2.0 Live Ops

**Goal:** Give the TPC team real-time awareness of team activity (voice app + AI extension) and live auction floor state on one screen.

**Target features:**

- **TPC App activity tracking** — read-only charts/reports from existing app tables (`profiles`, `sessions`, `items`, `photos`, `export_history`): session volume by specialist, item throughput, `ai_status` health, export pipeline, photo coverage, house-vs-sale split
- **TPC AI Cataloger extension analytics** — read-only charts/reports from the extension's `analytics_events` table (5 event types: `catalog_single`, `catalog_batch`, `portal_upload`, `spreadsheet_transform`, `data_import`): event volume by type/day, batch performance, errors, user usage, live event feed
- **Live RFC sale tracking** — Playwright-driven scrape of an active auction during a sale: current lot + bid state, bidding issues/anomalies (exact signals shaped with sale monitors during phase discuss), dashboard-owned tables for lot-level events
- **Vercel deploy** — carried forward from v1.0 INFR-01 (not shipped in v1.0)

## Requirements

### Validated (carried from v1.0)

- [x] Team access using existing Supabase auth system as TPC App — **Validated in v1.0 Phase 1 (single-admin v1; specialist view deferred)**
- [x] Shared Supabase project with admin-only RLS scaffolding, private.is_admin() helper — **Validated in v1.0 Phase 1**
- [x] Vite + React 19 + TS + Tailwind v4 stack, matching TPC App — **Validated in v1.0 Phase 1**

### Active (v2.0 Live Ops)

Formalized requirements are in `.planning/REQUIREMENTS.md`. Summary of target capabilities:

- [ ] **TPC App activity tracking** — session volume by specialist, item throughput, `ai_status` health, export pipeline, photo coverage, house-vs-sale split (reads `profiles`, `sessions`, `items`, `photos`, `export_history`)
- [x] **TPC AI Cataloger extension analytics** — event volume by type, batch performance, errors, user usage, live event feed (reads `analytics_events`) — **Implemented in v2.0 Phase 2 (`/extension` route, EXT-01..EXT-10); operator UAT pending in `02-09-HUMAN-UAT.md`**
- [ ] **Live RFC sale tracking** — current lot + bid state, bidding issues/anomalies, Playwright scrape during active sales, dashboard-owned lot-event tables
- [ ] **Vercel deploy** — carried forward from v1.0 INFR-01

### Out of Scope

- Historical auction analytics (PDF import of past sales, sale browse, sale detail, KPI landing, trend charts, department/sale comparison) — **retired in the v1.0 → v2.0 pivot**
- Individual buyer/seller/bidder identity beyond aggregates available in the live auction UI — we can see bid activity but not bidder personal details
- Modifying data in TPC App or Cataloger extension from the dashboard — read-only analytics
- Direct RFC API integration — RFC has no API; live scrape + (future) webhooks are the only access method
- Mobile-first design — desktop-oriented live-ops tool (responsive OK but not mobile-first)

## Context

- **TPC App** (TPC Speech Cataloger): PWA at `~/TPC_App`, deployed on Vercel. Supabase tables: `profiles`, `sessions`, `items`, `export_history`, `photos`. Dashboard reads these tables as-is.
- **TPC AI Cataloger Extension**: Chrome extension at `~/Projects/TPC_AI_Cataloger`. v2.0 analytics pipeline (extension Phases 28-31) will add an `analytics_events` table to the shared Supabase project with 5 event types (W1-W5). Dashboard reads this table as-is once the extension ships that feature.
- **RFC Live Auction Site**: No API. Live sales run on the public RFC bidding interface. Dashboard must scrape the active auction page during a sale (current lot number, item, hammer price, bid activity, timer). Login required.
- **Supabase**: Same shared project as TPC App. Dashboard owns its own live-sale tables (schema TBD in v2 planning).
- **Hosting**: Vercel, same org as TPC App.

## Constraints

- **Shared database**: Must not interfere with existing TPC App / Cataloger extension tables — dashboard adds its own tables for live-sale capture, reads app/extension tables as-is
- **Auth**: Reuse existing Supabase auth from TPC App — no separate user management
- **RFC scraping**: Live sales are the data source. Scraper must handle login, JS-rendered content, and sustain polling during a multi-hour sale without tripping anti-bot defenses. Playwright is the confirmed approach; no pdf-parse path exists in v2
- **Real-time latency**: "Live" means seconds-scale, not millisecond. Polling cadence will be tuned during scraper research (likely 1–10s depending on RFC's limits)

## Key Decisions (v1.0 carryovers)

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Standalone web app on Vercel | Matches TPC App deployment | ✓ Validated in v1.0 Phase 1 |
| Shared Supabase project | TPC App already there; single auth + single source of truth for cross-app views | ✓ Validated in v1.0 Phase 1 |
| Supabase RLS with admin-only policies + `private.is_admin()` helper | Same pattern as TPC App; no per-user table partitioning needed for admin surfaces | ✓ Validated in v1.0 Phase 1 |
| Vite + React 19 + TS + Tailwind v4 stack | Identical to TPC App — contributor familiarity | ✓ Validated in v1.0 Phase 1 |
| TanStack Query for server state | Was used across v1.0; pattern retained for v2 live polling + extension analytics reads | ✓ Pattern validated, kept as v2 default |

## Key Decisions (v2.0 — TBD)

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Playwright (not pdf-parse) as scraper | Live sale pages are JS-rendered; PDF import retired | -- Pending (v2 research phase) |
| Polling cadence for live sale | Balance freshness vs RFC rate limiting | -- Pending (v2 research phase) |
| Live-sale table schema | Capture lot-level events during an active sale | -- Pending (v2 discuss phase) |
| Extension analytics ETL vs direct read | Depends on row volume + latency needs | -- Pending (v2 planning) |

## Evolution

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

## History

- **v1.0 (archived 2026-04-24, `tag v1.0`)**: Original historical-analytics thesis — PDF import (~364 of 457 sales loaded during UAT), sale views, KPI landing, trend charts, department/sale comparison. Code-complete (644 automated tests green) but retired before live UAT due to product-direction pivot. See `.planning/milestones/v1.0-MILESTONE-AUDIT.md` § Pivot Note for context.
- **v2.0 (this milestone)**: Pivoted to live-ops focus — team activity (voice app + extension) + live RFC sale tracking.

---
*Last updated: 2026-04-24 — v2.0 Live Ops milestone started (`/gsd-new-milestone`). Requirements next.*
