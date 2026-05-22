import type { ReactNode } from 'react';

type PrioritySectionProps = {
  bucket: 'HIGH' | 'STANDARD' | 'LOW';
  count: number;
  children: ReactNode;
};

export function PrioritySection({ bucket, count, children }: PrioritySectionProps) {
  if (count === 0) return null;

  return (
    <details open className="overflow-hidden rounded-md border border-rule bg-bg">
      <summary className="cursor-pointer bg-bg-2 px-4 py-2 text-sm font-semibold text-ink">
        {bucket} ({count})
      </summary>
      <div className="p-3">{children}</div>
    </details>
  );
}
