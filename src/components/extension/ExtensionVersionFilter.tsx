import { useEffect, useMemo, useRef, useState } from 'react';
import { useVersionFilter } from '../../hooks/extension/useVersionFilter';
import { useDistinctVersions } from '../../hooks/extension/useDistinctVersions';

// Phase 2 / EXT-09 — Multi-select popover for the ?versions= URL param (D-17).
//
// Pattern: borrows the popover idiom from src/components/UserMultiSelect.tsx
// (Plan 02-05) — outside-click + Escape close, trigger button + `absolute
// top-full` panel. The option list comes from the centralized
// useDistinctVersions hook (Plan 02-03). NEVER inline a database query here
// (Checker WARNING #4 — fetchDistinctVersions is the SOLE source for the
// distinct extension_version list).
//
// Already-selected versions that are NOT in the current option set still
// appear as checked options (URL-driven survival): if a dev navigates with
// ?versions=ghost&... but that version isn't currently present in
// analytics_events, the chip still needs to be deselectable.

export function ExtensionVersionFilter() {
  const { versions: selected, setVersions } = useVersionFilter();
  const { data: rows } = useDistinctVersions();

  const options = useMemo(() => {
    const set = new Set<string>(selected);
    for (const v of rows ?? []) set.add(v);
    // Sort newest-first lexicographically (matches fetchDistinctVersions order;
    // semver-newest typically reads as lexicographic-newest for the live data).
    return [...set].sort().reverse();
  }, [rows, selected]);

  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

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
      ? 'All versions'
      : `${selected.length} ${selected.length === 1 ? 'version' : 'versions'}`;

  function toggle(version: string) {
    if (selected.includes(version)) {
      setVersions(selected.filter((v) => v !== version));
    } else {
      setVersions([...selected, version]);
    }
  }

  return (
    <div
      className="relative inline-flex flex-col"
      data-testid="extension-version-filter"
    >
      <label
        className="sr-only"
        htmlFor="extension-version-filter-trigger"
      >
        Filter by extension version
      </label>
      <button
        id="extension-version-filter-trigger"
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Filter by extension version"
        className="h-8 px-3 rounded-md border border-rule-2 bg-bg text-sm font-medium text-ink-2 shadow-sm hover:bg-bg-2 focus:ring-2 focus:ring-accent outline-none"
        data-testid="extension-version-filter-trigger"
      >
        {triggerLabel}
      </button>
      {open && (
        <div
          ref={popoverRef}
          role="listbox"
          aria-multiselectable="true"
          className="absolute top-full left-0 z-10 mt-1 flex flex-col gap-1 rounded-md border border-rule bg-bg p-2 shadow-lg min-w-48 max-h-72 overflow-y-auto"
          data-testid="extension-version-filter-popover"
        >
          {options.length === 0 && (
            <span className="text-sm text-ink-3 px-2 py-1">
              No versions available
            </span>
          )}
          {options.map((version) => (
            <label
              key={version}
              className="flex items-center gap-2 px-2 py-1 rounded hover:bg-bg-2 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selected.includes(version)}
                onChange={() => toggle(version)}
                className="focus:ring-2 focus:ring-accent"
                aria-label={version}
              />
              <span className="text-sm text-ink-2 tabular-nums">
                {version}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
