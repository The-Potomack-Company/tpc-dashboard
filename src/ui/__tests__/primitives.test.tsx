import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import {
  Button,
  Badge,
  Input,
  Card,
  Eyebrow,
  Bar,
  Placeholder,
} from "../index";

describe("UI primitives", () => {
  describe("Button", () => {
    it("renders with the primary variant by default", () => {
      const { getByRole } = render(<Button>Save</Button>);
      const btn = getByRole("button");
      expect(btn.className).toContain("tpc-btn");
      expect(btn.className).toContain("tpc-btn-primary");
      expect(btn.textContent).toBe("Save");
    });

    it("applies the variant class for secondary / ghost / danger", () => {
      const cases: Array<"secondary" | "ghost" | "danger"> = [
        "secondary",
        "ghost",
        "danger",
      ];
      for (const variant of cases) {
        const { getByRole, unmount } = render(
          <Button variant={variant}>x</Button>,
        );
        expect(getByRole("button").className).toContain(`tpc-btn-${variant}`);
        unmount();
      }
    });

    it("respects fullWidth", () => {
      const { getByRole } = render(<Button fullWidth>x</Button>);
      const btn = getByRole("button") as HTMLButtonElement;
      expect(btn.style.width).toBe("100%");
    });

    it("renders icon + iconRight slots", () => {
      const { getByRole } = render(
        <Button icon={<span data-testid="left" />} iconRight={<span data-testid="right" />}>
          Go
        </Button>,
      );
      const btn = getByRole("button");
      expect(btn.querySelector("[data-testid='left']")).not.toBeNull();
      expect(btn.querySelector("[data-testid='right']")).not.toBeNull();
    });
  });

  describe("Badge", () => {
    it("applies neutral by default (no tone modifier)", () => {
      const { container } = render(<Badge>1</Badge>);
      const el = container.firstChild as HTMLElement;
      expect(el.className).toContain("tpc-badge");
      expect(el.className).not.toContain("tpc-badge-");
    });

    it("applies the tone class for ok / warn / err / info", () => {
      const tones = ["ok", "warn", "err", "info"] as const;
      for (const tone of tones) {
        const { container, unmount } = render(<Badge tone={tone}>x</Badge>);
        const el = container.firstChild as HTMLElement;
        expect(el.className).toContain(`tpc-badge-${tone}`);
        unmount();
      }
    });

    it("renders a leading dot when requested", () => {
      const { container } = render(<Badge dot>x</Badge>);
      expect(container.querySelector(".tpc-dot")).not.toBeNull();
    });
  });

  describe("Input", () => {
    it("applies the tpc-input class and forwards props", () => {
      const { getByPlaceholderText } = render(
        <Input placeholder="search" defaultValue="hi" />,
      );
      const input = getByPlaceholderText("search") as HTMLInputElement;
      expect(input.className).toContain("tpc-input");
      expect(input.value).toBe("hi");
    });
  });

  describe("Card", () => {
    it("applies the tpc-card class", () => {
      const { container } = render(<Card>x</Card>);
      const el = container.firstChild as HTMLElement;
      expect(el.className).toContain("tpc-card");
    });

    it("adds p-4 when padded", () => {
      const { container } = render(<Card padded>x</Card>);
      const el = container.firstChild as HTMLElement;
      expect(el.className).toContain("p-4");
    });
  });

  describe("Eyebrow", () => {
    it("applies the tpc-eyebrow class", () => {
      const { container } = render(<Eyebrow>label</Eyebrow>);
      const el = container.firstChild as HTMLElement;
      expect(el.className).toContain("tpc-eyebrow");
      expect(el.textContent).toBe("label");
    });
  });

  describe("Bar", () => {
    it("clamps value to 0..1 and renders fill width", () => {
      const { container } = render(<Bar value={0.42} />);
      const fill = container.querySelector(".bar-fill") as HTMLElement;
      expect(fill.style.width).toBe("42%");
    });

    it("clamps over-range values", () => {
      const { container } = render(<Bar value={3} />);
      const fill = container.querySelector(".bar-fill") as HTMLElement;
      expect(fill.style.width).toBe("100%");
    });
  });

  describe("Placeholder", () => {
    it("applies the tpc-placeholder class", () => {
      const { container } = render(<Placeholder label="missing" />);
      const el = container.firstChild as HTMLElement;
      expect(el.className).toContain("tpc-placeholder");
      expect(el.textContent).toBe("missing");
    });
  });
});
