# Phase 2 — Deferred Items

Pre-existing or out-of-scope issues discovered during plan execution. Not fixed
in the discovering plan because they are not directly caused by that plan's
changes.

---

## Plan 02-02 (Foundation Modules)

### `src/components/kit/DateRangeFilter.tsx:37` — `react-hooks/set-state-in-effect` ESLint error

**Discovered during:** Plan 02-02 (Wave 1 — foundation modules)
**Status:** Pre-existing (Phase 1 / 01-04 or 01-05 territory)

`npm run lint` reports 1 error in `src/components/kit/DateRangeFilter.tsx:37`:

```
error  Avoid calling setState() directly within an effect  react-hooks/set-state-in-effect
```

The `useEffect` body sets `draftFrom` / `draftTo` from `from` / `to` when the
popover opens. The lint rule prefers driving the draft state from a derived
expression or an explicit user event rather than a synchronization effect.

This file is unchanged by Plan 02-02 — `git log -1 -- src/components/kit/DateRangeFilter.tsx`
points at Phase 1. Do NOT fix here (scope boundary). A future Phase 2 plan that
touches this file (none currently planned) or a Phase 1 follow-up should
refactor the popover to lift the draft state up or compute it lazily.

**Also present:** 2 warnings in `src/stores/authStore.ts` for unused
`eslint-disable` directives. Same scope-boundary rationale.
