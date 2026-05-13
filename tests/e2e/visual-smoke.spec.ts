import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/**
 * Phase 7 — visual smoke for the unified-design migration.
 *
 * Scope (intentional minimum):
 *   1. Boot the dev server.
 *   2. Visit /login (unauthenticated route) and assert no console errors.
 *   3. Hit the protected routes (/, /extension, /activity, /activity/stuck);
 *      ProtectedRoute redirects unauthenticated visitors back to /login,
 *      which is the verified empty-state behavior.
 *   4. Capture a screenshot per route under tests/e2e/screenshots/.
 *   5. Add .tpc-dark to <html> and re-screenshot /login to verify the
 *      dark mode treatment actually engages.
 *
 * We intentionally do NOT sign in here — the test runs without Supabase
 * env vars on a fresh checkout, and ProtectedRoute redirect is part of
 * the design we want to smoke.
 *
 * Console-error assertion: we filter out the well-known harmless
 * "favicon.svg" 304 warning that Chrome occasionally logs, and any
 * Supabase-config-missing warning (which is expected when VITE_SUPABASE_*
 * are absent).
 */

const SCREENSHOT_DIR = path.join(process.cwd(), "tests/e2e/screenshots");
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const HARMLESS_PATTERNS: RegExp[] = [
  /favicon\.svg/i,
  /VITE_SUPABASE/i,
  /supabase/i,
  /AuthRetryableFetchError/i,
  /NetworkError/i,
  /Failed to fetch/i,
];

function captureConsoleErrors(page: import("@playwright/test").Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      if (!HARMLESS_PATTERNS.some((rx) => rx.test(text))) {
        errors.push(text);
      }
    }
  });
  page.on("pageerror", (err) => {
    const text = err.message;
    if (!HARMLESS_PATTERNS.some((rx) => rx.test(text))) {
      errors.push(text);
    }
  });
  return errors;
}

const ROUTES_TO_SMOKE = [
  { path: "/login", slug: "login" },
  { path: "/", slug: "home" },
  { path: "/extension", slug: "extension" },
  { path: "/activity", slug: "activity" },
  { path: "/activity/stuck", slug: "activity-stuck" },
];

for (const route of ROUTES_TO_SMOKE) {
  test(`renders ${route.path} without console errors and captures a screenshot`, async ({
    page,
  }) => {
    const errors = captureConsoleErrors(page);
    await page.goto(route.path, { waitUntil: "domcontentloaded" });
    // Allow a beat for async render + ProtectedRoute redirect to settle.
    await page.waitForLoadState("networkidle").catch(() => {
      // networkidle can timeout under slow CI — non-fatal, we still assert below.
    });
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, `${route.slug}-light.png`),
      fullPage: true,
    });
    expect(errors, `console errors on ${route.path}: ${errors.join("\n")}`).toEqual([]);
  });
}

test("dark mode flip changes the body background", async ({ page }) => {
  const errors = captureConsoleErrors(page);
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  const lightBg = await page.evaluate(
    () => getComputedStyle(document.documentElement).backgroundColor,
  );
  await page.evaluate(() => document.documentElement.classList.add("tpc-dark"));
  // One paint frame for the cascade to flip.
  await page.waitForTimeout(50);
  const darkBg = await page.evaluate(
    () => getComputedStyle(document.documentElement).backgroundColor,
  );
  expect(darkBg, "dark mode background must differ from light").not.toBe(
    lightBg,
  );
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, "login-dark.png"),
    fullPage: true,
  });
  expect(errors, `console errors during dark flip: ${errors.join("\n")}`).toEqual([]);
});

test("DashboardAppIcon favicon ships under /favicon.svg", async ({ request }) => {
  const res = await request.get("/favicon.svg");
  expect(res.ok()).toBeTruthy();
  const body = await res.text();
  expect(body).toContain("<svg");
  // The accent needle stroke is the load-bearing visual proof that the
  // unified dial icon shipped (vs the legacy /vite.svg).
  expect(body).toContain("#0089b4");
});
