---
phase_id: 06-vercel-deploy
title: Vercel Production Deploy
status: shipped
started_at: 2026-05-12
completed_at: 2026-05-12
deploy_target: production
---

## What shipped

- Vercel project `tpc-dashboard` linked under personal scope `maserinj-7692s-projects` (projectId `prj_KQvhCZ5QbPDnI3kB2SuRlRaqpMAQ`)
- GitHub repo `The-Potomack-Company/tpc-dashboard` connected — auto-deploy on push to `main` (production) and per-PR previews
- Env vars set (production scope): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Repo visibility flipped to public (required by Vercel free tier)
- Initial production deploy from `feature/v2-pivot-reset` succeeded — `feature/v2-pivot-reset` is the v2.0 milestone close branch (Phase 7 unified design)

## URLs

- **Production**: https://tpc-dashboard-nine.vercel.app (stable alias)
- **Deploy hash**: https://tpc-dashboard-ijs2cecw0-maserinj-7692s-projects.vercel.app (`dpl_57kd36vrYu3KDJ8poRg1SYWuykj5`)
- **Inspect**: https://vercel.com/maserinj-7692s-projects/tpc-dashboard/57kd36vrYu3KDJ8poRg1SYWuykj5

## Build summary

- 11/11 prebuild verifiers green (admin-client guard, RPC shape, app-source scope, timezone, stuck-threshold, mode filter, table-readonly, photos TTL, filter scope, error-state contract)
- TypeScript build clean
- Bundle: `index-CpNDA4eF.css` 51.08 kB (gzip 9.88 kB) · `index-X9HFvpEC.js` 1,078.02 kB (gzip 307.28 kB)
- Build duration: 32s on iad1 (Washington DC) Turbo machine

## What's left for user

1. **Smoke-test the production URL** — `https://tpc-dashboard-nine.vercel.app`. Auth flow (Supabase login), all pages, theme toggle, KPI cards, sparklines.
2. **Merge PR #2** when ready — main auto-redeploys to the same production URL; no manual step needed afterward.
3. *(Optional)* Set up a custom domain via Vercel dashboard if you don't want the `vercel.app` URL long-term.
4. *(Optional)* Add preview env vars manually at https://vercel.com/maserinj-7692s-projects/tpc-dashboard/settings/environment-variables for the `Preview` and `Development` scopes — the Vercel CLI plugin wrapper blocks adding non-Production scopes from the terminal. Without these, future PR preview deploys will build but Supabase auth will fail at runtime.

## Notes

- `SUPABASE_SERVICE_ROLE_KEY` was deliberately NOT pushed — the dashboard is a Vite SPA with no server-side caller. Add later if a serverless function ever needs it.
- The `vercel build` warning about the 1MB JS chunk is expected for a Vite SPA without code-splitting and not a regression. Splittable as a future optimization phase.
- Repo was flipped from PRIVATE → PUBLIC during this phase. History pre-scan confirmed no service-role keys or secrets in commits (only `.env.example` ever existed in history).
