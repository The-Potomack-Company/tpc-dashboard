import { defineConfig, devices } from "@playwright/test";

/**
 * Phase 7 — Playwright visual-smoke configuration.
 *
 * Boots `npm run dev` on port 5173 (Vite's default). Reuses an existing dev
 * server if one is already running. Times out at 90 s for the first boot
 * (cold start incl. esbuild warmup is ~5–10 s; budget cushioning for
 * shared-CI hosts). Each test re-uses the same dev server across runs so
 * the suite stays fast.
 *
 * SUPABASE env: the smoke checks render the dashboard shell only. If
 * `VITE_SUPABASE_URL` is not set, /login and unauthenticated routes still
 * render (they do not call Supabase). Tests that probe authenticated routes
 * (`/extension`, `/activity`) will surface the ProtectedRoute redirect
 * to `/login`, which is intentional — we still verify the visual shell of
 * the redirected page.
 *
 * Screenshots land under tests/e2e/screenshots/ (gitignored — see the
 * sibling .gitignore committed alongside this file).
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 5173",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 90_000,
  },
});
