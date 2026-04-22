// Shimmer placeholder sized to match ChartCard so the skeleton → chart swap
// produces no layout shift. Contract: 05-UI-SPEC.md § ChartSkeleton
// component (lines 842-853).
//
// Two heights: 'sm' (h-80, 320px) for line/area charts, 'lg' (h-[400px])
// for the TRND-04 heat-map surface. motion-safe:animate-pulse respects
// prefers-reduced-motion — static bars for users who requested it.

interface ChartSkeletonProps {
  /** `'sm'` (default, h-80) matches line/area charts; `'lg'` (h-[400px])
   *  matches the heat-map card. */
  height?: 'sm' | 'lg';
}

export function ChartSkeleton({ height = 'sm' }: ChartSkeletonProps) {
  const bodyHeight = height === 'lg' ? 'h-[400px]' : 'h-80';
  return (
    <div className="p-6 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      {/* Title shimmer bar — 16×192px. */}
      <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded motion-safe:animate-pulse" />
      {/* Subtitle shimmer bar — 12×256px. */}
      <div className="mt-1 h-3 w-64 bg-gray-200 dark:bg-gray-700 rounded motion-safe:animate-pulse" />
      {/* Body shimmer bar — full-width × 320px (sm) or 400px (lg). aria-label
          lets screen readers announce the loading state. */}
      <div
        aria-label="Loading chart"
        className={`mt-4 ${bodyHeight} w-full bg-gray-200 dark:bg-gray-700 rounded motion-safe:animate-pulse`}
      />
    </div>
  );
}
