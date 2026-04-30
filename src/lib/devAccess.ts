// src/lib/devAccess.ts
// D-16: email allowlist gating the <DeveloperPanel>. Allowlist ships in the
// production bundle — emails are not secrets per RFC 5321.

export const DEV_EMAILS: ReadonlyArray<string> = [
  'josh@potomackco.com',
];

export function isDevAccount(email: string | null | undefined): boolean {
  if (!email) return false;
  // Case-insensitive comparison; emails are case-insensitive per RFC 5321.
  return DEV_EMAILS.includes(email.toLowerCase());
}
