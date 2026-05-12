// Shell for authenticated admin routes.
//
// v2.0 reset: all v1 NavLinks retired. Nav entries are placeholders until
// v2.0 phases reactivate them (Team Activity, Cataloger Extension analytics,
// Live Sale tracking). Root grid: grid-cols-[4rem_1fr] lg:grid-cols-[15rem_1fr].
// Below lg the sidebar is a 64px icon rail; at lg it expands to 240px with labels.
//
// Phase 7 unified-design migration:
//   - Surfaces shift to token classes (bg-bg / bg-bg-2 / border-rule).
//   - Sidebar app-tile now renders the unified DashboardAppMark (analog dial).
//   - Nav SVGs switch from inline path stacks to <Icon name="…" />.
//   - Active-state preserves the existing text-accent/border-accent vocabulary
//     so DashboardLayout.test.tsx selectors still match; the underlying token
//     just resolves to the unified teal-blue accent now.
//
// Threat model: page only mounts behind ProtectedRoute; displayName +
// user.email render as React text children (JSX auto-escapes).

import type { ReactElement } from "react";
import { useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router";
import { useAuthStore } from "../stores/authStore";
import { Icon } from "../ui/icons/Icon";
import { DashboardAppMark } from "../ui/icons/AppIcons";
import type { IconName } from "../ui/icons/manifest";

interface NavItem {
  label: string;
  to?: string;
  Icon: () => ReactElement;
}

function NavIcon({ name }: { name: IconName }) {
  return <Icon name={name} size={20} aria-hidden="true" />;
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
    Icon: () => <NavIcon name="chart" />,
  },
  {
    label: "Activity",
    to: "/activity",
    Icon: () => <NavIcon name="pulse" />,
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
    <div className="grid grid-cols-[4rem_1fr] lg:grid-cols-[15rem_1fr] h-dvh bg-bg">
      <aside className="flex flex-col border-r border-rule bg-bg-2">
        <div className="h-12 flex items-center justify-center lg:justify-start lg:px-4 gap-2">
          <DashboardAppMark size={28} />
          <span className="hidden lg:inline text-base font-semibold text-ink">
            TPC Dashboard
          </span>
        </div>
        <div className="hidden lg:block pt-6 px-6 tpc-eyebrow">
          Analytics
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
                    `flex items-center h-11 gap-3 px-4 lg:px-6 text-sm transition-colors ${
                      isActive
                        ? "text-accent border-l-2 border-accent bg-accent-wash"
                        : "text-ink-2 hover:bg-bg-3 hover:text-ink"
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
                title={`${item.label} — Coming soon`}
                aria-label={item.label}
                className="flex items-center justify-between h-11 px-4 lg:px-6 text-sm text-ink-4 cursor-not-allowed"
              >
                <span className="flex items-center gap-3">
                  <item.Icon />
                  <span className="hidden lg:inline">{item.label}</span>
                </span>
                <span className="hidden lg:inline text-xs text-ink-4">
                  Coming soon
                </span>
              </span>
            );
          })}
        </nav>
        <div className="flex-1" />
        <div className="hidden lg:block px-6 pb-4 text-xs text-ink-4">
          v0.0.0
        </div>
      </aside>
      <div className="flex flex-col min-w-0">
        <header className="h-16 flex items-center justify-end border-b border-rule px-6 sticky top-0 bg-bg z-10">
          <div className="relative">
            <button
              type="button"
              aria-label="Open account menu"
              onClick={() => setMenuOpen((o) => !o)}
              className="flex items-center gap-2 text-sm text-ink focus:ring-2 focus:ring-accent rounded-md outline-none"
            >
              <span className="hidden lg:inline">Welcome, {displayName}</span>
              <span className="w-8 h-8 rounded-full bg-accent text-accent-ink flex items-center justify-center font-semibold">
                {initial}
              </span>
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="tpc-card absolute right-0 top-10 w-40 shadow-sm"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleSignOut}
                  className="w-full text-left px-4 py-2 text-sm text-ink hover:bg-bg-2 rounded-lg focus:ring-2 focus:ring-accent outline-none"
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
