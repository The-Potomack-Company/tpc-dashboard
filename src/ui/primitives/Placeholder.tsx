import type { CSSProperties, ReactNode } from "react";

/**
 * Placeholder — hatched stripe placeholder for missing imagery during
 * build. Mirrors prototype's `.tpc-placeholder`.
 */
export interface PlaceholderProps {
  label?: ReactNode;
  width?: number | string;
  height?: number | string;
  style?: CSSProperties;
  className?: string;
}

export function Placeholder({
  label,
  width,
  height,
  style,
  className = "",
}: PlaceholderProps) {
  return (
    <div
      className={`tpc-placeholder ${className}`.trim()}
      style={{ width, height, ...style }}
    >
      {label}
    </div>
  );
}

export default Placeholder;
