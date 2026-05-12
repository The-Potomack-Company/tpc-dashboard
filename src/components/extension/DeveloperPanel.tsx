import { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { isDevAccount } from '../../lib/devAccess';
import { DominantVersionBadge } from './DominantVersionBadge';
import { ExtensionVersionFilter } from './ExtensionVersionFilter';
import { CancellationRateKpis } from './CancellationRateKpis';

// Phase 2 / D-15 / D-16 — Developer panel.
//
// Render-gated by isDevAccount(profile?.email). Returns null for non-devs —
// NOT display:hidden (RESEARCH Anti-Patterns: a hidden subtree would still
// surface in the DOM and place the version filter in the keyboard tab order).
//
// Pitfall 10: profile is null during initial render. The Zustand selector
// re-subscribes; when profile loads, this component re-renders. The
// null → dev-email transition mounts the panel mid-session.
//
// Chrome uses the same border-card vocabulary as the rest of the page
// (UI-SPEC: 'visually quiet' — no inverted card, no warning band).

const PANEL_BODY_ID = 'dev-panel-body';

function Chevron({ rotated }: { rotated: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      className={`w-4 h-4 motion-safe:transition-transform ${
        rotated ? 'rotate-180' : ''
      }`}
      role="presentation"
      focusable="false"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m19.5 8.25-7.5 7.5-7.5-7.5"
      />
    </svg>
  );
}

export function DeveloperPanel() {
  const email = useAuthStore((s) => (s as { profile: { email: string | null } | null }).profile?.email ?? null);
  const [isExpanded, setIsExpanded] = useState(false);

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
        <DominantVersionBadge />
      </button>
      {isExpanded && (
        <div
          id={PANEL_BODY_ID}
          className="border-t border-rule p-6 space-y-6"
        >
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-ink-2">
              Extension version
            </h3>
            <ExtensionVersionFilter />
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-ink-2">
              Cancellation rates
            </h3>
            <CancellationRateKpis />
          </div>
        </div>
      )}
    </section>
  );
}
