// Shimmer placeholder matching KpiCard dimensions 1:1 so data arrival does
// not cause layout shift. Three shimmer bars correspond to the three lines
// inside KpiCard: label (h-3 w-24), value (h-4 w-32), delta (h-3 w-40).
//
// Contract: 04-UI-SPEC.md § Interaction Contract (Loading patterns) and
// § Layout Specifications → `KpiCard` component.

export function KpiCardSkeleton() {
  return (
    <div className="p-6 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 min-h-[128px] space-y-2">
      <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded motion-safe:animate-pulse" />
      <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded motion-safe:animate-pulse" />
      <div className="h-3 w-40 bg-gray-200 dark:bg-gray-700 rounded motion-safe:animate-pulse" />
    </div>
  );
}
