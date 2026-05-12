/**
 * src/ui/tokens/initTheme.ts
 *
 * Runtime dark-mode listener (Phase 7 — system-pref only).
 *
 * Two-piece bootstrap (same as cataloger Phase 22):
 *   1. The inline <script> in index.html does the synchronous pre-paint pass
 *      (mandatory for no-FOUC on cold load).
 *   2. This helper handles runtime live updates — when the OS dark/light
 *      preference flips during a session, .tpc-dark flips on <html>
 *      without a reload.
 *
 * A future phase can extend opts.override to apply a stored user preference;
 * Phase 7 stays system-pref-only. The opts param is accepted and ignored so
 * future call sites won't need updating.
 */

export type ThemeOverride = "light" | "dark" | "system";

export interface InitThemeOpts {
  override?: ThemeOverride;
}

export function initTheme(opts: InitThemeOpts = {}): () => void {
  void opts;

  if (typeof window === "undefined" || !window.matchMedia) {
    return () => {};
  }

  const mq = window.matchMedia("(prefers-color-scheme: dark)");

  const apply = (matches: boolean): void => {
    document.documentElement.classList.toggle("tpc-dark", matches);
  };

  apply(mq.matches);

  const listener = (e: MediaQueryListEvent): void => apply(e.matches);
  mq.addEventListener("change", listener);

  return () => mq.removeEventListener("change", listener);
}
