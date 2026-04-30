# TPC Dashboard

## What This Is

A live-operations dashboard for The Potomack Company. Surfaces three things the TPC team currently has no visibility into: **how the voice cataloger app is being used**, **how the AI cataloger Chrome extension is being used**, and **what's happening on the auction floor while a sale is live**.

## Core Value

Give the TPC team real-time awareness of team activity and live auctions — one screen that shows who's cataloging what, what the extension is processing, and (during a live sale) current lot + bidding state as it unfolds.

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
