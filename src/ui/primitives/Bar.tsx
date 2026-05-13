/**
 * Bar — small horizontal progress / proportion bar.
 *
 * Pairs `.bar-track` (bg-3 rail) with `.bar-fill` (accent fill). Pass a
 * normalized 0..1 `value`.
 */
export interface BarProps {
  value: number; // 0..1
  className?: string;
  fillColor?: string; // override the default accent
}

export function Bar({ value, className = "", fillColor }: BarProps) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className={`bar-track ${className}`.trim()}>
      <div
        className="bar-fill"
        style={{
          width: `${pct}%`,
          background: fillColor,
        }}
      />
    </div>
  );
}

export default Bar;
