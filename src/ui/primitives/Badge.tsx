import type { ReactNode } from "react";

/**
 * Badge — typed React port of prototype-primitives.jsx `TPCBadge`.
 *
 * Applies `.tpc-badge` plus an optional `.tpc-badge-<tone>` modifier.
 *
 * Tones (color usage):
 *   - neutral — bg-3 background, ink-2 text (default)
 *   - ok / warn / err / info — wash backgrounds with matched ink
 *
 * Pass `dot` to render a 5px leading status dot in the active color.
 */
export type BadgeTone = "neutral" | "ok" | "warn" | "err" | "info";

export interface BadgeProps {
  tone?: BadgeTone;
  dot?: boolean;
  children?: ReactNode;
  className?: string;
}

export function Badge({
  tone = "neutral",
  dot,
  children,
  className = "",
}: BadgeProps) {
  const toneClass = tone === "neutral" ? "" : ` tpc-badge-${tone}`;
  return (
    <span className={`tpc-badge${toneClass} ${className}`.trim()}>
      {dot && <span className="tpc-dot" />}
      {children}
    </span>
  );
}

export default Badge;
