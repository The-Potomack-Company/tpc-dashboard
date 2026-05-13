import { describe, it, expect } from "vitest";
import { tpcUnifiedLight, tpcUnifiedDark } from "../tokens/tokens";

/**
 * Token a11y guard — keeps the unified palette's lightness deltas inside a
 * sensible WCAG-adjacent envelope. We don't run real contrast math against
 * sRGB conversions here (oklch -> sRGB is browser-dependent), but we DO
 * assert the lightness anchors that drive contrast under both themes.
 *
 * Catches the obvious regressions: someone accidentally darkens --bg or
 * lightens --ink so the two collapse into each other, or someone flips
 * the dark palette's lightness ordering.
 */

function lightness(oklch: string): number {
  const match = oklch.match(/oklch\(\s*([\d.]+)/);
  if (!match) throw new Error(`Unexpected OKLCH literal: ${oklch}`);
  return parseFloat(match[1]);
}

describe("token a11y envelopes", () => {
  it("light theme: bg is brighter than ink (positive contrast)", () => {
    expect(lightness(tpcUnifiedLight.bg)).toBeGreaterThan(
      lightness(tpcUnifiedLight.ink) + 0.5,
    );
  });

  it("dark theme: bg is darker than ink (positive inverted contrast)", () => {
    expect(lightness(tpcUnifiedDark.ink)).toBeGreaterThan(
      lightness(tpcUnifiedDark.bg) + 0.5,
    );
  });

  it("ink ramp is monotonic in both themes (ink > ink2 > ink3 > ink4 in light; reversed for dark)", () => {
    expect(lightness(tpcUnifiedLight.ink)).toBeLessThan(
      lightness(tpcUnifiedLight.ink2),
    );
    expect(lightness(tpcUnifiedLight.ink2)).toBeLessThan(
      lightness(tpcUnifiedLight.ink3),
    );
    expect(lightness(tpcUnifiedLight.ink3)).toBeLessThan(
      lightness(tpcUnifiedLight.ink4),
    );
    expect(lightness(tpcUnifiedDark.ink)).toBeGreaterThan(
      lightness(tpcUnifiedDark.ink2),
    );
    expect(lightness(tpcUnifiedDark.ink2)).toBeGreaterThan(
      lightness(tpcUnifiedDark.ink3),
    );
    expect(lightness(tpcUnifiedDark.ink3)).toBeGreaterThan(
      lightness(tpcUnifiedDark.ink4),
    );
  });

  it("bg ramp is monotonic (bg > bg2 > bg3 in light; reversed for dark)", () => {
    expect(lightness(tpcUnifiedLight.bg)).toBeGreaterThan(
      lightness(tpcUnifiedLight.bg2),
    );
    expect(lightness(tpcUnifiedLight.bg2)).toBeGreaterThan(
      lightness(tpcUnifiedLight.bg3),
    );
    expect(lightness(tpcUnifiedDark.bg)).toBeLessThan(
      lightness(tpcUnifiedDark.bg2),
    );
    expect(lightness(tpcUnifiedDark.bg2)).toBeLessThan(
      lightness(tpcUnifiedDark.bg3),
    );
  });

  it("accent-ink contrasts the accent surface (light + dark)", () => {
    // accent-ink is the foreground when the accent is the background
    // (eg. primary button label). Lightness delta of >= 0.4 catches the
    // common "accent-ink == accent" regression that would render labels
    // invisible.
    expect(
      Math.abs(
        lightness(tpcUnifiedLight.accentInk) - lightness(tpcUnifiedLight.accent),
      ),
    ).toBeGreaterThan(0.3);
    expect(
      Math.abs(
        lightness(tpcUnifiedDark.accentInk) - lightness(tpcUnifiedDark.accent),
      ),
    ).toBeGreaterThan(0.3);
  });
});
