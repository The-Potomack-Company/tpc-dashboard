import { useDominantVersion } from '../../hooks/extension/useDominantVersion';

// Phase 2 / EXT-09 — Dominant extension_version chip displayed in the
// DeveloperPanel title row. Updates as filters change because
// useDominantVersion folds the active filters into its queryKey.
//
// Tie-break (latest semver) is owned by the RPC (D-06). When the filter
// selection returns no rows, the hook returns `null`; we render `Dominant: —`.
// Styling follows UI-SPEC § Color: text-sm font-semibold + bg-bg-3
// text-ink-2 chip; non-interactive <span> (NOT a button — the panel toggle
// button hosts the badge inside it).

export function DominantVersionBadge() {
  const { data } = useDominantVersion();
  const version = data?.extension_version ?? null;
  const label = version ? `Dominant: v${version}` : 'Dominant: —';
  return (
    <span
      className="text-sm font-semibold bg-bg-3 text-ink-2 rounded px-2 py-0.5"
      data-testid="dominant-version-badge"
    >
      {label}
    </span>
  );
}
