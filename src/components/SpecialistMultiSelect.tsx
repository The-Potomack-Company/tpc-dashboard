import { useEffect, useRef, useState } from 'react';
import { useSpecialistFilter } from '../hooks/useSpecialistFilter';
import { useActiveSpecialists } from '../hooks/activity/useActiveSpecialists';

// Phase 3 / APP-08 / D-19 — multi-select popover for the ?specialists= URL param.
//
// Mirrors the popover idiom from src/components/UserMultiSelect.tsx (Phase 2)
// — outside-click + Escape close, trigger button + absolute popover panel.
// Differences:
//   - Option list source: `useActiveSpecialists` (Plan 03-03 — RPC-backed,
//     filters role='admin' and is_active=false server-side per D-19).
//   - Visible label: option.display_name (NOT email) per D-19.
//   - URL filter param value: email (Pitfall 5 — emails are the join key
//     between specialists and other tables).
//
// Loading / error states render INSIDE the popover (not at the trigger),
// matching the inline-chip + retry-affordance pattern in 03-PATTERNS.md.

export function SpecialistMultiSelect() {
  const { specialists: selected, setSpecialists } = useSpecialistFilter();
  const optionsQuery = useActiveSpecialists();

  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Outside-click + Escape close (UserMultiSelect pattern, lines 39-55).
  useEffect(() => {
    if (!open) return;
    function handleDocClick(e: MouseEvent) {
      if (!popoverRef.current) return;
      if (!popoverRef.current.contains(e.target as Node)) setOpen(false);
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleDocClick);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleDocClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [open]);

  const triggerLabel =
    selected.length === 0
      ? 'All specialists'
      : `${selected.length} ${selected.length === 1 ? 'specialist' : 'specialists'}`;

  function toggle(email: string) {
    if (selected.includes(email)) setSpecialists(selected.filter((e) => e !== email));
    else setSpecialists([...selected, email]);
  }

  return (
    <div ref={popoverRef} className="relative inline-flex flex-col" data-testid="specialist-multi-select">
      <label className="sr-only" htmlFor="specialist-multi-select-trigger">
        Filter by specialist
      </label>
      <button
        id="specialist-multi-select-trigger"
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="h-8 px-3 rounded-md border border-gray-300 bg-white text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:ring-2 focus:ring-accent outline-none"
        data-testid="specialist-multi-select-trigger"
      >
        {triggerLabel}
      </button>
      {open && (
        <div
          role="listbox"
          aria-multiselectable="true"
          className="absolute top-full left-0 z-10 mt-1 flex flex-col gap-1 rounded-md border border-gray-200 bg-white p-2 shadow-lg min-w-48 max-h-72 overflow-y-auto"
          data-testid="specialist-multi-select-popover"
        >
          {optionsQuery.isLoading ? (
            <span className="text-sm text-gray-500 px-2 py-1">Loading specialists…</span>
          ) : optionsQuery.error ? (
            <div className="text-sm text-red-700 px-2 py-1">
              Couldn't load specialists.{' '}
              <button
                type="button"
                onClick={() => void optionsQuery.refetch()}
                className="underline focus:ring-2 focus:ring-accent rounded outline-none"
              >
                Retry
              </button>
            </div>
          ) : (optionsQuery.data ?? []).length === 0 ? (
            <span className="text-sm text-gray-500 px-2 py-1">No specialists.</span>
          ) : (
            (optionsQuery.data ?? []).map((opt) => {
              const visibleLabel = opt.display_name ?? opt.email;
              return (
                <label
                  key={opt.email}
                  className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(opt.email)}
                    onChange={() => toggle(opt.email)}
                    className="focus:ring-2 focus:ring-accent"
                    aria-label={visibleLabel}
                  />
                  <span className="text-sm text-gray-700">{visibleLabel}</span>
                </label>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
