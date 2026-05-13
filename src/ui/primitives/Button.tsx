import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * Button — typed React port of prototype-primitives.jsx `TPCBtn`.
 *
 * Applies the `.tpc-btn` + `.tpc-btn-<variant>` classes from
 * src/ui/tokens/base.css. Visual treatment is variant-driven; callers do
 * NOT pass color/background classes.
 *
 * Variants:
 *   - primary   — accent background, accent-ink text (action)
 *   - secondary — bg + rule border, ink text (default outline)
 *   - ghost     — transparent, ink-2 (low-emphasis)
 *   - danger    — transparent + err border, err text (destructive)
 *
 * Sizes:
 *   - sm | md | lg — translates to the same padding/font-size deltas as
 *     the prototype.
 */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
  children?: ReactNode;
}

const SIZE_STYLE: Record<ButtonSize, { padding?: string; fontSize?: number }> = {
  sm: { padding: "4px 9px", fontSize: 11.5 },
  md: {},
  lg: { padding: "9px 16px" },
};

export function Button({
  variant = "primary",
  size = "md",
  fullWidth,
  icon,
  iconRight,
  children,
  className = "",
  style,
  ...rest
}: ButtonProps) {
  const cls = `tpc-btn tpc-btn-${variant} ${className}`.trim();
  const sizing = SIZE_STYLE[size];
  return (
    <button
      type="button"
      {...rest}
      className={cls}
      style={{
        width: fullWidth ? "100%" : undefined,
        padding: sizing.padding,
        fontSize: sizing.fontSize,
        ...style,
      }}
    >
      {icon}
      {children !== undefined && <span>{children}</span>}
      {iconRight}
    </button>
  );
}

export default Button;
