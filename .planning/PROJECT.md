# TPC Dashboard

## What This Is

A web-based analytics dashboard for The Potomack Company that consolidates auction performance data from three sources: historical RFC auction profile PDFs (457+ sales), real-time operational data from the TPC Speech Cataloger app, and workflow analytics from the TPC AI Cataloger Chrome extension. The TPC team uses it to track sale trends, compare department performance, monitor cataloging activity, and generate reports.

## Core Value

Give the TPC team a single place to see how their auctions are performing over time — what departments are strong, which sales do well, and what's happening across both the app and extension — so they can make better decisions about future sales.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Bulk-parse all 457 historical RFC auction profile PDFs into structured database records
- [ ] Per-sale summary: auctioned lots, sold lots, sell-through rate, total sold/unsold value, estimates, reserves, revenue breakdown (premium, commission, insurance, lot charges, referral fees, net revenue)
- [ ] Per-department breakdown within each sale: same metrics segmented by department code (ASN, PNT, PER, SIL, CER, FRN, DRW, SPT, DEC, etc.)
- [ ] Scheduled scraper that logs into RFC, detects completed sales, and auto-imports new auction profiles
- [ ] Sale overview landing page: latest sales with key metrics at a glance
- [ ] Historical trend charts: revenue over time, sell-through rates, department performance across sales
- [ ] Department comparison views: which departments perform best (by revenue, sell-through, lots above estimate)
- [ ] Sale comparison: side-by-side or overlay comparison of selected sales
- [ ] TPC App activity tracking: session counts, items cataloged, specialist workload, export history (reads from existing Supabase tables)
- [ ] TPC AI Cataloger activity tracking: batch runs, photo uploads, spreadsheet imports, single-item generations (reads from analytics_events table being built in extension v2.0)
- [ ] Report generation: exportable summaries (PDF or CSV) of sale performance, department trends, team activity
- [ ] Graphs and visualizations: bar charts, line charts, pie charts for all key metrics
- [ ] Team access using same Supabase auth system as TPC App (admin/specialist roles)
- [ ] Responsive web app deployed to Vercel

### Out of Scope

- Individual lot-level results (lot number, specific hammer price per item) — department-level summaries are sufficient
- Real-time live auction monitoring — this is a historical/post-sale analytics tool
- Direct RFC API integration — RFC has no API; web scraping is the access method
- Buyer/seller personal details or contact information — only aggregate counts
- Modifying data in TPC App or Cataloger extension from the dashboard — read-only analytics
- Mobile-first design — this is a desktop-oriented analytics tool (responsive but not mobile-first)

## Context

- **TPC App** (TPC Speech Cataloger): PWA at ~/TPC_App, deployed on Vercel. Supabase database with tables: profiles, sessions, items, export_history, photos. Auth via Supabase with admin/specialist roles.
- **TPC AI Cataloger**: Chrome extension at ~/Projects/TPC_AI_Cataloger. v2.0 analytics pipeline (Phases 28-31) will add analytics_events table to shared Supabase with 5 workflow event types (W1-W5): single catalog, batch catalog, portal upload, spreadsheet transform, app data import.
- **RFC Auction Profiles**: 457 PDFs in ~/Desktop/rfc_profiles/. Each is a multi-page report for one sale, with page 1 being the "All Departments" summary and subsequent pages being per-department breakdowns. Departments include: AMER, ASD, ASN, ASNP, BKS, CER, CLK, DEC, DRW, ENT, FRN, GEN, GLS, MAP, MDF, MUS, PER, PND, PNT, SPT, SIL, TXTL, and others.
- **Supabase**: Shared project already set up, connected to TPC App, will be connected to Cataloger extension. Dashboard reads from same project.
- **RFC Access**: Web scraping only (no API). Needs login credentials for automated profile retrieval.

## Constraints

- **Data source**: RFC has no API — scraper must handle web login and HTML/PDF parsing
- **Shared database**: Must not interfere with existing TPC App tables — dashboard adds its own tables for auction data, reads app/extension tables as-is
- **Auth**: Reuse existing Supabase auth from TPC App — no separate user management
- **PDF parsing**: Auction profiles have consistent format (validated across 457 files) but contain financial data that must be parsed accurately

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Standalone web app on Vercel | Matches TPC App deployment, familiar infrastructure | -- Pending |
| Web scraping for RFC data | No RFC/Invaluable API available | -- Pending |
| Shared Supabase project | TPC App and Cataloger already connected; single source of truth | -- Pending |
| Department-level granularity (not lot-level) | Sufficient for trend analysis; lot-level would require different data source | -- Pending |
| Bulk import + auto-scraper for PDFs | Historical data imported once; future sales captured automatically | -- Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? -> Move to Out of Scope with reason
2. Requirements validated? -> Move to Validated with phase reference
3. New requirements emerged? -> Add to Active
4. Decisions to log? -> Add to Key Decisions
5. "What This Is" still accurate? -> Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check -- still the right priority?
3. Audit Out of Scope -- reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-06 after initialization*
