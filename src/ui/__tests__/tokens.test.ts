import { describe, it, expect } from "vitest";
import {
  tpcUnifiedLight,
  tpcUnifiedDark,
  paletteFor,
  fonts,
  radii,
} from "../tokens";

/**
 * Token regression guard — keeps the TS mirror in lock-step with the
 * CSS source of truth. If a token key is added/renamed in tokens.css,
 * adding/renaming it here in tokens.ts will keep both halves of the
 * mirror in sync.
 */
describe("design tokens", () => {
  it("has the canonical light palette keys", () => {
    const keys = Object.keys(tpcUnifiedLight).sort();
    expect(keys).toEqual(
      [
        "accent",
        "accentHover",
        "accentInk",
        "accentWash",
        "bg",
        "bg2",
        "bg3",
        "err",
        "errWash",
        "ink",
        "ink2",
        "ink3",
        "ink4",
        "ok",
        "okWash",
        "rule",
        "rule2",
        "sand",
        "sandWash",
        "warn",
        "warnWash",
      ].sort(),
    );
  });

  it("dark palette has the same keys as light", () => {
    expect(Object.keys(tpcUnifiedDark).sort()).toEqual(
      Object.keys(tpcUnifiedLight).sort(),
    );
  });

  it("light accent is the teal-blue value", () => {
    expect(tpcUnifiedLight.accent).toBe("oklch(0.58 0.13 225)");
  });

  it("dark accent shifts brighter (same hue)", () => {
    expect(tpcUnifiedDark.accent).toBe("oklch(0.72 0.13 225)");
  });

  it("paletteFor returns the right palette", () => {
    expect(paletteFor("light")).toBe(tpcUnifiedLight);
    expect(paletteFor("dark")).toBe(tpcUnifiedDark);
  });

  it("exports the canonical font + radius constants", () => {
    expect(fonts.display).toBe("EB Garamond");
    expect(fonts.ui).toBe("Inter");
    expect(fonts.mono).toBe("IBM Plex Mono");
    expect(radii).toEqual({ sm: 4, md: 6, lg: 10 });
  });
});
