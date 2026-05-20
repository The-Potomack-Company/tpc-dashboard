import type { Priority } from '../../services/crm/types';

const PRIORITY_CLASSES: Record<Priority, string> = {
  high: 'bg-red-500 text-white',
  standard: 'bg-yellow-500 text-black',
  low: 'bg-green-500 text-white',
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
