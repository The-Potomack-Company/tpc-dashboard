import { useState, useRef, useEffect } from 'react';
import { useDateRange, type DateRangePreset } from '../../hooks/useDateRange';

// Phase 1 / INFR-03 — shared UI kit (Phase 7 unified-design migration).
// Segmented preset buttons + custom-range popover (D-15, D-18). Reads and
// writes URL via useDateRange — no controlled props, keeps callers from
// needing to wire the URL manually.
//
// Phase 7: surfaces, borders, and text shift to design tokens. The active
// preset uses accent + accent-ink (was bg-bg + text-accent-ink). Custom
// popover inputs adopt the .tpc-input treatment; primary action becomes a
// `tpc-btn tpc-btn-primary`, cancel becomes `tpc-btn tpc-btn-secondary`.

interface DateRangeFilterProps {
  className?: string;
}

const PRESET_BUTTONS: Array<{ value: DateRangePreset; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: 'custom', label: 'Custom' },
];

function formatISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function DateRangeFilter({ className }: DateRangeFilterProps) {
  const { range, from, to, setRange, setCustom } = useDateRange();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState<string>(formatISODate(from));
  const [draftTo, setDraftTo] = useState<string>(formatISODate(to));
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (popoverOpen) {
      setDraftFrom(formatISODate(from));
      setDraftTo(formatISODate(to));
    }
  }, [popoverOpen, from, to]);

  useEffect(() => {
    if (!popoverOpen) return;
    function handleDocClick(e: MouseEvent) {
      if (!popoverRef.current) return;
      if (!popoverRef.current.contains(e.target as Node)) {
        setPopoverOpen(false);
      }
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setPopoverOpen(false);
    }
    document.addEventListener('mousedown', handleDocClick);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleDocClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [popoverOpen]);

  function handlePresetClick(preset: DateRangePreset) {
    if (preset === 'custom') {
      setPopoverOpen(true);
      return;
    }
    setRange(preset);
  }

  function handleApply() {
    const f = new Date(draftFrom + 'T00:00:00');
    const t = new Date(draftTo + 'T23:59:59');
    setCustom(f, t);
    setPopoverOpen(false);
  }

  function handleCancel() {
    setPopoverOpen(false);
  }

  return (
    <div
      className={'relative inline-flex flex-col gap-0 ' + (className ?? '')}
      data-testid="date-range-filter"
    >
      <div className="inline-flex overflow-hidden rounded-md border border-rule-2 bg-bg shadow-sm">
        {PRESET_BUTTONS.map(({ value, label }) => {
          const active = value === range;
          return (
            <button
              key={value}
              type="button"
              onClick={() => handlePresetClick(value)}
              aria-pressed={active}
              data-testid={`date-range-preset-${value}`}
              className={
                'border-r border-rule-2 px-3 py-1.5 text-sm font-medium last:border-r-0 transition-colors ' +
                (active
                  ? 'bg-accent text-accent-ink'
                  : 'bg-bg text-ink hover:bg-bg-2')
              }
            >
              {label}
            </button>
          );
        })}
      </div>

      {popoverOpen && (
        <div
          ref={popoverRef}
          className="absolute top-full left-0 z-10 mt-1 flex flex-col gap-2 rounded-md border border-rule bg-bg p-3 shadow-lg"
          data-testid="date-range-popover"
        >
          <label className="flex flex-col gap-1 text-xs font-medium text-ink-2">
            From
            <input
              type="date"
              value={draftFrom}
              onChange={(e) => setDraftFrom(e.target.value)}
              data-testid="date-range-from"
              className="tpc-input"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-ink-2">
            To
            <input
              type="date"
              value={draftTo}
              onChange={(e) => setDraftTo(e.target.value)}
              data-testid="date-range-to"
              className="tpc-input"
            />
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={handleCancel}
              data-testid="date-range-cancel"
              className="tpc-btn tpc-btn-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              data-testid="date-range-apply"
              className="tpc-btn tpc-btn-primary"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
