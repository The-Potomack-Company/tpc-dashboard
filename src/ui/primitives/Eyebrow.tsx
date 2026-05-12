import type { HTMLAttributes, ReactNode } from "react";

/**
 * Eyebrow — small uppercased letterspaced label, ink-3 color.
 *
 * Mirrors the prototype's `.tpc-eyebrow` treatment. Used above section
 * headings, KPI labels, etc.
 */
export interface EyebrowProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
}

export function Eyebrow({ className = "", children, ...rest }: EyebrowProps) {
  return (
    <div {...rest} className={`tpc-eyebrow ${className}`.trim()}>
      {children}
    </div>
  );
}

export default Eyebrow;
