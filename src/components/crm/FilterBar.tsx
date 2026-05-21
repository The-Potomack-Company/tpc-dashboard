import { useEffect, useRef, useState } from 'react';
import type { Department } from '../../services/crm/types';

export type FilterState = {
  departments: Set<Department>;
  stages: Set<string>;
  minAgeDays: number | null;
  maxAgeDays: number | null;
  search: string;
};

export const EMPTY_FILTERS: FilterState = {
  departments: new Set<Department>(),
  stages: new Set<string>(),
  minAgeDays: null,
  maxAgeDays: null,
  search: '',
};

const DEPARTMENT_OPTIONS: { value: Department; label: string }[] = [
  { value: 'furniture', label: 'Furniture' },
  { value: 'decarts', label: 'DecArts' },
  { value: 'books', label: 'Books' },
  { value: 'fashion', label: 'Fashion' },
  { value: 'art_sculpture', label: 'Art + Sculpture' },
];

type FilterBarProps = {
  stages: string[];
  filters: FilterState;
  onChange: (filters: FilterState) => void;
};

function toggleSetValue<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function parseAgeValue(value: string): number | null {
  if (value.trim() === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, parsed);
}

export function FilterBar({ stages, filters, onChange }: FilterBarProps) {
  const [stageOpen, setStageOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!stageOpen) return;

    function handleDocClick(event: MouseEvent) {
      if (!popoverRef.current) return;
      if (!popoverRef.current.contains(event.target as Node)) setStageOpen(false);
    }

    function handleEsc(event: KeyboardEvent) {
      if (event.key === 'Escape') setStageOpen(false);
    }

    document.addEventListener('mousedown', handleDocClick);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleDocClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [stageOpen]);

  const stageLabel =
    filters.stages.size === 0
      ? 'All stages'
      : `Stages: ${filters.stages.size} selected`;

  return (
    <div className="sticky top-0 z-20 mb-4 rounded-md border border-rule bg-bg px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-wrap gap-2" aria-label="Department filters">
          {DEPARTMENT_OPTIONS.map((department) => {
            const selected = filters.departments.has(department.value);
            return (
              <button
                key={department.value}
                type="button"
                onClick={() =>
                  onChange({
                    ...filters,
                    departments: toggleSetValue(filters.departments, department.value),
                  })
                }
                className={`rounded-full px-3 py-1 text-sm font-medium ${
                  selected ? 'bg-accent text-white' : 'bg-bg-2 text-ink-2'
                }`}
                aria-pressed={selected}
              >
                {department.label}
              </button>
            );
          })}
        </div>

        <div ref={popoverRef} className="relative inline-flex flex-col">
          <button
            type="button"
            onClick={() => setStageOpen((open) => !open)}
            aria-expanded={stageOpen}
            aria-haspopup="listbox"
            className="h-9 rounded-md border border-rule bg-bg-2 px-3 text-sm font-medium text-ink-2 hover:bg-bg-3 focus:ring-2 focus:ring-accent focus:outline-none"
          >
            {stageLabel}
          </button>
          {stageOpen && (
            <div
              role="listbox"
              aria-multiselectable="true"
              className="absolute top-full left-0 z-30 mt-1 flex max-h-72 min-w-56 flex-col gap-1 overflow-y-auto rounded-md border border-rule bg-bg p-2 shadow-lg"
            >
              {stages.length === 0 ? (
                <span className="px-2 py-1 text-sm text-ink-3">No stages.</span>
              ) : (
                stages.map((stage) => (
                  <label
                    key={stage}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-bg-2"
                  >
                    <input
                      type="checkbox"
                      checked={filters.stages.has(stage)}
                      onChange={() =>
                        onChange({
                          ...filters,
                          stages: toggleSetValue(filters.stages, stage),
                        })
                      }
                      className="focus:ring-2 focus:ring-accent"
                      aria-label={stage}
                    />
                    <span className="text-sm text-ink-2">{stage}</span>
                  </label>
                ))
              )}
            </div>
          )}
        </div>

        <label className="flex flex-col gap-1 text-xs font-medium text-ink-3">
          Min days
          <input
            type="number"
            min={0}
            value={filters.minAgeDays ?? ''}
            onChange={(event) =>
              onChange({ ...filters, minAgeDays: parseAgeValue(event.target.value) })
            }
            className="h-9 w-24 rounded-md border border-rule bg-bg px-2 text-sm text-ink focus:ring-2 focus:ring-accent focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-ink-3">
          Max days
          <input
            type="number"
            min={0}
            value={filters.maxAgeDays ?? ''}
            onChange={(event) =>
              onChange({ ...filters, maxAgeDays: parseAgeValue(event.target.value) })
            }
            className="h-9 w-24 rounded-md border border-rule bg-bg px-2 text-sm text-ink focus:ring-2 focus:ring-accent focus:outline-none"
          />
        </label>

        <label className="flex min-w-64 flex-1 flex-col gap-1 text-xs font-medium text-ink-3">
          Search
          <input
            type="search"
            value={filters.search}
            onChange={(event) => onChange({ ...filters, search: event.target.value })}
            placeholder="Search subject, sender, or body"
            className="h-9 rounded-md border border-rule bg-bg px-3 text-sm text-ink focus:ring-2 focus:ring-accent focus:outline-none"
          />
        </label>

        <button type="button" onClick={() => onChange(EMPTY_FILTERS)} className="tpc-btn">
          Reset
        </button>
      </div>
    </div>
  );
}
