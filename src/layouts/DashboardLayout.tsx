// Shell for authenticated admin routes.
//
// v2.0 reset: all v1 NavLinks retired. Nav entries are placeholders until
// v2.0 phases reactivate them (Team Activity, Cataloger Extension analytics,
// Live Sale tracking). Root grid: grid-cols-[4rem_1fr] lg:grid-cols-[15rem_1fr].
// Below lg the sidebar is a 64px icon rail; at lg it expands to 240px with labels.
//
// Threat model: page only mounts behind ProtectedRoute; displayName +
// user.email render as React text children (JSX auto-escapes).

import type { ReactElement } from "react";
import { useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router";
import { useAuthStore } from "../stores/authStore";

interface NavItem {
  label: string;
  to?: string;
  Icon: () => ReactElement;
}

// v2.0 phases activate sidebar entries as they ship. Phase 2 lit up the
// Extension entry (/extension); Phase 3 appends Activity (/activity).
// Phase 5 will add Live tracking. Insertion order matches the visual
// order in the sidebar; tests in DashboardLayout.test.tsx assert
// "Extension before Activity".
//
// D-03 — the Activity NavLink is intentionally rendered WITHOUT the
// react-router `end` prop so descendants like `/activity/sessions/:id`
// and `/activity/stuck` match the active state. NavLink defaults to
// "starts-with" matching when `end` is absent.
export const NAV_ITEMS: NavItem[] = [
  {
    label: "Extension",
    to: "/extension",
    Icon: () => (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className="w-5 h-5"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"
        />
      </svg>
    ),
  },
  {
    label: "Activity",
    to: "/activity",
    Icon: () => (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className="w-5 h-5"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Zm-1.5 3.75h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z"
        />
      </svg>
    ),
  },
];

export function DashboardLayout() {
  const profile = useAuthStore((s) => s.profile);
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const displayName =
    profile?.display_name ?? user?.email?.split("@")[0] ?? "User";
  const initial = displayName.charAt(0).toUpperCase();

  async function handleSignOut() {
    setMenuOpen(false);
    await signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div className="grid grid-cols-[4rem_1fr] lg:grid-cols-[15rem_1fr] h-dvh bg-white dark:bg-gray-900">
      <aside className="flex flex-col border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="h-12 flex items-center justify-center lg:justify-start lg:px-6 text-base font-semibold text-gray-900 dark:text-gray-100">
          <span className="hidden lg:inline">TPC Dashboard</span>
          <span className="lg:hidden">TPC</span>
        </div>
        <div className="hidden lg:block pt-6 px-6 text-xs font-semibold tracking-wider text-gray-500 dark:text-gray-400">
          ANALYTICS
        </div>
        <nav className="mt-2 flex flex-col">
          {NAV_ITEMS.map((item) => {
            if (item.to) {
              return (
                <NavLink
                  key={item.label}
                  to={item.to}
                  title={item.label}
                  aria-label={item.label}
                  className={({ isActive }) =>
                    `flex items-center h-11 gap-3 px-4 lg:px-6 text-sm ${
                      isActive
                        ? "text-accent border-l-2 border-accent bg-accent/5"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`
                  }
                >
                  <item.Icon />
                  <span className="hidden lg:inline">{item.label}</span>
                </NavLink>
              );
            }
            return (
              <span
                key={item.label}
                aria-disabled="true"
                title={`${item.label} â€” Coming soon`}
                aria-label={item.label}
                className="flex items-center justify-between h-11 px-4 lg:px-6 text-sm text-gray-500 dark:text-gray-400 cursor-not-allowed"
              >
                <span className="flex items-center gap-3">
                  <item.Icon />
                  <span className="hidden lg:inline">{item.label}</span>
                </span>
                <span className="hidden lg:inline text-xs text-gray-400 dark:text-gray-500">
                  Coming soon
                </span>
              </span>
            );
          })}
        </nav>
        <div className="flex-1" />
        <div className="hidden lg:block px-6 pb-4 text-xs text-gray-400 dark:text-gray-500">
          v0.0.0
        </div>
      </aside>
      <div className="flex flex-col min-w-0">
        <header className="h-16 flex items-center justify-end border-b border-gray-200 dark:border-gray-700 px-6 sticky top-0 bg-white dark:bg-gray-900 z-10">
          <div className="relative">
            <button
              type="button"
              aria-label="Open account menu"
              onClick={() => setMenuOpen((o) => !o)}
              className="flex items-center gap-2 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-accent rounded-lg outline-none"
            >
              <span className="hidden lg:inline">Welcome, {displayName}</span>
              <span className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center font-semibold">
                {initial}
              </span>
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-10 w-40 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleSignOut}
                  className="w-full text-left px-4 py-2 text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg focus:ring-2 focus:ring-accent outline-none"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </header>
        {/* WR-05: main is a flex column so pages can claim remaining height
            via `flex-1 min-h-0` (SalesTable virtualization needs a bounded
            scroll container). Outer scroll lives on the inner wrapper so
            pages like SaleDetail still scroll naturally when content
            overflows, while pages like Sales (flex-col with flex-1 table)
            size their inner scroll against the leftover space. */}
        <main className="flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="max-w-7xl mx-auto px-8 py-8 min-h-full flex flex-col">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default DashboardLayout;
