import { useEffect, useMemo, useRef, useState } from 'react';
import { useUserFilter } from '../hooks/extension/useUserFilter';
import { usePerUserSummary } from '../hooks/extension/usePerUserSummary';

// Phase 2 / EXT-07 — Multi-select popover for the ?users= URL param (D-17).
//
// Pattern: borrows the popover idiom from src/components/kit/DateRangeFilter.tsx
// (Phase 1) — outside-click + Escape close, trigger button + `absolute top-full`
// panel. The option list is derived from the usePerUserSummary cache so we
// don't issue a separate "what users exist?" query (already in cache from EXT-04).
//
// 'Unknown' is a real selectable value (D-04: the get_per_user_summary RPC
// coalesces NULL emails to 'Unknown'; users can filter by it just like any email).
// We render its label as 'Unknown (no email)' per UI-SPEC § Copywriting.
//
// Already-selected users that are NOT in the current per-user data set still
// appear as checked options (URL-driven survival): if the user navigates with
// ?users=ghost@x.com but ghost@x.com isn't in the active range, they still need
// a way to deselect it.

export function UserMultiSelect() {
  const { users: selected, setUsers } = useUserFilter();
  const { data: rows } = usePerUserSummary();

  const options = useMemo(() => {
    const set = new Set<string>(selected);
    for (const r of rows ?? []) set.add(r.user_email_label);
    return [...set].sort((a, b) => {
      // Pin 'Unknown' to the bottom so the alphabetical user list reads cleanly.
      if (a === 'Unknown') return 1;
      if (b === 'Unknown') return -1;
      return a.localeCompare(b);
    });
  }, [rows, selected]);

  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Outside-click + Escape close (DateRangeFilter pattern, lines 43-60).
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
      ? 'All users'
      : `${selected.length} ${selected.length === 1 ? 'user' : 'users'}`;

  function toggle(email: string) {
    if (selected.includes(email)) setUsers(selected.filter((e) => e !== email));
    else setUsers([...selected, email]);
  }

  return (
    <div className="relative inline-flex flex-col" data-testid="user-multi-select">
      {/* sr-only label associates with the trigger via htmlFor (UI-SPEC § Copywriting). */}
      <label className="sr-only" htmlFor="user-multi-select-trigger">
        Filter by user email
      </label>
      <button
        id="user-multi-select-trigger"
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="h-8 px-3 rounded-md border border-gray-300 bg-white text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:ring-2 focus:ring-accent outline-none"
        data-testid="user-multi-select-trigger"
      >
        {triggerLabel}
      </button>
      {open && (
        <div
          ref={popoverRef}
          role="listbox"
          aria-multiselectable="true"
          className="absolute top-full left-0 z-10 mt-1 flex flex-col gap-1 rounded-md border border-gray-200 bg-white p-2 shadow-lg min-w-48 max-h-72 overflow-y-auto"
          data-testid="user-multi-select-popover"
        >
          {options.length === 0 && (
            <span className="text-sm text-gray-500 px-2 py-1">No users available</span>
          )}
          {options.map((email) => {
            const isUnknown = email === 'Unknown';
            const visibleLabel = isUnknown ? 'Unknown (no email)' : email;
            return (
              <label
                key={email}
                className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(email)}
                  onChange={() => toggle(email)}
                  className="focus:ring-2 focus:ring-accent"
                  aria-label={visibleLabel}
                />
                <span
                  className={
                    isUnknown
                      ? 'text-sm italic text-gray-500'
                      : 'text-sm text-gray-700'
                  }
                >
                  {visibleLabel}
                </span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
