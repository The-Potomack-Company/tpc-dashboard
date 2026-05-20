---
phase: 03-poller-function
plan: 01
slug: crm-v05-03-poller
status: complete
---

# 03-01 Summary — CRM v0.5 Poller Function

## Commits

1. `efecdca feat(crm-v05-demo): crm-poll vercel function`
2. `d2f5785 test(crm-v05-demo): crm-poll integration test coverage`
3. `docs(crm-v05-demo): document env requirements for crm-poll`

## Files Created

- `api/crm-poll.ts`
- `api/__tests__/crm-poll.test.ts`
- `api/README.md`
- `supabase/migrations/20260520150000_add_crm_classification_metadata.sql`
- `.planning/milestones/crm-v05-demo-phases/03-poller-function/03-01-SUMMARY.md`

## Files Modified

- `api/lib/crm/types.ts`
- `api/lib/crm/streakApi.ts`
- `api/lib/crm/gmailApi.ts`
- `api/lib/crm/crmClassifier.ts`
- `src/db/database.types.ts`

## Deviations From Plan

- Added an additive migration for `crm_classifications.metadata`. The existing CRM schema did not include the required JSON metadata column for `metadata.body_hash`, so hash-skip could not be implemented safely without it.
- `GMAIL_REFRESH_TOKEN` is the documented and validated env var. `gmailApi` still accepts legacy `GMAIL_OAUTH_REFRESH_TOKEN` as a fallback to preserve phase-02 compatibility.
- `vercel.json` was not added. `export const maxDuration = 60` is present on `api/crm-poll.ts`.
- Gmail body metadata is not available from the existing `gmailApi.getThreadBody(threadId): Promise<string>` contract, so `received_at` is populated from the Streak box timestamp.

## Verification

```text
npm run build
```

Passed. Output included `tsc -b && vite build`, with Vite's existing large-chunk warning only.

```text
npm run test -- api
```

Passed: 4 test files, 23 tests.

```text
npm run lint
```

Passed with existing warnings only:
- TanStack Table `react-hooks/incompatible-library` warnings in existing table components.
- Existing unused `eslint-disable` warnings in `useSkipReasons.ts` and `authStore.ts`.

```text
grep -r 'import.meta.env' api/ || true
```

No matches.

```text
grep -r 'messages.modify\|messages.send\|messages.trash' api/ || true
```

Only existing Gmail API tests assert forbidden verbs throw:
- `api/lib/crm/__tests__/gmailApi.test.ts` for `messages.modify`
- `api/lib/crm/__tests__/gmailApi.test.ts` for `messages.send`

## Blockers

None. SSH push remains intentionally skipped per sandbox instructions.
