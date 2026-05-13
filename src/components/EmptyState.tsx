import type { ReactNode } from 'react';

// Generic empty-state surface — reusable beyond Phase 3.
//
// Phase 7: shell uses .tpc-card chrome; heading + body shift to ink /
// ink-3 tokens so the contrast matches the surrounding page.

interface EmptyStateProps {
  heading: string;
  children: ReactNode;
}

export function EmptyState({ heading, children }: EmptyStateProps) {
  return (
    <div className="tpc-card p-8 flex flex-col items-center text-center">
      <h2 className="text-xl font-semibold text-ink">
        {heading}
      </h2>
      <div className="mt-4 text-base text-ink-3">
        {children}
      </div>
    </div>
  );
}
