// src/components/activity/DeveloperPanel.tsx
// Phase 3 / D-26 / D-28 / D-31 — render-conditional developer panel for /activity.
//
// Mirrors src/components/extension/DeveloperPanel.tsx (Phase 2 D-15) verbatim
// in chrome (border-card vocabulary, chevron toggle, body section); the
// content is different (Failed-AI Breakdown + UI Interactions sub-panels).
//
// D-26 render-conditional gate:
//   if (!isDevAccount(profile?.email)) return null;
// — entire panel + all children absent from DOM (NOT display:hidden,
//   NOT aria-hidden). Mirrors Phase 2 D-15 enforcement.
//
// Pitfall (Phase 2 Pitfall 10): profile is null during initial render. The
// Zustand selector re-subscribes; when profile loads, this component
// re-renders. The null → dev-email transition mounts the panel mid-session.
//
// Initial state is collapsed (UI-SPEC § DeveloperPanel Layout). NO localStorage
// persistence — Phase 3 ships without it (UI-SPEC committed). Every fresh mount
// starts collapsed.

import { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { isDevAccount } from '../../lib/devAccess';
import { useDevDataInclusion } from '../../hooks/useDevDataInclusion';
import { FailedAiBreakdown } from './FailedAiBreakdown';
import { UiInteractionsPanel } from './UiInteractionsPanel';

const PANEL_BODY_ID = 'activity-developer-panel-body';

// Right-pointing chevron — rotates 90deg when expanded so the arrow points
// down. Uses a different visual idiom from Phase 2 (which uses a down-arrow
// rotated 180deg) but follows the same UI-SPEC committed contract: the chevron
// rotates on toggle.
function Chevron({ rotated }: { rotated: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={`w-4 h-4 motion-safe:transition-transform text-ink-3 ${
        rotated ? 'rotate-90' : ''
      }`}
      role="presentation"
      focusable="false"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m8.25 4.5 7.5 7.5-7.5 7.5"
      />
    </svg>
  );
}

export function DeveloperPanel() {
  const email = useAuthStore(
    (s) =>
      (s as { profile: { email: string | null } | null }).profile?.email ?? null,
  );
  const [isExpanded, setIsExpanded] = useState(false);

  // D-26 render-conditional gate — returns null for non-dev (entire subtree
  // absent from DOM). NOT display:hidden, NOT aria-hidden.
  if (!isDevAccount(email)) return null;

  return (
    <section
      className="rounded-lg border border-rule bg-bg mt-8"
      data-testid="developer-panel"
    >
      <button
        type="button"
        onClick={() => setIsExpanded((e) => !e)}
        aria-expanded={isExpanded}
        aria-controls={PANEL_BODY_ID}
        aria-label={
          isExpanded ? 'Collapse developer panel' : 'Expand developer panel'
        }
        className="w-full flex items-center justify-between px-4 h-12 hover:bg-bg-2 focus:ring-2 focus:ring-accent rounded-lg outline-none"
      >
        <div className="flex items-center gap-2">
          <Chevron rotated={isExpanded} />
          <span className="text-sm font-semibold text-ink-2">
            Developer panel
          </span>
          <span className="text-xs text-ink-3">
            Diagnostics for {email}
          </span>
        </div>
      </button>
      {isExpanded && (
        <div
          id={PANEL_BODY_ID}
          className="border-t border-rule p-6 space-y-6"
        >
          <DevDataInclusionToggle />
          <FailedAiBreakdown />
          <UiInteractionsPanel />
        </div>
      )}
    </section>
  );
}

// Phase 8: opt-in toggle for "include my (the dev's) testing/debug data in
// admin-facing analytics". OFF by default so the dev's first view matches
// what admin sees; flipping ON makes the dev's own dashboard surface their
// activity for self-debugging. Persists to localStorage so the preference
// survives reload.
//
// Lives inside DeveloperPanel so the toggle is structurally absent for
// non-dev (the panel itself returns null for non-dev). Defence-in-depth at
// the hook layer is in src/hooks/useDevDataInclusion.ts.
function DevDataInclusionToggle() {
  const { includeDev, setIncludeDev } = useDevDataInclusion();
  return (
    <section
      className="rounded border border-rule bg-bg p-4"
      data-testid="dev-data-inclusion-toggle"
    >
      <h3 className="text-sm font-semibold text-ink-2 mb-2">
        Include my test data
      </h3>
      <p className="text-xs text-ink-3 mb-3">
        Admin views exclude Josh's testing/debug data by default so the team's
        real activity stays clean. Flip this on to surface your own activity
        in this dashboard for self-debugging.
      </p>
      <label className="inline-flex items-center gap-2 cursor-pointer text-sm">
        <input
          type="checkbox"
          checked={includeDev}
          onChange={(e) => setIncludeDev(e.target.checked)}
          className="h-4 w-4 rounded border-rule text-accent focus:ring-2 focus:ring-accent"
          data-testid="dev-data-inclusion-checkbox"
        />
        <span className="text-ink-2">
          {includeDev
            ? 'Showing your test data (admin views still exclude it)'
            : 'Hidden — matches the admin view'}
        </span>
      </label>
    </section>
  );
}
