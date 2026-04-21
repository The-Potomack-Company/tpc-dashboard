import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router';
import { useAuthStore } from '../stores/authStore';

const NAV_LINKS = [
  { label: 'Sales' },
  { label: 'Trends' },
  { label: 'Departments' },
  { label: 'Team' },
  { label: 'Reports' },
  { label: 'Custom Charts' },
];

export function DashboardLayout() {
  const profile = useAuthStore((s) => s.profile);
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const displayName =
    profile?.display_name ?? user?.email?.split('@')[0] ?? 'User';
  const initial = displayName.charAt(0).toUpperCase();

  async function handleSignOut() {
    setMenuOpen(false);
    await signOut();
    navigate('/login', { replace: true });
  }

  return (
    <div className="grid grid-cols-[15rem_1fr] h-dvh bg-white dark:bg-gray-900">
      <aside className="flex flex-col border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="h-12 flex items-center px-6 text-base font-semibold text-gray-900 dark:text-gray-100">
          TPC Dashboard
        </div>
        <div className="pt-6 px-6 text-xs font-semibold tracking-wider text-gray-500 dark:text-gray-400">
          ANALYTICS
        </div>
        <nav className="mt-2 flex flex-col">
          {NAV_LINKS.map((link) => (
            <span
              key={link.label}
              aria-disabled="true"
              className="flex items-center justify-between h-11 px-6 text-sm text-gray-500 dark:text-gray-400 cursor-not-allowed"
            >
              <span>{link.label}</span>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                Coming soon
              </span>
            </span>
          ))}
        </nav>
        <div className="flex-1" />
        <div className="px-6 pb-4 text-xs text-gray-400 dark:text-gray-500">
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
              <span>Welcome, {displayName}</span>
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
