// Reusable back-navigation link for Phase 3 detail pages.
// Contract: 03-UI-SPEC.md § Copywriting → "← Back to sales"; § Accessibility Floor
// (inline icon + visible focus ring). The arrow SVG is a Heroicons outline
// arrow-left (stroke-width 1.5) inlined to avoid a package dependency.

import { Link } from 'react-router';
import type { ReactNode } from 'react';

interface BackLinkProps {
  to: string;
  children: ReactNode;
}

export function BackLink({ to, children }: BackLinkProps) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 focus:ring-2 focus:ring-accent rounded outline-none"
    >
      {/* Heroicons outline arrow-left */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className="w-4 h-4"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
        />
      </svg>
      <span>{children}</span>
    </Link>
  );
}
