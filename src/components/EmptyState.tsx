import type { ReactNode } from 'react';

// Generic empty-state surface — reusable beyond Phase 3.
//
// Heading uses the Heading role from 03-UI-SPEC.md § Typography
// (text-xl font-semibold). Body color is muted gray. Children can
// include inline <code> spans, links, or CTA buttons.

interface EmptyStateProps {
  heading: string;
  children: ReactNode;
}

export function EmptyState({ heading, children }: EmptyStateProps) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-8 flex flex-col items-center text-center">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
        {heading}
      </h2>
      <div className="mt-4 text-base text-gray-500 dark:text-gray-400">
        {children}
      </div>
    </div>
  );
}
