// Shell for authenticated admin routes. Wave 4 refactor.
//
// Root grid: grid-cols-[4rem_1fr] lg:grid-cols-[15rem_1fr]. Below lg the
// sidebar is a 64px icon rail; at lg it expands to 240px with labels.
// Sales becomes an active NavLink to /sales. Other phases remain
// aria-disabled spans with a Coming soon aside (hidden at md). Every
// nav entry renders an inline SVG icon for the icon-rail.
//
// Threat model: page only mounts behind ProtectedRoute; displayName +
// user.email render as React text children (JSX auto-escapes).

import type { ReactElement } from "react";
import { useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router";
import { useAuthStore } from "../stores/authStore";

// Simplified Heroicons-style outline SVGs (stroke-width 1.5, 20x20).
// Path data is intentionally terse â€” differentiated shapes for each
// nav entry without embedding the full Heroicons paths. Phase 1
// precedent: no @heroicons/react dependency.

function svgShell(d: string): ReactElement {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="w-5 h-5 shrink-0"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

// table-cells style grid for Sales
function IconTableCells(): ReactElement {
  return svgShell("M3 5h18v14H3V5Zm0 5h18M3 15h18M9 5v14M15 5v14");
}

// vertical bars for Trends
function IconChartBar(): ReactElement {
  return svgShell("M4 20h16M6 20V10m5 10V6m5 14v-8m5 8V8");
}

// columned building for Departments
function IconBuildingLibrary(): ReactElement {
  return svgShell("M3 10 12 4l9 6v1H3v-1Zm2 2v8m14-8v8M9 12v8m6-8v8M3 20h18");
}

// two-people silhouettes for Team
function IconUsers(): ReactElement {
  return svgShell(
    "M8 10a3 3 0 1 1 0-6 3 3 0 0 1 0 6Zm8 0a3 3 0 1 1 0-6 3 3 0 0 1 0 6Zm-8 2a5 5 0 0 0-5 5v1h10v-1a5 5 0 0 0-5-5Zm8 0h-2a5 5 0 0 1 5 5v1h-5",
  );
}

// folded-document for Reports
function IconDocumentText(): ReactElement {
  return svgShell("M6 3h8l4 4v14H6V3Zm8 0v4h4M8 12h8M8 16h8M8 8h4");
}

// pie-chart for Custom Charts
function IconChartPie(): ReactElement {
  return svgShell("M12 3a9 9 0 1 0 9 9h-9V3Zm2-0a7 7 0 0 1 7 7h-7V3Z");
}

interface NavItem {
  label: string;
  to?: string;
  Icon: () => ReactElement;
}

// Sales is the only active entry in Phase 3. Phases 4-9 add the rest.
const NAV_ITEMS: NavItem[] = [
  { label: "Sales", to: "/sales", Icon: IconTableCells },
  { label: "Trends", Icon: IconChartBar },
  { label: "Departments", Icon: IconBuildingLibrary },
  { label: "Team", Icon: IconUsers },
  { label: "Reports", Icon: IconDocumentText },
  { label: "Custom Charts", Icon: IconChartPie },
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
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-8 py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

export default DashboardLayout;
