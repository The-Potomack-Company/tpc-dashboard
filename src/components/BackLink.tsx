// Reusable back-navigation link for Phase 3 detail pages.
//
// Phase 7: uses the unified Icon (`back` arrow) and token-backed text
// colors (ink-2 -> ink on hover).

import { Link } from 'react-router';
import type { ReactNode } from 'react';
import { Icon } from '../ui/icons/Icon';

interface BackLinkProps {
  to: string;
  children: ReactNode;
}

export function BackLink({ to, children }: BackLinkProps) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1 text-sm text-ink-2 hover:text-ink focus:ring-2 focus:ring-accent rounded outline-none"
    >
      <Icon name="back" size={16} />
      <span>{children}</span>
    </Link>
  );
}
