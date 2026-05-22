import type { Department } from '../../services/crm/types';

export function DeptTags({ departments }: { departments: Department[] }) {
  if (departments.length === 0) {
    return <span className="text-sm text-ink-3">None</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {departments.map((dept) => (
        <span
          key={dept}
          className="inline-flex items-center rounded-full bg-bg-3 px-2 py-0.5 text-xs font-medium text-ink-2"
        >
          {dept}
        </span>
      ))}
    </div>
  );
}

export default DeptTags;
