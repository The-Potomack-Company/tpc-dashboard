# Phase 01 Deferred Items

Items discovered during plan execution that are out of scope for the active plan and tracked here for future resolution.

## Plan 01-01 (third continuation, 2026-04-28)

### Pre-existing build failures unrelated to plan 01-01 scope

`npm run build` fails with two TypeScript errors that pre-date this plan and are caused by missing dependencies for plan 01-04 deliverables:

```
src/hooks/useDateRange.ts(3,63): error TS2307: Cannot find module 'date-fns' or its corresponding type declarations.
src/hooks/useTimezone.ts(2,47): error TS2307: Cannot find module 'date-fns-tz' or its corresponding type declarations.
```

**Origin commits:**
- `921fb05 feat(01-04): add useDateRange URL-state hook (INFR-04)`
- `e1ec701 feat(01-04): add useTimezone hook with DST-aware ET formatters (INFR-04)`

**Scope:** plan 01-04 (URL-state hooks). Plan 01-01 only mutates `supabase/migrations/`, `scripts/`, `.planning/`, and (indirectly via regeneration) `src/db/database.types.ts`. None of plan 01-01's deliverables touch the failing hooks.

**Verification:** `git stash` of post-regeneration changes reproduces the same two errors with stashed working tree clean — confirms the failure is pre-existing.

**Resolution:** plan 01-04 verifier should add `npm install date-fns date-fns-tz` (or whichever versions match the TPC App's pin) and update package.json. Tracked here so a future plan-04 retro can pick it up.

### Discovery script defects

`scripts/discover-drift.ts` has two known defects (recorded in `01-01-DRIFT-REPORT.md` § "Discovery Script Defect"):

1. **PostgREST PGRST106 on `information_schema` access** — script tries `admin.schema('information_schema').from('tables')` but PostgREST refuses to expose `information_schema` even to the service role over the REST API. Only `public` and `graphql_public` are exposed by default.
2. **Migration-list parser uses Unicode `│` (U+2502)** — the Supabase CLI on Windows outputs ASCII `|`, so the regex never matches.

**Resolution:** these are non-blocking (Task 2 was sourced via direct CLI per RESEARCH Pitfall 3). Future cross-repo phases that want a true automated drift detector should rewrite the script to either (a) use a security-definer wrapper RPC in the `public` schema for system-view access, or (b) shell out to `supabase migration list --linked` and parse with an OS-aware regex (or use `--output=json` if a future CLI release adds it).

## Plan 01-06 (2026-04-28)

### Pre-existing ESLint violations across Phase 1 surface (18 errors / 34 warnings)

`npm run lint` reports 52 problems on commit `0e3f92b` (plan 01-05 base — i.e., before any 01-06 change). Plan 01-06's three modifications (`src/pages/Kit.tsx`, `src/App.tsx`, `scripts/verify-no-kit-in-dist.mjs`) lint clean: `npx eslint src/pages/Kit.tsx src/App.tsx` returns zero issues.

**Sample violations** (out-of-scope for plan 01-06):

- `src/components/kit/DateRangeFilter.tsx:37` — `react-hooks/set-state-in-effect`: setState calls inside `useEffect(() => { if (popoverOpen) { setDraftFrom(...); setDraftTo(...); } }, ...)`. Authored in plan 01-05.
- `src/stores/authStore.ts:67` & `:82` — unused eslint-disable directives. Authored in v1.0 / earlier 01 plans.
- Various other lint nits across `src/components/`, `src/hooks/`, `src/tests/`.

**Scope:** these issues exist on commit `0e3f92b` (plan 01-05 completion) and were verified by a `git checkout 0e3f92b` lint run during the 01-06 verification step. Plan 01-06's deviation-rules SCOPE BOUNDARY says: only auto-fix issues directly caused by the current task's changes. None of these are caused by plan 01-06.

**Resolution:** Either a dedicated lint-cleanup plan in milestone close-out, or piecemeal fixes inside future plans that touch the offending files (e.g., plan 02-* will re-author DateRangeFilter consumers and can fix the 01-05 effect violation as Rule 1 if it materially affects functionality).
