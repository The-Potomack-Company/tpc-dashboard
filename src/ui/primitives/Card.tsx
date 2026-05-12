import type { HTMLAttributes, ReactNode } from "react";

/**
 * Card — typed wrapper that applies the `.tpc-card` class.
 *
 * Mirrors the prototype's card treatment: bg + rule border + lg radius.
 * Pass `padded` to also apply the canonical `p-4` content inset.
 */
export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
  children?: ReactNode;
}

export function Card({
  padded = false,
  className = "",
  children,
  ...rest
}: CardProps) {
  const padCls = padded ? " p-4" : "";
  return (
    <div {...rest} className={`tpc-card${padCls} ${className}`.trim()}>
      {children}
    </div>
  );
}

export default Card;
