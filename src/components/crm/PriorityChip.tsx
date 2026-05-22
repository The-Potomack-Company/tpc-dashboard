import type { Priority } from '../../services/crm/types';

const PRIORITY_CLASSES: Record<Priority, string> = {
  high: 'bg-err-wash text-err',
  standard: 'bg-bg-3 text-ink',
  low: 'bg-ok-wash text-ok',
};

export function PriorityChip({ priority }: { priority: Priority }) {
  return (
    <span
      className={`inline-flex min-w-20 items-center justify-center rounded-full px-2.5 py-1 text-xs font-semibold uppercase ${PRIORITY_CLASSES[priority]}`}
      data-priority={priority}
    >
      {priority}
    </span>
  );
}

export default PriorityChip;
