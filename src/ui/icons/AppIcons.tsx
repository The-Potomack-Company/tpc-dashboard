import type { CSSProperties, ReactNode } from "react";

/**
 * App icons — typed React ports of prototype-icons.jsx.
 *
 * Each app has:
 *   - <XxxAppIcon /> — full tile with corner "TPC" italic mark
 *   - <XxxAppMark /> — inline tile WITHOUT the corner mark (for use
 *     inside an app's own header where the product identity is the
 *     whole point of the mark).
 *
 * Variants:
 *   - paper  — near-white tile + ink glyph + accent highlight (default)
 *   - ink    — ink tile + bg glyph + accent highlight
 *   - accent — accent tile + bg glyph
 *   - bg     — bg-2 tile
 *
 * The dashboard's mark is the analog dial / gauge motif.
 */

type Variant = "paper" | "ink" | "accent" | "bg";

interface AppIconTileProps {
  size?: number;
  variant?: Variant;
  corner?: ReactNode;
  children: ReactNode;
}

function tileBg(variant: Variant): string {
  switch (variant) {
    case "ink":
      return "var(--ink)";
    case "accent":
      return "var(--accent)";
    case "bg":
      return "var(--bg-2)";
    case "paper":
    default:
      return "var(--bg)";
  }
}

function tileBorder(variant: Variant): string {
  switch (variant) {
    case "paper":
      return "var(--rule-2)";
    case "ink":
      return "var(--ink)";
    default:
      return "transparent";
  }
}

function cornerColor(variant: Variant): string {
  switch (variant) {
    case "paper":
      return "var(--ink-3)";
    case "ink":
      return "var(--ink-3)";
    default:
      return "rgba(255,255,255,0.55)";
  }
}

function glyphStroke(variant: Variant): string {
  return variant === "ink" || variant === "accent" ? "var(--bg)" : "var(--ink)";
}

function glyphAccent(variant: Variant): string {
  return variant === "accent" ? "var(--bg)" : "var(--accent)";
}

function AppIconTile({
  size = 96,
  variant = "paper",
  corner = "TPC",
  children,
}: AppIconTileProps) {
  const radius = size * 0.22;
  const style: CSSProperties = {
    position: "relative",
    width: size,
    height: size,
    borderRadius: radius,
    background: tileBg(variant),
    border: `1px solid ${tileBorder(variant)}`,
    overflow: "hidden",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow:
      variant === "paper"
        ? "0 1px 0 rgba(255,255,255,0.9) inset, 0 8px 24px -10px rgba(20,24,40,0.18), 0 2px 4px -1px rgba(20,24,40,0.06)"
        : "0 8px 24px -10px rgba(20,24,40,0.28), 0 2px 4px -1px rgba(20,24,40,0.1)",
  };
  return (
    <div style={style}>
      {children}
      {corner && (
        <span
          style={{
            position: "absolute",
            top: size * 0.08,
            right: size * 0.09,
            fontFamily: "var(--font-display)",
            fontStyle: "italic",
            fontSize: size * 0.14,
            lineHeight: 1,
            color: cornerColor(variant),
            letterSpacing: 0,
          }}
        >
          {corner}
        </span>
      )}
    </div>
  );
}

export interface AppIconProps {
  size?: number;
  variant?: Variant;
}

// ---------- Voice ----------
export function VoiceAppIcon({ size = 96, variant = "paper" }: AppIconProps) {
  const stroke = glyphStroke(variant);
  const accent = glyphAccent(variant);
  return (
    <AppIconTile size={size} variant={variant}>
      <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 48 48" fill="none">
        <path d="M10 17a14 14 0 0 1 28 0" stroke={accent} strokeWidth="1.4" strokeLinecap="round" opacity="0.4" />
        <path d="M14 17a10 10 0 0 1 20 0" stroke={accent} strokeWidth="1.4" strokeLinecap="round" opacity="0.7" />
        <path d="M18 17a6 6 0 0 1 12 0" stroke={accent} strokeWidth="1.4" strokeLinecap="round" />
        <rect x="19" y="21" width="10" height="14" rx="5" stroke={stroke} strokeWidth="1.8" />
        <path d="M15 31a9 9 0 0 0 18 0" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
        <path d="M24 40v4M20 44h8" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </AppIconTile>
  );
}

export function VoiceAppMark({ size = 22 }: { size?: number }) {
  return (
    <AppIconTile size={size} variant="paper" corner={null}>
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 48 48" fill="none">
        <path d="M10 17a14 14 0 0 1 28 0" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" opacity="0.4" />
        <path d="M14 17a10 10 0 0 1 20 0" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" opacity="0.7" />
        <path d="M18 17a6 6 0 0 1 12 0" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" />
        <rect x="19" y="21" width="10" height="14" rx="5" stroke="var(--ink)" strokeWidth="2" />
        <path d="M15 31a9 9 0 0 0 18 0" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
        <path d="M24 40v4M20 44h8" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </AppIconTile>
  );
}

// ---------- Extension ----------
export function ExtensionAppIcon({ size = 96, variant = "paper" }: AppIconProps) {
  const stroke = glyphStroke(variant);
  const accent = glyphAccent(variant);
  return (
    <AppIconTile size={size} variant={variant}>
      <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 48 48" fill="none">
        <rect x="6" y="9" width="36" height="30" rx="3" stroke={stroke} strokeWidth="1.8" />
        <path d="M6 17h36" stroke={stroke} strokeWidth="1.4" />
        <circle cx="10" cy="13" r="0.9" fill={stroke} />
        <circle cx="13.5" cy="13" r="0.9" fill={stroke} />
        <circle cx="17" cy="13" r="0.9" fill={stroke} />
        <path
          d="M26 22h6v4a2 2 0 0 0 2 2h2v5a1 1 0 0 1-1 1h-9v-5a2 2 0 0 0-2-2h-2v-4a1 1 0 0 1 1-1z"
          fill={accent}
          stroke={accent}
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
    </AppIconTile>
  );
}

export function ExtensionAppMark({ size = 22 }: { size?: number }) {
  return (
    <AppIconTile size={size} variant="paper" corner={null}>
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 48 48" fill="none">
        <rect x="6" y="9" width="36" height="30" rx="3" stroke="var(--ink)" strokeWidth="2" />
        <path d="M6 17h36" stroke="var(--ink)" strokeWidth="1.4" />
        <circle cx="10" cy="13" r="0.9" fill="var(--ink)" />
        <circle cx="13.5" cy="13" r="0.9" fill="var(--ink)" />
        <circle cx="17" cy="13" r="0.9" fill="var(--ink)" />
        <path
          d="M26 22h6v4a2 2 0 0 0 2 2h2v5a1 1 0 0 1-1 1h-9v-5a2 2 0 0 0-2-2h-2v-4a1 1 0 0 1 1-1z"
          fill="var(--accent)"
          stroke="var(--accent)"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
    </AppIconTile>
  );
}

// ---------- Dashboard ----------
export function DashboardAppIcon({ size = 96, variant = "paper" }: AppIconProps) {
  const stroke = glyphStroke(variant);
  const accent = glyphAccent(variant);
  return (
    <AppIconTile size={size} variant={variant}>
      <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 48 48" fill="none">
        <path d="M8 32a16 16 0 0 1 32 0" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
        <path
          d="M10 26l2 1M14 20l1.8 1.5M24 16v2M34 20l-1.8 1.5M38 26l-2 1"
          stroke={stroke}
          strokeWidth="1.4"
          strokeLinecap="round"
          opacity="0.6"
        />
        <path d="M24 32L31 19" stroke={accent} strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="24" cy="32" r="2.2" fill={accent} />
      </svg>
    </AppIconTile>
  );
}

export function DashboardAppMark({ size = 22 }: { size?: number }) {
  return (
    <AppIconTile size={size} variant="paper" corner={null}>
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 48 48" fill="none">
        <path d="M8 32a16 16 0 0 1 32 0" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
        <path
          d="M10 26l2 1M14 20l1.8 1.5M24 16v2M34 20l-1.8 1.5M38 26l-2 1"
          stroke="var(--ink)"
          strokeWidth="1.4"
          strokeLinecap="round"
          opacity="0.6"
        />
        <path d="M24 32L31 19" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="24" cy="32" r="2.2" fill="var(--accent)" />
      </svg>
    </AppIconTile>
  );
}
