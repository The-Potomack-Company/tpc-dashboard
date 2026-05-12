import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Icon } from "../icons/Icon";
import { ICON_MANIFEST } from "../icons/manifest";
import { DashboardAppMark } from "../icons/AppIcons";

describe("Icon library", () => {
  it("renders an SVG for every manifest entry", () => {
    for (const name of Object.keys(ICON_MANIFEST)) {
      const { container, unmount } = render(
        <Icon name={name as keyof typeof ICON_MANIFEST} />,
      );
      const svg = container.querySelector("svg");
      expect(svg, `Icon ${name} should render an <svg>`).not.toBeNull();
      unmount();
    }
  });

  it("uses currentColor for stroke (so text-* tokens drive color)", () => {
    const { container } = render(<Icon name="search" />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("stroke")).toBe("currentColor");
  });

  it("forwards size prop to width/height", () => {
    const { container } = render(<Icon name="check" size={24} />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("24");
    expect(svg?.getAttribute("height")).toBe("24");
  });

  it("renders a labeled icon when title is provided", () => {
    const { container } = render(<Icon name="users" title="Specialists" />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("role")).toBe("img");
    expect(svg?.getAttribute("aria-label")).toBe("Specialists");
  });

  it("returns null for an unknown name (defensive)", () => {
    // Cast through unknown to exercise the runtime unknown-name guard
    // without relying on // @ts-expect-error semantics.
    const name = "not-a-real-icon" as unknown as keyof typeof ICON_MANIFEST;
    const { container } = render(<Icon name={name} />);
    expect(container.firstChild).toBeNull();
  });
});

describe("DashboardAppMark", () => {
  it("renders the dial glyph", () => {
    const { container } = render(<DashboardAppMark size={32} />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    // The dial needle path is the load-bearing indicator stroke.
    const accentStroke = container.querySelector(
      'path[stroke="var(--accent)"]',
    );
    expect(accentStroke).not.toBeNull();
  });
});
