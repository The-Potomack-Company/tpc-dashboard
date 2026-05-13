// src/lib/devAccess.ts
// D-16: email allowlist gating the <DeveloperPanel>. Allowlist ships in the
// production bundle — emails are not secrets per RFC 5321.
//
// Phase 8 (PR #2 follow-up): the email allowlist is also the canonical source
// of "is this account a developer/internal tester?" for both UI gating
// (DeveloperPanel, perf/failure widgets, dev toggles) AND server-side
// analytics filtering (the migration that adds `p_include_dev` to the
// activity RPCs hard-codes Josh's profile UUID, but the same email list is
// the long-term source of truth — adding a future dev means a one-line edit
// here AND a one-line edit in the migration's DEV_USER_PROFILE_IDS array).

export const DEV_EMAILS: ReadonlyArray<string> = [
  'josh@potomackco.com',
];

// `DEV_EMAIL_ALLOWLIST` is the spec-canonical name carried in the PR brief.
// Re-exported as an alias so callers can use either form. Both reference
// the same underlying array — single source of truth.
export const DEV_EMAIL_ALLOWLIST: ReadonlyArray<string> = DEV_EMAILS;

export function isDevAccount(email: string | null | undefined): boolean {
  if (!email) return false;
  // Case-insensitive comparison; emails are case-insensitive per RFC 5321.
  return DEV_EMAILS.includes(email.toLowerCase());
}
