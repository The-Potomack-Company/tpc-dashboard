import { useModeFilter, type SessionMode } from '../hooks/useModeFilter';

// Phase 3 / APP-09 / D-20 / D-21 — segmented session-mode toggle.
//
// D-20: targets `sessions.mode` server-side (canonical). The filter writes
// `?mode=house` or `?mode=sale` and OMITS the param when the mode is 'all'
// (the default).
//
// D-21: default = 'all' (no URL param) — `<ModeToggle>` highlights "All"
// when there is no `?mode=` segment in the URL.
//
// a11y: rendered as a `radiogroup` with three `radio`-role buttons. Each
// radio has aria-checked reflecting active state. The group has an
// aria-label so screen readers announce the purpose ("Filter by session
// mode").

const OPTIONS: ReadonlyArray<{ value: SessionMode; label: string }> = [
  { value: 'all',   label: 'All' },
  { value: 'house', label: 'House' },
  { value: 'sale',  label: 'Sale' },
];

export function ModeToggle() {
  const { mode, setMode } = useModeFilter();

  return (
    <div
      role="radiogroup"
      aria-label="Filter by session mode"
      className="inline-flex rounded-md border border-gray-300 overflow-hidden bg-white shadow-sm"
      data-testid="mode-toggle"
    >
      {OPTIONS.map((opt) => {
        const active = mode === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setMode(opt.value)}
            className={`h-8 px-3 text-sm font-medium focus:ring-2 focus:ring-accent outline-none ${
              active
                ? 'bg-accent text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
            data-testid={`mode-toggle-${opt.value}`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
