# Milestones

## v1.0 milestone (pivot-closed) (Shipped: 2026-04-24)

**Phases completed:** 6 phases, 31 plans, 57 tasks

**Key accomplishments:**

- 9 dashboard-owned tables provisioned in shared Supabase with admin-only RLS, 22-row departments seed, and regenerated TypeScript types covering 5 new tables plus TPC App read-only surface.
- Phase 1 shipped with docs, decision log, and manual-QA gate passed; Vercel deploy deferred to a later cycle per user direction.
- Added sales.validation_warning and departments.auto_discovered columns plus a service-role-only PL/pgSQL RPC (import_sale_with_departments) that atomically inserts a sale and its department breakdown in a single transaction.
- pdf-parse v2 + regex extractors + Zod schemas + security-isolated service-role client, turning 457 RFC auction profile PDFs into typed, validated SaleRecord / SaleDepartmentRecord values via a three-variant ParseResult.
- Plan 02-05 Task 1 (docs) executed in full; Task 2 (live 457-PDF import + 10-sale spot-check) and Task 3 (final REQUIREMENTS/ROADMAP flip to Complete) are deferred pending the operator adding `SUPABASE_SERVICE_ROLE_KEY` to `.env.local`. README now documents the import pipeline end-to-end, PROJECT.md has the correct PDF source path (`~/Projects/rfc_profiles/rfc_profiles/`), REQUIREMENTS.md marks DATA-01..07 as `Partial (Phase 2)` with explicit deferred-run notes, and STATE.md captures 8 cumulative Phase 2 decisions for downstream use.
- Dashboard route `/` composes PeriodSelector + 4 KPI scorecards + Recent Sales panel into a working landing page backed by useKpiSummary and useSales; 12 integration tests cover all three KPI requirements with explicit independent-section-failure paths.

---
